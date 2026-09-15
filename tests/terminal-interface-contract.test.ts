import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { formatTerminalDateTime } from "../app/lib/terminal-clock";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("T-124 exposes a refreshable terminal shell and every agreed app route", () => {
  const page = source("app/terminal/[[...app]]/page.tsx");
  const client = source("app/terminal/TerminalClient.tsx");
  const styles = source("app/terminal/terminal.module.css");
  for (const app of ["home", "identity", "courses", "space", "wallet", "shop", "homework", "games", "grants"]) {
    assert.match(page, new RegExp(`"${app}"`));
  }
  for (const label of ["硅谷空间", "我的身份", "我的课程", "课后作业", "游戏中心", "我的钱包", "在线商店", "导师发币"]) {
    assert.match(client, new RegExp(label));
  }
  assert.match(client, /formatTerminalDateTime\(new Date\(\)\)/);
  assert.match(client, /window\.setInterval\(updateClock, 1_000\)/);
  assert.match(client, /window\.clearInterval\(timer\)/);
  assert.match(client, /<time dateTime=\{clock\?\.dateTime\}/);
  assert.doesNotMatch(client, /时间处于混乱状态|>--:--</);
  assert.match(client, /window\.history\.pushState/);
  assert.match(client, /window\.addEventListener\("popstate"/);
  assert.match(client, /mini-silicon-valley-logo-transparent\.png[\s\S]*unoptimized/);
  assert.match(client, /data-active-app=\{app\}/);
  assert.match(client, /<span>▣<\/span><b>开始<\/b>/);
  assert.match(styles, /Windows 95-inspired pocket computer/);
  assert.match(styles, /background-color:#008080/);
  assert.match(styles, /background:linear-gradient\(90deg,#000080,#1084d0\)/);
  assert.match(styles, /width:min\(480px,100%\)/);
  assert.match(styles, /@media\(max-width:520px\)/);
  assert.match(styles, /font-family:"Terrarum Sans Bitmap"/);
  assert.match(styles, /--terminal-font:"Terrarum Sans Bitmap"/);
  assert.doesNotMatch(styles, /MS Sans Serif|Courier New/);
  assert.equal(existsSync(new URL("public/fonts/terrarum-sans-bitmap/TerrarumSansBitmap.woff2", root)), true);
  assert.equal(existsSync(new URL("public/fonts/terrarum-sans-bitmap/LICENSE.md", root)), true);
});

test("terminal clock uses the requested local YYYY.MM.DD HH:mm format", () => {
  const value = new Date(2026, 8, 15, 17, 20, 42);
  assert.equal(formatTerminalDateTime(value).display, "2026.09.15 17:20");
  assert.equal(formatTerminalDateTime(value).dateTime, value.toISOString());
});

test("T-124 implements real APIs, public-space privacy, wallet isolation and designed confirmations", () => {
  for (const path of [
    "app/api/terminal/bootstrap/route.ts",
    "app/api/terminal/wallet/route.ts",
    "app/api/terminal/space/route.ts",
    "app/api/terminal/purchase/route.ts",
    "app/api/terminal/equip/route.ts",
    "app/api/terminal/grants/route.ts",
    "app/api/terminal/grants/[transactionId]/reverse/route.ts",
    "app/api/public/spaces/[studentId]/route.ts",
    "app/u/[studentId]/page.tsx",
  ]) assert.equal(existsSync(new URL(path, root)), true, `missing ${path}`);
  const store = source("app/lib/terminal-store.ts");
  const client = source("app/terminal/TerminalClient.tsx");
  const publicPage = source("app/u/[studentId]/page.tsx");
  assert.match(store, /TerminalEnvironment = "test" \| "production"/);
  assert.match(store, /TERMINAL_IDEMPOTENCY_CONFLICT/);
  assert.match(store, /导师只能纠正自己发放的硅谷币/);
  assert.match(client, /role="alertdialog" aria-label="确认兑换装饰"/);
  assert.doesNotMatch(client, /window\.confirm/);
  assert.match(publicPage, /不展示作业草稿、私密卡、钱包、密码、登录信息或管理备注/);
  assert.match(publicPage, /robots: \{ index: false/);
});
