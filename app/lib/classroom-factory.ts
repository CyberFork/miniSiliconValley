import type { CoursePackageRef } from "./course-package";

/**
 * Version 2 replaces the coupled execute/accept/advance controller with an
 * append-only script-unlock frontier.  Activity submissions and economy data
 * remain independent of this value.
 */
export const CLASSROOM_STATE_MACHINE_VERSION = 2 as const;
export const CLASSROOM_MENTOR_ROLES = ["P", "D", "M", "O"] as const;
export type ClassroomMentorRole = (typeof CLASSROOM_MENTOR_ROLES)[number];
export type ClassroomEnvironment = "test" | "production";
export type ClassroomLifecycle = "draft" | "ready" | "running" | "completed" | "reset";

export interface ExactCoursewareRef {
  mentorRole: ClassroomMentorRole;
  packageId: string;
  slug: string;
  revision: number;
  digest: string;
}

export interface ClassroomFactoryRequest {
  environment: ClassroomEnvironment;
  title: string;
  learnerCount: number;
  courseRef: CoursePackageRef;
  viewAcceptanceReceiptId: string;
  uiAcceptanceReceiptId?: string;
  coursewareRefs: ExactCoursewareRef[];
  adminDmProfileIds: string[];
  mentorSeats: Array<{ mentorRole: ClassroomMentorRole; profileId: string }>;
  learnerProfileIds: string[];
}

export interface ClassroomScriptProgress {
  stateMachineVersion: typeof CLASSROOM_STATE_MACHINE_VERSION;
  unlockedThroughBlockId: string;
  unlockedThroughIndex: number;
  version: number;
  updatedAt: string;
}

export type ClassroomScriptAction = { type: "unlock-next"; nextBlockId: string };

export interface ClassroomFactoryPlan {
  factoryKey: string;
  environment: ClassroomEnvironment;
  stateMachineVersion: typeof CLASSROOM_STATE_MACHINE_VERSION;
  lifecycle: "ready";
  title: string;
  learnerCount: number;
  courseRef: CoursePackageRef;
  viewAcceptanceReceiptId: string;
  uiAcceptanceReceiptId: string | null;
  coursewareRefs: ExactCoursewareRef[];
  mentorSeats: Array<{ mentorRole: ClassroomMentorRole; profileId: string; membershipKey: string }>;
  learnerMemberships: Array<{ profileId: string; seat: number; membershipKey: string }>;
  adminPermissions: Array<{ profileId: string; permission: "admin-dm" }>;
  initialScriptProgress: ClassroomScriptProgress;
}

function exactRoles(values: readonly ClassroomMentorRole[]): boolean {
  return values.length === CLASSROOM_MENTOR_ROLES.length
    && CLASSROOM_MENTOR_ROLES.every((role) => values.filter((value) => value === role).length === 1);
}

function identifier(value: string, label: string): void {
  if (!value.trim() || value.length > 128) throw new Error(`${label} 无效。`);
}

