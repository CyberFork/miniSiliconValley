import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("T-123 provides the public, learner-service and internal Console route families", () => {
  for (const path of [
    "app/terminal/[[...app]]/page.tsx",
    "app/classroom/page.tsx",
    "app/course/page.tsx",
    "app/account/page.tsx",
    "app/console/page.tsx",
    "app/console/accounts/page.tsx",
    "app/console/classrooms/page.tsx",
    "app/console/studio/editor/page.tsx",
    "app/console/studio/preview/page.tsx",
    "app/console/studio/releases/page.tsx",
    "app/console/courseware/page.tsx",
    "app/console/qa/page.tsx",
    "app/console/archive/page.tsx",
    "app/console/settings/page.tsx",
  ]) assert.equal(existsSync(new URL(path, root)), true, `missing ${path}`);
});

test("T-123 enforces Console RBAC on the server and leaves personal surfaces separate", () => {
  const gate = source("app/console/console-auth.tsx");
  const personal = source("app/account/AccountClient.tsx");
  const accounts = source("app/console/accounts/page.tsx");
  const publicClassrooms = source("app/classroom/page.tsx");
  const managedClassrooms = source("app/console/classrooms/page.tsx");
  assert.match(gate, /chatGPTSignInPath\(returnTo\)/);
  assert.match(gate, /requireCompletedPasswordSetup\(user, returnTo\)/);
  assert.match(gate, /user\.role !== "admin" && user\.role !== "mentor"/);
  assert.match(gate, /403 · INTERNAL WORKBENCH/);
  assert.doesNotMatch(personal, /LearnerAdminPanel|PasswordAssistancePanel|api\/auth\/admin\/users/);
  assert.match(accounts, /LearnerAdminPanel/);
  assert.match(accounts, /PasswordAssistancePanel/);
  assert.match(publicClassrooms, /mode="participant"/);
  assert.match(managedClassrooms, /mode="manage"/);
});

test("T-123 keeps public navigation cache-safe and reveals Workbench only from account projection", () => {
  const homepage = source("deploy/minisv/site/index.html");
  const portal = source("deploy/minisv/site/portal.js");
  assert.match(homepage, /class="terminal-shortcut" href="\/terminal\/"/);
  assert.doesNotMatch(homepage, /href="\/console\/"/);
  assert.match(portal, /current\.role === "admin" \|\| current\.role === "mentor"/);
  assert.match(portal, /actionLink\("工作台", "\/console\/"/);
  assert.match(portal, /credentials: "same-origin"/);
  assert.doesNotMatch(homepage + portal, /localStorage|sessionStorage/);
});

test("T-123 legacy Studio pages are redirects, not a second maintained UI", () => {
  const targets: Record<string, string> = {
    "app/studio/page.tsx": "/console/studio/",
    "app/studio/editor/page.tsx": "/console/studio/editor/",
    "app/studio/preview/page.tsx": "/console/studio/preview/",
    "app/studio/reviews/page.tsx": "/console/studio/reviews/",
    "app/studio/releases/page.tsx": "/console/studio/releases/",
    "app/studio/courseware/page.tsx": "/console/courseware/",
    "app/studio/history/page.tsx": "/console/archive/",
  };
  const helper = source("app/studio/legacy-redirect.ts");
  assert.match(helper, /permanentRedirect/);
  assert.match(helper, /URLSearchParams/);
  assert.match(helper, /params\.append/);
  for (const [path, target] of Object.entries(targets)) {
    const page = source(path);
    assert.match(page, /permanentRedirect|redirectLegacyStudio/);
    assert.match(page, new RegExp(target.replaceAll("/", "\\/")));
    assert.doesNotMatch(page, /StudioApp|CoursewareFrame|ClassroomHub/);
  }
});

test("T-123 deployment gateway and internal deep links use the same route split", () => {
  const gateway = source("deploy/minisv/gateway/default.conf");
  const workshop = source("deploy/minisv/workshop/archive.html");
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  assert.match(gateway, /\(studio\|console\|terminal\|course\|classroom\|account\|u\|homework\)/);
  assert.match(gateway, /location \^~ \/api\/terminal\//);
  assert.match(gateway, /location \^~ \/api\/public\/spaces\//);
  assert.doesNotMatch(workshop, /href="\/studio\//);
  assert.match(workshop, /href="\/console\/archive\/"/);
  assert.match(runtime, /`\/console\/classrooms\/\$\{classroomId\}\/control\/`/);
});
