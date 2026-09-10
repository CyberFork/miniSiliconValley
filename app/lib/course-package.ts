import googleCoursePackage from "../../tools/live-run/live-run-script.json";
import elemeCoursePackage from "../../tools/live-run/live-run-script-eleme.json";
import type {
  CampaignStage,
  ClassroomAssetDefinition,
  ClassroomCampaign,
  ClassroomChapter,
  ClassroomInfoCard,
  ClassroomSource,
  PDMORole,
} from "./classroom-model";
import { validateCourseFieldModel, type CourseFieldModel } from "./course-field-model";

export const COURSE_PACKAGE_SCHEMA_VERSION = 1 as const;
export const COURSE_STEP_IDS = ["find", "decide", "build", "market", "operate"] as const;
export const COURSE_STEP_BLOCKS = [
  ["B01", "B02", "B03"],
  ["B04", "B05"],
  ["B06", "B07", "B08"],
  ["B09", "B10"],
  ["B11", "B12", "B13"],
] as const;
export const COURSE_DECK_DRAW_BLOCKS = ["B01", "B04", "B06", "B09", "B11"] as const;
export const COURSE_SEAT_IDS = ["mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04"] as const;
export const COURSE_API_ACTIONS = [
  "room-and-deal", "read-and-publish", "finish-find-chapter",
  "prepare-decide-value", "finish-decide-chapter", "prepare-build-mvp",
  "run-build-pressure", "finish-build-chapter", "prepare-market",
  "finish-market-chapter", "prepare-operations", "run-operations-and-freeze",
  "submit-demo-and-complete",
] as const;
export type CourseStepId = (typeof COURSE_STEP_IDS)[number];
export type EvidenceBoundary = "F" | "R" | "G" | "U";
export type CourseMentorRole = "P" | "D" | "M" | "O";
export type CourseCaseType = "historical" | "simulation";

export interface CoursePackageRef {
  courseId: string;
  schemaVersion: number;
  revision: number;
  digest: string;
  status: "candidate" | "approved" | "released";
  createdAt?: string | null;
  createdBy?: string | null;
  /** Display-only lookup for Studio conflict/history UI; never part of exact identity. */
  createdByDisplayName?: string | null;
  releasedAt?: string | null;
  releasedBy?: string | null;
  approvalRunId?: string | null;
  /** Returned by Candidate writes; not persisted as part of an exact ref. */
  fieldMigration?: import("./course-field-model").CourseFieldMigrationEntry[];
}

export interface CoursePackageCard {
  id: string;
  boundary: EvidenceBoundary;
  title: string;
  body: string;
  sharePrompt: string;
  sourceIds: string[];
  credibility?: "high" | "medium" | "low";
  simulationCategory?: "user-scene" | "system-data" | "business-rule" | "test-record" | "boundary-unknown";
}

export interface CoursePackageDeck {
  id: string;
  macroStepId: CourseStepId;
  drawAtBlockId: string;
  cardsPerLearner: number;
  /** Mirrors learnerPolicy.dealPolicy for older classroom projections. */
  uniqueDeal: boolean;
  shuffle: true;
  cards: CoursePackageCard[];
}

export interface CoursePackageStep {
  id: CourseStepId;
  order: number;
  name: string;
  mentorSequence: string[];
  question: string;
  exitGate: string;
  blocks: string[];
}

export interface CoursePackageBlock {
  id: string;
  macroStepId: CourseStepId;
  macroStepOrder: number;
  order: number;
  title: string;
  leadMentorId: "mentor01" | "mentor02" | "mentor03" | "mentor04";
  suggestedMinutes: number;
  gameModes: Array<"yarn" | "american" | "euro">;
  apiAction: string;
  underlyingClassroomPhases: string[];
  historyTrack: string;
  realityTrack: string;
  studentPrompt: string;
  mentorScript: string[];
  studentActions: string[];
  systemActions: string[];
  props: string[];
  evidenceGate: string[];
  fallback: string[];
  manualInteraction: string;
  learnerLens: { world: string; say: string; ask: string; done: string };
  /** Generic task used for learner05+ and as the authoring source for dynamic seats. */
  learnerTaskTemplate?: { badge: string; task: string };
  seatTasks: Record<string, { state: "active" | "support" | "standby"; badge: string; task: string }>;
}

export interface CourseLearnerPolicy {
  defaultCount: number;
  minCount: number;
  maxCount: number;
  cardsPerLearner: number;
  dealPolicy: "unique-within-step" | "repeat-when-needed";
}

/**
 * Optional, additive content ownership metadata introduced by T-091.
 *
 * Legacy immutable schema-v1 releases intentionally omit this object. New
 * Candidates can declare a source-backed historical CasePackage, the mentor
 * ScriptPackage that teaches it, coarse courseware checkpoints and structured
 * hand-off artifacts without copying any card or Block body into a second
 * truth source.
 */
export interface CourseCasePackage {
  id: string;
  caseId: string;
  /** Historical packages cite sources; simulations must remain source-free. */
  caseType: CourseCaseType;
  title: string;
  ownerMentorRole: CourseMentorRole;
  scope: string;
  evidenceRevision: string;
  sourceIds: string[];
  factCardIds: string[];
}

export interface CourseContentCoursewareRef {
  mentorRole: CourseMentorRole;
  packageId: string;
  slug: string;
  revision: number;
  digest: string;
  sourceCommit?: string;
  sourceTree?: string;
}

export interface CourseScriptCheckpoint {
  id: string;
  title: string;
  purpose: string;
  blockIds: string[];
  coursewareCue: { label: string; slideStart: number; slideEnd: number };
  privateDeckIds: string[];
  publicEvents: string[];
  submissionSchemaIds: string[];
}

export interface CourseScriptPackage {
  id: string;
  title: string;
  casePackageId: string;
  ownerMentorRole: CourseMentorRole;
  coursewareRef: CourseContentCoursewareRef;
  checkpoints: CourseScriptCheckpoint[];
  mentorRubric: string[];
  handoff?: {
    fromBlockId: string;
    availableAtBlockId: string;
    toMentorRole: CourseMentorRole;
    submissionSchemaId: string;
    summary: string;
  };
}

export type CourseSubmissionFieldInput = "short-text" | "long-text" | "list";
export interface CourseSubmissionField {
  id: string;
  label: string;
  learnerPrompt: string;
  mentorPrompt: string;
  input: CourseSubmissionFieldInput;
  required: boolean;
  minLength: number;
  maxLength: number;
  minItems?: number;
  maxItems?: number;
}

export interface CourseSubmissionSchema {
  id: string;
  kind: string;
  name: string;
  learnerIntro: string;
  ownerMentorRole: CourseMentorRole;
  submitAtBlockId: string;
  fields: CourseSubmissionField[];
  mentorRubric: string[];
}

