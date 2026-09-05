import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRemoteConsoleServer } from "../remote-console/server.mjs";

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
