import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const deployment = process.env.MSV_APP_SMOKE_TARGET === "minisv" ? "minisv" : "work";
const appPrefix = deployment === "minisv" ? "" : "/msv/demo/app";
const publicOrigin = deployment === "minisv" ? "https://minisv.vip" : "https://work.cyberforker.com";
const port = 4700 + Math.floor(Math.random() * 250);
const internalBase = `http://127.0.0.1:${port}`;
const persistPath = await mkdtemp(join(tmpdir(), `msv-${deployment}-auth-smoke-`));
const fixturePath = join(persistPath, "accounts.json");
const seedPath = join(persistPath, "seed.sql");
const wrangler = join(process.cwd(), "node_modules", ".bin", "wrangler");
const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
const password = "MSV smoke correct horse 2026!";
const resetPassword = "MSV reset worldline password 2026!";
const changedPassword = "Updated smoke learner passphrase 2026!";
const smokeFetch = (input: string | URL | Request, init: RequestInit = {}) =>
  fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(20_000) });
const accountFixture = {
  dm: { username: "smoke-dm", name: "冒烟 DM", password },
  mentors: [{ username: "smoke-mentor", name: "冒烟授课导师", password: `${password} mentor` }],
  learners: [1, 2, 3, 4].map((index) => ({ username: `smoke-${index}`, name: `冒烟学员${index}`, password: `${password}${index}` })),
  outsider: { username: "smoke-observer", name: "冒烟观察员", password: `${password} observer` },
};
let server: ChildProcess | null = null;
let diagnostics = "";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

