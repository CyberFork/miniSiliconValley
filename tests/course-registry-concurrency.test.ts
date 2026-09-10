import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import {
  COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION,
  COURSE_PROJECTOR_VERSION,
  requireValidUiAcceptanceReceipt,
  requireValidViewAcceptanceReceipt,
} from "../app/lib/course-acceptance";
import { CLASSROOM_RUNTIME_CONTRACT_VERSION } from "../app/lib/course-acceptance-contract";
import { CLASSROOM_STATE_MACHINE_VERSION } from "../app/lib/classroom-factory";
import { ClassroomError } from "../app/lib/classroom-errors";
import { bundledCoursePackages, type CoursePackageRef } from "../app/lib/course-package";
import { ensureBundledCourseRegistry, listStudioCourseVersions, loadExactCoursePackage, releaseTestedCourseCandidate, saveCourseCandidate } from "../app/lib/course-registry";

type LocalStatement = D1PreparedStatement & { sql: string; execute(): D1Result };
type LocalDatabase = ClassroomD1 & {
  raw: DatabaseSync;
  beforeBatch: ((statements: LocalStatement[]) => Promise<void>) | null;
};

function migrations(maximum = Number.POSITIVE_INFINITY): string[] {
  return readdirSync(new URL("../drizzle/", import.meta.url))
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= maximum)
    .sort()
    .map((name) => readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
}

function database(maximum = Number.POSITIVE_INFINITY): LocalDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations(maximum)) raw.exec(migration);
  let beforeBatchHook: LocalDatabase["beforeBatch"] = null;
  const api = {
    raw,
    get beforeBatch() { return beforeBatchHook; },
    set beforeBatch(value: LocalDatabase["beforeBatch"]) { beforeBatchHook = value; },
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        sql,
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
      const hook = beforeBatchHook;
      if (hook) await hook(statements);
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map((statement) => statement.execute());
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return api as unknown as LocalDatabase;
}

function freshCourse() {
  return structuredClone(bundledCoursePackages()[0]);
}

test("Studio startup reads current exact snapshots; history bodies are loaded only on demand", async (t) => {
  const db = database();
  try {
    await ensureBundledCourseRegistry(db);
    const course = freshCourse();
    const revisions: CoursePackageRef[] = [];
    for (let index = 1; index <= 12; index += 1) {
      course.title = `Startup performance fixture ${index}`;
      revisions.push(await saveCourseCandidate(db, course, "fixture-author", revisions.at(-1) ?? null));
    }
    const released = revisions[8];
    db.raw.prepare("UPDATE course_release_pointers SET revision = ?, digest = ? WHERE course_id = ?")
      .run(released.revision, released.digest, released.courseId);
    const started = performance.now();
    const full = await listStudioCourseVersions(db);
    const fullMs = performance.now() - started;
    const currentStart = performance.now();
    const current = await listStudioCourseVersions(db, { currentOnly: true });
    const currentMs = performance.now() - currentStart;
    assert.equal(full.length, 14);
    assert.equal(current.length, 3);
    for (const item of current) {
      assert.deepEqual(item, full.find((version) => version.ref.courseId === item.ref.courseId && version.ref.revision === item.ref.revision));
    }
    assert.deepEqual(current.filter((item) => item.ref.courseId === course.course.id).map((item) => item.ref.revision), [12, 9]);
    assert.ok(current.some((item) => item.candidate && item.ref.revision === 12));
    assert.ok(current.some((item) => item.released && item.ref.revision === 9));
    const history = await listStudioCourseVersions(db, { courseId: course.course.id });
    assert.equal(history.length, 13);
    assert.ok(history.every((item) => item.ref.courseId === course.course.id));
    assert.deepEqual(history.at(-1)?.ref.revision, 0);
    assert.deepEqual(await listStudioCourseVersions(db, { courseId: "missing-or-'SQL'" }), []);
    const fullBytes = Buffer.byteLength(JSON.stringify(full));
    const currentBytes = Buffer.byteLength(JSON.stringify(current));
    assert.ok(currentBytes < fullBytes / 3, "startup payload must not grow with historical revisions");
    t.diagnostic(JSON.stringify({ fullVersions: full.length, currentVersions: current.length, fullBytes, currentBytes, fullMs, currentMs }));
  } finally { db.raw.close(); }
});

