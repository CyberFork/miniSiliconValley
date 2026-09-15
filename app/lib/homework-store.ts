import type { ClassroomD1 } from "../../db";
import { FIRST_GAME_HOMEWORK_FIELDS, FIRST_GAME_REQUIRED_FIELDS, type FirstGameAnswer, type FirstGameAnswers, type FirstGameField } from "./first-game-homework";

const MAX_REQUEST_BYTES = 1_200_000;
const MAX_TEXT_LENGTH = 1_200;
const MAX_TABLE_CELL_LENGTH = 300;

export class HomeworkError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export type FirstGameSubmissionSummary = {
  id: string;
  respondentNickname: string;
  respondentNote: string;
  answeredCount: number;
  imageCount: number;
  createdAt: string;
};

export type FirstGameSubmission = FirstGameSubmissionSummary & { answers: FirstGameAnswers };

export async function createFirstGameSubmission(db: ClassroomD1, input: unknown): Promise<{ submission: FirstGameSubmission; replayed: boolean }> {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const clientRequestId = boundedString(raw.clientRequestId, "提交操作号", 100, true);
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(clientRequestId)) throw new HomeworkError("HOMEWORK_REQUEST_ID_INVALID", "提交操作号无效，请刷新页面后重试。", 400);
  const existing = await findByRequest(db, clientRequestId);
  if (existing) return { submission: existing, replayed: true };

  const respondentNickname = boundedString(raw.respondentNickname, "姓名／昵称", 80, true);
  const respondentNote = boundedString(raw.respondentNote, "自我说明", 300, false);
  const answers = normalizeAnswers(raw.answers);
  const missingRequired = FIRST_GAME_REQUIRED_FIELDS.filter((field) => !answerHasContent(answers[field.id] ?? ""));
  if (missingRequired.length) throw new HomeworkError("HOMEWORK_REQUIRED_MISSING", `请完成第一部分必填项：${missingRequired[0].label}。`, 400);
  const encoded = JSON.stringify(answers);
  if (new TextEncoder().encode(encoded).byteLength > MAX_REQUEST_BYTES) throw new HomeworkError("HOMEWORK_TOO_LARGE", "提交内容太大，请精简后重试。", 413);
  const fields = Object.entries(answers).filter(([, value]) => answerHasContent(value));
  const imageCount = 0;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO homework_first_game_submissions
       (id, respondent_nickname, respondent_note, answers_json, answered_count, image_count, client_request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, respondentNickname, respondentNote, encoded, fields.length, imageCount, clientRequestId, createdAt).run();
  } catch (error) {
    const replay = await findByRequest(db, clientRequestId);
    if (replay) return { submission: replay, replayed: true };
    console.error("[homework-create]", error);
    throw new HomeworkError("HOMEWORK_SAVE_FAILED", "作业暂时没有保存成功；你填写的内容仍在当前页面，请稍后重试。", 503);
  }
  return { submission: { id, respondentNickname, respondentNote, answers, answeredCount: fields.length, imageCount, createdAt }, replayed: false };
}

