import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { curriculumCatalog, PROJECT_STAGE_IDS } from "../app/data/curriculum";
import { historyCatalog } from "../app/data/history";
import { missions } from "../app/data/missions";
import { validateCurriculum } from "../app/lib/validate";

test("curriculum: six 0→1 stages and every company journey are complete", () => {
  const report = validateCurriculum(historyCatalog, missions, curriculumCatalog);

  assert.equal(report.errors.length, 0, `curriculum errors: ${report.errors.join("; ")}`);
  assert.equal(report.warnings.length, 0, `curriculum warnings: ${report.warnings.join("; ")}`);
  assert.deepEqual(report.counts, {
    curriculumStage: 6,
    curriculumExample: 18,
    companyJourney: 1,
    companyJourneyStep: 6,
  });
  assert.deepEqual(curriculumCatalog.stages.map(({ id }) => id), PROJECT_STAGE_IDS);
  assert.deepEqual(curriculumCatalog.stages.map(({ title }) => title), [
    "找问题",
    "识别真问题",
    "想解决方案",
    "MVP 原型 + VC",
    "运营 + 品牌",
    "Demo Day",
  ]);
  for (const journey of curriculumCatalog.companyJourneys) {
    assert.deepEqual(journey.steps.map(({ stageId }) => stageId), PROJECT_STAGE_IDS);
  }
});

test("curriculum UI: top entry, dual-axis navigation and source actions remain explicit", async () => {
  const [world, outline, css] = await Promise.all([
    readFile(new URL("../app/components/WorldApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CurriculumOutline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const token of [
    '["curriculum", "课程大纲"]',
    'view === "curriculum"',
    "onOpenEvent={openCurriculumEvent}",
  ]) {
    assert.ok(world.includes(token), `WorldApp 缺少课程入口契约：${token}`);
  }

  for (const token of [
    "纵向六步",
    "企业全流程",
    "按阶段纵切",
    "按项目横看",
    "查看原始史实",
    "进入历史战役",
    "内容归集协议",
    'role="tablist"',
    'aria-selected={axis === "stages"}',
  ]) {
    assert.ok(outline.includes(token), `CurriculumOutline 缺少交互契约：${token}`);
  }

  assert.match(css, /\.curriculum-stage-layout\s*\{/);
  assert.match(css, /\.company-journey-track\s*\{/);
  assert.match(css, /overflow-x:\s*auto/);
});
