import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFile(resolve(root, path), "utf8");
const binary = (path: string) => readFile(resolve(root, path));
const wordmark = "/assets/mini-silicon-valley-logo-transparent.png";
const brandCacheVersion = "official-wordmark-r5";

test("React surfaces share one accessible root-home logo primitive", async () => {
  const brand = await source("app/components/BrandHomeLink.tsx");
  assert.match(brand, /href=\{publicPath\("\/"\)\}/);
  assert.match(brand, /aria-label="返回 Mini Silicon Valley 主页"/);
  assert.match(brand, /publicPath\("\/assets\/mini-silicon-valley-logo-transparent\.png"\)/);
  assert.match(brand, /width=\{330\}[\s\S]*height=\{84\}/);
  assert.doesNotMatch(brand, /publicPath\("\/favicon\.svg"\)/, "browser favicon must not be rendered as the in-page brand");

  const consumers = [
    "app/components/WorldApp.tsx",
    "app/auth/AuthShell.tsx",
    "app/account/AccountClient.tsx",
    "app/classroom/ClassroomHub.tsx",
    "app/classroom/ClassroomApp.tsx",
    "app/classroom/ClassroomRuntime.tsx",
    "app/course/[slug]/CoursewareFrame.tsx",
    "app/classroom/[classroomId]/courseware/[mentorRole]/page.tsx",
    "app/qa/QaClient.tsx",
    "app/course/page.tsx",
    "app/studio/StudioApp.tsx",
    "app/not-found.tsx",
  ];
  for (const path of consumers) {
    assert.match(await source(path), /BrandHomeLink/, `${path} must consume the shared brand primitive`);
  }

  for (const path of ["app/auth/AuthShell.tsx", "app/account/AccountClient.tsx"]) {
    const shell = await source(path);
    assert.match(shell, /className=\{styles\.navLinks\}/, `${path} must retain its real navigation links`);
    assert.doesNotMatch(shell, /data-msv-theme-slot/, `${path} must not reserve space for the retired theme switch`);
  }
  const authCss = await source("app/auth/auth.module.css");
  assert.match(authCss, /@media \(max-width: 700px\)[\s\S]*\.navLinks\s*>\s*a \{ display: none; \}/, "mobile auth navigation must not leave off-canvas focusable links");
});

test("static operational surfaces use the same mark and absolute root link", async () => {
  const pages = [
    "deploy/minisv/site/index.html",
    "deploy/minisv/site/404.html",
    "tools/live-run/static/index.html",
    "tools/live-run/static/editor.html",
    "tools/live-run/static/seat.html",
    "tools/live-run/remote-console/static/index.html",
    "tools/live-run/remote-console/static/seat-loading.html",
    "deploy/minisv/workshop/archive.html",
    "app/studio/editor/workbench.html",
  ];
  for (const path of pages) {
    const html = await source(path);
    assert.match(html, /href="\/"[^>]*aria-label="返回 Mini Silicon Valley 主页"/, `${path} must expose a real root anchor`);
    assert.match(html, /<img[^>]+src="\/assets\/mini-silicon-valley-logo-transparent\.png"[^>]+width="330"[^>]+height="84"/, `${path} must reuse the official wordmark`);
    assert.doesNotMatch(html, /<img[^>]+src="\/favicon\.svg"/, `${path} must not render the browser favicon as its visible logo`);
  }
});

test("changed wordmark styles and runtimes are cache-busted on every static shell", async () => {
  const themeVersion = `20260912-${brandCacheVersion}`;
  const sharedThemePages = [
    "deploy/minisv/site/index.html",
    "deploy/minisv/site/404.html",
    "tools/live-run/static/index.html",
    "tools/live-run/static/editor.html",
    "tools/live-run/static/seat.html",
    "tools/live-run/remote-console/static/index.html",
    "tools/live-run/remote-console/static/seat-loading.html",
    "deploy/minisv/workshop/archive.html",
  ];
  for (const path of sharedThemePages) {
    const html = await source(path);
    assert.match(html, new RegExp(`/ui-theme\\.css\\?v=${themeVersion}`), `${path} must evict the pre-wordmark CSS`);
    assert.match(html, new RegExp(`/ui-theme\\.js\\?v=${themeVersion}`), `${path} must evict the pre-wordmark runtime`);
  }

  const portal = await source("deploy/minisv/site/index.html");
  assert.match(portal, new RegExp(`/portal\\.css\\?v=${themeVersion}`), "home must evict the old square-logo layout");

  const workbench = await source("app/studio/editor/workbench.html");
  assert.match(workbench, new RegExp(`/studio/editor-assets/ui-theme\\.css\\?v=${brandCacheVersion}`));
  assert.match(workbench, new RegExp(`/studio/editor-assets/editor-loader\\.js\\?v=${brandCacheVersion}`));
  const loader = await source("public/studio/editor-assets/editor-loader.js");
  assert.match(loader, new RegExp(`/studio/editor-assets/ui-theme\\.js\\?v=${brandCacheVersion}`));

  const packager = await source("deploy/minisv/package_release.py");
  const proxy = await source("deploy/minisv/gateway/app-proxy.conf");
  assert.match(packager, new RegExp(`THEME_VERSION = "${themeVersion}"`));
  assert.match(proxy, new RegExp(`/ui-theme\\.css\\?v=${themeVersion}`));
  assert.match(proxy, new RegExp(`/ui-theme\\.js\\?v=${themeVersion}`));
});

