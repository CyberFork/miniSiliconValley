import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("runtime treats unlock frontier and each browser cursor as separate systems", () => {
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  const store = source("app/lib/classroom-platform-store.ts");
  for (const marker of [
    "unlockedThroughBlockId",
    "unlockedThroughIndex",
    "scriptNavigation",
    "window.history.replaceState",
    "其他人的屏幕不会被强制跳转",
    "提交、手牌、RP、钱包与团队资金都不会变化",
  ]) assert.match(runtime + store, new RegExp(marker));
  assert.match(runtime, /回到最新解锁 · \{data\.scriptNavigation\.latestUnlocked\.id\}/);
  assert.match(runtime, /event\.key === "End"[\s\S]*latestUnlocked\.id/);
  assert.match(runtime, /window\.history\[history === "replace" \? "replaceState" : "pushState"\]/);
  assert.match(runtime, /window\.addEventListener\("popstate"/);
  assert.match(store, /blocks: course\.blocks\.map/);
  assert.doesNotMatch(runtime, /submit-for-acceptance|controllerTransition|STATE_LABEL/);
  assert.doesNotMatch(store, /function applyControllerAction|controllerTransition\(/);
});

test("T-093 Classroom progress segments invoke only existing personal navigation", () => {
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  const css = source("app/classroom/platform.module.css");
  assert.match(runtime, /function Progress\(\{ data, onNavigate, onLocked \}/);
  assert.match(runtime, /data\.scriptNavigation\.blocks\.map/);
  assert.match(runtime, /className=\{styles\.progressSegment\}/);
  assert.match(runtime, /data-state=\{state\}/);
  assert.match(runtime, /aria-current=\{current \? "step"/);
  assert.match(runtime, /aria-disabled=\{!unlocked/);
  assert.match(runtime, /if \(unlocked\) onNavigate\(block\.id\); else onLocked\(block\.id\)/);
  assert.match(runtime, /event\.stopPropagation\(\)/);
  assert.match(runtime, /你正在查看 \$\{blockId\}；课堂解锁边界没有变化/);
  assert.match(runtime, /\$\{blockId\} 尚未解锁/);
  assert.match(css, /\.progressSegment\{[^}]*height:44px/);
  assert.match(css, /\.progressSegment\[data-state=unlocked\]/);
  assert.match(css, /\.progressSegment\[data-state=current\]/);
  assert.match(css, /\.progressSegment\[aria-disabled=true\]:focus-visible/);
  const progressBody = runtime.slice(runtime.indexOf("function Progress"), runtime.indexOf("function ControlView"));
  assert.doesNotMatch(progressBody, /mutate\(|fetch\(|submit|reset|unlock-next/);
});

test("keyboard navigation never steals arrows from editable controls", () => {
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  const studio = source("app/studio/StudioApp.tsx");
  for (const marker of ["input", "textarea", "select", "contenteditable", "role='textbox'"]) {
    assert.match(runtime, new RegExp(marker));
    assert.match(studio, new RegExp(marker));
  }
  assert.match(runtime, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/);
  assert.match(studio, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/);
});

test("Test role tabs are exhaustive while Production rejects the viewAs contract", () => {
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  const detailRoute = source("app/api/platform/classrooms/[classroomId]/route.ts");
  const store = source("app/lib/classroom-platform-store.ts");
  assert.match(runtime, /data\.environment === "test"[\s\S]*<TestRoleTabs/);
  for (const label of ["中控", "投屏"]) assert.match(runtime, new RegExp(`>${label}<`));
  assert.match(runtime, /data\.mentors\.map/);
  assert.match(runtime, /data\.learners\.map/);
  assert.match(detailRoute, /viewAs/);
  assert.match(detailRoute, /surface/);
  assert.match(store, /TEST_VIEW_PRODUCTION_FORBIDDEN/);
  assert.match(store, /TEST_VIEW_MEMBERSHIP_REQUIRED/);
});

test("T-094 exposes one exact runtime identity and preserves projector card order", () => {
  const runtime = source("app/classroom/ClassroomRuntime.tsx");
  const store = source("app/lib/classroom-platform-store.ts");
  for (const marker of [
    "courseDataId", "classroomId", "runId", "dealSeed", "deckId",
    "scriptStateVersion", "controllerStateVersion", "resetGeneration",
    "candidateComparison", "cardAssignmentId",
  ]) assert.match(runtime + store, new RegExp(marker));
  assert.match(store, /privateAssignments = myView\.privateCards\.map/);
  assert.match(store, /classroomDealSeed\(roomId, runtimeRow\.reset_generation\)/);
  assert.match(store, /classroomRunId\(roomId, runtimeRow\.reset_generation\)/);
  assert.match(runtime, /课堂锁定旧版本/);
  assert.match(runtime, /复制本视角诊断与 payload/);
});

test("the Classroom Center uses native browser link semantics", () => {
  const hub = source("app/classroom/ClassroomHub.tsx");
  assert.match(hub, /<a href=\{`\/classroom\/\$\{encodeURIComponent\(room\.id\)\}\/`\}>\{archived \? "打开只读档案 →" : "进入我的课堂 →"\}<\/a>/);
  assert.doesNotMatch(hub, /onClick=.*进入我的课堂/);
});

test("Stage 1 exposes complete private fields by hover or an explicit pinned expansion", () => {
  const studio = source("app/studio/StudioApp.tsx");
  const css = source("app/studio/studio.module.css");
  for (const marker of ["privateScript", "view.prompt", "card.body", "card.sharePrompt", "card.sourceIds", "card.boundary"]) {
    assert.match(studio, new RegExp(marker.replace(".", "\\.")));
  }
  assert.match(studio, /固定展开/);
  assert.match(studio, /ArrowLeft/);
  assert.match(studio, /ArrowRight/);
  assert.match(studio, /Home/);
  assert.match(studio, /End/);
  assert.match(css, /\.viewCard:hover \.viewDetails/);
  assert.match(css, /\.viewCard\[data-pinned=true\] \.viewDetails/);
});
