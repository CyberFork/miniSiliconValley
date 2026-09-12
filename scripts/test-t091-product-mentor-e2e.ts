import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 5500 + Math.floor(Math.random() * 300);
const internalBase = `http://127.0.0.1:${port}`;
const publicOrigin = "https://minisv.vip";
const persistPath = await mkdtemp(join(tmpdir(), "msv-t091-e2e-"));
const fixturePath = join(persistPath, "accounts.json");
const seedPath = join(persistPath, "seed.sql");
const wrangler = join(process.cwd(), "node_modules", ".bin", "wrangler");
const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
const candidatePath = process.env.MSV_T091_CANDIDATE_PATH
  ? join(process.cwd(), process.env.MSV_T091_CANDIDATE_PATH)
  : join(process.cwd(), "tools/live-run/courses/candidates/eleme-2008-unified-t095.json");
const password = "T091 product mentor E2E password 2026!";
const fixture = {
  dm: { username: "t091-admin", name: "T091 Admin DM", password },
  mentors: ["p", "d", "m", "o"].map((code) => ({
    username: `t091-mentor-${code}`,
    name: `${code.toUpperCase()} 导师`,
    password: `${password} ${code}`,
  })),
  learners: [1, 2].map((number) => ({
    username: `t091-builder-${number}`,
    name: `Young Builder ${String(number).padStart(2, "0")}`,
    password: `${password} ${number}`,
  })),
  outsider: { username: "t091-outsider", name: "T091 Outsider", password: `${password} outsider` },
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; details?: unknown } };
type ExactRef = { courseId: string; schemaVersion: number; revision: number; digest: string; status: "candidate" | "released" | "archived" };
type Courseware = {
  packageId: string;
  slug: string;
  title: string;
  mentorRole: "P" | "D" | "M" | "O";
  latestRevision: number;
  latestDigest: string;
  releasedRevision: number | null;
  releasedDigest: string | null;
  versions: Array<{ revision: number; digest: string; releaseStatus: "current" | "historical" | null }>;
};
type Bootstrap = { user: { userId: string }; courseware: Courseware[] };
type Credential = { userId: string; username: string; role: "mentor" | "learner" };
type ScriptProgress = { unlockedThroughBlockId: string; unlockedThroughIndex: number; version: number; runtimeIdentity?: { runId: string; resetGeneration: number } };
type MentorView = {
  kind: "mentor";
  mentorRole: "P" | "D" | "M" | "O";
  privateScript: string[];
  contentContext: {
    mode: "owner" | "handoff" | "none";
    checkpoint: null | { id: string; coursewareCue: { slideStart: number; slideEnd: number } };
  };
};
type Submission = {
  id: string;
  profileId: string;
  schemaId: string | null;
  values: Record<string, string> | null;
  status: string;
  reviewFeedback: string | null;
  version: number;
  resetGeneration: number;
  updatedAt: string;
};
type Detail = {
  page: { id: string };
  script: ScriptProgress;
  runtimeIdentity: { runId: string; resetGeneration: number };
  myView: MentorView | { kind: "learner" } | null;
  activitySchema: null | {
    id: string;
    kind: string;
    ownerMentorRole?: string;
    fields: Array<Record<string, unknown>>;
    mentorRubric: null | string[];
  };
  submissions: Submission[];
  courseware: Array<{ mentorRole: string; packageId: string; slug: string; revision: number; digest: string }>;
  handoffs: Array<{
    fromMentorRole: string;
    toMentorRole: string;
    fromBlockId: string;
    availableAtBlockId: string;
    submission: Submission;
  }>;
};

let server: ChildProcess | null = null;
let diagnostics = "";

