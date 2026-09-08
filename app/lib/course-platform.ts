import {
  COURSE_SEAT_IDS,
  validateCoursePackage,
  type CourseLearnerPolicy,
  type CoursePackage,
  type CoursePackageBlock,
  type CoursePackageCard,
} from "./course-package";

export type CourseInstantiationIssue = {
  code: "LEARNER_COUNT_OUT_OF_RANGE" | "DECK_CAPACITY_INSUFFICIENT" | "LEARNER_TASK_TEMPLATE_MISSING";
  path: string;
  message: string;
};

export type CourseInstantiationValidation = { ok: boolean; issues: CourseInstantiationIssue[] };
export type StudioActivity = "active" | "support" | "standby";

type StudioBaseView = {
  seatId: string;
  label: string;
  activity: StudioActivity;
  badge: string;
  task: string;
  blockId: string;
};

export type StudioMentorView = StudioBaseView & {
  kind: "mentor";
  mentorRole: "P" | "D" | "M" | "O";
  privateScript: string[];
};

export type StudioLearnerView = StudioBaseView & {
  kind: "learner";
  learnerNumber: number;
  privateCards: CoursePackageCard[];
  prompt: string;
};

export type StudioControllerView = {
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

export type StudioProjection = {
  courseId: string;
  learnerCount: number;
  blockId: string;
  mentorViews: StudioMentorView[];
  learnerViews: StudioLearnerView[];
  controllerView: StudioControllerView;
  views: Array<StudioMentorView | StudioLearnerView | StudioControllerView>;
};

const LEGACY_LEARNER_POLICY: CourseLearnerPolicy = {
  defaultCount: 4,
  minCount: 2,
  maxCount: 4,
  cardsPerLearner: 3,
  dealPolicy: "unique-within-step",
};

const MENTOR_CODES = ["P", "D", "M", "O"] as const;

/** Resolve old exact schema-v1 releases without changing their canonical JSON. */
export function resolveLearnerPolicy(course: CoursePackage): CourseLearnerPolicy {
  return course.learnerPolicy ? { ...course.learnerPolicy } : { ...LEGACY_LEARNER_POLICY };
}

export function validateCourseInstantiation(course: CoursePackage, learnerCount: number): CourseInstantiationValidation {
  validateCoursePackage(course);
  const policy = resolveLearnerPolicy(course);
  const issues: CourseInstantiationIssue[] = [];
  if (!Number.isInteger(learnerCount) || learnerCount < policy.minCount || learnerCount > policy.maxCount) {
    issues.push({
      code: "LEARNER_COUNT_OUT_OF_RANGE",
      path: "learnerPolicy",
      message: `本课程支持 ${policy.minCount}—${policy.maxCount} 名学员；当前选择 ${String(learnerCount)} 名，最多支持 ${policy.maxCount} 名学员。`,
    });
  }
  const required = Math.max(0, learnerCount) * policy.cardsPerLearner;
  if (policy.dealPolicy === "unique-within-step") {
    course.decks.forEach((deck, index) => {
      if (deck.cards.length < required) {
        issues.push({
          code: "DECK_CAPACITY_INSUFFICIENT",
          path: `decks[${index}].cards`,
          message: `第 ${index + 1} 步卡组需要 ${required} 张不重复卡，当前只有 ${deck.cards.length} 张，还缺 ${required - deck.cards.length} 张。`,
        });
      }
    });
  }
  if (learnerCount > 4) {
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
  return { ok: issues.length === 0, issues };
}

export function assertCourseCanInstantiate(course: CoursePackage, learnerCount: number): void {
  const validation = validateCourseInstantiation(course, learnerCount);
  if (!validation.ok) throw new Error(validation.issues.map((issue) => issue.message).join("\n"));
}

function taskForLearner(block: CoursePackageBlock, seatId: string): { badge: string; task: string } {
  const fixed = block.seatTasks[seatId];
  if (fixed) return { badge: fixed.badge, task: fixed.task };
  if (block.learnerTaskTemplate) return { ...block.learnerTaskTemplate };
  return { badge: "Young Builder", task: block.studentPrompt };
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(values: readonly T[], seed: string): T[] {
  let state = hashSeed(seed) || 0x9e3779b9;
  const result = [...values];
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function buildStudioProjection(
  course: CoursePackage,
  input: { learnerCount: number; blockId: string; seed: string },
): StudioProjection {
  validateCoursePackage(course);
  const block = course.blocks.find((item) => item.id === input.blockId);
  if (!block) throw new Error(`找不到 Block ${input.blockId}。`);
  const capacity = validateCourseInstantiation(course, input.learnerCount);
  // Preview deliberately still renders an invalid N so the author can see the
  // exact missing views and repair the definition. Factory creation fails shut.
  const policy = resolveLearnerPolicy(course);
  const deck = course.decks.find((item) => item.macroStepId === block.macroStepId);
  if (!deck) throw new Error(`${block.macroStepId} 缺少卡组。`);
  const shuffled = seededShuffle(deck.cards, `${course.course.id}:${block.macroStepId}:${input.seed}`);

  const mentorViews: StudioMentorView[] = COURSE_SEAT_IDS.slice(0, 4).map((seatId, index) => {
    const authored = block.seatTasks[seatId];
    return {
      kind: "mentor",
      seatId,
      label: course.formula.fourMentors[index].name,
      mentorRole: MENTOR_CODES[index],
      activity: authored.state,
      badge: authored.badge,
      task: authored.task,
      blockId: block.id,
      privateScript: [...block.mentorScript],
    };
  });

  const learnerViews: StudioLearnerView[] = Array.from({ length: input.learnerCount }, (_, index) => {
    const seatId = `learner${String(index + 1).padStart(2, "0")}`;
    const task = taskForLearner(block, seatId);
    const start = index * policy.cardsPerLearner;
    let privateCards = shuffled.slice(start, start + policy.cardsPerLearner);
    if (privateCards.length < policy.cardsPerLearner && policy.dealPolicy === "repeat-when-needed" && shuffled.length) {
      privateCards = Array.from({ length: policy.cardsPerLearner }, (__, cardIndex) => shuffled[(start + cardIndex) % shuffled.length]);
    }
    return {
      kind: "learner",
      seatId,
      learnerNumber: index + 1,
      label: `Young Builder ${String(index + 1).padStart(2, "0")}`,
      activity: "active",
      badge: task.badge,
      task: task.task,
      blockId: block.id,
      privateCards: structuredClone(privateCards),
      prompt: block.studentPrompt,
    };
  });

  const controllerView: StudioControllerView = {
    kind: "controller",
    seatId: "controller",
    label: "课程中控",
    blockId: block.id,
    title: block.title,
    leadMentorId: block.leadMentorId,
    systemActions: [...block.systemActions],
    acceptance: [...block.evidenceGate],
    capacity,
  };
  return {
    courseId: course.course.id,
    learnerCount: input.learnerCount,
    blockId: block.id,
    mentorViews,
    learnerViews,
    controllerView,
    views: [...mentorViews, ...learnerViews, controllerView],
  };
}
