import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { buildStudioProjection, privateDeckForBlock } from "../app/lib/course-platform";
import {
  buildCoreRoleProjection,
  deterministicDeal,
  validateCourseInstantiationCore,
} from "../app/lib/course-projection-core";
import { validateCoursePackage, type CoursePackage } from "../app/lib/course-package";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function t095Course(): CoursePackage {
  return validateCoursePackage(JSON.parse(source("tools/live-run/courses/candidates/eleme-2008-unified-t095.json")));
}

type BrowserProjection = {
  block: { id: string };
  status: string;
  seats: Array<{ id: string; task: string; cards?: Array<{ id: string }> }>;
  mentors: unknown[];
  learners: Array<{ id: string; task: string; taskPath: string; cards: Array<{ id: string }> }>;
  deal: ReturnType<typeof deterministicDeal>;
  roleProjection: ReturnType<typeof buildCoreRoleProjection>;
  capacity: ReturnType<typeof validateCourseInstantiationCore>;
  controller: { block: { id: string } };
};

function browserRuntime() {
  const context: Record<string, unknown> = {};
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(source("public/studio/editor-assets/card-view.js"), context);
  vm.runInNewContext(source("public/studio/editor-assets/course-projection-core.js"), context);
  vm.runInNewContext(source("public/studio/editor-assets/course-preview.js"), context);
  return {
    core: context.MsvCourseProjectionCore as {
      deterministicDeal: typeof deterministicDeal;
      validateCourseInstantiationCore: typeof validateCourseInstantiationCore;
    },
    preview: context.MsvCoursePreview as {
      projectCourse: (course: CoursePackage, options: Record<string, unknown>) => BrowserProjection;
      deterministicDeal: (course: CoursePackage, stepIndex: number, seed: string, learnerCount: number, blockId?: string) => ReturnType<typeof deterministicDeal>;
    },
  };
}

function comparableServerProjection(course: CoursePackage, blockId: string, learnerCount: number, seed: string) {
  const server = buildStudioProjection(course, { blockId, learnerCount, seed });
  return {
    courseId: server.courseId,
    learnerCount: server.learnerCount,
    blockId: server.blockId,
    mentorViews: server.mentorViews.map((view) => ({
      kind: view.kind,
      seatId: view.seatId,
      label: view.label,
      mentorRole: view.mentorRole,
      activity: view.activity,
      badge: view.badge,
      task: view.task,
      blockId: view.blockId,
      privateScript: view.privateScript,
    })),
    learnerViews: server.learnerViews,
    controllerView: server.controllerView,
  };
}

test("generated browser projector is the same source contract across all 195 T-095 role scenarios", () => {
  const course = t095Course();
  const { preview } = browserRuntime();
  const statuses = ["ready", "executing", "awaiting-acceptance", "error", "completed"];
  let scenarios = 0;

  for (const block of course.blocks) {
    const blockIndex = course.blocks.indexOf(block);
    for (const learnerCount of [2, 4, 6]) {
      for (const status of statuses) {
        const seed = `T103｜${block.id}｜${learnerCount}｜${status}｜硅谷🚀`;
        const browser = preview.projectCourse(course, { blockIndex, learnerCount, seed, status });
        const server = comparableServerProjection(course, block.id, learnerCount, seed);
        const browserCore = browser.roleProjection;

        assert.equal(browser.status, status);
        assert.equal(browser.block.id, block.id);
        assert.equal(browser.seats.length, 4 + learnerCount);
        assert.equal(browser.mentors.length, 4);
        assert.equal(browser.learners.length, learnerCount);
        assert.equal(browser.capacity.ok, true);
        assert.deepEqual(plain({
          courseId: browserCore.courseId,
          learnerCount: browserCore.learnerCount,
          blockId: browserCore.blockId,
          mentorViews: browserCore.mentorViews,
          learnerViews: browserCore.learnerViews,
          controllerView: browserCore.controllerView,
        }), plain(server), `${block.id}/${learnerCount}/${status}: mentor, learner and controller fields diverged`);

        const replay = preview.projectCourse(course, { blockIndex, learnerCount, seed, status });
        assert.deepEqual(
          plain(browser.deal.hands),
          plain(replay.deal.hands),
          `${block.id}/${learnerCount}/${status}: repeated deal changed`,
        );
        for (const [seatId, cards] of Object.entries(browser.deal.hands)) {
          const serverCards = server.learnerViews.find((view) => view.seatId === seatId)?.privateCards ?? [];
          assert.deepEqual(
            plain(cards).map((card) => {
              const value = card as unknown as Record<string, unknown>;
              delete value.sourcePath;
              delete value.stableId;
              delete value.state;
              return value;
            }),
            plain(serverCards),
            `${block.id}/${seatId}: card body/source/order diverged`,
          );
          assert.ok(cards.every((card) => card.stableId === card.id && card.state === "held"));
        }
        scenarios += 1;
      }
    }
  }
  assert.equal(scenarios, 195);
});

