import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const bundleRoot = path.join(root, "deploy/minisv/incubator-projects");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const sha256 = (body: Buffer | string) => createHash("sha256").update(body).digest("hex");

type FileRecord = { path: string; sha256: string; bytes: number };
type ProjectRecord = { id: string; title: string; route: string; runtime: string; persistence: string };

const manifest = JSON.parse(read("deploy/minisv/incubator-projects/SOURCE-MANIFEST.json")) as {
  schemaVersion: number;
  todoId: string;
  transforms: string[];
  files: FileRecord[];
  projects: ProjectRecord[];
  contentTreeSha256: string;
};

function diskFiles(directory: string, prefix = ""): string[] {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    const relative = path.posix.join(prefix, name);
    return statSync(absolute).isDirectory() ? diskFiles(absolute, relative) : [relative];
  });
}

test("T-124 publishes an incubator introduction and a direct two-project library", () => {
  const intro = read("deploy/minisv/site/incubator/index.html");
  const projects = read("deploy/minisv/site/incubator/projects/index.html");
  for (const html of [intro, projects]) {
    assert.match(html, /MINI硅谷/);
    assert.match(html, /href="\/incubator\/projects\/recitation\/"/);
    assert.match(html, /href="\/incubator\/projects\/mistake-notebook\/"/);
    assert.match(html, /mini-silicon-valley-logo-transparent\.png/);
  }
  assert.match(intro, /四类导师接力/);
  assert.match(projects, /浏览器内交互原型/);
  assert.match(projects, /刷新后恢复预设/);
});

test("T-124 exact runtime manifest admits every and only declared browser file", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.todoId, "T-124");
  assert.ok(manifest.transforms?.includes("hide-project-shell-on-project-pages"));
  assert.deepEqual(
    manifest.projects.map(({ id, route, runtime, persistence }) => ({ id, route, runtime, persistence })),
    [
      { id: "recitation", route: "/incubator/projects/recitation/", runtime: "browser-only-demo", persistence: "none" },
      { id: "mistake-notebook", route: "/incubator/projects/mistake-notebook/", runtime: "browser-only-demo", persistence: "none" },
    ],
  );

  const declared = manifest.files.map((item) => item.path).sort();
  const actual = diskFiles(bundleRoot).filter((item) => item !== "SOURCE-MANIFEST.json").sort();
  assert.deepEqual(actual, declared, "release source must not acquire undeclared QA/developer files");
  assert.equal(new Set(declared).size, declared.length);
  for (const item of manifest.files) {
    assert.equal(path.posix.normalize(item.path), item.path);
    assert.ok(!item.path.startsWith("/") && !item.path.split("/").includes(".."));
    assert.doesNotMatch(item.path, /(?:^|\/)(?:qa-artifacts|node_modules|patch_[^/]*|\.git)(?:\/|$)|\.(?:md|py|ts|map)$/i);
    const body = readFileSync(path.join(bundleRoot, item.path));
    assert.equal(body.byteLength, item.bytes, item.path);
    assert.equal(sha256(body), item.sha256, item.path);
  }
  const canonical = manifest.files.map((item) => `${item.path}\0${item.sha256}\n`).join("");
  assert.equal(sha256(canonical), manifest.contentTreeSha256);
});

test("T-124 projects are self-contained, branded, navigable and explicit about prototype scope", () => {
  const recitation = read("deploy/minisv/incubator-projects/recitation/index.html");
  const mistakes = read("deploy/minisv/incubator-projects/mistake-notebook/index.html");
  for (const html of [recitation, mistakes]) {
    assert.match(html, /class="msv-project-shell"/);
    assert.match(html, /href="\/incubator\/projects\/"/);
    assert.match(html, /mini-silicon-valley-logo-transparent\.png/);
    assert.match(html, /交互演示 · 刷新后重置/);
    assert.doesNotMatch(html, /unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/i);
    assert.doesNotMatch(html, /\b(?:localStorage|sessionStorage|indexedDB)\b|\bfetch\s*\(/);
  }
  const projectShell = read("deploy/minisv/incubator-projects/_shared/project-shell.css");
  assert.match(projectShell, /\.msv-project-shell\{display:none!important\}/);
  assert.match(recitation, /id="startPracticeBtn"[\s\S]*开始背诵/);
  assert.match(recitation, /SpeechRecognition|webkitSpeechRecognition/);
  assert.match(mistakes, /id="bankNewBtn"[\s\S]*录入错题/);
  assert.match(mistakes, /id="captureModal"/);

  const localAssets = [...recitation.matchAll(/["']assets\/([^"'?#]+)["'?#]/g)].map((match) => match[1]);
  assert.ok(localAssets.length >= 10);
  for (const asset of localAssets) {
    assert.ok(existsSync(path.join(bundleRoot, "recitation/assets", asset)), `missing recitation asset: ${asset}`);
  }
});