try {
  await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
  const generated = spawnSync(tsx, ["scripts/generate-auth-seed.ts", "--accounts", fixturePath, "--output", seedPath], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60_000, env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const seeded = spawnSync(wrangler, [
    "d1", "execute", "DB", "--local", "--persist-to", persistPath,
    "--config", "dist/server/wrangler.json", "--file", seedPath,
  ], { cwd: process.cwd(), encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" } });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

  server = spawn(wrangler, [
    "dev", "--config", "wrangler.json", "--persist-to", persistPath,
    "--ip", "127.0.0.1", "--port", String(port), "--no-show-interactive-dev-session",
  ], {
    cwd: join(process.cwd(), "dist", "server"),
    env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-20_000); });
  server.stderr?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-20_000); });
  await waitUntilReady();

  const adminCookie = await login(fixture.dm.username, fixture.dm.password);
  const bootstrap = await getData<Bootstrap>("/api/studio/bootstrap", adminCookie);
  const pCourseware = bootstrap.courseware.find((item) => item.mentorRole === "P");
  assert.ok(pCourseware);
  assert.deepEqual(
    { packageId: pCourseware.packageId, slug: pCourseware.slug, revision: pCourseware.latestRevision, digest: pCourseware.latestDigest },
    {
      packageId: "cw-product-mentor-foundations",
      slug: "product-mentor-foundations",
      revision: 1,
      digest: "8ade4830d08f901aba7ed4abc3ae73fd39a0a5f4e16a96935ca38603ba395346",
    },
    "the product-manager package default must advance to immutable r1",
  );
  assert.deepEqual(
    pCourseware.versions.map((version) => [version.revision, version.releaseStatus]),
    [[1, "current"], [0, "historical"]],
    "the exact T-091 r0 must remain available for the historical Candidate",
  );

  const course = JSON.parse(await readFile(candidatePath, "utf8")) as {
    blocks: Array<{ id: string }>;
    learnerPolicy?: { minCount: number; maxCount: number };
    contentPackages?: { scriptPackages: Array<{ coursewareRef: { mentorRole: "P" | "D" | "M" | "O"; packageId: string; slug: string; revision: number; digest: string } }> };
  };
  const candidate = await postData<ExactRef>("/api/studio/candidates", { course, expectedCandidateRef: null }, adminCookie);
  assert.equal(candidate.status, "candidate");
  const viewReceipt = await postData<{ receiptId: string; valid: boolean }>("/api/studio/view-acceptance", {
    courseRef: candidate,
    reviewedBlockIds: course.blocks.map((block) => block.id),
    reviewedLearnerCounts: Array.from(
      { length: (course.learnerPolicy?.maxCount ?? 4) - (course.learnerPolicy?.minCount ?? 2) + 1 },
      (_, index) => (course.learnerPolicy?.minCount ?? 2) + index,
    ),
  }, adminCookie);
  assert.equal(viewReceipt.valid, true);

  const credentials = await postData<Credential[]>("/api/studio/accounts", {
    accounts: [
      ...(["P", "D", "M", "O"] as const).map((role) => ({ username: `t091-seat-${role.toLowerCase()}`, displayName: `${role} T091 导师`, role: "mentor" })),
      ...[1, 2].map((number) => ({ username: `t091-seat-builder-${number}`, displayName: `T091 Builder ${number}`, role: "learner" })),
    ],
  }, adminCookie);
  const mentorProfiles = credentials.filter((item) => item.role === "mentor");
  const learnerProfiles = credentials.filter((item) => item.role === "learner");
  assert.equal(mentorProfiles.length, 4);
  assert.equal(learnerProfiles.length, 2);

  const preferredCourseware = {
    P: "product-mentor-foundations",
    D: "development-mentor-ligun",
    M: "market-mentor-user-system",
    O: "operations-mentor-field-kit",
  } as const;
  const exactCourseware = (["P", "D", "M", "O"] as const).map((mentorRole) => {
    const item = bootstrap.courseware.find((candidate) => candidate.mentorRole === mentorRole && candidate.slug === preferredCourseware[mentorRole]);
    assert.ok(item, `missing ${mentorRole} exact courseware`);
    return {
      mentorRole,
      packageId: item.packageId,
      slug: item.slug,
      revision: item.releasedRevision!,
      digest: item.releasedDigest!,
    };
  });
  const factoryBody = {
    environment: "test",
    title: "T-091 P 导师饿了么最短闭环",
    learnerCount: 2,
    courseRef: candidate,
    viewAcceptanceReceiptId: viewReceipt.receiptId,
    adminDmProfileIds: [bootstrap.user.userId],
    mentorSeats: (["P", "D", "M", "O"] as const).map((mentorRole, index) => ({ mentorRole, profileId: mentorProfiles[index].userId })),
    learnerProfileIds: learnerProfiles.map((item) => item.userId),
  };
  const room = await postData<{ classroomId: string }>("/api/platform/classrooms", factoryBody, adminCookie);

  const pB01 = await view(room.classroomId, "B01", mentorProfiles[0].userId, adminCookie);
  assert.equal(pB01.myView?.kind, "mentor");
  assert.equal((pB01.myView as MentorView).contentContext.mode, "owner");
  assert.equal((pB01.myView as MentorView).contentContext.checkpoint?.id, "p-a-enter-2008");
  assert.ok((pB01.myView as MentorView).privateScript.length > 0, "active P receives the B01 private host script");
  for (let index = 1; index < mentorProfiles.length; index += 1) {
    const supportView = await view(room.classroomId, "B01", mentorProfiles[index].userId, adminCookie);
    assert.equal((supportView.myView as MentorView).privateScript.length, 0, "D/M/O must not inherit the P historical narration");
    assert.equal((supportView.myView as MentorView).contentContext.mode, "none");
  }

  let progress = pB01.script;
  for (const nextBlockId of ["B02", "B03", "B04"]) {
    const run = await runtime(room.classroomId, "B01", adminCookie);
    progress = await postData<ScriptProgress>(`/api/platform/classrooms/${room.classroomId}/control`, {
      expectedVersion: progress.version, ...runExpectation(run), action: { type: "unlock-next", nextBlockId },
    }, adminCookie);
  }

  const learnerB04Before = await view(room.classroomId, "B04", learnerProfiles[0].userId, adminCookie);
  assert.equal(learnerB04Before.activitySchema?.id, "product-brief-v1");
  assert.equal(learnerB04Before.activitySchema?.mentorRubric, null, "learner response must redact mentor-only rubric");
  assert.equal(learnerB04Before.activitySchema?.fields.some((field) => "mentorPrompt" in field), false, "learner response must redact mentor prompts");

  const values = productBriefValues("第一版");
  const genericSubmission = await post(`/api/platform/classrooms/${room.classroomId}/submissions`, {
    blockId: "B04", kind: "product-brief", text: "未带 schema 的提交", viewAsProfileId: learnerProfiles[0].userId,
    ...submissionExpectation(learnerB04Before, 0, `p-generic-${room.classroomId}`),
  }, adminCookie);
  assert.equal(genericSubmission.status, 409);
  assert.equal((await genericSubmission.json() as Envelope<never>).error?.code, "SUBMISSION_SCHEMA_REQUIRED");
  await postData(`/api/platform/classrooms/${room.classroomId}/submissions`, {
    blockId: "B04",
    schemaId: "product-brief-v1",
    values,
    viewAsProfileId: learnerProfiles[0].userId,
    ...submissionExpectation(learnerB04Before, 0, `p-submit-v1-${room.classroomId}`),
  }, adminCookie);
  const learnerB04 = await view(room.classroomId, "B04", learnerProfiles[0].userId, adminCookie);
  assert.equal(learnerB04.submissions.length, 1);
  assert.equal(learnerB04.submissions[0].status, "submitted");
  assert.deepEqual(learnerB04.submissions[0].values, values, "refresh must return the persisted ProductBrief values");
  const otherLearnerB04 = await view(room.classroomId, "B04", learnerProfiles[1].userId, adminCookie);
  assert.equal(otherLearnerB04.submissions.length, 0, "one learner must not read another learner's private draft");
  const dB04 = await view(room.classroomId, "B04", mentorProfiles[1].userId, adminCookie);
  assert.equal(dB04.activitySchema, null);
  assert.equal(dB04.submissions.length, 0, "D must not read the P-owned ProductBrief before the accepted handoff");

  let pB04 = await view(room.classroomId, "B04", mentorProfiles[0].userId, adminCookie);
  assert.equal(pB04.activitySchema?.mentorRubric?.length, 5);
  assert.equal(pB04.submissions.length, 1);
  const firstSubmission = pB04.submissions[0];
  const wrongReviewer = await post(`/api/platform/classrooms/${room.classroomId}/submissions/${firstSubmission.id}/review`, {
    status: "rejected", feedback: "D 不应审核 P 的作品。",
    ...submissionExpectation(pB04, firstSubmission.version, `p-review-wrong-${room.classroomId}`),
    viewAsProfileId: mentorProfiles[1].userId,
  }, adminCookie);
  assert.equal(wrongReviewer.status, 403);
  assert.equal((await wrongReviewer.json() as Envelope<never>).error?.code, "SUBMISSION_REVIEW_OWNER_REQUIRED");
  await postData(`/api/platform/classrooms/${room.classroomId}/submissions/${firstSubmission.id}/review`, {
    status: "rejected",
    feedback: "请把目标用户缩小到东川路宿舍里晚上九点后要订餐的学生。",
    ...submissionExpectation(pB04, firstSubmission.version, `p-review-reject-${room.classroomId}`),
    viewAsProfileId: mentorProfiles[0].userId,
  }, adminCookie);
  const returned = await view(room.classroomId, "B04", learnerProfiles[0].userId, adminCookie);
  assert.equal(returned.submissions[0].status, "rejected");
  assert.match(returned.submissions[0].reviewFeedback ?? "", /目标用户/);

  const revisedValues = productBriefValues("第二版");
  revisedValues["target-user"] = "东川路宿舍里晚上九点后想订餐的学生";
  await postData(`/api/platform/classrooms/${room.classroomId}/submissions`, {
    blockId: "B04",
    schemaId: "product-brief-v1",
    values: revisedValues,
    viewAsProfileId: learnerProfiles[0].userId,
    ...submissionExpectation(returned, returned.submissions[0].version, `p-submit-v2-${room.classroomId}`),
  }, adminCookie);
  const resubmitted = await view(room.classroomId, "B04", learnerProfiles[0].userId, adminCookie);
  assert.equal(resubmitted.submissions[0].status, "submitted");
  assert.equal(resubmitted.submissions[0].reviewFeedback, null, "resubmission must clear the stale review feedback");
  assert.deepEqual(resubmitted.submissions[0].values, revisedValues);

  pB04 = await view(room.classroomId, "B04", mentorProfiles[0].userId, adminCookie);
  const revisedSubmission = pB04.submissions[0];
  await postData(`/api/platform/classrooms/${room.classroomId}/submissions/${revisedSubmission.id}/review`, {
    status: "accepted",
    feedback: "问题、证据、最小路径和边界已对齐，可以交给开发导师。",
    ...submissionExpectation(pB04, revisedSubmission.version, `p-review-accept-${room.classroomId}`),
    viewAsProfileId: mentorProfiles[0].userId,
  }, adminCookie);
  const accepted = await view(room.classroomId, "B04", learnerProfiles[0].userId, adminCookie);
  assert.equal(accepted.submissions[0].status, "accepted");
  const staleReplay = await post(`/api/platform/classrooms/${room.classroomId}/submissions/${revisedSubmission.id}/review`, {
    status: "accepted", feedback: "旧版本重放",
    ...submissionExpectation(pB04, revisedSubmission.version, `p-review-stale-${room.classroomId}`),
    viewAsProfileId: mentorProfiles[0].userId,
  }, adminCookie);
  assert.equal(staleReplay.status, 409);
  assert.equal((await staleReplay.json() as Envelope<never>).error?.code, "SUBMISSION_VERSION_CONFLICT");

  const runAtB04 = await runtime(room.classroomId, "B04", adminCookie);
  progress = await postData<ScriptProgress>(`/api/platform/classrooms/${room.classroomId}/control`, {
    expectedVersion: progress.version, ...runExpectation(runAtB04), action: { type: "unlock-next", nextBlockId: "B05" },
  }, adminCookie);
  assert.equal(progress.unlockedThroughBlockId, "B05");
  const dB05 = await view(room.classroomId, "B05", mentorProfiles[1].userId, adminCookie);
  assert.equal((dB05.myView as MentorView).contentContext.mode, "owner", "D owns its B05 facilitation script; the accepted ProductBrief arrives through the separate handoff projection");
  assert.ok((dB05.myView as MentorView).privateScript.length > 0, "D keeps its own development-stage facilitation script");
  const dScript = (dB05.myView as MentorView).privateScript.join("\n");
  assert.match(dScript, /课堂模拟，不是饿了么历史/, "D explicitly marks the boundary instead of presenting its incident as history");
  assert.doesNotMatch(dScript, /2008|宿舍现场|亲自送餐/, "D gets the accepted artifact without inheriting P's historical narration");
  assert.equal(dB05.submissions.length, 0, "P-owned raw submission list remains private");
  assert.equal(dB05.handoffs.length, 1);
  assert.deepEqual(
    { from: dB05.handoffs[0].fromMentorRole, to: dB05.handoffs[0].toMentorRole, status: dB05.handoffs[0].submission.status },
    { from: "P", to: "D", status: "accepted" },
  );
  assert.deepEqual(dB05.handoffs[0].submission.values, revisedValues);
  for (const mentorIndex of [2, 3]) {
    const unrelated = await view(room.classroomId, "B05", mentorProfiles[mentorIndex].userId, adminCookie);
    assert.equal(unrelated.handoffs.length, 0, "M/O must not receive the P→D handoff");
  }

  const mismatchedP = await postData<{ packageId: string; slug: string; revision: number; digest: string }>("/api/studio/courseware", {
    slug: "t091-mismatched-product-courseware",
    title: `${pCourseware.title} · mismatch fixture`,
    mentorRole: "P",
    html: "<!doctype html><html><body><h1>T-091 mismatch fixture</h1></body></html>",
  }, adminCookie);
  assert.equal(mismatchedP.revision, 0);
  const mismatchedRefs = exactCourseware.map((ref) => ref.mentorRole === "P"
    ? { mentorRole: "P" as const, packageId: mismatchedP.packageId, slug: mismatchedP.slug, revision: mismatchedP.revision, digest: mismatchedP.digest }
    : ref);
  const decoupled = await postData<{ classroomId: string }>("/api/platform/classrooms", { ...factoryBody, title: "T-091 deck selection is server-owned", coursewareRefs: mismatchedRefs }, adminCookie);
  const decoupledDetail = await view(decoupled.classroomId, "B01", mentorProfiles[0].userId, adminCookie);
  assert.deepEqual(
    decoupledDetail.courseware.find((item) => item.mentorRole === "P"),
    exactCourseware.find((item) => item.mentorRole === "P"),
    "a stale or unrelated client deck must not override the server's current released P courseware",
  );
  const latestPDeck = await get(`/classroom/${decoupled.classroomId}/courseware/P/`, adminCookie);
  assert.equal(latestPDeck.status, 200);
  assert.ok((await latestPDeck.text()).includes(exactCourseware.find((item) => item.mentorRole === "P")!.digest), "classroom P link must render the newest released P deck");

  console.log("T091_PRODUCT_MENTOR_E2E_PASS candidate=t095-unified checkpoints=P:B01-B04 productBrief=return-resubmit-accept handoff=P-to-D:B05 DMO=no-history-copy courseware=latest-decoupled");
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(persistPath, { recursive: true, force: true });
}

