import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { ClassroomError } from "../../../../lib/classroom-errors";
import {
  loadExactCourseCampaign,
  reconcileCourseCardGrantIds,
  stageAlphaCoursePackage,
} from "../../../../lib/course-registry";
import type { CoursePackageRef } from "../../../../lib/course-package";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1024 * 1024;

/** Preserve a live Alpha room while explicitly swapping its exact Candidate. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!(await validServiceKey(request.headers.get("x-msv-course-registry-key")))) {
      await request.body?.cancel().catch(() => undefined);
      return json(404, { ok: false, error: { code: "NOT_FOUND", message: "页面不存在。" } });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) {
      return json(413, { ok: false, error: { code: "BODY_TOO_LARGE", message: "Alpha 课程包不能超过 1 MB。" } });
    }
    const body = parseObject(raw);
    const runId = requiredText(body.runId, "runId", 128);
    const roomId = requiredText(body.roomId, "roomId", 128);
    const expected = parseRef(body.expectedRef, "expectedRef");

    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const ref = await stageAlphaCoursePackage(db, { course: body.course, ref: body.ref });
    if (ref.courseId !== expected.courseId) {
      throw new ClassroomError("ALPHA_COURSE_ID_CHANGED", "热刷新不能更换课程 ID；请新建 Run。", 409);
    }

    const active = await db.prepare(
      `SELECT a.room_id, a.course_id, a.revision, a.digest, r.chapter_id,
              b.course_id AS binding_course_id, b.revision AS binding_revision, b.digest AS binding_digest
       FROM alpha_run_rooms a
       JOIN rooms r ON r.id = a.room_id
       JOIN room_course_bindings b ON b.room_id = a.room_id
       WHERE a.run_id = ? AND a.room_id = ?`,
    ).bind(runId, roomId).first<{
      room_id: string; course_id: string; revision: number; digest: string; chapter_id: string;
      binding_course_id: string; binding_revision: number; binding_digest: string;
    }>();
    if (!active) throw new ClassroomError("ALPHA_RUN_ROOM_NOT_FOUND", "找不到这个 Alpha Run 对应的课堂。", 404);
    if (active.course_id !== expected.courseId || active.revision !== expected.revision || active.digest !== expected.digest) {
      throw new ClassroomError("ALPHA_REFRESH_CONFLICT", "Alpha 课堂已被其他刷新推进；请重新读取当前版本。", 409);
    }
    if (active.binding_course_id !== expected.courseId || active.binding_revision !== expected.revision
      || active.binding_digest !== expected.digest) {
      throw new ClassroomError("ALPHA_BINDING_DIVERGED", "Alpha Run 与课堂 exact 绑定不一致；已拒绝刷新，请检查审计记录。", 409);
    }

    const campaign = await loadExactCourseCampaign(db, ref);
    if (!campaign.chapters.some((chapter) => chapter.id === active.chapter_id)) {
      throw new ClassroomError("ALPHA_STRUCTURE_CHANGED", "新版课程缺少当前章节，不能保留 Run 进度。", 409);
    }

    const grants = await allRows<{
      id: string; chapter_id: string; team_id: string; card_id: string;
    }>(db.prepare(
      `SELECT id, chapter_id, team_id, card_id FROM card_grants
       WHERE room_id = ? ORDER BY chapter_id, team_id, granted_at, id`,
    ).bind(roomId));
    const replacements = reconcileCourseCardGrantIds(campaign, grants);
    const now = new Date().toISOString();
    // Every hand replacement is guarded by the same old exact reference as the
    // pointer compare-and-swap. D1 executes a batch atomically and in order, so
    // a concurrent refresh can neither rewrite hands nor leave one pointer on a
    // different version.
    const statements: D1PreparedStatement[] = replacements.map(({ id, cardId }) =>
      db.prepare(
        `UPDATE card_grants SET card_id = ?
         WHERE id = ? AND room_id = ?
           AND EXISTS (
             SELECT 1 FROM alpha_run_rooms
             WHERE run_id = ? AND room_id = ? AND course_id = ? AND revision = ? AND digest = ?
           )
           AND EXISTS (
             SELECT 1 FROM room_course_bindings
             WHERE room_id = ? AND course_id = ? AND revision = ? AND digest = ?
           )`,
      ).bind(
        cardId, id, roomId,
        runId, roomId, expected.courseId, expected.revision, expected.digest,
        roomId, expected.courseId, expected.revision, expected.digest,
      ),
    );
    statements.push(
      db.prepare(
        `UPDATE room_course_bindings SET revision = ?, digest = ?, bound_at = ?
         WHERE room_id = ? AND course_id = ? AND revision = ? AND digest = ?`,
      ).bind(ref.revision, ref.digest, now, roomId, expected.courseId, expected.revision, expected.digest),
      db.prepare(
        `UPDATE alpha_run_rooms SET revision = ?, digest = ?
         WHERE run_id = ? AND room_id = ? AND course_id = ? AND revision = ? AND digest = ?`,
      ).bind(ref.revision, ref.digest, runId, roomId, expected.courseId, expected.revision, expected.digest),
      db.prepare(
        `INSERT OR IGNORE INTO course_registry_events
         (id, type, course_id, revision, digest, actor, detail_json, created_at)
         SELECT ?, 'course.alpha-rebound', ?, ?, ?, 'alpha-controller', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM alpha_run_rooms
           WHERE run_id = ? AND room_id = ? AND course_id = ? AND revision = ? AND digest = ?
         ) AND EXISTS (
           SELECT 1 FROM room_course_bindings
           WHERE room_id = ? AND course_id = ? AND revision = ? AND digest = ?
         )`,
      ).bind(
        `course.alpha-rebound:${runId}:${ref.revision}:${ref.digest}`,
        ref.courseId,
        ref.revision,
        ref.digest,
        JSON.stringify({ runId, roomId, from: expected, replacedCardCount: replacements.length }),
        now,
        runId, roomId, ref.courseId, ref.revision, ref.digest,
        roomId, ref.courseId, ref.revision, ref.digest,
      ),
    );
    await db.batch(statements);

    // Verify the compare-and-swap actually changed both pointers.  D1 batch is
    // atomic, but UPDATE of zero rows is not an exception.
    const verified = await db.prepare(
      `SELECT a.revision, a.digest, b.revision AS binding_revision, b.digest AS binding_digest
       FROM alpha_run_rooms a JOIN room_course_bindings b ON b.room_id = a.room_id
       WHERE a.run_id = ? AND a.room_id = ?`,
    ).bind(runId, roomId).first<{
      revision: number; digest: string; binding_revision: number; binding_digest: string;
    }>();
    if (!verified || verified.revision !== ref.revision || verified.digest !== ref.digest
      || verified.binding_revision !== ref.revision || verified.binding_digest !== ref.digest) {
      throw new ClassroomError("ALPHA_REFRESH_CONFLICT", "Alpha 课程绑定未完成，最后完整版本仍可用。", 409);
    }
    return json(200, { ok: true, data: { roomId, runId, courseRef: ref, replacedCardCount: replacements.length } });
  } catch (error) {
    if (error instanceof ClassroomError) {
      return json(error.status, { ok: false, error: { code: error.code, message: error.message, details: error.details } });
    }
    console.error("[course-registry-alpha-rebind]", error);
    return json(500, { ok: false, error: { code: "INTERNAL_ERROR", message: "Alpha 课程热刷新没有完成。" } });
  }
}

function parseObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ClassroomError("INVALID_JSON", "Alpha 热刷新请求不是有效 JSON 对象。", 400);
  }
}

function parseRef(value: unknown, label: string): Pick<CoursePackageRef, "courseId" | "revision" | "digest"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("INVALID_INPUT", `${label} 格式无效。`, 400);
  const ref = value as Record<string, unknown>;
  const courseId = requiredText(ref.courseId, `${label}.courseId`, 64);
  const digest = requiredText(ref.digest, `${label}.digest`, 64);
  if (!Number.isInteger(ref.revision) || Number(ref.revision) < 0) throw new ClassroomError("INVALID_INPUT", `${label}.revision 格式无效。`, 400);
  return { courseId, revision: Number(ref.revision), digest };
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ClassroomError("INVALID_INPUT", `${label} 格式无效。`, 400);
  return value.trim();
}

async function allRows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

async function validServiceKey(candidate: string | null): Promise<boolean> {
  const expected = process.env.MSV_COURSE_REGISTRY_KEY;
  if (!expected || expected.length < 32 || !candidate || candidate.length < 32) return false;
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const a = new Uint8Array(left); const b = new Uint8Array(right);
  let different = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) different |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return different === 0;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" } });
}
