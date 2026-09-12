import { ClassroomError } from "./classroom-errors";
import type { ClassroomFactoryRequest, ClassroomMentorRole, ClassroomScriptAction, ExactCoursewareRef } from "./classroom-factory";
import type { CoursePackageRef } from "./course-package";

export function objectValue(value: unknown, label = "请求"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("INPUT_INVALID", `${label}必须是对象。`, 400);
  return value as Record<string, unknown>;
}

export function stringValue(value: unknown, label: string, maximum = 256): string {
  if (typeof value !== "string" || !value.trim()) throw new ClassroomError("INPUT_INVALID", `${label}不能为空。`, 400);
  if (value.length > maximum) throw new ClassroomError("INPUT_INVALID", `${label}内容过长。`, 400);
  return value.trim();
}

export function integerValue(value: unknown, label: string, minimum = 0, maximum = 10_000): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new ClassroomError("INPUT_INVALID", `${label}必须是 ${minimum}—${maximum} 的整数。`, 400);
  return Number(value);
}

export function parseCourseRef(value: unknown): CoursePackageRef {
  const raw = objectValue(value, "courseRef");
  const status = raw.status;
  if (status !== "candidate" && status !== "released" && status !== "archived") throw new ClassroomError("INPUT_INVALID", "courseRef.status 无效。", 400);
  return {
    courseId: stringValue(raw.courseId, "courseId", 64),
    schemaVersion: integerValue(raw.schemaVersion, "schemaVersion", 1, 100),
    revision: integerValue(raw.revision, "revision", 0, 1_000_000),
    digest: stringValue(raw.digest, "digest", 64),
    status,
  };
}

function roleValue(value: unknown): ClassroomMentorRole {
  if (value === "P" || value === "D" || value === "M" || value === "O") return value;
  throw new ClassroomError("INPUT_INVALID", "导师角色必须是 P、D、M 或 O。", 400);
}

export function parseFactoryRequest(value: unknown): ClassroomFactoryRequest {
  const raw = objectValue(value);
  if (raw.environment !== "test" && raw.environment !== "production") throw new ClassroomError("INPUT_INVALID", "environment 必须是 test 或 production。", 400);
  // Backward-compatible input only. The persistent factory ignores this
  // value and resolves current released mentor decks server-side.
  const courseware = Array.isArray(raw.coursewareRefs) ? raw.coursewareRefs : [];
  const mentors = Array.isArray(raw.mentorSeats) ? raw.mentorSeats : [];
  const learners = Array.isArray(raw.learnerProfileIds) ? raw.learnerProfileIds : [];
  const admins = Array.isArray(raw.adminDmProfileIds) ? raw.adminDmProfileIds : [];
  const result: ClassroomFactoryRequest = {
    environment: raw.environment,
    title: stringValue(raw.title, "课堂名称", 128),
    learnerCount: integerValue(raw.learnerCount, "学员人数", 1, 24),
    courseRef: parseCourseRef(raw.courseRef),
    viewAcceptanceReceiptId: stringValue(raw.viewAcceptanceReceiptId, "多角色视图验收回执", 128),
    ...(raw.uiAcceptanceReceiptId == null
      ? {}
      : { uiAcceptanceReceiptId: stringValue(raw.uiAcceptanceReceiptId, "真实课堂 UI 验收回执", 128) }),
    coursewareRefs: courseware.map((item): ExactCoursewareRef => {
      const ref = objectValue(item, "coursewareRef");
      return {
        mentorRole: roleValue(ref.mentorRole),
        packageId: stringValue(ref.packageId, "packageId", 128),
        slug: stringValue(ref.slug, "slug", 64),
        revision: integerValue(ref.revision, "课件 revision", 0, 1_000_000),
        digest: stringValue(ref.digest, "课件 digest", 64),
      };
    }),
    mentorSeats: mentors.map((item) => {
      const seat = objectValue(item, "mentorSeat");
      return { mentorRole: roleValue(seat.mentorRole), profileId: stringValue(seat.profileId, "导师账号", 128) };
    }),
    learnerProfileIds: learners.map((item) => stringValue(item, "学员账号", 128)),
    adminDmProfileIds: admins.map((item) => stringValue(item, "Admin DM 账号", 128)),
  };
  return result;
}

export function parseRunExpectation(raw: Record<string, unknown>): { expectedRunId: string; expectedResetGeneration: number } {
  return {
    expectedRunId: stringValue(raw.expectedRunId, "expectedRunId", 196),
    expectedResetGeneration: integerValue(raw.expectedResetGeneration, "expectedResetGeneration", 0, 1_000_000),
  };
}

export function parseArchiveClassroomRequest(value: unknown): {
  expectedRunId: string;
  expectedResetGeneration: number;
  expectedScriptVersion: number;
  idempotencyKey: string;
  reason?: string;
} {
  const raw = objectValue(value);
  return {
    ...parseRunExpectation(raw),
    expectedScriptVersion: integerValue(raw.expectedScriptVersion, "剧本版本", 1, 1_000_000),
    idempotencyKey: stringValue(raw.idempotencyKey, "幂等键", 128),
    ...(raw.reason == null ? {} : { reason: stringValue(raw.reason, "归档备注", 500) }),
  };
}

export function parseDeleteClassroomRequest(value: unknown): {
  expectedRunId: string;
  expectedResetGeneration: number;
  expectedScriptVersion: number;
  expectedStateToken: string;
  confirmClassroomId: string;
  idempotencyKey: string;
  reason?: string;
} {
  const raw = objectValue(value);
  return {
    ...parseRunExpectation(raw),
    expectedScriptVersion: integerValue(raw.expectedScriptVersion, "剧本版本", 1, 1_000_000),
    expectedStateToken: stringValue(raw.expectedStateToken, "删除预览状态", 64),
    confirmClassroomId: stringValue(raw.confirmClassroomId, "二次确认 classroomId", 128),
    idempotencyKey: stringValue(raw.idempotencyKey, "幂等键", 128),
    ...(raw.reason == null || raw.reason === "" ? {} : { reason: stringValue(raw.reason, "删除备注", 500) }),
  };
}

export function parseScriptAction(value: unknown): {
  expectedVersion: number;
  expectedRunId: string;
  expectedResetGeneration: number;
  action: ClassroomScriptAction;
  viewAsProfileId?: string;
} {
  const raw = objectValue(value);
  const action = objectValue(raw.action, "action");
  if (action.type !== "unlock-next") throw new ClassroomError("INPUT_INVALID", "未知剧本解锁动作。", 400);
  return {
    ...parseRunExpectation(raw),
    expectedVersion: integerValue(raw.expectedVersion, "expectedVersion", 1),
    action: { type: "unlock-next", nextBlockId: stringValue(action.nextBlockId, "下一页 Block", 64) },
    ...(raw.viewAsProfileId == null ? {} : { viewAsProfileId: stringValue(raw.viewAsProfileId, "测试视角账号", 128) }),
  };
}
