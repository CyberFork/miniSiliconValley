import { ensureClassroomSchema, getClassroomDb } from "../../../db";
import { AuthError } from "../../lib/auth-errors";
import type { AuthSessionUser } from "../../lib/auth-model";
import { authenticateSession } from "../../lib/auth-store";

export type AuthEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

export async function withAuthApi<T>(work: (db: ReturnType<typeof getClassroomDb>) => Promise<T | Response>): Promise<Response> {
  try {
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const value = await work(db);
    return value instanceof Response ? value : authResponse({ ok: true, data: value }, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      const headers = error.code === "RATE_LIMITED" && typeof error.details?.retryAfterSeconds === "number"
        ? { "Retry-After": String(error.details.retryAfterSeconds) }
        : undefined;
      return authResponse({ ok: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, error.status, headers);
    }
    console.error("[auth-api]", error);
    return authResponse({ ok: false, error: { code: "INTERNAL_ERROR", message: "账号服务暂时没有完成这次操作，请稍后再试。" } }, 500);
  }
}

export async function requireApiUser(db: ReturnType<typeof getClassroomDb>, request: Request): Promise<AuthSessionUser> {
  const user = await authenticateSession(db, request.headers.get("cookie"));
  if (!user) throw new AuthError("AUTH_REQUIRED", "请先登录。", 401);
  return user;
}

export function authResponse<T>(body: AuthEnvelope<T>, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, private");
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, { status, headers });
}
