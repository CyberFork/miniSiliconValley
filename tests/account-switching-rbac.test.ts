import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("Studio navigation is a real-link, route-derived and recoverable surface", () => {
  const studio = source("app/studio/StudioApp.tsx");
  for (const href of ["/studio/", "/studio/editor/", "/studio/preview/", "/studio/releases/", "/studio/courseware/"]) {
    assert.match(studio, new RegExp(href.replaceAll("/", "\\/")));
  }
  assert.match(studio, /<a[\s\S]*href=\{item\.href\}/);
  assert.match(studio, /aria-current=\{item\.id === section \? "page"/);
  assert.match(studio, /正在打开…/);
  assert.match(studio, /onClick=\{\(\) => void load\(\)\}>重试/);
  assert.doesNotMatch(studio, /href="#"/);
});

test("unified account menu performs server logout and never stores credentials", () => {
  const menu = source("app/components/AccountMenu.tsx");
  const logout = source("app/api/auth/logout/route.ts");
  for (const label of ["账户中心", "切换账号", "退出登录", "返回管理员身份"]) assert.match(menu, new RegExp(label));
  assert.match(menu, /mutate\("\/api\/auth\/logout", "POST"\)/);
  assert.match(menu, /safeRelativePath/);
  assert.doesNotMatch(menu, /localStorage|sessionStorage|password/i);
  assert.match(logout, /revokeCurrentSession/);
  assert.match(logout, /Clear-Site-Data/);
});

test("Test impersonation is server-scoped, short-lived and actor/effective audited", () => {
  const auth = source("app/lib/auth-store.ts");
  const shared = source("app/api/platform/_shared.ts");
  const route = source("app/api/auth/impersonation/route.ts");
  assert.match(auth, /const IMPERSONATION_MS = 30 \* 60 \* 1_000/);
  assert.match(auth, /target\.environment !== "test"/);
  assert.match(auth, /target\.role === "admin"/);
  assert.match(auth, /classroom_admin_dm_grants actor_grant/);
  assert.match(auth, /actor_has_scope/);
  assert.match(auth, /actor-grant-revoked/);
  assert.match(auth, /auth\.impersonation\.started/);
  assert.match(auth, /auth\.impersonation\.stopped/);
  assert.match(shared, /session\.impersonation\?\.actor\.userId \?\? session\.userId/);
  assert.match(shared, /auth\.impersonation\.request-denied/);
  assert.match(shared, /auth\.authorization\.request-denied/);
  assert.match(shared, /expiresAt: session\.impersonation\?\.expiresAt \?\? null/);
  assert.match(route, /Clear-Site-Data/);
});

test("Admin DM authority is primary/delegated and cannot recurse", () => {
  const migration = source("drizzle/0006_account_switching_and_admin_dm_delegation.sql");
  const store = source("app/lib/classroom-platform-store.ts");
  assert.match(migration, /delegation_mode[\s\S]*primary[\s\S]*delegated/);
  assert.match(migration, /chk_classroom_admin_dm_can_delegate/);
  assert.match(migration, /admin-dm-primary:/);
  assert.match(store, /requireAdminDmDelegator/);
  assert.match(store, /grant\.mode !== "primary" \|\| !grant\.canDelegate/);
  assert.match(store, /account\.role !== "mentor"/);
  assert.match(store, /PRIMARY_ADMIN_DM_PROTECTED/);
  assert.match(store, /membership\.admin-dm\.denied/);
  assert.match(store, /relinquish-admin-dm/);
});

test("account recovery for test identities remains exact-room and one-time", () => {
  const auth = source("app/lib/auth-store.ts");
  const route = source("app/api/platform/classrooms/[classroomId]/test-identities/route.ts");
  assert.match(auth, /manageTestClassroomIdentity/);
  assert.match(auth, /target\.role !== "admin"/);
  assert.match(auth, /must_change_password = 1/);
  assert.match(auth, /auth\.test-credential\.regenerated/);
  assert.doesNotMatch(auth.match(/auth\.test-credential\.regenerated[\s\S]{0,220}/)?.[0] ?? "", /initialPassword/);
  assert.match(route, /reset-credential/);
  assert.match(route, /requirePlatformAdmin\(user\)/);
});
