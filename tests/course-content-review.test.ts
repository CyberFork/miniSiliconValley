import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import { ClassroomError } from "../app/lib/classroom-errors";
import {
  assertCourseContentReviewReleaseReady,
  listCourseContentReviewStates,
  recordCourseContentReviewEvent,
} from "../app/lib/course-content-review";
import { validateCoursePackage } from "../app/lib/course-package";
import { ensureBundledCourseRegistry, loadExactCoursePackage, saveCourseCandidate } from "../app/lib/course-registry";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };

function database(): LocalDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item)).sort()) {
    raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  const api = {
    raw,
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

function seedProfile(db: LocalDatabase, id: string, nickname: string): void {
  const now = "2026-09-11T00:00:00.000Z";
  db.raw.prepare("INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, nickname, now, now);
}

function candidateCourse() {
  return validateCoursePackage(JSON.parse(readFileSync(
    new URL("../tools/live-run/courses/candidates/eleme-2008-unified-t095.json", import.meta.url),
    "utf8",
  )) as unknown);
}

async function fixture() {
  const db = database();
  seedProfile(db, "reviewer-one", "合成审核导师");
  seedProfile(db, "reviewer-two", "第二审核导师");
  await ensureBundledCourseRegistry(db);
  const course = candidateCourse();
  const ref = await saveCourseCandidate(db, course, "reviewer-one", null);
  return { db, course, ref };
}

function request(ref: { courseId: string; revision: number; digest: string }, itemId: string) {
  return {
    courseRef: ref,
    itemId,
    expectedSequence: 0,
    idempotencyKey: crypto.randomUUID(),
    action: "decision" as const,
    disposition: "revision-required" as const,
    note: "需要修订后再次核对。",
  };
}

test("course review workbench lists authored open items without mutating the CourseDefinition", async () => {
  const { db, course, ref } = await fixture();
  try {
    const states = await listCourseContentReviewStates(db, [{ course, ref }]);
    assert.equal(states.length, course.contentPackages?.reviewQueue.length);
    assert.ok(states.length >= 2);
    assert.ok(states.every((state) => state.state === (state.item.status === "open" ? "pending" : "authored-resolved")));
    assert.ok(states.every((state) => !state.releaseBlocking));
    assert.equal(states[0].nextSequence, 1);
    const persisted = await loadExactCoursePackage(db, ref);
    assert.deepEqual(persisted.contentPackages?.reviewQueue, course.contentPackages?.reviewQueue);
  } finally { db.raw.close(); }
});

test("explicit revision-required and reopen decisions block release while exclusion never masquerades as fixed", async () => {
  const { db, course, ref } = await fixture();
  try {
    const itemId = course.contentPackages!.reviewQueue.find((item) => item.status === "open")!.id;
    const required = await recordCourseContentReviewEvent(db, request(ref, itemId), "reviewer-one", Date.UTC(2026, 8, 11, 1));
    assert.equal(required.state, "revision-required");
    assert.equal(required.releaseBlocking, true);
    await assert.rejects(assertCourseContentReviewReleaseReady(db, ref), (error: unknown) => {
      assert.ok(error instanceof ClassroomError);
      assert.equal(error.code, "COURSE_CONTENT_REVIEW_BLOCKED");
      return true;
    });

    const excluded = await recordCourseContentReviewEvent(db, {
      courseRef: ref,
      itemId,
      expectedSequence: 1,
      idempotencyKey: crypto.randomUUID(),
      action: "decision",
      disposition: "excluded-this-release",
      note: "本次明确不播放风险页；这不是内容已修复。",
    }, "reviewer-one", Date.UTC(2026, 8, 11, 2));
    assert.equal(excluded.state, "excluded-this-release");
    assert.equal(excluded.releaseBlocking, false);
    assert.match(excluded.resolutionLabel, /不代表已修复/);
    await assert.doesNotReject(assertCourseContentReviewReleaseReady(db, ref));

    const reopened = await recordCourseContentReviewEvent(db, {
      courseRef: ref,
      itemId,
      expectedSequence: 2,
      idempotencyKey: crypto.randomUUID(),
      action: "reopen",
      note: "新版课件重新使用了该页，需要再次核对。",
    }, "reviewer-two", Date.UTC(2026, 8, 11, 3));
    assert.equal(reopened.state, "reopened");
    assert.equal(reopened.releaseBlocking, true);
    assert.equal(reopened.history.length, 3);
    await assert.rejects(assertCourseContentReviewReleaseReady(db, ref));
  } finally { db.raw.close(); }
});

test("source-added requires a traceable reference and terminal decisions require explicit reopen", async () => {
  const { db, course, ref } = await fixture();
  try {
    const itemId = course.contentPackages!.reviewQueue[0].id;
    await assert.rejects(recordCourseContentReviewEvent(db, {
      ...request(ref, itemId),
      disposition: "source-added",
    }, "reviewer-one"), (error: unknown) => error instanceof ClassroomError && error.code === "COURSE_REVIEW_SOURCE_REQUIRED");

    const added = await recordCourseContentReviewEvent(db, {
      ...request(ref, itemId),
      disposition: "source-added",
      sourceRef: "knowledge://eleme/source-review/synthetic-v1",
    }, "reviewer-one");
    assert.equal(added.state, "source-added");
    assert.equal(added.history[0].sourceRef, "knowledge://eleme/source-review/synthetic-v1");
    await assert.rejects(recordCourseContentReviewEvent(db, {
      ...request(ref, itemId),
      expectedSequence: 1,
      idempotencyKey: crypto.randomUUID(),
      disposition: "excluded-this-release",
    }, "reviewer-one"), (error: unknown) => error instanceof ClassroomError && error.code === "COURSE_REVIEW_REOPEN_REQUIRED");
  } finally { db.raw.close(); }
});

test("course review writes are CAS-safe, idempotent, exact-version scoped and append-only", async () => {
  const { db, course, ref } = await fixture();
  try {
    const itemId = course.contentPackages!.reviewQueue[0].id;
    const operation = request(ref, itemId);
    const first = await recordCourseContentReviewEvent(db, operation, "reviewer-one");
    const retry = await recordCourseContentReviewEvent(db, operation, "reviewer-one");
    assert.deepEqual(retry, first);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS count FROM course_content_review_events").get() as { count: number }).count, 1);

    await assert.rejects(recordCourseContentReviewEvent(db, {
      ...operation,
      idempotencyKey: crypto.randomUUID(),
      note: "并发旧基线。",
    }, "reviewer-two"), (error: unknown) => error instanceof ClassroomError && error.code === "COURSE_REVIEW_SEQUENCE_CONFLICT");
    await assert.rejects(recordCourseContentReviewEvent(db, {
      ...operation,
      note: "同一幂等键但不同载荷。",
    }, "reviewer-one"), (error: unknown) => error instanceof ClassroomError && error.code === "COURSE_REVIEW_IDEMPOTENCY_CONFLICT");

    const nextCourse = structuredClone(course);
    nextCourse.title += " · 合成新修订";
    const nextRef = await saveCourseCandidate(db, nextCourse, "reviewer-one", ref);
    const nextStates = await listCourseContentReviewStates(db, [{ course: nextCourse, ref: nextRef }]);
    assert.ok(nextStates.every((state) => state.history.length === 0), "r1 决定不能静默迁移到 r2");

    assert.throws(() => db.raw.prepare("UPDATE course_content_review_events SET note = 'tampered' WHERE id = ?").run(first.history[0].id), /COURSE_CONTENT_REVIEW_IMMUTABLE/);
    assert.throws(() => db.raw.prepare("DELETE FROM course_content_review_events WHERE id = ?").run(first.history[0].id), /COURSE_CONTENT_REVIEW_IMMUTABLE/);
    assert.throws(() => db.raw.prepare(
      `INSERT INTO course_content_review_events
       (id, course_id, revision, digest, item_id, sequence, action, disposition, note, source_ref, reviewer_profile_id, idempotency_key, created_at)
       VALUES ('invalid-item', ?, ?, ?, 'not-in-course', 1, 'decision', 'revision-required', 'x', '', 'reviewer-one', 'invalid-item-key', '2026-09-11T00:00:00Z')`,
    ).run(nextRef.courseId, nextRef.revision, nextRef.digest), /COURSE_CONTENT_REVIEW_ITEM_INVALID/);
  } finally { db.raw.close(); }
});
