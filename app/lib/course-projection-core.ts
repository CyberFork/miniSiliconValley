import type {
  CourseLearnerPolicy,
  CourseMentorRole,
  CoursePackage,
  CoursePackageBlock,
  CoursePackageCard,
} from "./course-package";

/**
 * Authoritative, environment-neutral course projection rules.
 *
 * This module is imported directly by the server and bundled verbatim for the
 * framework-free Course Studio browser. Keep DOM, database and Node APIs out
 * of this file so the generated browser artifact remains deterministic.
 */

export const LEGACY_LEARNER_POLICY: Readonly<CourseLearnerPolicy> = Object.freeze({
  defaultCount: 4,
  minCount: 2,
  maxCount: 4,
  cardsPerLearner: 3,
  dealPolicy: "unique-within-step",
});

export const PROJECTION_DIAGNOSTIC_MAX_LEARNERS = 24;

export type CourseInstantiationIssue = {
  code:
    | "LEARNER_COUNT_OUT_OF_RANGE"
    | "DECK_CAPACITY_INSUFFICIENT"
    | "LEARNER_TASK_TEMPLATE_MISSING"
    | "LEARNER_SEAT_TASK_MISSING";
  path: string;
  message: string;
};

export type CourseInstantiationValidation = {
  ok: boolean;
  issues: CourseInstantiationIssue[];
};

export type ProjectionLearner = {
  id: string;
  window: string;
  title: string;
  learnerNumber: number;
};

export type ProjectedCard = CoursePackageCard & {
  sourcePath: string;
  stableId: string;
  state: "held";
};

export type DeterministicDeal = {
  deck: CoursePackage["decks"][number];
  deckIndex: number;
  hands: Record<string, ProjectedCard[]>;
  learners: ProjectionLearner[];
  handSize: number;
  dealtCount: number;
  uniqueCount: number;
};

export type CoreMentorProjection = {
  kind: "mentor";
  seatId: string;
  label: string;
  mentorRole: CourseMentorRole;
  activity: "active" | "support" | "standby";
  badge: string;
  task: string;
  blockId: string;
  privateScript: string[];
};

export type CoreLearnerProjection = {
  kind: "learner";
  seatId: string;
  learnerNumber: number;
  label: string;
  activity: "active";
  badge: string;
  task: string;
  blockId: string;
  privateDeckId: string;
  privateCards: CoursePackageCard[];
  prompt: string;
};

export type CoreControllerProjection = {
  kind: "controller";
  seatId: "controller";
  label: "课程中控";
  blockId: string;
  title: string;
  leadMentorId: string;
  systemActions: string[];
  acceptance: string[];
  capacity: CourseInstantiationValidation;
};

export type CoreRoleProjection = {
  courseId: string;
  learnerCount: number;
  blockId: string;
  blockIndex: number;
  stepIndex: number;
  policy: CourseLearnerPolicy;
  deal: DeterministicDeal;
  mentorViews: CoreMentorProjection[];
  learnerViews: CoreLearnerProjection[];
  controllerView: CoreControllerProjection;
};

function plainCourseCard(card: ProjectedCard): CoursePackageCard {
  return {
    id: card.id,
    boundary: card.boundary,
    title: card.title,
    body: card.body,
    sharePrompt: card.sharePrompt,
    sourceIds: [...card.sourceIds],
    ...(card.credibility ? { credibility: card.credibility } : {}),
    ...(card.simulationCategory ? { simulationCategory: card.simulationCategory } : {}),
  };
}

const MENTOR_SEAT_IDS = ["mentor01", "mentor02", "mentor03", "mentor04"] as const;
const MENTOR_CODES = ["P", "D", "M", "O"] as const;

/** Resolve legacy exact releases without mutating their canonical JSON. */
export function resolveLearnerPolicy(course: Pick<CoursePackage, "learnerPolicy">): CourseLearnerPolicy {
  return course.learnerPolicy ? { ...course.learnerPolicy } : { ...LEGACY_LEARNER_POLICY };
}

/**
 * Preserve an author's requested count instead of silently clipping it to the
 * course policy. Values outside the policy are rendered as explicit invalid
 * diagnostic scenarios; nonsensical/unbounded values fail before allocation.
 */
