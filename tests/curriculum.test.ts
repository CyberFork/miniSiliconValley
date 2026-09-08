import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { curriculumCatalog, PROJECT_STAGE_IDS } from "../app/data/curriculum";
import { historyCatalog } from "../app/data/history";
import { missions } from "../app/data/missions";
import { validateCurriculum } from "../app/lib/validate";

test("curriculum: five 0→1 stages plus a six-minute finale are complete", () => {
  const report = validateCurriculum(historyCatalog, missions, curriculumCatalog);

  assert.equal(report.errors.length, 0, `curriculum errors: ${report.errors.join("; ")}`);
  assert.equal(report.warnings.length, 0, `curriculum warnings: ${report.warnings.join("; ")}`);
  assert.deepEqual(report.counts, {
    curriculumStage: 5,
    curriculumExample: 17,
    companyJourney: 1,
    companyJourneyStep: 5,
    curriculumFinale: 1,
  });
  assert.deepEqual(curriculumCatalog.stages.map(({ id }) => id), PROJECT_STAGE_IDS);
  assert.deepEqual(curriculumCatalog.stages.map(({ title }) => title), [
    "找真问题",
    "定真方案",
    "做真产品",
    "进真市场",
    "跑真运营",
  ]);
  assert.equal(curriculumCatalog.finale.id, "demo-day");
  assert.equal(curriculumCatalog.finale.durationSeconds, 360);
  for (const journey of curriculumCatalog.companyJourneys) {
    assert.deepEqual(journey.steps.map(({ stageId }) => stageId), PROJECT_STAGE_IDS);
  }
});

test("curriculum UI: the historical world points to the independent course site", async () => {
  const world = await readFile(new URL("../app/components/WorldApp.tsx", import.meta.url), "utf8");

  assert.ok(world.includes('<a href={publicPath("/course/")}>导师课件</a>'));
  assert.doesNotMatch(world, /view === "curriculum"|setView\("curriculum"\)/);
});
