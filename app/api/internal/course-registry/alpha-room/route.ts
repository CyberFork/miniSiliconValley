import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { ClassroomError } from "../../../../lib/classroom-errors";
import { createClassroomRoom } from "../../../../lib/classroom-store";
import { stageAlphaCoursePackage } from "../../../../lib/course-registry";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    if (!(await validServiceKey(request.headers.get("x-msv-course-registry-key")))) {
      await request.body?.cancel().catch(() => undefined);
      return json(404, { ok: false, error: { code: "NOT_FOUND", message: "页面不存在。" } });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return json(413, { ok: false, error: { code: "BODY_TOO_LARGE", message: "Alpha 课程包不能超过 1 MB。" } });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return json(400, { ok: false, error: { code: "INVALID_JSON", message: "Alpha 建课请求不是有效 JSON 对象。" } });
    }
    const runId = requiredText(body.runId, "runId", 128);
    const dmUsername = requiredText(body.dmUsername, "dmUsername", 32).toLowerCase();
    const title = requiredText(body.title, "title", 60);
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const ref = await stageAlphaCoursePackage(db, { course: body.course, ref: body.ref });
    const existing = await db.prepare(
      `SELECT a.room_id, a.course_id, a.revision, a.digest, tai.public_id
       FROM alpha_run_rooms a
       JOIN teams t ON t.room_id = a.room_id
       JOIN team_access_ids tai ON tai.team_id = t.id
       WHERE a.run_id = ? ORDER BY t.created_at LIMIT 1`,
    ).bind(runId).first<{ room_id: string; course_id: string; revision: number; digest: string; public_id: string }>();
    if (existing) {
      if (existing.course_id !== ref.courseId || existing.revision !== ref.revision || existing.digest !== ref.digest) {
        throw new ClassroomError("ALPHA_RUN_COURSE_CONFLICT", "这个 Alpha Run 已绑定另一份不可变课程。请新建 Run。", 409);
      }
      return json(200, { ok: true, data: { roomId: existing.room_id, teamPublicId: existing.public_id, replayed: true, courseRef: ref } });
    }
    const dm = await db.prepare(
      `SELECT id, username, display_name, role FROM auth_users
       WHERE username = ? AND status = 'active' AND role IN ('admin','mentor') LIMIT 1`,
    ).bind(dmUsername).first<{ id: string; username: string; display_name: string; role: "admin" | "mentor" }>();
    if (!dm) throw new ClassroomError("ALPHA_DM_NOT_FOUND", "Alpha 主 DM 账号不存在或没有导师权限。", 404);
    const created = await createClassroomRoom(
      db,
      { userId: dm.id, username: dm.username, displayName: dm.display_name, platformRole: dm.role },
      title,
      ref.courseId,
      { courseRef: ref, alphaRunId: runId },
    );
    return json(200, { ok: true, data: { ...created, replayed: false, courseRef: ref } });
  } catch (error) {
    if (error instanceof ClassroomError) return json(error.status, { ok: false, error: { code: error.code, message: error.message, details: error.details } });
    console.error("[course-registry-alpha-room]", error);
    return json(500, { ok: false, error: { code: "INTERNAL_ERROR", message: "Alpha exact 课程建课没有完成。" } });
  }
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ClassroomError("INVALID_INPUT", `${label} 格式无效。`, 400);
  return value.trim();
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
