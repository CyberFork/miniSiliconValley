import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ClaimError,
  ClaimRegistry,
  createRemoteConsoleServer,
  projectSeatState,
} from "../remote-console/server.mjs";

const CLIENT_A = "client_a_1234567890";
const CLIENT_B = "client_b_1234567890";
const ALL_SEATS = [
  ["mentor01", "W00", "主 DM · 产品导师", "mentor"],
  ["mentor02", "W01", "开发导师", "mentor"],
  ["mentor03", "W02", "市场导师", "mentor"],
  ["mentor04", "W03", "运营导师", "mentor"],
  ["learner01", "W04", "Young Builder 01", "learner"],
  ["learner02", "W05", "Young Builder 02", "learner"],
  ["learner03", "W06", "Young Builder 03", "learner"],
  ["learner04", "W07", "Young Builder 04", "learner"],
].map(([id, window, title, kind]) => ({
  id, window, title, kind, blockCount: 13, blockOrder: 1,
  macroStepCount: 5, macroStepOrder: 1, macroStepName: "找真问题",
  task: `${id}-task`, headline: `${id}-headline`, learnerLens: {},
}));

function controllerState() {
  return {
    schemaVersion: 2,
    apiMode: "real",
    scriptId: "private-script-id",
    courseId: "eleme-2008-find-problem",
    runId: "test-run",
    updatedAt: "2026-09-03T10:00:00Z",
    version: 7,
    status: "ready",
    currentBlockIndex: 0,
    lastCompletedBlockIndex: -1,
    error: { internal: "must-not-cross" },
    blocks: [{ dmOnly: "must-not-cross" }],
    events: [{ internal: "must-not-cross" }],
    classroom: {
      roomId: "room-test-only",
      teamPublicId: "TEAM-TEST",
      campaignId: "eleme-2008-find-problem",
      chapterOrder: 1,
      chapterCount: 5,
      phase: "lobby",
      mentorCount: 4,
      learnerCount: 4,
      uniqueDealtCards: 12,
      publishedCards: 0,
      challengeActions: 0,
      teamTreasuryTenths: 100,
      worldlineEntries: [{ dmOnly: "must-not-cross" }],
      learnerViews: {
        learner01: {
          displayName: "L1", reputation: 3, walletTenths: 4, unlockIds: [],
          recentReputation: null, recentWallet: null,
          identity: { name: "观察者", publicGoal: "找卡点", ability: "记录", privateConcern: "L1-ONLY" },
          cards: [{ id: "l1-card", title: "L1-ONLY", body: "only learner one", sharePrompt: "分享", credibility: "high", evidenceBoundary: "F", state: "unread", sourceIds: ["must-not-cross"] }],
          scene: "现场", chapterSteps: ["观察"], chapterDoneWhen: "写下问题", realityMission: null, challenge: null,
          accidentalFutureSecret: "must-not-cross",
        },
        learner02: {
          displayName: "L2", reputation: 8, walletTenths: 9, unlockIds: ["x"],
          cards: [{ id: "l2-card", title: "L2-ONLY", body: "only learner two" }],
          identity: { privateConcern: "L2-ONLY" },
        },
      },
      controllerSecret: "must-not-cross",
    },
    seats: ALL_SEATS,
  };
}

function expectClaimError(fn, code) {
  assert.throws(fn, (error) => error instanceof ClaimError && error.code === code);
}

