#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist", "parent-qa");
const serverOutput = resolve(output, "server.mjs");

await mkdir(output, { recursive: true });
await build({
  entryPoints: [resolve(root, "services", "parent-qa", "server.ts")],
  outfile: serverOutput,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});

const server = await readFile(serverOutput);
const manifest = {
  schemaVersion: 1,
  service: "msv-parent-qa",
  entrypoint: "server.mjs",
  bytes: server.byteLength,
  sha256: createHash("sha256").update(server).digest("hex"),
};
await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`parent Q&A service build: ${manifest.bytes} bytes sha256=${manifest.sha256}`);
