import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 5800 + Math.floor(Math.random() * 300);
const internalBase = `http://127.0.0.1:${port}`;
const publicOrigin = "https://minisv.vip";
const persistPath = await mkdtemp(join(tmpdir(), "msv-t090-e2e-"));
const fixturePath = join(persistPath, "accounts.json");
const seedPath = join(persistPath, "seed.sql");
const wrangler = join(process.cwd(), "node_modules", ".bin", "wrangler");
const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
const candidatePath = join(process.cwd(), "tools/live-run/courses/candidates/eleme-2008-product-development-t090.json");
const password = "T090 development mentor E2E password 2026!";
const fixture = {
  dm: { username: "t090-admin", name: "T090 Admin DM", password },
  mentors: ["p", "d", "m", "o"].map((code) => ({ username: `t090-seed-mentor-${code}`, name: `${code.toUpperCase()} Seed Mentor`, password: `${password} ${code}` })),
  learners: [1, 2].map((number) => ({ username: `t090-seed-builder-${number}`, name: `Seed Builder ${number}`, password: `${password} ${number}` })),
  outsider: { username: "t090-outsider", name: "T090 Outsider", password: `${password} outsider` },
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string; details?: unknown } };
type ExactRef = { courseId: string; schemaVersion: number; revision: number; digest: string; status: "candidate" | "released" | "approved" };
type Courseware = {
  packageId: string; slug: string; title: string; mentorRole: "P" | "D" | "M" | "O";
  latestRevision: number; latestDigest: string; releasedRevision: number | null; releasedDigest: string | null;
};
type Bootstrap = { user: { userId: string }; courseware: Courseware[] };
type Credential = { userId: string; username: string; role: "mentor" | "learner" };
type ScriptProgress = { unlockedThroughBlockId: string; unlockedThroughIndex: number; version: number };
type Card = { id: string; boundary: string; body: string; simulationCategory?: string };
type MentorView = {
  kind: "mentor"; mentorRole: "P" | "D" | "M" | "O"; privateScript: string[];
  contentContext: { mode: "owner" | "handoff" | "none"; checkpoint: null | { id: string }; coursewareCue: null | { slideStart: number; slideEnd: number } };
};
type LearnerView = { kind: "learner"; privateDeckId: string; privateCards: Card[] };
type Submission = { id: string; profileId: string; schemaId: string | null; values: Record<string, string> | null; status: string; reviewFeedback: string | null; updatedAt: string };
type Detail = {
  page: { id: string }; script: ScriptProgress; myView: MentorView | LearnerView | { kind: "controller" } | null;
  activitySchema: null | { id: string; kind: string; ownerMentorRole?: string; fields: Array<Record<string, unknown>>; mentorRubric: null | string[] };
  submissions: Submission[];
  handoffs: Array<{ artifactName: string; fieldLabels: Record<string, string>; fromMentorRole: string; toMentorRole: string; fromBlockId: string; availableAtBlockId: string; submission: Submission }>;
  courseware: Array<{ mentorRole: string; packageId: string; slug: string; revision: number; digest: string }>;
};

let server: ChildProcess | null = null;
let diagnostics = "";