function productBriefValues(version: string): Record<string, string> {
  return {
    "target-user": `${version}：东川路宿舍里晚上想订餐的学生`,
    "user-task": "晚上留在宿舍时，找到仍在营业且能够送到的餐厅并完成下单。",
    "observed-problem": "旧菜单可能过期，电话逐家询问很慢，也不知道餐厅是否营业和是否配送。",
    "facts-and-sources": "F-01：2008 年开始尝试餐饮外送。\nC-05：创始成员亲自送餐。",
    assumptions: "学生愿意把电话询问改成使用一个统一入口。",
    unknowns: "还不知道每天晚间有多少订单；下一步记录一周电话和送餐次数。",
    "value-hypothesis": "如果统一展示可订餐厅并确认订单，学生会少打电话并更快知道是否下单成功。",
    "core-journey": "看到餐厅与菜品 → 选择并提交订单 → 收到已接单或无法配送的明确回执。",
    "mvp-hypothesis": "一张维护及时的菜单加人工确认，是否足以让真实学生完成一次订餐。",
    boundaries: "不公开私人电话；只覆盖宿舍周边；先人工确认，不承诺所有餐厅和所有时段。",
  };
}

async function runtime(roomId: string, blockId: string, cookie: string): Promise<Detail["runtimeIdentity"]> { return (await getData<Detail>(`/api/platform/classrooms/${roomId}?block=${blockId}`, cookie)).runtimeIdentity; }