try {
  await writeFile(fixturePath, JSON.stringify(accountFixture), { mode: 0o600 });
  const generated = spawnSync(tsx, ["scripts/generate-auth-seed.ts", "--accounts", fixturePath, "--output", seedPath], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, CI: "1", NO_COLOR: "1" }, timeout: 60_000,
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const seeded = spawnSync(wrangler, [
    "d1", "execute", "DB", "--local", "--persist-to", persistPath,
    "--config", "dist/server/wrangler.json", "--file", seedPath,
  ], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" }, maxBuffer: 4 * 1024 * 1024, timeout: 60_000 });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

  server = spawn(wrangler, [
    "dev", "--config", "wrangler.json", "--persist-to", persistPath,
    "--ip", "127.0.0.1", "--port", String(port), "--no-show-interactive-dev-session",
  ], {
    cwd: join(process.cwd(), "dist", "server"),
    env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-16_000); });
  server.stderr?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-16_000); });
  await waitUntilReady();

  const home = await smokeFetch(`${internalBase}/`, { headers: proxyHeaders() });
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.ok(homeHtml.includes(publicOrigin), `home must name ${publicOrigin}`);
  assert.match(homeHtml, new RegExp(`href="${escapeRegExp(appPrefix || "")}\\/"[^>]*aria-label="返回 Mini Silicon Valley 主页"`));
  assert.ok(homeHtml.includes(`${appPrefix}/course/`));

  const loginPage = await smokeFetch(`${internalBase}/auth/login`, { headers: proxyHeaders() });
  assert.equal(loginPage.status, 200);
  const loginHtml = await loginPage.text();
  assert.match(loginHtml, /使用你的 Mini Silicon Valley 账号登录/);
  assert.match(loginHtml, /直接注册 Young Builder/);
  assert.ok(loginHtml.includes(`${appPrefix}/auth/register`), "open learner registration must be discoverable from login");
  assert.doesNotMatch(loginHtml, /域名验证码|登录验证码|团队邀请代码|signin-with-chatgpt|WWW-Authenticate/i);

  const addAccountLoginPage = await smokeFetch(`${internalBase}/auth/login?add=1`, { headers: proxyHeaders() });
  assert.equal(addAccountLoginPage.status, 200);
  assert.ok((await addAccountLoginPage.text()).includes(`${appPrefix}/auth/recover`), "the explicit password form must retain a normal recovery link");

  const registerPage = await smokeFetch(`${internalBase}/auth/register`, { headers: proxyHeaders() });
  assert.equal(registerPage.status, 200);
  const registerHtml = await registerPage.text();
  assert.match(registerHtml, /可长期使用的 Young Builder 学员账号/);
  assert.match(registerHtml, /不会自动加入任何课堂/);
  assert.doesNotMatch(registerHtml, /MSV-[A-Z0-9-]{8,}/);

  const anonymousClassroom = await smokeFetch(`${internalBase}/classroom/`, { headers: proxyHeaders(), redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousClassroom.status));
  assert.ok((anonymousClassroom.headers.get("location") ?? "").includes(`${appPrefix}/auth/login`));
  const anonymousTeamLink = await smokeFetch(`${internalBase}/classroom/?team=TEAM-MHKNJEAG`, { headers: proxyHeaders(), redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousTeamLink.status));
  const teamLoginLocation = new URL(anonymousTeamLink.headers.get("location") ?? "", internalBase);
  assert.equal(teamLoginLocation.pathname, `${appPrefix}/auth/login`);
  assert.equal(teamLoginLocation.searchParams.get("returnTo"), "/classroom/");
  assert.ok(!teamLoginLocation.search.includes("TEAM-MHKNJEAG"), "retired team-application query must not survive the T-085 membership flow");
  assert.equal((await smokeFetch(`${internalBase}/api/classroom/bootstrap`, { headers: proxyHeaders() })).status, 410);

  const wrong = await post("/api/auth/login", { username: "smoke-dm", password: "wrong password value", remember: false });
  assert.equal(wrong.status, 401);
  assert.doesNotMatch(await wrong.text(), /smoke-dm|correct horse/i);
  assert.equal((await post("/api/auth/login", { username: "smoke-dm", password, remember: false }, undefined, "https://attacker.invalid")).status, 403);
  assert.equal((await post("/api/auth/login", { username: "smoke-dm", password: "x".repeat(17_000), remember: false })).status, 413);
  assert.equal((await post("/api/auth/login", { mode: "code", username: "smoke-1", code: "123456", remember: false })).status, 400);

  const dmLogin = await post("/api/auth/login", { username: "smoke-dm", password, remember: true });
  assert.equal(dmLogin.status, 200, await dmLogin.clone().text());
  const dmCookie = cookieFrom(dmLogin);
  const setCookie = dmLogin.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, new RegExp(`Path=${escapeRegExp(appPrefix || "/")}(?:;|$)`, "i"));
  assert.doesNotMatch(setCookie, /correct horse/i);

  const session = await getData<{ user: { username: string; role: string }; sessions: unknown[] }>("/api/auth/session", dmCookie);
  assert.equal(session.user.username, "smoke-dm");
  assert.equal(session.user.role, "admin");
  assert.equal(session.sessions.length, 1);
  const initialManagedUsers = await getData<Array<{ username: string; role: string }>>("/api/auth/admin/users", dmCookie);
  assert.equal(initialManagedUsers.length, 5);
  assert.ok(initialManagedUsers.every((candidate) => candidate.role === "learner" || candidate.role === "observer"));
  assert.ok(!initialManagedUsers.some((candidate) => candidate.username === "smoke-mentor"), "privileged mentor must not appear in learner account assistance");

  const mentorLogin = await post("/api/auth/login", { username: "smoke-mentor", password: `${password} mentor`, remember: false });
  assert.equal(mentorLogin.status, 200, await mentorLogin.clone().text());
  const mentorCookie = cookieFrom(mentorLogin);
  const mentorSession = await getData<{ user: { username: string; role: string } }>("/api/auth/session", mentorCookie);
  assert.equal(mentorSession.user.role, "mentor");

  for (const path of ["/api/auth/admin/codes", "/api/auth/admin/invitations", "/api/auth/recover", "/api/auth/recovery-codes"]) {
    const removed = await post(path, {}, dmCookie);
    assert.equal(removed.status, 404, `${path} must stay retired`);
  }

  const newBuilderRegistration = await post("/api/auth/register", {
    username: "new-builder", displayName: "新建造者", password: "New builder secure passphrase 2026!", remember: false,
  });
  assert.equal(newBuilderRegistration.status, 201, await newBuilderRegistration.clone().text());
  const registrationCookie = cookieFrom(newBuilderRegistration);
  const registrationBody = await newBuilderRegistration.json() as Envelope<{
    user: { username: string; role: string };
    admission: {
      policyVersion: string;
      role: string;
      releasedCourseware: boolean;
      classroomMembership: string;
      studio: boolean;
      candidatePreview: boolean;
      testImpersonation: boolean;
    };
  }>;
  assert.equal(registrationBody.data?.user.username, "new-builder");
  assert.equal(registrationBody.data?.user.role, "learner");
  assert.deepEqual(registrationBody.data?.admission, {
    policyVersion: "open-learner-v1",
    role: "learner",
    releasedCourseware: true,
    classroomMembership: "required",
    studio: false,
    candidatePreview: false,
    testImpersonation: false,
  });
  assert.equal((await post("/api/auth/register", {
    username: "new-builder", displayName: "重复账号", password: "Duplicate builder secure passphrase 2026!", remember: false,
  })).status, 409);

  const learnerLogin = await post("/api/auth/login", { username: "smoke-1", password: `${password}1`, remember: false });
  assert.equal(learnerLogin.status, 200, await learnerLogin.clone().text());
  const learnerCookie = cookieFrom(learnerLogin);

  assert.deepEqual(await getData<unknown[]>("/api/platform/classrooms", registrationCookie), [], "registration must not create a classroom Membership");
  assert.equal((await get("/api/studio/bootstrap", registrationCookie)).status, 403, "open registration must not grant Studio or Candidate access");
  const releasedCourseware = await smokeFetch(`${internalBase}/course/`, { headers: proxyHeaders(registrationCookie) });
  assert.equal(releasedCourseware.status, 200, "a real learner may browse Released courseware");
  assert.match(await releasedCourseware.text(), /COURSE LIBRARY|课程目录/);

  const mentorKnownAccounts = await getData<Array<{ username: string }>>("/api/studio/accounts", mentorCookie);
  assert.deepEqual(mentorKnownAccounts.map((account) => account.username), ["smoke-mentor"], "mentor directory must default to its scoped roster");
  const exactAccount = await getData<Array<{ username: string; role: string }>>(
    `/api/studio/accounts?q=${encodeURIComponent("new-builder")}`,
    mentorCookie,
  );
  assert.deepEqual(exactAccount.map((account) => [account.username, account.role]), [["new-builder", "learner"]]);
  assert.deepEqual(await getData<unknown[]>(`/api/studio/accounts?q=${encodeURIComponent("new")}`, mentorCookie), [], "partial global account search must stay disabled");

  const legacyChecks: Array<{ path: string; method: "GET" | "POST" }> = [
    { path: "/api/classroom/bootstrap", method: "GET" },
    { path: "/api/classroom/join", method: "POST" },
    { path: "/api/classroom/rooms", method: "POST" },
    { path: "/api/classroom/rooms/retired-room", method: "GET" },
    { path: "/api/classroom/rooms/retired-room/actions", method: "POST" },
    { path: "/api/classroom/rooms/retired-room/export", method: "GET" },
    { path: "/api/classroom/rooms/retired-room/learners?q=new-builder", method: "GET" },
  ];
  for (const legacy of legacyChecks) {
    const response = legacy.method === "GET"
      ? await get(legacy.path, learnerCookie)
      : await post(legacy.path, { sentinel: "retired" }, learnerCookie);
    assert.equal(response.status, 410, `${legacy.path} must fail closed in the application`);
    const body = await response.json() as Envelope<never>;
    assert.equal(body.error?.code, "LEGACY_CLASSROOM_API_RETIRED");
  }

  const resetLink = await postData<{ resetUrl: string; username: string; expiresAt: string }>(
    "/api/auth/admin/reset-links", { username: "new-builder" }, dmCookie,
  );
  assert.equal(resetLink.username, "new-builder");
  const resetUrl = new URL(resetLink.resetUrl);
  assert.equal(resetUrl.origin, publicOrigin);
  assert.equal(resetUrl.pathname, `${appPrefix}/auth/reset`);
  assert.equal(resetUrl.search, "");
  assert.match(resetUrl.hash, /^#token=[A-Za-z0-9_-]{43}$/);
  const token = new URLSearchParams(resetUrl.hash.slice(1)).get("token");
  assert.ok(token);
  const reset = await post("/api/auth/reset", { token, newPassword: resetPassword });
  assert.equal(reset.status, 200, await reset.clone().text());
  const resetCookie = cookieFrom(reset);
  assert.equal((await get("/api/auth/session", registrationCookie)).status, 401, "reset must revoke old sessions");
  assert.equal((await post("/api/auth/reset", { token, newPassword: "Replayed reset password must fail 2026!" })).status, 401, "reset URL must be single-use");
  assert.equal((await post("/api/auth/login", { username: "new-builder", password: "New builder secure passphrase 2026!", remember: false })).status, 401);
  assert.equal((await get("/api/auth/session", resetCookie)).status, 200);
  assert.equal((await post("/api/auth/admin/reset-links", { username: "smoke-dm" }, dmCookie)).status, 403, "privileged accounts must stay backend-managed");

  const secondLearnerLogin = await post("/api/auth/login", { username: "smoke-1", password: `${password}1`, remember: false });
  assert.equal(secondLearnerLogin.status, 200, await secondLearnerLogin.clone().text());
  const secondLearnerCookie = cookieFrom(secondLearnerLogin);
  const renamed = await mutate("/api/auth/profile", "PATCH", { displayName: "冒烟学员一号" }, learnerCookie);
  assert.equal(renamed.status, 200, await renamed.clone().text());
  const passwordChange = await mutate("/api/auth/profile", "PATCH", { currentPassword: `${password}1`, newPassword: changedPassword }, learnerCookie);
  assert.equal(passwordChange.status, 200, await passwordChange.clone().text());
  assert.equal((await get("/api/auth/session", secondLearnerCookie)).status, 401, "password change must revoke other devices");
  assert.equal((await post("/api/auth/login", { username: "smoke-1", password: `${password}1`, remember: false })).status, 401);
  assert.equal((await post("/api/auth/login", { username: "smoke-1", password: changedPassword, remember: false })).status, 200);

  const assetPath = homeHtml.match(new RegExp(`["'](${escapeRegExp(appPrefix)}\\/_next\\/[^"']+)["']`))?.[1];
  assert.ok(assetPath, `HTML must emit assets beneath the ${deployment} base path`);
  assert.equal((await smokeFetch(`${internalBase}${assetPath.slice(appPrefix.length)}`, { headers: proxyHeaders() })).status, 200);

  const logout = await post("/api/auth/logout", {}, dmCookie);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.equal((await get("/api/auth/session", dmCookie)).status, 401);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const rejected = await post("/api/auth/login", { username: "rate-limit-user", password: "definitely incorrect password", remember: false });
    assert.equal(rejected.status, 401, `attempt ${attempt + 1}: ${await rejected.text()}\n${diagnostics}`);
  }
  const limited = await post("/api/auth/login", { username: "rate-limit-user", password: "definitely incorrect password", remember: false });
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get("retry-after") ?? "", /^\d+$/);

  console.log(`${deployment.toUpperCase()}_APP_SMOKE_PASS auth=password registration=open-learner membership=required released-courseware=allowed studio=forbidden legacy-classroom=410 reset=single-use-fragment`);
} catch (error) {
  if (diagnostics.trim()) console.error(`WRANGLER_DIAGNOSTICS\n${diagnostics}`);
  throw error;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(persistPath, { recursive: true, force: true });
}

