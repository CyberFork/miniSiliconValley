import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import type { AuthenticatedClassroomUser } from "../app/lib/classroom-api";
import { ClassroomError } from "../app/lib/classroom-errors";
import {
  UI_ACCEPTANCE_REQUIRED_CHECKS,
  acceptanceLearnerCounts,
  createViewAcceptanceReceipt,
  listAcceptanceClassrooms,
  listUiAcceptanceReceipts,
  requireValidUiAcceptanceReceipt,
  studioUiAcceptanceSummary,
  studioViewAcceptanceSummary,
} from "../app/lib/course-acceptance";
import type { ClassroomFactoryRequest, ClassroomMentorRole } from "../app/lib/classroom-factory";
import {
  applyScriptAction,
  archiveTestClassroom,
  deleteTestClassroom,
  acceptTestClassroom,
  classroomRunId,
  createClassroomInstance,
  finishClassroomRun,
  getClassroomInstance,
  listClassroomInstances,
  previewTestClassroomDeletion,
  resetTestClassroom,
  reviewClassroomSubmission,
  submitClassroomBlockWork,
  updateClassroomMembership,
} from "../app/lib/classroom-platform-store";
import { ensureBundledCourseRegistry, loadExactCoursePackage, saveCourseCandidate } from "../app/lib/course-registry";
import { ensureBundledCourseware, listCourseware } from "../app/lib/courseware-store";
import { canCommitClassroomRuntimeResponse, classroomDeviceDraftKey, classroomRuntimeRequestKey } from "../app/lib/classroom-runtime-sync";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & {
  raw: DatabaseSync;
  failNextBatchAt: number | null;
  lastBatchSize: number;
};

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function database(): LocalDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item)).sort()) {
    raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  let failNextBatchAt: number | null = null;
  let lastBatchSize = 0;
  const api = {
    raw,
    get failNextBatchAt() { return failNextBatchAt; },
    set failNextBatchAt(value: number | null) { failNextBatchAt = value; },
    get lastBatchSize() { return lastBatchSize; },
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; },
        async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; },
        async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; },
        async run() { return statement.execute(); },
        execute() {
          const result = raw.prepare(sql).run(...values);
          return { success: true, meta: { changes: result.changes } } as unknown as D1Result;
        },
      };
      return statement;
    },
    async batch(statements: LocalStatement[]) {
      lastBatchSize = statements.length;
      const injectedAt = failNextBatchAt;
      failNextBatchAt = null;
      raw.exec("BEGIN IMMEDIATE");
      try {
        const results: D1Result[] = [];
        for (const [index, statement] of statements.entries()) {
          if (index === injectedAt) throw new Error(`INJECTED_BATCH_FAILURE:${index}/${statements.length}`);
          results.push(statement.execute());
        }
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return api as unknown as LocalDatabase;
}

const admin: AuthenticatedClassroomUser = {
  userId: "atomic-admin",
  displayName: "Atomic Admin",
  platformRole: "admin",
};
const acceptanceAdmin = { userId: admin.userId, platformRole: "admin" as const };
const mentorIds: Record<ClassroomMentorRole, string> = {
  P: "atomic-mentor-p",
  D: "atomic-mentor-d",
  M: "atomic-mentor-m",
  O: "atomic-mentor-o",
};
const learnerIds = ["atomic-learner-1", "atomic-learner-2"];

function seedAccount(db: LocalDatabase, id: string, role: "admin" | "mentor" | "learner"): void {
  const now = "2026-09-10T00:00:00.000Z";
  db.raw.prepare("INSERT INTO profiles (id,nickname,created_at,updated_at) VALUES (?,?,?,?)").run(id, id, now, now);
  db.raw.prepare(
    `INSERT INTO auth_users
     (id,username,display_name,role,status,password_hash,password_salt,password_iterations,password_changed_at,must_change_password,created_at,updated_at)
     VALUES (?,?,?,?,'active','fixture-hash','fixture-salt',1,?,0,?,?)`,
  ).run(id, id, id, role, now, now, now);
}

async function fixture(mutateCourse?: (course: Record<string, unknown>) => void): Promise<{
  db: LocalDatabase;
  roomId: string;
  request: ClassroomFactoryRequest;
  sourceCourse: Record<string, unknown>;
  viewReceipt: Awaited<ReturnType<typeof createViewAcceptanceReceipt>>;
}> {
  const db = database();
  seedAccount(db, admin.userId, "admin");
  for (const id of Object.values(mentorIds)) seedAccount(db, id, "mentor");
  for (const id of learnerIds) seedAccount(db, id, "learner");
  await ensureBundledCourseRegistry(db);
  await ensureBundledCourseware(db);

  const sourceCourse = JSON.parse(
    readFileSync(new URL("../tools/live-run/courses/candidates/eleme-2008-unified-t095.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;
  mutateCourse?.(sourceCourse);
  const ref = await saveCourseCandidate(db, sourceCourse, admin.userId, null);
  const course = await loadExactCoursePackage(db, ref);
  const viewReceipt = await createViewAcceptanceReceipt(db, {
    courseRef: ref,
    reviewedBlockIds: course.blocks.map((block) => block.id),
    reviewedLearnerCounts: acceptanceLearnerCounts(course),
  }, admin.userId);
  const courseware = await listCourseware(db);
  const preferredSlugs = { P: "product-mentor-foundations", D: "development-mentor-ligun", M: "market-mentor-user-system", O: "operations-mentor-field-kit" } as const;
  const coursewareRefs = (["P", "D", "M", "O"] as const).map((mentorRole) => {
    const item = courseware.find((candidate) => candidate.mentorRole === mentorRole && candidate.slug === preferredSlugs[mentorRole] && candidate.releasedRevision !== null && candidate.releasedDigest);
    assert.ok(item, `${mentorRole} released courseware must exist`);
    const declared = course.contentPackages?.scriptPackages.find((scriptPackage) => scriptPackage.coursewareRef.mentorRole === mentorRole)?.coursewareRef;
    return {
      mentorRole,
      packageId: item.packageId,
      slug: item.slug,
      revision: declared?.revision ?? item.releasedRevision!,
      digest: declared?.digest ?? item.releasedDigest!,
    };
  });
  const request: ClassroomFactoryRequest = {
    environment: "test",
    title: "Atomic classroom fixture",
    learnerCount: learnerIds.length,
    courseRef: ref,
    viewAcceptanceReceiptId: viewReceipt.receiptId,
    coursewareRefs,
    adminDmProfileIds: [admin.userId],
    mentorSeats: (["P", "D", "M", "O"] as const).map((mentorRole) => ({ mentorRole, profileId: mentorIds[mentorRole] })),
    learnerProfileIds: learnerIds,
  };
  const created = await createClassroomInstance(db, admin, request);
  return { db, roomId: created.classroomId, request, sourceCourse, viewReceipt };
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  return expectClassroomError(promise, code, 409);
}

async function expectClassroomError(promise: Promise<unknown>, code: string, status: number): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ClassroomError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

function scriptState(db: LocalDatabase, roomId: string) {
  return { ...db.raw.prepare(
    `SELECT sp.version, sp.unlocked_through_block_id AS block_id, ci.lifecycle,
            (SELECT COUNT(*) FROM classroom_script_mutations WHERE room_id = ?) AS mutations,
            (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ? AND type = 'script.page-unlocked') AS events
     FROM classroom_script_progress sp JOIN classroom_instances ci ON ci.room_id = sp.room_id
     WHERE sp.room_id = ?`,
  ).get(roomId, roomId, roomId) } as { version: number; block_id: string; lifecycle: string; mutations: number; events: number };
}

test("T-105 scopes Studio classroom indexes to assigned mentors and redacts acceptance summaries", async () => {
  const { db, roomId, viewReceipt } = await fixture();
  try {
    const outsiderId = "atomic-mentor-outsider";
    seedAccount(db, outsiderId, "mentor");
    const assignedMentor = { userId: mentorIds.P, platformRole: "mentor" as const };
    const outsiderMentor = { userId: outsiderId, platformRole: "mentor" as const };

    assert.deepEqual((await listAcceptanceClassrooms(db, assignedMentor)).map((room) => room.roomId), [roomId]);
    assert.deepEqual(await listAcceptanceClassrooms(db, outsiderMentor), []);
    assert.deepEqual((await listAcceptanceClassrooms(db, acceptanceAdmin)).map((room) => room.roomId), [roomId]);

    const viewSummary = studioViewAcceptanceSummary(viewReceipt);
    assert.equal(Object.hasOwn(viewSummary, "reviewerProfileId"), false);
    assert.equal(Object.hasOwn(viewSummary, "checks"), false);
    assert.equal(Object.hasOwn(viewSummary, "scenarios"), false);
  } finally { db.raw.close(); }
});

test("applyScriptAction couples progress, lifecycle, and audit writes atomically", async () => {
  const { db, roomId } = await fixture();
  try {
    const initial = scriptState(db, roomId);
    assert.deepEqual(initial, { version: 1, block_id: "B01", lifecycle: "ready", mutations: 0, events: 1 });
    for (let index = 0; index < 5; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(applyScriptAction(db, admin, roomId, {
        expectedRunId: classroomRunId(roomId, 0),
        expectedResetGeneration: 0,
        expectedVersion: 1,
        action: { type: "unlock-next", nextBlockId: "B02" },
      }), new RegExp(`INJECTED_BATCH_FAILURE:${index}/5`));
      assert.deepEqual(scriptState(db, roomId), initial, `statement ${index} left partial script state`);
    }
    const next = await applyScriptAction(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0, expectedVersion: 1,
      action: { type: "unlock-next", nextBlockId: "B02" },
    });
    assert.deepEqual({ block: next.unlockedThroughBlockId, version: next.version }, { block: "B02", version: 2 });
    assert.deepEqual(scriptState(db, roomId), { version: 2, block_id: "B02", lifecycle: "running", mutations: 1, events: 2 });
  } finally { db.raw.close(); }
});

test("two mentors racing one script version produce exactly one complete mutation", async () => {
  const { db, roomId } = await fixture();
  try {
    const input = {
      expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0, expectedVersion: 1,
      action: { type: "unlock-next" as const, nextBlockId: "B02" },
    };
    const results = await Promise.allSettled([
      applyScriptAction(db, admin, roomId, input),
      applyScriptAction(db, { ...admin, userId: mentorIds.P, displayName: "P mentor", platformRole: "mentor" }, roomId, input),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected?.reason instanceof ClassroomError);
    assert.equal(rejected.reason.code, "SCRIPT_VERSION_CONFLICT");
    assert.deepEqual(scriptState(db, roomId), { version: 2, block_id: "B02", lifecycle: "running", mutations: 1, events: 2 });
  } finally { db.raw.close(); }
});

test("v3 final unlock stays running and explicit finish is atomic and idempotent", async () => {
  const { db, roomId } = await fixture();
  try {
    const run = { expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0 };
    await expectCode(finishClassroomRun(db, admin, roomId, {
      ...run,
      expectedScriptVersion: 1,
      idempotencyKey: "finish-before-final-0001",
    }), "CLASSROOM_FINISH_SCRIPT_INCOMPLETE");

    let version = 1;
    for (let index = 2; index <= 13; index += 1) {
      const progress = await applyScriptAction(db, admin, roomId, {
        ...run,
        expectedVersion: version,
        action: { type: "unlock-next", nextBlockId: `B${String(index).padStart(2, "0")}` },
      });
      version = progress.version;
    }
    const snapshot = () => ({ ...db.raw.prepare(
      `SELECT ci.lifecycle, ci.completed_at, ci.state_machine_version, sp.version,
              (SELECT COUNT(*) FROM classroom_finish_mutations WHERE room_id = ?) AS mutations,
              (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ? AND type = 'classroom.run-finished') AS events
       FROM classroom_instances ci JOIN classroom_script_progress sp ON sp.room_id = ci.room_id
       WHERE ci.room_id = ?`,
    ).get(roomId, roomId, roomId) }) as {
      lifecycle: string;
      completed_at: string | null;
      state_machine_version: number;
      version: number;
      mutations: number;
      events: number;
    };
    const before = snapshot();
    assert.deepEqual(before, {
      lifecycle: "running",
      completed_at: null,
      state_machine_version: 3,
      version: 13,
      mutations: 0,
      events: 0,
    });

    const input = {
      ...run,
      expectedScriptVersion: version,
      idempotencyKey: "finish-atomic-run-0001",
    };
    for (let index = 0; index < 4; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(
        finishClassroomRun(db, admin, roomId, input),
        new RegExp(`INJECTED_BATCH_FAILURE:${index}/4`),
      );
      assert.deepEqual(snapshot(), before, `finish statement ${index} left partial state`);
    }
    const result = await finishClassroomRun(db, admin, roomId, input);
    assert.equal(result.completed, true);
    assert.equal(result.idempotent, false);
    assert.deepEqual(snapshot(), {
      lifecycle: "completed",
      completed_at: result.completedAt,
      state_machine_version: 3,
      version: 13,
      mutations: 1,
      events: 1,
    });
    assert.deepEqual(await finishClassroomRun(db, admin, roomId, input), { ...result, idempotent: true });
  } finally { db.raw.close(); }
});

test("completion evidence is optional unless the exact CourseDefinition explicitly requires it", async () => {
  const { db, roomId } = await fixture((course) => {
    const rules = course.rules as Record<string, unknown>;
    rules.completion = {
      mode: "explicit-mentor-confirmation",
      requiredAcceptedSubmissionSchemaIds: ["product-brief-v1"],
    };
  });
  try {
    const run = { expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0 };
    let version = 1;
    for (let index = 2; index <= 13; index += 1) {
      const progress = await applyScriptAction(db, admin, roomId, {
        ...run,
        expectedVersion: version,
        action: { type: "unlock-next", nextBlockId: `B${String(index).padStart(2, "0")}` },
      });
      version = progress.version;
    }
    const finishInput = {
      ...run,
      expectedScriptVersion: version,
      idempotencyKey: "finish-required-evidence-0001",
    };
    await expectCode(finishClassroomRun(db, admin, roomId, finishInput), "CLASSROOM_FINISH_EVIDENCE_REQUIRED");
    const now = "2026-09-10T09:00:00.000Z";
    db.raw.prepare(
      `INSERT INTO classroom_block_submissions
       (id, room_id, block_id, profile_id, kind, payload_json, status, created_at, updated_at)
       VALUES (?, ?, 'B04', ?, 'product-brief', ?, 'accepted', ?, ?)`,
    ).run("finish-evidence-submission", roomId, learnerIds[0], JSON.stringify({ schemaId: "product-brief-v1", values: {} }), now, now);
    db.raw.prepare(
      `INSERT INTO classroom_submission_revisions
       (submission_id, room_id, reset_generation, version, last_mutation_id, updated_at)
       VALUES (?, ?, 0, 1, 'finish-evidence-fixture', ?)`,
    ).run("finish-evidence-submission", roomId, now);
    const finished = await finishClassroomRun(db, admin, roomId, finishInput);
    assert.equal(finished.completed, true);
  } finally { db.raw.close(); }
});

test("submission CAS is idempotent, rejects a reused key, and rolls back every failed write prefix", async () => {
  const { db, roomId } = await fixture();
  try {
    const common = {
      expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0,
      blockId: "B01", kind: "reflection", viewAsProfileId: learnerIds[0],
    };
    const first = await submitClassroomBlockWork(db, admin, roomId, {
      ...common, expectedVersion: 0, idempotencyKey: "submit-fixture-0001", text: "第一台设备提交的可验证观察。",
    });
    assert.equal(first.version, 1);
    assert.equal(first.idempotent, false);
    const replay = await submitClassroomBlockWork(db, admin, roomId, {
      ...common, expectedVersion: 0, idempotencyKey: "submit-fixture-0001", text: "第一台设备提交的可验证观察。",
    });
    assert.deepEqual(replay, { ...first, idempotent: true });
    await expectCode(submitClassroomBlockWork(db, admin, roomId, {
      ...common, expectedVersion: 0, idempotencyKey: "submit-fixture-0001", text: "换了内容却重用幂等键。",
    }), "IDEMPOTENCY_KEY_REUSED");
    await expectCode(submitClassroomBlockWork(db, admin, roomId, {
      ...common, expectedVersion: 0, idempotencyKey: "submit-fixture-0002", text: "第二台设备拿旧版本覆盖。",
    }), "SUBMISSION_VERSION_CONFLICT");

    const before = db.raw.prepare(
      `SELECT s.payload_json, sr.version,
              (SELECT COUNT(*) FROM classroom_submission_mutations WHERE room_id = ?) AS mutations,
              (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ? AND type = 'block.submitted') AS events
       FROM classroom_block_submissions s JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
       WHERE s.id = ?`,
    ).get(roomId, roomId, first.submissionId);
    for (let index = 0; index < 5; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(submitClassroomBlockWork(db, admin, roomId, {
        ...common, expectedVersion: 1, idempotencyKey: `submit-fixture-fail-${index}`, text: "不会留下半次保存的更新。",
      }), new RegExp(`INJECTED_BATCH_FAILURE:${index}/5`));
      const after = db.raw.prepare(
        `SELECT s.payload_json, sr.version,
                (SELECT COUNT(*) FROM classroom_submission_mutations WHERE room_id = ?) AS mutations,
                (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ? AND type = 'block.submitted') AS events
         FROM classroom_block_submissions s JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
         WHERE s.id = ?`,
      ).get(roomId, roomId, first.submissionId);
      assert.deepEqual(after, before, `statement ${index} left a partial submission`);
    }
  } finally { db.raw.close(); }
});

test("review CAS rolls back payload, status, revision and audit at every write node", async () => {
  const { db, roomId } = await fixture();
  try {
    let version = 1;
    for (const nextBlockId of ["B02", "B03", "B04"]) {
      const progress = await applyScriptAction(db, admin, roomId, {
        expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0, expectedVersion: version,
        action: { type: "unlock-next", nextBlockId },
      });
      version = progress.version;
    }
    const run = { expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0 };
    const values = {
      "target-user": "东川路宿舍里晚上九点后想订餐的学生",
      "user-task": "晚上留在宿舍时，找到仍在营业且能够送到的餐厅并完成下单。",
      "observed-problem": "旧菜单可能过期，电话逐家询问很慢，也不知道餐厅是否营业和是否配送。",
      "facts-and-sources": "F-01：2008 年开始尝试餐饮外送。\nC-05：创始成员亲自送餐。",
      assumptions: "学生愿意把电话询问改成使用一个统一入口。",
      unknowns: "还不知道每天晚间有多少订单；下一步记录一周电话和送餐次数。",
      "value-hypothesis": "如果统一展示可订餐厅并确认订单，学生会少打电话并更快知道是否下单成功。",
      "core-journey": "看到餐厅与菜品 → 选择并提交订单 → 收到已接单或无法配送的明确回执。",
      "mvp-hypothesis": "一张维护及时的菜单加人工确认，是否足以让真实学生完成一次订餐。",
      boundaries: "不公开私人电话；只覆盖宿舍周边；先人工确认，不承诺所有餐厅和所有时段。",
    };
    const submitted = await submitClassroomBlockWork(db, admin, roomId, {
      ...run, blockId: "B04", expectedVersion: 0, idempotencyKey: "review-fixture-submit",
      schemaId: "product-brief-v1", values, viewAsProfileId: learnerIds[0],
    });
    const snapshot = () => ({ ...db.raw.prepare(
      `SELECT s.payload_json, s.status, sr.version,
              (SELECT COUNT(*) FROM classroom_submission_mutations WHERE room_id = ? AND operation = 'review') AS mutations,
              (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ? AND type = 'submission.reviewed') AS events
       FROM classroom_block_submissions s JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
       WHERE s.id = ?`,
    ).get(roomId, roomId, submitted.submissionId) });
    const before = snapshot();
    for (let index = 0; index < 5; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(reviewClassroomSubmission(db, admin, roomId, submitted.submissionId, {
        ...run, status: "rejected", feedback: "请把目标用户缩小到一个宿舍和一个具体时间。",
        expectedVersion: 1, idempotencyKey: `review-fixture-fail-${index}`, viewAsProfileId: mentorIds.P,
      }), new RegExp(`INJECTED_BATCH_FAILURE:${index}/5`));
      assert.deepEqual(snapshot(), before, `review statement ${index} left partial state`);
    }
    const reviewInput = {
      ...run, status: "rejected", feedback: "请把目标用户缩小到一个宿舍和一个具体时间。",
      expectedVersion: 1, idempotencyKey: "review-fixture-success", viewAsProfileId: mentorIds.P,
    } as const;
    const reviewed = await reviewClassroomSubmission(db, admin, roomId, submitted.submissionId, reviewInput);
    assert.equal(reviewed.version, 2);
    const replay = await reviewClassroomSubmission(db, admin, roomId, submitted.submissionId, reviewInput);
    assert.deepEqual(replay, { ...reviewed, idempotent: true });
    const after = snapshot() as { payload_json: string; status: string; version: number; mutations: number; events: number };
    assert.equal(after.status, "rejected");
    assert.equal(after.version, 2);
    assert.equal(after.mutations, 1);
    assert.equal(after.events, 1);
    assert.match(after.payload_json, /一个宿舍和一个具体时间/);
  } finally { db.raw.close(); }
});

test("reset rolls back at every write node and invalidates old-run unlocks and submissions", async () => {
  const { db, roomId } = await fixture();
  try {
    const oldRun = { expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0 };
    const snapshot = () => db.raw.prepare(
      `SELECT ci.reset_generation, ci.lifecycle, sp.version, sp.unlocked_through_block_id AS block_id,
              (SELECT COUNT(*) FROM card_grants WHERE room_id = ?) AS cards,
              (SELECT COUNT(*) FROM classroom_reset_mutations WHERE room_id = ?) AS mutations
       FROM classroom_instances ci JOIN classroom_script_progress sp ON sp.room_id = ci.room_id
       WHERE ci.room_id = ?`,
    ).get(roomId, roomId, roomId);
    const before = snapshot();
    db.failNextBatchAt = 0;
    await assert.rejects(resetTestClassroom(db, admin, roomId, oldRun), /INJECTED_BATCH_FAILURE:0\//);
    const size = db.lastBatchSize;
    assert.ok(size > 20, "reset fixture must exercise the complete multi-table batch");
    assert.deepEqual(snapshot(), before);
    for (let index = 1; index < size; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(resetTestClassroom(db, admin, roomId, oldRun), new RegExp(`INJECTED_BATCH_FAILURE:${index}/${size}`));
      assert.deepEqual(snapshot(), before, `reset statement ${index} left partial state`);
    }
    const reset = await resetTestClassroom(db, admin, roomId, oldRun);
    assert.deepEqual(reset, { runId: classroomRunId(roomId, 1), resetGeneration: 1 });
    await expectCode(applyScriptAction(db, admin, roomId, {
      ...oldRun, expectedVersion: 1, action: { type: "unlock-next", nextBlockId: "B02" },
    }), "CLASSROOM_RUN_CONFLICT");
    await expectCode(submitClassroomBlockWork(db, admin, roomId, {
      ...oldRun, blockId: "B01", expectedVersion: 0, idempotencyKey: "submit-after-reset-old-run",
      kind: "reflection", text: "旧页面不能写进新一轮。", viewAsProfileId: learnerIds[0],
    }), "CLASSROOM_RUN_CONFLICT");
    const detail = await getClassroomInstance(db, admin, roomId);
    assert.equal(detail.runtimeIdentity.runId, classroomRunId(roomId, 1));
    assert.equal(detail.script.unlockedThroughBlockId, "B01");
  } finally { db.raw.close(); }
});

test("multiple Test Classrooms coexist across the same exact version and a later Candidate", async () => {
  const { db, roomId, request, sourceCourse } = await fixture();
  try {
    const sameExact = await createClassroomInstance(db, admin, { ...request, title: "Same exact · second run" });
    assert.notEqual(sameExact.classroomId, roomId);

    const nextCourse = structuredClone(sourceCourse);
    nextCourse.title = `${String(nextCourse.title)} · next candidate`;
    const nextRef = await saveCourseCandidate(db, nextCourse, admin.userId, request.courseRef);
    assert.equal(nextRef.revision, request.courseRef.revision + 1);
    assert.notEqual(nextRef.digest, request.courseRef.digest);
    const nextPackage = await loadExactCoursePackage(db, nextRef);
    const nextViewReceipt = await createViewAcceptanceReceipt(db, {
      courseRef: nextRef,
      reviewedBlockIds: nextPackage.blocks.map((block) => block.id),
      reviewedLearnerCounts: acceptanceLearnerCounts(nextPackage),
    }, admin.userId);
    const laterExact = await createClassroomInstance(db, admin, {
      ...request,
      title: "Later Candidate · independent run",
      courseRef: nextRef,
      viewAcceptanceReceiptId: nextViewReceipt.receiptId,
    });

    const rooms = await listClassroomInstances(db, admin);
    const original = rooms.find((room) => room.id === roomId);
    const duplicate = rooms.find((room) => room.id === sameExact.classroomId);
    const later = rooms.find((room) => room.id === laterExact.classroomId);
    assert.ok(original && duplicate && later);
    assert.deepEqual(original.courseRef, duplicate.courseRef, "same exact version must remain reusable");
    assert.equal(later.courseRef.revision, nextRef.revision);
    assert.equal(later.courseRef.digest, nextRef.digest);
    assert.equal(original.courseRef.revision, request.courseRef.revision, "a new Candidate must not hot-update an existing classroom");
    assert.equal(original.courseRef.digest, request.courseRef.digest);
    assert.equal(new Set([roomId, sameExact.classroomId, laterExact.classroomId]).size, 3);
  } finally { db.raw.close(); }
});

test("dependency-free Test Classroom deletion is atomic, physical, idempotent and globally isolated", async () => {
  const { db, roomId, request } = await fixture();
  try {
    const unaffected = await createClassroomInstance(db, admin, { ...request, title: "Deletion-isolated sibling" });
    await submitClassroomBlockWork(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      blockId: "B01",
      expectedVersion: 0,
      idempotencyKey: "delete-private-payload-fixture",
      kind: "learner-work",
      text: "THIS_PRIVATE_CLASSROOM_PAYLOAD_MUST_NOT_ENTER_THE_TOMBSTONE",
      viewAsProfileId: learnerIds[0],
    });
    const preview = await previewTestClassroomDeletion(db, admin, roomId);
    assert.equal(preview.canDelete, true);
    assert.equal(preview.blockers.length, 0);
    assert.equal(preview.classroom.id, roomId);
    assert.equal(preview.classroom.environment, "test");
    assert.ok(preview.impact.memberships >= 6);
    assert.equal(preview.impact.submissions, 1);
    assert.match(preview.stateToken, /^[0-9a-f]{64}$/);

    const staleInput = {
      expectedRunId: classroomRunId(roomId, preview.classroom.resetGeneration),
      expectedResetGeneration: preview.classroom.resetGeneration,
      expectedScriptVersion: preview.classroom.scriptVersion,
      expectedStateToken: preview.stateToken,
      confirmClassroomId: roomId,
      idempotencyKey: "delete-atomic-fixture-0001",
      reason: "isolated deletion test",
    };
    const learner: AuthenticatedClassroomUser = {
      userId: learnerIds[0], displayName: "Learner", platformRole: "learner",
    };
    await expectClassroomError(previewTestClassroomDeletion(db, learner, roomId), "ADMIN_DM_REQUIRED", 403);
    await expectClassroomError(deleteTestClassroom(db, learner, roomId, staleInput), "ADMIN_DM_REQUIRED", 403);

    // A same-row update keeps the submission count unchanged.  The mutation
    // witness must still invalidate the confirmation preview.
    await submitClassroomBlockWork(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      blockId: "B01",
      expectedVersion: 1,
      idempotencyKey: "delete-private-payload-fixture-update",
      kind: "learner-work",
      text: "THIS_PRIVATE_CLASSROOM_PAYLOAD_CHANGED_AFTER_PREVIEW",
      viewAsProfileId: learnerIds[0],
    });
    await expectClassroomError(deleteTestClassroom(db, admin, roomId, staleInput), "CLASSROOM_DELETE_CONFLICT", 409);
    const submissionPreview = await previewTestClassroomDeletion(db, admin, roomId);
    assert.notEqual(submissionPreview.stateToken, preview.stateToken);
    // A newly appended room-owned row must also invalidate the exact impact
    // preview, even when the room/script/submission version witnesses stay put.
    db.raw.prepare(
      `INSERT INTO audit_events
       (id, room_id, actor_profile_id, action, target_type, target_id, detail_json, created_at)
       VALUES (?, ?, ?, 'test.concurrent-evidence', 'room', ?, '{}', ?)`,
    ).run("audit-delete-preview-race", roomId, admin.userId, roomId, new Date().toISOString());
    await expectClassroomError(deleteTestClassroom(db, admin, roomId, {
      ...staleInput,
      expectedStateToken: submissionPreview.stateToken,
    }), "CLASSROOM_DELETE_CONFLICT", 409);
    const refreshedPreview = await previewTestClassroomDeletion(db, admin, roomId);
    assert.notEqual(refreshedPreview.stateToken, submissionPreview.stateToken);
    const input = {
      ...staleInput,
      expectedScriptVersion: refreshedPreview.classroom.scriptVersion,
      expectedStateToken: refreshedPreview.stateToken,
    };
    const globalBefore = {
      users: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM auth_users").get()?.count),
      profiles: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM profiles").get()?.count),
      courses: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM course_versions").get()?.count),
      courseware: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM courseware_versions").get()?.count),
    };
    const state = () => ({
      target: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM rooms WHERE id = ?").get(roomId)?.count),
      sibling: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM rooms WHERE id = ?").get(unaffected.classroomId)?.count),
      tombstone: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM classroom_deletions WHERE room_id = ?").get(roomId)?.count),
      submissions: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM classroom_block_submissions WHERE room_id = ?").get(roomId)?.count),
    });
    const before = state();
    for (let index = 0; index < 5; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(deleteTestClassroom(db, admin, roomId, input), new RegExp(`INJECTED_BATCH_FAILURE:${index}/5`));
      assert.deepEqual(state(), before, `delete statement ${index} must roll back the complete transaction`);
    }

    const deleted = await deleteTestClassroom(db, admin, roomId, input);
    assert.equal(deleted.deleted, true);
    assert.equal(deleted.idempotent, false);
    assert.match(deleted.tombstoneDigest, /^[0-9a-f]{64}$/);
    assert.deepEqual(await deleteTestClassroom(db, admin, roomId, input), { ...deleted, idempotent: true });
    await expectClassroomError(deleteTestClassroom(db, admin, roomId, {
      ...input,
      idempotencyKey: "delete-atomic-fixture-0002",
    }), "CLASSROOM_ALREADY_DELETED", 410);
    await expectClassroomError(getClassroomInstance(db, admin, roomId), "CLASSROOM_DELETED", 410);
    assert.deepEqual(state(), { target: 0, sibling: 1, tombstone: 1, submissions: 0 });
    assert.ok((await listClassroomInstances(db, admin)).some((room) => room.id === unaffected.classroomId));
    assert.ok(!(await listClassroomInstances(db, admin)).some((room) => room.id === roomId));
    const tombstone = db.raw.prepare("SELECT snapshot_json, reason FROM classroom_deletions WHERE room_id = ?").get(roomId) as { snapshot_json: string; reason: string };
    assert.equal(tombstone.reason, input.reason);
    assert.doesNotMatch(tombstone.snapshot_json, /THIS_PRIVATE_CLASSROOM_PAYLOAD/);
    assert.deepEqual({
      users: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM auth_users").get()?.count),
      profiles: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM profiles").get()?.count),
      courses: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM course_versions").get()?.count),
      courseware: Number(db.raw.prepare("SELECT COUNT(*) AS count FROM courseware_versions").get()?.count),
    }, globalBefore, "delete must preserve shared accounts, courses and courseware");
  } finally { db.raw.close(); }
});

test("an unreferenced archived Test Classroom can be deleted without weakening the archive guard", async () => {
  const { db, roomId } = await fixture();
  try {
    const archived = await archiveTestClassroom(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      expectedScriptVersion: 1,
      idempotencyKey: "archive-before-delete-fixture",
      reason: "history cleanup candidate",
    });
    assert.ok(archived.archivedAt);
    assert.throws(() => db.raw.prepare("DELETE FROM classroom_archives WHERE room_id = ?").run(roomId), /CLASSROOM_ARCHIVE_IMMUTABLE:delete/);
    const preview = await previewTestClassroomDeletion(db, admin, roomId);
    assert.equal(preview.canDelete, true);
    assert.equal(preview.classroom.archivedAt, archived.archivedAt);
    await deleteTestClassroom(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      expectedScriptVersion: 1,
      expectedStateToken: preview.stateToken,
      confirmClassroomId: roomId,
      idempotencyKey: "delete-archived-fixture-0001",
    });
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS count FROM rooms WHERE id = ?").get(roomId)?.count, 0);
    assert.equal(db.raw.prepare("SELECT was_archived FROM classroom_deletions WHERE room_id = ?").get(roomId)?.was_archived, 1);
    assert.throws(() => db.raw.prepare("DELETE FROM classroom_deletions WHERE room_id = ?").run(roomId), /CLASSROOM_DELETION_IMMUTABLE:delete/);
  } finally { db.raw.close(); }
});

test("Test Classroom archive is atomic, idempotent, immutable, isolated and read-only", async () => {
  const { db, roomId, request } = await fixture();
  try {
    const unaffected = await createClassroomInstance(db, admin, { ...request, title: "Unaffected sibling" });
    const run = { expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0 };
    const input = {
      ...run,
      expectedScriptVersion: 1,
      idempotencyKey: "archive-atomic-fixture-0001",
      reason: "r-next 已替代本轮测试",
    };
    const learner: AuthenticatedClassroomUser = {
      userId: learnerIds[0], displayName: "Learner", platformRole: "learner",
    };
    await expectClassroomError(archiveTestClassroom(db, learner, roomId, input), "ADMIN_DM_REQUIRED", 403);
    await expectCode(archiveTestClassroom(db, admin, roomId, { ...input, expectedScriptVersion: 2 }), "SCRIPT_VERSION_CONFLICT");

    const snapshot = () => ({ ...db.raw.prepare(
      `SELECT r.status, ci.lifecycle, ci.updated_at,
              (SELECT COUNT(*) FROM classroom_archives WHERE room_id = ?) AS archives,
              (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ? AND type = 'classroom.test-archived') AS events
       FROM rooms r JOIN classroom_instances ci ON ci.room_id = r.id WHERE r.id = ?`,
    ).get(roomId, roomId, roomId) }) as { status: string; lifecycle: string; updated_at: string; archives: number; events: number };
    const before = snapshot();
    for (let index = 0; index < 5; index += 1) {
      db.failNextBatchAt = index;
      await assert.rejects(archiveTestClassroom(db, admin, roomId, input), new RegExp(`INJECTED_BATCH_FAILURE:${index}/5`));
      assert.deepEqual(snapshot(), before, `archive statement ${index} left partial retained state`);
    }

    const archived = await archiveTestClassroom(db, admin, roomId, input);
    assert.equal(archived.archived, true);
    assert.equal(archived.idempotent, false);
    assert.equal(archived.restorePolicy, "create-new-test");
    assert.deepEqual(await archiveTestClassroom(db, admin, roomId, input), { ...archived, idempotent: true });
    await expectCode(
      archiveTestClassroom(db, admin, roomId, { ...input, idempotencyKey: "archive-atomic-fixture-0002" }),
      "CLASSROOM_ALREADY_ARCHIVED",
    );

    const after = snapshot();
    assert.equal(after.status, "archived");
    assert.equal(after.lifecycle, before.lifecycle, "archive must retain the last real run lifecycle");
    assert.equal(after.archives, 1);
    assert.equal(after.events, 1);
    const rooms = await listClassroomInstances(db, admin);
    assert.equal(rooms.find((room) => room.id === roomId)?.archive?.reason, input.reason);
    assert.equal(rooms.find((room) => room.id === unaffected.classroomId)?.archive, null, "another Test Classroom must remain active");
    const detail = await getClassroomInstance(db, admin, roomId);
    assert.equal(detail.archive?.archivedAt, archived.archivedAt, "archived exact data remains readable");
    const acceptance = await listAcceptanceClassrooms(db, acceptanceAdmin);
    assert.equal(acceptance.find((room) => room.roomId === roomId)?.archivedAt, archived.archivedAt);

    await expectCode(applyScriptAction(db, admin, roomId, {
      ...run, expectedVersion: 1, action: { type: "unlock-next", nextBlockId: "B02" },
    }), "CLASSROOM_ARCHIVED");
    await expectCode(resetTestClassroom(db, admin, roomId, run), "CLASSROOM_ARCHIVED");
    await expectCode(submitClassroomBlockWork(db, admin, roomId, {
      ...run, blockId: "B01", expectedVersion: 0, idempotencyKey: "archived-submit-fixture",
      kind: "reflection", text: "归档后不能写入。", viewAsProfileId: learnerIds[0],
    }), "CLASSROOM_ARCHIVED");
    await expectCode(updateClassroomMembership(db, admin, roomId, {
      type: "replace-learner", seat: 1, profileId: learnerIds[0],
    }), "CLASSROOM_ARCHIVED");
    assert.throws(() => db.raw.prepare("UPDATE classroom_archives SET reason = 'rewrite' WHERE room_id = ?").run(roomId), /CLASSROOM_ARCHIVE_IMMUTABLE:update/);
    assert.throws(() => db.raw.prepare("DELETE FROM classroom_archives WHERE room_id = ?").run(roomId), /CLASSROOM_ARCHIVE_IMMUTABLE:delete/);
  } finally { db.raw.close(); }
});

test("Production Classroom cannot enter the Test archive lifecycle", async () => {
  const { db, roomId } = await fixture();
  try {
    db.raw.prepare("UPDATE classroom_instances SET environment = 'production' WHERE room_id = ?").run(roomId);
    await expectClassroomError(archiveTestClassroom(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      expectedScriptVersion: 1,
      idempotencyKey: "archive-production-forbidden-0001",
    }), "PRODUCTION_ARCHIVE_FORBIDDEN", 403);
    await expectClassroomError(previewTestClassroomDeletion(db, admin, roomId), "PRODUCTION_DELETE_FORBIDDEN", 403);
    await expectClassroomError(deleteTestClassroom(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      expectedScriptVersion: 1,
      expectedStateToken: "a".repeat(64),
      confirmClassroomId: roomId,
      idempotencyKey: "delete-production-forbidden-0001",
    }), "PRODUCTION_DELETE_FORBIDDEN", 403);
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS count FROM classroom_archives WHERE room_id = ?").get(roomId)?.count, 0);
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS count FROM classroom_deletions WHERE room_id = ?").get(roomId)?.count, 0);
  } finally { db.raw.close(); }
});