try {
  await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
  const generated = spawnSync(tsx, ["scripts/generate-auth-seed.ts", "--accounts", fixturePath, "--output", seedPath], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60_000, env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const seeded = spawnSync(wrangler, ["d1", "execute", "DB", "--local", "--persist-to", persistPath, "--config", "dist/server/wrangler.json", "--file", seedPath], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" },
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

  server = spawn(wrangler, ["dev", "--config", "wrangler.json", "--persist-to", persistPath, "--ip", "127.0.0.1", "--port", String(port), "--no-show-interactive-dev-session"], {
    cwd: join(process.cwd(), "dist", "server"),
    env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-30_000); });
  server.stderr?.on("data", (chunk) => { diagnostics = (diagnostics + String(chunk)).slice(-30_000); });
  await waitUntilReady();

  const adminCookie = await login(fixture.dm.username, password);
  const bootstrap = await getData<Bootstrap>("/api/studio/bootstrap", adminCookie);
  const pCourseware = mustCourseware(bootstrap.courseware, "P", "product-mentor-foundations");
  const dCourseware = mustCourseware(bootstrap.courseware, "D", "development-mentor-ligun");
  assert.equal(dCourseware.latestDigest, "cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d");
  assert.equal((await get("/courseware/development-mentor-ligun/index.html", adminCookie)).status, 200);

  const rawCourse = JSON.parse(await readFile(candidatePath, "utf8")) as { blocks: Array<{ id: string }> };
  const candidate = await postData<ExactRef>("/api/studio/candidates", { course: rawCourse }, adminCookie);
  const viewReceipt = await postData<{ receiptId: string; valid: boolean }>("/api/studio/view-acceptance", {
    courseRef: candidate,
    reviewedBlockIds: rawCourse.blocks.map((block) => block.id),
    reviewedLearnerCounts: [2, 3, 4, 5, 6],
  }, adminCookie);
  assert.equal(viewReceipt.valid, true);

  const credentials = await postData<Credential[]>("/api/studio/accounts", {
    accounts: [
      ...(["P", "D", "M", "O"] as const).map((role) => ({ username: `t090-seat-${role.toLowerCase()}`, displayName: `${role} T090 导师`, role: "mentor" })),
      ...Array.from({ length: 6 }, (_, index) => ({ username: `t090-seat-builder-${index + 1}`, displayName: `T090 Builder ${index + 1}`, role: "learner" })),
    ],
  }, adminCookie);
  const mentorProfiles = credentials.filter((item) => item.role === "mentor");
  const learnerProfiles = credentials.filter((item) => item.role === "learner");
  const coursewareRefs = (["P", "D", "M", "O"] as const).map((role) => {
    const selected = role === "P" ? pCourseware : role === "D" ? dCourseware : mustCourseware(bootstrap.courseware, role);
    return { mentorRole: role, packageId: selected.packageId, slug: selected.slug, revision: selected.latestRevision, digest: selected.latestDigest };
  });

  const rooms = new Map<number, string>();
  for (const learnerCount of [2, 4, 6]) {
    const room = await postData<{ classroomId: string }>("/api/platform/classrooms", {
      environment: "test", title: `T-090 D 导师 ${learnerCount} 人验收课堂`, learnerCount,
      courseRef: candidate, viewAcceptanceReceiptId: viewReceipt.receiptId, coursewareRefs,
      adminDmProfileIds: [bootstrap.user.userId],
      mentorSeats: (["P", "D", "M", "O"] as const).map((mentorRole, index) => ({ mentorRole, profileId: mentorProfiles[index].userId })),
      learnerProfileIds: learnerProfiles.slice(0, learnerCount).map((item) => item.userId),
    }, adminCookie);
    rooms.set(learnerCount, room.classroomId);
    let progress = (await view(room.classroomId, "B01", mentorProfiles[0].userId, adminCookie)).script;
    progress = await unlockThrough(room.classroomId, progress, "B05", adminCookie);
    const hands: string[] = [];
    for (let index = 0; index < learnerCount; index += 1) {
      const first = await view(room.classroomId, "B05", learnerProfiles[index].userId, adminCookie);
      const repeated = await view(room.classroomId, "B05", learnerProfiles[index].userId, adminCookie);
      assert.equal(first.myView?.kind, "learner");
      const firstView = first.myView as LearnerView;
      const repeatedView = repeated.myView as LearnerView;
      assert.equal(firstView.privateDeckId, "device-booking-incident-private-evidence");
      assert.equal(firstView.privateCards.length, 2);
      assert.ok(firstView.privateCards.every((card) => card.boundary === "R" && card.body.startsWith("课堂模拟：")));
      assert.deepEqual(repeatedView.privateCards.map((card) => card.id), firstView.privateCards.map((card) => card.id), "refresh must preserve the private hand");
      hands.push(...firstView.privateCards.map((card) => card.id));
    }
    assert.equal(new Set(hands).size, learnerCount * 2, `${learnerCount}-learner classroom must have a unique team deal`);
    const dAtB05 = await view(room.classroomId, "B05", mentorProfiles[1].userId, adminCookie);
    assert.equal((dAtB05.myView as MentorView).contentContext.mode, "owner");
    assert.equal((dAtB05.myView as MentorView).contentContext.checkpoint?.id, "d-a-system-failure");
    assert.deepEqual(dAtB05.courseware.find((item) => item.mentorRole === "D"), coursewareRefs.find((item) => item.mentorRole === "D"));
  }

  const roomId = rooms.get(4)!;
  // Return to an already unlocked P page and create the accepted upstream brief.
  const learnerB04 = await view(roomId, "B04", learnerProfiles[0].userId, adminCookie);
  assert.equal(learnerB04.activitySchema?.id, "product-brief-v1");
  await postData(`/api/platform/classrooms/${roomId}/submissions`, {
    blockId: "B04", schemaId: "product-brief-v1", values: productBriefValues(), viewAsProfileId: learnerProfiles[0].userId,
  }, adminCookie);
  const pB04 = await view(roomId, "B04", mentorProfiles[0].userId, adminCookie);
  await postData(`/api/platform/classrooms/${roomId}/submissions/${pB04.submissions[0].id}/review`, {
    status: "accepted", feedback: "产品问题、路径和边界已通过，交给 D。", expectedUpdatedAt: pB04.submissions[0].updatedAt,
    viewAsProfileId: mentorProfiles[0].userId,
  }, adminCookie);
  const dB05 = await view(roomId, "B05", mentorProfiles[1].userId, adminCookie);
  assert.equal(dB05.handoffs[0]?.artifactName, "ProductBrief／产品定义卡");
  assert.equal(dB05.handoffs[0]?.fieldLabels["target-user"], "目标用户");

  let progress = dB05.script;
  progress = await unlockThrough(roomId, progress, "B08", adminCookie);
  const b05Hand = ((await view(roomId, "B05", learnerProfiles[0].userId, adminCookie)).myView as LearnerView).privateCards.map((card) => card.id);
  const b06Hand = ((await view(roomId, "B06", learnerProfiles[0].userId, adminCookie)).myView as LearnerView).privateCards.map((card) => card.id);
  assert.deepEqual(b06Hand, b05Hand, "checkpoint movement must not redeal private evidence");

  const learnerB08 = await view(roomId, "B08", learnerProfiles[0].userId, adminCookie);
  assert.equal(learnerB08.activitySchema?.id, "development-stick-v1");
  assert.equal(learnerB08.activitySchema?.mentorRubric, null);
  assert.equal(learnerB08.activitySchema?.fields.length, 10);
  assert.equal(learnerB08.activitySchema?.fields.some((field) => "mentorPrompt" in field), false);
  assert.equal(learnerB08.activitySchema?.fields.find((field) => field.id === "sub-sticks")?.minItems, 2);

  const invalidValues = developmentStickValues("第一版");
  invalidValues["sub-sticks"] = "只有一根子棍｜无法完成分层";
  const invalid = await post(`/api/platform/classrooms/${roomId}/submissions`, {
    blockId: "B08", schemaId: "development-stick-v1", values: invalidValues, viewAsProfileId: learnerProfiles[0].userId,
  }, adminCookie);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json() as Envelope<never>).error?.code, "SUBMISSION_VALUES_INVALID");

  const firstValues = developmentStickValues("第一版");
  await postData(`/api/platform/classrooms/${roomId}/submissions`, {
    blockId: "B08", schemaId: "development-stick-v1", values: firstValues, viewAsProfileId: learnerProfiles[0].userId,
  }, adminCookie);
  assert.equal((await view(roomId, "B08", learnerProfiles[1].userId, adminCookie)).submissions.length, 0, "other learners cannot read the draft");
  assert.equal((await view(roomId, "B08", mentorProfiles[0].userId, adminCookie)).submissions.length, 0, "P cannot read D-owned raw submissions");

  let dB08 = await view(roomId, "B08", mentorProfiles[1].userId, adminCookie);
  assert.equal(dB08.activitySchema?.mentorRubric?.length, 6);
  assert.equal(dB08.submissions.length, 1);
  const firstSubmission = dB08.submissions[0];
  const outsiderCookie = await login(fixture.outsider.username, `${password} outsider`);
  for (const probedId of [firstSubmission.id, "00000000-0000-4000-8000-000000000000"]) {
    const probe = await post(`/api/platform/classrooms/${roomId}/submissions/${probedId}/review`, {
      status: "accepted", feedback: "", expectedUpdatedAt: firstSubmission.updatedAt,
    }, outsiderCookie);
    assert.equal(probe.status, 403, "non-members must not learn whether a submission UUID exists");
    assert.equal((await probe.json() as Envelope<never>).error?.code, "CLASSROOM_ACCESS_FORBIDDEN");
  }
  const wrongReviewer = await post(`/api/platform/classrooms/${roomId}/submissions/${firstSubmission.id}/review`, {
    status: "accepted", feedback: "P 不应审核 D 交付物", expectedUpdatedAt: firstSubmission.updatedAt, viewAsProfileId: mentorProfiles[0].userId,
  }, adminCookie);
  assert.equal(wrongReviewer.status, 403);
  await postData(`/api/platform/classrooms/${roomId}/submissions/${firstSubmission.id}/review`, {
    status: "rejected", feedback: "请把测试改成两台设备同时提交，并写清名单最终只能有一条。", expectedUpdatedAt: firstSubmission.updatedAt,
    viewAsProfileId: mentorProfiles[1].userId,
  }, adminCookie);
  const returned = await view(roomId, "B08", learnerProfiles[0].userId, adminCookie);
  assert.equal(returned.submissions[0].status, "rejected");
  assert.match(returned.submissions[0].reviewFeedback ?? "", /两台设备/);

  const revisedValues = developmentStickValues("第二版");
  revisedValues.tests = "两台设备同时提交同一相机同一时段 → 只有一台显示成功且管理员名单只有一条";
  await postData(`/api/platform/classrooms/${roomId}/submissions`, {
    blockId: "B08", schemaId: "development-stick-v1", values: revisedValues, viewAsProfileId: learnerProfiles[0].userId,
  }, adminCookie);
  dB08 = await view(roomId, "B08", mentorProfiles[1].userId, adminCookie);
  assert.equal(dB08.submissions[0].status, "submitted");
  assert.equal(dB08.submissions[0].reviewFeedback, null);
  await postData(`/api/platform/classrooms/${roomId}/submissions/${dB08.submissions[0].id}/review`, {
    status: "accepted", feedback: "三级立棍、验收、红线、测试和纠偏已对齐。", expectedUpdatedAt: dB08.submissions[0].updatedAt,
    viewAsProfileId: mentorProfiles[1].userId,
  }, adminCookie);
  const refreshedAccepted = await view(roomId, "B08", learnerProfiles[0].userId, adminCookie);
  assert.equal(refreshedAccepted.submissions[0].status, "accepted");
  assert.deepEqual(refreshedAccepted.submissions[0].values, revisedValues);

  await postData<ScriptProgress>(`/api/platform/classrooms/${roomId}/control`, {
    expectedVersion: progress.version, action: { type: "unlock-next", nextBlockId: "B09" },
  }, adminCookie);
  const mB09 = await view(roomId, "B09", mentorProfiles[2].userId, adminCookie);
  assert.equal(mB09.handoffs.length, 1);
  assert.equal(mB09.handoffs[0].artifactName, "DevelopmentStick／开发立棍卡");
  assert.equal(mB09.handoffs[0].fieldLabels.tests, "可执行测试");
  assert.deepEqual(mB09.handoffs[0].submission.values, revisedValues);
  assert.equal((await view(roomId, "B09", mentorProfiles[3].userId, adminCookie)).handoffs.length, 0, "O must not receive the D→M handoff");

  // Back-navigation is a read-only script view: accepted artifacts and economy/private hands survive it.
  const backToB05 = await view(roomId, "B05", learnerProfiles[0].userId, adminCookie);
  assert.deepEqual((backToB05.myView as LearnerView).privateCards.map((card) => card.id), b05Hand);
  const backToB08 = await view(roomId, "B08", learnerProfiles[0].userId, adminCookie);
  assert.equal(backToB08.submissions[0].status, "accepted");
  assert.equal(backToB08.script.unlockedThroughBlockId, "B09");

  const oldD = mustCourseware(bootstrap.courseware, "D", "development-mentor-field-kit");
  const wrongRefs = coursewareRefs.map((ref) => ref.mentorRole === "D" ? {
    mentorRole: "D" as const, packageId: oldD.packageId, slug: oldD.slug, revision: oldD.latestRevision, digest: oldD.latestDigest,
  } : ref);
  const mismatch = await post("/api/platform/classrooms", {
    environment: "test", title: "T-090 wrong D deck must fail", learnerCount: 2, courseRef: candidate,
    viewAcceptanceReceiptId: viewReceipt.receiptId, coursewareRefs: wrongRefs, adminDmProfileIds: [bootstrap.user.userId],
    mentorSeats: (["P", "D", "M", "O"] as const).map((mentorRole, index) => ({ mentorRole, profileId: mentorProfiles[index].userId })),
    learnerProfileIds: learnerProfiles.slice(0, 2).map((item) => item.userId),
  }, adminCookie);
  assert.equal(mismatch.status, 409);
  assert.equal((await mismatch.json() as Envelope<never>).error?.code, "COURSE_CONTENT_COURSEWARE_MISMATCH");

  console.log("T090_DEVELOPMENT_MENTOR_E2E_PASS learners=2/4/6 cards=persistent-private D=B05-B08 DevelopmentStick=reject-resubmit-accept handoff=D-to-M:B09 exact-courseware=fail-closed");
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(persistPath, { recursive: true, force: true });
}