test("Alpha console uses accessible dialogs and avoids native blocking prompts", () => {
  const staticDir = fileURLToPath(new URL("../remote-console/static/", import.meta.url));
  const html = readFileSync(join(staticDir, "index.html"), "utf8");
  const js = readFileSync(join(staticDir, "console.js"), "utf8");
  const css = readFileSync(join(staticDir, "console.css"), "utf8");

  assert.match(html, /<dialog[^>]*id="nicknameDialog"[^>]*aria-labelledby="nicknameDialogTitle"/);
  assert.match(html, /<form[^>]*id="nicknameForm"[^>]*novalidate/);
  assert.match(html, /<label[^>]*for="nicknameInput"/);
  assert.match(html, /<input[^>]*id="nicknameInput"[^>]*maxlength="24"/);
  assert.match(html, /id="nicknameError"[^>]*role="alert"/);
  assert.match(html, /<dialog[^>]*id="resetDialog"[^>]*aria-labelledby="resetDialogTitle"/);
  assert.match(html, /<form[^>]*id="resetForm"[^>]*novalidate/);
  assert.match(html, /<label[^>]*for="resetInput"/);
  assert.match(html, /id="resetError"[^>]*role="alert"/);
  assert.match(css, /dialog::backdrop/);
  assert.match(css, /\.dialog-error/);
  assert.doesNotMatch(js, /\b(?:window\.)?(?:prompt|confirm|alert)\s*\(/);
  // Seat cards are real popup windows, not hidden target=_blank links. Keep
  // these assertions close to the existing console interaction checks so the
  // launch/claim flow cannot silently regress to navigation in the main tab.
  assert.doesNotMatch(html, /target\s*=\s*["']_blank["']/i);
  assert.doesNotMatch(js, /target\s*=\s*["']_blank["']/i);
  assert.match(js, /window\.open\(new URL\(url, APP_BASE\)\.href, seatWindowName\(seat\), seatWindowFeatures\(\)\)/);
  assert.match(js, /function seatWindowName\(seat\)[\s\S]*?msv_seat_/);
  assert.match(js, /"popup=yes"/);
  assert.match(js, /`width=\$\{width\}`/);
  assert.match(js, /`height=\$\{height\}`/);
  assert.match(js, /popup\.location\.replace\(new URL\(url, APP_BASE\)\.href\)/);
  assert.match(js, /catch \{[\s\S]*?popup\.close\(\)/);
  assert.match(js, /function normalizeNickname[\s\S]*?charCodeAt\(0\) >= 32[\s\S]*?trim\(\)\.slice\(0, 24\)/);
  assert.match(js, /form\.addEventListener\("submit", handleSubmit\)/);
  assert.match(js, /\$\{seat\.title \|\| seat\.id\} · \$\{seat\.claimedBy/);

  // The privileged LIVE RUN controller must remain a local-only named popup,
  // rather than becoming a public or unnamed navigation during refactors.
  assert.match(html, /<button\s+id="controllerBtn"\s+type="button"[^>]*>\s*打开主控(?:\s|<)/);
  assert.doesNotMatch(html, /<button[^>]*id="controllerBtn"[^>]*target\s*=/i);
  assert.match(js, /const CONTROLLER_URL\s*=\s*new URL\("\.\.\/control\/", APP_BASE\)\.href/);
  assert.doesNotMatch(js, /CONTROLLER_URL\s*=\s*"http:\/\/127\.0\.0\.1/);
  assert.match(js, /window\.open\(CONTROLLER_URL,\s*"msv_live_run_controller",\s*controllerWindowFeatures\(\)\)/);
  assert.match(js, /function controllerWindowFeatures\(\)[\s\S]*?["']popup=yes["']/);
  assert.match(js, /toast\("浏览器拦截了主控窗口；请允许此站点的弹出窗口后重试。"\)/);
});

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const json = await response.json();
  return { response, json };
}

test("claim registry enforces conflict, two-seat limit, lease release, expiry, and durable state", () => {
  const directory = mkdtempSync(join(tmpdir(), "msv-claims-"));
  let now = 1_000;
  const statePath = join(directory, "claims.json");
  try {
    const registry = new ClaimRegistry({ statePath, ttlMs: 5_000, now: () => now });
    const first = registry.claim({ seatId: "mentor01", clientId: CLIENT_A, nickname: "Alice" });
    assert.ok(first.lease.length >= 20);
    expectClaimError(() => registry.claim({ seatId: "mentor01", clientId: CLIENT_B, nickname: "Bob" }), "SEAT_BUSY");
    registry.claim({ seatId: "learner01", clientId: CLIENT_A, nickname: "Alice" });
    expectClaimError(() => registry.claim({ seatId: "mentor02", clientId: CLIENT_A, nickname: "Alice" }), "CLAIM_LIMIT");

    const mine = registry.snapshot(CLIENT_A).find((item) => item.seatId === "mentor01");
    const other = registry.snapshot(CLIENT_B).find((item) => item.seatId === "mentor01");
    assert.equal(mine.isMine, true);
    assert.equal(mine.lease, first.lease);
    assert.equal(other.isMine, false);
    assert.equal("lease" in other, false);
    expectClaimError(() => registry.release({ seatId: "mentor01", clientId: CLIENT_A, lease: "wrong-lease-value-123456789" }), "LEASE_INVALID");
    registry.release({ seatId: "mentor01", clientId: CLIENT_A, lease: first.lease });
    assert.equal(registry.snapshot(CLIENT_A).length, 1);

    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).schemaVersion, 1);
    const reloaded = new ClaimRegistry({ statePath, ttlMs: 5_000, now: () => now });
    assert.equal(reloaded.snapshot(CLIENT_A).length, 1);
    now += 5_001;
    assert.equal(reloaded.snapshot(CLIENT_A).length, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("seat projection is fail-closed, immutable, and excludes every other seat and controller field", () => {
  const source = controllerState();
  const before = JSON.stringify(source);
  const learner = projectSeatState(source, "learner01");
  const encoded = JSON.stringify(learner);
  assert.deepEqual(learner.seats.map((seat) => seat.id), ["learner01"]);
  assert.deepEqual(Object.keys(learner.classroom.learnerViews), ["learner01"]);
  assert.match(encoded, /L1-ONLY/);
  for (const forbidden of ["L2-ONLY", "must-not-cross", "controllerSecret", "worldlineEntries", "events", "blocks", "apiMode", "scriptId", "sourceIds", "accidentalFutureSecret"]) {
    assert.equal(encoded.includes(forbidden), false, forbidden);
  }
  assert.equal(JSON.stringify(source), before, "projection must not mutate controller state");

  const mentor = projectSeatState(source, "mentor01");
  assert.deepEqual(mentor.classroom.learnerViews, {});
  assert.equal(JSON.stringify(mentor).includes("L1-ONLY"), false);
  expectClaimError(() => projectSeatState(source, "not-a-seat"), "SEAT_INVALID");
  const missing = controllerState();
  missing.seats = missing.seats.filter((seat) => seat.id !== "learner01");
  expectClaimError(() => projectSeatState(missing, "learner01"), "SEAT_NOT_READY");
});

test("remote HTTP console exposes eight safe seats while privileged controller routes stay unreachable", async () => {
  const fullState = controllerState();
  const controller = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/state") {
      res.end(JSON.stringify({ ok: true, data: fullState }));
    } else if (req.url === "/api/script") {
      res.end(JSON.stringify({ ok: true, data: {
        course: { name: "饿了么：从宿舍订餐到城市网络", coverage: "完整课程 · 5 步 / 13 块" },
        blocks: Array.from({ length: 13 }),
      } }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false }));
    }
  });
  const controllerPort = await listen(controller);
  const directory = mkdtempSync(join(tmpdir(), "msv-console-http-"));
  const registry = new ClaimRegistry({ statePath: join(directory, "claims.json") });
  const consoleServer = createRemoteConsoleServer({
    controllerBase: `http://127.0.0.1:${controllerPort}`,
    registry,
  });
  const consolePort = await listen(consoleServer);
  const base = `http://127.0.0.1:${consolePort}`;
  try {
    let result = await request(base, `/api/console?clientId=${CLIENT_A}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.json.data.connected, true);
    assert.equal(result.json.data.seats.length, 8);
    assert.deepEqual(result.json.data.seats.map((seat) => seat.window), ["W00", "W01", "W02", "W03", "W04", "W05", "W06", "W07"]);
    assert.equal(result.json.data.course.coverage, "完整课程 · 5 步 / 13 块");

    result = await request(base, "/api/claims", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: "learner01", clientId: CLIENT_A, nickname: "Alice" }),
    });
    assert.equal(result.response.status, 201);
    const lease = result.json.data.lease;
    assert.match(result.json.data.url, /seat=learner01/);
    assert.match(result.json.data.url, /^seat\.html\?/);
    assert.match(result.json.data.url, /#clientId=/);
    assert.equal(result.json.data.url.includes("lease="), true);
    assert.equal(result.json.data.url.split("#", 1)[0].includes("lease="), false);

    const mine = await request(base, `/api/console?clientId=${CLIENT_A}`);
    const mineSeat = mine.json.data.seats.find((seat) => seat.id === "learner01");
    assert.equal(mineSeat.isMine, true);
    assert.equal(mineSeat.lease, lease);
    assert.match(mineSeat.url, /clientId=/);
    assert.match(mineSeat.url, /^seat\.html\?/);
    assert.equal(mine.json.data.clientClaimCount, 1);

    const stranger = await request(base, `/api/console?clientId=${CLIENT_B}`);
    const strangerSeat = stranger.json.data.seats.find((seat) => seat.id === "learner01");
    assert.equal(strangerSeat.isMine, false);
    assert.equal(strangerSeat.claimedBy, "Alice");
    assert.equal(strangerSeat.lease, null);
    assert.equal(strangerSeat.url, null);
    assert.equal(JSON.stringify(stranger.json).includes(CLIENT_A), false);

    const renamed = await request(base, "/api/claims", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: "learner01", clientId: CLIENT_A, nickname: "Alice Updated" }),
    });
    assert.equal(renamed.response.status, 201);
    assert.equal(renamed.json.data.lease, lease, "renaming must preserve the lease");
    const renamedView = await request(base, `/api/console?clientId=${CLIENT_B}`);
    assert.equal(renamedView.json.data.seats.find((seat) => seat.id === "learner01").claimedBy, "Alice Updated");

    result = await request(base, `/api/state?seat=learner01`, { headers: { "X-MSV-Client-ID": CLIENT_A } });
    assert.equal(result.response.status, 403);
    result = await request(base, `/api/state?seat=learner01`, { headers: { "X-MSV-Client-ID": CLIENT_A, "X-MSV-Seat-Lease": lease } });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.json.data.seats.map((seat) => seat.id), ["learner01"]);
    assert.deepEqual(Object.keys(result.json.data.classroom.learnerViews), ["learner01"]);
    const safeBody = JSON.stringify(result.json);
    assert.match(safeBody, /L1-ONLY/);
    assert.equal(safeBody.includes("L2-ONLY"), false);
    assert.equal(safeBody.includes("must-not-cross"), false);

    for (const [method, path] of [["GET", "/api/bootstrap"], ["GET", "/api/script"], ["POST", "/api/control"]]) {
      const blocked = await request(base, path, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
      assert.equal(blocked.response.status, 404, `${method} ${path}`);
    }

    await request(base, "/api/claims", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: "mentor01", clientId: CLIENT_A, nickname: "Alice" }),
    });
    const third = await request(base, "/api/claims", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: "mentor02", clientId: CLIENT_A, nickname: "Alice" }),
    });
    assert.equal(third.response.status, 409);
    assert.equal(third.json.error.code, "CLAIM_LIMIT");
    const conflict = await request(base, "/api/claims", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: "learner01", clientId: CLIENT_B, nickname: "Bob" }),
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.json.error.code, "SEAT_BUSY");

    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
    assert.match(await page.text(), /4 导师＋4 学员/);

    const loadingPage = await fetch(`${base}/seat-loading.html?seat=W04`);
    assert.equal(loadingPage.status, 200);
    assert.match(loadingPage.headers.get("content-security-policy"), /default-src 'self'/);
    assert.match(await loadingPage.text(), /正在准备席位卡片/);
    assert.match(await (await fetch(`${base}/seat-loading.html?seat=W04`)).text(), /自动进入你的私人课堂视角/);

    // Exercise the real remote-console static boundary instead of a browser
    // fixture that serves source files independently. Every relative script
    // and stylesheet referenced by the seat document must be reachable from
    // the same reverse-proxy prefix with an executable MIME type.
    const seatPage = await fetch(`${base}/seat.html?seat=learner01`);
    assert.equal(seatPage.status, 200);
    const seatHtml = await seatPage.text();
    const dependencies = [...seatHtml.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)]
      .map((match) => match[1])
      .filter((value) => !value.startsWith("/"));
    assert.deepEqual(dependencies, ["seat.css", "course-preview.css", "card-view.js", "course-preview.js", "seat.js"]);
    for (const dependency of dependencies) {
      const asset = await fetch(`${base}/${dependency}`);
      assert.equal(asset.status, 200, `seat dependency ${dependency} must be served by the remote console`);
      const contentType = asset.headers.get("content-type") || "";
      assert.match(contentType, dependency.endsWith(".js") ? /javascript/ : /text\/css/);
      assert.ok((await asset.text()).length > 100, `${dependency} must not be a JSON 404 envelope`);
    }
  } finally {
    await close(consoleServer);
    await close(controller);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("browser resources remain inside an arbitrary reverse-proxy subpath", () => {
  const seatHtml = readFileSync(new URL("../static/seat.html", import.meta.url), "utf8");
  const seatJs = readFileSync(new URL("../static/seat.js", import.meta.url), "utf8");
  const consoleJs = readFileSync(new URL("../remote-console/static/console.js", import.meta.url), "utf8");
  assert.match(seatHtml, /href="seat\.css"/);
  assert.match(seatHtml, /src="seat\.js(?:\?[^"']*)?"/);
  assert.doesNotMatch(seatHtml, /(?:href|src)="\/(?:seat\.(?:css|js))"/);
  assert.match(seatJs, /new URL\(`api\/state/);
  assert.match(seatJs, /X-MSV-Seat-Lease/);
  assert.doesNotMatch(seatJs, /query\.set\(['"]lease/);
  assert.match(consoleJs, /const APP_BASE = new URL\("\."/);
});
