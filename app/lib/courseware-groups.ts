import type { ClassroomMentorRole } from "./classroom-factory";

const MENTOR_GROUPS = [
  { role: "P", label: "产品导师", description: "发现问题，把想法变成产品。" },
  { role: "D", label: "开发导师", description: "认识模块，用清楚的要求指导 AI 实现。" },
  { role: "M", label: "市场导师", description: "认识用户，验证需求，传递产品价值。" },
  { role: "O", label: "运营导师", description: "组织协作，让产品持续运行。" },
] as const;

const DEVELOPMENT_ORDER: Readonly<Record<string, number>> = {
  "cw-development-mentor-module-thinking": 0,
  "cw-development-mentor-ligun": 1,
};

/** Presentation only: retain exact records and authorization filtering upstream. */
export function groupCoursewareByMentor<T extends { packageId: string; mentorRole: ClassroomMentorRole }>(items: readonly T[]) {
  return MENTOR_GROUPS.map((group) => {
    const grouped = items.filter((item) => item.mentorRole === group.role);
    if (group.role === "D") grouped.sort((a, b) =>
      (DEVELOPMENT_ORDER[a.packageId] ?? 2) - (DEVELOPMENT_ORDER[b.packageId] ?? 2));
    return { ...group, items: grouped };
  });
}
