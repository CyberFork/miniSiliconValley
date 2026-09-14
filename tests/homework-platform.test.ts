import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import type { ClassroomD1 } from "../db";
import { createFirstGameSubmission, getFirstGameSubmission, HomeworkError, listFirstGameSubmissions } from "../app/lib/homework-store";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };

function database(): LocalDatabase {
  const raw = new DatabaseSync(":memory:"); raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item)).sort()) raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  const api = { raw, prepare(sql: string) { let values: SQLInputValue[] = []; const statement = { bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; }, async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; }, async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; }, async run() { return statement.execute(); }, execute() { const result = raw.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } } as unknown as D1Result; } }; return statement; }, async batch(statements: LocalStatement[]) { return statements.map((statement) => statement.execute()); } };
  return api as unknown as LocalDatabase;
}

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

test("T-119 accepts partial and repeated public submissions without account or completion gates", async () => {
  const db = database();
  try {
    const first = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.0001", respondentNickname: "小航", answers: { gameName: "迷路星球", logoImage: png } });
    assert.equal(first.replayed, false); assert.equal(first.submission.answeredCount, 2); assert.equal(first.submission.imageCount, 1);
    const retry = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.0001", respondentNickname: "小航", answers: { gameName: "被重试忽略" } });
    assert.equal(retry.replayed, true); assert.equal(retry.submission.id, first.submission.id); assert.equal(retry.submission.answers.gameName, "迷路星球");
    const second = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.0002", respondentNickname: "小航", answers: {} });
    assert.notEqual(second.submission.id, first.submission.id); assert.equal(second.submission.answeredCount, 0);
    const listing = await listFirstGameSubmissions(db, 1); assert.equal(listing.total, 2); assert.equal(listing.submissions[0].id, second.submission.id); assert.equal("answers" in listing.submissions[0], false);
    assert.equal((await getFirstGameSubmission(db, first.submission.id)).answers.gameName, "迷路星球");
  } finally { db.raw.close(); }
});

test("T-119 validates choices, image bytes and input limits while preserving literal text", async () => {
  const db = database();
  try {
    const literal = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.xss", respondentNote: "<script>alert(1)</script>", answers: { oneSentence: "<img src=x onerror=alert(1)>" } });
    assert.equal(literal.submission.respondentNote, "<script>alert(1)</script>"); assert.equal(literal.submission.answers.oneSentence, "<img src=x onerror=alert(1)>");
    await assert.rejects(createFirstGameSubmission(db, { clientRequestId: "first-game.test.badchoice", answers: { gameTypes: ["注入的新类型"] } }), (error: unknown) => error instanceof HomeworkError && error.code === "HOMEWORK_CHOICE_INVALID");
    await assert.rejects(createFirstGameSubmission(db, { clientRequestId: "first-game.test.svg", answers: { logoImage: "data:image/svg+xml;base64,PHN2Zz4=" } }), (error: unknown) => error instanceof HomeworkError && error.code === "HOMEWORK_IMAGE_TYPE_INVALID");
    await assert.rejects(createFirstGameSubmission(db, { clientRequestId: "first-game.test.fakepng", answers: { logoImage: "data:image/png;base64,PHNjcmlwdD4=" } }), (error: unknown) => error instanceof HomeworkError && error.code === "HOMEWORK_IMAGE_TYPE_INVALID");
  } finally { db.raw.close(); }
});

test("T-119 submissions are append-only at the database boundary", async () => {
  const db = database();
  try {
    const saved = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.immutable", answers: { gameName: "原始版本" } });
    assert.throws(() => db.raw.prepare("UPDATE homework_first_game_submissions SET answers_json = '{}' WHERE id = ?").run(saved.submission.id), /HOMEWORK_SUBMISSION_IMMUTABLE/);
    assert.throws(() => db.raw.prepare("DELETE FROM homework_first_game_submissions WHERE id = ?").run(saved.submission.id), /HOMEWORK_SUBMISSION_IMMUTABLE/);
  } finally { db.raw.close(); }
});
