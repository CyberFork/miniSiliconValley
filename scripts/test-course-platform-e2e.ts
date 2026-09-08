import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 5100 + Math.floor(Math.random() * 300);
const internalBase = `http://127.0.0.1:${port}`;
const publicOrigin = "https://minisv.vip";
const persistPath = await mkdtemp(join(tmpdir(), "msv-course-platform-e2e-"));
const fixturePath = join(persistPath, "accounts.json");
const seedPath = join(persistPath, "seed.sql");
const wrangler = join(process.cwd(), "node_modules", ".bin", "wrangler");
const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
const password = "Course factory test password 2026!";
const mentors = ["p", "d", "m", "o"].map((code) => ({ username: `factory-mentor-${code}`, name: `${code.toUpperCase()} 测试导师`, password: `${password} ${code}` }));
const learners = Array.from({ length: 6 }, (_, index) => ({ username: `factory-builder-${index + 1}`, name: `Factory Builder ${index + 1}`, password: `${password} ${index + 1}` }));
const fixture = {
  dm: { username: "factory-admin", name: "Factory Admin", password },
  mentors,
  learners,
  outsider: { username: "factory-outsider", name: "Factory Outsider", password: `${password} outsider` },
};
let server: ChildProcess | null = null;
let diagnostics = "";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
type ExactRef = { courseId: string; schemaVersion: number; revision: number; digest: string; status: "candidate" | "released" | "approved" };
type Version = { ref: ExactRef; candidate: boolean; released: boolean; course: CourseDefinition };
type CourseDefinition = {
  title: string;
  course: { id: string; name: string };
  learnerPolicy?: { defaultCount: number; minCount: number; maxCount: number; cardsPerLearner: number; dealPolicy: "unique-within-step" | "repeat-when-needed" };
  decks: Array<{ id: string; cards: Array<Record<string, unknown>> }>;
  blocks: Array<{ id: string; studentPrompt: string; learnerTaskTemplate?: { badge: string; task: string } }>;
  [key: string]: unknown;
};
type Courseware = {
  packageId: string; slug: string; title: string; mentorRole: "P" | "D" | "M" | "O";
  latestRevision: number; latestDigest: string; releasedRevision: number | null; releasedDigest: string | null;
};
type CoursewareVersion = {
  packageId: string; slug: string; title: string; mentorRole: "P" | "D" | "M" | "O";
  revision: number; digest: string; released: boolean;
};
type ViewReceipt = { receiptId: string; courseRef: ExactRef; projectorVersion: string; appBuildId: string; valid: boolean; invalidReasons: string[] };
type UiReceipt = { receiptId: string; roomId: string; viewReceiptId: string; courseRef: ExactRef; coursewareBundleDigest: string; coursewareRefs: Detail["courseware"]; valid: boolean; invalidReasons: string[] };
type Bootstrap = { user: { userId: string }; versions: Version[]; courseware: Courseware[]; viewReceipts: ViewReceipt[]; uiReceipts: UiReceipt[] };
type Credential = { userId: string; username: string; role: "mentor" | "learner"; initialPassword: string; mustChangePassword: true };
type Controller = { state: string; blockIndex: number; blockId: string; version: number };
type Detail = {
  id: string;
  environment: "test" | "production";
  lifecycle: string;
  learnerCount: number;
  courseRef: ExactRef;
  controller: Controller;
  controlView: null | { systemActions: string[]; acceptance: string[] };
  myView: null | { kind: string; privateCards?: Array<{ id: string }> };
  mentors: unknown[];
  learners: unknown[];
  courseware: Array<{ mentorRole: "P" | "D" | "M" | "O"; packageId: string; slug: string; revision: number; digest: string }>;
  acceptance: { viewReceiptId: string | null; uiReceiptId: string | null };
  isAdminDm: boolean;
  adminDmMode: "primary" | "delegated" | null;
  canDelegateAdminDm: boolean;
  viewer: { profileId: string; actorProfileId: string; impersonationId: string | null };
  admins: Array<{ profileId: string; mode: "primary" | "delegated"; canDelegate: boolean }>;
};
type TestIdentity = {
  userId: string;
  username: string;
  role: "admin" | "mentor" | "learner" | "observer";
  status: "active" | "disabled";
  mentorRole: "P" | "D" | "M" | "O" | null;
  learnerSeat: number | null;
  adminDmMode: "primary" | "delegated" | null;
  mustChangePassword: boolean;
};

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
  const initial = await getData<Bootstrap>("/api/studio/bootstrap", adminCookie);
  assert.equal(new Set(initial.versions.map((item) => item.ref.courseId)).size, 2);
  assert.deepEqual(initial.courseware.map((item) => item.mentorRole), ["P", "D", "M", "O"]);
  assert.ok(initial.courseware.every((item) => item.releasedRevision !== null && item.releasedDigest));

  const anonymousEditor = await fetch(`${internalBase}/studio/editor/`, {
    headers: proxyHeaders(), redirect: "manual", signal: AbortSignal.timeout(20_000),
  });
  assert.ok([302, 303, 307, 308].includes(anonymousEditor.status));
  assert.match(anonymousEditor.headers.get("location") ?? "", /\/auth\/login.*returnTo/);
  const editorPage = await get("/studio/editor/", adminCookie);
  assert.equal(editorPage.status, 200);
  const editorHtml = await editorPage.text();
  for (const marker of ["课程编排工作台", "COURSE LIBRARY", "全课程时序轴", "多角色直改", "抽卡内容", "课程中控视窗"]) {
    assert.ok(editorHtml.includes(marker), `restored editor missing ${marker}`);
  }
  assert.ok(editorHtml.includes("/studio/editor-assets/editor-loader.js"));
  assert.doesNotMatch(editorHtml, /\/studio\/editor-assets\/(?:ui-theme|card-view|course-preview|editor)\.js/);
  assert.ok(editorHtml.includes("账户中心") && editorHtml.includes("切换账号") && editorHtml.includes("退出登录"));
  assert.equal((await get("/studio/editor-assets/editor-loader.js", adminCookie)).status, 200);
  for (const [path, title] of [
    ["/studio/", "课程生产工作台"],
    ["/studio/preview/", "多角色视图验收"],
    ["/studio/releases/", "验收与发布"],
    ["/studio/courseware/", "导师课件库"],
  ] as const) {
    const response = await get(path, adminCookie);
    assert.equal(response.status, 200, `${path} must be a directly addressable Studio route`);
    const html = await response.text();
    assert.ok(html.includes(title), `${path} missing route title ${title}`);
    assert.ok(html.includes("href=\"/studio/editor/\"") && html.includes("href=\"/studio/preview/\"") && html.includes("href=\"/studio/releases/\""), `${path} must render real navigation hrefs`);
    assert.ok(html.includes("账户中心") && html.includes("切换账号") && html.includes("退出登录"), `${path} missing unified account menu`);
  }

  const google = initial.versions.find((item) => item.ref.courseId === "google-1995-2004" && item.released);
  assert.ok(google);
  const validatedWorkingCopy = await postData<{ macroSteps: number; blocks: number; decks: number; cards: number; metadata: { digest: string } }>("/api/studio/validate", { course: google.course }, adminCookie);
  assert.deepEqual([validatedWorkingCopy.macroSteps, validatedWorkingCopy.blocks, validatedWorkingCopy.decks, validatedWorkingCopy.cards], [5, 13, 5, 60]);
  assert.match(validatedWorkingCopy.metadata.digest, /^[0-9a-f]{64}$/);
  const candidateBody = structuredClone(google.course);
  candidateBody.title = `${candidateBody.title} · E2E Candidate`;
  const candidate = await postData<ExactRef>("/api/studio/candidates", { course: candidateBody }, adminCookie);
  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.revision, 1);

  const suffix = Date.now().toString().slice(-8);
  const customOperationsCourseware = await postData<CoursewareVersion>("/api/studio/courseware", {
    title: `运营导师 E2E 工具 ${suffix}`,
    slug: `operations-e2e-${suffix}`,
    mentorRole: "O",
    html: `<!doctype html><html><body><h1>运营导师 exact r0</h1><button>课堂工具</button></body></html>`,
  }, adminCookie);
  assert.equal(customOperationsCourseware.revision, 0);
  assert.equal(customOperationsCourseware.released, false);
  const coursewarePage = await get(`/course/${customOperationsCourseware.slug}/?revision=0`, adminCookie);
  assert.equal(coursewarePage.status, 200);
  const coursewareHtml = await coursewarePage.text();
  assert.ok(coursewareHtml.includes("账户中心") && coursewareHtml.includes("切换账号") && coursewareHtml.includes("退出登录"), "protected Courseware must keep the unified account menu");
  await postData("/api/studio/courseware/release", {
    packageId: customOperationsCourseware.packageId,
    revision: customOperationsCourseware.revision,
    digest: customOperationsCourseware.digest,
  }, adminCookie);
  const testedCoursewareRefs = coursewareRefs(initial.courseware, "test").map((ref) => ref.mentorRole === "O" ? {
    mentorRole: customOperationsCourseware.mentorRole,
    packageId: customOperationsCourseware.packageId,
    slug: customOperationsCourseware.slug,
    revision: customOperationsCourseware.revision,
    digest: customOperationsCourseware.digest,
  } : ref);

  const viewReceipt = await acceptView(candidate, candidateBody, adminCookie);
  assert.equal(viewReceipt.valid, true);
  assert.match(viewReceipt.receiptId, /^[0-9a-f-]{36}$/);
  assert.match(viewReceipt.projectorVersion, /^course-projector-/);

  const credentials = await postData<Credential[]>("/api/studio/accounts", {
    accounts: [
      ...["P", "D", "M", "O"].map((role) => ({ username: `e2e-mentor-${role.toLowerCase()}-${suffix}`, displayName: `${role} E2E 导师`, role: "mentor" })),
      ...[1, 2].map((number) => ({ username: `e2e-builder-${number}-${suffix}`, displayName: `E2E Builder ${number}`, role: "learner" })),
    ],
  }, adminCookie);
  assert.equal(credentials.length, 6);
  assert.ok(credentials.every((item) => item.mustChangePassword && item.initialPassword.length >= 20));
  const generatedMentors = credentials.filter((item) => item.role === "mentor");
  const generatedLearners = credentials.filter((item) => item.role === "learner");

  const factoryBody = {
    environment: "test",
    title: "T-086 two-stage exact Candidate E2E",
    learnerCount: 2,
    courseRef: candidate,
    coursewareRefs: testedCoursewareRefs,
    adminDmProfileIds: [initial.user.userId],
    mentorSeats: mentorSeats(generatedMentors.map((item) => item.userId)),
    learnerProfileIds: generatedLearners.map((item) => item.userId),
  };
  const missingViewGate = await post("/api/platform/classrooms", { ...factoryBody, viewAcceptanceReceiptId: "not-a-valid-view-receipt" }, adminCookie);
  assert.equal(missingViewGate.status, 409);
  assert.equal(((await missingViewGate.json()) as Envelope<never>).error?.code, "VIEW_ACCEPTANCE_RECEIPT_INVALID");
  const testRoom = await createClassroom({ ...factoryBody, viewAcceptanceReceiptId: viewReceipt.receiptId }, adminCookie);

  const oneTimeLogin = await post("/api/auth/login", { username: generatedLearners[0].username, password: generatedLearners[0].initialPassword, remember: false });
  assert.equal(oneTimeLogin.status, 200, await oneTimeLogin.clone().text());
  const oneTimeBody = await oneTimeLogin.clone().json() as Envelope<{ user: { mustChangePassword: boolean } }>;
  assert.equal(oneTimeBody.data?.user.mustChangePassword, true);
  const learnerCookie = cookieFrom(oneTimeLogin);
  const blocked = await get("/api/platform/classrooms", learnerCookie);
  assert.equal(blocked.status, 403);
  assert.equal(((await blocked.json()) as Envelope<never>).error?.code, "PASSWORD_CHANGE_REQUIRED");
  const replacementPassword = "Learner replaced one-time password 2026!";
  const changed = await mutate("/api/auth/profile", "PATCH", { currentPassword: generatedLearners[0].initialPassword, newPassword: replacementPassword }, learnerCookie);
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.equal((await get("/course/", learnerCookie)).status, 404, "mentor courseware library must not be exposed to learners");

  const learnerDetail = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, learnerCookie);
  assert.equal(learnerDetail.myView?.kind, "learner");
  assert.equal(learnerDetail.myView?.privateCards?.length, 3);
  assert.equal(learnerDetail.controlView, null, "learner response must not contain controller scripts or gates");
  const screenDetail = await getData<Record<string, unknown>>(`/api/platform/classrooms/${testRoom.classroomId}/screen`, learnerCookie);
  const serializedScreen = JSON.stringify(screenDetail);
  assert.equal(screenDetail.learnerCount, 2);
  for (const privateField of ["myView", "privateCards", "privateScript", "controlView", "submissions", "economy", "viewer", "mentors", "admins", "courseware"]) {
    assert.equal(serializedScreen.includes(`"${privateField}"`), false, `shared screen leaked ${privateField}`);
  }
  const adminDetail = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.equal(adminDetail.learners.length, 2);
  assert.equal(adminDetail.mentors.length, 4);
  assert.equal(adminDetail.courseware.length, 4);
  assert.ok(adminDetail.controlView);
  assert.deepEqual(adminDetail.acceptance, { viewReceiptId: viewReceipt.receiptId, uiReceiptId: null });
  assert.equal(adminDetail.adminDmMode, "primary");
  assert.equal(adminDetail.canDelegateAdminDm, true);
  assert.deepEqual(adminDetail.admins.map((item) => ({ mode: item.mode, canDelegate: item.canDelegate })), [{ mode: "primary", canDelegate: true }]);

  const identities = await getData<TestIdentity[]>(`/api/platform/classrooms/${testRoom.classroomId}/test-identities`, adminCookie);
  assert.equal(identities.length, 6);
  assert.ok(identities.some((item) => item.mentorRole === "P"));
  assert.ok(identities.some((item) => item.learnerSeat === 1));
  assert.equal(identities.some((item) => item.role === "admin"), false);
  const regenerated = await postData<{ status: string; credential?: Credential }>(`/api/platform/classrooms/${testRoom.classroomId}/test-identities`, {
    action: "reset-credential",
    targetProfileId: generatedLearners[1].userId,
  }, adminCookie);
  assert.equal(regenerated.status, "active");
  assert.equal(regenerated.credential?.username, generatedLearners[1].username);
  assert.ok((regenerated.credential?.initialPassword.length ?? 0) >= 20);
  const oldCredentialRejected = await post("/api/auth/login", { username: generatedLearners[1].username, password: generatedLearners[1].initialPassword, remember: false });
  assert.equal(oldCredentialRejected.status, 401);
  const regeneratedLogin = await post("/api/auth/login", { username: generatedLearners[1].username, password: regenerated.credential!.initialPassword, remember: false });
  assert.equal(regeneratedLogin.status, 200);
  await postData(`/api/platform/classrooms/${testRoom.classroomId}/test-identities`, { action: "disable", targetProfileId: generatedLearners[1].userId }, adminCookie);
  const disabledLogin = await post("/api/auth/login", { username: generatedLearners[1].username, password: regenerated.credential!.initialPassword, remember: false });
  assert.equal(disabledLogin.status, 401);
  await postData(`/api/platform/classrooms/${testRoom.classroomId}/test-identities`, { action: "activate", targetProfileId: generatedLearners[1].userId }, adminCookie);

  const nonAdminImpersonation = await post("/api/auth/impersonation", { classroomId: testRoom.classroomId, effectiveProfileId: generatedLearners[0].userId }, learnerCookie);
  assert.equal(nonAdminImpersonation.status, 403);
  assert.equal(((await nonAdminImpersonation.json()) as Envelope<never>).error?.code, "PLATFORM_ADMIN_REQUIRED");
  const adminTargetImpersonation = await post("/api/auth/impersonation", { classroomId: testRoom.classroomId, effectiveProfileId: initial.user.userId }, adminCookie);
  assert.equal(adminTargetImpersonation.status, 403);
  assert.equal(((await adminTargetImpersonation.json()) as Envelope<never>).error?.code, "IMPERSONATION_ADMIN_FORBIDDEN");

  await postData("/api/auth/impersonation", { classroomId: testRoom.classroomId, effectiveProfileId: generatedLearners[0].userId }, adminCookie);
  const impersonatedLearner = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.equal(impersonatedLearner.myView?.kind, "learner");
  assert.equal(impersonatedLearner.viewer.actorProfileId, initial.user.userId);
  assert.equal(impersonatedLearner.viewer.profileId, generatedLearners[0].userId);
  assert.ok(impersonatedLearner.viewer.impersonationId);
  const scopedRooms = await getData<Array<{ id: string; environment: string }>>("/api/platform/classrooms", adminCookie);
  assert.deepEqual(scopedRooms.map((item) => item.id), [testRoom.classroomId]);
  const impersonatedStudio = await get("/api/studio/bootstrap", adminCookie);
  assert.equal(impersonatedStudio.status, 403);
  assert.equal(((await impersonatedStudio.json()) as Envelope<never>).error?.code, "IMPERSONATION_STUDIO_FORBIDDEN");
  await deleteData("/api/auth/impersonation", adminCookie);

  await postData("/api/auth/impersonation", { classroomId: testRoom.classroomId, effectiveProfileId: generatedMentors[0].userId }, adminCookie);
  const impersonatedMentor = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.equal(impersonatedMentor.myView?.kind, "mentor");
  assert.equal(impersonatedMentor.isAdminDm, false);
  await deleteData("/api/auth/impersonation", adminCookie);

  await postData(`/api/platform/classrooms/${testRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: generatedMentors[0].userId }, adminCookie);
  await postData("/api/auth/impersonation", { classroomId: testRoom.classroomId, effectiveProfileId: generatedMentors[0].userId }, adminCookie);
  const impersonatedDelegated = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.equal(impersonatedDelegated.adminDmMode, "delegated");
  assert.equal(impersonatedDelegated.canDelegateAdminDm, false);
  assert.ok(impersonatedDelegated.controlView);
  const impersonatedDelegationAttempt = await post(`/api/platform/classrooms/${testRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: generatedMentors[1].userId }, adminCookie);
  assert.equal(impersonatedDelegationAttempt.status, 403);
  assert.equal(((await impersonatedDelegationAttempt.json()) as Envelope<never>).error?.code, "ADMIN_DM_DELEGATION_REQUIRED");
  const impersonatedAccountAttempt = await post(`/api/platform/classrooms/${testRoom.classroomId}/accounts`, { accounts: [{ username: `impersonation-forbidden-${suffix}`, displayName: "Forbidden", role: "learner" }] }, adminCookie);
  assert.equal(impersonatedAccountAttempt.status, 403);
  assert.equal(((await impersonatedAccountAttempt.json()) as Envelope<never>).error?.code, "IMPERSONATION_ACCOUNT_OPERATION_FORBIDDEN");
  await deleteData("/api/auth/impersonation", adminCookie);
  await postData(`/api/platform/classrooms/${testRoom.classroomId}/members`, { type: "revoke-admin-dm", profileId: generatedMentors[0].userId }, adminCookie);

  const firstExecution = await control(testRoom.classroomId, adminDetail.controller.version, { type: "execute" }, adminCookie);
  assert.equal(firstExecution.state, "executing");
  const staleControllerMutation = await post(`/api/platform/classrooms/${testRoom.classroomId}/control`, { expectedVersion: adminDetail.controller.version, action: { type: "execute" } }, adminCookie);
  assert.equal(staleControllerMutation.status, 409);
  assert.equal(((await staleControllerMutation.json()) as Envelope<never>).error?.code, "CONTROLLER_VERSION_CONFLICT");
  await postData(`/api/platform/classrooms/${testRoom.classroomId}/reset`, {}, adminCookie);
  const verifiedReset = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.deepEqual({ lifecycle: verifiedReset.lifecycle, state: verifiedReset.controller.state, blockId: verifiedReset.controller.blockId }, { lifecycle: "ready", state: "ready", blockId: "B01" });

  const blockedRelease = await post("/api/studio/releases", { courseRef: candidate, viewReceiptId: viewReceipt.receiptId, uiReceiptId: "missing-ui-receipt" }, adminCookie);
  assert.equal(blockedRelease.status, 409);
  assert.equal(((await blockedRelease.json()) as Envelope<never>).error?.code, "UI_ACCEPTANCE_RECEIPT_INVALID");

  const controller = await completeClassroom(testRoom.classroomId, verifiedReset.controller, adminCookie);
  assert.equal(controller.state, "completed");
  assert.equal(controller.blockIndex, 12);
  const incompleteReceipt = await post(`/api/platform/classrooms/${testRoom.classroomId}/receipt`, { checks: { sameRuntimeUi: true }, clientMatrix: acceptanceClients() }, adminCookie);
  assert.equal(incompleteReceipt.status, 409);
  assert.equal(((await incompleteReceipt.json()) as Envelope<never>).error?.code, "UI_ACCEPTANCE_CHECKS_INCOMPLETE");
  const receipt = await postData<{ receiptId: string; viewReceiptId: string; coursewareBundleDigest: string; appBuildId: string }>(`/api/platform/classrooms/${testRoom.classroomId}/receipt`, { checks: uiAcceptanceChecks(), clientMatrix: acceptanceClients() }, adminCookie);
  assert.match(receipt.coursewareBundleDigest, /^[0-9a-f]{64}$/);
  assert.equal(receipt.viewReceiptId, viewReceipt.receiptId);
  assert.match(receipt.appBuildId, /^minisv-t087-/);
  const receiptBoundDetail = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.equal(receiptBoundDetail.acceptance.uiReceiptId, receipt.receiptId);
  const repeatedReceipt = await postData<{ receiptId: string; coursewareBundleDigest: string }>(`/api/platform/classrooms/${testRoom.classroomId}/receipt`, { checks: uiAcceptanceChecks(), clientMatrix: acceptanceClients() }, adminCookie);
  assert.equal(repeatedReceipt.receiptId, receipt.receiptId, "re-accepting one exact Test Classroom must return the persisted receipt id");
  const released = await postData<ExactRef>("/api/studio/releases", { courseRef: candidate, viewReceiptId: viewReceipt.receiptId, uiReceiptId: repeatedReceipt.receiptId }, adminCookie);
  assert.equal(released.status, "released");

  const productionCoursewareRefs = testedCoursewareRefs;
  const production = await createClassroom({
    environment: "production",
    title: "T-086 immutable Production E2E",
    learnerCount: 2,
    courseRef: released,
    viewAcceptanceReceiptId: viewReceipt.receiptId,
    uiAcceptanceReceiptId: receipt.receiptId,
    coursewareRefs: productionCoursewareRefs,
    adminDmProfileIds: [initial.user.userId],
    mentorSeats: mentorSeats(generatedMentors.map((item) => item.userId)),
    learnerProfileIds: generatedLearners.map((item) => item.userId),
  }, adminCookie);
  const productionImpersonation = await post("/api/auth/impersonation", { classroomId: production.classroomId, effectiveProfileId: generatedLearners[0].userId }, adminCookie);
  assert.equal(productionImpersonation.status, 403);
  assert.equal(((await productionImpersonation.json()) as Envelope<never>).error?.code, "IMPERSONATION_PRODUCTION_FORBIDDEN");
  const before = await getData<Detail>(`/api/platform/classrooms/${production.classroomId}`, adminCookie);
  assert.deepEqual(before.courseware.find((item) => item.mentorRole === "O"), productionCoursewareRefs.find((item) => item.mentorRole === "O"));
  const forbiddenReset = await post(`/api/platform/classrooms/${production.classroomId}/reset`, {}, adminCookie);
  assert.equal(forbiddenReset.status, 403);
  assert.equal(((await forbiddenReset.json()) as Envelope<never>).error?.code, "PRODUCTION_RESET_FORBIDDEN");

  const nextCandidateBody = structuredClone(candidateBody);
  nextCandidateBody.title = `${nextCandidateBody.title} · later edit`;
  const laterCandidate = await postData<ExactRef>("/api/studio/candidates", { course: nextCandidateBody }, adminCookie);
  assert.ok(laterCandidate.revision > released.revision);
  const laterViewReceipt = await acceptView(laterCandidate, nextCandidateBody, adminCookie);
  const laterCourseware = await postData<CoursewareVersion>("/api/studio/courseware", {
    packageId: customOperationsCourseware.packageId,
    title: customOperationsCourseware.title,
    slug: customOperationsCourseware.slug,
    mentorRole: customOperationsCourseware.mentorRole,
    html: `<!doctype html><html><body><h1>运营导师 later r1</h1><p>既有 Production 不得静默升级。</p></body></html>`,
  }, adminCookie);
  assert.equal(laterCourseware.revision, 1);
  await postData(`/api/platform/classrooms/${testRoom.classroomId}/reset`, {}, adminCookie);
  const resetTestDetail = await getData<Detail>(`/api/platform/classrooms/${testRoom.classroomId}`, adminCookie);
  assert.equal(resetTestDetail.acceptance.uiReceiptId, null, "reset must detach the now-invalid UI receipt from the Test instance");
  const afterResetBootstrap = await getData<Bootstrap>("/api/studio/bootstrap", adminCookie);
  const invalidatedUiReceipt = afterResetBootstrap.uiReceipts.find((item) => item.receiptId === receipt.receiptId);
  assert.equal(invalidatedUiReceipt?.valid, false);
  assert.ok(invalidatedUiReceipt?.invalidReasons.some((reason) => reason.includes("重置")));
  const after = await getData<Detail>(`/api/platform/classrooms/${production.classroomId}`, adminCookie);
  assert.deepEqual({ ref: after.courseRef, courseware: after.courseware, controller: after.controller, lifecycle: after.lifecycle }, { ref: before.courseRef, courseware: before.courseware, controller: before.controller, lifecycle: before.lifecycle }, "Studio save, courseware update and Test reset must not mutate a running Production instance");

  const insufficientBody = structuredClone(nextCandidateBody);
  insufficientBody.title = `${insufficientBody.title} · incomplete six learner promise`;
  insufficientBody.learnerPolicy = { defaultCount: 4, minCount: 2, maxCount: 6, cardsPerLearner: 3, dealPolicy: "unique-within-step" };
  for (const block of insufficientBody.blocks) block.learnerTaskTemplate = { badge: "Young Builder", task: block.studentPrompt };
  const insufficientCandidate = await postData<ExactRef>("/api/studio/candidates", { course: insufficientBody }, adminCookie);
  const invalidatedViewState = await getData<Bootstrap>("/api/studio/bootstrap", adminCookie);
  const staleLaterView = invalidatedViewState.viewReceipts.find((item) => item.receiptId === laterViewReceipt.receiptId);
  assert.equal(staleLaterView?.valid, false, "saving a new Candidate must invalidate the superseded non-Released View receipt");
  const refusedViewAcceptance = await post("/api/studio/view-acceptance", {
    courseRef: insufficientCandidate,
    reviewedBlockIds: insufficientBody.blocks.map((block) => block.id),
    reviewedLearnerCounts: [2, 3, 4, 5, 6],
  }, adminCookie);
  assert.equal(refusedViewAcceptance.status, 409);
  assert.equal(((await refusedViewAcceptance.json()) as Envelope<never>).error?.code, "VIEW_ACCEPTANCE_CAPACITY_INVALID");
  const refusedTestCreation = await post("/api/platform/classrooms", {
    environment: "test",
    title: "T-086 view capacity gate",
    learnerCount: 2,
    courseRef: insufficientCandidate,
    viewAcceptanceReceiptId: laterViewReceipt.receiptId,
    coursewareRefs: testedCoursewareRefs,
    adminDmProfileIds: [initial.user.userId],
    mentorSeats: mentorSeats(generatedMentors.map((item) => item.userId)),
    learnerProfileIds: generatedLearners.map((item) => item.userId),
  }, adminCookie);
  assert.equal(refusedTestCreation.status, 409);
  assert.equal(((await refusedTestCreation.json()) as Envelope<never>).error?.code, "VIEW_ACCEPTANCE_RECEIPT_INVALID");

  const dynamicBody = expandForSix(structuredClone(nextCandidateBody));
  const dynamicCandidate = await postData<ExactRef>("/api/studio/candidates", { course: dynamicBody }, adminCookie);
  const dynamicViewReceipt = await acceptView(dynamicCandidate, dynamicBody, adminCookie);
  const sixRoom = await createClassroom({
    environment: "test",
    title: "T-086 six isolated learners E2E",
    learnerCount: 6,
    courseRef: dynamicCandidate,
    viewAcceptanceReceiptId: dynamicViewReceipt.receiptId,
    coursewareRefs: testedCoursewareRefs,
    adminDmProfileIds: [initial.user.userId],
    mentorSeats: mentorSeats(mentors.map((item) => item.username)),
    learnerProfileIds: learners.map((item) => item.username),
  }, adminCookie);
  const allCards: string[] = [];
  const sixLearnerCookies = new Map<string, string>();
  for (const learner of learners) {
    const cookie = await login(learner.username, learner.password);
    sixLearnerCookies.set(learner.username, cookie);
    const detail = await getData<Detail>(`/api/platform/classrooms/${sixRoom.classroomId}`, cookie);
    assert.equal(detail.learnerCount, 6);
    assert.equal(detail.myView?.kind, "learner");
    assert.equal(detail.controlView, null);
    const ids = detail.myView?.privateCards?.map((card) => card.id) ?? [];
    assert.equal(ids.length, 3);
    allCards.push(...ids);
  }
  assert.equal(allCards.length, 18);
  assert.equal(new Set(allCards).size, 18, "unique-within-step must isolate all 18 private cards");

  await postData(`/api/platform/classrooms/${sixRoom.classroomId}/reset`, {}, adminCookie);
  const resetSixRoom = await getData<Detail>(`/api/platform/classrooms/${sixRoom.classroomId}`, adminCookie);
  assert.deepEqual(
    { lifecycle: resetSixRoom.lifecycle, state: resetSixRoom.controller.state, blockId: resetSixRoom.controller.blockId, learnerCount: resetSixRoom.learnerCount },
    { lifecycle: "ready", state: "ready", blockId: "B01", learnerCount: 6 },
    "Test reset must preserve the declared six-learner capacity and return to B01 ready",
  );
  const resetCards: string[] = [];
  for (const learner of learners) {
    const detail = await getData<Detail>(`/api/platform/classrooms/${sixRoom.classroomId}`, sixLearnerCookies.get(learner.username)!);
    const ids = detail.myView?.privateCards?.map((card) => card.id) ?? [];
    assert.equal(ids.length, 3);
    resetCards.push(...ids);
  }
  assert.equal(new Set(resetCards).size, 18, "reset must rebuild six isolated three-card learner views without collisions");

  const mentorCookie = await login(mentors[0].username, mentors[0].password);
  const mentorIssued = await postData<Credential[]>("/api/studio/accounts", {
    accounts: [{ username: `mentor-created-builder-${suffix}`, displayName: "Mentor Created Builder", role: "learner" }],
  }, mentorCookie);
  assert.equal(mentorIssued.length, 1);
  const hiddenAdminRoom = await createClassroom({
    environment: "test",
    title: "Platform admin is not implicit Classroom Admin",
    learnerCount: 2,
    courseRef: dynamicCandidate,
    viewAcceptanceReceiptId: dynamicViewReceipt.receiptId,
    coursewareRefs: testedCoursewareRefs,
    adminDmProfileIds: [mentors[0].username],
    mentorSeats: mentorSeats(mentors.map((item) => item.username)),
    learnerProfileIds: learners.slice(0, 2).map((item) => item.username),
  }, mentorCookie);
  assert.equal((await get(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}`, adminCookie)).status, 403);
  assert.equal((await post(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/accounts`, { accounts: [{ username: `should-not-create-${suffix}`, displayName: "Forbidden", role: "learner" }] }, adminCookie)).status, 403);

  const ordinaryMentorCookie = await login(mentors[2].username, mentors[2].password);
  const ordinaryMentorGrant = await post(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[2].username }, ordinaryMentorCookie);
  assert.equal(ordinaryMentorGrant.status, 403, "a normal mentor cannot self-elevate to Admin DM");
  assert.equal(((await ordinaryMentorGrant.json()) as Envelope<never>).error?.code, "ADMIN_DM_REQUIRED");

  const delegateCookie = await login(mentors[1].username, mentors[1].password);
  const primarySelfGrant = await post(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[0].username }, mentorCookie);
  assert.equal(primarySelfGrant.status, 403, "grant must never downgrade the immutable Primary Admin DM");
  assert.equal(((await primarySelfGrant.json()) as Envelope<never>).error?.code, "ADMIN_DM_ALREADY_PRIMARY");
  await Promise.all([
    postData(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[1].username }, mentorCookie),
    postData(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[1].username }, mentorCookie),
  ]);
  await postData(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[1].username }, mentorCookie);
  const delegatedDetail = await getData<Detail>(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}`, delegateCookie);
  assert.equal(delegatedDetail.adminDmMode, "delegated");
  assert.equal(delegatedDetail.canDelegateAdminDm, false);
  assert.ok(delegatedDetail.controlView, "delegated Admin DM keeps operational classroom control");
  assert.deepEqual(delegatedDetail.admins.map((item) => item.mode), ["primary", "delegated"]);
  const delegatedGrant = await post(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[2].username }, delegateCookie);
  assert.equal(delegatedGrant.status, 403);
  assert.equal(((await delegatedGrant.json()) as Envelope<never>).error?.code, "ADMIN_DM_DELEGATION_REQUIRED");
  const delegatedRevoke = await post(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "revoke-admin-dm", profileId: mentors[0].username }, delegateCookie);
  assert.equal(delegatedRevoke.status, 403);
  assert.equal(((await delegatedRevoke.json()) as Envelope<never>).error?.code, "ADMIN_DM_DELEGATION_REQUIRED");
  const primaryRevoke = await post(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "revoke-admin-dm", profileId: mentors[0].username }, mentorCookie);
  assert.equal(primaryRevoke.status, 403);
  assert.equal(((await primaryRevoke.json()) as Envelope<never>).error?.code, "PRIMARY_ADMIN_DM_PROTECTED");
  const crossRoomDelegation = await post(`/api/platform/classrooms/${testRoom.classroomId}/members`, { type: "grant-admin-dm", profileId: mentors[2].username }, delegateCookie);
  assert.equal(crossRoomDelegation.status, 403);
  await Promise.all([
    postData(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "revoke-admin-dm", profileId: mentors[1].username }, mentorCookie),
    postData(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "revoke-admin-dm", profileId: mentors[1].username }, mentorCookie),
  ]);
  await postData(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, { type: "revoke-admin-dm", profileId: mentors[1].username }, mentorCookie);
  const primaryAfterIdempotentRevoke = await getData<Detail>(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}`, mentorCookie);
  assert.deepEqual(primaryAfterIdempotentRevoke.admins.map((item) => item.mode), ["primary"], "repeated grant/revoke must preserve exactly one Primary Admin DM");
  const revokedManagement = await get(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}/members`, delegateCookie);
  assert.equal(revokedManagement.status, 403, "revoked delegated permission must fail immediately even while mentor seat access remains");
  const stillMentor = await getData<Detail>(`/api/platform/classrooms/${hiddenAdminRoom.classroomId}`, delegateCookie);
  assert.equal(stillMentor.isAdminDm, false);
  assert.equal(stillMentor.myView?.kind, "mentor");

  console.log("COURSE_PLATFORM_E2E_PASS t086=view-receipt+ui-receipt+release-gates t087=navigation+account-menu+test-impersonation+nonrecursive-admin-dm candidate=exact production=isolated reset=receipt-invalidated learners=2,6 privateCards=18-unique screen=redacted");
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(persistPath, { recursive: true, force: true });
}

function expandForSix(course: CourseDefinition): CourseDefinition {
  course.title = `${course.title} · 6 learner capacity`;
  course.learnerPolicy = { defaultCount: 4, minCount: 2, maxCount: 6, cardsPerLearner: 3, dealPolicy: "unique-within-step" };
  for (const block of course.blocks) block.learnerTaskTemplate = { badge: "Young Builder", task: block.studentPrompt };
  for (const [deckIndex, deck] of course.decks.entries()) {
    const originals = structuredClone(deck.cards);
    while (deck.cards.length < 18) {
      const source = structuredClone(originals[(deck.cards.length - originals.length) % originals.length]);
      source.id = `${deck.id}:capacity-contract:${deckIndex}:${deck.cards.length + 1}`;
      source.title = `${String(source.title)} · 容量契约观察 ${deck.cards.length + 1}`;
      source.body = `${String(source.body)}（仅存在于自动化测试数据库，用于验证独立发牌容量。）`;
      deck.cards.push(source);
    }
  }
  return course;
}

function mentorSeats(ids: string[]) {
  return (["P", "D", "M", "O"] as const).map((mentorRole, index) => ({ mentorRole, profileId: ids[index] }));
}

function coursewareRefs(items: Courseware[], environment: "test" | "production") {
  return items.map((item) => ({
    mentorRole: item.mentorRole,
    packageId: item.packageId,
    slug: item.slug,
    revision: environment === "production" ? item.releasedRevision! : item.latestRevision,
    digest: environment === "production" ? item.releasedDigest! : item.latestDigest,
  }));
}

function supportedLearnerCounts(course: CourseDefinition): number[] {
  const policy = course.learnerPolicy ?? { minCount: 2, maxCount: 4 };
  return Array.from({ length: policy.maxCount - policy.minCount + 1 }, (_, index) => policy.minCount + index);
}

function acceptView(ref: ExactRef, course: CourseDefinition, cookie: string): Promise<ViewReceipt> {
  return postData<ViewReceipt>("/api/studio/view-acceptance", {
    courseRef: ref,
    reviewedBlockIds: course.blocks.map((block) => block.id),
    reviewedLearnerCounts: supportedLearnerCounts(course),
  }, cookie);
}

function uiAcceptanceChecks() {
  return {
    sameRuntimeUi: true,
    membershipsAndRbac: true,
    mentorTasksAndCourseware: true,
    learnerTasks: true,
    learnerPrivacy: true,
    sharedScreenRedaction: true,
    blockLifecycle: true,
    fiveStepCompletion: true,
    refreshAndRelogin: true,
    concurrencyConflict: true,
    testReset: true,
    responsiveLayouts: true,
    immutableRuntime: true,
    exactVersions: true,
  };
}

function acceptanceClients() {
  return [
    { browser: "Chromium E2E", platform: process.platform, viewport: { width: 390, height: 844 } },
    { browser: "Chromium E2E", platform: process.platform, viewport: { width: 1440, height: 900 } },
    { browser: "Chromium E2E", platform: process.platform, viewport: { width: 1920, height: 1080 } },
  ];
}

async function createClassroom(body: Record<string, unknown>, cookie: string): Promise<{ classroomId: string; teamPublicId: string }> {
  const result = await postData<{ classroomId: string; teamPublicId: string }>("/api/platform/classrooms", body, cookie);
  assert.ok(result.classroomId);
  assert.match(result.teamPublicId, /^TEAM-[A-Z2-9]{8}$/);
  return result;
}

async function control(roomId: string, expectedVersion: number, action: Record<string, unknown>, cookie: string): Promise<Controller> {
  return postData<Controller>(`/api/platform/classrooms/${roomId}/control`, { expectedVersion, action }, cookie);
}

async function completeClassroom(roomId: string, initial: Controller, cookie: string): Promise<Controller> {
  let controller = initial;
  for (let block = 0; block < 13; block += 1) {
    controller = await control(roomId, controller.version, { type: "execute" }, cookie);
    assert.equal(controller.state, "executing");
    controller = await control(roomId, controller.version, { type: "submit-for-acceptance" }, cookie);
    controller = await control(roomId, controller.version, { type: "accept" }, cookie);
    controller = await control(roomId, controller.version, block === 12 ? { type: "complete" } : { type: "advance" }, cookie);
  }
  return controller;
}

async function login(username: string, passwordValue: string): Promise<string> {
  const response = await post("/api/auth/login", { username, password: passwordValue, remember: false });
  assert.equal(response.status, 200, `${username}: ${await response.clone().text()}`);
  return cookieFrom(response);
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

async function mutate(path: string, method: "PATCH" | "POST" | "DELETE", body: unknown, cookie: string): Promise<Response> {
  return fetch(`${internalBase}${path}`, {
    method,
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

async function deleteData<T = Record<string, unknown>>(path: string, cookie: string): Promise<T> {
  const response = await fetch(`${internalBase}${path}`, {
    method: "DELETE",
    headers: { ...proxyHeaders(cookie), Origin: publicOrigin },
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = await response.json() as Envelope<T>;
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(envelope)}`);
  assert.equal(envelope.ok, true, `${path}: ${JSON.stringify(envelope)}`);
  assert.ok(envelope.data !== undefined);
  return envelope.data;
}

function cookieFrom(response: Response): string {
  const cookie = (response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  assert.match(cookie, /^__Secure-msv_session=.+/);
  return cookie;
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
