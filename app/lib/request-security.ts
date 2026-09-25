import { AuthError } from "./auth-errors";

const MAX_AUTH_BODY_BYTES = 16 * 1024;

export async function readSecureJson(request: Request): Promise<Record<string, unknown>> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    await drainRequestBody(request);
    throw error;
  }
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    await drainRequestBody(request);
    throw new AuthError("JSON_REQUIRED", "请求必须使用 application/json。", 415);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_AUTH_BODY_BYTES) {
    await drainRequestBody(request);
    throw new AuthError("BODY_TOO_LARGE", "认证请求不能超过16 KB。", 413);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_AUTH_BODY_BYTES) {
    throw new AuthError("BODY_TOO_LARGE", "认证请求不能超过16 KB。", 413);
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as Record<string, unknown>;
  } catch {
    throw new AuthError("INVALID_JSON", "请求内容不是有效 JSON 对象。", 400);
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== trustedRequestOrigin(request)) {
    throw new AuthError("ORIGIN_FORBIDDEN", "认证操作只接受同源请求。", 403);
  }
}

export async function consumeEmptyMutation(request: Request): Promise<void> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    await drainRequestBody(request);
    throw error;
  }
  await drainRequestBody(request);
}

export function trustedRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const selfHosted = process.env.MSV_SELF_HOSTED_AUTH === "app-session" || process.env.MSV_SELF_HOSTED_AUTH === "proxy-basic";
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  // Hecate is a loopback-only origin behind our Nginx gateway. Trust the
  // gateway's host/scheme pair for same-origin validation regardless of
  // whether this is the current root deployment or the retired /msv adapter.
  if (selfHosted && forwardedHost && (forwardedProto === "https" || forwardedProto === "http")) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export function requestClientFingerprint(request: Request): string {
  const selfHosted = process.env.MSV_SELF_HOSTED_AUTH === "app-session" || process.env.MSV_SELF_HOSTED_AUTH === "proxy-basic";
  const forwarded = selfHosted ? request.headers.get("x-real-ip") : request.headers.get("cf-connecting-ip");
  return (forwarded?.slice(0, 96) || "local") + "|" + requestUserAgent(request).slice(0, 160);
}

export function requestUserAgent(request: Request): string {
  return Array.from(request.headers.get("user-agent") ?? "未知设备")
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join("")
    .slice(0, 240);
}

export async function drainRequestBody(request: Request): Promise<void> {
  const reader = request.body?.getReader();
  if (!reader) return;
  let bytes = 0;
  try {
    while (bytes <= MAX_AUTH_BODY_BYTES * 2) {
      const chunk = await reader.read();
      if (chunk.done) return;
      bytes += chunk.value.byteLength;
    }
    await reader.cancel();
  } catch {
    // The original validation error remains authoritative.
  }
}
