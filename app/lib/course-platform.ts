import {
  validateCoursePackage,
  type CoursePackage,
  type CoursePackageBlock,
  type CoursePackageCard,
  type CourseMentorRole,
  type CourseScriptCheckpoint,
} from "./course-package";
import {
  buildCoreRoleProjection,
  validateCourseInstantiationCore,
  type CourseInstantiationValidation,
} from "./course-projection-core";

export {
  privateDeckForBlock,
  resolveLearnerPolicy,
  type CourseInstantiationIssue,
  type CourseInstantiationValidation,
} from "./course-projection-core";

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
  contentContext: StudioMentorContentContext;
};

export type StudioMentorContentContext = {
  mode: "owner" | "handoff" | "none";
  scriptPackageId: string | null;
  scriptPackageTitle: string | null;
  ownerMentorRole: CourseMentorRole | null;
  checkpoint: CourseScriptCheckpoint | null;
  coursewareCue: CourseScriptCheckpoint["coursewareCue"] | null;
  note: string;
};

export type StudioLearnerView = StudioBaseView & {
  kind: "learner";
  learnerNumber: number;
  /** Exact deck selected by the current ScriptPackage checkpoint. */
  privateDeckId: string;
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

export type CoursewareBindingLike = {
  mentorRole: CourseMentorRole;
  packageId: string;
  slug: string;
  revision: number;
  digest: string;
};

/**
 * New content-owned ScriptPackages pin the exact teaching deck they were
 * authored against. Four mentor toolkits may still be bound to the Classroom,
 * but a silently different P deck must never drive the declared checkpoints.
 */
export function declaredCoursewareBindingIssues(
  course: CoursePackage,
  bindings: readonly CoursewareBindingLike[],
): string[] {
  return (course.contentPackages?.scriptPackages ?? []).flatMap((scriptPackage) => {
    const expected = scriptPackage.coursewareRef;
    const actual = bindings.find((binding) => binding.mentorRole === expected.mentorRole);
    if (!actual) return [`${scriptPackage.title} 缺少 ${expected.mentorRole} 导师 exact 课件。`];
    const fields = ["packageId", "slug", "revision", "digest"] as const;
    return fields.some((field) => actual[field] !== expected[field])
      ? [`${scriptPackage.title} 必须绑定 ${expected.packageId}/${expected.slug} r${expected.revision} · ${expected.digest}，当前 ${actual.packageId}/${actual.slug} r${actual.revision} · ${actual.digest}。`]
      : [];
  });
}

export function mentorContentContext(
  course: CoursePackage,
  block: CoursePackageBlock,
  mentorRole: CourseMentorRole,
): StudioMentorContentContext {
  const scripts = course.contentPackages?.scriptPackages ?? [];
  const owned = scripts.find((scriptPackage) => scriptPackage.ownerMentorRole === mentorRole
    && scriptPackage.checkpoints.some((checkpoint) => checkpoint.blockIds.includes(block.id)));
  if (owned) {
    const checkpoint = owned.checkpoints.find((item) => item.blockIds.includes(block.id))!;
    return {
      mode: "owner",
      scriptPackageId: owned.id,
      scriptPackageTitle: owned.title,
      ownerMentorRole: owned.ownerMentorRole,
      checkpoint: structuredClone(checkpoint),
      coursewareCue: structuredClone(checkpoint.coursewareCue),
      note: `${mentorRole} 是本案例检查点的内容所有者；课件只按章节范围提示，不做脆弱的逐页状态绑定。`,
    };
  }
  const handoff = scripts.find((scriptPackage) => {
    if (!scriptPackage.handoff || scriptPackage.handoff.toMentorRole !== mentorRole) return false;
    const availableAt = course.blocks.find((item) => item.id === scriptPackage.handoff!.availableAtBlockId)?.order ?? Number.POSITIVE_INFINITY;
    return block.order >= availableAt;
  });
  if (handoff?.handoff) {
    return {
      mode: "handoff",
      scriptPackageId: handoff.id,
      scriptPackageTitle: handoff.title,
      ownerMentorRole: handoff.ownerMentorRole,
      checkpoint: null,
      coursewareCue: null,
      note: handoff.handoff.summary,
    };
  }
  return {
    mode: "none",
    scriptPackageId: null,
    scriptPackageTitle: null,
    ownerMentorRole: null,
    checkpoint: null,
    coursewareCue: null,
    note: "本页没有分配给你的案例私有剧本；按席位任务观察或支援，不重复主讲案例历史。",
  };
}

export function validateCourseInstantiation(course: CoursePackage, learnerCount: number): CourseInstantiationValidation {
  validateCoursePackage(course);
  return validateCourseInstantiationCore(course, learnerCount);
}

export function assertCourseCanInstantiate(course: CoursePackage, learnerCount: number): void {
  const validation = validateCourseInstantiation(course, learnerCount);
  if (!validation.ok) throw new Error(validation.issues.map((issue) => issue.message).join("\n"));
}

export function buildStudioProjection(
  course: CoursePackage,
  input: { learnerCount: number; blockId: string; seed: string },
): StudioProjection {
  validateCoursePackage(course);
  const core = buildCoreRoleProjection(course, input);
  const block = course.blocks[core.blockIndex];
  const mentorViews: StudioMentorView[] = core.mentorViews.map((view) => ({
    ...view,
    contentContext: mentorContentContext(course, block, view.mentorRole),
  }));
  const learnerViews: StudioLearnerView[] = core.learnerViews.map((view) => structuredClone(view));
  const controllerView: StudioControllerView = structuredClone(core.controllerView);
  return {
    courseId: core.courseId,
    learnerCount: core.learnerCount,
    blockId: core.blockId,
    mentorViews,
    learnerViews,
    controllerView,
    views: [...mentorViews, ...learnerViews, controllerView],
  };
}
