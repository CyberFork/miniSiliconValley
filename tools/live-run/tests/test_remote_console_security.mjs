import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRemoteConsoleServer, projectSeatState } from "../remote-console/server.mjs";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

function close(server) { return new Promise((resolve) => server.close(resolve)); }

test("console forwards the private service key only to controller reads", async () => {
  const seen = [];
  const fetchImpl = async (url, options = {}) => {
    seen.push({ url: String(url), headers: options.headers || {} });
    const path = new URL(url).pathname;
    const data = path.endsWith("/api/state")
      ? { scriptId: "s", status: "ready", currentBlockIndex: 0, seats: [] }
      : { id: "s", course: { name: "Google", coverage: "5步" }, blocks: Array(13).fill({}) };
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const root = mkdtempSync(join(tmpdir(), "msv-console-test-"));
  const server = createRemoteConsoleServer({
    controllerBase: "http://127.0.0.1:18790",
    controllerServiceKey: "k".repeat(48),
    fetchImpl,
    statePath: join(root, "claims.json"),
  });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/console?clientId=test_client_1234567890`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.ok(seen.length >= 2);
    assert.ok(seen.every((item) => item.headers["X-Live-Run-Service-Key"] === "k".repeat(48)));
  } finally {
    await close(server); rmSync(root, { recursive: true, force: true });
  }
});

test("service key file must be private", async () => {
  const root = mkdtempSync(join(tmpdir(), "msv-key-test-"));
  const key = join(root, "service.key"); writeFileSync(key, "s".repeat(48)); chmodSync(key, 0o644);
  const previous = process.env.MSV_CONTROLLER_SERVICE_KEY_FILE;
  process.env.MSV_CONTROLLER_SERVICE_KEY_FILE = key;
  try {
    assert.throws(() => createRemoteConsoleServer(), /private/);
  } finally {
    if (previous === undefined) delete process.env.MSV_CONTROLLER_SERVICE_KEY_FILE; else process.env.MSV_CONTROLLER_SERVICE_KEY_FILE = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("alpha opens same-origin protected controller and contains no old origin", () => {
  const js = readFileSync(new URL("../remote-console/static/console.js", import.meta.url), "utf8");
  assert.match(js, /new URL\("\.\.\/control\/", APP_BASE\)/);
  assert.doesNotMatch(js, /127\.0\.0\.1:18765|192\.168\.|work\.cyberforker\.com/);
});

test("CLI entrypoint starts when invoked through a release symlink", async () => {
  const { spawn } = await import("node:child_process");
  const { createServer } = await import("node:net");
  const { symlinkSync } = await import("node:fs");
  const root = mkdtempSync(join(tmpdir(), "msv-release-link-"));
  const probe = createServer();
  const port = await new Promise((resolve) => probe.listen(0, "127.0.0.1", () => resolve(probe.address().port)));
  await new Promise((resolve) => probe.close(resolve));
  const target = new URL("../remote-console", import.meta.url);
  const link = join(root, "current"); symlinkSync(target, link, "dir");
  const child = spawn(process.execPath, [join(link, "server.mjs")], {
    env: { ...process.env, MSV_CONSOLE_HOST: "127.0.0.1", MSV_CONSOLE_PORT: String(port), MSV_CONSOLE_STATE: join(root, "claims.json") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const ready = await Promise.race([
      new Promise((resolve, reject) => {
        child.stdout.on("data", (chunk) => { if (String(chunk).includes("MSV_REMOTE_CONSOLE_READY")) resolve(true); });
        child.once("exit", (code) => reject(new Error(`entrypoint exited before listen: ${code}`)));
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("entrypoint start timeout")), 3000)),
    ]);
    assert.equal(ready, true);
    assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    rmSync(root, { recursive: true, force: true });
  }
});


test("seat projection carries revision signal and never leaks another learner hand", () => {
  const state = {
    schemaVersion: 4, courseId: "google-1995-2004", runId: "run-1", updatedAt: "now",
    version: 7, status: "ready", currentBlockIndex: 1, previewBlockIndex: 0,
    lastCompletedBlockIndex: 0, courseRevision: 3, courseDigest: "abc123", courseVariant: "draft", refreshEpoch: 2,
    seats: [
      { id: "learner01", window: "W04", title: "Young Builder 01", kind: "learner", blockId: "B01" },
      { id: "learner02", window: "W05", title: "Young Builder 02", kind: "learner", blockId: "B01" },
    ],
    classroom: {
      roomId: "room", learnerViews: {
        learner01: { displayName: "One", cards: [{ id: "private-one", title: "A", body: "one", sharePrompt: "share", sourceIds: ["src-1"], evidenceBoundary: "F" }] },
        learner02: { displayName: "Two", cards: [{ id: "private-two", title: "B", body: "two", sharePrompt: "share", sourceIds: [], evidenceBoundary: "R" }] },
      },
    },
  };
  const projected = projectSeatState(state, "learner01");
  assert.equal(projected.courseRevision, 3); assert.equal(projected.courseDigest, "abc123");
  assert.equal(projected.previewBlockIndex, 0); assert.equal(projected.refreshEpoch, 2);
  assert.deepEqual(Object.keys(projected.classroom.learnerViews), ["learner01"]);
  assert.equal(projected.classroom.learnerViews.learner01.cards[0].id, "private-one");
  assert.deepEqual(projected.classroom.learnerViews.learner01.cards[0].sourceIds, ["src-1"]);
  assert.equal(JSON.stringify(projected).includes("private-two"), false);
});

test("console invalidates script cache when same course id gets a new digest", async () => {
  let digest = "digest-one"; let scriptReads = 0;
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/api/script")) scriptReads += 1;
    const data = path.endsWith("/api/state")
      ? { scriptId: "same-script", courseDigest: digest, status: "ready", currentBlockIndex: 0, previewBlockIndex: 0, seats: [] }
      : { id: "same-script", course: { name: `Course ${digest}`, coverage: "5步" }, blocks: Array(13).fill({}) };
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const root = mkdtempSync(join(tmpdir(), "msv-console-cache-"));
  const server = createRemoteConsoleServer({ controllerBase: "http://127.0.0.1:18790", controllerServiceKey: "k".repeat(48), fetchImpl, statePath: join(root, "claims.json") });
  const port = await listen(server);
  try {
    await fetch(`http://127.0.0.1:${port}/api/console?clientId=cache_client_1234567890`);
    digest = "digest-two";
    const response = await fetch(`http://127.0.0.1:${port}/api/console?clientId=cache_client_1234567890`);
    assert.equal(response.status, 200); assert.equal(scriptReads, 2);
  } finally { await close(server); rmSync(root, { recursive: true, force: true }); }
});
