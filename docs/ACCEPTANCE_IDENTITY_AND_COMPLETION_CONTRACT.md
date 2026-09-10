# 验收身份与完成契约

## 身份

Course、Courseware、Run 均必须使用 exact 的 id、revision、digest（及所属 schema/build 引用）。历史快照统一称 `archived`，只读可审计，不得作为当前 Candidate 或 Released 使用。`sourceCommit` 与 `appBuildId` 是 actual build provenance；projector/runtime contract 是兼容契约。纯 CSS 变更在兼容契约不变时不自动使全部回执失效。

## 完成与证据

末页解锁、导师 explicit finish、可选 evidence gates、作品验收互相解耦。默认没有作品门槛；只有 `CourseDefinition.rules.completion.requiredAcceptedSubmissionSchemaIds` 显式声明时，指定作品才阻塞完成。证据层级为源码、纯函数、API+DB、浏览器、人工、部署；禁止伪造人工回执、冒充操作者或用自动化勾选替代真实人工验收。Pad 实机验收仍属 T-088，尚未完成。
