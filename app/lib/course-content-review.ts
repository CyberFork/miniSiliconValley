import type { ClassroomD1 } from "../../db";
import { ClassroomError } from "./classroom-errors";
import {
  coursePackageDigest,
  type CourseContentReviewItem,
  type CoursePackage,
  type CoursePackageRef,
  validateCoursePackage,
} from "./course-package";

export type CourseContentReviewDisposition =
  | "revision-required"
  | "source-added"
  | "excluded-this-release";
export type CourseContentReviewAction = "decision" | "reopen";
export type CourseContentReviewStateCode =
  | "pending"
  | "reopened"
  | "revision-required"
  | "source-added"
  | "excluded-this-release"
  | "authored-resolved";

export type CourseContentReviewEventSummary = {
  id: string;
  sequence: number;
  action: CourseContentReviewAction;
  disposition: CourseContentReviewDisposition | null;
  note: string;
  sourceRef: string | null;
  reviewerDisplayName: string;
  createdAt: string;
};

export type CourseContentReviewState = {
  courseRef: Pick<CoursePackageRef, "courseId" | "revision" | "digest">;
  courseName: string;
  item: CourseContentReviewItem;
  state: CourseContentReviewStateCode;
  releaseBlocking: boolean;
  resolutionLabel: string;
  nextSequence: number;
  history: CourseContentReviewEventSummary[];
};

export type CourseReviewableVersion = {
  course: CoursePackage;
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">;
};

export type RecordCourseContentReviewInput = {
  courseRef: Pick<CoursePackageRef, "courseId" | "revision" | "digest">;
  itemId: string;
  expectedSequence: number;
  idempotencyKey: string;
  action: CourseContentReviewAction;
  disposition?: CourseContentReviewDisposition;
  note: string;
  sourceRef?: string;
};

type ReviewEventRow = {
  id: string;
  course_id: string;
  revision: number;
  digest: string;
  item_id: string;
  sequence: number;
  action: string;
  disposition: string | null;
  note: string;
  source_ref: string;
  reviewer_profile_id: string;
  reviewer_display_name: string | null;
  idempotency_key: string;
  created_at: string;
};

export async function listCourseContentReviewStates(
  db: ClassroomD1,
  versions: readonly CourseReviewableVersion[],
): Promise<CourseContentReviewState[]> {
  const reviewable = versions.filter((version) => (version.course.contentPackages?.reviewQueue.length ?? 0) > 0);
  if (!reviewable.length) return [];
  const exactClauses = reviewable.map(() => "(e.course_id = ? AND e.revision = ? AND e.digest = ?)").join(" OR ");
  const bindings = reviewable.flatMap(({ ref }) => [ref.courseId, ref.revision, ref.digest]);
  const result = await db.prepare(
    `SELECT e.*, p.nickname AS reviewer_display_name
     FROM course_content_review_events e
     JOIN profiles p ON p.id = e.reviewer_profile_id
     WHERE ${exactClauses}
     ORDER BY e.course_id, e.revision, e.item_id, e.sequence`,
  ).bind(...bindings).all<ReviewEventRow>();
  const rows = result.results ?? [];
  return reviewable.flatMap(({ course, ref }) => (course.contentPackages?.reviewQueue ?? []).map((item) => {
    const history = rows
      .filter((row) => sameExactRow(row, ref) && row.item_id === item.id)
      .map(toEventSummary);
    return reviewState(course, ref, item, history);
  }));
}

