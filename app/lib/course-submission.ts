import type {
  CoursePackage,
  CourseSubmissionField,
  CourseSubmissionSchema,
} from "./course-package";

export type StructuredSubmissionValues = Record<string, string>;

export type StoredClassroomSubmissionPayload = {
  text?: string;
  schemaId?: string;
  values?: StructuredSubmissionValues;
  review?: { feedback: string; reviewedAt: string };
};

export type LearnerSubmissionSchemaView = {
  id: string;
  kind: string;
  name: string;
  learnerIntro: string;
  ownerMentorRole: CourseSubmissionSchema["ownerMentorRole"];
  submitAtBlockId: string;
  fields: Array<Pick<CourseSubmissionField, "id" | "label" | "learnerPrompt" | "input" | "required" | "minLength" | "maxLength" | "minItems" | "maxItems">>;
  mentorRubric: null;
};

export type MentorSubmissionSchemaView = Omit<LearnerSubmissionSchemaView, "fields" | "mentorRubric"> & {
  fields: CourseSubmissionField[];
  mentorRubric: string[];
};

export type ClassroomSubmissionSchemaView = LearnerSubmissionSchemaView | MentorSubmissionSchemaView;

export function findSubmissionSchema(course: CoursePackage, schemaId: string): CourseSubmissionSchema | null {
  return course.contentPackages?.submissionSchemas.find((schema) => schema.id === schemaId) ?? null;
}

export function submissionSchemaForBlock(course: CoursePackage, blockId: string): CourseSubmissionSchema | null {
  return course.contentPackages?.submissionSchemas.find((schema) => schema.submitAtBlockId === blockId) ?? null;
}

export function projectLearnerSubmissionSchema(schema: CourseSubmissionSchema): LearnerSubmissionSchemaView {
  return {
    id: schema.id,
    kind: schema.kind,
    name: schema.name,
    learnerIntro: schema.learnerIntro,
    ownerMentorRole: schema.ownerMentorRole,
    submitAtBlockId: schema.submitAtBlockId,
    fields: schema.fields.map(({ id, label, learnerPrompt, input, required, minLength, maxLength, minItems, maxItems }) => ({
      id,
      label,
      learnerPrompt,
      input,
      required,
      minLength,
      maxLength,
      ...(minItems === undefined ? {} : { minItems }),
      ...(maxItems === undefined ? {} : { maxItems }),
    })),
    mentorRubric: null,
  };
}

export function projectMentorSubmissionSchema(schema: CourseSubmissionSchema): MentorSubmissionSchemaView {
  return {
    id: schema.id,
    kind: schema.kind,
    name: schema.name,
    learnerIntro: schema.learnerIntro,
    ownerMentorRole: schema.ownerMentorRole,
    submitAtBlockId: schema.submitAtBlockId,
    fields: structuredClone(schema.fields),
    mentorRubric: [...schema.mentorRubric],
  };
}

/** Strictly normalize form values against the exact CourseDefinition. */
export function validateStructuredSubmissionValues(
  schema: CourseSubmissionSchema,
  input: unknown,
): StructuredSubmissionValues {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("结构化作品内容必须是字段对象。");
  const raw = input as Record<string, unknown>;
  const known = new Set(schema.fields.map((field) => field.id));
  const extras = Object.keys(raw).filter((key) => !known.has(key));
  if (extras.length) throw new Error(`作品包含课程未声明的字段：${extras.join("、")}。`);
  const values: StructuredSubmissionValues = {};
  for (const field of schema.fields) {
    const candidate = raw[field.id];
    const value = typeof candidate === "string" ? candidate.trim() : "";
    if (field.required && !value) throw new Error(`“${field.label}”还没有填写。`);
    if (value.length < field.minLength || value.length > field.maxLength) {
      throw new Error(`“${field.label}”需为 ${field.minLength}—${field.maxLength} 个字符。`);
    }
    if (field.input === "list" && value) {
      const itemCount = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).length;
      if (field.minItems !== undefined && itemCount < field.minItems) {
        throw new Error(`“${field.label}”至少需要 ${field.minItems} 条，每行写一条。`);
      }
      if (field.maxItems !== undefined && itemCount > field.maxItems) {
        throw new Error(`“${field.label}”最多填写 ${field.maxItems} 条，每行写一条。`);
      }
    }
    values[field.id] = value;
  }
  return values;
}

export function parseStoredSubmissionPayload(raw: string): StoredClassroomSubmissionPayload {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const item = value as Record<string, unknown>;
    const payload: StoredClassroomSubmissionPayload = {};
    if (typeof item.text === "string") payload.text = item.text;
    if (typeof item.schemaId === "string") payload.schemaId = item.schemaId;
    if (item.values && typeof item.values === "object" && !Array.isArray(item.values)) {
      payload.values = Object.fromEntries(Object.entries(item.values as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
    if (item.review && typeof item.review === "object" && !Array.isArray(item.review)) {
      const review = item.review as Record<string, unknown>;
      if (typeof review.feedback === "string" && typeof review.reviewedAt === "string") {
        payload.review = { feedback: review.feedback, reviewedAt: review.reviewedAt };
      }
    }
    return payload;
  } catch {
    return {};
  }
}

export function submissionPlainText(
  payload: StoredClassroomSubmissionPayload,
  schema: CourseSubmissionSchema | null,
): string {
  if (typeof payload.text === "string") return payload.text;
  if (!payload.values) return "";
  return schema
    ? schema.fields.map((field) => `${field.label}：${payload.values?.[field.id] ?? ""}`).join("\n")
    : Object.entries(payload.values).map(([key, value]) => `${key}：${value}`).join("\n");
}
