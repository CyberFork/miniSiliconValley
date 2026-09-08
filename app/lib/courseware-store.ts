import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import { CLASSROOM_MENTOR_ROLES, type ClassroomMentorRole, type ExactCoursewareRef } from "./classroom-factory";

export const MAX_COURSEWARE_HTML_BYTES = 512 * 1024;

export type CoursewareSummary = {
  packageId: string;
  slug: string;
  title: string;
  mentorRole: ClassroomMentorRole;
  ownerProfileId: string;
  status: "active" | "retired";
  latestRevision: number;
  latestDigest: string;
  releasedRevision: number | null;
  releasedDigest: string | null;
  contentKind: "inline-html" | "static-bundle";
  updatedAt: string;
};

export type CoursewareContent = ExactCoursewareRef & {
  title: string;
  ownerProfileId: string;
  contentKind: "inline-html" | "static-bundle";
  htmlContent: string | null;
  entryPath: string | null;
  released: boolean;
};

const SYSTEM_PROFILE = "system-courseware";
// These identifiers are validated again by build-chj-course.sh and the release
// packager. Including them in the canonical value means a classroom's exact
// P-courseware digest changes when (and only when) the pinned colleague source
// is deliberately upgraded; hashing the URL alone would not provide that
// invariant.
const PRODUCT_COURSEWARE_SOURCE_COMMIT = "679213a61b835335016eac7649213983a0e48489";
const PRODUCT_COURSEWARE_SOURCE_TREE = "3a041c4714190cc026f6de8e06e15cec0e5f765d";
const BUNDLED = [
  {
    id: "cw-product-mentor-foundations",
    slug: "product-mentor-foundations",
    title: "产品导师｜青少年 AI 创业营",
    role: "P" as const,
    kind: "static-bundle" as const,
    entryPath: "/courseware/product-mentor-foundations/",
    sourceIdentity: `${PRODUCT_COURSEWARE_SOURCE_COMMIT}:${PRODUCT_COURSEWARE_SOURCE_TREE}`,
    html: null,
  },
  {
    id: "cw-development-mentor-field-kit",
    slug: "development-mentor-field-kit",
    title: "开发导师｜MVP 实践工具包",
    role: "D" as const,
    kind: "inline-html" as const,
    entryPath: null,
    sourceIdentity: null,
    html: mentorFieldKit("D", "开发导师", "把想法变成最小可用的验证物", ["先说清最关键的使用动作", "只实现验证假设必须的部分", "记录技术限制，不替学生决定产品", "让学员亲手演示并收集失败点"]),
  },
  {
    id: "cw-market-mentor-field-kit",
    slug: "market-mentor-field-kit",
    title: "市场导师｜用户验证工具包",
    role: "M" as const,
    kind: "inline-html" as const,
    entryPath: null,
    sourceIdentity: null,
    html: mentorFieldKit("M", "市场导师", "用真实用户行动检验价值", ["区分‘喜欢’和‘愿意行动’", "写下触达对象、渠道和一句邀请", "只记录观察，不替用户解释", "用转化、拒绝理由和复访作为证据"]),
  },
  {
    id: "cw-operations-mentor-field-kit",
    slug: "operations-mentor-field-kit",
    title: "运营导师｜交付与增长工具包",
    role: "O" as const,
    kind: "inline-html" as const,
    entryPath: null,
    sourceIdentity: null,
    html: mentorFieldKit("O", "运营导师", "把一次成功变成可重复交付", ["画出从接单到交付的动作链", "标出等待、返工和责任断点", "收入、成本、现金和声望分开记", "每轮只优化一个最影响交付的环节"]),
  },
] as const;

