import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSROOM_RUNTIME_CONTRACT_VERSION,
  COURSE_PROJECTOR_CONTRACT_VERSION,
  UI_ACCEPTANCE_CHECKLIST,
  renderUiAcceptanceChecklistMarkdown,
} from "../app/lib/course-acceptance-contract";
import { MSV_BUILD_IDENTITY } from "../app/lib/build-identity";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFile(resolve(root, path), "utf8");

function markedBlock(document: string): string {
  const match = document.match(/<!-- ui-acceptance-checklist:start -->\s*([\s\S]*?)\s*<!-- ui-acceptance-checklist:end -->/);
  assert.ok(match, "文档必须包含 ui-acceptance-checklist 标记区块");
  return match[1].trim();
}

test("UI acceptance checklist is a stable, canonical sixteen-item contract", () => {
  assert.equal(UI_ACCEPTANCE_CHECKLIST.length, 16);
  const ids: string[] = UI_ACCEPTANCE_CHECKLIST.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("explicitClassroomFinish"));
  assert.ok(!ids.includes("fiveStepCompletion"));
});

test("acceptance checklist documentation matches the canonical renderer", async () => {
  const expected = renderUiAcceptanceChecklistMarkdown();
  for (const path of ["docs/TESTING.md", "docs/COURSE_PLATFORM_SOP.md"]) {
    assert.equal(markedBlock(await source(path)), expected, `${path} checklist drifted`);
  }
});

test("ClassroomRuntime consumes the shared checklist contract", async () => {
  const runtime = await source("app/classroom/ClassroomRuntime.tsx");
  assert.match(runtime, /from ["']\.\.\/lib\/course-acceptance-contract["']/);
  assert.doesNotMatch(runtime, /(?:const|let|var)\s+UI_ACCEPTANCE_CHECKLIST\s*=/);
});

test("build identity and projector/runtime contracts are present", async () => {
  assert.ok(COURSE_PROJECTOR_CONTRACT_VERSION.trim());
  assert.ok(CLASSROOM_RUNTIME_CONTRACT_VERSION.trim());
  assert.ok(MSV_BUILD_IDENTITY.sourceCommit.trim());
  assert.ok(MSV_BUILD_IDENTITY.appBuildId.trim());
  const docs = `${await source("docs/TESTING.md")}\n${await source("docs/COURSE_PLATFORM_SOP.md")}`;
  assert.match(docs, /projector/i);
  assert.match(docs, /runtime/i);
  assert.match(docs, /source commit|构建|build/i);
});
