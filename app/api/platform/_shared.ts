import { ensureClassroomSchema, getClassroomDb } from "../../../db";
import { authenticateSession } from "../../lib/auth-store";
import type { AuthenticatedClassroomUser } from "../../lib/classroom-api";
import { ClassroomError } from "../../lib/classroom-errors";
import { AuthError } from "../../lib/auth-errors";

const MAX_PLATFORM_JSON_BYTES = 768 * 1024;

export async function withPlatformApi<T>(
  request: Request,
  work: (context: { db: ReturnType<typeof getClassroomDb>; user: AuthenticatedClassroomUser }) => Promise<T>,
): Promise<Response> {
  try {
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const session = await authenticateSession(db, request.headers.get("cookie"));
    if (!session) throw new ClassroomError("AUTH_REQUIRED", "请先登录 Mini Silicon Valley 账号。", 401);
    if (session.mustChangePassword) throw new ClassroomError("PASSWORD_CHANGE_REQUIRED", "请先在账户中心修改一次性初始密码。", 403);
    const data = await work({
      db,
      user: { userId: session.userId, username: session.username, displayName: session.displayName, platformRole: session.role },
    });
    return response({ ok: true, data }, 200);
  } catch (error) {
    if (error instanceof ClassroomError || error instanceof AuthError) {
      return response({ ok: false, error: { code: error.code, message: error.message, ...(error instanceof ClassroomError && error.details ? { details: error.details } : {}) } }, error.status);
    }
    console.error("[platform-api]", error);
    return response({ ok: false, error: { code: "INTERNAL_ERROR", message: "平台暂时没有完成这次操作，请稍后重试。" } }, 500);
  }
}

export async function readPlatformJson(request: Request): Promise<unknown> {
  assertSameOrigin(request);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new ClassroomError("JSON_REQUIRED", "请求必须使用 application/json。", 415);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_PLATFORM_JSON_BYTES) throw new ClassroomError("BODY_TOO_LARGE", "请求不能超过 768 KiB。", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PLATFORM_JSON_BYTES) throw new ClassroomError("BODY_TOO_LARGE", "请求不能超过 768 KiB。", 413);
  try { return JSON.parse(raw) as unknown; }
  catch { throw new ClassroomError("INVALID_JSON", "请求内容不是有效 JSON。", 400); }
}

export function requireStudioRole(user: AuthenticatedClassroomUser): void {
  if (user.platformRole !== "admin" && user.platformRole !== "mentor") throw new ClassroomError("STUDIO_ROLE_REQUIRED", "Course Studio 只对导师和管理员开放。", 403);
}

export function requirePlatformAdmin(user: AuthenticatedClassroomUser): void {
  if (user.platformRole !== "admin") throw new ClassroomError("PLATFORM_ADMIN_REQUIRED", "此操作需要平台管理员权限。", 403);
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const trusted = forwardedHost && (forwardedProto === "https" || forwardedProto === "http") ? `${forwardedProto}://${forwardedHost}` : url.origin;
  if (origin !== trusted) throw new ClassroomError("ORIGIN_FORBIDDEN", "写操作只接受同源请求。", 403);
}

function response(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
