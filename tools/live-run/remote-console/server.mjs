#!/usr/bin/env node

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC = join(HERE, "static");
const BUNDLED_SEAT_STATIC = join(HERE, "seat-static");
const DEFAULT_SEAT_STATIC = existsSync(BUNDLED_SEAT_STATIC) ? BUNDLED_SEAT_STATIC : join(HERE, "..", "static");
const SEAT_IDS = ["mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04"];
const FALLBACK_SEATS = [
  ["mentor01", "W00", "主 DM · 产品导师", "mentor"],
  ["mentor02", "W01", "开发导师", "mentor"],
  ["mentor03", "W02", "市场导师", "mentor"],
  ["mentor04", "W03", "运营导师", "mentor"],
  ["learner01", "W04", "Young Builder 01", "learner"],
  ["learner02", "W05", "Young Builder 02", "learner"],
  ["learner03", "W06", "Young Builder 03", "learner"],
  ["learner04", "W07", "Young Builder 04", "learner"],
].map(([id, window, title, kind]) => ({ id, window, title, kind }));

export class ClaimError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class ClaimRegistry {
  constructor({ statePath, ttlMs = 5 * 60_000, maxClaims = 2, now = () => Date.now() } = {}) {
    this.statePath = statePath;
    this.ttlMs = ttlMs;
    this.maxClaims = maxClaims;
    this.now = now;
    this.claims = new Map();
    this.lastPersistedAt = 0;
    this.load();
  }

