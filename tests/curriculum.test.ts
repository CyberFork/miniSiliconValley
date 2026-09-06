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

test("curriculum UI: the historical world points to the single stable Course Package outline", async () => {
  const [world, outline, projection, css] = await Promise.all([
    readFile(new URL("../app/components/WorldApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/course/CourseOutlineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/course-outline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/course/course-outline.module.css", import.meta.url), "utf8"),
  ]);

  assert.ok(world.includes('<a href="/course/">课程大纲</a>'));
  assert.doesNotMatch(world, /view === "curriculum"|setView\("curriculum"\)/);

  for (const token of [
    "找真问题",
    "定真方案",
    "做真产品",
    "进真市场",
    "跑真运营",
  ]) {
    assert.ok(projection.includes(token), `Course Package 投影缺少统一课程契约：${token}`);
  }

  for (const token of [
    "六分钟 Demo Day",
    'href="/course/" aria-current="page"',
    'data-testid="course-map-stage"',
    "Course Package",
  ]) {
    assert.ok(outline.includes(token), `CourseOutlineApp 缺少统一课程契约：${token}`);
  }

  assert.match(css, /aspect-ratio:\s*1671\s*\/\s*941/);
  assert.match(css, /container-type:\s*inline-size/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
