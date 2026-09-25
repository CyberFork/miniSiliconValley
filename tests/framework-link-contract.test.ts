import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("..", import.meta.url);
const SCAN_DIRS = ["app", "tools/live-run/static"];
const ALLOWED = new Set(["app/123456/page.tsx"]);

async function files(path: string): Promise<string[]> {
  const absolute = new URL(`${path}/`, ROOT);
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? files(child) : [child];
  }));
  return nested.flat();
}

test("current UI emits /framework/ and never links users to retired /123456 routes", async () => {
  const candidates = (await Promise.all(SCAN_DIRS.map(files))).flat()
    .filter((path) => [".ts", ".tsx", ".js", ".html", ".md"].includes(extname(path)));
  const violations: string[] = [];
  let frameworkLinks = 0;
  for (const path of candidates) {
    if (ALLOWED.has(path)) continue;
    const source = await readFile(new URL(path, ROOT), "utf8");
    if (/href\s*=\s*[{"'](?:\/msv)?\/123456(?:\.html|\/)?/u.test(source)) violations.push(relative(".", path));
    frameworkLinks += (source.match(/href\s*=\s*[{"']\/framework\//gu) ?? []).length;
  }
  assert.deepEqual(violations, []);
  assert.ok(frameworkLinks >= 4, "primary surfaces must link directly to /framework/");
});

test("application compatibility route redirects directly to the canonical framework URL", async () => {
  const source = await readFile(new URL("app/123456/page.tsx", ROOT), "utf8");
  assert.match(source, /redirect\(new URL\("\/framework\/"/);
  assert.doesNotMatch(source, /\/framework"/);
});
