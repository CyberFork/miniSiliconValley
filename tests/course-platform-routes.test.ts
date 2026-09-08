import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const required = [
  "app/studio/page.tsx",
  "app/studio/editor/page.tsx",
  "app/studio/preview/page.tsx",
  "app/studio/courseware/page.tsx",
  "app/studio/releases/page.tsx",
  "app/course/page.tsx",
  "app/course/[slug]/page.tsx",
  "app/classroom/[classroomId]/page.tsx",
  "app/classroom/[classroomId]/control/page.tsx",
  "app/classroom/[classroomId]/screen/page.tsx",
  "app/classroom/[classroomId]/members/page.tsx",
  "app/api/platform/classrooms/[classroomId]/screen/route.ts",
  "app/api/studio/view-acceptance/route.ts",
  "app/api/platform/classrooms/[classroomId]/receipt/route.ts",
];

test("T-085 route surface exists and has no legacy navigation dependency", () => {
  for (const relative of required) assert.equal(existsSync(new URL(relative, root)), true, `missing ${relative}`);
  const routeSources = required.map((relative) => readFileSync(new URL(relative, root), "utf8")).join("\n");
  assert.doesNotMatch(routeSources, /href=["']\/(?:alpha|control)(?:\/|["'])/);
});

test("T-086 navigation names the two acceptance gates and keeps UI preview on real Test Classroom routes", () => {
  const studio = readFileSync(new URL("app/studio/StudioApp.tsx", root), "utf8");
  const editor = readFileSync(new URL("public/studio/editor-assets/editor.js", root), "utf8");
  const classroom = readFileSync(new URL("app/classroom/ClassroomHub.tsx", root), "utf8");
  const course = readFileSync(new URL("app/course/page.tsx", root), "utf8");
  for (const marker of ["课程生产工作台", "多角色视图验收", "验收与发布", "导师课件库", "导师课件播放", "课堂中心"]) {
    assert.match(studio + classroom + course, new RegExp(marker), `missing navigation label ${marker}`);
  }
  assert.match(studio, /ViewAcceptanceReceipt/);
  assert.match(studio, /UiAcceptanceReceipt/);
  assert.match(editor, /前往多角色视图验收/);
  assert.match(classroom, /UI 验收课堂/);
  assert.match(classroom, /PRODUCTION/);
  assert.doesNotMatch(studio + editor + classroom, /href=["']\/ui-preview/);
});

test("T-086 release and factory APIs enforce two exact acceptance receipts", () => {
  const registry = readFileSync(new URL("app/lib/course-registry.ts", root), "utf8");
  const store = readFileSync(new URL("app/lib/classroom-platform-store.ts", root), "utf8");
  const factory = readFileSync(new URL("app/lib/classroom-factory.ts", root), "utf8");
  for (const marker of ["requireValidViewAcceptanceReceipt", "requireValidUiAcceptanceReceipt"]) {
    assert.match(registry, new RegExp(marker));
    assert.match(store, new RegExp(marker));
  }
  assert.match(factory, /viewAcceptanceReceiptId/);
  assert.match(factory, /uiAcceptanceReceiptId/);
  assert.match(store, /coursewareRefs: trustedCourseware/);
});

test("gateway owns Studio, Course and per-classroom app routes and retires global Alpha/Control", () => {
  const gateway = readFileSync(new URL("deploy/minisv/gateway/default.conf", root), "utf8");
  assert.match(gateway, /\(studio\|course\|classroom\|account\)/);
  assert.doesNotMatch(gateway, /location \^~ \/alpha\//);
  assert.doesNotMatch(gateway, /location \^~ \/control\//);
  assert.match(gateway, /location = \/alpha \{ return 410;/);
  assert.match(gateway, /location = \/control \{ return 410;/);
});

test("the opaque P-mentor courseware identity is pinned consistently across build, runtime and package metadata", () => {
  const build = readFileSync(new URL("deploy/minisv/scripts/build-chj-course.sh", root), "utf8");
  const renderer = readFileSync(new URL("deploy/minisv/scripts/render-chj-course-static.mjs", root), "utf8");
  const runtime = readFileSync(new URL("app/lib/courseware-store.ts", root), "utf8");
  const packager = readFileSync(new URL("deploy/minisv/package_release.py", root), "utf8");
  const commit = build.match(/EXPECTED_HEAD="([0-9a-f]{40})"/)?.[1];
  const tree = build.match(/EXPECTED_TREE="([0-9a-f]{40})"/)?.[1];
  assert.ok(commit && tree);
  assert.match(runtime, new RegExp(commit));
  assert.match(runtime, new RegExp(tree));
  assert.match(packager, new RegExp(commit));
  assert.match(packager, new RegExp(tree));
  assert.match(runtime, /static-bundle:\$\{item\.entryPath\}:\$\{item\.sourceIdentity\}/);
  for (const source of [build, renderer]) {
    assert.match(source, /courseware\/product-mentor-foundations/);
    assert.doesNotMatch(source, /MSV_PUBLIC_BASE must be \/course\//);
  }
});

test("one-time managed credentials are blocked from platform data until password replacement", () => {
  const shared = readFileSync(new URL("app/api/platform/_shared.ts", root), "utf8");
  const login = readFileSync(new URL("app/auth/AuthForms.tsx", root), "utf8");
  assert.match(shared, /PASSWORD_CHANGE_REQUIRED/);
  assert.match(login, /result\.user\.mustChangePassword/);
  assert.match(login, /\/account\?first=1&returnTo=/);
});

test("shared screen reads a dedicated allow-list projection instead of the private seat payload", () => {
  const runtime = readFileSync(new URL("app/classroom/ClassroomRuntime.tsx", root), "utf8");
  const route = readFileSync(new URL("app/api/platform/classrooms/[classroomId]/screen/route.ts", root), "utf8");
  const store = readFileSync(new URL("app/lib/classroom-platform-store.ts", root), "utf8");
  assert.match(runtime, /\/api\/platform\/classrooms\/\$\{encodeURIComponent\(classroomId\)\}\/screen/);
  assert.match(route, /getClassroomSharedScreen/);
  assert.match(store, /construct an explicit allow-list response/);
  assert.doesNotMatch(route, /getClassroomInstance\(/);
});

test("trusted mentors can bootstrap a classroom and become its scoped Admin DM", () => {
  const accounts = readFileSync(new URL("app/api/studio/accounts/route.ts", root), "utf8");
  const store = readFileSync(new URL("app/lib/classroom-platform-store.ts", root), "utf8");
  assert.match(accounts, /requireStudioRole\(user\)/);
  assert.match(store, /user\.platformRole !== "admin" && user\.platformRole !== "mentor"/);
  assert.match(store, /ADMIN_DM_SELF_GRANT_REQUIRED/);
});

test("retired POST endpoints drain request bodies before returning tombstones", () => {
  for (const relative of [
    "app/api/auth/admin/codes/route.ts",
    "app/api/auth/admin/invitations/route.ts",
    "app/api/auth/recover/route.ts",
    "app/api/auth/recovery-codes/route.ts",
  ]) {
    const source = readFileSync(new URL(relative, root), "utf8");
    assert.match(source, /POST\(request: Request\)/, `${relative} must accept the request stream`);
    assert.match(source, /await request\.text\(\)/, `${relative} must drain the request stream before responding`);
  }
});
