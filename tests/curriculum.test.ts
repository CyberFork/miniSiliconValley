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

test("curriculum UI: the historical world points to the independent course site", async () => {
  const world = await readFile(new URL("../app/components/WorldApp.tsx", import.meta.url), "utf8");

  assert.ok(world.includes('<a href="/course/">课程大纲</a>'));
  assert.doesNotMatch(world, /view === "curriculum"|setView\("curriculum"\)/);
});