export function requestedLearnerCount(
  course: Pick<CoursePackage, "learnerPolicy">,
  requestedCount?: unknown,
): number {
  const policy = resolveLearnerPolicy(course);
  if (requestedCount === undefined || requestedCount === null || requestedCount === "") return policy.defaultCount;
  const count = Number(requestedCount);
  if (!Number.isInteger(count) || count < 0 || count > PROJECTION_DIAGNOSTIC_MAX_LEARNERS) {
    throw new Error(`学员人数必须是 0—${PROJECTION_DIAGNOSTIC_MAX_LEARNERS} 的整数；收到 ${String(requestedCount)}。`);
  }
  return count;
}

export function learnersForCourse(
  course: Pick<CoursePackage, "learnerPolicy">,
  requestedCount?: unknown,
): ProjectionLearner[] {
  const count = requestedLearnerCount(course, requestedCount);
  return Array.from({ length: count }, (_, index) => {
    const learnerNumber = index + 1;
    return {
      id: `learner${String(learnerNumber).padStart(2, "0")}`,
      window: `W${String(learnerNumber + 3).padStart(2, "0")}`,
      title: `Young Builder ${String(learnerNumber).padStart(2, "0")}`,
      learnerNumber,
    };
  });
}

export function taskForLearner(
  block: CoursePackageBlock,
  seatId: string,
): { badge: string; task: string; source: "seat" | "template" | "prompt" } {
  const fixed = block.seatTasks?.[seatId];
  if (fixed) return { badge: fixed.badge, task: fixed.task, source: "seat" };
  if (block.learnerTaskTemplate) return { ...block.learnerTaskTemplate, source: "template" };
  return { badge: "Young Builder", task: block.studentPrompt, source: "prompt" };
}

