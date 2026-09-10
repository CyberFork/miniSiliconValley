---
type: todo
id: T-102
title: "统一验收版本身份、课堂完成语义与测试矩阵"
status: complete
created: 2026-09-10
captured_by: project-inbox
priority: P1
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098, T-099, T-100, T-101]
related: [T-086, T-088, T-094, T-095]
---

# 统一验收版本身份、课堂完成语义与测试矩阵

## 已确认差异

- course-acceptance.ts:8–13固定projector-v5及minisv-t090-development-v1；它们是人工维护的契约常量，不是实际App构建ID。
- commit273c044修改course-platform、classroom-platform-store、course-preview和课件页，但未修改course-acceptance。相同课程内容仍可能复用旧兼容标识，不能证明验收过本次新投影逻辑。
- UI_ACCEPTANCE_REQUIRED_CHECKS实际16项（:16–33），架构/TESTING等仍写14项；清单由前端、后端、文档分别维护。
- applyScriptAction(:1031)到达最后解锁页即lifecycle=completed；acceptTestClassroom(:1141)检查的是解锁到末页。这不等于讲完末页、完成Demo或作品验收。
- T-086已明确剧本翻页不能被作品验收阻塞。因此本项需要澄清“解锁完成/课堂结束/作品通过”三种语义，**不是恢复旧逐块强制验收状态机**。
- listStudioCourseVersions将既非当前Candidate也非当前Released的历史快照标为approved（course-registry.ts:132），没有查询其是否真的被人工批准；状态名称容易误导。

## 实现建议

1. 分离实际sourceCommit/appBuildId（可追溯构建身份）与runtimeContractVersion/projectorContractVersion（兼容语义）；回执保留两者。
2. 影响验收的模块变更必须更新契约或提供显式兼容验证；不要求每次纯CSS发布让所有课程重验。
3. 验收项目ID来自唯一清单，前端文案和文档从同一清单维护/校验。
4. 讨论并记录课堂“结束”定义：建议解锁只推进边界，正式结束由DM明确确认；是否必填Demo证据交由课程负责人决定，不让AI自动改变教学流程。
5. 历史快照显示archived/superseded或“历史快照”，与已验收/已发布事实独立；未经回执不得标approved。
6. 质量闸区分：源码检查、纯函数测试、真实API+数据库、浏览器、人体验收、部署回执。各自证据不能替代。
7. 将本轮复现转为修复后回归：并发保存、课件r0→r1、弱网乱序、reset交错、跨课程/跨角色访问。
8. 标准测试入口应覆盖关键平台/QA/部署契约，避免只跑根npm test子集误认为已全量；新增自动化流水线时不自动生产部署。

## 验收

- [x] 页面能同时定位courseDataId、课件ref、runId及实际构建身份。
- [x] T-095级逻辑变化不会悄悄继承未验证兼容性。
- [x] 前后端和文档的验收项目数量/ID一致。
- [x] 解锁末页不会被误解释为学员完成作品；最终选定的结束规则有测试。
- [x] 自动化/模型没有权限伪造人工View/UI回执。
- [x] Pad真实流程仍明确归T-088验收，本任务没有用桌面缩小viewport冒充实机回执。
- [x] 修复后由团队对目标exact Candidate重新人工验收；实现与测试没有静默发布r11或其他版本。

## 创建入口可用性关联

[T-108](108-classroom-factory-empty-states-and-actionable-gates.md) 处理课程/人数下拉为空、创建按钮无反馈禁用、失效回执原因与下一步跳转。保持本任务的验收规则，不通过取消View/UI门禁修复界面问题。

## 完成记录（2026-09-11）

- 验收回执结构升级为 v2；新增 companion identity，分别保存实际 `sourceCommit/appBuildId` 与 projector/runtime compatibility contracts。构建变化本身可追溯，但只有兼容契约变化才使对应回执失效。
- 唯一 16 项清单位于 `app/lib/course-acceptance-contract.ts`，Runtime、后端必检 ID、TESTING 与 SOP 通过契约测试保持一致；旧 `fiveStepCompletion` 已替换为 `explicitClassroomFinish`。
- Classroom state machine 升级为 v3：末页解锁仍为 `running`，导师使用 run identity、script version 和幂等键显式结束；v2 既有课堂保留原语义，Test reset 才升级。
- 作品审核与剧本解锁继续解耦。默认无作品门槛；仅 exact CourseDefinition 显式声明的 `requiredAcceptedSubmissionSchemaIds` 在结束时检查 accepted 证据。
- 历史课程快照状态从误导性的 `approved` 改为 `archived`；没有生成、迁移或代签任何人工 View/UI 回执，也没有移动 Candidate/Released pointer。

### 工程验证

- `npm run typecheck`、`npm run lint`：通过。
- `npm run test:course-platform`：117/117 通过。
- `npm run build:minisv-app`、应用 smoke、真实 HTTP + 隔离 D1 E2E：通过。
- Chromium 自动化验证 exact 身份展开、13 页解锁、末页仍未结束、显式结束弹窗、16 项清单和无横向溢出；它只产生工程 QA 证据，没有签发人工回执。
- T-088 Pad 实机人工验收仍待执行，本任务未声称完成。

## T-103 兼容契约后续（2026-09-11）

- 投影核心已由服务端/浏览器两份手写实现收敛为一份源码和可重建浏览器产物。
- 因为人数越界不再静默裁剪，unknown Block 与空循环卡组改为统一失败语义，projector compatibility contract 从 v6 更新为 `course-projector-v7`。
- 历史 v6 回执保留但对当前 v7 门禁失效；未迁移、伪造或自动签发任何人工回执。
