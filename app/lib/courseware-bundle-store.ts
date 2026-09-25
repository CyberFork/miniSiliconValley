import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import { CLASSROOM_MENTOR_ROLES, type ClassroomMentorRole } from "./classroom-factory";
import { loadCoursewareExact, requireCoursewareAuthor, type CoursewareContent } from "./courseware-store";

export const COURSEWARE_BUNDLE_CHUNK_BYTES = 180 * 1024;
export const COURSEWARE_BUNDLE_MAX_BYTES = 48 * 1024 * 1024;
export const COURSEWARE_BUNDLE_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const COURSEWARE_BUNDLE_MAX_FILES = 256;

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{1,63}$/;
const BLOCKED_BASENAMES = new Set([".env", ".env.local", ".ds_store", "id_rsa", "id_ed25519"]);
const BLOCKED_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "exe", "dll", "dylib", "so", "dmg", "pkg", "app", "pem", "key", "p12", "pfx"]);
const MEDIA_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4", webm: "video/webm",
};

export type BundleFileDeclaration = {
  path: string;
  byteLength: number;
  digest: string;
  mediaType?: string;
};

export type CoursewareBundleUpload = {
  uploadId: string;
  packageId: string | null;
  slug: string;
  title: string;
  mentorRole: ClassroomMentorRole;
  entryFile: string;
  fileCount: number;
  totalBytes: number;
  status: "uploading" | "finalized" | "duplicate" | "aborted";
  expiresAt: string;
};

type UploadRow = {
  id: string; package_id: string | null; slug: string; title: string; mentor_role: ClassroomMentorRole;
  owner_profile_id: string; entry_file: string; file_count: number; total_bytes: number;
  status: CoursewareBundleUpload["status"]; result_revision: number | null; result_digest: string | null; expires_at: string;
};

type FileRow = {
  path: string; media_type: string; byte_length: number; digest: string; chunk_count: number;
};

function fail(code: string, message: string, status = 400, details?: unknown): never {
  throw new ClassroomError(code, message, status, details === undefined ? [] : [typeof details === "string" ? details : JSON.stringify(details)]);
}

function utf8Bytes(value: string): Uint8Array { return new TextEncoder().encode(value); }

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function sha256Text(value: string): Promise<string> { return sha256Bytes(utf8Bytes(value)); }

function normalizePath(value: string): string {
  const path = value.trim();
  if (!path || path.length > 240 || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.includes("\0")) {
    fail("COURSEWARE_BUNDLE_PATH_INVALID", "资源路径必须是 1—240 位的相对 POSIX 路径。", 400, { path: value });
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith("."))) {
    fail("COURSEWARE_BUNDLE_PATH_INVALID", "资源路径不能包含空段、隐藏目录、. 或 ..。", 400, { path: value });
  }
  const basename = segments.at(-1)!.toLowerCase();
  const extension = basename.includes(".") ? basename.split(".").at(-1)! : "";
  if (BLOCKED_BASENAMES.has(basename) || BLOCKED_EXTENSIONS.has(extension)) {
    fail("COURSEWARE_BUNDLE_FILE_FORBIDDEN", "资源包不接受压缩包、可执行文件、证书、私钥或环境配置。请选择解压后的普通课件目录。", 400, { path });
  }
  if (!MEDIA_TYPES[extension]) fail("COURSEWARE_BUNDLE_FILE_TYPE_INVALID", `不支持资源类型：${basename}`, 400, { path });
  return segments.join("/");
}

function mediaTypeFor(path: string, declared?: string): string {
  const extension = path.toLowerCase().split(".").at(-1) ?? "";
  const expected = MEDIA_TYPES[extension];
  if (!expected) fail("COURSEWARE_BUNDLE_FILE_TYPE_INVALID", `不支持资源类型：${path}`);
  const bareDeclared = (declared ?? "").split(";", 1)[0].trim().toLowerCase();
  const bareExpected = expected.split(";", 1)[0];
  // Browsers frequently provide an empty or generic type. Never trust a
  // client-supplied executable MIME type over the extension allow-list.
  if (bareDeclared && bareDeclared !== "application/octet-stream" && bareDeclared !== bareExpected) {
    fail("COURSEWARE_BUNDLE_MIME_MISMATCH", `资源 ${path} 的类型与扩展名不一致。`, 400, { expected: bareExpected, received: bareDeclared });
  }
  return expected;
}

