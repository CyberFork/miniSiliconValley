#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { historyCatalog } from "../app/data/history";
import { MAP_LAYERS, YEAR_MAX, YEAR_MIN } from "../app/lib/world";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const output = resolve(dist, "minisv-static");
process.env.MSV_SITE_ORIGIN = "https://minisv.vip";
process.env.MSV_QA_CANONICAL_URL = "https://minisv.vip/parents/";

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
await mkdir(resolve(output, "parents"), { recursive: true });

const workerUrl = `${pathToFileURL(resolve(dist, "server", "index.js")).href}?minisv-static=${Date.now()}`;
const { default: worker } = await import(workerUrl) as { default: StaticWorker };

const worldHtml = await render(worker, "/world/");
const parentsHtml = await render(worker, "/qa/");

const previewEventIds = [
  "evt-1939-hp-founded",
  "evt-1957-fairchild-founded",
  "evt-1969-arpanet-message",
  "evt-1975-homebrew-first-meeting",
  "evt-1998-google-founded",
  "evt-2007-iphone-announced",
  "evt-2022-chatgpt",
] as const;
const eventById = new Map(historyCatalog.events.map((event) => [event.id, event]));
const placeById = new Map(historyCatalog.places.map((place) => [place.id, place]));
const previewEvents = previewEventIds.map((id) => {
  const event = eventById.get(id);
  requireCondition(event, `homepage world preview event is missing from historyCatalog: ${id}`);
  const place = placeById.get(event.placeId);
  requireCondition(place, `homepage world preview place is missing from historyCatalog: ${event.placeId}`);
  return {
    id: event.id,
    year: event.year,
    title: event.title,
    significance: event.significance,
    category: event.category,
    place: place.name,
    map: event.map,
    sourceCount: event.sourceIds.length,
  };
});
const worldPreview = {
  schemaVersion: 1,
  source: "historyCatalog",
  yearRange: { min: YEAR_MIN, max: YEAR_MAX },
  layers: MAP_LAYERS.map((layer) => ({ ...layer })),
  events: previewEvents,
};
const worldPreviewJson = `${JSON.stringify(worldPreview, null, 2)}\n`;

requireCondition(worldHtml.includes('href="/course/"'), "world topbar is missing the stable /course/ route");
requireCondition(!worldHtml.includes('type="button">课程大纲</button>'), "world still exposes the retired in-memory course view");
requireCondition(parentsHtml.includes('class="msv-brand-home '), "parents page is missing the shared brand/home component");
requireCondition(parentsHtml.includes('href="/"'), "parents page is missing the root home link");
requireCondition(parentsHtml.includes('https://minisv.vip/parents/'), "parents page is missing its native canonical URL");
requireCondition(!parentsHtml.includes("work.cyberforker.com"), "parents page contains the retired Work origin");

const files = [
  [resolve(output, "world", "index.html"), worldHtml],
  [resolve(output, "parents", "index.html"), parentsHtml],
  [resolve(output, "world-preview.json"), worldPreviewJson],
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