/** FNV-1a over UTF-16 code units: identical in Node and browser JavaScript. */
export function hashSeed(value: unknown): number {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomFromSeed(seed: unknown): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(values: readonly T[], seed: unknown): T[] {
  const random = randomFromSeed(seed);
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/**
 * ScriptPackage checkpoints own deck selection. Falling back to the macro step
 * is only for immutable legacy packages that predate contentPackages.
 */
export function privateDeckForBlock(course: CoursePackage, block: CoursePackageBlock) {
  const declaredDeckId = course.contentPackages?.scriptPackages
    .flatMap((scriptPackage) => scriptPackage.checkpoints)
    .find((checkpoint) => checkpoint.blockIds.includes(block.id))
    ?.privateDeckIds[0];
  const deck = declaredDeckId
    ? course.decks.find((item) => item.id === declaredDeckId)
    : course.decks.find((item) => item.macroStepId === block.macroStepId);
  if (!deck) throw new Error(`${block.id} 找不到可用的学员私密卡组。`);
  return deck;
}

export function validateCourseInstantiationCore(
  course: CoursePackage,
  learnerCountInput: unknown,
): CourseInstantiationValidation {
  const learnerCount = requestedLearnerCount(course, learnerCountInput);
  const policy = resolveLearnerPolicy(course);
  const issues: CourseInstantiationIssue[] = [];
  if (learnerCount < policy.minCount || learnerCount > policy.maxCount) {
    issues.push({
      code: "LEARNER_COUNT_OUT_OF_RANGE",
      path: "learnerPolicy",
      message: `本课程支持 ${policy.minCount}—${policy.maxCount} 名学员；当前选择 ${String(learnerCount)} 名，最多支持 ${policy.maxCount} 名学员。`,
    });
  }
  const required = learnerCount * policy.cardsPerLearner;
  course.decks.forEach((deck, index) => {
    const available = Array.isArray(deck.cards) ? deck.cards.length : 0;
    const insufficient = policy.dealPolicy === "unique-within-step"
      ? available < required
      : required > 0 && available === 0;
    if (insufficient) {
      const missing = policy.dealPolicy === "unique-within-step" ? Math.max(0, required - available) : required;
      issues.push({
        code: "DECK_CAPACITY_INSUFFICIENT",
        path: `decks[${index}].cards`,
        message: policy.dealPolicy === "unique-within-step"
          ? `第 ${index + 1} 步卡组需要 ${required} 张不重复卡，当前只有 ${available} 张，还缺 ${missing} 张。`
          : `第 ${index + 1} 步卡组为空，无法为 ${learnerCount} 名学员循环发牌。`,
      });
    }
  });
  if (learnerCount > 4 && !course.fieldModel) {
    course.blocks.forEach((block, index) => {
      if (!block.learnerTaskTemplate) {
        issues.push({
          code: "LEARNER_TASK_TEMPLATE_MISSING",
          path: `blocks[${index}].learnerTaskTemplate`,
          message: `${block.id} 缺少动态学员任务模板，无法安全生成第 5 名及之后的学员席。`,
        });
      }
    });
  }
  if (course.fieldModel) {
    course.blocks.forEach((block, blockIndex) => {
      for (const learner of learnersForCourse(course, learnerCount)) {
        if (!block.seatTasks?.[learner.id]) {
          issues.push({
            code: "LEARNER_SEAT_TASK_MISSING",
            path: `blocks[${blockIndex}].seatTasks.${learner.id}`,
            message: `${block.id} 缺少 ${learner.id} 的独立任务节点。`,
          });
        }
      }
    });
  }
  return { ok: issues.length === 0, issues };
}

export function deterministicDeal(
  course: CoursePackage,
  input: { learnerCount?: unknown; seed: unknown; blockId?: string; stepIndex?: number },
): DeterministicDeal {
  const learnerCount = requestedLearnerCount(course, input.learnerCount);
  let block: CoursePackageBlock | undefined;
  if (input.blockId) {
    block = course.blocks.find((item) => item.id === input.blockId);
    if (!block) throw new Error(`找不到 Block ${input.blockId}。`);
  }
  const step = input.stepIndex === undefined ? undefined : course.macroSteps[input.stepIndex];
  const deck = block
    ? privateDeckForBlock(course, block)
    : course.decks.find((item) => item.macroStepId === step?.id);
  if (!deck) throw new Error(`${input.blockId || step?.id || "当前步骤"} 找不到可用的学员私密卡组。`);
  const deckIndex = course.decks.findIndex((item) => item.id === deck.id);
  const indexedCards = deck.cards.map((card, cardIndex) => ({ card, cardIndex }));
  const shuffled = seededShuffle(indexedCards, `${course.course.id}:${deck.id}:${String(input.seed ?? "")}`);
  const policy = resolveLearnerPolicy(course);
  const learners = learnersForCourse(course, learnerCount);
  const handSize = Math.max(0, policy.cardsPerLearner);
  const hands: Record<string, ProjectedCard[]> = {};
  learners.forEach((learner, learnerIndex) => {
    const start = learnerIndex * handSize;
    let selected = shuffled.slice(start, start + handSize);
    if (selected.length < handSize && policy.dealPolicy === "repeat-when-needed" && shuffled.length) {
      selected = Array.from({ length: handSize }, (_, cardIndex) => shuffled[(start + cardIndex) % shuffled.length]);
    }
    hands[learner.id] = selected.map(({ card, cardIndex }) => ({
      ...card,
      sourceIds: [...card.sourceIds],
      sourcePath: `decks.${deckIndex}.cards.${cardIndex}`,
      stableId: card.id,
      state: "held",
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
    uniqueCount: new Set(allCards.map((card) => card.id)).size,
  };
}

export function buildCoreRoleProjection(
  course: CoursePackage,
  input: { learnerCount: unknown; blockId: string; seed: unknown },
): CoreRoleProjection {
  const learnerCount = requestedLearnerCount(course, input.learnerCount);
  const blockIndex = course.blocks.findIndex((item) => item.id === input.blockId);
  if (blockIndex < 0) throw new Error(`找不到 Block ${input.blockId}。`);
  const block = course.blocks[blockIndex];
  const stepIndex = course.macroSteps.findIndex((step) => step.id === block.macroStepId);
  if (stepIndex < 0) throw new Error(`${block.id} 引用了不存在的大步骤 ${block.macroStepId}。`);
  const policy = resolveLearnerPolicy(course);
  const capacity = validateCourseInstantiationCore(course, learnerCount);
  const deal = deterministicDeal(course, { blockId: block.id, learnerCount, seed: input.seed });
  const mentorViews: CoreMentorProjection[] = MENTOR_SEAT_IDS.map((seatId, index) => {
    const authored = block.seatTasks[seatId];
    const mentor = course.formula.fourMentors[index];
    if (!authored || !mentor) throw new Error(`${block.id} 缺少 ${seatId} 的导师投影定义。`);
    return {
      kind: "mentor",
      seatId,
      label: mentor.name,
      mentorRole: MENTOR_CODES[index],
      activity: authored.state,
      badge: authored.badge,
      task: authored.task,
      blockId: block.id,
      privateScript: authored.state === "active" ? [...block.mentorScript] : [],
    };
  });
  const learnerViews: CoreLearnerProjection[] = deal.learners.map((learner) => {
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
      prompt: block.studentPrompt,
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
      label: "课程中控",
      blockId: block.id,
      title: block.title,
      leadMentorId: block.leadMentorId,
      systemActions: [...block.systemActions],
      acceptance: [...block.evidenceGate],
      capacity,
    },
  };
}