function parseRole(value: unknown): ClassroomMentorRole {
  if (typeof value === "string" && (CLASSROOM_MENTOR_ROLES as readonly string[]).includes(value)) return value as ClassroomMentorRole;
  return fail("MENTOR_ROLE_INVALID", "导师角色必须是 P、D、M 或 O。");
}

function assertPackageIdentity(slug: string, title: string): void {
  if (!SAFE_SLUG.test(slug)) fail("COURSEWARE_SLUG_INVALID", "课件 slug 需为 2—64 位小写字母、数字或连字符。");
  if (title.length < 2 || title.length > 100) fail("COURSEWARE_TITLE_INVALID", "课件标题需为 2—100 个字符。");
}

async function ownedUpload(db: ClassroomD1, user: AuthenticatedClassroomUser, uploadId: string, mustBeUploading = false): Promise<UploadRow> {
  requireCoursewareAuthor(user);
  const row = await db.prepare(
    `SELECT id, package_id, slug, title, mentor_role, owner_profile_id, entry_file, file_count,
            total_bytes, status, result_revision, result_digest, expires_at FROM courseware_bundle_uploads WHERE id = ?`,
  ).bind(uploadId).first<UploadRow>();
  if (!row) fail("COURSEWARE_BUNDLE_UPLOAD_NOT_FOUND", "找不到这次资源包上传。", 404);
  if (user.platformRole !== "admin" && row.owner_profile_id !== user.userId) fail("COURSEWARE_BUNDLE_UPLOAD_FORBIDDEN", "只能继续自己的资源包上传。", 403);
  if (mustBeUploading && row.status !== "uploading") fail("COURSEWARE_BUNDLE_UPLOAD_CLOSED", "这次资源包上传已经结束。", 409, { status: row.status });
  if (mustBeUploading && Date.parse(row.expires_at) <= Date.now()) fail("COURSEWARE_BUNDLE_UPLOAD_EXPIRED", "资源包上传已过期，请重新选择目录。", 410);
  return row;
}

