import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { buildStudioProjection, privateDeckForBlock } from "../app/lib/course-platform";
import { validateCoursePackage, type CoursePackage } from "../app/lib/course-package";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

function t095Course(): CoursePackage {
  return validateCoursePackage(JSON.parse(source("tools/live-run/courses/candidates/eleme-2008-unified-t095.json")));
}

function browserPreview() {
  const context: Record<string, unknown> = {};
  context.window = context;
  vm.runInNewContext(source("public/studio/editor-assets/card-view.js"), context);
  vm.runInNewContext(source("public/studio/editor-assets/course-preview.js"), context);
  return context.MsvCoursePreview as {
    projectCourse: (course: CoursePackage, options: Record<string, unknown>) => {
      deal: { deck: { id: string }; hands: Record<string, Array<{ id: string; sourcePath: string }>> };
      learners: Array<{ id: string; task: string; taskPath: string }>;
    };
  };
}

test("Editor Preview and the shared TS projector deal the identical B01 cards for 2/4/6 learners", () => {
  const course = t095Course();
  const preview = browserPreview();
  const blockIndex = course.blocks.findIndex((block) => block.id === "B01");
  assert.ok(blockIndex >= 0);

  for (const learnerCount of [2, 4, 6]) {
    const seed = `t094-b01-${learnerCount}`;
    const browser = preview.projectCourse(course, { blockIndex, learnerCount, seed, status: "ready" });
    const shared = buildStudioProjection(course, { blockId: "B01", learnerCount, seed });

    assert.equal(browser.deal.deck.id, shared.learnerViews[0].privateDeckId);
    for (const learner of shared.learnerViews) {
      assert.deepEqual(
        Array.from(browser.deal.hands[learner.seatId], (card) => card.id),
        learner.privateCards.map((card) => card.id),
        `${learner.seatId} must see the same cards on both surfaces`,
      );
      const browserLearner = browser.learners.find((item) => item.id === learner.seatId);
      assert.equal(browserLearner?.task, learner.task);
      assert.equal(browserLearner?.taskPath, `blocks.${blockIndex}.seatTasks.${learner.seatId}.task`);
    }
  }
});

test("checkpoint-owned deck selection is identical even when the macro-step points elsewhere", () => {
  const course = t095Course();
  const blockIndex = course.blocks.findIndex((block) => block.id === "B05");
  const block = course.blocks[blockIndex];
  assert.equal(block.macroStepId, "decide");
  assert.equal(privateDeckForBlock(course, block).id, "device-booking-incident-private-evidence");

  const browser = browserPreview().projectCourse(course, {
    blockIndex,
    learnerCount: 4,
    seed: "t094-checkpoint-deck",
    status: "ready",
  });
  const shared = buildStudioProjection(course, {
    blockId: block.id,
    learnerCount: 4,
    seed: "t094-checkpoint-deck",
  });
  assert.equal(browser.deal.deck.id, "device-booking-incident-private-evidence");
  assert.deepEqual(
    Object.values(browser.deal.hands).flatMap((cards) => Array.from(cards, (card) => card.id)),
    shared.learnerViews.flatMap((view) => view.privateCards.map((card) => card.id)),
  );
});
