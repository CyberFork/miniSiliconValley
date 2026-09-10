import type { CoursePackageRef } from "./course-package";

export const FACTORY_MENTOR_ROLES = ["P", "D", "M", "O"] as const;
export type FactoryMentorRole = typeof FACTORY_MENTOR_ROLES[number];
export type FactoryEnvironment = "test" | "production";

export type FactoryChecklistItem = {
  id: "title" | "course" | "view" | "ui" | "courseware" | "mentors" | "learners" | "admin";
  label: string;
  ready: boolean;
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export type FactoryChecklistInput = {
  environment: FactoryEnvironment;
  title: string;
  course: {
    name: string;
    ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">;
    candidate: boolean;
    released: boolean;
  } | null;
  requestedRef?: { courseId: string; revision: number; digest?: string } | null;
  viewReceipt: { receiptId: string; valid: boolean; invalidReasons: string[] } | null;
  uiReceipt: { receiptId: string; valid: boolean; invalidReasons: string[] } | null;
  coursewareRefs: Array<{ mentorRole: string } | null>;
  coursewareMatchesReceipt: boolean;
  mentorIds: string[];
  learnerIds: string[];
  learnerCount: number;
  adminId: string;
  adminLockedToCreator: boolean;
};

export type FactoryChecklist = {
  ready: boolean;
  items: FactoryChecklistItem[];
  firstIssueId: FactoryChecklistItem["id"] | null;
};

export function buildFactoryChecklist(input: FactoryChecklistInput): FactoryChecklist {
  const previewHref = input.course ? exactPreviewHref(input.course.ref) : input.requestedRef ? exactPreviewHref(input.requestedRef) : "/studio/preview/";
  const items: FactoryChecklistItem[] = [];

  items.push(input.title.trim()
    ? { id: "title", label: "课堂名称", ready: true, message: "课堂名称已填写。" }
    : { id: "title", label: "课堂名称", ready: false, message: "请填写一个便于区分版本和场次的课堂名称。", actionHref: "#classroom-title", actionLabel: "填写名称" });

  if (!input.course) {
    const requested = input.requestedRef
      ? `指定版本 ${input.requestedRef.courseId} · r${input.requestedRef.revision} 当前不可用；系统没有替你换成另一门课。`
      : "当前还没有可供创建课堂的 Candidate 或 Released 课程。";
    items.push({ id: "course", label: "课程版本", ready: false, message: requested, actionHref: "/studio/editor/", actionLabel: "去课程编辑器" });
  } else if (input.environment === "production" && !input.course.released) {
    items.push({ id: "course", label: "课程版本", ready: false, message: `${courseLabel(input.course)} 仍是 Candidate；正式课堂只能使用 Released。`, actionHref: "/studio/releases/", actionLabel: "去验收与发布" });
  } else {
    items.push({ id: "course", label: "课程版本", ready: true, message: `${courseLabel(input.course)} 已锁定；创建时服务端会再次核对 digest。` });
  }

  if (!input.course) {
    items.push({ id: "view", label: "课程视图检查", ready: false, message: "先选择一门具体课程，才能检查该 exact 版本。", actionHref: previewHref, actionLabel: "查看视图验收" });
  } else if (!input.viewReceipt) {
    items.push({ id: "view", label: "课程视图检查", ready: false, message: `${courseLabel(input.course)} 还没有有效的多角色视图检查记录。`, actionHref: previewHref, actionLabel: "检查这个版本" });
  } else if (!input.viewReceipt.valid) {
    items.push({ id: "view", label: "课程视图检查", ready: false, message: `原视图检查已失效：${reasonText(input.viewReceipt.invalidReasons)}`, actionHref: previewHref, actionLabel: "重新检查这个版本" });
  } else {
    items.push({ id: "view", label: "课程视图检查", ready: true, message: `有效记录 ${input.viewReceipt.receiptId}。` });
  }

  if (input.environment === "production") {
    if (!input.uiReceipt) {
      items.push({ id: "ui", label: "真实课堂 UI 检查", ready: false, message: "还没有与这个课程版本和视图检查对应的有效 Test Classroom UI 记录。", actionHref: "/studio/releases/", actionLabel: "去完成 UI 验收" });
    } else if (!input.uiReceipt.valid) {
      items.push({ id: "ui", label: "真实课堂 UI 检查", ready: false, message: `原 UI 检查已失效：${reasonText(input.uiReceipt.invalidReasons)}`, actionHref: "/studio/releases/", actionLabel: "查看失效原因" });
    } else {
      items.push({ id: "ui", label: "真实课堂 UI 检查", ready: true, message: `有效记录 ${input.uiReceipt.receiptId}。` });
    }
  }

  const missingCourseware = FACTORY_MENTOR_ROLES.filter((role) => !input.coursewareRefs.some((ref) => ref?.mentorRole === role));
  if (missingCourseware.length) {
    items.push({ id: "courseware", label: "四套导师课件", ready: false, message: `还缺 ${missingCourseware.join("／")} 导师的可用 exact 课件。`, actionHref: "/studio/courseware/", actionLabel: "去导师课件库" });
  } else if (input.environment === "production" && !input.coursewareMatchesReceipt) {
    items.push({ id: "courseware", label: "四套导师课件", ready: false, message: "当前 Released 课件与 UI 验收时的 exact 版本不一致。", actionHref: "/studio/courseware/", actionLabel: "对齐课件版本" });
  } else {
    items.push({ id: "courseware", label: "四套导师课件", ready: true, message: "P／D／M／O 四套 exact 课件齐全。" });
  }

  const missingMentors = FACTORY_MENTOR_ROLES.filter((_, index) => !input.mentorIds[index]);
  const mentorDuplicates = duplicateCount(input.mentorIds);
  if (missingMentors.length) {
    items.push({ id: "mentors", label: "四位导师", ready: false, message: `还缺 ${missingMentors.join("／")} 导师账号。`, actionHref: "#mentor-members", actionLabel: "配置导师" });
  } else if (mentorDuplicates) {
    items.push({ id: "mentors", label: "四位导师", ready: false, message: `有 ${mentorDuplicates} 个重复导师席；P／D／M／O 必须使用四个不同账号。`, actionHref: "#mentor-members", actionLabel: "修正导师" });
  } else {
    items.push({ id: "mentors", label: "四位导师", ready: true, message: "P／D／M／O 已配置为四个不同账号。" });
  }

  const learnerMissing = Math.max(0, input.learnerCount - input.learnerIds.filter(Boolean).length);
  const learnerDuplicates = duplicateCount(input.learnerIds);
  if (!input.course) {
    items.push({ id: "learners", label: "学员席", ready: false, message: "先选择课程，系统才会使用该课程允许的真实人数范围。", actionHref: "#course-version", actionLabel: "选择课程" });
  } else if (learnerMissing) {
    items.push({ id: "learners", label: `${input.learnerCount} 位学员`, ready: false, message: `还缺 ${learnerMissing} 位学员账号。`, actionHref: "#learner-members", actionLabel: "配置学员" });
  } else if (learnerDuplicates) {
    items.push({ id: "learners", label: `${input.learnerCount} 位学员`, ready: false, message: `有 ${learnerDuplicates} 个重复学员席；每位学员必须使用不同账号。`, actionHref: "#learner-members", actionLabel: "修正学员" });
  } else if (input.learnerIds.length !== input.learnerCount) {
    items.push({ id: "learners", label: `${input.learnerCount} 位学员`, ready: false, message: `当前提供了 ${input.learnerIds.length} 个席位，必须与课程人数一致。`, actionHref: "#learner-members", actionLabel: "修正人数" });
  } else {
    items.push({ id: "learners", label: `${input.learnerCount} 位学员`, ready: true, message: "学员席数量正确且账号不重复。" });
  }

  items.push(input.adminId
    ? { id: "admin", label: "Admin DM", ready: true, message: input.adminLockedToCreator ? "创建者本人是初始 Admin DM；开课后可在成员管理中授权协作者。" : "已选择初始 Admin DM；此权限不占 P／D／M／O 导师席。" }
    : { id: "admin", label: "Admin DM", ready: false, message: "请选择一名初始 Admin DM。", actionHref: "#admin-dm", actionLabel: "选择 Admin DM" });

  const firstIssue = items.find((item) => !item.ready);
  return { ready: !firstIssue, items, firstIssueId: firstIssue?.id ?? null };
}

export function exactPreviewHref(ref: { courseId: string; revision: number; digest?: string }): string {
  const query = new URLSearchParams({ course: ref.courseId, revision: String(ref.revision) });
  if (ref.digest) query.set("digest", ref.digest);
  return `/studio/preview/?${query.toString()}`;
}

function courseLabel(course: NonNullable<FactoryChecklistInput["course"]>): string {
  return `${course.name} · r${course.ref.revision}`;
}

function duplicateCount(values: string[]): number {
  const present = values.filter(Boolean);
  return present.length - new Set(present).size;
}

function reasonText(reasons: string[]): string {
  return reasons.filter(Boolean).join("；") || "具体兼容条件已经变化，请重新检查。";
}
