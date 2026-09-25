#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const outputRoot = resolve(dist, "work");
const output = resolve(outputRoot, "msv");
const target = "https://work.cyberforker.com/msv/demo.html";

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

const workerUrl = `${pathToFileURL(resolve(dist, "server", "index.js")).href}?work-static=${Date.now()}`;
const { default: worker } = await import(workerUrl);
const response = await worker.fetch(
  new Request("https://work.cyberforker.com/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
requireCondition(response.status === 200, `server render failed with ${response.status}`);
const html = await response.text();

requireCondition(html.includes("/msv/_next/"), "rendered HTML is missing the /msv/_next/ build base");
requireCondition(html.includes("/msv/assets/map-1939.webp"), "rendered HTML is missing prefixed map assets");
requireCondition(html.includes(target), "rendered HTML is missing the work.cyberforker.com canonical URL");
requireCondition(!/(?:src|href)="\/(?:_next|assets)\//.test(html), "rendered HTML leaks a root-level build or map asset URL");

await writeFile(resolve(output, "demo.html"), html, "utf8");
await cp(resolve(client, "_next"), resolve(output, "_next"), { recursive: true });
await cp(resolve(client, "assets"), resolve(output, "assets"), { recursive: true });
await cp(resolve(client, "favicon.svg"), resolve(output, "favicon.svg"));
await cp(resolve(root, "deploy", "minisv", "site", "site.webmanifest"), resolve(output, "site.webmanifest"));
await cp(resolve(client, "og.png"), resolve(output, "og.png"));

const files = await collectFiles(output);
const manifest = {
  schemaVersion: 1,
  target,
  publicBase: "/msv/",
  files: await Promise.all(files.map(async (path) => ({
    path: relative(output, path).split("\\").join("/"),
    bytes: (await stat(path)).size,
    sha256: await sha256(path),
  }))),
};
await writeFile(resolve(output, "demo-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`work static build: ${manifest.files.length} files -> ${target}`);
