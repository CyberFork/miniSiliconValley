#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const entry = resolve(root, "app", "lib", "course-projection-core.ts");
const output = resolve(root, "public", "studio", "editor-assets", "course-projection-core.js");
const checking = process.argv.includes("--check");

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  globalName: "MsvCourseProjectionCore",
  target: ["es2017"],
  sourcemap: false,
  minify: false,
  legalComments: "none",
  banner: {
    js: "/* eslint-disable */\n/* GENERATED from app/lib/course-projection-core.ts. Run npm run generate:course-projector; do not edit. */",
  },
  footer: {
    js: "globalThis.MsvCourseProjectionCore = Object.freeze(MsvCourseProjectionCore);",
  },
  logLevel: "silent",
});

const generated = result.outputFiles?.[0]?.text;
if (!generated) throw new Error("course projector generation produced no JavaScript output");

if (checking) {
  const current = await readFile(output, "utf8").catch(() => "");
  if (current !== generated) {
    console.error("Generated course projector is stale. Run: npm run generate:course-projector");
    process.exitCode = 1;
  } else {
    console.log("Generated course projector is current.");
  }
} else {
  await writeFile(output, generated, "utf8");
  console.log(`Generated ${output.slice(root.length + 1)} (${Buffer.byteLength(generated)} bytes).`);
}