function runExpectation(runtimeIdentity: Detail["runtimeIdentity"]) {
  return { expectedRunId: runtimeIdentity.runId, expectedResetGeneration: runtimeIdentity.resetGeneration };
}

function submissionExpectation(detail: Pick<Detail, "runtimeIdentity">, expectedVersion: number, idempotencyKey: string) {
  return { ...runExpectation(detail.runtimeIdentity), expectedVersion, idempotencyKey };
}

async function view(roomId: string, blockId: string, profileId: string, cookie: string): Promise<Detail> {
  return getData<Detail>(`/api/platform/classrooms/${roomId}?block=${blockId}&viewAs=${profileId}`, cookie);
}

async function login(username: string, passwordValue: string): Promise<string> {
  const response = await post("/api/auth/login", { username, password: passwordValue, remember: false });
  assert.equal(response.status, 200, `${username}: ${await response.clone().text()}`);
  const cookie = (response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  assert.match(cookie, /^__Secure-msv_session=.+/);
  return cookie;
}

function proxyHeaders(cookie?: string): Record<string, string> {
  return {
    Accept: "application/json",
    Host: "minisv.vip",
    "X-Forwarded-Host": "minisv.vip",
    "X-Forwarded-Proto": "https",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function get(path: string, cookie?: string): Promise<Response> {
  return fetch(`${internalBase}${path}`, { headers: proxyHeaders(cookie), signal: AbortSignal.timeout(20_000) });
}

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${internalBase}${path}`, {
    method: "POST",
    headers: { ...proxyHeaders(cookie), Origin: publicOrigin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
}

async function getData<T>(path: string, cookie: string): Promise<T> {
  const response = await get(path, cookie);
  const envelope = await response.json() as Envelope<T>;
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`);
  assert.equal(envelope.ok, true, `${path}: ${JSON.stringify(envelope)}`);
  assert.ok(envelope.data !== undefined);
  return envelope.data;
}

async function postData<T = Record<string, unknown>>(path: string, body: unknown, cookie: string): Promise<T> {
  const response = await post(path, body, cookie);
  const envelope = await response.json() as Envelope<T>;
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`);
  assert.equal(envelope.ok, true, `${path}: ${JSON.stringify(envelope)}`);
  assert.ok(envelope.data !== undefined);
  return envelope.data;
}

async function waitUntilReady(): Promise<void> {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) throw new Error(`Wrangler stopped before readiness.\n${diagnostics}`);
    try {
      if ((await get("/api/auth/session")).status === 401) return;
    } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Wrangler did not become ready.\n${diagnostics}`);
}
