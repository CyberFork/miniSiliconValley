import { resolveLearnerPolicy } from "./course-projection-core";
import { validateCoursePackage, type CoursePackage, type CoursePackageRef } from "./course-package";

/**
 * Deliberately small public allow-list. It never contains Block scripts,
 * private decks/cards, sources, rubrics, review queues, field ownership or
 * classroom state. Candidates cannot be projected through this API.
 */
export type PublicReleasedCourseSummary = {
  courseDataId: string;
  courseId: string;
  revision: number;
  name: string;
  period: string;
  description: string;
  learnerName: string;
  learnerRange: { defaultCount: number; minCount: number; maxCount: number };
  fiveSteps: Array<{ id: string; order: number; name: string; leadMentor: string; output: string }>;
  gameModes: Array<{ id: string; name: string; purpose: string }>;
  finale: { title: "六分钟 Demo Day"; description: string; durationSeconds: 360 };
};

export function projectReleasedCourseSummary(
  rawCourse: CoursePackage,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest" | "status">,
): PublicReleasedCourseSummary {
  const course = validateCoursePackage(rawCourse);
  if (ref.status !== "released") throw new Error("公开课程摘要只能从 Released exact 版本生成。");
  if (ref.courseId !== course.course.id || !Number.isInteger(ref.revision) || ref.revision < 0 || !/^[0-9a-f]{64}$/i.test(ref.digest)) {
    throw new Error("公开课程摘要的 exact 版本身份不完整或与课程不一致。");
  }
  const policy = resolveLearnerPolicy(course);
  return {
    courseDataId: `${ref.courseId}@r${ref.revision}:${ref.digest}`,
    courseId: ref.courseId,
    revision: ref.revision,
    name: course.course.name,
    period: course.course.period,
    description: course.course.description,
    learnerName: course.course.learnerName,
    learnerRange: {
      defaultCount: policy.defaultCount,
      minCount: policy.minCount,
      maxCount: policy.maxCount,
    },
    fiveSteps: course.formula.fiveSteps.map((step) => ({
      id: step.id,
      order: step.order,
      name: step.name,
      leadMentor: step.lead,
      output: step.output,
    })),
    gameModes: course.formula.threeGameModes.map((mode) => ({ ...mode })),
    finale: {
      title: "六分钟 Demo Day",
      description: course.formula.sixMinuteDemo,
      durationSeconds: 360,
    },
  };
}
