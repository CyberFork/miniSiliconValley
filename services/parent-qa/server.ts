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
  createKnowledgeGapRecorder,
  type KnowledgeGapRecorder,
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
};

type RateLimitBucket = { count: number; resetAt: number };

export function createParentQaServer(options?: {
  config?: RuntimeConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  recordKnowledgeGap?: KnowledgeGapRecorder;
}): Server {
  const config = options?.config ?? runtimeConfig();
  const now = options?.now ?? Date.now;
  const buckets = new Map<string, RateLimitBucket>();
  const recordKnowledgeGap = options?.recordKnowledgeGap
    ?? (config.knowledgeGapFile ? createKnowledgeGapRecorder(config.knowledgeGapFile) : undefined);

  const server = createServer(async (request, response) => {
    try {
      await handleRequest(request, response, {
        config,
        fetchImpl: options?.fetchImpl,
        now,
        buckets,
        recordKnowledgeGap,
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
  context: {
    config: RuntimeConfig;
    fetchImpl?: typeof fetch;
    now: () => number;
    buckets: Map<string, RateLimitBucket>;
    recordKnowledgeGap?: KnowledgeGapRecorder;
  },
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname !== "/qa" && url.pathname !== "/health") {
    sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "Not found" } });
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
