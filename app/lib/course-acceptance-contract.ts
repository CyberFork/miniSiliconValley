/**
 * Compatibility versions change only when the meaning of the corresponding
 * projection/runtime changes.  A source commit and app build identify the
 * concrete artifact, but a pure styling release does not invalidate receipts
 * while these contracts remain compatible.
 */
export const COURSE_PROJECTOR_CONTRACT_VERSION = "course-projector-v6";
export const CLASSROOM_RUNTIME_CONTRACT_VERSION = "classroom-runtime-v3";

export const UI_ACCEPTANCE_CHECKLIST = [
  { id: "sameRuntimeUi", label: "Test 与 Production 使用同一套页面、API 与状态机" },
  { id: "membershipsAndRbac", label: "四导师、N 学员、Admin DM 的 Membership 与 RBAC 均正确" },
  { id: "mentorTasksAndCourseware", label: "四位导师各自看到正确任务与 exact 课件入口" },
  { id: "learnerTasks", label: "每名学员都能看懂并完成当前私人任务" },
  { id: "learnerPrivacy", label: "学员只看到自己的私密卡、RP 与个人钱包" },
  { id: "sharedScreenRedaction", label: "公共投屏未泄漏手牌、讲稿、账号、钱包或未公开提交" },
  { id: "scriptUnlockFlow", label: "导师确认后只顺序解锁下一页，不能跳页、重复或倒退" },
  { id: "independentNavigation", label: "多人独立回看；新页解锁只通知、不强制其他窗口跳页" },
  { id: "testRoleSwitching", label: "Test 角色 Tab 能真实切换中控、四导师、全部学员和投屏" },
  { id: "explicitClassroomFinish", label: "末页解锁后由导师另行确认结束；解锁、结束和作品验收没有混为一件事" },
  { id: "refreshAndRelogin", label: "刷新和重新登录后，席位、手牌与课堂进度保持正确" },
  { id: "concurrencyConflict", label: "旧版本并发操作被拒绝，没有覆盖较新的解锁边界" },
  { id: "testReset", label: "Test reset 已实测且只重置本课堂，不影响其他实例" },
  { id: "responsiveLayouts", label: "手机、电脑与公共投屏尺寸均已人工检查" },
  { id: "immutableRuntime", label: "Studio 后续保存没有热更新正在运行的课堂" },
  { id: "exactVersions", label: "课程与 P／D／M／O 课件 revision／digest 与锁定值一致" },
] as const;

export type UiAcceptanceCheckId = (typeof UI_ACCEPTANCE_CHECKLIST)[number]["id"];
export type UiAcceptanceChecks = Record<UiAcceptanceCheckId, boolean>;

export const UI_ACCEPTANCE_REQUIRED_CHECKS = UI_ACCEPTANCE_CHECKLIST.map((item) => item.id) as UiAcceptanceCheckId[];

export function renderUiAcceptanceChecklistMarkdown(): string {
  return UI_ACCEPTANCE_CHECKLIST.map((item) => `- \`${item.id}\`：${item.label}`).join("\n");
}