export async function beginCoursewareBundleUpload(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  input: { packageId?: string; slug: string; title: string; mentorRole: unknown; entryFile: string; files: BundleFileDeclaration[] },
): Promise<CoursewareBundleUpload> {
  requireCoursewareAuthor(user);
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  const mentorRole = parseRole(input.mentorRole);
  assertPackageIdentity(slug, title);
  if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > COURSEWARE_BUNDLE_MAX_FILES) {
    fail("COURSEWARE_BUNDLE_FILE_COUNT_INVALID", `资源包需包含 1—${COURSEWARE_BUNDLE_MAX_FILES} 个文件。`);
  }
  const files = input.files.map((file) => {
    const path = normalizePath(file.path);
    if (!Number.isSafeInteger(file.byteLength) || file.byteLength < 1 || file.byteLength > COURSEWARE_BUNDLE_MAX_FILE_BYTES) {
      fail("COURSEWARE_BUNDLE_FILE_SIZE_INVALID", `单个资源需为 1 B—${COURSEWARE_BUNDLE_MAX_FILE_BYTES / 1024 / 1024} MiB。`, 400, { path });
    }
    const digest = file.digest.trim().toLowerCase();
    if (!SHA256.test(digest)) fail("COURSEWARE_BUNDLE_DIGEST_INVALID", `资源 ${path} 缺少有效 SHA-256。`);
    return { path, byteLength: file.byteLength, digest, mediaType: mediaTypeFor(path, file.mediaType) };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(files.map((file) => file.path)).size !== files.length) fail("COURSEWARE_BUNDLE_PATH_DUPLICATE", "资源包包含重复路径。");
  const totalBytes = files.reduce((sum, file) => sum + file.byteLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > COURSEWARE_BUNDLE_MAX_BYTES) {
    fail("COURSEWARE_BUNDLE_SIZE_INVALID", `资源包不能超过 ${COURSEWARE_BUNDLE_MAX_BYTES / 1024 / 1024} MiB。`);
  }
  const entryFile = normalizePath(input.entryFile);
  const entry = files.find((file) => file.path === entryFile);
  if (!entry || !entry.mediaType.startsWith("text/html")) fail("COURSEWARE_BUNDLE_ENTRY_INVALID", "入口必须是资源包中真实存在的 HTML 文件。");

  let packageId: string | null = null;
  if (input.packageId) {
    const existing = await db.prepare(
      `SELECT p.id, p.slug, p.title, p.mentor_role, p.owner_profile_id, p.status,
              EXISTS(SELECT 1 FROM courseware_versions v
                     LEFT JOIN courseware_bundle_versions bv ON bv.package_id = v.package_id AND bv.revision = v.revision
                     WHERE v.package_id = p.id AND v.content_kind = 'static-bundle' AND bv.package_id IS NULL) AS has_unmanaged_static,
              EXISTS(SELECT 1 FROM courseware_versions v WHERE v.package_id = p.id AND v.content_kind = 'inline-html') AS has_inline
       FROM courseware_packages p WHERE p.id = ?`,
    ).bind(input.packageId).first<{
      id: string; slug: string; title: string; mentor_role: ClassroomMentorRole; owner_profile_id: string;
      status: "active" | "retired"; has_unmanaged_static: number; has_inline: number;
    }>();
    if (!existing) fail("COURSEWARE_PACKAGE_NOT_FOUND", "找不到要更新的课件。", 404);
    if (user.platformRole !== "admin" && existing.owner_profile_id !== user.userId) fail("COURSEWARE_EDIT_FORBIDDEN", "只能更新自己创建的课件。", 403);
    if (existing.status !== "active") fail("COURSEWARE_RETIRED", "已停用课件不能继续创建版本。", 409);
    if (existing.has_unmanaged_static) fail("STATIC_COURSEWARE_IMMUTABLE", "代码构建的原版静态课件不可由网页上传覆盖；请创建新的课件 package。", 409);
    if (existing.has_inline) fail("COURSEWARE_CONTENT_KIND_IMMUTABLE", "单文件 HTML 与多文件资源包使用不同的不可变 package；请创建新的资源包课件。", 409);
    if (existing.slug !== slug || existing.title !== title || existing.mentor_role !== mentorRole) {
      fail("COURSEWARE_PACKAGE_IDENTITY_IMMUTABLE", "既有课件的标题、slug 与导师角色不可更换。", 409);
    }
    packageId = existing.id;
  } else {
    const collision = await db.prepare(`SELECT id FROM courseware_packages WHERE slug = ?`).bind(slug).first<{ id: string }>();
    if (collision) fail("COURSEWARE_SLUG_CONFLICT", "这个课件 URL slug 已被使用。", 409);
  }

  const uploadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO courseware_bundle_uploads
       (id, package_id, slug, title, mentor_role, owner_profile_id, entry_file, file_count,
        total_bytes, status, result_revision, result_digest, created_at, expires_at, finalized_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', NULL, NULL, ?, ?, NULL)`,
    ).bind(uploadId, packageId, slug, title, mentorRole, user.userId, entryFile, files.length, totalBytes, createdAt, expiresAt),
    ...files.map((file) => db.prepare(
      `INSERT INTO courseware_bundle_files
       (upload_id, path, media_type, byte_length, digest, chunk_count) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(uploadId, file.path, file.mediaType, file.byteLength, file.digest, Math.ceil(file.byteLength / COURSEWARE_BUNDLE_CHUNK_BYTES))),
  ]);
  return { uploadId, packageId, slug, title, mentorRole, entryFile, fileCount: files.length, totalBytes, status: "uploading", expiresAt };
}

function decodeBase64(value: string): Uint8Array {
  if (!value || value.length > Math.ceil(COURSEWARE_BUNDLE_CHUNK_BYTES / 3) * 4 + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    fail("COURSEWARE_BUNDLE_CHUNK_INVALID", "资源分块不是有效的 Base64。", 400);
  }
  let binary: string;
  try { binary = atob(value); }
  catch { return fail("COURSEWARE_BUNDLE_CHUNK_INVALID", "资源分块不是有效的 Base64。"); }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveCoursewareBundleChunk(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  uploadId: string,
  input: { path: string; chunkIndex: number; digest: string; dataBase64: string },
): Promise<{ accepted: true; duplicate: boolean; uploadedChunks: number; totalChunks: number }> {
  await ownedUpload(db, user, uploadId, true);
  const path = normalizePath(input.path);
  const file = await db.prepare(
    `SELECT path, media_type, byte_length, digest, chunk_count FROM courseware_bundle_files WHERE upload_id = ? AND path = ?`,
  ).bind(uploadId, path).first<FileRow>();
  if (!file) fail("COURSEWARE_BUNDLE_FILE_NOT_DECLARED", "资源分块不属于已声明的文件。", 404, { path });
  if (!Number.isSafeInteger(input.chunkIndex) || input.chunkIndex < 0 || input.chunkIndex >= file.chunk_count) {
    fail("COURSEWARE_BUNDLE_CHUNK_INDEX_INVALID", "资源分块序号超出声明范围。", 400, { path, chunkIndex: input.chunkIndex });
  }
  const digest = input.digest.trim().toLowerCase();
  if (!SHA256.test(digest)) fail("COURSEWARE_BUNDLE_DIGEST_INVALID", "资源分块缺少有效 SHA-256。");
  const bytes = decodeBase64(input.dataBase64);
  const expectedLength = input.chunkIndex === file.chunk_count - 1
    ? file.byte_length - COURSEWARE_BUNDLE_CHUNK_BYTES * (file.chunk_count - 1)
    : COURSEWARE_BUNDLE_CHUNK_BYTES;
  if (bytes.byteLength !== expectedLength) fail("COURSEWARE_BUNDLE_CHUNK_SIZE_MISMATCH", "资源分块长度与清单不一致。", 409, { expectedLength, actualLength: bytes.byteLength });
  if (await sha256Bytes(bytes) !== digest) fail("COURSEWARE_BUNDLE_CHUNK_DIGEST_MISMATCH", "资源分块 SHA-256 校验失败。", 409);
  const existing = await db.prepare(
    `SELECT byte_length, digest, data_base64 FROM courseware_bundle_chunks
     WHERE upload_id = ? AND path = ? AND chunk_index = ?`,
  ).bind(uploadId, path, input.chunkIndex).first<{ byte_length: number; digest: string; data_base64: string }>();
  let duplicate = false;
  if (existing) {
    if (existing.byte_length !== bytes.byteLength || existing.digest !== digest || existing.data_base64 !== input.dataBase64) {
      fail("COURSEWARE_BUNDLE_CHUNK_CONFLICT", "相同分块序号已经保存了不同内容，请重新开始上传。", 409);
    }
    duplicate = true;
  } else {
    await db.prepare(
      `INSERT INTO courseware_bundle_chunks
       (upload_id, path, chunk_index, byte_length, digest, data_base64) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(uploadId, path, input.chunkIndex, bytes.byteLength, digest, input.dataBase64).run();
  }
  const progress = await db.prepare(
    `SELECT COUNT(*) AS uploaded, (SELECT SUM(chunk_count) FROM courseware_bundle_files WHERE upload_id = ?) AS total
     FROM courseware_bundle_chunks WHERE upload_id = ?`,
  ).bind(uploadId, uploadId).first<{ uploaded: number; total: number }>();
  return { accepted: true, duplicate, uploadedChunks: Number(progress?.uploaded ?? 0), totalChunks: Number(progress?.total ?? 0) };
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function finalizeCoursewareBundleUpload(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  uploadId: string,
): Promise<CoursewareContent & { treeDigest: string; manifest: BundleFileDeclaration[] }> {
  const upload = await ownedUpload(db, user, uploadId, false);
  if (upload.status === "finalized" || upload.status === "duplicate") {
    if (!upload.package_id || upload.result_revision === null || !upload.result_digest) fail("COURSEWARE_BUNDLE_FINALIZATION_CORRUPT", "资源包已结束但找不到不可变版本。", 500);
    const existing = await db.prepare(
      `SELECT manifest_json, tree_digest FROM courseware_bundle_versions WHERE package_id = ? AND revision = ? AND digest = ?`,
    ).bind(upload.package_id, upload.result_revision, upload.result_digest).first<{ manifest_json: string; tree_digest: string }>();
    if (!existing) fail("COURSEWARE_BUNDLE_FINALIZATION_CORRUPT", "资源包已结束但找不到不可变版本。", 500);
    return { ...(await loadCoursewareExact(db, upload.package_id, upload.result_revision, upload.result_digest)), treeDigest: existing.tree_digest, manifest: JSON.parse(existing.manifest_json) as BundleFileDeclaration[] };
  }
  if (upload.status !== "uploading") fail("COURSEWARE_BUNDLE_UPLOAD_CLOSED", "这次资源包上传已经结束。", 409);
  if (Date.parse(upload.expires_at) <= Date.now()) fail("COURSEWARE_BUNDLE_UPLOAD_EXPIRED", "资源包上传已过期，请重新选择目录。", 410);
  const fileResult = await db.prepare(
    `SELECT path, media_type, byte_length, digest, chunk_count FROM courseware_bundle_files WHERE upload_id = ? ORDER BY path`,
  ).bind(uploadId).all<FileRow>();
  const files = fileResult.results ?? [];
  if (files.length !== upload.file_count) fail("COURSEWARE_BUNDLE_MANIFEST_INCOMPLETE", "资源清单文件数不一致。", 409);
  const manifest: BundleFileDeclaration[] = [];
  for (const file of files) {
    const chunkResult = await db.prepare(
      `SELECT chunk_index, byte_length, digest, data_base64 FROM courseware_bundle_chunks
       WHERE upload_id = ? AND path = ? ORDER BY chunk_index`,
    ).bind(uploadId, file.path).all<{ chunk_index: number; byte_length: number; digest: string; data_base64: string }>();
    const rows = chunkResult.results ?? [];
    if (rows.length !== file.chunk_count || rows.some((row, index) => row.chunk_index !== index)) {
      fail("COURSEWARE_BUNDLE_CHUNKS_INCOMPLETE", `资源 ${file.path} 尚未完整上传。`, 409);
    }
    const chunks: Uint8Array[] = [];
    for (const row of rows) {
      const bytes = decodeBase64(row.data_base64);
      if (bytes.byteLength !== row.byte_length || await sha256Bytes(bytes) !== row.digest) {
        fail("COURSEWARE_BUNDLE_STORED_CHUNK_CORRUPT", `资源 ${file.path} 的已保存分块校验失败。`, 500);
      }
      chunks.push(bytes);
    }
    const bytes = concat(chunks, file.byte_length);
    if (await sha256Bytes(bytes) !== file.digest) fail("COURSEWARE_BUNDLE_FILE_DIGEST_MISMATCH", `资源 ${file.path} 的完整 SHA-256 校验失败。`, 409);
    manifest.push({ path: file.path, byteLength: file.byte_length, digest: file.digest, mediaType: file.media_type });
  }
  const manifestJson = JSON.stringify(manifest);
  const treeDigest = await sha256Text(JSON.stringify({ format: "minisv-courseware-bundle-v1", entryFile: upload.entry_file, files: manifest }));
  const digest = await sha256Text(`minisv-courseware-bundle-v1\n${treeDigest}\n${upload.entry_file}`);
  const now = new Date().toISOString();
  const packageId = upload.package_id ?? `cw_${crypto.randomUUID()}`;

  const prior = upload.package_id
    ? await db.prepare(
      `SELECT v.revision, v.digest, bv.tree_digest FROM courseware_versions v
       JOIN courseware_bundle_versions bv ON bv.package_id = v.package_id AND bv.revision = v.revision
       WHERE v.package_id = ? AND bv.tree_digest = ?`,
    ).bind(packageId, treeDigest).first<{ revision: number; digest: string; tree_digest: string }>()
    : null;
  if (prior) {
    // Reuse the immutable version instead of creating meaningless history. The
    // duplicate upload remains auditable but does not become another owner of
    // the stored bytes; its chunks may be retained until an explicit GC tool
    // is introduced.
    await db.prepare(
      `UPDATE courseware_bundle_uploads SET package_id = ?, status = 'duplicate', result_revision = ?, result_digest = ?, finalized_at = ?
       WHERE id = ? AND status = 'uploading'`,
    ).bind(packageId, prior.revision, prior.digest, now, uploadId).run();
    return { ...(await loadCoursewareExact(db, packageId, prior.revision, prior.digest)), treeDigest, manifest };
  }

  const latest = upload.package_id
    ? await db.prepare(`SELECT MAX(revision) AS revision FROM courseware_versions WHERE package_id = ?`).bind(packageId).first<{ revision: number | null }>()
    : null;
  const revision = (latest?.revision ?? -1) + 1;
  const entryPath = `/courseware-assets/${encodeURIComponent(packageId)}/${revision}/${digest}/${upload.entry_file.split("/").map(encodeURIComponent).join("/")}`;
  const statements: D1PreparedStatement[] = [
    ...(!upload.package_id ? [db.prepare(
      `INSERT INTO courseware_packages
       (id, slug, title, mentor_role, owner_profile_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(packageId, upload.slug, upload.title, upload.mentor_role, upload.owner_profile_id, now, now)] : [
      db.prepare(`UPDATE courseware_packages SET updated_at = ? WHERE id = ?`).bind(now, packageId),
    ]),
    db.prepare(
      `INSERT INTO courseware_versions
       (package_id, revision, digest, content_kind, html_content, entry_path, byte_length, created_at, created_by_profile_id)
       VALUES (?, ?, ?, 'static-bundle', NULL, ?, ?, ?, ?)`,
    ).bind(packageId, revision, digest, entryPath, upload.total_bytes, now, upload.owner_profile_id),
    db.prepare(
      `INSERT INTO courseware_bundle_versions
       (package_id, revision, digest, upload_id, entry_file, manifest_json, tree_digest, file_count, total_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(packageId, revision, digest, uploadId, upload.entry_file, manifestJson, treeDigest, upload.file_count, upload.total_bytes, now),
    db.prepare(
      `UPDATE courseware_bundle_uploads SET package_id = ?, status = 'finalized', result_revision = ?, result_digest = ?, finalized_at = ?
       WHERE id = ? AND status = 'uploading'`,
    ).bind(packageId, revision, digest, now, uploadId),
  ];
  try { await db.batch(statements); }
  catch (error) {
    console.error("[courseware-bundle-finalize]", error);
    fail("COURSEWARE_BUNDLE_FINALIZE_CONFLICT", "资源包版本在并发保存时发生冲突；原上传仍保留，可刷新后重试。", 409);
  }
  return { ...(await loadCoursewareExact(db, packageId, revision, digest)), treeDigest, manifest };
}

export async function loadCoursewareBundleAsset(
  db: ClassroomD1,
  ref: { packageId: string; revision: number; digest: string; path: string },
): Promise<{ bytes: Uint8Array; mediaType: string; digest: string }> {
  const path = normalizePath(ref.path);
  const file = await db.prepare(
    `SELECT f.media_type, f.byte_length, f.digest, f.chunk_count, bv.upload_id
     FROM courseware_bundle_versions bv
     JOIN courseware_bundle_files f ON f.upload_id = bv.upload_id
     WHERE bv.package_id = ? AND bv.revision = ? AND bv.digest = ? AND f.path = ?`,
  ).bind(ref.packageId, ref.revision, ref.digest, path).first<{ media_type: string; byte_length: number; digest: string; chunk_count: number; upload_id: string }>();
  if (!file) fail("COURSEWARE_BUNDLE_ASSET_NOT_FOUND", "找不到这个 exact 课件资源。", 404);
  const result = await db.prepare(
    `SELECT chunk_index, data_base64 FROM courseware_bundle_chunks
     WHERE upload_id = ? AND path = ? ORDER BY chunk_index`,
  ).bind(file.upload_id, path).all<{ chunk_index: number; data_base64: string }>();
  const rows = result.results ?? [];
  if (rows.length !== file.chunk_count || rows.some((row, index) => row.chunk_index !== index)) {
    fail("COURSEWARE_BUNDLE_ASSET_CORRUPT", "exact 课件资源分块不完整。", 500);
  }
  const bytes = concat(rows.map((row) => decodeBase64(row.data_base64)), file.byte_length);
  if (await sha256Bytes(bytes) !== file.digest) fail("COURSEWARE_BUNDLE_ASSET_CORRUPT", "exact 课件资源摘要不一致。", 500);
  return { bytes, mediaType: file.media_type, digest: file.digest };
}

export async function canReadCandidateBundle(
  db: ClassroomD1,
  user: { userId: string; role: string | null; classroomId?: string | null },
  content: CoursewareContent,
): Promise<boolean> {
  if (!user.classroomId && (user.role === "admin" || (user.role === "mentor" && content.ownerProfileId === user.userId))) return true;
  if (user.role !== "mentor" && user.role !== "learner") return false;
  const classroomClause = user.classroomId ? "AND ci.room_id = ?" : "";
  const row = await db.prepare(
    `SELECT 1 AS allowed
     FROM classroom_instances ci
     JOIN room_courseware_bindings b ON b.room_id = ci.room_id
     WHERE ci.environment = 'test' AND b.package_id = ? AND b.revision = ? AND b.digest = ? ${classroomClause}
       AND (
         EXISTS(SELECT 1 FROM memberships m WHERE m.room_id = ci.room_id AND m.profile_id = ? AND m.status = 'active')
         OR EXISTS(SELECT 1 FROM classroom_admin_dm_grants g WHERE g.room_id = ci.room_id AND g.profile_id = ? AND g.revoked_at IS NULL)
       ) LIMIT 1`,
  ).bind(content.packageId, content.revision, content.digest, ...(user.classroomId ? [user.classroomId] : []), user.userId, user.userId).first<{ allowed: number }>();
  return Boolean(row);
}
