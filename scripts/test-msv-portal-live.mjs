#!/usr/bin/env node

import assert from "node:assert/strict";

const origin = (process.env.MSV_PORTAL_ORIGIN ?? "https://work.cyberforker.com").replace(/\/$/, "");

async function request(path, expectedStatus, expectedLocation) {
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  assert.equal(response.status, expectedStatus, `${path} status`);
  if (expectedLocation !== undefined) {
    assert.equal(response.headers.get("location"), expectedLocation, `${path} location`);
  }
  return response;
}

await request("/msv?source=live-smoke", 308, "/msv/?source=live-smoke");

const portal = await request("/msv/", 200);
assert.equal(portal.headers.get("x-msv-portal"), "site-map-v1");
const html = await portal.text();
assert.match(html, /<title>Mini Silicon Valley｜项目导航<\/title>/);
assert.match(html, /展开 18 个已部署页面/);

const redirects = [
  ["/msv/world?case=eleme", "/msv/demo/app/?case=eleme"],
  ["/msv/classroom?team=TEAM-MHKNJEAG", "/msv/demo/app/classroom?team=TEAM-MHKNJEAG"],
  ["/msv/framework?view=mentor", "/msv/123456.html?view=mentor"],
  ["/msv/parents?from=portal", "/msv/qa.html?from=portal"],
  ["/msv/workshop?from=portal", "/msv/launch.html?from=portal"],
  ["/msv/login?returnTo=%2Fclassroom", "/msv/demo/app/auth/login?returnTo=%2Fclassroom"],
  ["/msv/login/?returnTo=%2Fclassroom", "/msv/demo/app/auth/login?returnTo=%2Fclassroom"],
  ["/msv/register?from=classroom", "/msv/demo/app/auth/register?from=classroom"],
  ["/msv/register/?from=classroom", "/msv/demo/app/auth/register?from=classroom"],
  ["/msv/recover?from=login", "/msv/demo/app/auth/recover?from=login"],
  ["/msv/recover/?from=login", "/msv/demo/app/auth/recover?from=login"],
  ["/msv/account?from=portal", "/msv/demo/app/account?from=portal"],
  ["/msv/account/?from=portal", "/msv/demo/app/account?from=portal"],
];
for (const [source, target] of redirects) await request(source, 302, target);
await request("/msv/alpha?run=MSV-ELEME-TEST", 308, "/msv/alpha/?run=MSV-ELEME-TEST");
await request("/msv/demo/app/classroom", 307, "/msv/demo/app/auth/login?returnTo=%2Fclassroom");
await request("/msv/demo/app/account", 307, "/msv/demo/app/auth/login?returnTo=%2Faccount");

const css = await request("/msv/portal.css", 200);
assert.match(css.headers.get("content-type") ?? "", /^text\/css/);

const sitemapResponse = await request("/msv/sitemap.json", 200);
assert.match(sitemapResponse.headers.get("content-type") ?? "", /^application\/json/);
const sitemap = await sitemapResponse.json();
assert.equal(sitemap.root, `${origin}/msv/`);
assert.equal(sitemap.stableEntries.length, 7);
assert.equal(sitemap.utilityEntries.length, 4);
assert.equal(sitemap.implementationPages.length, 17);

for (const [name, target] of [
  ["demo", `${origin}/msv/demo.html`],
  ["123456", `${origin}/msv/123456.html`],
  ["qa", `${origin}/msv/qa.html`],
]) {
  const response = await request(`/msv/${name}-manifest.json`, 200);
  const manifest = await response.json();
  assert.equal(manifest.target, target, `${name} manifest target`);
  assert.ok(manifest.targets.some((entry) => entry.canonical === target));
}

for (const path of [
  "/msv/index.html",
  "/msv/launch.html",
  "/msv/demo.html",
  "/msv/123456.html",
  "/msv/qa.html",
  "/msv/demo/app/",
  "/msv/demo/app/auth/login",
  "/msv/alpha/",
  "/msv/alpha/index.html",
  "/msv/alpha/seat.html",
]) {
  await request(path, 200);
}

console.log(`MSV_PORTAL_LIVE_PASS origin=${origin} stable=7 utilities=4 pages=18 query=preserved`);
