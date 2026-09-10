import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parentQaKnowledge } from "../../app/data/parent-qa-knowledge";
import {
  answerParentQuestion,
  ParentQaError,
  parseParentQaRequest,
  type ParentQaAnswer,
} from "../../app/lib/parent-qa";
import {
  createKnowledgeGapStore,
  type KnowledgeGapRecorder,
  type KnowledgeGapStore,
} from "./knowledge-gap-store";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 18_789;
const MAX_BODY_BYTES = 12 * 1024;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1_000;
const RATE_LIMIT_REQUESTS = 12;

type RuntimeConfig = {
  apiKey: string;
  model?: string;
  endpoint?: string;
  knowledgeGapFile?: string;
  reviewToken?: string;
};

type RateLimitBucket = { count: number; resetAt: number };
type ParentQaRequestContext = {
  config: RuntimeConfig;
  fetchImpl?: typeof fetch;
  now: () => number;
  buckets: Map<string, RateLimitBucket>;
  recordKnowledgeGap?: KnowledgeGapRecorder;
  knowledgeGapStore?: KnowledgeGapStore;
};

export function createParentQaServer(options?: {
  config?: RuntimeConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  recordKnowledgeGap?: KnowledgeGapRecorder;
  knowledgeGapStore?: KnowledgeGapStore;
}): Server {
  const config = options?.config ?? runtimeConfig();
  const now = options?.now ?? Date.now;
  const buckets = new Map<string, RateLimitBucket>();
  const knowledgeGapStore = options?.knowledgeGapStore
    ?? (config.knowledgeGapFile ? createKnowledgeGapStore(config.knowledgeGapFile) : undefined);
  const recordKnowledgeGap = options?.recordKnowledgeGap
    ?? (knowledgeGapStore ? (input: Parameters<KnowledgeGapRecorder>[0]) => knowledgeGapStore.recordObservation(input) : undefined);
  const server = createServer(async (request, response) => {
    try {
      await handleRequest(request, response, {
        config,
        fetchImpl: options?.fetchImpl,
        now,
        buckets,
        recordKnowledgeGap,
        knowledgeGapStore,
      });
    } catch (error) {
      if (error instanceof ParentQaError) {
        sendJson(
          response,
          error.status,
          { ok: false, error: { code: error.code, message: error.message } },
          error.retryAfterSeconds,
        );
        return;
      }
      console.error("[parent-qa-server] unexpected error", error instanceof Error ? error.name : "UnknownError");
      sendJson(response, 500, {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "问答服务暂时没有完成这次操作，请稍后再试。" },
      });
    }
  });

  server.requestTimeout = 65_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: ParentQaRequestContext,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname !== "/qa" && url.pathname !== "/health" && url.pathname !== "/internal/knowledge-gaps") {
    sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "Not found" } });
    return;
  }

  if (url.pathname === "/internal/knowledge-gaps") {
    await handleKnowledgeGapReviewRequest(request, response, context);
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      data: {
        status: context.config.apiKey ? "ready" : "configuration-required",
        knowledgeEntries: parentQaKnowledge.length,
        knowledgeGapRecording: Boolean(context.recordKnowledgeGap),
      },
    });
    return;
  }

  if (url.pathname !== "/qa" || request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }

  assertTrustedOrigin(request);
  const retryAfter = consumeRateLimit(clientFingerprint(request), context.buckets, context.now());
  if (retryAfter !== undefined) {
    request.resume();
    throw new ParentQaError(
      "RATE_LIMITED",
      `您提问得有些快，请在 ${retryAfter} 秒后继续。`,
      429,
      retryAfter,
    );
  }

  const input = parseParentQaRequest(await readJsonBody(request));
  const result = await answerParentQuestion(input, {
    apiKey: context.config.apiKey,
    model: context.config.model,
    endpoint: context.config.endpoint,
    fetchImpl: context.fetchImpl,
  });
  let knowledgeGapRecorded = false;
  if (result.knowledgeGap && context.recordKnowledgeGap) {
    try {
      await context.recordKnowledgeGap({
        question: input.question,
        observedAt: context.now(),
        model: result.model,
        sourceIds: result.sources.map(({ id }) => id),
      });
      knowledgeGapRecorded = true;
    } catch (error) {
      console.error(
        "[parent-qa-server] knowledge gap record failed",
        error instanceof Error ? error.name : "UnknownError",
      );
    }
  }
  const responseData: ParentQaAnswer = { ...result, knowledgeGapRecorded };
  sendJson<{ ok: true; data: ParentQaAnswer }>(response, 200, { ok: true, data: responseData });
}

async function handleKnowledgeGapReviewRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: ParentQaRequestContext,
): Promise<void> {
  requireReviewToken(request, context.config.reviewToken);
  const store = context.knowledgeGapStore;
  if (!store) {
    throw new ParentQaError("KNOWLEDGE_GAP_STORE_UNAVAILABLE", "待补充清单尚未配置。", 503);
  }
  if (request.method === "GET") {
    sendJson(response, 200, { ok: true, data: { gaps: await store.list(), health: store.health() } });
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    throw new ParentQaError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }
  const raw = await readJsonBody(request);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParentQaError("INVALID_REVIEW_REQUEST", "审核请求必须是 JSON 对象。", 400);
  }
  const body = raw as Record<string, unknown>;
  const action = requiredInternalString(body.action, "操作", 32);
  if (action === "retry-failed") {
    const retry = await store.retryFailed();
    sendJson(response, 200, { ok: true, data: { retry, health: store.health() } });
    return;
  }
  const id = requiredInternalString(body.id, "缺口 ID", 64);
  const actor = requiredInternalString(body.actor, "审核人", 80);
  const note = requiredInternalString(body.note, "审核说明", 500);
  try {
    if (action === "review") {
      const status = body.status;
      if (
        status !== "resolved_already_covered"
        && status !== "resolved_added_to_knowledge"
        && status !== "dismissed_out_of_scope"
      ) throw new ParentQaError("KNOWLEDGE_GAP_REVIEW_STATUS_INVALID", "请选择明确的人工处置。", 400);
      const knowledgeEntryId = typeof body.knowledgeEntryId === "string" ? body.knowledgeEntryId.trim() : undefined;
      const gap = await store.review({
        id,
        status,
        reviewedAt: context.now(),
        reviewedBy: actor,
        note,
        ...(knowledgeEntryId ? { knowledgeEntryId } : {}),
      });
      sendJson(response, 200, { ok: true, data: { gap, health: store.health() } });
      return;
    }
    if (action === "reopen") {
      const gap = await store.reopen({ id, reopenedAt: context.now(), reopenedBy: actor, reason: note });
      sendJson(response, 200, { ok: true, data: { gap, health: store.health() } });
      return;
    }
  } catch (error) {
    if (error instanceof ParentQaError) throw error;
    const code = error instanceof Error ? error.message : "KNOWLEDGE_GAP_REVIEW_FAILED";
    if (code === "KNOWLEDGE_GAP_NOT_FOUND") throw new ParentQaError(code, "没有找到这个待补充问题。", 404);
    if (code === "KNOWLEDGE_GAP_ALREADY_PENDING") throw new ParentQaError(code, "这个问题已经处于待审核状态。", 409);
    if (code === "KNOWLEDGE_GAP_REOPEN_REQUIRED") throw new ParentQaError(code, "已有人工结论；请先显式重开，不能静默覆盖。", 409);
    if (code === "KNOWLEDGE_GAP_PENDING_RETRY") throw new ParentQaError(code, "存在尚未落盘的审核事件；请先执行失败写入重试。", 409);
    if (code === "KNOWLEDGE_GAP_ENTRY_REQUIRED") throw new ParentQaError(code, "新增知识解决时必须填写知识条目 ID。", 400);
    if (code.endsWith("_REQUIRED") || code.endsWith("_INVALID")) throw new ParentQaError(code, "审核字段不完整或格式无效。", 400);
    throw error;
  }
  throw new ParentQaError("KNOWLEDGE_GAP_ACTION_INVALID", "不支持的审核操作。", 400);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    request.resume();
    throw new ParentQaError("JSON_REQUIRED", "请求必须使用 application/json。", 415);
  }

  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    request.resume();
    throw new ParentQaError("BODY_TOO_LARGE", "问答请求不能超过 12 KB。", 413);
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      request.resume();
      throw new ParentQaError("BODY_TOO_LARGE", "问答请求不能超过 12 KB。", 413);
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ParentQaError("INVALID_JSON", "请求内容不是有效 JSON。");
  }
}

function assertTrustedOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  if (!origin) return;
  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const host = forwardedHost || request.headers.host;
  const proto = forwardedProto === "https" || forwardedProto === "http" ? forwardedProto : "http";
  if (!host || origin !== `${proto}://${host}`) {
    request.resume();
    throw new ParentQaError("ORIGIN_FORBIDDEN", "问答请求只接受本站页面提交。", 403);
  }
}

function clientFingerprint(request: IncomingMessage): string {
  const address = firstHeaderValue(request.headers["x-real-ip"])
    || firstHeaderValue(request.headers["x-forwarded-for"])
    || request.socket.remoteAddress
    || "local";
  const userAgent = String(request.headers["user-agent"] ?? "unknown").slice(0, 160);
  return `${address.slice(0, 96)}|${userAgent}`;
}

function firstHeaderValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",", 1)[0]?.trim() ?? "";
}

function requireReviewToken(request: IncomingMessage, configuredToken: string | undefined): void {
  if (!configuredToken || configuredToken.length < 24) {
    request.resume();
    throw new ParentQaError(
      "KNOWLEDGE_GAP_REVIEW_NOT_CONFIGURED",
      "人工审核服务尚未完成安全配置。",
      503,
    );
  }
  const authorization = firstHeaderValue(request.headers.authorization);
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const expected = Buffer.from(configuredToken, "utf8");
  const supplied = Buffer.from(suppliedToken, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    request.resume();
    throw new ParentQaError("KNOWLEDGE_GAP_REVIEW_UNAUTHORIZED", "人工审核凭据无效。", 401);
  }
}

function requiredInternalString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ParentQaError("KNOWLEDGE_GAP_REVIEW_FIELD_REQUIRED", `${label}不能为空。`, 400);
  }
  const normalized = [...value].filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("").trim();
  if (!normalized) {
    throw new ParentQaError("KNOWLEDGE_GAP_REVIEW_FIELD_REQUIRED", `${label}不能为空。`, 400);
  }
  if (normalized.length > maxLength) {
    throw new ParentQaError("KNOWLEDGE_GAP_REVIEW_FIELD_TOO_LONG", `${label}内容过长。`, 400);
  }
  return normalized;
}

function consumeRateLimit(
  fingerprint: string,
  buckets: Map<string, RateLimitBucket>,
  now: number,
): number | undefined {
  if (buckets.size > 500) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const existing = buckets.get(fingerprint);
  if (!existing || existing.resetAt <= now) {
    buckets.set(fingerprint, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return undefined;
  }
  if (existing.count >= RATE_LIMIT_REQUESTS) {
    return Math.max(1, Math.ceil((existing.resetAt - now) / 1_000));
  }
  existing.count += 1;
  return undefined;
}

function sendJson<T>(response: ServerResponse, status: number, body: T, retryAfterSeconds?: number): void {
  if (response.headersSent) return;
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(payload));
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (retryAfterSeconds !== undefined) response.setHeader("Retry-After", String(retryAfterSeconds));
  response.end(payload);
}

function runtimeConfig(): RuntimeConfig {
  const envFile = process.env.QA_ENV_FILE;
  if (envFile) loadEnvFile(envFile);
  return {
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
    model: process.env.DEEPSEEK_MODEL?.trim() || undefined,
    endpoint: process.env.DEEPSEEK_API_ENDPOINT?.trim() || undefined,
    knowledgeGapFile: process.env.QA_KNOWLEDGE_GAP_FILE?.trim() || undefined,
    reviewToken: process.env.QA_INTERNAL_REVIEW_TOKEN?.trim() || undefined,
  };
}

function loadEnvFile(path: string): void {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function start(): void {
  const host = process.env.QA_HOST?.trim() || DEFAULT_HOST;
  const port = Number(process.env.QA_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid QA_PORT: ${process.env.QA_PORT}`);
  }
  const server = createParentQaServer();
  server.listen(port, host, () => console.log(`[parent-qa-server] listening on http://${host}:${port}`));
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (process.env.QA_AUTOSTART === "1" || (invokedPath && invokedPath === resolve(fileURLToPath(import.meta.url)))) start();
