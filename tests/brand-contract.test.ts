import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFile(resolve(root, path), "utf8");

test("React surfaces share one accessible root-home logo primitive", async () => {
  const brand = await source("app/components/BrandHomeLink.tsx");
  assert.match(brand, /href=\{publicPath\("\/"\)\}/);
  assert.match(brand, /aria-label="返回 Mini Silicon Valley 主页"/);
  assert.match(brand, /publicPath\("\/favicon\.svg"\)/);
  assert.match(brand, /width=\{64\}[\s\S]*height=\{64\}/);

  const consumers = [
    "app/components/WorldApp.tsx",
    "app/auth/AuthShell.tsx",
    "app/account/AccountClient.tsx",
    "app/classroom/ClassroomHub.tsx",
    "app/classroom/ClassroomApp.tsx",
    "app/qa/QaClient.tsx",
    "app/not-found.tsx",
  ];
  for (const path of consumers) {
    assert.match(await source(path), /BrandHomeLink/, `${path} must consume the shared brand primitive`);
  }
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
  ];
  for (const path of pages) {
    const html = await source(path);
    assert.match(html, /href="\/"[^>]*aria-label="返回 Mini Silicon Valley 主页"/, `${path} must expose a real root anchor`);
    assert.match(html, /<img[^>]+src="\/favicon\.svg"[^>]+width="(?:44|64)"[^>]+height="(?:44|64)"/, `${path} must reuse the controlled SVG`);
  }
});

test("brand metadata, manifest, error routing and editor leave guard stay coherent", async () => {
  const layout = await source("app/layout.tsx");
  const manifest = JSON.parse(await source("deploy/minisv/site/site.webmanifest"));
  const gateway = await source("deploy/minisv/gateway/default.conf");
  const editor = await source("tools/live-run/static/editor.js");
  const asset = await source("public/favicon.svg");

  assert.match(asset, /viewBox="0 0 64 64"/);
  assert.match(layout, /publicPath\("\/og\.png"\)/);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons[0].src, "/favicon.svg");
  assert.match(gateway, /error_page 404 \/404\.html/);
  assert.match(editor, /beforeunload[\s\S]*if \(dirty\)/, "logo navigation must retain the native unsaved-work guard");
});
