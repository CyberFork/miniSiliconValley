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
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type FirstGameSubmission = FirstGameSubmissionSummary & { answers: FirstGameAnswers };

export async function createFirstGameSubmission(db: ClassroomD1, input: unknown): Promise<{ submission: FirstGameSubmission; replayed: boolean }> {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const clientRequestId = boundedString(raw.clientRequestId, "提交操作号", 100, true);
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(clientRequestId)) throw new HomeworkError("HOMEWORK_REQUEST_ID_INVALID", "提交操作号无效，请刷新页面后重试。", 400);
  const existing = await findByRequest(db, clientRequestId);
  if (existing) return { submission: existing, replayed: true };
  const normalized = normalizeSubmissionPayload(raw);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO homework_first_game_submissions
       (id, respondent_nickname, respondent_note, answers_json, answered_count, image_count, client_request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, normalized.respondentNickname, normalized.respondentNote, normalized.encoded, normalized.answeredCount, 0, clientRequestId, createdAt).run();
  } catch (error) {
    const replay = await findByRequest(db, clientRequestId);
    if (replay) return { submission: replay, replayed: true };
    console.error("[homework-create]", error);
    throw new HomeworkError("HOMEWORK_SAVE_FAILED", "作业暂时没有保存成功；你填写的内容仍在当前页面，请稍后重试。", 503);
  }
  return { submission: { id, respondentNickname: normalized.respondentNickname, respondentNote: normalized.respondentNote, answers: normalized.answers, answeredCount: normalized.answeredCount, imageCount: 0, revision: 0, createdAt, updatedAt: createdAt }, replayed: false };
}

/** Staff corrections append a complete immutable snapshot.  The optimistic
 * revision guard prevents two open detail pages from silently overwriting one
 * another. */
export async function updateFirstGameSubmission(db: ClassroomD1, id: string, input: unknown, editorUserId: string): Promise<FirstGameSubmission> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HomeworkError("HOMEWORK_NOT_FOUND", "没有找到这份作业。", 404);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const expectedRevision = raw.expectedRevision;
  if (!Number.isInteger(expectedRevision) || Number(expectedRevision) < 0) throw new HomeworkError("HOMEWORK_REVISION_REQUIRED", "缺少有效的作业版本，请刷新后重试。", 400);
  const current = await getFirstGameSubmission(db, id);
  if (current.revision !== expectedRevision) throw new HomeworkError("HOMEWORK_REVISION_CONFLICT", "另一位老师刚刚修改了这份作业，请刷新后再编辑。", 409);
  const normalized = normalizeSubmissionPayload(raw);
  const revision = Number(expectedRevision) + 1;
  const editedAt = new Date().toISOString();
  try {
    const result = await db.prepare(
      `INSERT INTO homework_first_game_submission_revisions
       (id, submission_id, revision, respondent_nickname, respondent_note, answers_json,
        answered_count, image_count, edited_by_user_id, edited_at)
       SELECT ?, s.id, ?, ?, ?, ?, ?, 0, ?, ?
       FROM homework_first_game_submissions s
       WHERE s.id = ?
         AND ? = COALESCE((
           SELECT MAX(r.revision) FROM homework_first_game_submission_revisions r
           WHERE r.submission_id = s.id
         ), 0)`,
    ).bind(
      crypto.randomUUID(), revision, normalized.respondentNickname, normalized.respondentNote,
      normalized.encoded, normalized.answeredCount, editorUserId, editedAt, id, expectedRevision,
    ).run();
    if (Number(result.meta?.changes ?? 0) !== 1) throw new HomeworkError("HOMEWORK_REVISION_CONFLICT", "另一位老师刚刚修改了这份作业，请刷新后再编辑。", 409);
  } catch (error) {
    if (error instanceof HomeworkError) throw error;
    if (/UNIQUE constraint failed/i.test(error instanceof Error ? error.message : String(error))) {
      throw new HomeworkError("HOMEWORK_REVISION_CONFLICT", "另一位老师刚刚修改了这份作业，请刷新后再编辑。", 409);
    }
    console.error("[homework-update]", error);
    throw new HomeworkError("HOMEWORK_UPDATE_FAILED", "修改暂时没有保存成功，当前弹窗内容仍在，请稍后重试。", 503);
  }
  return getFirstGameSubmission(db, id);
}