export async function recordCourseContentReviewEvent(
  db: ClassroomD1,
  input: RecordCourseContentReviewInput,
  reviewerProfileId: string,
  now = Date.now(),
): Promise<CourseContentReviewState> {
  const normalized = normalizeInput(input);
  const reviewerId = requiredText(reviewerProfileId, 128, "COURSE_REVIEW_REVIEWER_REQUIRED", "审核账号不能为空。");
  const idempotent = await loadIdempotencyEvent(db, reviewerId, normalized.idempotencyKey);
  if (idempotent) return resolveIdempotentResult(db, normalized, idempotent);

  const version = await loadExactReviewableVersion(db, normalized.courseRef);
  const item = version.course.contentPackages?.reviewQueue.find((candidate) => candidate.id === normalized.itemId);
  if (!item) throw new ClassroomError("COURSE_REVIEW_ITEM_NOT_FOUND", "这个待核对项不属于所选 exact 课程版本。", 404);
  const existing = await listCourseContentReviewStates(db, [version]);
  const current = existing.find((state) => state.item.id === normalized.itemId)!;
  if (current.nextSequence - 1 !== normalized.expectedSequence) {
    throw new ClassroomError(
      "COURSE_REVIEW_SEQUENCE_CONFLICT",
      "这条审核记录刚刚被其他导师更新；页面不会覆盖对方的决定，请刷新后再处理。",
      409,
      [`当前序号 ${current.nextSequence - 1}，提交基线 ${normalized.expectedSequence}`],
    );
  }
  assertAllowedTransition(current, normalized);

  const eventId = `course-review:${crypto.randomUUID()}`;
  const createdAt = validIso(now);
  const sequence = normalized.expectedSequence + 1;
  try {
    await db.prepare(
      `INSERT INTO course_content_review_events
       (id, course_id, revision, digest, item_id, sequence, action, disposition,
        note, source_ref, reviewer_profile_id, idempotency_key, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE COALESCE((
         SELECT MAX(sequence) FROM course_content_review_events
         WHERE course_id = ? AND revision = ? AND digest = ? AND item_id = ?
       ), 0) = ?`,
    ).bind(
      eventId,
      normalized.courseRef.courseId,
      normalized.courseRef.revision,
      normalized.courseRef.digest,
      normalized.itemId,
      sequence,
      normalized.action,
      normalized.disposition ?? null,
      normalized.note,
      normalized.sourceRef ?? "",
      reviewerId,
      normalized.idempotencyKey,
      createdAt,
      normalized.courseRef.courseId,
      normalized.courseRef.revision,
      normalized.courseRef.digest,
      normalized.itemId,
      normalized.expectedSequence,
    ).run();
  } catch (error) {
    const racedIdempotency = await loadIdempotencyEvent(db, reviewerId, normalized.idempotencyKey);
    if (racedIdempotency) return resolveIdempotentResult(db, normalized, racedIdempotency);
    if (isConstraintError(error)) {
      throw new ClassroomError("COURSE_REVIEW_SEQUENCE_CONFLICT", "审核记录发生并发更新，请刷新后重试。", 409);
    }
    throw error;
  }

  const inserted = await db.prepare(
    `SELECT e.*, p.nickname AS reviewer_display_name
     FROM course_content_review_events e JOIN profiles p ON p.id = e.reviewer_profile_id
     WHERE e.id = ?`,
  ).bind(eventId).first<ReviewEventRow>();
  if (!inserted) {
    const racedIdempotency = await loadIdempotencyEvent(db, reviewerId, normalized.idempotencyKey);
    if (racedIdempotency) return resolveIdempotentResult(db, normalized, racedIdempotency);
    throw new ClassroomError("COURSE_REVIEW_SEQUENCE_CONFLICT", "审核记录发生并发更新，请刷新后重试。", 409);
  }
  const updated = await listCourseContentReviewStates(db, [version]);
  return updated.find((state) => state.item.id === normalized.itemId)!;
}

/**
 * Authored open items are visible advisory work, not an automatic release
 * failure. A human can explicitly declare an item release-blocking by choosing
 * “需要修订”, and an explicit reopen remains blocking until another decision.
 */
export async function assertCourseContentReviewReleaseReady(
  db: ClassroomD1,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
): Promise<void> {
  const version = await loadExactReviewableVersion(db, ref);
  const states = await listCourseContentReviewStates(db, [version]);
  const blocking = states.filter((state) => state.releaseBlocking);
  if (blocking.length) {
    throw new ClassroomError(
      "COURSE_CONTENT_REVIEW_BLOCKED",
      "人工审核已明确标记需要修订或重新核对，暂不能发布这个 exact 版本。",
      409,
      blocking.map((state) => `${state.item.id} · ${state.item.title} · ${state.resolutionLabel}`),
    );
  }
}

