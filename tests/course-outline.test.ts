import assert from "node:assert/strict";
import test from "node:test";
import { getReleasedCourseOutline } from "../app/lib/course-outline";

const expectedNames = ["找真问题", "定真方案", "做真产品", "进真市场", "跑真运营"];
const expectedDigests: Record<string, string> = {
  "eleme-2008-find-problem": "407a24b43ead68ddccf0871fe7910ae21f1ca64ec4b7232a2bc0afeb2cfecb6c",
  "google-1995-2004": "59e0ef603d97d72578913ec1ab20d055210190137bfb8f437a417e0102ed77cd",
};

test("course outline is a read-only projection of both released Course Packages", async () => {
  const courses = await getReleasedCourseOutline();
  assert.deepEqual(courses.map(({ id }) => id), ["eleme-2008-find-problem", "google-1995-2004"]);

  for (const course of courses) {
    assert.equal(course.lifecycle, "Released");
    assert.equal(course.revision, 0);
    assert.equal(course.digest, expectedDigests[course.id]);
    assert.deepEqual(course.steps.map(({ name }) => name), expectedNames);
    assert.equal(course.steps.flatMap(({ blocks }) => blocks).length, 13);
    assert.equal(course.deckCount, 5);
    assert.equal(course.formula.fourMentors.length, 4);
    assert.deepEqual(course.formula.fourMentors.map(({ name }) => name), ["产品导师", "开发导师", "市场导师", "运营导师"]);
    assert.equal(course.steps.at(-1)?.blocks.at(-1)?.id, "B13");
    assert.match(course.steps.at(-1)?.blocks.at(-1)?.title ?? "", /六分钟 Demo Day/);
    assert.ok(course.steps.every((step) => step.blocks.every((block) => block.studentPrompt && block.learnerLens.done)));
  }
});

test("course outline keeps PDMO on mentors and keeps learners unassigned", async () => {
  const courses = await getReleasedCourseOutline();
  for (const course of courses) {
    assert.equal(course.formula.fourMentors.map(({ code }) => code).join(""), "PDMO");
    const learnerCopy = course.steps
      .flatMap(({ blocks }) => blocks)
      .map(({ studentPrompt, learnerLens }) => `${studentPrompt} ${Object.values(learnerLens).join(" ")}`)
      .join(" ");
    assert.doesNotMatch(learnerCopy, /你是[\s\S]{0,8}(?:P|D|M|O)\s*(?:角色|学员)/);
  }
});
