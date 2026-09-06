import googlePackage from "../../tools/live-run/live-run-script.json";
import elemePackage from "../../tools/live-run/live-run-script-eleme.json";

export const COURSE_OUTLINE_SCHEMA_VERSION = 1;
export const COURSE_OUTLINE_CHJ_SHA = "679213a61b835335016eac7649213983a0e48489";

export type CourseOutlineGameMode = {
  id: string;
  name: string;
  purpose: string;
};

export type CourseOutlineMentor = {
  id: string;
  code: string;
  name: string;
  promise: string;
  roomDuty: string;
};

export type CourseOutlineBlock = {
  id: string;
  order: number;
  title: string;
  leadMentorId: string;
  leadMentorName: string;
  suggestedMinutes: number;
  gameModes: CourseOutlineGameMode[];
  historyTrack: string;
  realityTrack: string;
  studentPrompt: string;
  learnerLens: {
    world: string;
    say: string;
    ask: string;
    done: string;
  };
};

export type CourseOutlineStep = {
  id: string;
  order: number;
  name: string;
  question: string;
  output: string;
  exitGate: string;
  mentorSequence: CourseOutlineMentor[];
  blocks: CourseOutlineBlock[];
};

export type CourseOutlineCourse = {
  schemaVersion: number;
  id: string;
  name: string;
  period: string;
  description: string;
  coverage: string;
  learnerName: string;
  caseName: string;
  caseWhy: string;
  revision: number;
  lifecycle: "Released";
  digest: string;
  sourceCount: number;
  cardCount: number;
  deckCount: number;
  formula: {
    oneWorld: string;
    twoDualTracks: string[];
    threeGameModes: CourseOutlineGameMode[];
    fourMentors: CourseOutlineMentor[];
    sixMinuteDemo: string;
  };
  steps: CourseOutlineStep[];
};

type CoursePackage = {
  schemaVersion: number;
  course: {
    id: string;
    name: string;
    period: string;
    coverage: string;
    description: string;
    learnerName: string;
    macroStepCount: number;
    blockCount: number;
    completeFiveStep: boolean;
  };
  case: { name: string; why: string };
  sources: unknown[];
  decks: Array<{ cards: unknown[] }>;
  formula: {
    oneWorld: string;
    twoDualTracks: string[];
    threeGameModes: CourseOutlineGameMode[];
    fourMentors: CourseOutlineMentor[];
    fiveSteps: Array<{ id: string; output: string }>;
    sixMinuteDemo: string;
  };
  macroSteps: Array<{
    id: string;
    order: number;
    name: string;
    mentorSequence: string[];
    question: string;
    exitGate: string;
    blocks: string[];
  }>;
  blocks: Array<{
    id: string;
    order: number;
    macroStepId: string;
    title: string;
    leadMentorId: string;
    suggestedMinutes: number;
    gameModes: string[];
    historyTrack: string;
    realityTrack: string;
    studentPrompt: string;
    learnerLens: CourseOutlineBlock["learnerLens"];
  }>;
};

const bundledPackages = [
  elemePackage as CoursePackage,
  googlePackage as CoursePackage,
];

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortKeys(child)]),
    );
  }
  return value;
}

export function canonicalCoursePackage(value: unknown) {
  return `${JSON.stringify(sortKeys(value))}\n`;
}

export async function digestCoursePackage(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalCoursePackage(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requirePackageShape(value: CoursePackage) {
  const expectedSteps = ["find", "decide", "build", "market", "operate"];
  const expectedNames = ["找真问题", "定真方案", "做真产品", "进真市场", "跑真运营"];
  const steps = [...value.macroSteps].sort((left, right) => left.order - right.order);
  const blocks = [...value.blocks].sort((left, right) => left.order - right.order);

  if (
    value.course.macroStepCount !== 5
    || value.course.blockCount !== 13
    || value.course.completeFiveStep !== true
    || steps.length !== 5
    || blocks.length !== 13
    || steps.some((step, index) => step.id !== expectedSteps[index] || step.name !== expectedNames[index])
  ) {
    throw new Error(`课程包 ${value.course.id} 不满足统一五步／13 Block 大纲契约。`);
  }
}

async function projectPackage(value: CoursePackage): Promise<CourseOutlineCourse> {
  requirePackageShape(value);
  const mentors = new Map(value.formula.fourMentors.map((mentor) => [mentor.id, mentor]));
  const gameModes = new Map(value.formula.threeGameModes.map((mode) => [mode.id, mode]));
  const outputs = new Map(value.formula.fiveSteps.map((step) => [step.id, step.output]));
  const blocksById = new Map(value.blocks.map((block) => [block.id, block]));

  return {
    schemaVersion: value.schemaVersion,
    id: value.course.id,
    name: value.course.name,
    period: value.course.period,
    description: value.course.description,
    coverage: value.course.coverage,
    learnerName: value.course.learnerName,
    caseName: value.case.name,
    caseWhy: value.case.why,
    // Bundled files are revision 0 in CourseRepository and are the released
    // baseline when no authored published revision overrides them.
    revision: 0,
    lifecycle: "Released",
    digest: await digestCoursePackage(value),
    sourceCount: value.sources.length,
    cardCount: value.decks.reduce((total, deck) => total + deck.cards.length, 0),
    deckCount: value.decks.length,
    formula: {
      oneWorld: value.formula.oneWorld,
      twoDualTracks: value.formula.twoDualTracks,
      threeGameModes: value.formula.threeGameModes,
      fourMentors: value.formula.fourMentors,
      sixMinuteDemo: value.formula.sixMinuteDemo,
    },
    steps: [...value.macroSteps]
      .sort((left, right) => left.order - right.order)
      .map((step) => ({
        id: step.id,
        order: step.order,
        name: step.name,
        question: step.question,
        output: outputs.get(step.id) ?? "完成本步可验收成果",
        exitGate: step.exitGate,
        mentorSequence: step.mentorSequence.map((mentorId) => {
          const mentor = mentors.get(mentorId);
          if (!mentor) throw new Error(`课程包 ${value.course.id} 引用了未知导师 ${mentorId}。`);
          return mentor;
        }),
        blocks: step.blocks.map((blockId) => {
          const block = blocksById.get(blockId);
          if (!block) throw new Error(`课程包 ${value.course.id} 引用了未知 Block ${blockId}。`);
          const leadMentor = mentors.get(block.leadMentorId);
          if (!leadMentor) throw new Error(`课程包 ${value.course.id} 引用了未知导师 ${block.leadMentorId}。`);
          return {
            id: block.id,
            order: block.order,
            title: block.title,
            leadMentorId: block.leadMentorId,
            leadMentorName: leadMentor.name,
            suggestedMinutes: block.suggestedMinutes,
            gameModes: block.gameModes.map((modeId) => {
              const mode = gameModes.get(modeId);
              if (!mode) throw new Error(`课程包 ${value.course.id} 引用了未知玩法 ${modeId}。`);
              return mode;
            }),
            historyTrack: block.historyTrack,
            realityTrack: block.realityTrack,
            studentPrompt: block.studentPrompt,
            learnerLens: block.learnerLens,
          };
        }),
      })),
  };
}

export async function getReleasedCourseOutline(): Promise<CourseOutlineCourse[]> {
  return Promise.all(bundledPackages.map(projectPackage));
}