function reviewState(
  course: CoursePackage,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
  item: CourseContentReviewItem,
  history: CourseContentReviewEventSummary[],
): CourseContentReviewState {
  const latest = history.at(-1);
  let state: CourseContentReviewStateCode = item.status === "resolved" ? "authored-resolved" : "pending";
  if (latest?.action === "reopen") state = "reopened";
  else if (latest?.disposition) state = latest.disposition;
  const releaseBlocking = state === "revision-required" || state === "reopened";
  const labels: Record<CourseContentReviewStateCode, string> = {
    pending: "待人工判断 · 提醒但不自动阻断",
    reopened: "已人工重开 · 阻断发布",
    "revision-required": "确认需要修订 · 阻断发布",
    "source-added": "已补来源 · 不是自动改写课程",
    "excluded-this-release": "本次明确排除 · 不代表已修复",
    "authored-resolved": "课程作者已标记解决",
  };
  return {
    courseRef: { courseId: ref.courseId, revision: ref.revision, digest: ref.digest },
    courseName: course.course.name,
    item,
    state,
    releaseBlocking,
    resolutionLabel: labels[state],
    nextSequence: history.length + 1,
    history,
  };
}

function toEventSummary(row: ReviewEventRow): CourseContentReviewEventSummary {
  if (row.action !== "decision" && row.action !== "reopen") throw new ClassroomError("COURSE_REVIEW_CORRUPT", "审核事件 action 无效。", 500);
  if (row.disposition !== null && !isDisposition(row.disposition)) throw new ClassroomError("COURSE_REVIEW_CORRUPT", "审核事件 disposition 无效。", 500);
  return {
    id: row.id,
    sequence: row.sequence,
    action: row.action,
    disposition: row.disposition,
    note: row.note,
    sourceRef: row.source_ref || null,
    reviewerDisplayName: row.reviewer_display_name || "已停用审核账号",
    createdAt: row.created_at,
  };
}

async function loadExactReviewableVersion(
  db: ClassroomD1,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
): Promise<CourseReviewableVersion> {
  const row = await db.prepare(
    `SELECT package_json FROM course_versions WHERE course_id = ? AND revision = ? AND digest = ?`,
  ).bind(ref.courseId, ref.revision, ref.digest).first<{ package_json: string }>();
  if (!row) throw new ClassroomError("COURSE_VERSION_NOT_FOUND", "找不到 exact 课程版本。", 404);
  let course: CoursePackage;
  try { course = validateCoursePackage(JSON.parse(row.package_json) as unknown); }
  catch { throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "课程审核目标不是有效 CourseDefinition。", 500); }
  if (await coursePackageDigest(course) !== ref.digest) throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "课程审核目标 digest 校验失败。", 500);
  return { course, ref: { courseId: ref.courseId, revision: ref.revision, digest: ref.digest } };
}

async function loadIdempotencyEvent(db: ClassroomD1, reviewerProfileId: string, idempotencyKey: string): Promise<ReviewEventRow | null> {
  return db.prepare(
    `SELECT e.*, p.nickname AS reviewer_display_name
     FROM course_content_review_events e JOIN profiles p ON p.id = e.reviewer_profile_id
     WHERE e.reviewer_profile_id = ? AND e.idempotency_key = ?`,
  ).bind(reviewerProfileId, idempotencyKey).first<ReviewEventRow>();
}

async function resolveIdempotentResult(
  db: ClassroomD1,
  input: ReturnType<typeof normalizeInput>,
  event: ReviewEventRow,
): Promise<CourseContentReviewState> {
  if (
    event.course_id !== input.courseRef.courseId
    || event.revision !== input.courseRef.revision
    || event.digest !== input.courseRef.digest
    || event.item_id !== input.itemId
    || event.action !== input.action
    || event.disposition !== (input.disposition ?? null)
    || event.note !== input.note
    || event.source_ref !== (input.sourceRef ?? "")
  ) throw new ClassroomError("COURSE_REVIEW_IDEMPOTENCY_CONFLICT", "这个幂等键已用于另一条审核决定。", 409);
  const version = await loadExactReviewableVersion(db, input.courseRef);
  const states = await listCourseContentReviewStates(db, [version]);
  const state = states.find((item) => item.item.id === input.itemId);
  if (!state) throw new ClassroomError("COURSE_REVIEW_ITEM_NOT_FOUND", "审核项已不存在。", 404);
  return state;
}

