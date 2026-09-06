import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../site/msv-portal/", import.meta.url);
const NGINX = new URL("../deploy/work-portal-location.conf", import.meta.url);
const STABLE = ["/msv/", "/msv/world", "/msv/classroom", "/msv/framework", "/msv/parents", "/msv/workshop", "/msv/alpha"];
const UTILITIES = ["/msv/login", "/msv/register", "/msv/recover", "/msv/account"];

test("portal exposes one root and six stable semantic destinations", async () => {
  const html = await readFile(new URL("index.html", ROOT), "utf8");
  const sitemap = JSON.parse(await readFile(new URL("sitemap.json", ROOT), "utf8"));
  assert.match(html, /<link rel="canonical" href="https:\/\/work\.cyberforker\.com\/msv\/">/);
  assert.deepEqual(sitemap.stableEntries.map((entry) => entry.path), STABLE);
  assert.deepEqual(sitemap.utilityEntries.map((entry) => entry.path), UTILITIES);
  for (const path of STABLE.slice(1)) assert.match(html, new RegExp(`href="${path.replace("/", "\\/")}`));
  for (const path of UTILITIES) assert.match(html, new RegExp(`href="${path.replace("/", "\\/")}`));
  assert.equal(new Set(sitemap.implementationPages).size, sitemap.implementationPages.length);
  assert.equal(sitemap.implementationPages.length, 17);
  assert.match(html, /展开 18 个已部署页面/);
  for (const page of sitemap.implementationPages) assert.ok(html.includes(`<code>${page}</code>`), `inventory is missing ${page}`);
});

test("portal is script-free, accessible, responsive and free of root-leaking assets", async () => {
  const html = await readFile(new URL("index.html", ROOT), "utf8");
  const css = await readFile(new URL("portal.css", ROOT), "utf8");
  assert.doesNotMatch(html, /<script\b/i);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /aria-label=/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /:focus-visible/);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (value.startsWith("#") || value.startsWith("https://")) continue;
    assert.ok(value.startsWith("/msv/"), `resource or route escaped /msv/: ${value}`);
  }
});

test("gateway keeps one canonical root and non-permanent semantic aliases", async () => {
  const config = await readFile(NGINX, "utf8");
  assert.match(config, /location = \/msv \{\s*return 308 \/msv\/\$is_args\$args;/);
  const redirects = {
    "/msv/world": "/msv/demo/app/",
    "/msv/classroom": "/msv/demo/app/classroom",
    "/msv/framework": "/msv/123456.html",
    "/msv/parents": "/msv/qa.html",
    "/msv/workshop": "/msv/launch.html",
    "/msv/login": "/msv/demo/app/auth/login",
    "/msv/login/": "/msv/demo/app/auth/login",
    "/msv/register": "/msv/demo/app/auth/register",
    "/msv/register/": "/msv/demo/app/auth/register",
    "/msv/recover": "/msv/demo/app/auth/recover",
    "/msv/recover/": "/msv/demo/app/auth/recover",
    "/msv/account": "/msv/demo/app/account",
    "/msv/account/": "/msv/demo/app/account",
  };
  for (const [source, target] of Object.entries(redirects)) {
    const escapedSource = source.replaceAll("/", "\\/");
    const escapedTarget = target.replaceAll("/", "\\/").replaceAll(".", "\\.");
    assert.match(config, new RegExp(`location = ${escapedSource} \\{ return 302 ${escapedTarget}\\$is_args\\$args; \\}`));
  }
  assert.doesNotMatch(config, /location = \/msv \{\s*return 30[128] \/msv\/launch\.html/);
});