function mustCourseware(items: Courseware[], role: Courseware["mentorRole"], slug?: string): Courseware {
  const found = items.find((item) => item.mentorRole === role && (!slug || item.slug === slug));
  assert.ok(found, `missing ${role} courseware${slug ? ` ${slug}` : ""}`);
  return found;
}

async function unlockThrough(roomId: string, current: ScriptProgress, targetBlockId: string, cookie: string): Promise<ScriptProgress> {
  let progress = current;
  const target = Number(targetBlockId.slice(1));
  while (progress.unlockedThroughIndex + 1 < target) {
    const nextBlockId = `B${String(progress.unlockedThroughIndex + 2).padStart(2, "0")}`;
    progress = await postData<ScriptProgress>(`/api/platform/classrooms/${roomId}/control`, {
      expectedVersion: progress.version, action: { type: "unlock-next", nextBlockId },
    }, cookie);
  }
  return progress;
}

function productBriefValues(): Record<string, string> {
  return {
    "target-user": "校内晚上临时需要借用共享设备的学生",
    "user-task": "在活动开始前找到空闲设备，完成预约，并确认管理员能看到记录。",
    "observed-problem": "同学不知道设备是否空闲，提交后也无法确认管理员名单是否真的保存。",
    "facts-and-sources": "课堂观察：多人会查看同一设备时段。\n访谈记录：管理员依赖预约名单发放设备。",
    assumptions: "一个统一的空闲时段入口可能减少来回询问。",
    unknowns: "还不知道高峰时段同时提交的人数；下一步在社团活动前观察。",
    "value-hypothesis": "如果预约结果可回读且不冲突，学生会更快确认设备，管理员也不会发放错位。",
    "core-journey": "查看空闲时段 → 选择设备 → 提交预约 → 从名单回读确认。",
    "mvp-hypothesis": "一条能保存并回读的唯一预约路径，是否足以避免第一类借用冲突。",
    boundaries: "不收集家庭住址；不承诺跨校设备；同一设备同时段只能有一条有效预约。",
  };
}