export interface CourseContentReviewItem {
  id: string;
  status: "open" | "resolved";
  category: "source-boundary" | "courseware-version" | "curriculum" | "routing";
  location: string;
  title: string;
  reason: string;
  recommendedAction: string;
}

export interface CourseContentPackages {
  casePackages: CourseCasePackage[];
  scriptPackages: CourseScriptPackage[];
  submissionSchemas: CourseSubmissionSchema[];
  reviewQueue: CourseContentReviewItem[];
}

export interface CoursePackage {
  schemaVersion: typeof COURSE_PACKAGE_SCHEMA_VERSION;
  id: string;
  title: string;
  course: {
    id: string;
    name: string;
    period: string;
    coverage: string;
    description: string;
    learnerName: string;
    scriptId: string;
    macroStepCount: 5;
    blockCount: 13;
    completeFiveStep: true;
  };
  case: { campaignId: string; name: string; learnerName: string; period: string; why: string };
  /**
   * Optional only for immutable schema-v1 releases created before T-085.
   * Runtime code resolves those releases to a safe 2—4 learner policy without
   * rewriting their signed JSON or digest.
   */
  learnerPolicy?: CourseLearnerPolicy;
  sources: ClassroomSource[];
  decks: CoursePackageDeck[];
  formula: {
    oneWorld: string;
    twoDualTracks: string[];
    threeGameModes: Array<{ id: string; name: string; purpose: string }>;
    fourMentors: Array<{ id: string; code: PDMORole; name: string; promise: string; roomDuty: string }>;
    fiveSteps: Array<{ id: CourseStepId; order: number; name: string; lead: string; output: string }>;
    sixMinuteDemo: string;
  };
  macroSteps: CoursePackageStep[];
  blocks: CoursePackageBlock[];
  rules: Record<string, unknown>;
  contentPackages?: CourseContentPackages;
  /**
   * Ownership/index contract for the actual editable values above. Legacy
   * immutable releases omit it; every newly saved Candidate is normalized to
   * include it before its digest is calculated.
   */
  fieldModel?: CourseFieldModel;
  authoring?: Record<string, unknown>;
}

const BUNDLED_COURSE_PACKAGES = [googleCoursePackage, elemeCoursePackage] as unknown[];

