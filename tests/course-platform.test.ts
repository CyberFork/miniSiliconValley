import assert from "node:assert/strict";
import test from "node:test";

import { bundledCoursePackages, validateCoursePackage, type CoursePackage } from "../app/lib/course-package";
import {
  assertCourseCanInstantiate,
  buildStudioProjection,
  resolveLearnerPolicy,
  validateCourseInstantiation,
} from "../app/lib/course-platform";

function courseSupportingSix(): CoursePackage {
  const course = structuredClone(bundledCoursePackages()[0]);
  course.learnerPolicy = {
    defaultCount: 4,
    minCount: 2,
    maxCount: 6,
    cardsPerLearner: 3,
    dealPolicy: "unique-within-step",
  };
  for (const [deckIndex, deck] of course.decks.entries()) {
    while (deck.cards.length < 18) {
      const source = deck.cards[deck.cards.length % 12];
      deck.cards.push({
        ...structuredClone(source),
        id: `${course.course.id}:test:${deckIndex}:${deck.cards.length + 1}`,
      });
    }
  }
  return course;
}

test("legacy course definitions receive a bounded learner policy without mutating their exact JSON", () => {
  const course = bundledCoursePackages()[0];
  assert.equal(course.learnerPolicy, undefined);
  assert.deepEqual(resolveLearnerPolicy(course), {
    defaultCount: 4,
    minCount: 2,
    maxCount: 4,
    cardsPerLearner: 3,
    dealPolicy: "unique-within-step",
  });
  assert.equal(course.learnerPolicy, undefined);
});

test("one projector renders 4 mentors + N learners + one controller for N=2,4,6", () => {
  const course = courseSupportingSix();
  for (const learnerCount of [2, 4, 6]) {
    const projection = buildStudioProjection(course, {
      learnerCount,
      blockId: "B01",
      seed: "deterministic-classroom-seed",
    });
    assert.equal(projection.mentorViews.length, 4);
    assert.equal(projection.learnerViews.length, learnerCount);
    assert.equal(projection.views.length, 4 + learnerCount + 1);
    assert.equal(projection.controllerView.kind, "controller");
    assert.equal(projection.mentorViews.filter((view) => view.activity === "active").length, 1);
    assert.deepEqual(projection.learnerViews.map((view) => view.seatId),
      Array.from({ length: learnerCount }, (_, index) => `learner${String(index + 1).padStart(2, "0")}`));
  }
});

test("learner private-card views are deterministic and isolated", () => {
  const course = courseSupportingSix();
  const first = buildStudioProjection(course, { learnerCount: 6, blockId: "B01", seed: "seed-a" });
  const replay = buildStudioProjection(course, { learnerCount: 6, blockId: "B01", seed: "seed-a" });
  assert.deepEqual(first, replay);

  const allIds = first.learnerViews.flatMap((view) => view.privateCards.map((card) => card.id));
  assert.equal(allIds.length, 18);
  assert.equal(new Set(allIds).size, 18);
  for (const view of first.learnerViews) {
    assert.equal(view.privateCards.length, 3);
    assert.ok(!("allCards" in view), "a learner projection must not expose the deck");
  }
});

test("capacity and range failures explain the exact gap and fail closed", () => {
  const legacy = bundledCoursePackages()[0];
  const outOfRange = validateCourseInstantiation(legacy, 6);
  assert.equal(outOfRange.ok, false);
  assert.ok(outOfRange.issues.some((issue) => issue.code === "LEARNER_COUNT_OUT_OF_RANGE"));
  assert.throws(() => assertCourseCanInstantiate(legacy, 6), /最多支持 4 名学员/);

  const tooSmall = courseSupportingSix();
  tooSmall.decks[2].cards.splice(12);
  const capacity = validateCourseInstantiation(tooSmall, 6);
  assert.equal(capacity.ok, false);
  assert.deepEqual(capacity.issues.find((issue) => issue.code === "DECK_CAPACITY_INSUFFICIENT"), {
    code: "DECK_CAPACITY_INSUFFICIENT",
    path: "decks[2].cards",
    message: "第 3 步卡组需要 18 张不重复卡，当前只有 12 张，还缺 6 张。",
  });
});

test("learner tasks beyond learner04 come from the generic template, never fake fixed seats", () => {
  const course = courseSupportingSix();
  course.blocks[0].learnerTaskTemplate = {
    badge: "Young Builder",
    task: "从自己的三张卡中找出一条能帮助团队判断的线索。",
  };
  const projection = buildStudioProjection(course, { learnerCount: 6, blockId: "B01", seed: "seed-b" });
  assert.equal(projection.learnerViews[4].task, course.blocks[0].learnerTaskTemplate.task);
  assert.equal(projection.learnerViews[5].task, course.blocks[0].learnerTaskTemplate.task);
});

test("a new course can use its own safe case id without adding a hard-coded runtime campaign", () => {
  const course = structuredClone(bundledCoursePackages()[0]);
  course.course.id = "new-robotics-case-2030";
  course.case.campaignId = course.course.id;
  assert.equal(validateCoursePackage(course).course.id, "new-robotics-case-2030");
  course.case.campaignId = "different-case";
  assert.throws(() => validateCoursePackage(course), /必须与 \$\.course\.id 一致/);
});

test("repeat-when-needed deals intentionally repeat a non-empty small deck", () => {
  const course = structuredClone(bundledCoursePackages()[0]);
  course.learnerPolicy = {
    defaultCount: 6,
    minCount: 2,
    maxCount: 6,
    cardsPerLearner: 3,
    dealPolicy: "repeat-when-needed",
  };
  for (const deck of course.decks) {
    deck.uniqueDeal = false;
    deck.cards.splice(2);
  }
  for (const block of course.blocks) block.learnerTaskTemplate = { badge: "Young Builder", task: block.studentPrompt };
  assert.equal(validateCourseInstantiation(course, 6).ok, true);
  const projection = buildStudioProjection(course, { learnerCount: 6, blockId: "B01", seed: "repeat-contract" });
  const ids = projection.learnerViews.flatMap((view) => view.privateCards.map((card) => card.id));
  assert.equal(ids.length, 18);
  assert.ok(new Set(ids).size < ids.length);
});
