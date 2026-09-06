#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const output = resolve(dist, "minisv-static");
process.env.MSV_SITE_ORIGIN = "https://minisv.vip";

type StaticWorker = {
  fetch(
    request: Request,
    env: { ASSETS: { fetch(request: Request): Promise<Response> } },
    context: { waitUntil(promise?: Promise<unknown>): void; passThroughOnException(): void },
  ): Promise<Response>;
};

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function render(worker: StaticWorker, pathname: string) {
  const response = await worker.fetch(
    new Request(`https://minisv.vip${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  requireCondition(response.status === 200, `${pathname} server render failed with ${response.status}`);
  return response.text();
}

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "world"), { recursive: true });
await mkdir(resolve(output, "course"), { recursive: true });

const workerUrl = `${pathToFileURL(resolve(dist, "server", "index.js")).href}?minisv-static=${Date.now()}`;
const { default: worker } = await import(workerUrl) as { default: StaticWorker };

const [worldHtml, courseHtml] = await Promise.all([
  render(worker, "/"),
  render(worker, "/course/"),
]);

requireCondition(worldHtml.includes('href="/course/"'), "world topbar is missing the stable /course/ route");
requireCondition(!worldHtml.includes('type="button">课程大纲</button>'), "world still exposes the retired in-memory course view");
requireCondition(courseHtml.includes('<link rel="canonical" href="https://minisv.vip/course/"'), "course canonical URL is missing");
requireCondition(courseHtml.includes("course-outline-world-map.webp"), "course map asset is missing");
requireCondition((courseHtml.match(/data-step-id=/g) ?? []).length === 5, "course map must render exactly five step nodes");
requireCondition(courseHtml.includes('data-course-steps="5"') && courseHtml.includes('data-course-blocks="13"') && courseHtml.includes('data-course-decks="5"'), "course package diagnostics are incomplete");
requireCondition(courseHtml.includes("找真问题") && courseHtml.includes("跑真运营") && courseHtml.includes("六分钟 Demo Day"), "course truth is incomplete");

const files = [
  [resolve(output, "world", "index.html"), worldHtml],
  [resolve(output, "course", "index.html"), courseHtml],
] as const;

for (const [path, content] of files) await writeFile(path, content, "utf8");

const manifest = {
  schemaVersion: 1,
  canonicalOrigin: "https://minisv.vip",
  routes: await Promise.all(files.map(async ([path]) => ({
    path: relative(output, path).split("\\").join("/"),
    bytes: (await stat(path)).size,
    sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
  }))),
};
await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`MiniSV static routes: ${manifest.routes.length} -> ${output}`);
