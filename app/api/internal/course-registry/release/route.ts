import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { ClassroomError } from "../../../../lib/classroom-errors";
import { publishReleasedCoursePackage } from "../../../../lib/course-registry";

export const dynamic = "force-dynamic";

const MAX_RELEASE_BYTES = 1024 * 1024;

/** Loopback-only publication endpoint used by the Alpha controller. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!(await validServiceKey(request.headers.get("x-msv-course-registry-key")))) {
      await request.body?.cancel().catch(() => undefined);
      return response(404, { ok: false, error: { code: "NOT_FOUND", message: "页面不存在。" } });
    }
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declared) && declared > MAX_RELEASE_BYTES) {
      await request.body?.cancel().catch(() => undefined);
      return response(413, { ok: false, error: { code: "BODY_TOO_LARGE", message: "课程发布包不能超过 1 MB。" } });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_RELEASE_BYTES) {
      return response(413, { ok: false, error: { code: "BODY_TOO_LARGE", message: "课程发布包不能超过 1 MB。" } });
    }
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return response(400, { ok: false, error: { code: "INVALID_JSON", message: "课程发布包不是有效 JSON。" } });
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return response(400, { ok: false, error: { code: "INVALID_RELEASE", message: "课程发布请求必须是对象。" } });
    }
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const ref = await publishReleasedCoursePackage(
      db,
      input as { course: unknown; ref: unknown; approval: unknown },
      "alpha-controller",
    );
    return response(200, { ok: true, data: { releasedRef: ref } });
  } catch (error) {
    if (error instanceof ClassroomError) {
      return response(error.status, { ok: false, error: { code: error.code, message: error.message, details: error.details } });
    }
    console.error("[course-registry-release]", error);
    return response(500, { ok: false, error: { code: "INTERNAL_ERROR", message: "课程发布没有完成。" } });
  }
}

async function validServiceKey(candidate: string | null): Promise<boolean> {
  const expected = process.env.MSV_COURSE_REGISTRY_KEY;
  if (!expected || expected.length < 32 || !candidate || candidate.length < 32) return false;
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let different = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) different |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return different === 0;
}

function response(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
