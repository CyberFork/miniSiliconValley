/* eslint-disable */
/* GENERATED from app/lib/course-projection-core.ts. Run npm run generate:course-projector; do not edit. */
"use strict";
var MsvCourseProjectionCore = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // app/lib/course-projection-core.ts
  var course_projection_core_exports = {};
  __export(course_projection_core_exports, {
    LEGACY_LEARNER_POLICY: () => LEGACY_LEARNER_POLICY,
    PROJECTION_DIAGNOSTIC_MAX_LEARNERS: () => PROJECTION_DIAGNOSTIC_MAX_LEARNERS,
    buildCoreRoleProjection: () => buildCoreRoleProjection,
    deterministicDeal: () => deterministicDeal,
    hashSeed: () => hashSeed,
    learnersForCourse: () => learnersForCourse,
    privateDeckForBlock: () => privateDeckForBlock,
    randomFromSeed: () => randomFromSeed,
    requestedLearnerCount: () => requestedLearnerCount,
    resolveLearnerPolicy: () => resolveLearnerPolicy,
    seededShuffle: () => seededShuffle,
    taskForLearner: () => taskForLearner,
    validateCourseInstantiationCore: () => validateCourseInstantiationCore
  });
  var LEGACY_LEARNER_POLICY = Object.freeze({
    defaultCount: 4,
    minCount: 2,
    maxCount: 4,
    cardsPerLearner: 3,
    dealPolicy: "unique-within-step"
  });
  var PROJECTION_DIAGNOSTIC_MAX_LEARNERS = 24;
  function plainCourseCard(card) {
    return __spreadValues(__spreadValues({
      id: card.id,
      boundary: card.boundary,
      title: card.title,
      body: card.body,
      sharePrompt: card.sharePrompt,
      sourceIds: [...card.sourceIds]
    }, card.credibility ? { credibility: card.credibility } : {}), card.simulationCategory ? { simulationCategory: card.simulationCategory } : {});
  }
  var MENTOR_SEAT_IDS = ["mentor01", "mentor02", "mentor03", "mentor04"];
  var MENTOR_CODES = ["P", "D", "M", "O"];
  function resolveLearnerPolicy(course) {
    return course.learnerPolicy ? __spreadValues({}, course.learnerPolicy) : __spreadValues({}, LEGACY_LEARNER_POLICY);
  }
  function requestedLearnerCount(course, requestedCount) {
    const policy = resolveLearnerPolicy(course);
    if (requestedCount === void 0 || requestedCount === null || requestedCount === "") return policy.defaultCount;
    const count = Number(requestedCount);
    if (!Number.isInteger(count) || count < 0 || count > PROJECTION_DIAGNOSTIC_MAX_LEARNERS) {
      throw new Error(`\u5B66\u5458\u4EBA\u6570\u5FC5\u987B\u662F 0\u2014${PROJECTION_DIAGNOSTIC_MAX_LEARNERS} \u7684\u6574\u6570\uFF1B\u6536\u5230 ${String(requestedCount)}\u3002`);
    }
    return count;
  }
  function learnersForCourse(course, requestedCount) {
    const count = requestedLearnerCount(course, requestedCount);
    return Array.from({ length: count }, (_, index) => {
      const learnerNumber = index + 1;
      return {
        id: `learner${String(learnerNumber).padStart(2, "0")}`,
        window: `W${String(learnerNumber + 3).padStart(2, "0")}`,
        title: `Young Builder ${String(learnerNumber).padStart(2, "0")}`,
        learnerNumber
      };
    });
  }
  function taskForLearner(block, seatId) {
    var _a;
    const fixed = (_a = block.seatTasks) == null ? void 0 : _a[seatId];
    if (fixed) return { badge: fixed.badge, task: fixed.task, source: "seat" };
    if (block.learnerTaskTemplate) return __spreadProps(__spreadValues({}, block.learnerTaskTemplate), { source: "template" });
    return { badge: "Young Builder", task: block.studentPrompt, source: "prompt" };
  }
  function hashSeed(value) {
    const text = String(value != null ? value : "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function randomFromSeed(seed) {
    let state = hashSeed(seed) || 2654435769;
    return () => {
      state += 1831565813;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function seededShuffle(values, seed) {
    const random = randomFromSeed(seed);
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }
  function privateDeckForBlock(course, block) {
    var _a, _b;
    const declaredDeckId = (_b = (_a = course.contentPackages) == null ? void 0 : _a.scriptPackages.flatMap((scriptPackage) => scriptPackage.checkpoints).find((checkpoint) => checkpoint.blockIds.includes(block.id))) == null ? void 0 : _b.privateDeckIds[0];
    const deck = declaredDeckId ? course.decks.find((item) => item.id === declaredDeckId) : course.decks.find((item) => item.macroStepId === block.macroStepId);
    if (!deck) throw new Error(`${block.id} \u627E\u4E0D\u5230\u53EF\u7528\u7684\u5B66\u5458\u79C1\u5BC6\u5361\u7EC4\u3002`);
    return deck;
  }
  function validateCourseInstantiationCore(course, learnerCountInput) {
    const learnerCount = requestedLearnerCount(course, learnerCountInput);
    const policy = resolveLearnerPolicy(course);
    const issues = [];
    if (learnerCount < policy.minCount || learnerCount > policy.maxCount) {
      issues.push({
        code: "LEARNER_COUNT_OUT_OF_RANGE",
        path: "learnerPolicy",
        message: `\u672C\u8BFE\u7A0B\u652F\u6301 ${policy.minCount}\u2014${policy.maxCount} \u540D\u5B66\u5458\uFF1B\u5F53\u524D\u9009\u62E9 ${String(learnerCount)} \u540D\uFF0C\u6700\u591A\u652F\u6301 ${policy.maxCount} \u540D\u5B66\u5458\u3002`
      });
    }
    const required = learnerCount * policy.cardsPerLearner;
    course.decks.forEach((deck, index) => {
      const available = Array.isArray(deck.cards) ? deck.cards.length : 0;
      const insufficient = policy.dealPolicy === "unique-within-step" ? available < required : required > 0 && available === 0;
      if (insufficient) {
        const missing = policy.dealPolicy === "unique-within-step" ? Math.max(0, required - available) : required;
        issues.push({
          code: "DECK_CAPACITY_INSUFFICIENT",
          path: `decks[${index}].cards`,
          message: policy.dealPolicy === "unique-within-step" ? `\u7B2C ${index + 1} \u6B65\u5361\u7EC4\u9700\u8981 ${required} \u5F20\u4E0D\u91CD\u590D\u5361\uFF0C\u5F53\u524D\u53EA\u6709 ${available} \u5F20\uFF0C\u8FD8\u7F3A ${missing} \u5F20\u3002` : `\u7B2C ${index + 1} \u6B65\u5361\u7EC4\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u4E3A ${learnerCount} \u540D\u5B66\u5458\u5FAA\u73AF\u53D1\u724C\u3002`
        });
      }
    });
    if (learnerCount > 4 && !course.fieldModel) {
      course.blocks.forEach((block, index) => {
        if (!block.learnerTaskTemplate) {
          issues.push({
            code: "LEARNER_TASK_TEMPLATE_MISSING",
            path: `blocks[${index}].learnerTaskTemplate`,
            message: `${block.id} \u7F3A\u5C11\u52A8\u6001\u5B66\u5458\u4EFB\u52A1\u6A21\u677F\uFF0C\u65E0\u6CD5\u5B89\u5168\u751F\u6210\u7B2C 5 \u540D\u53CA\u4E4B\u540E\u7684\u5B66\u5458\u5E2D\u3002`
          });
        }
      });
    }
    if (course.fieldModel) {
      course.blocks.forEach((block, blockIndex) => {
        var _a;
        for (const learner of learnersForCourse(course, learnerCount)) {
          if (!((_a = block.seatTasks) == null ? void 0 : _a[learner.id])) {
            issues.push({
              code: "LEARNER_SEAT_TASK_MISSING",
              path: `blocks[${blockIndex}].seatTasks.${learner.id}`,
              message: `${block.id} \u7F3A\u5C11 ${learner.id} \u7684\u72EC\u7ACB\u4EFB\u52A1\u8282\u70B9\u3002`
            });
          }
        }
      });
    }
    return { ok: issues.length === 0, issues };
  }
  function deterministicDeal(course, input) {
    var _a;
    const learnerCount = requestedLearnerCount(course, input.learnerCount);
    let block;
    if (input.blockId) {
      block = course.blocks.find((item) => item.id === input.blockId);
      if (!block) throw new Error(`\u627E\u4E0D\u5230 Block ${input.blockId}\u3002`);
    }
    const step = input.stepIndex === void 0 ? void 0 : course.macroSteps[input.stepIndex];
    const deck = block ? privateDeckForBlock(course, block) : course.decks.find((item) => item.macroStepId === (step == null ? void 0 : step.id));
    if (!deck) throw new Error(`${input.blockId || (step == null ? void 0 : step.id) || "\u5F53\u524D\u6B65\u9AA4"} \u627E\u4E0D\u5230\u53EF\u7528\u7684\u5B66\u5458\u79C1\u5BC6\u5361\u7EC4\u3002`);
    const deckIndex = course.decks.findIndex((item) => item.id === deck.id);
    const indexedCards = deck.cards.map((card, cardIndex) => ({ card, cardIndex }));
    const shuffled = seededShuffle(indexedCards, `${course.course.id}:${deck.id}:${String((_a = input.seed) != null ? _a : "")}`);
    const policy = resolveLearnerPolicy(course);
    const learners = learnersForCourse(course, learnerCount);
    const handSize = Math.max(0, policy.cardsPerLearner);
    const hands = {};
    learners.forEach((learner, learnerIndex) => {
      const start = learnerIndex * handSize;
      let selected = shuffled.slice(start, start + handSize);
      if (selected.length < handSize && policy.dealPolicy === "repeat-when-needed" && shuffled.length) {
        selected = Array.from({ length: handSize }, (_, cardIndex) => shuffled[(start + cardIndex) % shuffled.length]);
      }
      hands[learner.id] = selected.map(({ card, cardIndex }) => __spreadProps(__spreadValues({}, card), {
        sourceIds: [...card.sourceIds],
        sourcePath: `decks.${deckIndex}.cards.${cardIndex}`,
        stableId: card.id,
        state: "held"
      }));
    });
    const allCards = Object.values(hands).flat();
    return {
      deck,
      deckIndex,
      hands,
      learners,
      handSize,
      dealtCount: allCards.length,
      uniqueCount: new Set(allCards.map((card) => card.id)).size
    };
  }
  function buildCoreRoleProjection(course, input) {
    const learnerCount = requestedLearnerCount(course, input.learnerCount);
    const blockIndex = course.blocks.findIndex((item) => item.id === input.blockId);
    if (blockIndex < 0) throw new Error(`\u627E\u4E0D\u5230 Block ${input.blockId}\u3002`);
    const block = course.blocks[blockIndex];
    const stepIndex = course.macroSteps.findIndex((step) => step.id === block.macroStepId);
    if (stepIndex < 0) throw new Error(`${block.id} \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5927\u6B65\u9AA4 ${block.macroStepId}\u3002`);
    const policy = resolveLearnerPolicy(course);
    const capacity = validateCourseInstantiationCore(course, learnerCount);
    const deal = deterministicDeal(course, { blockId: block.id, learnerCount, seed: input.seed });
    const mentorViews = MENTOR_SEAT_IDS.map((seatId, index) => {
      const authored = block.seatTasks[seatId];
      const mentor = course.formula.fourMentors[index];
      if (!authored || !mentor) throw new Error(`${block.id} \u7F3A\u5C11 ${seatId} \u7684\u5BFC\u5E08\u6295\u5F71\u5B9A\u4E49\u3002`);
      return {
        kind: "mentor",
        seatId,
        label: mentor.name,
        mentorRole: MENTOR_CODES[index],
        activity: authored.state,
        badge: authored.badge,
        task: authored.task,
        blockId: block.id,
        privateScript: authored.state === "active" ? [...block.mentorScript] : []
      };
    });
    const learnerViews = deal.learners.map((learner) => {
      const task = taskForLearner(block, learner.id);
      return {
        kind: "learner",
        seatId: learner.id,
        learnerNumber: learner.learnerNumber,
        label: learner.title,
        activity: "active",
        badge: task.badge,
        task: task.task,
        blockId: block.id,
        privateDeckId: deal.deck.id,
        privateCards: deal.hands[learner.id].map(plainCourseCard),
        prompt: block.studentPrompt
      };
    });
    return {
      courseId: course.course.id,
      learnerCount,
      blockId: block.id,
      blockIndex,
      stepIndex,
      policy,
      deal,
      mentorViews,
      learnerViews,
      controllerView: {
        kind: "controller",
        seatId: "controller",
        label: "\u8BFE\u7A0B\u4E2D\u63A7",
        blockId: block.id,
        title: block.title,
        leadMentorId: block.leadMentorId,
        systemActions: [...block.systemActions],
        acceptance: [...block.evidenceGate],
        capacity
      }
    };
  }
  return __toCommonJS(course_projection_core_exports);
})();
globalThis.MsvCourseProjectionCore = Object.freeze(MsvCourseProjectionCore);