test("current-only Studio reads still verify each returned exact body digest", async () => {
  const db = database();
  try {
    await ensureBundledCourseRegistry(db);
    const prepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const statement = prepare(sql);
      if (sql.includes("author.display_name AS created_by_display_name")) {
        const all = statement.all.bind(statement);
        statement.all = (async () => {
          const result = await all<{ package_json: string }>();
          const first = result.results![0];
          first.package_json = JSON.stringify({ ...JSON.parse(first.package_json), title: "tampered response" });
          return result;
        }) as D1PreparedStatement["all"];
      }
      return statement;
    }) as ClassroomD1["prepare"];
    await assert.rejects(listStudioCourseVersions(db, { currentOnly: true }), (error: unknown) => {
      assert.ok(error instanceof ClassroomError);
      assert.equal(error.code, "COURSE_REGISTRY_CORRUPT");
      assert.equal(error.status, 500);
      return true;
    });
  } finally { db.raw.close(); }
});

function expected(ref: CoursePackageRef) {
  return { courseId: ref.courseId, schemaVersion: ref.schemaVersion, revision: ref.revision, digest: ref.digest, status: "candidate" as const };
}

async function expectConflict(promise: Promise<unknown>, code = "CANDIDATE_SAVE_CONFLICT") {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ClassroomError);
    assert.equal(error.code, code);
    assert.equal(error.status, 409);
    return true;
  });
}

test("sequential stale editors cannot overwrite a newer exact Candidate", async () => {
  const db = database();
  try {
    const base = freshCourse();
    const baseRef = await saveCourseCandidate(db, base, "author-base", null);
    const a = structuredClone(base); a.title += " · A";
    const b = structuredClone(base); b.title += " · B stale";
    const aRef = await saveCourseCandidate(db, a, "author-a", expected(baseRef));
    await expectConflict(saveCourseCandidate(db, b, "author-b", expected(baseRef)));
    const current = await loadExactCoursePackage(db, aRef);
    assert.equal(current.title, a.title);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM course_registry_events WHERE actor = 'author-b'").get() as { n: number }).n, 0);
  } finally { db.raw.close(); }
});

test("two writers racing from one base produce one success and no orphan pointer", async () => {
  const db = database();
  try {
    const base = freshCourse();
    const baseRef = await saveCourseCandidate(db, base, "author-base", null);
    const originalPrepare = db.prepare.bind(db);
    let readers = 0;
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
    db.prepare = ((sql: string) => {
      const statement = originalPrepare(sql) as LocalStatement;
      if (sql.includes("SELECT MAX(revision) AS revision FROM course_versions")) {
        const first = statement.first.bind(statement);
        statement.first = async <T>() => {
          const result = await first<T>();
          readers += 1;
          if (readers === 2) releaseGate();
          await gate;
          return result;
        };
      }
      return statement;
    }) as ClassroomD1["prepare"];
    const a = structuredClone(base); a.title += " · concurrent A";
    const b = structuredClone(base); b.title += " · concurrent B";
    const results = await Promise.allSettled([
      saveCourseCandidate(db, a, "author-a", expected(baseRef)),
      saveCourseCandidate(db, b, "author-b", expected(baseRef)),
    ]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(results.filter((item) => item.status === "rejected" && item.reason instanceof ClassroomError && item.reason.code === "CANDIDATE_SAVE_CONFLICT").length, 1);
    const pointer = db.raw.prepare(
      `SELECT p.course_id, p.revision, p.digest, v.digest AS version_digest
       FROM course_candidate_pointers p
       JOIN course_versions v ON v.course_id = p.course_id AND v.revision = p.revision AND v.digest = p.digest`,
    ).get() as { course_id: string; revision: number; digest: string; version_digest: string } | undefined;
    assert.ok(pointer);
    assert.equal(pointer.digest, pointer.version_digest);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM course_registry_events WHERE revision = ?").get(pointer.revision) as { n: number }).n, 1);
    await loadExactCoursePackage(db, { courseId: pointer.course_id, revision: pointer.revision, digest: pointer.digest });
  } finally { db.raw.close(); }
});

test("same body retry is idempotent even when the caller did not receive the first response", async () => {
  const db = database();
  try {
    const base = freshCourse();
    const baseRef = await saveCourseCandidate(db, base, "author-base", null);
    const changed = structuredClone(base); changed.title += " · retry";
    const first = await saveCourseCandidate(db, changed, "author-a", expected(baseRef));
    const retry = await saveCourseCandidate(db, changed, "author-a", expected(baseRef));
    assert.deepEqual({ revision: retry.revision, digest: retry.digest }, { revision: first.revision, digest: first.digest });
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM course_versions WHERE course_id = ? AND revision = ?").get(first.courseId, first.revision) as { n: number }).n, 1);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM course_registry_events WHERE course_id = ? AND revision = ?").get(first.courseId, first.revision) as { n: number }).n, 1);
  } finally { db.raw.close(); }
});

