import type { ClassroomD1 } from "../../db";
import { getAiQuizDay } from "./ai-daily-quiz";
import { HomeworkError } from "./homework-store";

export type AiQuizAnswerResult = {
  questionIndex: number;
  selected: number;
  correctAnswer: number;
  correct: boolean;
};

export type AiQuizSubmission = {
  id: string;
  respondentNickname: string;
  dayIndex: number;
  answers: number[];
  results: AiQuizAnswerResult[];
  correctCount: number;
  totalCount: number;
  score: number;
  coins: number;
  createdAt: string;
};

export type AiQuizSubmissionSummary = Omit<AiQuizSubmission, "answers" | "results">;

export async function createAiQuizSubmission(db: ClassroomD1, input: unknown): Promise<{ submission: AiQuizSubmission; replayed: boolean }> {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const clientRequestId = boundedString(raw.clientRequestId, "提交操作号", 100, true);
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(clientRequestId)) throw new HomeworkError("AI_QUIZ_REQUEST_ID_INVALID", "提交操作号无效，请刷新页面后重试。", 400);
  const existing = await findByRequest(db, clientRequestId);
  if (existing) return { submission: existing, replayed: true };

  const respondentNickname = boundedString(raw.respondentNickname, "姓名／昵称", 80, true);
  const dayIndex = normalizeDayIndex(raw.dayIndex);
  const day = getAiQuizDay(dayIndex);
  if (!Array.isArray(raw.answers) || raw.answers.length !== day.questions.length) throw new HomeworkError("AI_QUIZ_ANSWERS_INCOMPLETE", `请答完当天的 ${day.questions.length} 道题。`, 400);
  const answers = raw.answers.map((value, index) => normalizeAnswer(value, day.questions[index]?.options.length ?? 0, index));
  const results = answers.map((selected, questionIndex) => ({ questionIndex, selected, correctAnswer: day.questions[questionIndex].answer, correct: selected === day.questions[questionIndex].answer }));
  const correctCount = results.filter((item) => item.correct).length;
  const totalCount = day.questions.length;
  const score = Math.round(correctCount / totalCount * 100);
  const coins = correctCount * 100;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO homework_ai_quiz_submissions
       (id, respondent_nickname, day_index, answers_json, correct_count, total_count, score, coins, client_request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, respondentNickname, dayIndex, JSON.stringify(answers), correctCount, totalCount, score, coins, clientRequestId, createdAt).run();
  } catch (error) {
    const replay = await findByRequest(db, clientRequestId);
    if (replay) return { submission: replay, replayed: true };
    console.error("[ai-quiz-create]", error);
    throw new HomeworkError("AI_QUIZ_SAVE_FAILED", "答题结果暂时没有保存成功；你的选择仍在当前页面，请稍后重试。", 503);
  }
  return { submission: { id, respondentNickname, dayIndex, answers, results, correctCount, totalCount, score, coins, createdAt }, replayed: false };
}

export async function listAiQuizSubmissions(db: ClassroomD1, page: number): Promise<{ submissions: AiQuizSubmission[]; page: number; pageSize: number; total: number; pageCount: number }> {
  const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
  const pageSize = 20;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM homework_ai_quiz_submissions").first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const rows = await db.prepare(
    `SELECT id, respondent_nickname, day_index, answers_json, correct_count, total_count, score, coins, created_at
     FROM homework_ai_quiz_submissions ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  ).bind(pageSize, (safePage - 1) * pageSize).all<Record<string, unknown>>();
  return { submissions: (rows.results ?? []).map(detailFromRow), page: safePage, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function normalizeDayIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) throw new HomeworkError("AI_QUIZ_DAY_INVALID", "请选择周日到周六中的一天。", 400);
  return value;
}

function normalizeAnswer(value: unknown, optionCount: number, index: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= optionCount) throw new HomeworkError("AI_QUIZ_ANSWER_INVALID", `第 ${index + 1} 题的答案无效，请重新选择。`, 400);
  return value;
}

function boundedString(value: unknown, label: string, max: number, required: boolean): string {
  if (value !== undefined && value !== null && typeof value !== "string") throw new HomeworkError("AI_QUIZ_FIELD_INVALID", `${label}格式不正确。`, 400);
  const text = String(value ?? "").trim();
  if (required && !text) throw new HomeworkError("AI_QUIZ_FIELD_REQUIRED", `请提供${label}。`, 400);
  if (text.length > max) throw new HomeworkError("AI_QUIZ_FIELD_TOO_LONG", `${label}不能超过 ${max} 个字符。`, 400);
  return text;
}

async function findByRequest(db: ClassroomD1, requestId: string): Promise<AiQuizSubmission | null> {
  const row = await db.prepare(
    `SELECT id, respondent_nickname, day_index, answers_json, correct_count, total_count, score, coins, created_at
     FROM homework_ai_quiz_submissions WHERE client_request_id = ?`,
  ).bind(requestId).first<Record<string, unknown>>();
  return row ? detailFromRow(row) : null;
}

function detailFromRow(row: Record<string, unknown>): AiQuizSubmission {
  const dayIndex = Number(row.day_index ?? 0);
  const day = getAiQuizDay(dayIndex);
  let answers: number[] = [];
  try { answers = JSON.parse(String(row.answers_json ?? "[]")) as number[]; } catch { answers = []; }
  const results = answers.map((selected, questionIndex) => ({ questionIndex, selected, correctAnswer: day.questions[questionIndex]?.answer ?? -1, correct: selected === day.questions[questionIndex]?.answer }));
  return {
    id: String(row.id), respondentNickname: String(row.respondent_nickname ?? ""), dayIndex, answers, results,
    correctCount: Number(row.correct_count ?? 0), totalCount: Number(row.total_count ?? day.questions.length), score: Number(row.score ?? 0), coins: Number(row.coins ?? 0), createdAt: String(row.created_at),
  };
}