  load() {
    if (!this.statePath || !existsSync(this.statePath)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.statePath, "utf8"));
      for (const claim of parsed.claims || []) {
        if (SEAT_IDS.includes(claim.seatId) && typeof claim.lease === "string") this.claims.set(claim.seatId, claim);
      }
      this.purge(false);
    } catch {
      this.claims.clear();
    }
  }

  persist() {
    if (!this.statePath) return;
    mkdirSync(dirname(this.statePath), { recursive: true });
    const temp = `${this.statePath}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify({ schemaVersion: 1, claims: [...this.claims.values()] }, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, this.statePath);
    this.lastPersistedAt = this.now();
  }

  purge(shouldPersist = true) {
    const now = this.now();
    let changed = false;
    for (const [seatId, claim] of this.claims) {
      if (claim.expiresAt <= now) {
        this.claims.delete(seatId);
        changed = true;
      }
    }
    if (changed && shouldPersist) this.persist();
  }

  claim({ seatId, clientId, nickname }) {
    this.purge(false);
    validateSeatId(seatId);
    clientId = validateClientId(clientId);
    nickname = validateNickname(nickname);
    const now = this.now();
    const existing = this.claims.get(seatId);
    if (existing && existing.clientId !== clientId) throw new ClaimError("SEAT_BUSY", `该席位正由 ${existing.nickname} 使用。`);
    const mine = [...this.claims.values()].filter((item) => item.clientId === clientId);
    if (!existing && mine.length >= this.maxClaims) throw new ClaimError("CLAIM_LIMIT", `每人最多同时领取 ${this.maxClaims} 个席位。`);
    const claim = existing || { seatId, clientId, lease: randomUUID(), createdAt: now };
    Object.assign(claim, { nickname, lastSeenAt: now, expiresAt: now + this.ttlMs });
    this.claims.set(seatId, claim);
    this.persist();
    return { ...claim };
  }

  release({ seatId, clientId, lease }) {
    validateSeatId(seatId);
    const claim = this.requireLease({ seatId, clientId, lease });
    this.claims.delete(claim.seatId);
    this.persist();
  }

  reset(confirm) {
    if (confirm !== "RESET ALL TEST SEATS") throw new ClaimError("RESET_CONFIRMATION_REQUIRED", "请输入完整确认语句后再重置。", 400);
    this.claims.clear();
    this.persist();
  }

  requireLease({ seatId, clientId, lease }, touch = false) {
    this.purge(false);
    validateSeatId(seatId);
    clientId = validateClientId(clientId);
    if (typeof lease !== "string" || lease.length < 20) throw new ClaimError("LEASE_REQUIRED", "请从内部测试控制台领取并打开该席位。", 403);
    const claim = this.claims.get(seatId);
    if (!claim || claim.clientId !== clientId || claim.lease !== lease) throw new ClaimError("LEASE_INVALID", "席位领取已失效，请返回控制台重新领取。", 403);
    if (touch) {
      const now = this.now();
      claim.lastSeenAt = now;
      claim.expiresAt = now + this.ttlMs;
      if (now - this.lastPersistedAt >= 15_000) this.persist();
    }
    return claim;
  }

  snapshot(clientId = "") {
    this.purge();
    return [...this.claims.values()].map(({ lease, ...claim }) => {
      const isMine = claim.clientId === clientId;
      return { ...claim, isMine, ...(isMine ? { lease } : {}) };
    });
  }
}

export function projectSeatState(state, seatId) {
  validateSeatId(seatId);
  const seat = state.seats?.find((item) => item.id === seatId);
  if (!seat) throw new ClaimError("SEAT_NOT_READY", "当前课堂尚未生成这个席位。", 503);
  const sourceClassroom = state.classroom || {};
  const classroom = pick(sourceClassroom, [
    "roomId", "teamPublicId", "campaignId", "chapterOrder", "chapterCount",
    "phase", "mentorCount", "learnerCount", "uniqueDealtCards", "publishedCards",
    "challengeActions", "teamTreasuryTenths",
  ]);
  const ownView = sourceClassroom.learnerViews?.[seatId];
  classroom.learnerViews = seatId.startsWith("learner") && ownView
    ? { [seatId]: projectLearnerView(ownView) }
    : {};
  return {
    schemaVersion: state.schemaVersion,
    courseId: state.courseId,
    runId: state.runId,
    updatedAt: state.updatedAt,
    version: state.version,
    status: state.status,
    currentBlockIndex: state.currentBlockIndex,
    previewBlockIndex: state.previewBlockIndex,
    lastCompletedBlockIndex: state.lastCompletedBlockIndex,
    courseRevision: state.courseRevision,
    courseDigest: state.courseDigest,
    courseVariant: state.courseVariant,
    refreshEpoch: state.refreshEpoch,
    classroom,
    seats: [{ ...seat }],
  };
}

function projectLearnerView(view) {
  return {
    ...pick(view, ["displayName", "reputation", "walletTenths", "scene", "chapterDoneWhen"]),
    unlockIds: Array.isArray(view.unlockIds) ? [...view.unlockIds] : [],
    chapterSteps: Array.isArray(view.chapterSteps) ? [...view.chapterSteps] : [],
    recentReputation: view.recentReputation ? pick(view.recentReputation, ["points", "reason"]) : null,
    recentWallet: view.recentWallet ? pick(view.recentWallet, ["amountTenths", "direction", "reason"]) : null,
    identity: view.identity ? pick(view.identity, ["name", "publicGoal", "ability", "privateConcern"]) : null,
    cards: Array.isArray(view.cards) ? view.cards.map((card) => pick(card, [
      "id", "title", "body", "sharePrompt", "sourceIds", "credibility", "evidenceBoundary", "state",
    ])) : [],
    realityMission: view.realityMission ? pick(view.realityMission, ["title", "deliverable"]) : null,
    challenge: view.challenge ? pick(view.challenge, ["round", "title", "prompt", "pressure"]) : null,
  };
}

function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
  }
  return result;
}

export function createRemoteConsoleServer({
  controllerBase = process.env.MSV_CONTROLLER_BASE || "http://127.0.0.1:18765",
  controllerServiceKey = readControllerServiceKey(process.env.MSV_CONTROLLER_SERVICE_KEY_FILE),
  statePath = process.env.MSV_CONSOLE_STATE || defaultStatePath(),
  staticDir = process.env.MSV_CONSOLE_STATIC || DEFAULT_STATIC,
  seatStaticDir = process.env.MSV_SEAT_STATIC || DEFAULT_SEAT_STATIC,
  fetchImpl = fetch,
  registry = new ClaimRegistry({ statePath }),
} = {}) {
  let lastControllerErrorLoggedAt = 0;
  let cachedScript = null;
  let cachedScriptKey = null;
  const getControllerJson = async (path) => {
    const headers = controllerServiceKey ? { "X-Live-Run-Service-Key": controllerServiceKey } : {};
    const response = await fetchImpl(new URL(path, controllerBase), {
      headers,
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`controller ${path} returned ${response.status}`);
    const envelope = await response.json();
    if (!envelope.ok) throw new Error(envelope.error?.message || "controller request failed");
    return envelope.data;
  };

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://console.internal");
      if (request.method === "GET" && url.pathname === "/healthz") {
        return jsonResponse(response, 200, { ok: true, data: { service: "msv-remote-console" } });
      }
      if (request.method === "GET" && url.pathname === "/api/console") {
        const clientId = optionalClientId(url.searchParams.get("clientId"));
        let state = null;
        let script = null;
        try {
          state = await getControllerJson("/api/state");
          const scriptKey = `${state.scriptId || ""}:${state.courseDigest || ""}`;
          if (!cachedScript || cachedScriptKey !== scriptKey) {
            cachedScript = await getControllerJson("/api/script");
            cachedScriptKey = scriptKey;
          }
          script = cachedScript;
        } catch (error) {
          // The console stays available during a controller restart and shows
          // the eight known seats as disconnected instead of a false 500.
          if (Date.now() - lastControllerErrorLoggedAt >= 30_000) {
            console.error(`${new Date().toISOString()} CONTROLLER_UNAVAILABLE ${error.message}`);
            lastControllerErrorLoggedAt = Date.now();
          }
        }
        const claims = new Map(registry.snapshot(clientId).map((claim) => [claim.seatId, claim]));
        const seats = (state?.seats?.length ? state.seats : FALLBACK_SEATS).map((seat) => {
          const claim = claims.get(seat.id);
          // Keep browser-facing URLs relative to the console document.  The
          // same release can therefore run at LAN root `/` and behind the Work
          // reverse-proxy prefix `/msv/alpha/` without leaking requests to the
          // origin root.
          const seatUrl = claim?.isMine
            ? seatCapabilityUrl(seat.id, clientId, claim.lease)
            : null;
          return {
            id: seat.id,
            window: seat.window,
            title: seat.title,
            kind: seat.kind,
            claimed: Boolean(claim),
            claimedBy: claim?.nickname || null,
            isMine: claim?.isMine || false,
            lease: claim?.isMine ? claim.lease : null,
            url: seatUrl,
            lastSeenAt: claim?.lastSeenAt || null,
            expiresAt: claim?.expiresAt || null,
          };
        });
        return jsonResponse(response, 200, { ok: true, data: {
          connected: Boolean(state && script),
          connectionError: state && script ? null : "课程主控暂时不可达；席位领取台仍在线。",
          course: script ? { name: script.course.name, coverage: script.course.coverage } : null,
          run: state ? {
            status: state.status,
            currentBlock: (Number.isInteger(state.previewBlockIndex) ? state.previewBlockIndex : state.currentBlockIndex) + 1,
            executionBlock: state.currentBlockIndex + 1,
            totalBlocks: state.seats?.[0]?.blockCount || script?.blocks?.length || 13,
            macroStepName: state.seats?.[0]?.macroStepName || null,
            courseRevision: state.courseRevision,
            courseDigest: String(state.courseDigest || "").slice(0, 16),
            refreshEpoch: state.refreshEpoch || 0,
          } : null,
          seats,
          clientClaimCount: [...claims.values()].filter((claim) => claim.isMine).length,
          maxClaims: registry.maxClaims,
          now: Date.now(),
        } });
      }
      if (request.method === "POST" && url.pathname === "/api/claims") {
        const body = await readJsonBody(request);
        const claim = registry.claim(body);
        const seatUrl = seatCapabilityUrl(claim.seatId, claim.clientId, claim.lease);
        return jsonResponse(response, 201, { ok: true, data: { seatId: claim.seatId, lease: claim.lease, url: seatUrl } });
      }
      if (request.method === "DELETE" && url.pathname.startsWith("/api/claims/")) {
        const seatId = decodeURIComponent(url.pathname.slice("/api/claims/".length));
        const body = await readJsonBody(request);
        registry.release({ seatId, clientId: body.clientId, lease: body.lease });
        return jsonResponse(response, 200, { ok: true, data: { released: seatId } });
      }
      if (request.method === "POST" && url.pathname === "/api/claims/reset") {
        const body = await readJsonBody(request);
        registry.reset(body.confirm);
        return jsonResponse(response, 200, { ok: true, data: { reset: true } });
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        const seatId = url.searchParams.get("seat") || "";
        // Capability material travels in headers, never in request URLs.  The
        // seat link stores it in the URL fragment, which browsers do not send
        // to Nginx, Cloudflare, Node, or referrers.
        registry.requireLease({
          seatId,
          clientId: request.headers["x-msv-client-id"],
          lease: request.headers["x-msv-seat-lease"],
        }, true);
        const state = await getControllerJson("/api/state");
        return jsonResponse(response, 200, { ok: true, data: projectSeatState(state, seatId) });
      }
      if (request.method === "GET" && url.pathname === "/api/script") {
        return jsonResponse(response, 404, { ok: false, error: { code: "NOT_EXPOSED", message: "内部席位服务器不公开导师脚本。" } });
      }
      if (request.method === "GET") {
        const staticFiles = new Map([
          ["/", [staticDir, "index.html"]],
          ["/index.html", [staticDir, "index.html"]],
          ["/console.css", [staticDir, "console.css"]],
          ["/console.js", [staticDir, "console.js"]],
          ["/seat-loading.html", [staticDir, "seat-loading.html"]],
          ["/seat.html", [seatStaticDir, "seat.html"]],
          ["/seat.css", [seatStaticDir, "seat.css"]],
          ["/seat.js", [seatStaticDir, "seat.js"]],
        ]);
        const target = staticFiles.get(url.pathname);
        if (target) return fileResponse(response, join(...target));
      }
      return jsonResponse(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "页面不存在。" } });
    } catch (error) {
      if (error instanceof ClaimError) return jsonResponse(response, error.status, { ok: false, error: { code: error.code, message: error.message } });
      console.error(`${new Date().toISOString()} CONSOLE_REQUEST_FAILED ${request.method} ${request.url || "/"} ${error.message}`);
      return jsonResponse(response, 503, { ok: false, error: { code: "CONSOLE_UNAVAILABLE", message: "内部测试服务暂时不可用，请稍后重试。" } });
    }
  });
}

function defaultStatePath() {
  const root = process.env.LOCALAPPDATA || process.env.TMPDIR || "/tmp";
  return join(root, "msv-live-run-console", "claims.json");
}

function readControllerServiceKey(path) {
  if (!path) return "";
  if ((statSync(path).mode & 0o077) !== 0) throw new Error("MSV controller service key file must be private (0600)");
  const value = readFileSync(path, "utf8").trim();
  if (value.length < 32) throw new Error("MSV controller service key must contain at least 32 characters");
  return value;
}

function seatCapabilityUrl(seatId, clientId, lease) {
  return `seat.html?seat=${encodeURIComponent(seatId)}#clientId=${encodeURIComponent(clientId)}&lease=${encodeURIComponent(lease)}`;
}