function developmentStickValues(version: string): Record<string, string> {
  return {
    "current-situation": `${version}：学生提交预约后页面显示成功，但管理员名单可能没有记录或出现冲突。`,
    "user-task": "学生要在社团活动前预约一台相机，并确认管理员能够看到同一条记录。",
    "main-goal": "让一名学生预约一个设备时段，并从管理员名单回读到唯一且真实的结果。",
    "core-journey": "打开空闲时段\n选择相机和时间\n提交并保存预约\n重新打开名单确认",
    "acceptance-criteria": "提交后名单出现且设备、时段、学生一致\n两人同时提交时只能一人成功且名单只有一条",
    constraints: "不得先显示成功再保存\n不得收集家庭住址或家长手机号",
    "sub-sticks": "保存唯一预约｜相同设备时段最多一条\n回读真实结果｜刷新后名单仍与提交一致",
    "micro-sticks": "冲突判断函数｜相同设备时段第二次写入必须失败",
    tests: "两台设备同时提交同一时段 → 只有一次成功且管理员名单只有一条",
    "correction-log": "偏差是页面先报成功、保存随后失败；旧测试只看提示；纠偏为保存完成后再回读名单。",
  };
}

async function view(roomId: string, blockId: string, profileId: string, cookie: string): Promise<Detail> {
  return getData<Detail>(`/api/platform/classrooms/${roomId}?block=${blockId}&viewAs=${profileId}`, cookie);
}
async function login(username: string, passwordValue: string): Promise<string> {
  const response = await post("/api/auth/login", { username, password: passwordValue, remember: false });
  assert.equal(response.status, 200, `${username}: ${await response.clone().text()}`);
  const cookie = (response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  assert.match(cookie, /^__Secure-msv_session=.+/); return cookie;
}
function proxyHeaders(cookie?: string): Record<string, string> { return { Accept: "application/json", Host: "minisv.vip", "X-Forwarded-Host": "minisv.vip", "X-Forwarded-Proto": "https", ...(cookie ? { Cookie: cookie } : {}) }; }
async function get(path: string, cookie?: string): Promise<Response> { return fetch(`${internalBase}${path}`, { headers: proxyHeaders(cookie), signal: AbortSignal.timeout(20_000) }); }
async function post(path: string, body: unknown, cookie?: string): Promise<Response> { return fetch(`${internalBase}${path}`, { method: "POST", headers: { ...proxyHeaders(cookie), Origin: publicOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) }); }
async function getData<T>(path: string, cookie: string): Promise<T> { const response = await get(path, cookie); const envelope = await response.json() as Envelope<T>; assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`); assert.equal(envelope.ok, true); assert.ok(envelope.data !== undefined); return envelope.data; }
async function postData<T = Record<string, unknown>>(path: string, body: unknown, cookie: string): Promise<T> { const response = await post(path, body, cookie); const envelope = await response.json() as Envelope<T>; assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`); assert.equal(envelope.ok, true); assert.ok(envelope.data !== undefined); return envelope.data; }
async function waitUntilReady(): Promise<void> { const deadline = Date.now() + 40_000; while (Date.now() < deadline) { if (server?.exitCode !== null) throw new Error(`Wrangler stopped before readiness.\n${diagnostics}`); try { if ((await get("/api/auth/session")).status === 401) return; } catch { /* still starting */ } await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error(`Wrangler did not become ready.\n${diagnostics}`); }