test("Classroom top navigation has no injected UI control or reserved overlap slot", async () => {
  const runtime = await source("app/classroom/ClassroomRuntime.tsx");
  const styles = await source("app/classroom/platform.module.css");
  const themeRuntime = await source("deploy/minisv/site/ui-theme.js");

  assert.match(runtime, /className=\{styles\.runtimeTop\}[\s\S]*aria-label="课堂内导航"/);
  assert.match(runtime, /<BrandHomeLink className=\{styles\.runtimeBrand\}/, "live classroom header must use the shared root-home mark");
  assert.match(runtime, /<BrandHomeLink markOnly className=\{styles\.screenBrand\}/, "shared projection must retain a compact root-home mark");
  for (const label of ["我的席位", "主控", "投屏", "成员", "退出"]) assert.match(runtime, new RegExp(label));
  assert.doesNotMatch(runtime, /data-msv-theme-slot|msv-ui-switch/);
  assert.match(styles, /\.runtimeTop\{[^}]*display:flex[^}]*justify-content:space-between/);
  assert.doesNotMatch(themeRuntime, /function mountSwitcher|createElement\("button"\)/);
  assert.match(themeRuntime, /root\.dataset\.msvTheme = "adventure"/);
});

test("independently hydrated framework repairs its legacy top marker after load", async () => {
  const runtime = await source("deploy/minisv/site/ui-theme.js");
  assert.match(runtime, /function mountFrameworkBrandHome\(\)/);
  assert.match(runtime, /pathname !== "\/framework\/"/);
  assert.match(runtime, /setAttribute\("href", "\/"\)/);
  assert.match(runtime, /setAttribute\("aria-label", "返回 Mini Silicon Valley 主页"\)/);
  assert.match(runtime, /BRAND_WORDMARK_SRC = "\/assets\/mini-silicon-valley-logo-transparent\.png"/);
  assert.match(runtime, /mark\.src = BRAND_WORDMARK_SRC/);
  assert.match(runtime, /new MutationObserver/);
  assert.match(runtime, /attributeFilter: \["href", "aria-label", "src"\]/);
  assert.match(runtime, /window\.addEventListener\("load", mountSharedNavigation/);
});

test("brand metadata, manifest, error routing and editor leave guard stay coherent", async () => {
  const layout = await source("app/layout.tsx");
  const manifest = JSON.parse(await source("deploy/minisv/site/site.webmanifest"));
  const gateway = await source("deploy/minisv/gateway/default.conf");
  const editor = await source("tools/live-run/static/editor.js");
  const favicon = await source("public/favicon.svg");
  const officialWordmark = await binary("public/assets/mini-silicon-valley-logo-transparent.png");

  assert.match(favicon, /viewBox="0 0 64 64"/);
  assert.equal(createHash("sha256").update(officialWordmark).digest("hex"), "4dbbe4dea625fd372c6d760f2344fbf62b7b15f0d2d14e490cddd56e05ffbe87");
  assert.match(layout, /data-msv-theme="adventure"/, "the latest Adventure UI must be the server-rendered canonical skin");
  assert.match(layout, /publicPath\("\/og\.png"\)/);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons[0].src, "/favicon.svg");
  assert.equal(wordmark, "/assets/mini-silicon-valley-logo-transparent.png");
  assert.match(gateway, /error_page 404 \/404\.html/);
  assert.match(editor, /beforeunload[\s\S]*if \(dirty\)/, "logo navigation must retain the native unsaved-work guard");
});