function validateSeatId(value) {
  if (!SEAT_IDS.includes(value)) throw new ClaimError("SEAT_INVALID", "请选择八个测试席位之一。", 400);
  return value;
}

function validateClientId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(value)) throw new ClaimError("CLIENT_INVALID", "测试浏览器标识无效，请刷新控制台。", 400);
  return value;
}

function optionalClientId(value) {
  if (!value) return "";
  return validateClientId(value);
}

function validateNickname(value) {
  if (typeof value !== "string") throw new ClaimError("NICKNAME_REQUIRED", "请输入测试昵称。", 400);
  const nickname = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
  if (nickname.length < 1) throw new ClaimError("NICKNAME_REQUIRED", "请输入测试昵称。", 400);
  return nickname;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8_192) throw new ClaimError("BODY_TOO_LARGE", "请求内容过大。", 413);
    chunks.push(chunk);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  } catch {
    throw new ClaimError("JSON_INVALID", "请求格式无效。", 400);
  }
}

function commonHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
}

function jsonResponse(response, status, value) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`);
  response.statusCode = status;
  commonHeaders(response);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", body.length);
  response.end(body);
}

function fileResponse(response, path) {
  if (!existsSync(path)) return jsonResponse(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "页面不存在。" } });
  const body = readFileSync(path);
  const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" }[extname(path)] || "application/octet-stream";
  response.statusCode = 200;
  commonHeaders(response);
  response.setHeader("Content-Type", mime);
  response.setHeader("Content-Length", body.length);
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  response.end(body);
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))) {
  const host = process.env.MSV_CONSOLE_HOST || "0.0.0.0";
  const port = Number(process.env.MSV_CONSOLE_PORT || 18766);
  const server = createRemoteConsoleServer();
  server.listen(port, host, () => {
    console.log(`MSV_REMOTE_CONSOLE_READY host=${host} port=${port} controller=${process.env.MSV_CONTROLLER_BASE || "http://127.0.0.1:18765"}`);
  });
}