function mentorFieldKit(code: string, name: string, promise: string, prompts: string[]): string {
  const items = prompts.map((prompt, index) => `<li><b>${index + 1}</b><span>${escapeHtml(prompt)}</span></li>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>html{background:#0c1b23;color:#fff7df;font-family:system-ui,"PingFang SC",sans-serif}body{margin:0;padding:clamp(24px,6vw,80px)}header{border-left:10px solid #e9b949;padding-left:24px}small{color:#67c6b8;font:800 14px ui-monospace;letter-spacing:.14em}h1{font-size:clamp(42px,8vw,92px);line-height:1;margin:16px 0}p{font-size:clamp(20px,3vw,34px);max-width:24em;line-height:1.5}ol{list-style:none;padding:0;display:grid;gap:16px;max-width:1000px}li{display:grid;grid-template-columns:56px 1fr;align-items:center;border:2px solid #405761;background:#132932;font-size:clamp(18px,2.4vw,28px)}li b{display:grid;place-items:center;align-self:stretch;background:#e9b949;color:#0c1b23}li span{padding:22px}</style></head><body><header><small>${code} · MENTOR FIELD KIT</small><h1>${name}</h1><p>${promise}</p></header><ol>${items}</ol></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function ensureBundledCourseware(db: ClassroomD1): Promise<void> {
  const now = "2026-09-08T00:00:00Z";
  await db.prepare(`INSERT OR IGNORE INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`).bind(SYSTEM_PROFILE, "MiniSV 课程组", now, now).run();
  for (const item of BUNDLED) {
    const canonical = item.kind === "inline-html"
      ? item.html!
      : `static-bundle:${item.entryPath}:${item.sourceIdentity}`;
    const digest = await sha256(canonical);
    const byteLength = new TextEncoder().encode(canonical).byteLength;
    const existing = await db.prepare(`SELECT digest FROM courseware_versions WHERE package_id = ? AND revision = 0`).bind(item.id).first<{ digest: string }>();
    if (existing && existing.digest !== digest) {
      throw new ClassroomError("COURSEWARE_REGISTRY_CORRUPT", `${item.slug} 内置 r0 与固定来源不一致；静态课件升级必须创建新 package 与新 URL，不能改写旧课堂引用。`, 500);
    }
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO courseware_packages
         (id, slug, title, mentor_role, owner_profile_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(item.id, item.slug, item.title, item.role, SYSTEM_PROFILE, now, now),
      db.prepare(
        `INSERT OR IGNORE INTO courseware_versions
         (package_id, revision, digest, content_kind, html_content, entry_path, byte_length, created_at, created_by_profile_id)
         VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(item.id, digest, item.kind, item.html, item.entryPath, byteLength, now, SYSTEM_PROFILE),
      db.prepare(
        `INSERT OR IGNORE INTO courseware_release_pointers
         (package_id, revision, digest, released_at, released_by_profile_id) VALUES (?, 0, ?, ?, ?)`,
      ).bind(item.id, digest, now, SYSTEM_PROFILE),
    ]);
  }
}

export async function listCourseware(db: ClassroomD1): Promise<CoursewareSummary[]> {
  await ensureBundledCourseware(db);
  const result = await db.prepare(
    `SELECT p.id AS package_id, p.slug, p.title, p.mentor_role, p.owner_profile_id, p.status, p.updated_at,
            v.revision AS latest_revision, v.digest AS latest_digest, v.content_kind,
            rp.revision AS released_revision, rp.digest AS released_digest
     FROM courseware_packages p
     JOIN courseware_versions v ON v.package_id = p.id
       AND v.revision = (SELECT MAX(v2.revision) FROM courseware_versions v2 WHERE v2.package_id = p.id)
     LEFT JOIN courseware_release_pointers rp ON rp.package_id = p.id
     ORDER BY CASE p.mentor_role WHEN 'P' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END, p.updated_at DESC`,
  ).all<{
    package_id: string; slug: string; title: string; mentor_role: ClassroomMentorRole; owner_profile_id: string;
    status: "active" | "retired"; updated_at: string; latest_revision: number; latest_digest: string;
    content_kind: "inline-html" | "static-bundle"; released_revision: number | null; released_digest: string | null;
  }>();
  return (result.results ?? []).map((row) => ({
    packageId: row.package_id,
    slug: row.slug,
    title: row.title,
    mentorRole: row.mentor_role,
    ownerProfileId: row.owner_profile_id,
    status: row.status,
    latestRevision: row.latest_revision,
    latestDigest: row.latest_digest,
    releasedRevision: row.released_revision,
    releasedDigest: row.released_digest,
    contentKind: row.content_kind,
    updatedAt: row.updated_at,
  }));
}

function requireCoursewareAuthor(user: AuthenticatedClassroomUser): void {
  if (user.platformRole !== "admin" && user.platformRole !== "mentor") {
    throw new ClassroomError("COURSEWARE_AUTHOR_REQUIRED", "只有导师或管理员可以管理课件。", 403);
  }
}

function parseMentorRole(value: unknown): ClassroomMentorRole {
  if (typeof value === "string" && (CLASSROOM_MENTOR_ROLES as readonly string[]).includes(value)) return value as ClassroomMentorRole;
  throw new ClassroomError("MENTOR_ROLE_INVALID", "导师角色必须是 P、D、M 或 O。", 400);
}

function validateHtml(html: string): void {
  const bytes = new TextEncoder().encode(html).byteLength;
  if (bytes < 32 || bytes > MAX_COURSEWARE_HTML_BYTES) throw new ClassroomError("COURSEWARE_SIZE_INVALID", `HTML 课件需为 32 B—${MAX_COURSEWARE_HTML_BYTES / 1024} KiB。`, 400);
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) throw new ClassroomError("COURSEWARE_HTML_INVALID", "请上传包含 html 与 body 的完整 HTML 文件。", 400);
  if (/<base[\s>]/i.test(html)) throw new ClassroomError("COURSEWARE_BASE_FORBIDDEN", "课件不能使用 base 标签。", 400);
}

