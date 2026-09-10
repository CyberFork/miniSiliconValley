import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import type { AuthenticatedClassroomUser } from "../app/lib/classroom-api";
import { ClassroomError } from "../app/lib/classroom-errors";
import { acceptanceLearnerCounts, createViewAcceptanceReceipt } from "../app/lib/course-acceptance";
import type { ClassroomFactoryRequest, ClassroomMentorRole } from "../app/lib/classroom-factory";
import {
  applyScriptAction,
  classroomRunId,
  createClassroomInstance,
  getClassroomInstance,
  resetTestClassroom,
  reviewClassroomSubmission,
  submitClassroomBlockWork,
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

async function fixture(): Promise<{ db: LocalDatabase; roomId: string }> {
  const db = database();
  seedAccount(db, admin.userId, "admin");
  for (const id of Object.values(mentorIds)) seedAccount(db, id, "mentor");
  for (const id of learnerIds) seedAccount(db, id, "learner");
  await ensureBundledCourseRegistry(db);
  await ensureBundledCourseware(db);

  const ref = await saveCourseCandidate(
    db,
    JSON.parse(readFileSync(new URL("../tools/live-run/courses/candidates/eleme-2008-unified-t095.json", import.meta.url), "utf8")),
    admin.userId,
    null,
  );
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
    return {
      mentorRole,
      packageId: item.packageId,
      slug: item.slug,
      revision: item.releasedRevision!,
      digest: item.releasedDigest!,
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
  return { db, roomId: created.classroomId };
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ClassroomError);
    assert.equal(error.code, code);
    assert.equal(error.status, 409);
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
