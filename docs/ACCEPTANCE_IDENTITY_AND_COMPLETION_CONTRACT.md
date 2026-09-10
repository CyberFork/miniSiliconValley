# 验收身份与完成契约

## 身份

Course、Courseware、Run 均必须使用 exact 的 id、revision、digest（及所属 schema/build 引用）。历史快照统一称 `archived`，只读可审计，不得作为当前 Candidate 或 Released 使用。`sourceCommit` 与 `appBuildId` 是 actual build provenance；projector/runtime contract 是兼容契约。纯 CSS 变更在兼容契约不变时不自动使全部回执失效。

## 完成与证据

末页解锁、导师 explicit finish、可选 evidence gates、作品验收互相解耦。默认没有作品门槛；只有 `CourseDefinition.rules.completion.requiredAcceptedSubmissionSchemaIds` 显式声明时，指定作品才阻塞完成。证据层级为源码、纯函数、API+DB、浏览器、人工、部署；禁止伪造人工回执、冒充操作者或用自动化勾选替代真实人工验收。Pad 实机验收仍属 T-088，尚未完成。

## T-103 投影兼容更新

`course-projector-v7` 将人数、任务、checkpoint 卡组、UTF-16 hash、shuffle、发牌及角色基础投影收敛为一份 TypeScript 真值，并由构建生成浏览器产物。它同时取消人数越界的浏览器静默裁剪，统一 unknown Block 与空循环卡组的失败语义。因此 v6 的 View/UI 回执保留为历史证据但不满足 v7 当前门禁；必须由真人对目标 exact 版本重新验收，自动化不得代签。
