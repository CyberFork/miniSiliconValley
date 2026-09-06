import type { ClassroomD1 } from "../../db";
import { ClassroomError } from "./classroom-errors";
import {
  bundledCoursePackages,
  coursePackageDigest,
  projectCoursePackageToCampaign,
  validateCoursePackage,
  type CoursePackageRef,
} from "./course-package";
import type { ClassroomCampaign } from "./classroom-model";

export interface CourseReleaseApproval {
  schemaVersion: number;
  courseId: string;
  revision: number;
  digest: string;
  status: "approved";
  runId: string;
  runDigest: string;
  acceptedAt: string;
  acceptedBy: string;
  checks?: Record<string, unknown>;
}

export async function stageAlphaCoursePackage(
  db: ClassroomD1,
  input: { course: unknown; ref: unknown },
  actor = "alpha-controller",
): Promise<CoursePackageRef> {
  const course = validateCoursePackage(input.course);
  const rawRef = object(input.ref, "ref");
  const courseId = string(rawRef.courseId, "ref.courseId");
  const revision = integer(rawRef.revision, "ref.revision", 0);
  const digest = string(rawRef.digest, "ref.digest");
  if (!new Set(["candidate", "released"]).has(String(rawRef.status))) {
    throw new ClassroomError("COURSE_REF_INVALID", "Alpha 只接收 Candidate 或内置 Released 基线。", 400);
  }
  const actual = await coursePackageDigest(course);
  if (course.course.id !== courseId || course.schemaVersion !== rawRef.schemaVersion || actual !== digest) {
    throw new ClassroomError("COURSE_REF_MISMATCH", "Alpha 课程正文与 exact 引用不匹配。", 409);
  }
  const existing = await db.prepare(
    `SELECT digest, package_json FROM course_versions WHERE course_id = ? AND revision = ?`,
  ).bind(courseId, revision).first<{ digest: string; package_json: string }>();
  if (existing && (existing.digest !== digest || await digestFromJson(existing.package_json) !== digest)) {
    throw new ClassroomError("COURSE_REVISION_IMMUTABLE", `课程 ${courseId} r${revision} 已存在且内容不同。`, 409);
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO course_versions
       (course_id, revision, schema_version, digest, package_json, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(courseId, revision, course.schemaVersion, digest, JSON.stringify(course), typeof rawRef.createdAt === "string" ? rawRef.createdAt : now, actor),
    eventStatement(db, "course.alpha-staged", courseId, revision, digest, actor, {}, now),
  ]);
  return {
    courseId,
    schemaVersion: course.schemaVersion,
    revision,
    digest,
    status: rawRef.status === "released" ? "released" : "candidate",
    createdAt: typeof rawRef.createdAt === "string" ? rawRef.createdAt : now,
    createdBy: typeof rawRef.createdBy === "string" ? rawRef.createdBy : actor,
  };
}

type CourseVersionRow = {
  course_id: string;
  revision: number;
  schema_version: number;
  digest: string;
  package_json: string;
  created_at: string;
  created_by: string;
};

type ReleasedPointerRow = CourseVersionRow & {
  released_at: string;
  released_by: string;
  approval_json: string;
};

