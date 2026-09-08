import { ClassroomError } from "./classroom-errors";
import type { ClassroomControllerAction, ClassroomFactoryRequest, ClassroomMentorRole, ExactCoursewareRef } from "./classroom-factory";
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
  if (status !== "candidate" && status !== "released" && status !== "approved") throw new ClassroomError("INPUT_INVALID", "courseRef.status 无效。", 400);
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
  const courseware = Array.isArray(raw.coursewareRefs) ? raw.coursewareRefs : [];
  const mentors = Array.isArray(raw.mentorSeats) ? raw.mentorSeats : [];
  const learners = Array.isArray(raw.learnerProfileIds) ? raw.learnerProfileIds : [];
  const admins = Array.isArray(raw.adminDmProfileIds) ? raw.adminDmProfileIds : [];
  const result: ClassroomFactoryRequest = {
    environment: raw.environment,
    title: stringValue(raw.title, "课堂名称", 128),
    learnerCount: integerValue(raw.learnerCount, "学员人数", 1, 24),
    courseRef: parseCourseRef(raw.courseRef),
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

export function parseControllerAction(value: unknown): { expectedVersion: number; action: ClassroomControllerAction } {
  const raw = objectValue(value);
  const action = objectValue(raw.action, "action");
  const type = action.type;
  if (type === "execute" || type === "submit-for-acceptance" || type === "accept" || type === "complete") {
    return { expectedVersion: integerValue(raw.expectedVersion, "expectedVersion", 1), action: { type } };
  }
  if (type === "advance") return { expectedVersion: integerValue(raw.expectedVersion, "expectedVersion", 1), action: { type, ...(typeof action.nextBlockId === "string" ? { nextBlockId: action.nextBlockId } : {}) } };
  if (type === "reject") return { expectedVersion: integerValue(raw.expectedVersion, "expectedVersion", 1), action: { type, ...(typeof action.message === "string" ? { message: action.message.slice(0, 500) } : {}) } };
  if (type === "fail") return { expectedVersion: integerValue(raw.expectedVersion, "expectedVersion", 1), action: { type, message: stringValue(action.message, "错误说明", 500) } };
  throw new ClassroomError("INPUT_INVALID", "未知中控动作。", 400);
}
