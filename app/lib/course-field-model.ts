import type { CoursePackage, CoursePackageBlock, CoursePackageCard } from "./course-package";

export const COURSE_FIELD_MODEL_SCHEMA_VERSION = 1 as const;

export type CourseFieldScope = "global" | "mentorRole" | "seat" | "card" | "seatTemplate";
export type CourseFieldValueType = "text" | "number" | "boolean" | "string-list" | "enum";

export interface CourseStudentSeat {
  seatId: string;
  fieldRootId: string;
  status: "available" | "inactive";
}

export interface CourseFieldBinding {
  fieldId: string;
  scope: CourseFieldScope;
  ownerId: string | null;
  blockId: string | null;
  fieldType: string;
  valueType: CourseFieldValueType;
  path: string;
  aliases?: string[];
}

export interface CourseFieldModel {
  schemaVersion: typeof COURSE_FIELD_MODEL_SCHEMA_VERSION;
  studentSeats: CourseStudentSeat[];
  fields: CourseFieldBinding[];
}

export type CourseFieldMigrationEntry = {
  action: "created-seat" | "retained-seat" | "created-field-model" | "refreshed-field-model";
  ownerId: string | null;
  path: string;
  detail: string;
};

export type CourseFieldMigrationResult = {
  course: CoursePackage;
  report: CourseFieldMigrationEntry[];
};

const MENTOR_SEATS = ["mentor01", "mentor02", "mentor03", "mentor04"] as const;
const EDITABLE_BLOCK_GLOBAL_FIELDS: Array<[string, CourseFieldValueType]> = [
  ["title", "text"],
  ["leadMentorId", "enum"],
  ["suggestedMinutes", "number"],
  ["gameModes", "string-list"],
  ["historyTrack", "text"],
  ["realityTrack", "text"],
  ["studentPrompt", "text"],
  ["learnerLens.world", "text"],
  ["learnerLens.say", "text"],
  ["learnerLens.ask", "text"],
  ["learnerLens.done", "text"],
  ["mentorScript", "string-list"],
  ["studentActions", "string-list"],
  ["systemActions", "string-list"],
  ["props", "string-list"],
  ["evidenceGate", "string-list"],
  ["fallback", "string-list"],
  ["manualInteraction", "text"],
];
const CARD_FIELDS: Array<[keyof Pick<CoursePackageCard, "boundary" | "title" | "body" | "sharePrompt" | "sourceIds">, CourseFieldValueType]> = [
  ["boundary", "enum"],
  ["title", "text"],
  ["body", "text"],
  ["sharePrompt", "text"],
  ["sourceIds", "string-list"],
];