test("restoring an identical historical body creates a new immutable revision", async () => {
  const db = database();
  try {
    const historical = freshCourse();
    const r0 = await saveCourseCandidate(db, historical, "author-base", null);
    const changed = structuredClone(historical); changed.title += " · current";
    const r1 = await saveCourseCandidate(db, changed, "author-a", expected(r0));
    const restored = await saveCourseCandidate(db, historical, "author-restore", expected(r1));
    assert.ok(restored.revision > r1.revision);
    assert.equal(restored.digest, r0.digest);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM course_versions WHERE course_id = ? AND digest = ?").get(r0.courseId, r0.digest) as { n: number }).n, 2);
  } finally { db.raw.close(); }
});

test("field-model normalization is written and immediately readable through the exact ref", async () => {
  const db = database();
  try {
    const course = freshCourse();
    delete course.fieldModel;
    const ref = await saveCourseCandidate(db, course, "author-field-migration", null);
    const exact = await loadExactCoursePackage(db, ref);
    assert.ok(exact.fieldModel);
    assert.ok((ref.fieldMigration?.length ?? 0) > 0);
  } finally { db.raw.close(); }
});

test("database exact guards reject digest mismatches without changing immutable history", async () => {
  const db = database();
  try {
    const ref = await saveCourseCandidate(db, freshCourse(), "author", null);
    assert.throws(
      () => db.raw.prepare("UPDATE course_candidate_pointers SET digest = ? WHERE course_id = ?").run("f".repeat(64), ref.courseId),
      /COURSE_EXACT_REF_INVALID:course_candidate_pointers/,
    );
    assert.throws(
      () => db.raw.prepare(
        "INSERT INTO course_release_pointers (course_id,revision,digest,released_at,released_by,approval_json) VALUES (?,?,?,?,?,?)",
      ).run(ref.courseId, ref.revision, "e".repeat(64), "2026-09-10T00:00:00Z", "author", "{}"),
      /COURSE_EXACT_REF_INVALID:course_release_pointers/,
    );
    assert.throws(
      () => db.raw.prepare("UPDATE course_versions SET digest = ? WHERE course_id = ? AND revision = ?").run("d".repeat(64), ref.courseId, ref.revision),
      /COURSE_VERSION_IMMUTABLE:update/,
    );
    assert.throws(
      () => db.raw.prepare("DELETE FROM course_versions WHERE course_id = ? AND revision = ?").run(ref.courseId, ref.revision),
      /COURSE_VERSION_IMMUTABLE:delete/,
    );
    assert.equal((db.raw.prepare("SELECT digest FROM course_candidate_pointers WHERE course_id = ?").get(ref.courseId) as { digest: string }).digest, ref.digest);
  } finally { db.raw.close(); }
});