function sha256(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} 必须是 64 位小写 SHA-256。`);
}

/** Pure invariant guard shared by HTTP validation and the persistent factory. */
export function assertClassroomFactoryRequest(input: ClassroomFactoryRequest): void {
  if (input.environment !== "test" && input.environment !== "production") throw new Error("课堂环境只能是 test 或 production。");
  identifier(input.title, "课堂名称");
  if (!Number.isInteger(input.learnerCount) || input.learnerCount < 1 || input.learnerCount > 24) {
    throw new Error("learnerCount 必须是 1—24 的整数。");
  }
  identifier(input.courseRef.courseId, "courseId");
  if (!Number.isInteger(input.courseRef.revision) || input.courseRef.revision < 0) throw new Error("课程 revision 无效。");
  sha256(input.courseRef.digest, "课程 digest");
  identifier(input.viewAcceptanceReceiptId, "多角色视图验收回执");
  if (input.environment === "production" && input.courseRef.status !== "released") {
    throw new Error("正式课堂只能绑定 Released 课程版本。");
  }
  if (input.environment === "production") identifier(input.uiAcceptanceReceiptId ?? "", "真实课堂 UI 验收回执");
  if (input.environment === "test" && input.uiAcceptanceReceiptId) {
    throw new Error("Test Classroom 不应绑定 Production 使用的 UI 验收回执。");
  }
  if (input.environment === "test" && input.courseRef.status !== "candidate" && input.courseRef.status !== "released") {
    throw new Error("测试课堂只能绑定 Candidate 或 Released 课程版本。");
  }
  if (!exactRoles(input.mentorSeats.map((seat) => seat.mentorRole))) throw new Error("必须且只能提供 P、D、M、O 四个导师席。");
  if (new Set(input.mentorSeats.map((seat) => seat.profileId)).size !== input.mentorSeats.length) throw new Error("四个导师席必须使用四个不同账号。");
  for (const seat of input.mentorSeats) identifier(seat.profileId, `${seat.mentorRole} 导师账号`);
  if (input.learnerProfileIds.length !== input.learnerCount) throw new Error("学员账号数量必须等于 learnerCount。");
  if (new Set(input.learnerProfileIds).size !== input.learnerProfileIds.length) throw new Error("学员账号不能重复。");
  for (const profileId of input.learnerProfileIds) identifier(profileId, "学员账号");
  if (input.learnerProfileIds.some((profileId) => input.mentorSeats.some((seat) => seat.profileId === profileId))) {
    throw new Error("同一账号不能同时占用导师席和学员席。");
  }
  if (!exactRoles(input.coursewareRefs.map((ref) => ref.mentorRole))) throw new Error("四位导师都必须绑定 exact 课件版本。");
  for (const ref of input.coursewareRefs) {
    identifier(ref.packageId, `${ref.mentorRole} 课件 packageId`);
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(ref.slug)) throw new Error(`${ref.mentorRole} 课件 slug 无效。`);
    if (!Number.isInteger(ref.revision) || ref.revision < 0) throw new Error(`${ref.mentorRole} 课件 revision 无效。`);
    sha256(ref.digest, `${ref.mentorRole} 课件 digest`);
  }
  if (!input.adminDmProfileIds.length) throw new Error("至少需要一个 Admin DM 权限账号。");
  if (new Set(input.adminDmProfileIds).size !== input.adminDmProfileIds.length) throw new Error("Admin DM 权限账号不能重复。");
  for (const profileId of input.adminDmProfileIds) identifier(profileId, "Admin DM 账号");
}

function stableKey(seed: string, ...parts: Array<string | number>): string {
  let hash = 2166136261;
  const text = [seed, ...parts].join("\u0000");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildClassroomFactoryPlan(input: ClassroomFactoryRequest, factorySeed: string): ClassroomFactoryPlan {
  assertClassroomFactoryRequest(input);
  identifier(factorySeed, "factorySeed");
  const orderedMentors = CLASSROOM_MENTOR_ROLES.map((role) => input.mentorSeats.find((seat) => seat.mentorRole === role)!);
  const orderedCourseware = CLASSROOM_MENTOR_ROLES.map((role) => input.coursewareRefs.find((ref) => ref.mentorRole === role)!);
  return {
    factoryKey: `factory-${stableKey(factorySeed, input.title, input.courseRef.digest)}`,
    environment: input.environment,
    stateMachineVersion: CLASSROOM_STATE_MACHINE_VERSION,
    lifecycle: "ready",
    title: input.title.trim(),
    learnerCount: input.learnerCount,
    courseRef: structuredClone(input.courseRef),
    viewAcceptanceReceiptId: input.viewAcceptanceReceiptId,
    uiAcceptanceReceiptId: input.uiAcceptanceReceiptId ?? null,
    coursewareRefs: structuredClone(orderedCourseware),
    mentorSeats: orderedMentors.map((seat) => ({
      ...seat,
      membershipKey: `mentor-${seat.mentorRole.toLowerCase()}-${stableKey(factorySeed, seat.mentorRole, seat.profileId)}`,
    })),
    learnerMemberships: input.learnerProfileIds.map((profileId, index) => ({
      profileId,
      seat: index + 1,
      membershipKey: `learner-${index + 1}-${stableKey(factorySeed, index + 1, profileId)}`,
    })),
    adminPermissions: input.adminDmProfileIds.map((profileId) => ({ profileId, permission: "admin-dm" as const })),
    initialScriptProgress: {
      stateMachineVersion: CLASSROOM_STATE_MACHINE_VERSION,
      unlockedThroughBlockId: "B01",
      unlockedThroughIndex: 0,
      version: 1,
      updatedAt: new Date(0).toISOString(),
    },
  };
}

export function canActorAdministerClassroom(
  profileId: string,
  permissions: ReadonlyArray<{ profileId: string; permission: string }>,
): boolean {
  return permissions.some((permission) => permission.profileId === profileId && permission.permission === "admin-dm");
}

export function unlockNextScriptPage(
  current: ClassroomScriptProgress,
  action: ClassroomScriptAction,
  orderedBlockIds: readonly string[],
  at: string,
): ClassroomScriptProgress {
  const expectedIndex = current.unlockedThroughIndex + 1;
  if (expectedIndex >= orderedBlockIds.length) throw new Error("全部剧本页已经解锁。");
  const expectedBlockId = orderedBlockIds[expectedIndex];
  if (action.nextBlockId !== expectedBlockId) {
    throw new Error(`下一页必须是 ${expectedBlockId}，不能跳页或解锁旧页。`);
  }
  return {
    stateMachineVersion: CLASSROOM_STATE_MACHINE_VERSION,
    unlockedThroughBlockId: expectedBlockId,
    unlockedThroughIndex: expectedIndex,
    version: current.version + 1,
    updatedAt: at,
  };
}