export function bundledCoursePackages(): CoursePackage[] {
  return BUNDLED_COURSE_PACKAGES.map((value) => validateCoursePackage(structuredClone(value)));
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} 必须是对象。`);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} 必须是非空文本。`);
  return value;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} 必须是数组。`);
  return value;
}

function textArray(value: unknown, path: string, allowEmpty = false): string[] {
  const values = array(value, path);
  if (!allowEmpty && values.length === 0) throw new Error(`${path} 不能为空。`);
  return values.map((item, index) => text(item, `${path}[${index}]`));
}

function exactArray(actual: readonly string[], expected: readonly string[], path: string): void {
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
    throw new Error(`${path} 必须严格为 ${expected.join(" → ")}。`);
  }
}

/** Runtime-side guard for the exact Course Package accepted from the editor. */
export function validateCoursePackage(value: unknown): CoursePackage {
  const root = record(value, "$" );
  for (const key of ["schemaVersion", "id", "title", "course", "case", "sources", "decks", "formula", "macroSteps", "blocks", "rules"]) {
    if (!(key in root)) throw new Error(`$.${key} 为必填字段。`);
  }
  if (root.schemaVersion !== COURSE_PACKAGE_SCHEMA_VERSION) throw new Error("$.schemaVersion 必须为 1。");
  text(root.id, "$.id");
  text(root.title, "$.title");
  const course = record(root.course, "$.course");
  const courseId = text(course.id, "$.course.id");
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(courseId)) throw new Error("$.course.id 格式无效。");
  for (const key of ["name", "period", "coverage", "description", "learnerName", "scriptId"]) text(course[key], `$.course.${key}`);
  if (course.macroStepCount !== 5 || course.blockCount !== 13 || course.completeFiveStep !== true) {
    throw new Error("Course Package 必须完整包含五步骤与十三个 Block。");
  }

  const caseValue = record(root.case, "$.case");
  for (const key of ["campaignId", "name", "learnerName", "period", "why"]) text(caseValue[key], `$.case.${key}`);
  const campaignId = String(caseValue.campaignId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(campaignId)) throw new Error("$.case.campaignId 格式无效。");
  if (campaignId !== courseId) throw new Error("$.case.campaignId 必须与 $.course.id 一致，避免课程与案例真值错配。");

  const learnerPolicy = root.learnerPolicy === undefined
    ? { defaultCount: 4, minCount: 2, maxCount: 4, cardsPerLearner: 3, dealPolicy: "unique-within-step" as const }
    : record(root.learnerPolicy, "$.learnerPolicy");
  for (const key of ["defaultCount", "minCount", "maxCount", "cardsPerLearner"]) {
    if (!Number.isInteger(learnerPolicy[key])) throw new Error(`$.learnerPolicy.${key} 必须是整数。`);
  }
  const minLearners = Number(learnerPolicy.minCount);
  const maxLearners = Number(learnerPolicy.maxCount);
  const defaultLearners = Number(learnerPolicy.defaultCount);
  const cardsPerLearner = Number(learnerPolicy.cardsPerLearner);
  if (minLearners < 1 || maxLearners > 24 || minLearners > maxLearners || defaultLearners < minLearners || defaultLearners > maxLearners) {
    throw new Error("$.learnerPolicy 人数范围无效。");
  }
  if (cardsPerLearner < 1 || cardsPerLearner > 12) throw new Error("$.learnerPolicy.cardsPerLearner 必须为 1—12。");
  if (!new Set(["unique-within-step", "repeat-when-needed"]).has(String(learnerPolicy.dealPolicy))) {
    throw new Error("$.learnerPolicy.dealPolicy 无效。");
  }

  const sources = array(root.sources, "$.sources");
  if (!sources.length) throw new Error("$.sources 不能为空。");
  const sourceIds = new Set<string>();
  for (const [index, raw] of sources.entries()) {
    const source = record(raw, `$.sources[${index}]`);
    for (const key of ["id", "title", "organization", "url", "kind", "accessed"]) text(source[key], `$.sources[${index}].${key}`);
    try {
      const url = new URL(String(source.url));
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      throw new Error(`$.sources[${index}].url 必须是绝对 http(s) 地址。`);
    }
    const id = String(source.id);
    if (sourceIds.has(id)) throw new Error(`来源 ID 重复：${id}`);
    sourceIds.add(id);
  }

  const steps = array(root.macroSteps, "$.macroSteps");
  const blocks = array(root.blocks, "$.blocks");
  const decks = array(root.decks, "$.decks");
  if (steps.length !== 5 || blocks.length !== 13 || decks.length !== 5) throw new Error("课程必须是 5 步 / 13 块 / 5 卡组。");
  const blockIds = new Set<string>();
  for (const [index, raw] of blocks.entries()) {
    const block = record(raw, `$.blocks[${index}]`);
    const expected = `B${String(index + 1).padStart(2, "0")}`;
    if (block.id !== expected || block.order !== index + 1) throw new Error(`Block 顺序必须为 ${expected}。`);
    const stepIndex = COURSE_STEP_BLOCKS.findIndex((ids) => (ids as readonly string[]).includes(expected));
    if (block.macroStepId !== COURSE_STEP_IDS[stepIndex] || block.macroStepOrder !== stepIndex + 1) {
      throw new Error(`$.blocks[${index}] 的大步骤映射无效。`);
    }
    if (block.apiAction !== COURSE_API_ACTIONS[index]) throw new Error(`$.blocks[${index}].apiAction 必须为 ${COURSE_API_ACTIONS[index]}。`);
    if (!(COURSE_SEAT_IDS.slice(0, 4) as readonly unknown[]).includes(block.leadMentorId)) throw new Error(`$.blocks[${index}].leadMentorId 无效。`);
    if (!Number.isInteger(block.suggestedMinutes) || Number(block.suggestedMinutes) < 1 || Number(block.suggestedMinutes) > 180) {
      throw new Error(`$.blocks[${index}].suggestedMinutes 必须为 1—180 的整数。`);
    }
    blockIds.add(expected);
    for (const key of ["title", "historyTrack", "realityTrack", "studentPrompt", "manualInteraction"]) text(block[key], `$.blocks[${index}].${key}`);
    const gameModes = textArray(block.gameModes, `$.blocks[${index}].gameModes`);
    if (gameModes.some((mode) => !new Set(["yarn", "american", "euro"]).has(mode)) || new Set(gameModes).size !== gameModes.length) {
      throw new Error(`$.blocks[${index}].gameModes 只能包含不重复的 yarn / american / euro。`);
    }
    textArray(block.underlyingClassroomPhases, `$.blocks[${index}].underlyingClassroomPhases`);
    for (const key of ["mentorScript", "studentActions", "systemActions", "props", "evidenceGate", "fallback"]) {
      textArray(block[key], `$.blocks[${index}].${key}`);
    }
    const lens = record(block.learnerLens, `$.blocks[${index}].learnerLens`);
    for (const key of ["world", "say", "ask", "done"]) text(lens[key], `$.blocks[${index}].learnerLens.${key}`);
    if (block.learnerTaskTemplate !== undefined) {
      const template = record(block.learnerTaskTemplate, `$.blocks[${index}].learnerTaskTemplate`);
      text(template.badge, `$.blocks[${index}].learnerTaskTemplate.badge`);
      text(template.task, `$.blocks[${index}].learnerTaskTemplate.task`);
    }
    const seatTasks = record(block.seatTasks, `$.blocks[${index}].seatTasks`);
    const modeledLearnerSeats = root.fieldModel === undefined
      ? COURSE_SEAT_IDS.slice(4)
      : Array.from({ length: Math.max(
        maxLearners,
        ...Object.keys(seatTasks).map((seatId) => /^learner(\d{2})$/.exec(seatId)).filter(Boolean).map((match) => Number(match![1])),
      ) }, (_, learnerIndex) => `learner${String(learnerIndex + 1).padStart(2, "0")}`);
    const expectedSeatIds = [...COURSE_SEAT_IDS.slice(0, 4), ...modeledLearnerSeats];
    exactArray(Object.keys(seatTasks).sort(), [...expectedSeatIds].sort(), `$.blocks[${index}].seatTasks keys`);
    for (const seatId of expectedSeatIds) {
      const task = record(seatTasks[seatId], `$.blocks[${index}].seatTasks.${seatId}`);
      if (!new Set(["active", "support", "standby"]).has(String(task.state))) throw new Error(`$.blocks[${index}].seatTasks.${seatId}.state 无效。`);
      text(task.badge, `$.blocks[${index}].seatTasks.${seatId}.badge`);
      text(task.task, `$.blocks[${index}].seatTasks.${seatId}.task`);
    }
    const activeMentors = COURSE_SEAT_IDS.slice(0, 4).filter((seatId) => record(seatTasks[seatId], "seatTask").state === "active");
    exactArray(activeMentors, [String(block.leadMentorId)], `$.blocks[${index}].seatTasks active mentor`);
  }
  const allCardIds = new Set<string>();
  for (const [index, raw] of decks.entries()) {
    const deck = record(raw, `$.decks[${index}]`);
    const expectsUniqueDeal = learnerPolicy.dealPolicy === "unique-within-step";
    if (deck.macroStepId !== COURSE_STEP_IDS[index] || deck.cardsPerLearner !== cardsPerLearner || deck.uniqueDeal !== expectsUniqueDeal || deck.shuffle !== true) {
      throw new Error(`第 ${index + 1} 个卡组不符合课程的随机发牌契约。`);
    }
    text(deck.id, `$.decks[${index}].id`);
    if (deck.drawAtBlockId !== COURSE_DECK_DRAW_BLOCKS[index]) throw new Error(`第 ${index + 1} 个卡组必须在 ${COURSE_DECK_DRAW_BLOCKS[index]} 抽取。`);
    const cards = array(deck.cards, `$.decks[${index}].cards`);
    const baselineCards = expectsUniqueDeal ? minLearners * cardsPerLearner : 1;
    if (cards.length < baselineCards) throw new Error(`第 ${index + 1} 个卡组少于最低开课人数所需的 ${baselineCards} 张卡。`);
    for (const [cardIndex, rawCard] of cards.entries()) {
      const card = record(rawCard, `$.decks[${index}].cards[${cardIndex}]`);
      const cardId = text(card.id, `$.decks[${index}].cards[${cardIndex}].id`);
      if (allCardIds.has(cardId)) throw new Error(`卡牌 ID 重复：${cardId}`);
      allCardIds.add(cardId);
      if (!new Set(["F", "R", "G", "U"]).has(String(card.boundary))) throw new Error(`卡牌 ${cardId} 缺少有效 F/R/G/U 边界。`);
      for (const key of ["title", "body", "sharePrompt"]) text(card[key], `card:${cardId}.${key}`);
      const refs = textArray(card.sourceIds, `card:${cardId}.sourceIds`, true);
      if (card.boundary === "F" && !refs.length) throw new Error(`事实卡 ${cardId} 必须引用来源。`);
      for (const sourceId of refs) if (!sourceIds.has(String(sourceId))) throw new Error(`卡牌 ${cardId} 引用了未知来源 ${String(sourceId)}。`);
      if (card.credibility !== undefined && !new Set(["high", "medium", "low"]).has(String(card.credibility))) throw new Error(`卡牌 ${cardId}.credibility 无效。`);
      if (card.simulationCategory !== undefined) {
        if (card.boundary !== "R" || refs.length) throw new Error(`卡牌 ${cardId}.simulationCategory 只能用于无来源的 R 课堂模拟卡。`);
        if (!new Set(["user-scene", "system-data", "business-rule", "test-record", "boundary-unknown"]).has(String(card.simulationCategory))) {
          throw new Error(`卡牌 ${cardId}.simulationCategory 无效。`);
        }
      }
    }
  }
  for (const [index, raw] of steps.entries()) {
    const step = record(raw, `$.macroSteps[${index}]`);
    if (step.id !== COURSE_STEP_IDS[index] || step.order !== index + 1) throw new Error("五步骤 ID 或顺序无效。");
    for (const key of ["name", "question", "exitGate"]) text(step[key], `$.macroSteps[${index}].${key}`);
    const mentors = textArray(step.mentorSequence, `$.macroSteps[${index}].mentorSequence`);
    if (mentors.some((mentor) => !(COURSE_SEAT_IDS.slice(0, 4) as readonly string[]).includes(mentor))) throw new Error(`步骤 ${String(step.id)} 包含未知导师席。`);
    const refs = textArray(step.blocks, `$.macroSteps[${index}].blocks`);
    exactArray(refs, COURSE_STEP_BLOCKS[index], `$.macroSteps[${index}].blocks`);
    if (refs.some((id) => !blockIds.has(id))) throw new Error(`步骤 ${String(step.id)} 引用了未知 Block。`);
  }
  const formula = record(root.formula, "$.formula");
  text(formula.oneWorld, "$.formula.oneWorld");
  if (textArray(formula.twoDualTracks, "$.formula.twoDualTracks").length !== 2) throw new Error("课程总纲必须包含两条双轨。" );
  const modes = array(formula.threeGameModes, "$.formula.threeGameModes").map((item, index) => record(item, `$.formula.threeGameModes[${index}]`));
  exactArray(modes.map((item) => String(item.id)), ["yarn", "american", "euro"], "$.formula.threeGameModes ids");
  for (const [index, mode] of modes.entries()) for (const key of ["name", "purpose"]) text(mode[key], `$.formula.threeGameModes[${index}].${key}`);
  const mentorItems = array(formula.fourMentors, "$.formula.fourMentors").map((item, index) => record(item, `$.formula.fourMentors[${index}]`));
  exactArray(mentorItems.map((item) => String(item.id)), COURSE_SEAT_IDS.slice(0, 4), "$.formula.fourMentors ids");
  exactArray(mentorItems.map((item) => String(item.code)), ["P", "D", "M", "O"], "$.formula.fourMentors codes");
  for (const [index, mentor] of mentorItems.entries()) for (const key of ["name", "promise", "roomDuty"]) text(mentor[key], `$.formula.fourMentors[${index}].${key}`);
  const formulaSteps = array(formula.fiveSteps, "$.formula.fiveSteps").map((item, index) => record(item, `$.formula.fiveSteps[${index}]`));
  exactArray(formulaSteps.map((item) => String(item.id)), COURSE_STEP_IDS, "$.formula.fiveSteps ids");
  for (const [index, step] of formulaSteps.entries()) {
    if (step.order !== index + 1) throw new Error(`$.formula.fiveSteps[${index}].order 无效。`);
    for (const key of ["name", "lead", "output"]) text(step[key], `$.formula.fiveSteps[${index}].${key}`);
  }
  text(formula.sixMinuteDemo, "$.formula.sixMinuteDemo");

  const rules = record(root.rules, "$.rules");
  const requiredRules: Record<string, unknown> = {
    manualAdvance: true,
    courseSwitch: "new-run-only",
    studentPdmo: "none-by-default",
    cardDeal: "random-independent-of-identity",
    singleSpotlightMentor: true,
  };
  for (const [key, expected] of Object.entries(requiredRules)) if (rules[key] !== expected) throw new Error(`$.rules.${key} 必须为 ${JSON.stringify(expected)}。`);
  exactArray(textArray(rules.executionStates, "$.rules.executionStates"), ["ready", "executing", "awaiting-acceptance", "error", "completed"], "$.rules.executionStates");
  text(rules.historyBoundary, "$.rules.historyBoundary");
  if (root.contentPackages !== undefined) {
    validateContentPackages(root.contentPackages, {
      courseId,
      sourceIds,
      blockIds,
      deckIds: new Set(decks.map((raw, index) => text(record(raw, `$.decks[${index}]`).id, `$.decks[${index}].id`))),
      deckCardIdsById: new Map(decks.map((raw, deckIndex) => {
        const deck = record(raw, `$.decks[${deckIndex}]`);
        return [
          text(deck.id, `$.decks[${deckIndex}].id`),
          array(deck.cards, `$.decks[${deckIndex}].cards`).map((rawCard, cardIndex) => text(record(rawCard, `$.decks[${deckIndex}].cards[${cardIndex}]`).id, `$.decks[${deckIndex}].cards[${cardIndex}].id`)),
        ] as const;
      })),
      cardsById: new Map(decks.flatMap((raw, deckIndex) => {
        const deck = record(raw, `$.decks[${deckIndex}]`);
        return array(deck.cards, `$.decks[${deckIndex}].cards`).map((rawCard, cardIndex) => {
          const card = record(rawCard, `$.decks[${deckIndex}].cards[${cardIndex}]`);
          return [String(card.id), {
            boundary: String(card.boundary),
            sourceIds: textArray(card.sourceIds, `$.decks[${deckIndex}].cards[${cardIndex}].sourceIds`, true),
          }] as const;
        });
      })),
    });
  }
  if (root.fieldModel !== undefined) {
    validateCourseFieldModel(value as CoursePackage, root.fieldModel as unknown as CourseFieldModel);
  }
  if (root.authoring !== undefined) {
    const authoring = record(root.authoring, "$.authoring");
    if (authoring.status !== undefined && !new Set(["draft", "published", "candidate", "released", "retired"]).has(String(authoring.status))) throw new Error("$.authoring.status 无效。" );
    if (authoring.revision !== undefined && (!Number.isInteger(authoring.revision) || Number(authoring.revision) < 0)) throw new Error("$.authoring.revision 必须为非负整数。" );
  }
  return value as CoursePackage;
}

function validateContentPackages(
  value: unknown,
  refs: {
    courseId: string;
    sourceIds: Set<string>;
    blockIds: Set<string>;
    deckIds: Set<string>;
    deckCardIdsById: Map<string, string[]>;
    cardsById: Map<string, { boundary: string; sourceIds: string[] }>;
  },
): void {
  const root = record(value, "$.contentPackages");
  for (const key of ["casePackages", "scriptPackages", "submissionSchemas", "reviewQueue"]) {
    if (!(key in root)) throw new Error(`$.contentPackages.${key} 为必填字段。`);
  }
  const roles = new Set<CourseMentorRole>(["P", "D", "M", "O"]);
  const identifier = (raw: unknown, path: string) => {
    const result = text(raw, path);
    if (!/^[a-z0-9][a-z0-9-]{1,95}$/.test(result)) throw new Error(`${path} 只能使用小写字母、数字和连字符。`);
    return result;
  };
  const role = (raw: unknown, path: string) => {
    if (!roles.has(raw as CourseMentorRole)) throw new Error(`${path} 必须是 P、D、M 或 O。`);
    return raw as CourseMentorRole;
  };
  const unique = (values: string[], path: string) => {
    if (new Set(values).size !== values.length) throw new Error(`${path} 不能包含重复项。`);
  };

  const rawCases = array(root.casePackages, "$.contentPackages.casePackages");
  if (!rawCases.length) throw new Error("$.contentPackages.casePackages 不能为空。");
  const caseIds = new Set<string>();
  const caseOwners = new Map<string, CourseMentorRole>();
  const caseTypes = new Map<string, CourseCaseType>();
  const declaredFactCards = new Set<string>();
  for (const [index, raw] of rawCases.entries()) {
    const path = `$.contentPackages.casePackages[${index}]`;
    const item = record(raw, path);
    const id = identifier(item.id, `${path}.id`);
    if (caseIds.has(id)) throw new Error(`${path}.id 重复。`);
    caseIds.add(id);
    const caseId = identifier(item.caseId, `${path}.caseId`);
    if (!new Set(["historical", "simulation"]).has(String(item.caseType))) {
      throw new Error(`${path}.caseType 必须是 historical 或 simulation。`);
    }
    const caseType = item.caseType as CourseCaseType;
    caseTypes.set(id, caseType);
    if (caseType === "historical" && caseId !== refs.courseId) {
      throw new Error(`${path}.caseId 必须与课程 ID 一致，避免史实案例真值错配。`);
    }
    text(item.title, `${path}.title`);
    const caseOwner = role(item.ownerMentorRole, `${path}.ownerMentorRole`);
    caseOwners.set(id, caseOwner);
    text(item.scope, `${path}.scope`);
    if (!/^sha256:[0-9a-f]{64}$/.test(text(item.evidenceRevision, `${path}.evidenceRevision`))) {
      throw new Error(`${path}.evidenceRevision 必须是 sha256:<64位小写摘要>。`);
    }
    const sources = textArray(item.sourceIds, `${path}.sourceIds`, caseType === "simulation");
    unique(sources, `${path}.sourceIds`);
    for (const sourceId of sources) if (!refs.sourceIds.has(sourceId)) throw new Error(`${path}.sourceIds 引用了未知来源 ${sourceId}。`);
    const caseSources = new Set(sources);
    const factCards = textArray(item.factCardIds, `${path}.factCardIds`, caseType === "simulation");
    unique(factCards, `${path}.factCardIds`);
    if (caseType === "simulation" && (sources.length || factCards.length)) {
      throw new Error(`${path} 是课堂模拟，sourceIds 与 factCardIds 必须为空，不能伪装成来源史实。`);
    }
    for (const cardId of factCards) {
      if (declaredFactCards.has(cardId)) throw new Error(`${path}.factCardIds 的 ${cardId} 已由另一个 CasePackage 声明。`);
      declaredFactCards.add(cardId);
      if (!refs.cardsById.has(cardId)) throw new Error(`${path}.factCardIds 引用了未知卡牌 ${cardId}。`);
      const card = refs.cardsById.get(cardId)!;
      if (card.boundary !== "F") throw new Error(`${path}.factCardIds 的 ${cardId} 不是 F 来源事实卡。`);
      for (const sourceId of card.sourceIds) {
        if (!caseSources.has(sourceId)) throw new Error(`${path}.factCardIds 的 ${cardId} 使用了 CasePackage 未声明的来源 ${sourceId}。`);
      }
    }
  }
  const undeclaredFacts = [...refs.cardsById.entries()]
    .filter(([, card]) => card.boundary === "F")
    .map(([cardId]) => cardId)
    .filter((cardId) => !declaredFactCards.has(cardId));
  if (undeclaredFacts.length) throw new Error(`$.contentPackages.casePackages 未归档 F 卡：${undeclaredFacts.join("、")}。`);

  const rawSchemas = array(root.submissionSchemas, "$.contentPackages.submissionSchemas");
  const schemaIds = new Set<string>();
  const schemaKinds = new Set<string>();
  const schemaOwners = new Map<string, CourseMentorRole>();
  const schemaBlocks = new Map<string, string>();
  const schemaSubmitBlocks = new Set<string>();
  for (const [index, raw] of rawSchemas.entries()) {
    const path = `$.contentPackages.submissionSchemas[${index}]`;
    const item = record(raw, path);
    const id = identifier(item.id, `${path}.id`);
    if (schemaIds.has(id)) throw new Error(`${path}.id 重复。`);
    schemaIds.add(id);
    const kind = identifier(item.kind, `${path}.kind`);
    if (schemaKinds.has(kind)) throw new Error(`${path}.kind 重复；结构化作品 kind 必须唯一。`);
    schemaKinds.add(kind);
    text(item.name, `${path}.name`);
    text(item.learnerIntro, `${path}.learnerIntro`);
    const schemaOwner = role(item.ownerMentorRole, `${path}.ownerMentorRole`);
    schemaOwners.set(id, schemaOwner);
    const submitAt = text(item.submitAtBlockId, `${path}.submitAtBlockId`);
    if (!refs.blockIds.has(submitAt)) throw new Error(`${path}.submitAtBlockId 引用了未知 Block。`);
    if (schemaSubmitBlocks.has(submitAt)) throw new Error(`${path}.submitAtBlockId 重复；每个 Block 只能有一个结构化交付物。`);
    schemaSubmitBlocks.add(submitAt);
    schemaBlocks.set(id, submitAt);
    const fields = array(item.fields, `${path}.fields`);
    if (!fields.length) throw new Error(`${path}.fields 不能为空。`);
    const fieldIds = new Set<string>();
    for (const [fieldIndex, rawField] of fields.entries()) {
      const fieldPath = `${path}.fields[${fieldIndex}]`;
      const field = record(rawField, fieldPath);
      const fieldId = identifier(field.id, `${fieldPath}.id`);
      if (fieldIds.has(fieldId)) throw new Error(`${fieldPath}.id 重复。`);
      fieldIds.add(fieldId);
      for (const key of ["label", "learnerPrompt", "mentorPrompt"]) text(field[key], `${fieldPath}.${key}`);
      if (!new Set(["short-text", "long-text", "list"]).has(String(field.input))) throw new Error(`${fieldPath}.input 无效。`);
      if (typeof field.required !== "boolean") throw new Error(`${fieldPath}.required 必须是布尔值。`);
      if (!Number.isInteger(field.minLength) || !Number.isInteger(field.maxLength)
        || Number(field.minLength) < 0 || Number(field.maxLength) < Number(field.minLength) || Number(field.maxLength) > 4_000) {
        throw new Error(`${fieldPath} 的长度范围无效。`);
      }
      if (field.minItems !== undefined || field.maxItems !== undefined) {
        if (field.input !== "list") throw new Error(`${fieldPath}.minItems/maxItems 只能用于 list 字段。`);
        const minItems = Number(field.minItems ?? 0);
        const maxItems = Number(field.maxItems ?? 100);
        if (!Number.isInteger(minItems) || !Number.isInteger(maxItems) || minItems < 0 || maxItems < minItems || maxItems > 100) {
          throw new Error(`${fieldPath} 的条目数量范围无效。`);
        }
      }
    }
    textArray(item.mentorRubric, `${path}.mentorRubric`);
  }

  const rawScripts = array(root.scriptPackages, "$.contentPackages.scriptPackages");
  if (!rawScripts.length) throw new Error("$.contentPackages.scriptPackages 不能为空。");
  const scriptIds = new Set<string>();
  const globallyOwnedCheckpointBlocks = new Set<string>();
  for (const [index, raw] of rawScripts.entries()) {
    const path = `$.contentPackages.scriptPackages[${index}]`;
    const item = record(raw, path);
    const id = identifier(item.id, `${path}.id`);
    if (scriptIds.has(id)) throw new Error(`${path}.id 重复。`);
    scriptIds.add(id);
    text(item.title, `${path}.title`);
    const casePackageId = identifier(item.casePackageId, `${path}.casePackageId`);
    if (!caseIds.has(casePackageId)) throw new Error(`${path}.casePackageId 引用了未知 CasePackage。`);
    const ownerRole = role(item.ownerMentorRole, `${path}.ownerMentorRole`);
    if (caseOwners.get(casePackageId) !== ownerRole) throw new Error(`${path}.ownerMentorRole 必须与 CasePackage 内容所有者一致。`);
    if (caseTypes.get(casePackageId) === "simulation") {
      const privateDeckIds = array(item.checkpoints, `${path}.checkpoints`).flatMap((rawCheckpoint, checkpointIndex) => {
        const checkpoint = record(rawCheckpoint, `${path}.checkpoints[${checkpointIndex}]`);
        return textArray(checkpoint.privateDeckIds, `${path}.checkpoints[${checkpointIndex}].privateDeckIds`, true);
      });
      if (!privateDeckIds.length) throw new Error(`${path} 的课堂模拟必须声明至少一个私密卡组。`);
    }
    const courseware = record(item.coursewareRef, `${path}.coursewareRef`);
    if (role(courseware.mentorRole, `${path}.coursewareRef.mentorRole`) !== ownerRole) throw new Error(`${path}.coursewareRef 必须属于内容所有者。`);
    identifier(courseware.packageId, `${path}.coursewareRef.packageId`);
    identifier(courseware.slug, `${path}.coursewareRef.slug`);
    if (!Number.isInteger(courseware.revision) || Number(courseware.revision) < 0) throw new Error(`${path}.coursewareRef.revision 无效。`);
    if (!/^[0-9a-f]{64}$/.test(text(courseware.digest, `${path}.coursewareRef.digest`))) throw new Error(`${path}.coursewareRef.digest 必须是 64 位小写 SHA-256。`);
    if (courseware.sourceCommit !== undefined && !/^[0-9a-f]{40}$/.test(text(courseware.sourceCommit, `${path}.coursewareRef.sourceCommit`))) throw new Error(`${path}.coursewareRef.sourceCommit 无效。`);
    if (courseware.sourceTree !== undefined && !/^[0-9a-f]{40}$/.test(text(courseware.sourceTree, `${path}.coursewareRef.sourceTree`))) throw new Error(`${path}.coursewareRef.sourceTree 无效。`);
    const checkpoints = array(item.checkpoints, `${path}.checkpoints`);
    if (!checkpoints.length) throw new Error(`${path}.checkpoints 不能为空。`);
    const checkpointIds = new Set<string>();
    const checkpointBlocks = new Set<string>();
    for (const [checkpointIndex, rawCheckpoint] of checkpoints.entries()) {
      const checkpointPath = `${path}.checkpoints[${checkpointIndex}]`;
      const checkpoint = record(rawCheckpoint, checkpointPath);
      const checkpointId = identifier(checkpoint.id, `${checkpointPath}.id`);
      if (checkpointIds.has(checkpointId)) throw new Error(`${checkpointPath}.id 重复。`);
      checkpointIds.add(checkpointId);
      text(checkpoint.title, `${checkpointPath}.title`);
      text(checkpoint.purpose, `${checkpointPath}.purpose`);
      const blockRefs = textArray(checkpoint.blockIds, `${checkpointPath}.blockIds`);
      unique(blockRefs, `${checkpointPath}.blockIds`);
      for (const blockId of blockRefs) {
        if (!refs.blockIds.has(blockId)) throw new Error(`${checkpointPath}.blockIds 引用了未知 Block ${blockId}。`);
        if (checkpointBlocks.has(blockId)) throw new Error(`${checkpointPath}.blockIds 重复覆盖了 ${blockId}。`);
        checkpointBlocks.add(blockId);
      }
      const cue = record(checkpoint.coursewareCue, `${checkpointPath}.coursewareCue`);
      text(cue.label, `${checkpointPath}.coursewareCue.label`);
      if (!Number.isInteger(cue.slideStart) || !Number.isInteger(cue.slideEnd)
        || Number(cue.slideStart) < 1 || Number(cue.slideEnd) < Number(cue.slideStart)) {
        throw new Error(`${checkpointPath}.coursewareCue 页码范围无效。`);
      }
      const privateDeckIds = textArray(checkpoint.privateDeckIds, `${checkpointPath}.privateDeckIds`, true);
      unique(privateDeckIds, `${checkpointPath}.privateDeckIds`);
      if (privateDeckIds.length > 1) throw new Error(`${checkpointPath}.privateDeckIds 当前只能声明一个学员私密卡组。`);
      for (const deckId of privateDeckIds) if (!refs.deckIds.has(deckId)) throw new Error(`${checkpointPath}.privateDeckIds 引用了未知卡组 ${deckId}。`);
      if (caseTypes.get(casePackageId) === "simulation") {
        const invalidCardIds = privateDeckIds.flatMap((deckId) => (refs.deckCardIdsById.get(deckId) ?? [])
          .filter((cardId) => {
            const card = refs.cardsById.get(cardId)!;
            return card.boundary !== "R" || card.sourceIds.length > 0;
          }));
        if (invalidCardIds.length) {
          throw new Error(`${checkpointPath}.privateDeckIds 的模拟卡组 ${privateDeckIds.join("、")} 只能包含无来源的 R 课堂模拟卡；不符合：${invalidCardIds.join("、")}。`);
        }
      }
      textArray(checkpoint.publicEvents, `${checkpointPath}.publicEvents`, true);
      const schemaRefs = textArray(checkpoint.submissionSchemaIds, `${checkpointPath}.submissionSchemaIds`, true);
      unique(schemaRefs, `${checkpointPath}.submissionSchemaIds`);
      for (const schemaId of schemaRefs) {
        if (!schemaIds.has(schemaId)) throw new Error(`${checkpointPath}.submissionSchemaIds 引用了未知提交结构 ${schemaId}。`);
        if (schemaOwners.get(schemaId) !== ownerRole) throw new Error(`${checkpointPath}.submissionSchemaIds 的 ${schemaId} 不属于剧本所有者。`);
        if (!blockRefs.includes(schemaBlocks.get(schemaId)!)) throw new Error(`${checkpointPath}.submissionSchemaIds 的 ${schemaId} 必须在本检查点 Block 提交。`);
      }
      for (const blockId of blockRefs) {
        if (globallyOwnedCheckpointBlocks.has(blockId)) throw new Error(`${checkpointPath}.blockIds 的 ${blockId} 已由另一个 ScriptPackage 拥有。`);
        globallyOwnedCheckpointBlocks.add(blockId);
      }
    }
    textArray(item.mentorRubric, `${path}.mentorRubric`);
    if (item.handoff !== undefined) {
      const handoff = record(item.handoff, `${path}.handoff`);
      for (const key of ["fromBlockId", "availableAtBlockId"]) {
        const blockId = text(handoff[key], `${path}.handoff.${key}`);
        if (!refs.blockIds.has(blockId)) throw new Error(`${path}.handoff.${key} 引用了未知 Block。`);
      }
      const fromBlockId = String(handoff.fromBlockId);
      const availableAtBlockId = String(handoff.availableAtBlockId);
      const blockOrder = (blockId: string) => Number(blockId.slice(1));
      if (blockOrder(availableAtBlockId) <= blockOrder(fromBlockId)) throw new Error(`${path}.handoff.availableAtBlockId 必须晚于 fromBlockId。`);
      const toMentorRole = role(handoff.toMentorRole, `${path}.handoff.toMentorRole`);
      if (toMentorRole === ownerRole) throw new Error(`${path}.handoff.toMentorRole 必须是另一个专业导师。`);
      const schemaId = identifier(handoff.submissionSchemaId, `${path}.handoff.submissionSchemaId`);
      if (!schemaIds.has(schemaId)) throw new Error(`${path}.handoff.submissionSchemaId 引用了未知提交结构。`);
      if (schemaOwners.get(schemaId) !== ownerRole || schemaBlocks.get(schemaId) !== fromBlockId) {
        throw new Error(`${path}.handoff 必须从所有者在 fromBlockId 验收的结构化作品交接。`);
      }
      text(handoff.summary, `${path}.handoff.summary`);
    }
  }

  const rawReview = array(root.reviewQueue, "$.contentPackages.reviewQueue");
  const reviewIds = new Set<string>();
  for (const [index, raw] of rawReview.entries()) {
    const path = `$.contentPackages.reviewQueue[${index}]`;
    const item = record(raw, path);
    const id = identifier(item.id, `${path}.id`);
    if (reviewIds.has(id)) throw new Error(`${path}.id 重复。`);
    reviewIds.add(id);
    if (!new Set(["open", "resolved"]).has(String(item.status))) throw new Error(`${path}.status 无效。`);
    if (!new Set(["source-boundary", "courseware-version", "curriculum", "routing"]).has(String(item.category))) throw new Error(`${path}.category 无效。`);
    for (const key of ["location", "title", "reason", "recommendedAction"]) text(item[key], `${path}.${key}`);
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}

export function canonicalCoursePackage(value: CoursePackage): string {
  const content = structuredClone(value) as CoursePackage;
  delete content.authoring;
  return `${stableJson(content)}\n`;
}

export async function coursePackageDigest(value: CoursePackage): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalCoursePackage(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

/** Stable identity of one immutable registry row; never means “latest”. */
export function courseDataIdForRef(ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">): string {
  if (!ref.courseId || !Number.isInteger(ref.revision) || !/^[0-9a-f]{64}$/.test(ref.digest)) {
    throw new Error("无法为无效的 exact CourseDefinition 引用生成 courseDataId。");
  }
  return `${ref.courseId}@r${ref.revision}:${ref.digest}`;
}

const STAGES: Record<CourseStepId, CampaignStage> = {
  find: "find",
  decide: "decide",
  build: "build",
  market: "market",
  operate: "operate",
};
const MENTOR_CODES: Record<string, PDMORole> = { mentor01: "P", mentor02: "D", mentor03: "M", mentor04: "O" };
const IDENTITY_NAMES = ["现场观察员", "证据核对员", "反例猎手", "行动记录员"] as const;

function boundaryKind(boundary: EvidenceBoundary): ClassroomInfoCard["kind"] {
  return boundary === "F" ? "fact" : boundary === "R" ? "observation" : boundary === "G" ? "inference" : "rumor";
}

function assetsForPackage(course: CoursePackage): ClassroomAssetDefinition[] {
  return course.macroSteps.flatMap((step, index) => {
    const formula = course.formula.fiveSteps[index];
    const type = (["research", "product", "product", "market", "operations"] as const)[index];
    return [
      {
        id: `${course.course.id}:${step.id}:tool`,
        name: `${step.name}工具包`,
        type,
        priceTenths: 10 + index * 5,
        valueTenths: 15 + index * 5,
        maintenanceTenths: index > 1 ? 2 + index : 0,
        ability: `帮助团队完成：${formula.output}`,
        prerequisiteRp: index * 2,
        risk: `只有留下“${step.exitGate}”对应证据，工具才产生价值。`,
        unlocks: `${step.name}阶段的一次团队复盘或重试。`,
      },
      {
        id: `${course.course.id}:${step.id}:evidence`,
        name: `${step.name}证据板`,
        type: index < 2 ? "research" : type,
        priceTenths: 8 + index * 5,
        valueTenths: 12 + index * 5,
        maintenanceTenths: 0,
        ability: `把本步的判断、反例和下一次行动放在同一张可检查的板上。`,
        prerequisiteRp: index,
        risk: "只写结论而不标来源时，不得把它当成已验证结果。",
        unlocks: `允许团队用一条新证据修订本步作品。`,
      },
    ];
  });
}

function chapterForStep(course: CoursePackage, step: CoursePackageStep, index: number): ClassroomChapter {
  const blocks = step.blocks.map((id) => course.blocks.find((block) => block.id === id)!).filter(Boolean);
  const deck = course.decks.find((entry) => entry.macroStepId === step.id)!;
  const learnerPolicy = course.learnerPolicy ?? { defaultCount: 4, minCount: 2, maxCount: 4, cardsPerLearner: 3, dealPolicy: "unique-within-step" as const };
  const identities = Array.from({ length: learnerPolicy.maxCount }, (_, identityIndex) => ({
    id: `${course.course.id}:${step.id}:identity:${identityIndex + 1}`,
    name: IDENTITY_NAMES[identityIndex] ?? `协作探索员 ${identityIndex + 1}`,
    nature: "composite" as const,
    publicGoal: blocks[0]?.seatTasks[`learner${String(identityIndex + 1).padStart(2, "0")}`]?.task
      ?? blocks[0]?.learnerTaskTemplate?.task
      ?? `从自己的${learnerPolicy.cardsPerLearner}张卡中找到一条能帮助团队完成“${step.name}”的线索。`,
    privateConcern: `你只能先看到自己的${learnerPolicy.cardsPerLearner}张随机卡；不要把推测说成事实。`,
    ability: identityIndex === 0 ? "可以请一名队友把抽象说法改成具体人物和动作。" : identityIndex === 1 ? "可以要求团队指出说法来自哪张卡。" : identityIndex === 2 ? "可以提出一个会推翻当前判断的反例。" : "可以把一次讨论整理成下一步行动。",
  }));
  const infoCards = deck.cards.map((card, cardIndex): ClassroomInfoCard => ({
    id: card.id,
    holderIdentityId: identities[cardIndex % identities.length].id,
    kind: boundaryKind(card.boundary),
    title: card.title,
    body: card.body,
    sourceIds: [...card.sourceIds],
    credibility: card.credibility ?? (card.boundary === "F" ? "high" : card.boundary === "U" ? "low" : "medium"),
    sharePrompt: card.sharePrompt,
  }));
  const mentorSequence = step.mentorSequence.map((id) => MENTOR_CODES[id]).filter(Boolean);
  const challenges = [0, 1, 2].map((challengeIndex) => {
    const block = blocks[Math.min(challengeIndex, blocks.length - 1)];
    const level = (challengeIndex + 1) as 1 | 2 | 3;
    return {
      id: `${course.course.id}:${step.id}:challenge:${level}`,
      level,
      title: level === 3 && blocks.length < 3 ? `${step.name}反例重做` : block.title,
      prompt: level === 3 && blocks.length < 3 ? `${block.studentPrompt} 再加入一个可能推翻当前方案的反例，做出第二版。` : block.studentPrompt,
      requiredArtifact: block.learnerLens.done,
      recommendedLead: MENTOR_CODES[block.leadMentorId],
      requiredSupport: [...new Set(mentorSequence.filter((code) => code !== MENTOR_CODES[block.leadMentorId]))],
      baseIncomeTenths: [30, 65, 100][challengeIndex],
    };
  });
  const referencedSources = [...new Set(deck.cards.flatMap((card) => card.sourceIds))];
  const acceptance = [...new Set(blocks.flatMap((block) => block.evidenceGate))];
  return {
    id: `${course.course.id}:${step.id}`,
    order: step.order,
    stage: STAGES[step.id],
    title: step.name,
    timeRange: course.course.period,
    location: `${course.case.period} · 创业现场`,
    briefing: blocks.map((block) => block.learnerLens.world).join("\n"),
    learningGoal: step.question,
    historicalBoundary: blocks.map((block) => block.historyTrack),
    cardsPerLearner: learnerPolicy.cardsPerLearner,
    maxLearners: learnerPolicy.maxCount,
    identities,
    infoCards,
    intelGate: {
      requiredSourceBackedEvidence: 2,
      requireUserOrPerson: true,
      requireSceneLoss: true,
      requireConstraint: true,
      requireContradictionOrGap: true,
      requireLeadSupportLink: true,
    },
    challenges,
    pressureEvents: Array.from({ length: 6 }, (_, pressureIndex) => {
      const block = blocks[pressureIndex % blocks.length];
      return {
        die: (pressureIndex + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        title: `${block.title} · 突发 ${pressureIndex + 1}`,
        effect: block.fallback[pressureIndex % block.fallback.length] ?? "出现一条新限制，团队必须说明它改变了什么。",
        mitigation: block.evidenceGate[pressureIndex % block.evidenceGate.length] ?? step.exitGate,
      };
    }),
    historyReveal: {
      happened: blocks.map((block) => block.historyTrack).join("\n"),
      comparisonPrompts: blocks.map((block) => block.realityTrack),
      sourceIds: referencedSources,
    },
    realityMission: {
      title: `${step.name}｜现实项目行动`,
      deliverable: course.formula.fiveSteps[index].output,
      timeboxMinutes: blocks.reduce((sum, block) => sum + block.suggestedMinutes, 0),
      acceptance: acceptance.length ? acceptance : [step.exitGate],
    },
    dm: {
      opening: blocks[0]?.mentorScript[0] ?? step.question,
      prompts: blocks.flatMap((block) => block.mentorScript),
      watchFor: blocks.flatMap((block) => block.fallback),
      debrief: [step.exitGate, ...blocks.map((block) => block.learnerLens.done)],
    },
  };
}

/**
 * Project one exact immutable Course Package into the existing classroom
 * mechanics. No campaign module contributes course text or cards here.
 */
export function projectCoursePackageToCampaign(course: CoursePackage, ref: CoursePackageRef): ClassroomCampaign {
  validateCoursePackage(course);
  const segments = [
    ["problem", "问题证据"],
    ["solution", "方案取舍"],
    ["mvp", "MVP演示"],
    ["market", "用户／市场证据"],
    ["operations", "运营账本"],
    ["request", "下一步请求"],
  ] as const;
  return {
    schemaVersion: 1,
    id: course.course.id,
    title: course.course.name,
    organization: course.case.name,
    period: course.course.period,
    summary: course.course.description,
    learnerSeal: {
      title: `${course.course.learnerName}｜五步创业闭环`,
      organization: course.course.learnerName,
      summary: "结局尚未揭晓。先根据随机线索完成五步，再与有来源的历史记录对照。",
      roomTitle: `${course.course.learnerName}｜Young Builder 课堂`,
    },
    sources: structuredClone(course.sources),
    assets: assetsForPackage(course),
    chapters: course.macroSteps.map((step, index) => chapterForStep(course, step, index)),
    demoDay: {
      durationSeconds: 360,
      segments: segments.map(([id, title], index) => ({
        id: `${course.course.id}:demo:${id}`,
        startSecond: index * 60,
        endSecond: (index + 1) * 60,
        title,
        requirement: course.formula.sixMinuteDemo.split(" → ")[index] ?? title,
      })),
      rubric: [
        "每项判断都能指出卡片、作品或真实测试证据。",
        "能说明团队做过的一次取舍和一次修改。",
        "市场结果与运营账本分开呈现。",
        "最后提出一项具体、可检查的下一步请求。",
      ],
    },
    courseRef: structuredClone(ref),
  };
}