export async function ensureBundledCourseRegistry(db: ClassroomD1): Promise<void> {
  const now = "2026-09-06T00:00:00Z";
  for (const course of bundledCoursePackages()) {
    const digest = await coursePackageDigest(course);
    const ref: CoursePackageRef = {
      courseId: course.course.id,
      schemaVersion: course.schemaVersion,
      revision: 0,
      digest,
      status: "released",
      createdAt: now,
      createdBy: "bundled",
      releasedAt: now,
      releasedBy: "bundled",
      approvalRunId: null,
    };
    const existing = await db.prepare(
      `SELECT digest, package_json FROM course_versions WHERE course_id = ? AND revision = 0`,
    ).bind(ref.courseId).first<{ digest: string; package_json: string }>();
    if (existing && (existing.digest !== digest || await digestFromJson(existing.package_json) !== digest)) {
      throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `内置课程 ${ref.courseId} r0 与注册表内容不一致。`, 500);
    }
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO course_versions
         (course_id, revision, schema_version, digest, package_json, created_at, created_by)
         VALUES (?, 0, ?, ?, ?, ?, 'bundled')`,
      ).bind(ref.courseId, ref.schemaVersion, digest, JSON.stringify(course), now),
      db.prepare(
        `INSERT OR IGNORE INTO course_release_pointers
         (course_id, revision, digest, released_at, released_by, approval_json)
         VALUES (?, 0, ?, ?, 'bundled', '{}')`,
      ).bind(ref.courseId, digest, now),
      eventStatement(db, "course.bootstrap", ref.courseId, 0, digest, "bundled", { source: "bundled" }, now),
    ]);
  }
}

export async function publishReleasedCoursePackage(
  db: ClassroomD1,
  input: { course: unknown; ref: unknown; approval: unknown },
  actor = "alpha-controller",
): Promise<CoursePackageRef> {
  const course = validateCoursePackage(input.course);
  const rawRef = object(input.ref, "ref");
  const approval = object(input.approval, "approval") as unknown as CourseReleaseApproval;
  const revision = integer(rawRef.revision, "ref.revision", 1);
  const courseId = string(rawRef.courseId, "ref.courseId");
  const digest = string(rawRef.digest, "ref.digest");
  if (rawRef.status !== "released") throw new ClassroomError("COURSE_REF_INVALID", "正式课堂只接收 Released 引用。", 400);
  if (course.course.id !== courseId || course.schemaVersion !== rawRef.schemaVersion) {
    throw new ClassroomError("COURSE_REF_MISMATCH", "课程正文与发布引用不匹配。", 409);
  }
  const actualDigest = await coursePackageDigest(course);
  if (actualDigest !== digest) throw new ClassroomError("COURSE_DIGEST_MISMATCH", "课程正文 digest 与发布引用不一致。", 409);
  if (
    approval.status !== "approved"
    || approval.courseId !== courseId
    || approval.revision !== revision
    || approval.digest !== digest
    || approval.runDigest !== digest
    || !approval.runId
  ) {
    throw new ClassroomError("ALPHA_APPROVAL_MISMATCH", "Alpha 验收回执没有绑定这个 exact Candidate。", 409);
  }
  const existing = await db.prepare(
    `SELECT digest, package_json FROM course_versions WHERE course_id = ? AND revision = ?`,
  ).bind(courseId, revision).first<{ digest: string; package_json: string }>();
  if (existing && (existing.digest !== digest || await digestFromJson(existing.package_json) !== digest)) {
    throw new ClassroomError("COURSE_REVISION_IMMUTABLE", `课程 ${courseId} r${revision} 已存在且内容不同。`, 409);
  }
  const current = await db.prepare(
    `SELECT revision, digest FROM course_release_pointers WHERE course_id = ?`,
  ).bind(courseId).first<{ revision: number; digest: string }>();
  if (current && current.revision > revision) {
    throw new ClassroomError("COURSE_RELEASE_ROLLBACK", "禁止把正式课堂发布指针静默回退到较旧 revision。", 409);
  }
  if (current && current.revision === revision && current.digest !== digest) {
    throw new ClassroomError("COURSE_REVISION_IMMUTABLE", "同一正式 revision 不能指向另一份内容。", 409);
  }
  const releasedAt = typeof rawRef.releasedAt === "string" ? rawRef.releasedAt : new Date().toISOString();
  const releasedBy = typeof rawRef.releasedBy === "string" ? rawRef.releasedBy : actor;
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO course_versions
       (course_id, revision, schema_version, digest, package_json, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      courseId,
      revision,
      course.schemaVersion,
      digest,
      JSON.stringify(course),
      typeof rawRef.createdAt === "string" ? rawRef.createdAt : releasedAt,
      typeof rawRef.createdBy === "string" ? rawRef.createdBy : actor,
    ),
    db.prepare(
      `INSERT INTO course_release_pointers
       (course_id, revision, digest, released_at, released_by, approval_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(course_id) DO UPDATE SET
         revision = excluded.revision,
         digest = excluded.digest,
         released_at = excluded.released_at,
         released_by = excluded.released_by,
         approval_json = excluded.approval_json`,
    ).bind(courseId, revision, digest, releasedAt, releasedBy, JSON.stringify(approval)),
    eventStatement(db, "course.released", courseId, revision, digest, actor, { runId: approval.runId, previous: current ?? null }, releasedAt),
  ]);
  return {
    courseId,
    schemaVersion: course.schemaVersion,
    revision,
    digest,
    status: "released",
    createdAt: typeof rawRef.createdAt === "string" ? rawRef.createdAt : releasedAt,
    createdBy: typeof rawRef.createdBy === "string" ? rawRef.createdBy : actor,
    releasedAt,
    releasedBy,
    approvalRunId: approval.runId,
  };
}

export async function listReleasedCourseCampaigns(db: ClassroomD1): Promise<ClassroomCampaign[]> {
  await ensureBundledCourseRegistry(db);
  const rows = await allRows<ReleasedPointerRow>(
    db.prepare(
      `SELECT v.*, p.released_at, p.released_by, p.approval_json
       FROM course_release_pointers p
       JOIN course_versions v ON v.course_id = p.course_id AND v.revision = p.revision AND v.digest = p.digest
       ORDER BY v.course_id`,
    ),
  );
  const result: ClassroomCampaign[] = [];
  for (const row of rows) result.push(await campaignFromRow(row));
  return result;
}

export async function loadReleasedCourseCampaign(db: ClassroomD1, courseId: string): Promise<ClassroomCampaign> {
  await ensureBundledCourseRegistry(db);
  const row = await db.prepare(
    `SELECT v.*, p.released_at, p.released_by, p.approval_json
     FROM course_release_pointers p
     JOIN course_versions v ON v.course_id = p.course_id AND v.revision = p.revision AND v.digest = p.digest
     WHERE p.course_id = ?`,
  ).bind(courseId).first<ReleasedPointerRow>();
  if (!row) throw new ClassroomError("COURSE_NOT_RELEASED", `课程 ${courseId} 尚未发布到正式课堂。`, 404);
  return campaignFromRow(row);
}

export async function loadExactCourseCampaign(
  db: ClassroomD1,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
): Promise<ClassroomCampaign> {
  const row = await db.prepare(
    `SELECT v.*, '' AS released_at, 'alpha-binding' AS released_by, '{}' AS approval_json
     FROM course_versions v
     WHERE v.course_id = ? AND v.revision = ? AND v.digest = ?`,
  ).bind(ref.courseId, ref.revision, ref.digest).first<ReleasedPointerRow>();
  if (!row) throw new ClassroomError("COURSE_VERSION_NOT_FOUND", `找不到 exact 课程 ${ref.courseId} r${ref.revision}。`, 404);
  return campaignFromRow(row, "candidate");
}

export async function loadRoomCourseCampaign(
  db: ClassroomD1,
  room: { id: string; campaign_id: string },
): Promise<{ campaign: ClassroomCampaign; legacy: boolean }> {
  const binding = await db.prepare(
    `SELECT b.course_id, b.revision, b.digest, v.schema_version, v.package_json,
            v.created_at, v.created_by, b.bound_at
     FROM room_course_bindings b
     JOIN course_versions v ON v.course_id = b.course_id AND v.revision = b.revision AND v.digest = b.digest
     WHERE b.room_id = ?`,
  ).bind(room.id).first<{
    course_id: string;
    revision: number;
    digest: string;
    schema_version: number;
    package_json: string;
    created_at: string;
    created_by: string;
    bound_at: string;
  }>();
  if (!binding) {
    // Only pre-registry rooms may use the legacy compatibility adapter. New
    // rooms always receive a binding in the same atomic batch as room.create.
    const legacy = await import("../data/classroom-campaigns");
    const campaign = legacy.getClassroomCampaign(room.campaign_id);
    if (!campaign) throw new ClassroomError("ROOM_COURSE_BINDING_MISSING", "课堂缺少可读取的课程版本绑定。", 500);
    return { campaign, legacy: true };
  }
  const row: ReleasedPointerRow = {
    course_id: binding.course_id,
    revision: binding.revision,
    schema_version: binding.schema_version,
    digest: binding.digest,
    package_json: binding.package_json,
    created_at: binding.created_at,
    created_by: binding.created_by,
    released_at: binding.bound_at,
    released_by: "room-binding",
    approval_json: "{}",
  };
  return { campaign: await campaignFromRow(row, "released"), legacy: false };
}

export function bindRoomCourseStatement(
  db: ClassroomD1,
  roomId: string,
  campaign: ClassroomCampaign,
  now: string,
): D1PreparedStatement {
  const ref = campaign.courseRef;
  if (!ref) throw new ClassroomError("COURSE_REF_MISSING", "新课堂必须绑定 exact Released 课程版本。", 500);
  return db.prepare(
    `INSERT INTO room_course_bindings (room_id, course_id, revision, digest, legacy_campaign_id, bound_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(roomId, ref.courseId, ref.revision, ref.digest, campaign.id, now);
}

export type ExistingCourseCardGrant = {
  id: string;
  chapter_id: string;
  team_id: string;
  card_id: string;
};

/**
 * Preserve every still-valid hand position during an explicit Alpha refresh.
 * Only card ids deleted by the author are filled from unused cards in the
 * corresponding new deck.  Read/published state and ownership live on the
 * grant row and are therefore never rewritten here.
 */
export function reconcileCourseCardGrantIds(
  campaign: ClassroomCampaign,
  grants: ExistingCourseCardGrant[],
): Array<{ id: string; cardId: string }> {
  const chapters = new Map(campaign.chapters.map((chapter) => [chapter.id, chapter]));
  const grouped = new Map<string, ExistingCourseCardGrant[]>();
  for (const grant of grants) {
    const key = `${grant.chapter_id}\u0000${grant.team_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), grant]);
  }
  const updates: Array<{ id: string; cardId: string }> = [];
  for (const group of grouped.values()) {
    const chapter = chapters.get(group[0].chapter_id);
    if (!chapter) throw new ClassroomError("ALPHA_STRUCTURE_CHANGED", "新版课程缺少已有手牌所在章节。", 409);
    const valid = new Set(chapter.infoCards.map((card) => card.id));
    const kept = new Set(group.filter((grant) => valid.has(grant.card_id)).map((grant) => grant.card_id));
    const available = chapter.infoCards.map((card) => card.id).filter((id) => !kept.has(id));
    for (const grant of group) {
      if (valid.has(grant.card_id)) continue;
      const cardId = available.shift();
      if (!cardId) throw new ClassroomError("ALPHA_DECK_TOO_SMALL", "新版卡组无法保留四人手牌数量。", 409);
      updates.push({ id: grant.id, cardId });
    }
  }
  return updates;
}

async function campaignFromRow(row: ReleasedPointerRow, status: "candidate" | "released" = "released"): Promise<ClassroomCampaign> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.package_json);
  } catch {
    throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `课程 ${row.course_id} r${row.revision} 正文不是有效 JSON。`, 500);
  }
  const course = validateCoursePackage(parsed);
  const actual = await coursePackageDigest(course);
  if (course.course.id !== row.course_id || actual !== row.digest) {
    throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `课程 ${row.course_id} r${row.revision} 未通过 digest 校验。`, 500);
  }
  return projectCoursePackageToCampaign(course, {
    courseId: row.course_id,
    schemaVersion: row.schema_version,
    revision: row.revision,
    digest: row.digest,
    status,
    createdAt: row.created_at,
    createdBy: row.created_by,
    releasedAt: row.released_at,
    releasedBy: row.released_by,
    approvalRunId: parseApprovalRunId(row.approval_json),
  });
}

async function digestFromJson(json: string): Promise<string> {
  try {
    return coursePackageDigest(validateCoursePackage(JSON.parse(json)));
  } catch {
    return "invalid";
  }
}

function parseApprovalRunId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { runId?: unknown };
    return typeof parsed.runId === "string" ? parsed.runId : null;
  } catch {
    return null;
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("COURSE_RELEASE_INVALID", `${label} 必须是对象。`, 400);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ClassroomError("COURSE_RELEASE_INVALID", `${label} 必须是非空文本。`, 400);
  return value;
}

function integer(value: unknown, label: string, minimum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum) throw new ClassroomError("COURSE_RELEASE_INVALID", `${label} 必须是不小于 ${minimum} 的整数。`, 400);
  return Number(value);
}

async function allRows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

function eventStatement(
  db: ClassroomD1,
  type: string,
  courseId: string,
  revision: number,
  digest: string,
  actor: string,
  detail: Record<string, unknown>,
  at: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT OR IGNORE INTO course_registry_events
     (id, type, course_id, revision, digest, actor, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(`${type}:${courseId}:${revision}:${digest}`, type, courseId, revision, digest, actor, JSON.stringify(detail), at);
}
