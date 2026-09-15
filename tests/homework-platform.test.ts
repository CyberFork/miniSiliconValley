import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import type { ClassroomD1 } from "../db";
import type { FirstGameAnswers } from "../app/lib/first-game-homework";
import { createFirstGameSubmission, getFirstGameSubmission, HomeworkError, listFirstGameSubmissions } from "../app/lib/homework-store";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };

function database(): LocalDatabase {
  const raw = new DatabaseSync(":memory:"); raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item)).sort()) raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  const api = { raw, prepare(sql: string) { let values: SQLInputValue[] = []; const statement = { bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; }, async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; }, async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; }, async run() { return statement.execute(); }, execute() { const result = raw.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } } as unknown as D1Result; } }; return statement; }, async batch(statements: LocalStatement[]) { return statements.map((statement) => statement.execute()); } };
  return api as unknown as LocalDatabase;
}

function completeFirstPart(): FirstGameAnswers {
  return {
    gameName: "迷路星球", gameTypes: ["冒险游戏"], oneSentence: "帮助迷路的人找到出口。",
    playerWho: "喜欢探索的初中生", playerAge: "12—15 岁", playMode: ["一个人玩"], playerFeelings: ["成就感"], playerWhy: "每次路线都不同。",
    stepOne: "选择入口", stepTwo: "收集线索", stepThree: "找到出口", mainActions: ["选择"], playSentence: "看到路标，就选择方向，然后得到线索。",
    gameGoal: "离开迷宫", victoryCondition: "找到出口", failureCondition: "时间用完", afterWin: "新的地图", afterLoss: ["重新开始"],
    worldLocation: "会变化的迷宫", worldPlayer: "小小探险家", worldReason: "找回丢失的地图",
  };
}

test("T-119 requires the complete first part, ignores retired image fields and keeps independent submissions", async () => {
  const db = database();
  try {
    await assert.rejects(createFirstGameSubmission(db, { clientRequestId: "first-game.test.incomplete", respondentNickname: "小航", answers: { gameName: "迷路星球" } }), (error: unknown) => error instanceof HomeworkError && error.code === "HOMEWORK_REQUIRED_MISSING" && error.message.includes("游戏类型"));
    const first = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.0001", respondentNickname: "小航", answers: { ...completeFirstPart(), logoImage: "data:image/png;base64,retired" } });
    assert.equal(first.replayed, false); assert.equal(first.submission.answeredCount, 21); assert.equal(first.submission.imageCount, 0); assert.equal("logoImage" in first.submission.answers, false);
    const retry = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.0001", respondentNickname: "小航", answers: { gameName: "被重试忽略" } });
    assert.equal(retry.replayed, true); assert.equal(retry.submission.id, first.submission.id); assert.equal(retry.submission.answers.gameName, "迷路星球");
    const second = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.0002", respondentNickname: "小航", answers: { ...completeFirstPart(), characterName: "小光" } });
    assert.notEqual(second.submission.id, first.submission.id); assert.equal(second.submission.answeredCount, 22);
    const listing = await listFirstGameSubmissions(db, 1); assert.equal(listing.total, 2); assert.equal(listing.submissions[0].id, second.submission.id); assert.equal("answers" in listing.submissions[0], false);
    assert.equal((await getFirstGameSubmission(db, first.submission.id)).answers.gameName, "迷路星球");
  } finally { db.raw.close(); }
});

test("T-119 validates required identity, choices and input limits while preserving literal text", async () => {
  const db = database();
  try {
    await assert.rejects(createFirstGameSubmission(db, { clientRequestId: "first-game.test.noname", answers: { gameName: "缺少称呼" } }), (error: unknown) => error instanceof HomeworkError && error.code === "HOMEWORK_FIELD_REQUIRED" && error.message === "请提供姓名／昵称。");
    const literal = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.xss", respondentNickname: "安全测试", respondentNote: "<script>alert(1)</script>", answers: { ...completeFirstPart(), oneSentence: "<img src=x onerror=alert(1)>" } });
    assert.equal(literal.submission.respondentNote, "<script>alert(1)</script>"); assert.equal(literal.submission.answers.oneSentence, "<img src=x onerror=alert(1)>");
    await assert.rejects(createFirstGameSubmission(db, { clientRequestId: "first-game.test.badchoice", respondentNickname: "安全测试", answers: { ...completeFirstPart(), gameTypes: ["注入的新类型"] } }), (error: unknown) => error instanceof HomeworkError && error.code === "HOMEWORK_CHOICE_INVALID");
  } finally { db.raw.close(); }
});

test("T-119 submissions are append-only at the database boundary", async () => {
  const db = database();
  try {
    const saved = await createFirstGameSubmission(db, { clientRequestId: "first-game.test.immutable", respondentNickname: "不可变测试", answers: completeFirstPart() });
    assert.throws(() => db.raw.prepare("UPDATE homework_first_game_submissions SET answers_json = '{}' WHERE id = ?").run(saved.submission.id), /HOMEWORK_SUBMISSION_IMMUTABLE/);
    assert.throws(() => db.raw.prepare("DELETE FROM homework_first_game_submissions WHERE id = ?").run(saved.submission.id), /HOMEWORK_SUBMISSION_IMMUTABLE/);
  } finally { db.raw.close(); }
});