test("migration preflight aborts instead of repairing a legacy mismatched pointer", () => {
  const db = database(7);
  try {
    const course = freshCourse();
    db.raw.prepare(
      `INSERT INTO course_versions (course_id,revision,schema_version,digest,package_json,created_at,created_by)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(course.course.id, 0, 1, "a".repeat(64), JSON.stringify(course), "2026-09-10T00:00:00Z", "fixture");
    db.raw.prepare(
      "INSERT INTO course_candidate_pointers (course_id,revision,digest,staged_at,staged_by) VALUES (?,?,?,?,?)",
    ).run(course.course.id, 0, "b".repeat(64), "2026-09-10T00:00:00Z", "fixture");
    assert.throws(() => db.raw.exec(migrations(8).at(-1)!), /CHECK constraint failed/);
    assert.equal((db.raw.prepare("SELECT digest FROM course_candidate_pointers").get() as { digest: string }).digest, "b".repeat(64));
  } finally { db.raw.close(); }
});

test("Candidate save winning before release commit makes the checked release fail closed", async () => {
  const db = database();
  try {
    const now = "2026-09-10T00:00:00Z";
    const historicalAppBuildId = "historical-build-t102";
    const historicalSourceCommit = "0".repeat(40);
    db.raw.prepare("INSERT INTO profiles (id,nickname,created_at,updated_at) VALUES (?,?,?,?)").run("reviewer", "Reviewer", now, now);
    await ensureBundledCourseRegistry(db);
    const course = freshCourse();
    course.title += " · candidate";
    const candidate = await saveCourseCandidate(db, course, "reviewer", null);
    db.raw.prepare(
      `INSERT INTO rooms (id,code,title,campaign_id,chapter_id,phase,status,dm_profile_id,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run("room-t099", "T099", "T099", candidate.courseId, "B13", "complete", "active", "reviewer", now, now);
    db.raw.prepare(
      `INSERT INTO classroom_instances
       (room_id,environment,learner_count,lifecycle,state_machine_version,course_id,course_revision,course_digest,factory_key,reset_generation,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run("room-t099", "test", 4, "completed", CLASSROOM_STATE_MACHINE_VERSION, candidate.courseId, candidate.revision, candidate.digest, "factory-t099", 0, now, now);
    db.raw.prepare(
      `INSERT INTO course_view_acceptance_receipts
       (id,receipt_schema_version,course_id,revision,digest,status,scenarios_json,checks_json,projector_version,app_build_id,reviewer_profile_id,accepted_at,created_at)
       VALUES (?,?,?,?,?,'accepted','[]','{}',?,?,?,?,?)`,
    ).run("view-t099", COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION, candidate.courseId, candidate.revision, candidate.digest, COURSE_PROJECTOR_VERSION, historicalAppBuildId, "reviewer", now, now);
    db.raw.prepare(
      `INSERT INTO course_acceptance_build_identities
       (receipt_id,receipt_kind,projector_contract_version,runtime_contract_version,source_commit,app_build_id,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(
      "view-t099", "view", COURSE_PROJECTOR_VERSION, "not-applicable",
      historicalSourceCommit, historicalAppBuildId, now,
    );
    db.raw.prepare(
      `INSERT INTO course_ui_acceptance_receipts
       (id,receipt_schema_version,room_id,view_receipt_id,course_id,revision,digest,learner_count,deal_seed,reset_generation,state_machine_version,courseware_bundle_digest,courseware_refs_json,mentor_memberships_json,learner_memberships_json,admin_dm_json,checks_json,client_matrix_json,app_build_id,audit_summary_json,status,accepted_at,accepted_by_profile_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      "ui-t099", COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION, "room-t099", "view-t099",
      candidate.courseId, candidate.revision, candidate.digest, 4, "seed", 0,
      CLASSROOM_STATE_MACHINE_VERSION, "bundle-t099", "[]", "[]", "[]", "[]", "{}", "[]",
      historicalAppBuildId, "{}", "accepted", now, "reviewer", now,
    );
    db.raw.prepare(
      `INSERT INTO course_acceptance_build_identities
       (receipt_id,receipt_kind,projector_contract_version,runtime_contract_version,source_commit,app_build_id,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(
      "ui-t099", "ui", COURSE_PROJECTOR_VERSION, CLASSROOM_RUNTIME_CONTRACT_VERSION,
      historicalSourceCommit, historicalAppBuildId, now,
    );
    assert.equal((await requireValidViewAcceptanceReceipt(db, candidate, "view-t099")).appBuildId, historicalAppBuildId);
    assert.equal(
      (await requireValidUiAcceptanceReceipt(db, candidate, "ui-t099", "view-t099")).appBuildId,
      historicalAppBuildId,
      "a different concrete build stays valid while its compatibility contracts still match",
    );
    const changed = structuredClone(course); changed.title += " · wins race";
    db.beforeBatch = async (statements) => {
      if (!statements.some((statement) => statement.sql.includes("course_release_pointers"))) return;
      db.beforeBatch = null;
      await saveCourseCandidate(db, changed, "concurrent-author", expected(candidate));
    };
    await expectConflict(releaseTestedCourseCandidate(db, {
      courseRef: candidate,
      viewReceiptId: "view-t099",
      uiReceiptId: "ui-t099",
    }, "reviewer"));
    const releasedPointer = db.raw.prepare("SELECT revision FROM course_release_pointers WHERE course_id = ?").get(candidate.courseId) as { revision: number } | undefined;
    assert.ok(releasedPointer);
    assert.equal(releasedPointer.revision, 0);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM course_registry_events WHERE type = 'course.released'").get() as { n: number }).n, 0);
  } finally { db.raw.close(); }
});
