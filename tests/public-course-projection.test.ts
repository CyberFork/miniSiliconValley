import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { historyCatalog } from "../app/data/history";
import { bundledCoursePackages, type CoursePackageRef } from "../app/lib/course-package";
import { projectReleasedCourseSummary } from "../app/lib/public-course-projection";

function exact(status: CoursePackageRef["status"]): CoursePackageRef {
  return {
    courseId: bundledCoursePackages()[0].course.id,
    schemaVersion: 1,
    revision: 7,
    digest: "d".repeat(64),
    status,
  };
}

test("public summary accepts only a Released exact version and is an explicit allow-list", () => {
  const course = structuredClone(bundledCoursePackages()[0]);
  course.blocks[0].mentorScript[0] = "PRIVATE-MENTOR-SCRIPT-T103";
  course.decks[0].cards[0].body = "PRIVATE-CARD-T103";
  course.sources[0].url = "https://private.invalid/T103";
  course.rules.internalMarker = "PRIVATE-RULE-T103";

  assert.throws(() => projectReleasedCourseSummary(course, exact("candidate")), /只能从 Released exact 版本/);
  const summary = projectReleasedCourseSummary(course, exact("released"));
  const json = JSON.stringify(summary);
  assert.deepEqual(Object.keys(summary), [
    "courseDataId", "courseId", "revision", "name", "period", "description", "learnerName",
    "learnerRange", "fiveSteps", "gameModes", "finale",
  ]);
  assert.equal(summary.fiveSteps.length, 5);
  assert.equal(summary.finale.durationSeconds, 360);
  assert.doesNotMatch(json, /PRIVATE-|mentorScript|privateCards|decks|reviewQueue|contentPackages|sources|fieldModel/);
});

test("public projection has no mutation path into CourseDefinition or the historical world", () => {
  const course = structuredClone(bundledCoursePackages()[0]);
  const courseBefore = JSON.stringify(course);
  const historyBefore = JSON.stringify(historyCatalog);
  const summary = projectReleasedCourseSummary(course, exact("released"));
  summary.fiveSteps[0].name = "只改公开 DTO";
  summary.gameModes[0].purpose = "只改公开 DTO";
  assert.equal(JSON.stringify(course), courseBefore);
  assert.equal(JSON.stringify(historyCatalog), historyBefore);
});

test("anonymous catalog route reads only released public summaries", () => {
  const route = new URL("../app/api/public/courses/route.ts", import.meta.url);
  const source = readFileSync(route, "utf8");
  assert.match(source, /listPublicReleasedCourseSummaries/);
  assert.doesNotMatch(source, /listStudioCourseVersions|package_json|contentPackages|privateCards/);
  assert.match(source, /Cache-Control.*public/);
});