test("checkpoint-owned deck selection remains exact when the macro step points elsewhere", () => {
  const course = t095Course();
  const block = course.blocks.find((item) => item.id === "B05")!;
  assert.equal(block.macroStepId, "decide");
  assert.equal(privateDeckForBlock(course, block).id, "device-booking-incident-private-evidence");

  const { preview } = browserRuntime();
  const browser = preview.projectCourse(course, {
    blockIndex: course.blocks.indexOf(block),
    learnerCount: 4,
    seed: "T103｜检查点｜🧭",
    status: "ready",
  });
  const server = buildStudioProjection(course, { blockId: block.id, learnerCount: 4, seed: "T103｜检查点｜🧭" });
  assert.equal(browser.deal.deck.id, "device-booking-incident-private-evidence");
  assert.deepEqual(
    Object.values(browser.deal.hands).flatMap((cards) => cards.map((card) => card.id)),
    server.learnerViews.flatMap((view) => view.privateCards.map((card) => card.id)),
  );
});

test("invalid authoring scenarios are explicit on both sides rather than silently clipped", () => {
  const course = t095Course();
  const { preview } = browserRuntime();
  const browser = preview.projectCourse(course, { blockIndex: 0, learnerCount: 24, seed: "越界", status: "ready" });
  const server = buildStudioProjection(course, { blockId: "B01", learnerCount: 24, seed: "越界" });
  assert.equal(browser.learners.length, 24);
  assert.equal(server.learnerViews.length, 24);
  assert.equal(browser.capacity.ok, false);
  assert.deepEqual(plain(browser.capacity), plain(server.controllerView.capacity));
  assert.ok(browser.capacity.issues.some((issue) => issue.code === "LEARNER_COUNT_OUT_OF_RANGE"));

  let browserError = "";
  let serverError = "";
  try { preview.projectCourse(course, { blockIndex: 0, learnerCount: 2.5, seed: "bad" }); } catch (error) { browserError = (error as Error).message; }
  try { buildStudioProjection(course, { blockId: "B01", learnerCount: 2.5, seed: "bad" }); } catch (error) { serverError = (error as Error).message; }
  assert.equal(browserError, serverError);
  assert.match(browserError, /必须是 0—24 的整数/);
});

test("unknown blocks fail identically and never fall back to a macro-step deck", () => {
  const course = t095Course();
  const { preview } = browserRuntime();
  assert.throws(
    () => preview.deterministicDeal(course, 0, "unknown", 4, "B99"),
    /找不到 Block B99/,
  );
  assert.throws(
    () => buildStudioProjection(course, { blockId: "B99", learnerCount: 4, seed: "unknown" }),
    /找不到 Block B99/,
  );
});

test("repeat policy is deterministic while an empty repeat deck fails capacity explicitly", () => {
  const course = structuredClone(t095Course());
  course.learnerPolicy = { defaultCount: 6, minCount: 2, maxCount: 6, cardsPerLearner: 3, dealPolicy: "repeat-when-needed" };
  for (const deck of course.decks) {
    deck.uniqueDeal = false;
    deck.cards.splice(2);
  }
  const { core } = browserRuntime();
  const serverDeal = deterministicDeal(course, { blockId: "B01", learnerCount: 6, seed: "循环♻️" });
  const browserDeal = core.deterministicDeal(course, { blockId: "B01", learnerCount: 6, seed: "循环♻️" });
  assert.deepEqual(plain(browserDeal.hands), plain(serverDeal.hands));
  assert.equal(serverDeal.dealtCount, 18);
  assert.ok(serverDeal.uniqueCount < serverDeal.dealtCount);

  course.decks[0].cards = [];
  const serverValidation = validateCourseInstantiationCore(course, 6);
  const browserValidation = core.validateCourseInstantiationCore(course, 6);
  assert.deepEqual(plain(browserValidation), plain(serverValidation));
  assert.ok(serverValidation.issues.some((issue) => issue.code === "DECK_CAPACITY_INSUFFICIENT" && /卡组为空/.test(issue.message)));
});

test("browser preview fails closed when its generated core dependency is absent", () => {
  const context: Record<string, unknown> = {};
  context.window = context;
  assert.throws(
    () => vm.runInNewContext(source("public/studio/editor-assets/course-preview.js"), context),
    /共享课程投影器未载入/,
  );
});