function normalizeInput(input: RecordCourseContentReviewInput) {
  const courseId = requiredText(input.courseRef.courseId, 64, "COURSE_REVIEW_REF_INVALID", "courseId 无效。");
  const digest = requiredText(input.courseRef.digest, 64, "COURSE_REVIEW_REF_INVALID", "digest 无效。");
  if (!Number.isInteger(input.courseRef.revision) || input.courseRef.revision < 0 || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new ClassroomError("COURSE_REVIEW_REF_INVALID", "课程 exact 引用无效。", 400);
  }
  if (input.action !== "decision" && input.action !== "reopen") throw new ClassroomError("COURSE_REVIEW_ACTION_INVALID", "请选择审核决定或显式重开。", 400);
  const disposition = input.disposition;
  if (input.action === "decision" && !isDisposition(disposition)) throw new ClassroomError("COURSE_REVIEW_DISPOSITION_REQUIRED", "请选择明确处置。", 400);
  if (input.action === "reopen" && disposition !== undefined) throw new ClassroomError("COURSE_REVIEW_DISPOSITION_INVALID", "重开操作不能同时填写处置结果。", 400);
  const sourceRef = input.sourceRef ? requiredText(input.sourceRef, 512, "COURSE_REVIEW_SOURCE_INVALID", "来源引用无效。") : undefined;
  if (disposition === "source-added" && !sourceRef) throw new ClassroomError("COURSE_REVIEW_SOURCE_REQUIRED", "选择“已补来源”时必须填写来源引用。", 400);
  if (disposition !== "source-added" && sourceRef) throw new ClassroomError("COURSE_REVIEW_SOURCE_NOT_ALLOWED", "只有“已补来源”处置可填写来源引用。", 400);
  if (!Number.isInteger(input.expectedSequence) || input.expectedSequence < 0) throw new ClassroomError("COURSE_REVIEW_SEQUENCE_INVALID", "审核序号无效。", 400);
  return {
    courseRef: { courseId, revision: input.courseRef.revision, digest },
    itemId: requiredText(input.itemId, 128, "COURSE_REVIEW_ITEM_INVALID", "待核对项 ID 无效。"),
    expectedSequence: input.expectedSequence,
    idempotencyKey: requiredText(input.idempotencyKey, 128, "COURSE_REVIEW_IDEMPOTENCY_REQUIRED", "幂等键不能为空。"),
    action: input.action,
    ...(disposition ? { disposition } : {}),
    note: requiredText(input.note, 500, "COURSE_REVIEW_NOTE_REQUIRED", "必须填写人工审核说明。"),
    ...(sourceRef ? { sourceRef } : {}),
  };
}

function assertAllowedTransition(state: CourseContentReviewState, input: ReturnType<typeof normalizeInput>): void {
  const terminal = state.state === "source-added" || state.state === "excluded-this-release" || state.state === "authored-resolved";
  if (input.action === "reopen" && !terminal) {
    throw new ClassroomError("COURSE_REVIEW_REOPEN_INVALID", "只有已经处置的项目可以显式重开。", 409);
  }
  if (input.action === "decision" && terminal) {
    throw new ClassroomError("COURSE_REVIEW_REOPEN_REQUIRED", "已经处置的项目必须先显式重开，不能静默覆盖人工结论。", 409);
  }
}

function requiredText(value: string, maximum: number, code: string, message: string): string {
  const normalized = stripControlCharacters(String(value ?? "")).trim();
  if (!normalized || normalized.length > maximum) throw new ClassroomError(code, message, 400);
  return normalized;
}

function stripControlCharacters(value: string): string {
  return [...value].filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("");
}

function validIso(value: number): string {
  const date = new Date(value);
  if (!Number.isFinite(value) || Number.isNaN(date.valueOf())) throw new ClassroomError("COURSE_REVIEW_TIME_INVALID", "审核时间无效。", 400);
  return date.toISOString();
}

function isDisposition(value: unknown): value is CourseContentReviewDisposition {
  return value === "revision-required" || value === "source-added" || value === "excluded-this-release";
}

function sameExactRow(row: ReviewEventRow, ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">): boolean {
  return row.course_id === ref.courseId && row.revision === ref.revision && row.digest === ref.digest;
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /constraint|unique|COURSE_CONTENT_REVIEW/i.test(message);
}