function proxyHeaders(cookie?: string): Record<string, string> {
  return {
    Accept: "application/json",
    Host: new URL(publicOrigin).host,
    "X-Forwarded-Host": new URL(publicOrigin).host,
    "X-Forwarded-Proto": "https",
    ...(appPrefix ? { "X-Forwarded-Prefix": appPrefix } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function get(path: string, cookie?: string): Promise<Response> {
  return smokeFetch(`${internalBase}${path}`, { headers: proxyHeaders(cookie) });
}

async function post(path: string, body: unknown, cookie?: string, origin = publicOrigin): Promise<Response> {
  return smokeFetch(`${internalBase}${path}`, {
    method: "POST",
    headers: { ...proxyHeaders(cookie), Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body: unknown, cookie: string): Promise<Response> {
  return smokeFetch(`${internalBase}${path}`, {
    method,
    headers: { ...proxyHeaders(cookie), Origin: publicOrigin, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function postData<T = Record<string, unknown>>(path: string, body: unknown, cookie?: string): Promise<T> {
  const response = await post(path, body, cookie);
  const envelope = await response.json() as Envelope<T>;
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`);
  assert.equal(envelope.ok, true, `${path}: ${JSON.stringify(envelope)}`);
  assert.ok(envelope.data !== undefined);
  return envelope.data;
}

async function getData<T>(path: string, cookie: string): Promise<T> {
  const response = await get(path, cookie);
  const envelope = await response.json() as Envelope<T>;
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`);
  assert.equal(envelope.ok, true, `${path}: ${JSON.stringify(envelope)}`);
  assert.ok(envelope.data !== undefined);
  return envelope.data;
}

function cookieFrom(response: Response): string {
  const first = (response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  assert.match(first, /^__Secure-msv_session=.+/);
  return first;
}

async function waitUntilReady(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) throw new Error(`Wrangler stopped before readiness.\n${diagnostics}`);
    try {
      const response = await get("/api/auth/session");
      if (response.status === 401) return;
    } catch { /* Wrangler is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Wrangler did not become ready.\n${diagnostics}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
