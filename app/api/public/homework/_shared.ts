import { ensureClassroomSchema, getClassroomDb } from "../../../../db";
import { HomeworkError } from "../../../lib/homework-store";

const MAX_BODY_BYTES = 1_300_000;

export async function withPublicHomework<T>(work: (db: ReturnType<typeof getClassroomDb>) => Promise<T>): Promise<Response> {
  try {
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    return json({ ok: true, data: await work(db) }, 200);
  } catch (error) {
    if (error instanceof HomeworkError) return json({ ok: false, error: { code: error.code, message: error.message } }, error.status);
    console.error("[public-homework]", error);
    return json({ ok: false, error: { code: "HOMEWORK_UNAVAILABLE", message: "课后作业服务暂时没有响应，请稍后重试。" } }, 503);
  }
}

export async function readPublicHomeworkJson(request: Request): Promise<unknown> {
  assertSameOrigin(request);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new HomeworkError("HOMEWORK_JSON_REQUIRED", "提交必须使用 JSON 格式。", 415);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HomeworkError("HOMEWORK_TOO_LARGE", "文字和图片合计太大，请减少图片后重试。", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new HomeworkError("HOMEWORK_TOO_LARGE", "文字和图片合计太大，请减少图片后重试。", 413);
  try { return JSON.parse(raw) as unknown; }
  catch { throw new HomeworkError("HOMEWORK_JSON_INVALID", "提交内容格式不正确。", 400); }
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const proto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const expected = host && (proto === "https" || proto === "http") ? `${proto}://${host}` : url.origin;
  if (origin !== expected) throw new HomeworkError("HOMEWORK_ORIGIN_FORBIDDEN", "作业只接受本站页面提交。", 403);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