function learnerSeatId(number: number): string {
  return `learner${String(number).padStart(2, "0")}`;
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function field(
  scope: CourseFieldScope,
  ownerId: string | null,
  blockId: string | null,
  fieldType: string,
  valueType: CourseFieldValueType,
  path: string,
  aliases?: string[],
): CourseFieldBinding {
  const identity = [scope, ownerId ?? "course", blockId ?? "root", fieldType].map(safeId).join(":");
  return {
    fieldId: `field:${identity}`,
    scope,
    ownerId,
    blockId,
    fieldType,
    valueType,
    path,
    ...(aliases?.length ? { aliases: [...aliases] } : {}),
  };
}

function retainedLearnerSeatCount(course: CoursePackage): number {
  const authored = course.blocks.reduce((maximum, block) => {
    const seatMaximum = Object.keys(block.seatTasks).reduce((value, seatId) => {
      const match = /^learner(\d{2})$/.exec(seatId);
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    return Math.max(maximum, seatMaximum);
  }, 0);
  const modeled = course.fieldModel?.studentSeats.reduce((maximum, seat) => {
    const match = /^learner(\d{2})$/.exec(seat.seatId);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0) ?? 0;
  return Math.max(course.learnerPolicy?.maxCount ?? 4, authored, modeled, 4);
}

/**
 * Build the deterministic identity index for every field the structured
 * editor can mutate. Values stay in their normal CourseDefinition paths; the
 * model is an ownership/index contract rather than a second content store.
 */
export function buildCourseFieldModel(course: CoursePackage): CourseFieldModel {
  const seats = Array.from({ length: retainedLearnerSeatCount(course) }, (_, index): CourseStudentSeat => {
    const seatId = learnerSeatId(index + 1);
    return {
      seatId,
      fieldRootId: `field-root:${seatId}`,
      status: index < (course.learnerPolicy?.maxCount ?? 4) ? "available" : "inactive",
    };
  });
  const fields: CourseFieldBinding[] = [
    // Root `title` is derived display metadata ("Mini Silicon Valley｜…") and
    // is intentionally not a same-value alias of the editable course name.
    field("global", null, null, "course-name", "text", "course.name"),
    field("global", null, null, "course-period", "text", "course.period", ["case.period"]),
    field("global", null, null, "course-description", "text", "course.description"),
    field("global", null, null, "learner-name", "text", "case.learnerName"),
    field("global", null, null, "case-name", "text", "case.name"),
    field("global", null, null, "case-why", "text", "case.why"),
  ];
  if (course.learnerPolicy) {
    for (const [key, valueType] of [
      ["defaultCount", "number"],
      ["minCount", "number"],
      ["maxCount", "number"],
      ["cardsPerLearner", "number"],
      ["dealPolicy", "enum"],
    ] as const) {
      fields.push(field("global", null, null, `learner-policy-${key}`, valueType, `learnerPolicy.${key}`));
    }
  }
  course.macroSteps.forEach((step, stepIndex) => {
    const root = `macroSteps.${stepIndex}`;
    fields.push(
      field("global", null, null, `macro-step-${step.id}-name`, "text", `${root}.name`, [`formula.fiveSteps.${stepIndex}.name`]),
      field("global", null, null, `macro-step-${step.id}-mentor-sequence`, "string-list", `${root}.mentorSequence`),
      field("global", null, null, `macro-step-${step.id}-question`, "text", `${root}.question`),
      field("global", null, null, `macro-step-${step.id}-exit-gate`, "text", `${root}.exitGate`),
    );
  });
  course.blocks.forEach((block, blockIndex) => {
    const root = `blocks.${blockIndex}`;
    for (const [pathSuffix, valueType] of EDITABLE_BLOCK_GLOBAL_FIELDS) {
      fields.push(field("global", null, block.id, pathSuffix.replaceAll(".", "-"), valueType, `${root}.${pathSuffix}`));
    }
    for (const mentorSeatId of MENTOR_SEATS) {
      for (const [property, valueType] of [["state", "enum"], ["badge", "text"], ["task", "text"]] as const) {
        fields.push(field("mentorRole", mentorSeatId, block.id, property, valueType, `${root}.seatTasks.${mentorSeatId}.${property}`));
      }
    }
    for (const { seatId } of seats) {
      for (const [property, valueType] of [["state", "enum"], ["badge", "text"], ["task", "text"]] as const) {
        fields.push(field("seat", seatId, block.id, property, valueType, `${root}.seatTasks.${seatId}.${property}`));
      }
    }
    if (block.learnerTaskTemplate) {
      fields.push(
        field("seatTemplate", "learner-template", block.id, "badge", "text", `${root}.learnerTaskTemplate.badge`),
        field("seatTemplate", "learner-template", block.id, "task", "text", `${root}.learnerTaskTemplate.task`),
      );
    }
  });
  course.decks.forEach((deck, deckIndex) => {
    deck.cards.forEach((card, cardIndex) => {
      for (const [property, valueType] of CARD_FIELDS) {
        fields.push(field("card", card.id, deck.drawAtBlockId, String(property), valueType, `decks.${deckIndex}.cards.${cardIndex}.${String(property)}`));
      }
    });
  });
  return { schemaVersion: COURSE_FIELD_MODEL_SCHEMA_VERSION, studentSeats: seats, fields };
}

function taskCloneFromTemplate(block: CoursePackageBlock): CoursePackageBlock["seatTasks"][string] {
  const template = block.learnerTaskTemplate ?? { badge: "Young Builder", task: block.studentPrompt };
  return { state: "active", badge: String(template.badge), task: String(template.task) };
}

/** Upgrade an editable copy without mutating or re-digesting old releases. */
export function migrateCourseFieldIsolation(input: CoursePackage): CourseFieldMigrationResult {
  const course = structuredClone(input);
  const report: CourseFieldMigrationEntry[] = [];
  const count = retainedLearnerSeatCount(course);
  for (const [blockIndex, block] of course.blocks.entries()) {
    for (let index = 1; index <= count; index += 1) {
      const seatId = learnerSeatId(index);
      const path = `blocks.${blockIndex}.seatTasks.${seatId}`;
      if (!block.seatTasks[seatId]) {
        block.seatTasks[seatId] = taskCloneFromTemplate(block);
        report.push({ action: "created-seat", ownerId: seatId, path, detail: `${block.id} 从只读模板深复制为独立席位节点。` });
      } else if (index > (course.learnerPolicy?.maxCount ?? 4)) {
        report.push({ action: "retained-seat", ownerId: seatId, path, detail: `${block.id} 保留停用席位内容，没有静默删除。` });
      }
    }
  }
  const hadModel = Boolean(course.fieldModel);
  course.fieldModel = buildCourseFieldModel(course);
  report.push({
    action: hadModel ? "refreshed-field-model" : "created-field-model",
    ownerId: null,
    path: "fieldModel",
    detail: `${course.fieldModel.fields.length} 个可编辑字段已建立稳定 scope / owner / path 索引。`,
  });
  return { course, report };
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[/^\d+$/.test(key) ? Number(key) : key];
  }, value);
}

function bindingSignature(binding: CourseFieldBinding): string {
  return JSON.stringify(binding);
}

export function validateCourseFieldModel(course: CoursePackage, model: CourseFieldModel): void {
  if (model.schemaVersion !== COURSE_FIELD_MODEL_SCHEMA_VERSION) throw new Error("$.fieldModel.schemaVersion 必须为 1。");
  const expected = buildCourseFieldModel({ ...course, fieldModel: undefined });
  const seatIds = new Set<string>();
  const roots = new Set<string>();
  model.studentSeats.forEach((seat, index) => {
    if (!/^learner\d{2}$/.test(seat.seatId)) throw new Error(`$.fieldModel.studentSeats[${index}].seatId 无效。`);
    if (seatIds.has(seat.seatId)) throw new Error(`学员席 ID 重复：${seat.seatId}`);
    if (roots.has(seat.fieldRootId)) throw new Error(`学员席 fieldRootId 重复：${seat.fieldRootId}`);
    if (!new Set(["available", "inactive"]).has(seat.status)) throw new Error(`$.fieldModel.studentSeats[${index}].status 无效。`);
    seatIds.add(seat.seatId);
    roots.add(seat.fieldRootId);
  });
  const fieldIds = new Set<string>();
  const paths = new Set<string>();
  model.fields.forEach((binding, index) => {
    const path = `$.fieldModel.fields[${index}]`;
    if (!/^field:[a-z0-9:-]+$/.test(binding.fieldId)) throw new Error(`${path}.fieldId 无效。`);
    if (fieldIds.has(binding.fieldId)) throw new Error(`非公共字段或卡片字段复用了 fieldId：${binding.fieldId}`);
    if (paths.has(binding.path)) throw new Error(`可编辑 JSON path 重复绑定：${binding.path}`);
    if (binding.scope !== "global" && !binding.ownerId) throw new Error(`${path}.ownerId 为非公共字段必填项。`);
    if (binding.scope === "global" && binding.ownerId !== null) throw new Error(`${path}.ownerId 对公共字段必须为 null。`);
    if (binding.aliases?.length && binding.scope !== "global") throw new Error(`${path}.aliases 只允许用于显式公共字段。`);
    if (getPath(course, binding.path) === undefined) throw new Error(`${path}.path 指向不存在的课程字段：${binding.path}`);
    for (const alias of binding.aliases ?? []) {
      if (getPath(course, alias) === undefined) throw new Error(`${path}.aliases 指向不存在的课程字段：${alias}`);
    }
    fieldIds.add(binding.fieldId);
    paths.add(binding.path);
  });
  const actualFields = new Map(model.fields.map((binding) => [binding.path, bindingSignature(binding)]));
  for (const binding of expected.fields) {
    if (actualFields.get(binding.path) !== bindingSignature(binding)) {
      throw new Error(`$.fieldModel 缺少或错误绑定可编辑字段：${binding.path}`);
    }
  }
  if (actualFields.size !== expected.fields.length) throw new Error("$.fieldModel 包含不属于当前 CourseDefinition 的陈旧字段绑定。");
  if (JSON.stringify(model.studentSeats) !== JSON.stringify(expected.studentSeats)) {
    throw new Error("$.fieldModel.studentSeats 与当前席位容量或保留席位不一致。");
  }
}

/** Immutable update used by Editor/API isolation tests and future editors. */
export function updateCourseFieldById(course: CoursePackage, fieldId: string, value: unknown): CoursePackage {
  const binding = course.fieldModel?.fields.find((item) => item.fieldId === fieldId);
  if (!binding) throw new Error(`找不到字段 ${fieldId}。`);
  const copy = structuredClone(course);
  const set = (path: string) => {
    const keys = path.split(".");
    let target: unknown = copy;
    for (const key of keys.slice(0, -1)) target = (target as Record<string, unknown>)[/^\d+$/.test(key) ? Number(key) : key];
    const last = keys.at(-1)!;
    (target as Record<string, unknown>)[/^\d+$/.test(last) ? Number(last) : last] = structuredClone(value);
  };
  set(binding.path);
  for (const alias of binding.aliases ?? []) set(alias);
  copy.fieldModel = buildCourseFieldModel(copy);
  return copy;
}