test("archiving retains a UI receipt as historical evidence but invalidates future release use", async () => {
  const { db, roomId, request } = await fixture();
  try {
    const run = { expectedRunId: classroomRunId(roomId, 0), expectedResetGeneration: 0 };
    let scriptVersion = 1;
    for (let index = 2; index <= 13; index += 1) {
      const progress = await applyScriptAction(db, admin, roomId, {
        ...run,
        expectedVersion: scriptVersion,
        action: { type: "unlock-next", nextBlockId: `B${String(index).padStart(2, "0")}` },
      });
      scriptVersion = progress.version;
    }
    await finishClassroomRun(db, admin, roomId, {
      ...run, expectedScriptVersion: scriptVersion, idempotencyKey: "finish-before-archive-receipt-0001",
    });
    const checks = Object.fromEntries(UI_ACCEPTANCE_REQUIRED_CHECKS.map((key) => [key, true]));
    const issued = await acceptTestClassroom(db, admin, roomId, checks, [
      { browser: "local-test-fixture", platform: "node-sqlite", viewport: { width: 1280, height: 800 } },
    ]);
    const persistedReceipt = (await listUiAcceptanceReceipts(db, acceptanceAdmin)).find((receipt) => receipt.receiptId === issued.receiptId);
    assert.ok(persistedReceipt?.valid);
    const deletePreview = await previewTestClassroomDeletion(db, admin, roomId);
    assert.equal(deletePreview.canDelete, false);
    assert.ok(deletePreview.blockers.some((blocker) => blocker.code === "UI_ACCEPTANCE_RECEIPT" && blocker.referenceIds.some((id) => id.includes(issued.receiptId))));
    await expectClassroomError(deleteTestClassroom(db, admin, roomId, {
      expectedRunId: classroomRunId(roomId, 0),
      expectedResetGeneration: 0,
      expectedScriptVersion: scriptVersion,
      expectedStateToken: deletePreview.stateToken,
      confirmClassroomId: roomId,
      idempotencyKey: "delete-receipt-blocked-0001",
    }), "CLASSROOM_DELETE_BLOCKED", 409);
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS count FROM rooms WHERE id = ?").get(roomId)?.count, 1);
    assert.throws(() => db.raw.prepare(
      `INSERT INTO classroom_deletions
       (room_id,classroom_title,environment,course_id,course_revision,course_digest,previous_lifecycle,
        reset_generation,script_version,was_archived,deleted_by_profile_id,idempotency_key,reason,snapshot_json,snapshot_digest,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      roomId, "forbidden", "test", request.courseRef.courseId, request.courseRef.revision, request.courseRef.digest,
      "completed", 0, scriptVersion, 0, admin.userId, "direct-evidence-delete", "", "{}", "a".repeat(64), new Date().toISOString(),
    ), /CLASSROOM_DELETE_EVIDENCE_BLOCKED/);
    const outsiderId = "atomic-ui-outsider";
    seedAccount(db, outsiderId, "mentor");
    assert.ok((await listUiAcceptanceReceipts(db, { userId: mentorIds.P, platformRole: "mentor" })).some((receipt) => receipt.receiptId === issued.receiptId));
    assert.deepEqual(await listUiAcceptanceReceipts(db, { userId: outsiderId, platformRole: "mentor" }), []);
    const uiSummary = studioUiAcceptanceSummary(persistedReceipt);
    for (const forbidden of ["roomId", "dealSeed", "mentorMemberships", "learnerMemberships", "adminDmProfileIds", "checks", "clientMatrix", "auditSummary", "acceptedByProfileId"]) {
      assert.equal(Object.hasOwn(uiSummary, forbidden), false, `${forbidden} must not leave Studio bootstrap`);
    }

    await archiveTestClassroom(db, admin, roomId, {
      ...run,
      expectedScriptVersion: scriptVersion,
      idempotencyKey: "archive-after-receipt-0001",
      reason: "receipt retention policy test",
    });
    const retained = (await listUiAcceptanceReceipts(db, acceptanceAdmin)).find((receipt) => receipt.receiptId === issued.receiptId);
    assert.ok(retained, "the receipt must remain queryable for history");
    assert.equal(retained.valid, false);
    assert.ok(retained.invalidReasons.some((reason) => reason.includes("已归档") && reason.includes("历史证据")));
    await expectCode(requireValidUiAcceptanceReceipt(
      db,
      request.courseRef,
      issued.receiptId,
      request.viewAcceptanceReceiptId,
    ), "UI_ACCEPTANCE_RECEIPT_INVALID");
  } finally { db.raw.close(); }
});

test("runtime source discards stale requests and keeps drafts scoped outside URLs and logs", () => {
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  assert.match(runtime, /AbortController/);
  assert.match(runtime, /loadRequestGeneration/);
  assert.match(runtime, /requestIdentityRef/);
  assert.match(runtime, /useDeviceDraft/);
  assert.match(runtime, /localStorage/);
  assert.doesNotMatch(runtime, /URLSearchParams\([^)]*(draft|values|feedback)/);
  assert.match(runtime, /window\.addEventListener\("offline"/);
  assert.match(runtime, /window\.addEventListener\("online"/);
});

test("delayed B01, old role, and old-run responses cannot replace the current UI", () => {
  const b02Learner = { classroomId: "room-1", blockId: "B02", viewProfileId: "learner-2", surface: "seat" as const };
  assert.equal(classroomRuntimeRequestKey(b02Learner), "room-1|B02|learner-2|seat");
  assert.equal(canCommitClassroomRuntimeResponse({
    requestGeneration: 7,
    latestRequestGeneration: 8,
    expected: { ...b02Learner, blockId: "B01" },
    actual: { classroomId: "room-1", blockId: "B01", viewProfileId: "learner-2", resetGeneration: 3 },
    currentResetGeneration: 3,
  }), false, "a delayed earlier request generation must be discarded");
  assert.equal(canCommitClassroomRuntimeResponse({
    requestGeneration: 8,
    latestRequestGeneration: 8,
    expected: b02Learner,
    actual: { classroomId: "room-1", blockId: "B02", viewProfileId: "learner-1", resetGeneration: 3 },
    currentResetGeneration: 3,
  }), false, "the previously selected role must not replace the current role");
  assert.equal(canCommitClassroomRuntimeResponse({
    requestGeneration: 8,
    latestRequestGeneration: 8,
    expected: b02Learner,
    actual: { classroomId: "room-1", blockId: "B02", viewProfileId: "learner-2", resetGeneration: 2 },
    currentResetGeneration: 3,
  }), false, "an older run must not win even when its request is latest");
  assert.equal(canCommitClassroomRuntimeResponse({
    requestGeneration: 8,
    latestRequestGeneration: 8,
    expected: b02Learner,
    actual: { classroomId: "room-1", blockId: "B02", viewProfileId: "learner-2", resetGeneration: 3 },
    currentResetGeneration: 3,
  }), true);
});

test("device drafts are isolated by actor, role view, classroom, run, seat, block and schema", () => {
  const base = {
    actorProfileId: "learner-1", viewProfileId: "learner-1", classroomId: "room-a",
    runId: "room-a:run:2", seatId: "learner01", blockId: "B04", discriminator: "schema:product-brief-v1",
  };
  const key = classroomDeviceDraftKey(base);
  assert.match(key, /^minisv:classroom-draft:v1:/);
  for (const [field, value] of Object.entries({
    actorProfileId: "learner-2", viewProfileId: "learner-2", classroomId: "room-b",
    runId: "room-a:run:3", seatId: "learner02", blockId: "B05", discriminator: "schema:other",
  })) {
    assert.notEqual(classroomDeviceDraftKey({ ...base, [field]: value }), key, `${field} must isolate private draft storage`);
  }
  assert.equal(key.includes("用户输入内容"), false, "draft keys contain identities only, never learner content");
});