export async function listFirstGameSubmissions(db: ClassroomD1, page: number): Promise<{ submissions: FirstGameSubmissionSummary[]; page: number; pageSize: number; total: number; pageCount: number }> {
  const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
  const pageSize = 20;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM homework_first_game_submissions").first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const rows = await db.prepare(
    `SELECT id, respondent_nickname, respondent_note, answered_count, image_count, created_at
     FROM homework_first_game_submissions ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  ).bind(pageSize, (safePage - 1) * pageSize).all<Record<string, unknown>>();
  return { submissions: (rows.results ?? []).map(summaryFromRow), page: safePage, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getFirstGameSubmission(db: ClassroomD1, id: string): Promise<FirstGameSubmission> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HomeworkError("HOMEWORK_NOT_FOUND", "没有找到这份作业。", 404);
  const row = await db.prepare(
    `SELECT id, respondent_nickname, respondent_note, answers_json, answered_count, image_count, created_at
     FROM homework_first_game_submissions WHERE id = ?`,
  ).bind(id).first<Record<string, unknown>>();
  if (!row) throw new HomeworkError("HOMEWORK_NOT_FOUND", "没有找到这份作业。", 404);
  return detailFromRow(row);
}

function normalizeAnswers(value: unknown): FirstGameAnswers {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const output: FirstGameAnswers = {};
  for (const field of FIRST_GAME_HOMEWORK_FIELDS) {
    const answer = normalizeAnswer(field, raw[field.id]);
    if (answer === null || !answerHasContent(answer)) continue;
    output[field.id] = answer;
  }
  return output;
}

function normalizeAnswer(field: FirstGameField, value: unknown): FirstGameAnswer | null {
  if (field.kind === "short" || field.kind === "long") return boundedString(value, field.label, MAX_TEXT_LENGTH, false);
  if (field.kind === "single" || field.kind === "multi") {
    const values = (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).map((item) => boundedString(item, field.label, 80, false)).filter(Boolean);
    const allowed = new Set(field.options ?? []);
    if (values.some((item) => !allowed.has(item))) throw new HomeworkError("HOMEWORK_CHOICE_INVALID", `${field.label}包含无效选项。`, 400);
    return [...new Set(values)];
  }
  if (field.kind === "table") {
    const rows = Array.isArray(value) ? value : [];
    const allowedRows = new Set((field.rows ?? []).map((row) => row.id));
    const allowedColumns = new Set((field.columns ?? []).map((column) => column.id));
    return rows.slice(0, field.rows?.length ?? 0).map((row, index) => {
      const input = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
      const rowId = typeof input.rowId === "string" && allowedRows.has(input.rowId) ? input.rowId : field.rows?.[index]?.id ?? "";
      const result: Record<string, string> = { rowId };
      for (const column of allowedColumns) result[column] = boundedString(input[column], `${field.label}表格`, MAX_TABLE_CELL_LENGTH, false);
      return result;
    });
  }
  return null;
}

function answerHasContent(answer: FirstGameAnswer): boolean {
  if (typeof answer === "string") return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.some((item) => typeof item === "string" ? item.trim().length > 0 : Object.entries(item).some(([key, value]) => key !== "rowId" && String(value).trim().length > 0));
  return false;
}

function boundedString(value: unknown, label: string, max: number, required: boolean): string {
  if (value !== undefined && value !== null && typeof value !== "string") throw new HomeworkError("HOMEWORK_FIELD_INVALID", `${label}格式不正确。`, 400);
  const text = String(value ?? "").trim();
  if (required && !text) throw new HomeworkError("HOMEWORK_FIELD_REQUIRED", `请提供${label}。`, 400);
  if (text.length > max) throw new HomeworkError("HOMEWORK_FIELD_TOO_LONG", `${label}不能超过 ${max} 个字符。`, 400);
  return text;
}

async function findByRequest(db: ClassroomD1, requestId: string): Promise<FirstGameSubmission | null> {
  const row = await db.prepare(
    `SELECT id, respondent_nickname, respondent_note, answers_json, answered_count, image_count, created_at
     FROM homework_first_game_submissions WHERE client_request_id = ?`,
  ).bind(requestId).first<Record<string, unknown>>();
  return row ? detailFromRow(row) : null;
}

function summaryFromRow(row: Record<string, unknown>): FirstGameSubmissionSummary {
  return { id: String(row.id), respondentNickname: String(row.respondent_nickname ?? ""), respondentNote: String(row.respondent_note ?? ""), answeredCount: Number(row.answered_count ?? 0), imageCount: Number(row.image_count ?? 0), createdAt: String(row.created_at) };
}

function detailFromRow(row: Record<string, unknown>): FirstGameSubmission {
  let answers: FirstGameAnswers = {};
  try { answers = JSON.parse(String(row.answers_json ?? "{}")) as FirstGameAnswers; } catch { answers = {}; }
  return { ...summaryFromRow(row), answers };
}
