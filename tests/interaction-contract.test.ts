import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clampMapScale,
  clampYear,
  MAP_LAYERS,
  mapLayerLabel,
  mapLayerOpacity,
  YEAR_MAX,
  YEAR_MIN,
} from "../app/lib/world";

async function source(relative: string) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("timeline control clamps every input to the supported historical range", () => {
  assert.equal(YEAR_MIN, 1891);
  assert.equal(YEAR_MAX, 2026);
  assert.equal(clampYear(1800), YEAR_MIN);
  assert.equal(clampYear(1968.6), 1969);
  assert.equal(clampYear(3000), YEAR_MAX);
});

test("map construction layers crossfade continuously and never exceed full opacity", () => {
  assert.deepEqual(MAP_LAYERS.map(({ year }) => year), [1939, 1968, 1998, 2026]);
  for (const year of [1891, 1939, 1950, 1968, 1984, 1998, 2012, 2026]) {
    const opacities = MAP_LAYERS.map((_, index) => mapLayerOpacity(index, year));
    assert.ok(opacities.every((value) => value >= 0 && value <= 1), `${year} 的图层透明度越界`);
    assert.ok(Math.abs(opacities.reduce((sum, value) => sum + value, 0) - 1) < 1e-9, `${year} 的图层总透明度应为 1`);
    assert.ok(opacities.filter((value) => value > 0).length <= 2, `${year} 最多只能混合相邻两层`);
  }
  assert.deepEqual(MAP_LAYERS.map((_, index) => mapLayerOpacity(index, 1998)), [0, 0, 1, 0]);
});

test("map labels and zoom obey the actual four-stage world model", () => {
  assert.match(mapLayerLabel(1939), /果园与车库/);
  assert.match(mapLayerLabel(1968), /芯片山谷/);
  assert.match(mapLayerLabel(1998), /互联网起飞/);
  assert.match(mapLayerLabel(2026), /AI 与机器人/);
  assert.equal(clampMapScale(0.2), 1);
  assert.equal(clampMapScale(1.237), 1.24);
  assert.equal(clampMapScale(8), 2.4);
});

test("responsive CSS contracts cover desktop, tablet, phone, modal containment and reduced motion", async () => {
  const css = await source("../app/globals.css");
  for (const breakpoint of [1180, 900, 720, 520]) {
    assert.match(css, new RegExp(`@media \\(max-width: ${breakpoint}px\\)`));
  }
  assert.match(css, /width:\s*min\(1180px,\s*calc\(100vw - 32px\)\)/);
  assert.match(css, /width:\s*calc\(100vw - 14px\)/);
  assert.match(css, /max-height:\s*calc\(100svh - 14px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
});

test("world UI contract retains timeline, keyboard, search, map pointer/pinch/wheel and archive controls", async () => {
  const world = await source("../app/components/WorldApp.tsx");
  for (const token of [
    'event.key === "ArrowLeft"',
    'event.key === "PageUp"',
    'event.code === "Space"',
    'type="range"',
    'onPointerDown={onMapPointerDown}',
    'onPointerMove={onMapPointerMove}',
    'onWheel={onMapWheel}',
    "pointersRef.current",
    "pinchRef.current",
    'id="world-search"',
    "createCheckpoint",
    "restoreCheckpoint",
    "exportState",
    "importState",
    "missionReturnRef",
  ]) {
    assert.ok(world.includes(token), `WorldApp 缺少交互契约：${token}`);
  }

  const openEventHandler = world.slice(
    world.indexOf("function openEvent"),
    world.indexOf("function launchMission"),
  );
  assert.match(openEventHandler, /setPlaying\(false\)/, "打开地图节点时应暂停时间轴播放");
  assert.match(openEventHandler, /recordEventVisit\(current, event\.id\)/, "打开地图节点应只登记访问记录");
  assert.doesNotMatch(openEventHandler, /currentYear/, "打开地图节点不得改写当前时间轴年份");
  assert.doesNotMatch(world, /result\.evidenceIds\.join/, "学习档案不得暴露内部证据 ID");
  assert.match(world, /<a href="\/course\/">课程大纲<\/a>/, "历史世界必须用稳定链接进入课程大纲");
  assert.doesNotMatch(world, /view === "curriculum"|setView\("curriculum"\)|import \{ CurriculumOutline \}/, "不得保留第二套内存课程入口");
});

test("modal contract traps focus, closes safely and exposes dialog semantics", async () => {
  const modal = await source("../app/components/Modal.tsx");
  for (const token of [
    'event.key === "Escape"',
    'event.key !== "Tab"',
    "previous?.focus()",
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby="modal-title"',
    "event.target === event.currentTarget",
  ]) {
    assert.ok(modal.includes(token), `Modal 缺少无障碍契约：${token}`);
  }
});

test("mission UI contract preserves the complete six-stage learning loop and evidence seal", async () => {
  const mission = await source("../app/components/MissionPlayer.tsx");
  for (const token of [
    'loop: "学习"',
    'loop: "练习"',
    'loop: "实操"',
    'loop: "反馈"',
    'loop: "反思"',
    'loop: "再实践"',
    "史料来源已封存",
    "至少收入 2 条证据",
    "只有收入的卡片才会成为本轮判断依据",
    "现在做什么",
    "本次补证目标",
    "去补读",
    "规则化模拟，不是史实",
    "HISTORICAL COMPARISON",
    "CURRENT MISSION",
    "冻结本关世界线",
  ]) {
    assert.ok(mission.includes(token), `MissionPlayer 缺少学习闭环契约：${token}`);
  }
  assert.doesNotMatch(mission, /missing\.join/, "决策界面不得暴露内部证据 ID");
});
