#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const outputRoot = resolve(dist, "work-qa");
const output = resolve(outputRoot, "msv");
const canonical = "https://work.cyberforker.com/msv/qa.html";

// Server-component metadata reads process.env when the built Worker module is
// imported.  Keep this legacy artifact deterministic even when it is rendered
// from a shell that no longer carries the one-shot build environment.
process.env.MSV_SITE_ORIGIN = "https://work.cyberforker.com";
process.env.MSV_QA_CANONICAL_URL = canonical;

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const workerUrl = `${pathToFileURL(resolve(dist, "server", "index.js")).href}?work-qa-static=${Date.now()}`;
const { default: worker } = await import(workerUrl);
const response = await worker.fetch(
  new Request("https://work.cyberforker.com/qa/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
requireCondition(response.status === 200, `/qa server render failed with ${response.status}`);
const html = await response.text();
requireCondition(html.includes("/msv/_next/"), "qa.html is missing the /msv/_next/ build base");
requireCondition(html.includes(canonical), "qa.html is missing its canonical URL");
requireCondition(html.includes("Mini Silicon Valley 家长问答"), "qa.html is missing the parent Q&A title");
requireCondition(html.includes("请勿输入孩子的真实姓名"), "qa.html is missing the privacy notice");
requireCondition(!/(?:src|href)="\/(?:_next|assets)\//.test(html), "qa.html leaks a root-level build asset URL");

await writeFile(resolve(output, "qa.html"), html, "utf8");
await cp(resolve(client, "_next"), resolve(output, "_next"), { recursive: true });

const files = await collectFiles(output);
const manifest = {
  schemaVersion: 1,
  target: canonical,
  publicBase: "/msv/",
  files: await Promise.all(files.map(async (path) => ({
    path: relative(output, path).split("\\").join("/"),
    bytes: (await stat(path)).size,
    sha256: await sha256(path),
  }))),
};
await writeFile(resolve(output, "qa-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`work Q&A static build: ${manifest.files.length} files -> ${canonical}`);