export async function saveCoursewareVersion(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  input: { packageId?: string; slug: string; title: string; mentorRole: unknown; html: string },
): Promise<CoursewareContent> {
  requireCoursewareAuthor(user);
  const role = parseMentorRole(input.mentorRole);
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) throw new ClassroomError("COURSEWARE_SLUG_INVALID", "课件 slug 需为 2—64 位小写字母、数字或连字符。", 400);
  if (title.length < 2 || title.length > 100) throw new ClassroomError("COURSEWARE_TITLE_INVALID", "课件标题需为 2—100 个字符。", 400);
  validateHtml(input.html);
  const digest = await sha256(input.html);
  const now = new Date().toISOString();
  const existingPackage = input.packageId
    ? await db.prepare(
      `SELECT p.id, p.slug, p.title, p.owner_profile_id, p.mentor_role, p.status,
              EXISTS(SELECT 1 FROM courseware_versions v WHERE v.package_id = p.id AND v.content_kind = 'static-bundle') AS has_static_bundle
       FROM courseware_packages p WHERE p.id = ?`,
    ).bind(input.packageId).first<{
      id: string;
      slug: string;
      title: string;
      owner_profile_id: string;
      mentor_role: ClassroomMentorRole;
      status: "active" | "retired";
      has_static_bundle: number;
    }>()
    : null;
  if (input.packageId && !existingPackage) throw new ClassroomError("COURSEWARE_PACKAGE_NOT_FOUND", "找不到要更新的课件。", 404);
  if (existingPackage && user.platformRole !== "admin" && existingPackage.owner_profile_id !== user.userId) {
    throw new ClassroomError("COURSEWARE_EDIT_FORBIDDEN", "只能更新自己创建的课件。", 403);
  }
  if (existingPackage?.status !== undefined && existingPackage.status !== "active") {
    throw new ClassroomError("COURSEWARE_RETIRED", "已停用课件不能继续创建版本。", 409);
  }
  if (existingPackage?.has_static_bundle) {
    throw new ClassroomError("STATIC_COURSEWARE_IMMUTABLE", "同事原版静态课件只能通过固定源码构建流程更新，不能在网页中改写。", 409);
  }
  if (existingPackage && existingPackage.mentor_role !== role) throw new ClassroomError("COURSEWARE_ROLE_IMMUTABLE", "已创建课件不能更换导师角色。", 409);
  if (existingPackage && existingPackage.slug !== slug) throw new ClassroomError("COURSEWARE_SLUG_IMMUTABLE", "已创建课件的 URL slug 不可更换；如需新地址，请创建一套新课件。", 409);
  if (existingPackage && existingPackage.title !== title) throw new ClassroomError("COURSEWARE_TITLE_IMMUTABLE", "已创建课件的标题不可更换；如需新标题，请创建一套新课件。", 409);
  const packageId = existingPackage?.id ?? `cw_${crypto.randomUUID()}`;
  const last = existingPackage
    ? await db.prepare(`SELECT MAX(revision) AS revision FROM courseware_versions WHERE package_id = ?`).bind(packageId).first<{ revision: number | null }>()
    : null;
  const revision = (last?.revision ?? -1) + 1;
  const prior = await db.prepare(`SELECT revision FROM courseware_versions WHERE package_id = ? AND digest = ?`).bind(packageId, digest).first<{ revision: number }>();
  if (prior) return loadCoursewareExact(db, packageId, prior.revision, digest);
  await db.batch([
    ...(existingPackage ? [
      db.prepare(`UPDATE courseware_packages SET updated_at = ? WHERE id = ?`).bind(now, packageId),
    ] : [
      db.prepare(
        `INSERT INTO courseware_packages (id, slug, title, mentor_role, owner_profile_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(packageId, slug, title, role, user.userId, now, now),
    ]),
    db.prepare(
      `INSERT INTO courseware_versions
       (package_id, revision, digest, content_kind, html_content, entry_path, byte_length, created_at, created_by_profile_id)
       VALUES (?, ?, ?, 'inline-html', ?, NULL, ?, ?, ?)`,
    ).bind(packageId, revision, digest, input.html, new TextEncoder().encode(input.html).byteLength, now, user.userId),
  ]);
  return loadCoursewareExact(db, packageId, revision, digest);
}

export async function releaseCoursewareVersion(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  ref: Pick<ExactCoursewareRef, "packageId" | "revision" | "digest">,
): Promise<void> {
  requireCoursewareAuthor(user);
  const content = await loadCoursewareExact(db, ref.packageId, ref.revision, ref.digest);
  if (user.platformRole !== "admin" && content.ownerProfileId !== user.userId) throw new ClassroomError("COURSEWARE_RELEASE_FORBIDDEN", "只能发布自己创建的课件。", 403);
  const now = new Date().toISOString();
  const current = await db.prepare(`SELECT revision FROM courseware_release_pointers WHERE package_id = ?`).bind(ref.packageId).first<{ revision: number }>();
  if (current && current.revision > ref.revision) throw new ClassroomError("COURSEWARE_RELEASE_ROLLBACK", "不能把课件默认版本回退。", 409);
  await db.prepare(
    `INSERT INTO courseware_release_pointers (package_id, revision, digest, released_at, released_by_profile_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(package_id) DO UPDATE SET revision = excluded.revision, digest = excluded.digest,
       released_at = excluded.released_at, released_by_profile_id = excluded.released_by_profile_id`,
  ).bind(ref.packageId, ref.revision, ref.digest, now, user.userId).run();
}

export async function loadCoursewareBySlug(db: ClassroomD1, slug: string, revision?: number): Promise<CoursewareContent> {
  await ensureBundledCourseware(db);
  const row = revision === undefined
    ? await db.prepare(`SELECT p.id AS package_id, rp.revision, rp.digest FROM courseware_packages p JOIN courseware_release_pointers rp ON rp.package_id = p.id WHERE p.slug = ? AND p.status = 'active'`).bind(slug).first<{ package_id: string; revision: number; digest: string }>()
    : await db.prepare(`SELECT p.id AS package_id, v.revision, v.digest FROM courseware_packages p JOIN courseware_versions v ON v.package_id = p.id WHERE p.slug = ? AND v.revision = ? AND p.status = 'active'`).bind(slug, revision).first<{ package_id: string; revision: number; digest: string }>();
  if (!row) throw new ClassroomError("COURSEWARE_NOT_FOUND", "没有找到这个课件版本。", 404);
  return loadCoursewareExact(db, row.package_id, row.revision, row.digest);
}

export async function loadCoursewareExact(db: ClassroomD1, packageId: string, revision: number, digest: string): Promise<CoursewareContent> {
  await ensureBundledCourseware(db);
  const row = await db.prepare(
    `SELECT p.id AS package_id, p.slug, p.title, p.mentor_role, p.owner_profile_id,
            v.revision, v.digest, v.content_kind, v.html_content, v.entry_path,
            CASE WHEN rp.revision = v.revision AND rp.digest = v.digest THEN 1 ELSE 0 END AS released
     FROM courseware_packages p
     JOIN courseware_versions v ON v.package_id = p.id
     LEFT JOIN courseware_release_pointers rp ON rp.package_id = p.id
     WHERE p.id = ? AND v.revision = ? AND v.digest = ?`,
  ).bind(packageId, revision, digest).first<{
    package_id: string; slug: string; title: string; mentor_role: ClassroomMentorRole; owner_profile_id: string;
    revision: number; digest: string; content_kind: "inline-html" | "static-bundle"; html_content: string | null;
    entry_path: string | null; released: number;
  }>();
  if (!row) throw new ClassroomError("COURSEWARE_VERSION_NOT_FOUND", "找不到 exact 课件版本。", 404);
  return {
    packageId: row.package_id,
    slug: row.slug,
    title: row.title,
    mentorRole: row.mentor_role,
    ownerProfileId: row.owner_profile_id,
    revision: row.revision,
    digest: row.digest,
    contentKind: row.content_kind,
    htmlContent: row.html_content,
    entryPath: row.entry_path,
    released: Boolean(row.released),
  };
}

export function defaultCoursewareRefs(summaries: CoursewareSummary[]): ExactCoursewareRef[] {
  return CLASSROOM_MENTOR_ROLES.map((role) => {
    const summary = summaries.find((item) => item.mentorRole === role && item.releasedRevision !== null && item.releasedDigest);
    if (!summary) throw new ClassroomError("COURSEWARE_DEFAULT_MISSING", `${role} 导师缺少已发布默认课件。`, 409);
    return {
      mentorRole: role,
      packageId: summary.packageId,
      slug: summary.slug,
      revision: summary.releasedRevision!,
      digest: summary.releasedDigest!,
    };
  });
}

export async function coursewareBundleDigest(refs: ExactCoursewareRef[]): Promise<string> {
  // Never hash caller-dependent JavaScript property insertion order. Every
  // producer (factory request, DB projection, receipt) is normalized to this
  // exact field order before serialization.
  const ordered = CLASSROOM_MENTOR_ROLES.map((role) => {
    const ref = refs.find((item) => item.mentorRole === role);
    return ref ? {
      mentorRole: ref.mentorRole,
      packageId: ref.packageId,
      slug: ref.slug,
      revision: ref.revision,
      digest: ref.digest,
    } : null;
  });
  return sha256(JSON.stringify(ordered));
}
