import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureClassroomSchema, getClassroomDb } from "../../../db";
import type { ApiEnvelope, AuthenticatedClassroomUser } from "../../lib/classroom-api";
import { ClassroomError } from "../../lib/classroom-errors";

const MAX_JSON_BODY_BYTES = 32 * 1024;

export async function withClassroomApi<T>(
  work: (context: { db: ReturnType<typeof getClassroomDb>; user: AuthenticatedClassroomUser }) => Promise<T>,
): Promise<Response> {
  try {
    const identity = await getChatGPTUser();
    if (!identity) {
      return apiResponse<T>(
        {
          ok: false,
          error: {
            code: "AUTH_REQUIRED",
            message: process.env.MSV_SELF_HOSTED_AUTH === "app-session"
              ? "请先登录Mini Silicon Valley账号，再进入Young Builder课堂。"
              : process.env.MSV_SELF_HOSTED_AUTH === "proxy-basic"
              ? "请先使用团队测试账号登录Young Builder课堂。"
              : "请先使用你的ChatGPT账号登录Young Builder课堂。",
          },
        },
        401,
      );
    }

    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const data = await work({
      db,
      user: { userId: identity.userId, username: identity.username, displayName: identity.displayName, platformRole: identity.role },
    });
    return apiResponse({ ok: true, data }, 200);
  } catch (error) {
    if (error instanceof ClassroomError) {
      return apiResponse(
        {
          ok: false,
          error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
        },
        error.status,
      );
    }
    console.error("[classroom-api]", error);
    return apiResponse(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "课堂服务暂时没有完成这次操作，请稍后重试。" } },
      500,
    );
  }
}

export async function readJson(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (origin && origin !== trustedRequestOrigin(request)) {
    await drainRejectedBody(request);
    throw new ClassroomError("ORIGIN_FORBIDDEN", "课堂写操作只接受同源请求。", 403);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    await drainRejectedBody(request);
    throw new ClassroomError("JSON_REQUIRED", "请求必须使用application/json。", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    // workerd may recycle an isolate when a streaming request is rejected
    // without closing its body, which makes the following POST fail with 503.
    await drainRejectedBody(request);
    throw new ClassroomError("BODY_TOO_LARGE", "课堂请求不能超过32 KB。", 413);
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
      throw new ClassroomError("BODY_TOO_LARGE", "课堂请求不能超过32 KB。", 413);
    }
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof ClassroomError) throw error;
    throw new ClassroomError("INVALID_JSON", "请求内容不是有效JSON。", 400);
  }
}

async function drainRejectedBody(request: Request): Promise<void> {
  const reader = request.body?.getReader();
  if (!reader) return;
  let bytes = 0;
  try {
    while (bytes <= MAX_JSON_BODY_BYTES * 2) {
      const chunk = await reader.read();
      if (chunk.done) return;
      bytes += chunk.value.byteLength;
    }
    void reader.cancel().catch(() => undefined);
  } catch {
    // The 413 remains authoritative if the transport already closed the body.
  }
}

function trustedRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  if (
    (process.env.MSV_SELF_HOSTED_AUTH === "proxy-basic" || process.env.MSV_SELF_HOSTED_AUTH === "app-session")
    && forwardedHost
    && (forwardedProto === "https" || forwardedProto === "http")
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

function apiResponse<T>(body: ApiEnvelope<T>, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