export async function listFirstGameSubmissions(db: ClassroomD1, page: number): Promise<{ submissions: FirstGameSubmissionSummary[]; page: number; pageSize: number; total: number; pageCount: number }> {
  const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
  const pageSize = 20;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM homework_first_game_submissions").first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const rows = await db.prepare(
    `SELECT s.id,
            COALESCE(r.respondent_nickname, s.respondent_nickname) AS respondent_nickname,
            COALESCE(r.respondent_note, s.respondent_note) AS respondent_note,
            COALESCE(r.answered_count, s.answered_count) AS answered_count,
            COALESCE(r.image_count, s.image_count) AS image_count,
            COALESCE(r.revision, 0) AS revision,
            s.created_at,
            COALESCE(r.edited_at, s.created_at) AS updated_at
     FROM homework_first_game_submissions s
     LEFT JOIN homework_first_game_submission_revisions r
       ON r.submission_id = s.id
      AND r.revision = (SELECT MAX(latest.revision) FROM homework_first_game_submission_revisions latest WHERE latest.submission_id = s.id)
     ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
  ).bind(pageSize, (safePage - 1) * pageSize).all<Record<string, unknown>>();
  return { submissions: (rows.results ?? []).map(summaryFromRow), page: safePage, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getFirstGameSubmission(db: ClassroomD1, id: string): Promise<FirstGameSubmission> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HomeworkError("HOMEWORK_NOT_FOUND", "没有找到这份作业。", 404);
  const row = await db.prepare(
    `SELECT s.id,
            COALESCE(r.respondent_nickname, s.respondent_nickname) AS respondent_nickname,
            COALESCE(r.respondent_note, s.respondent_note) AS respondent_note,
            COALESCE(r.answers_json, s.answers_json) AS answers_json,
            COALESCE(r.answered_count, s.answered_count) AS answered_count,
            COALESCE(r.image_count, s.image_count) AS image_count,
            COALESCE(r.revision, 0) AS revision,
            s.created_at,
            COALESCE(r.edited_at, s.created_at) AS updated_at
     FROM homework_first_game_submissions s
     LEFT JOIN homework_first_game_submission_revisions r
       ON r.submission_id = s.id
      AND r.revision = (SELECT MAX(latest.revision) FROM homework_first_game_submission_revisions latest WHERE latest.submission_id = s.id)
     WHERE s.id = ?`,
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

function normalizeSubmissionPayload(raw: Record<string, unknown>): { respondentNickname: string; respondentNote: string; answers: FirstGameAnswers; encoded: string; answeredCount: number } {
  const respondentNickname = boundedString(raw.respondentNickname, "姓名／昵称", 80, true);
  const respondentNote = boundedString(raw.respondentNote, "公司名称", 120, true);
  const answers = normalizeAnswers(raw.answers);
  const missingRequired = FIRST_GAME_REQUIRED_FIELDS.filter((field) => !answerHasContent(answers[field.id] ?? ""));
  if (missingRequired.length) throw new HomeworkError("HOMEWORK_REQUIRED_MISSING", `请完成第一部分必填项：${missingRequired[0].label}。`, 400);
  const encoded = JSON.stringify(answers);
  if (new TextEncoder().encode(encoded).byteLength > MAX_REQUEST_BYTES) throw new HomeworkError("HOMEWORK_TOO_LARGE", "提交内容太大，请精简后重试。", 413);
  return { respondentNickname, respondentNote, answers, encoded, answeredCount: Object.values(answers).filter(answerHasContent).length };
}

async function findByRequest(db: ClassroomD1, requestId: string): Promise<FirstGameSubmission | null> {
  const row = await db.prepare(
    `SELECT s.id,
            COALESCE(r.respondent_nickname, s.respondent_nickname) AS respondent_nickname,
            COALESCE(r.respondent_note, s.respondent_note) AS respondent_note,
            COALESCE(r.answers_json, s.answers_json) AS answers_json,
            COALESCE(r.answered_count, s.answered_count) AS answered_count,
            COALESCE(r.image_count, s.image_count) AS image_count,
            COALESCE(r.revision, 0) AS revision,
            s.created_at,
            COALESCE(r.edited_at, s.created_at) AS updated_at
     FROM homework_first_game_submissions s
     LEFT JOIN homework_first_game_submission_revisions r
       ON r.submission_id = s.id
      AND r.revision = (SELECT MAX(latest.revision) FROM homework_first_game_submission_revisions latest WHERE latest.submission_id = s.id)
     WHERE s.client_request_id = ?`,
  ).bind(requestId).first<Record<string, unknown>>();
  return row ? detailFromRow(row) : null;
}

function summaryFromRow(row: Record<string, unknown>): FirstGameSubmissionSummary {
  return { id: String(row.id), respondentNickname: String(row.respondent_nickname ?? ""), respondentNote: String(row.respondent_note ?? ""), answeredCount: Number(row.answered_count ?? 0), imageCount: Number(row.image_count ?? 0), revision: Number(row.revision ?? 0), createdAt: String(row.created_at), updatedAt: String(row.updated_at ?? row.created_at) };
}

function detailFromRow(row: Record<string, unknown>): FirstGameSubmission {
  let answers: FirstGameAnswers = {};
  try { answers = JSON.parse(String(row.answers_json ?? "{}")) as FirstGameAnswers; } catch { answers = {}; }
  return { ...summaryFromRow(row), answers };
}
