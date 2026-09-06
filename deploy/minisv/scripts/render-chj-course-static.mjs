#!/usr/bin/env node

/**
 * Render the fixed chj application into a static /course/ artifact.
 *
 * This script lives outside the colleague-owned checkout. It deliberately
 * performs no HTML/CSS/JS rewriting: it asks the unmodified Vinext worker to
 * render `/`, then copies the complete client build byte-for-byte.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [sourceValue, outputValue] = process.argv.slice(2);
if (!sourceValue || !outputValue) {
  throw new Error("usage: render-chj-course-static.mjs <chj-checkout> <output>");
}

const source = resolve(sourceValue);
const output = resolve(outputValue);
const client = resolve(source, "dist", "client");
const server = resolve(source, "dist", "server", "index.js");

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

requireCondition(process.env.MSV_PUBLIC_BASE === "/course/", "MSV_PUBLIC_BASE must be /course/");
requireCondition(process.env.MSV_SITE_ORIGIN === "https://minisv.vip", "MSV_SITE_ORIGIN must be https://minisv.vip");
requireCondition(process.env.MSV_CANONICAL_URL === "https://minisv.vip/course/", "MSV_CANONICAL_URL must be https://minisv.vip/course/");

const { default: worker } = await import(`${pathToFileURL(server).href}?course-static=${Date.now()}`);
const response = await worker.fetch(
  new Request("https://minisv.vip/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
requireCondition(response.status === 200, `chj server render failed with ${response.status}`);
const html = await response.text();

for (const marker of [
  "青少年AI创业营",
  "MINI硅谷",
  "/course/_next/",
  "/course/assets/home-workbench.png",
  '<link rel="canonical" href="https://minisv.vip/course/"',
]) {
  requireCondition(html.includes(marker), `rendered chj page is missing ${marker}`);
}
requireCondition(!/(?:src|href)="\/(?:_next|assets)\//.test(html), "rendered chj page leaks root-level assets");
requireCondition(!html.includes("/ui-theme.js"), "rendered chj page unexpectedly contains the MiniSV shared theme");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ["_next", "assets", "favicon.svg", "vinext-client-entry-manifest.json", "_headers", ".assetsignore"]) {
  await cp(resolve(client, entry), resolve(output, entry), { recursive: true });
}
await writeFile(resolve(output, "index.html"), html, "utf8");

// A final read ensures the bytes on disk are exactly the worker response.
requireCondition(await readFile(resolve(output, "index.html"), "utf8") === html, "rendered HTML changed while staging");
console.log(`CHJ_COURSE_STATIC_READY ${output}`);
