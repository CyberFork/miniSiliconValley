import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import type { ClassroomD1 } from "../db";
import { AI_DAILY_QUIZ, AI_DAILY_QUIZ_SOURCE_SHA256 } from "../app/lib/ai-daily-quiz";
import { createAiQuizSubmission, listAiQuizSubmissions } from "../app/lib/ai-daily-quiz-store";
import { HomeworkError } from "../app/lib/homework-store";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };
function database(): LocalDatabase {
  const raw = new DatabaseSync(":memory:"); raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item)).sort()) raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  const api = { raw, prepare(sql: string) { let values: SQLInputValue[] = []; const statement = { bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; }, async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; }, async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; }, async run() { return statement.execute(); }, execute() { const result = raw.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } } as unknown as D1Result; } }; return statement; }, async batch(statements: LocalStatement[]) { return statements.map((statement) => statement.execute()); } };
  return api as unknown as LocalDatabase;
}

test("AI daily quiz preserves the audited 7-day, 35-question source", () => {
  assert.equal(AI_DAILY_QUIZ_SOURCE_SHA256, "611393d62af21b4e43d3b2192c1f87cdf4607ffc53b71eabdd6f8fcf1f55f926");
  assert.equal(AI_DAILY_QUIZ.length, 7);
  assert.deepEqual(AI_DAILY_QUIZ.map((day) => day.questions.length), [5, 5, 5, 5, 5, 5, 5]);
  for (const day of AI_DAILY_QUIZ) for (const question of day.questions) { assert.equal(question.options.length, 4); assert.ok(question.answer >= 0 && question.answer < 4); assert.ok(question.explain.length > 0); }
});

test("AI daily quiz scores on the server, replays idempotently and lists independent submissions", async () => {
  const db = database();
  try {
    const first = await createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.0001", respondentNickname: "小智", dayIndex: 0, answers: [0, 2, 1, 1, 1] });
    assert.equal(first.replayed, false); assert.equal(first.submission.correctCount, 5); assert.equal(first.submission.score, 100); assert.equal(first.submission.coins, 500);
    const retry = await createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.0001", respondentNickname: "覆盖无效", dayIndex: 1, answers: [0, 0, 0, 0, 0] });
    assert.equal(retry.replayed, true); assert.equal(retry.submission.id, first.submission.id); assert.equal(retry.submission.respondentNickname, "小智");
    const second = await createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.0002", respondentNickname: "小智", dayIndex: 0, answers: [3, 3, 3, 3, 3] });
    assert.notEqual(second.submission.id, first.submission.id);
    const listing = await listAiQuizSubmissions(db, 1); assert.equal(listing.total, 2); assert.equal(listing.submissions[0].id, second.submission.id); assert.equal(listing.submissions[1].results.length, 5);
  } finally { db.raw.close(); }
});

test("AI daily quiz rejects missing identity, incomplete answers and invalid days", async () => {
  const db = database();
  try {
    await assert.rejects(createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.noname", dayIndex: 0, answers: [0, 2, 1, 1, 1] }), (error: unknown) => error instanceof HomeworkError && error.code === "AI_QUIZ_FIELD_REQUIRED");
    await assert.rejects(createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.short", respondentNickname: "小智", dayIndex: 0, answers: [0, 2] }), (error: unknown) => error instanceof HomeworkError && error.code === "AI_QUIZ_ANSWERS_INCOMPLETE");
    await assert.rejects(createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.day", respondentNickname: "小智", dayIndex: 7, answers: [0, 2, 1, 1, 1] }), (error: unknown) => error instanceof HomeworkError && error.code === "AI_QUIZ_DAY_INVALID");
    await assert.rejects(createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.option", respondentNickname: "小智", dayIndex: 0, answers: [9, 2, 1, 1, 1] }), (error: unknown) => error instanceof HomeworkError && error.code === "AI_QUIZ_ANSWER_INVALID");
  } finally { db.raw.close(); }
});

test("AI daily quiz submissions are append-only at the database boundary", async () => {
  const db = database();
  try {
    const saved = await createAiQuizSubmission(db, { clientRequestId: "ai-quiz.test.immutable", respondentNickname: "小智", dayIndex: 0, answers: [0, 2, 1, 1, 1] });
    assert.throws(() => db.raw.prepare("UPDATE homework_ai_quiz_submissions SET score = 0 WHERE id = ?").run(saved.submission.id), /AI_QUIZ_SUBMISSION_IMMUTABLE/);
    assert.throws(() => db.raw.prepare("DELETE FROM homework_ai_quiz_submissions WHERE id = ?").run(saved.submission.id), /AI_QUIZ_SUBMISSION_IMMUTABLE/);
  } finally { db.raw.close(); }
});
