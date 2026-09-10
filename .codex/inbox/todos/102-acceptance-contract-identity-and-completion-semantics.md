---
type: todo
id: T-102
title: "统一验收版本身份、课堂完成语义与测试矩阵"
status: backlog
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

- [ ] 页面能同时定位courseDataId、课件ref、runId及实际构建身份。
- [ ] T-095级逻辑变化不会悄悄继承未验证兼容性。
- [ ] 前后端和文档的验收项目数量/ID一致。
- [ ] 解锁末页不会被误解释为学员完成作品；最终选定的结束规则有测试。
- [ ] 自动化/模型没有权限伪造人工View/UI回执。
- [ ] Pad真实流程按T-088验收，而非仅在桌面缩小viewport。
- [ ] 修复后重新确定需要人验收的exact Candidate；不静默把旧r11或其他版本直接发布。

