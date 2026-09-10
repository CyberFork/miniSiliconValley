# Course Platform 操作 SOP（T-086）

## 目标与唯一生产线

本 SOP 面向课程负责人、导师与平台管理员。课程从编辑到正式课堂必须依次经过两次人工验收；任何页面都不能跳过服务端门禁。

```text
CourseDefinition Working Copy
  → 保存 Candidate（exact revision + digest）
  → 多角色视图验收（ViewAcceptanceReceipt）
  → 真实 TEST Classroom UI 验收（UiAcceptanceReceipt）
  → 发布 Released
  → 创建 PRODUCTION Classroom
```

导师课件是并行资源线。P／D／M／O 四套课件必须在创建 TEST 前选定；PRODUCTION 必须复用验收过且已发布的同一组 exact 版本。

## 角色与入口

- 平台管理员／导师：`/studio/`、`/classroom/`、`/course/`
- 学员：`/classroom/`
- Classroom Admin DM：`/classroom/{id}/control` 与 `/classroom/{id}/members`
- 共同投屏：`/classroom/{id}/screen`

Admin DM 是单个课堂的可分配权限，不是第五位导师。平台管理员没有某课堂 Membership 或 Admin DM 时，也不能读取该课堂。

## 0. 准备四套导师课件

1. 进入 `/studio/courseware/`（导师课件库）。
2. 为 P／D／M／O 上传或选择课件，并保存不可变 revision。
3. 通过 `/course/{slug}/?revision={revision}` 打开 exact 版本。
4. 确认准备在 UI 验收中使用的四套课件。
5. 如果要进入正式课堂，将这四个 exact 版本分别发布。

`/course/` 仅是“导师课件播放”，不编辑 CourseDefinition，也不推进课堂。

## 1. 编辑并保存 Candidate

1. 进入 `/studio/editor/`。
2. 选择 Google、饿了么或已创建课程。
3. 编辑五大步、Block、四导师任务、学员任务、卡牌、人数与验收门槛。
4. 使用工作区即时投影辅助编辑。此画面读取浏览器 Working Copy，不算正式验收。
5. 修复所有 Schema、卡组容量、稳定 ID 和来源问题。
6. 点击“保存 Candidate”。系统生成不可变 `courseId + revision + digest`。
7. 点击主操作“前往多角色视图验收”。

保存不会热更新任何已创建的 TEST 或 PRODUCTION 课堂。

## 2. 签发 ViewAcceptanceReceipt

1. 进入 `/studio/preview/`（多角色视图验收）。
2. 核对页面展示的 exact Candidate revision 与完整 digest。
3. 依次点击并查看全部 Block。
4. 依次查看课程声明支持的每个学员人数 N。
5. 检查四导师、N 学员、私人卡和底部中控是否映射正确。
6. 检查固定 seed 下发牌稳定、私密卡隔离且满足不重复规则。
7. 全部遍历完成后点击“确认并签发 ViewAcceptanceReceipt”。

服务端会重新计算“全部 Block × 全部支持人数”矩阵，不能仅凭浏览器勾选生成回执。课程 exact revision／digest 或投影兼容契约变化后，旧回执自动失效。回执同时记录实际 `sourceCommit`／`appBuildId` 以追溯验收构建；兼容契约不变时，纯样式构建不会自动令旧回执失效。

## 3. 创建真实 UI 验收课堂

1. 在验收成功提示中点击“创建 UI 验收课堂”，或从 `/studio/releases/` 进入。
2. `/classroom/#factory` 自动选择 `TEST` 和对应 exact Candidate。
3. 选择真实学员数 N、四个不同导师账号、N 个不同学员账号。
4. 为 P／D／M／O 绑定计划投产的四套 exact 课件。
5. 指定 Admin DM。导师创建课堂时本人必须是初始 Admin DM。
6. 点击“创建真实 UI 验收课堂”。

TEST Factory 会列出所有当前 Candidate／Released 并逐项显示“待视图检查／回执失效／已就绪”；没有有效 ViewAcceptanceReceipt 的版本可以被选择和检查，但不能创建。伪造或过期回执仍会被服务端拒绝。

如果课程、账号或课堂列表读取失败，使用对应区域的“重试”或“刷新创建条件”；页面会保留上次成功读取的数据以及仍合法的课堂名、人数和成员选择。若从 exact 深链进入后看到“当前不可用（未自动换课）”，先使用该版本旁的 exact 视图验收入口或明确手动选择其他版本，不要假定系统已经替你切换。

## 4. 运行并签发 UiAcceptanceReceipt

使用真实导师、学员、Admin DM 和投屏路由完整运行：

```text
打开已解锁剧本页 → 学员体验／讨论／保存作品 → 导师可独立审核作品
→ 当期导师弹窗确认解锁下一页 → 最后一页讲完 → 导师另行确认结束本次 Run
```

解锁、作品状态与课堂结束是三个解耦系统：作品可以被退回、重试或接受，但不会阻止回看或解锁下一页；末页被解锁也不会自动代表 Demo、作品或课堂已经完成。只有 CourseDefinition 显式声明 `rules.completion.requiredAcceptedSubmissionSchemaIds` 时，对应作品的“已通过”才会在导师确认结束时成为可选证据门槛。

课堂明确结束后，Admin DM 在中控逐项确认下方 16 项检查：

点击“签发 UiAcceptanceReceipt”。回执锁定课堂 ID、N、seed、reset generation、状态机版本、4 + N Membership、Admin DM、四套课件、浏览器／视口、构建 ID、操作者、时间与审计摘要。

TEST reset 会立即使既有 UI 回执失效，并从课堂绑定中解除。要再次发布，必须重新完整运行并签发。

## 5. 发布 Released

1. 返回 `/studio/releases/`。
2. 在目标 Candidate 查看五级门禁与“下一步主操作”。
3. 确认 ViewAcceptanceReceipt 与 UiAcceptanceReceipt 都显示有效。
4. 展开 UI 回执，确认 P／D／M／O 课件 revision／digest。
5. 点击“发布为 Released”。

服务端会重新验证当前 exact Candidate、两张回执、最大人数和卡组容量。任一引用不一致即拒绝，不产生半发布状态。

## 6. 创建 PRODUCTION 正式课堂

1. 在发布成功后的主操作中点击“创建 Production Classroom”。
2. Factory 自动切换为 `PRODUCTION` 并选择 exact Released。
3. 选择 UiAcceptanceReceipt。系统按回执自动回填四套 exact 课件。
4. 如果某套验收课件尚未发布为同一 revision／digest，先回导师课件库发布；系统不会静默替换为“最新版”。
5. 设置正式成员和学员人数。
6. 点击“创建 Production 正式课堂”。

PRODUCTION 不提供 reset。Studio 保存、重新发布、Preview 或 TEST reset 都不会修改已创建的正式课堂。

## 课堂中心识别规则

`/classroom/` 永久分成两组：

- `TEST · UI 验收课堂`：可重置，不进入正式学习档案。
- `PRODUCTION · 正式课堂`：不可重置，进入正式学习与审计。

两组使用同一套真实课堂组件。不存在第二套“UI Preview”页面、API 或状态机。

## 常见阻断

- `VIEW_ACCEPTANCE_RECEIPT_INVALID`：exact 版本／digest 或投影兼容契约已变化；重新完成视图验收。单独的兼容构建更新不会自动使回执失效。
- `VIEW_ACCEPTANCE_CAPACITY_INVALID`：某个声明支持的人数无法投影；补齐动态任务或卡牌后保存新 Candidate。
- `UI_ACCEPTANCE_CHECKS_INCOMPLETE`：16 项真实 UI 检查没有全部确认。
- `TEST_CLASSROOM_FINISH_REQUIRED`：剧本页已全部解锁，但导师尚未显式确认结束本次 Run。
- `CLASSROOM_FINISH_EVIDENCE_REQUIRED`：本课程显式声明的必需作品尚未通过；作品仍可继续补充并再次审核。
- `UI_ACCEPTANCE_RECEIPT_INVALID`：UI 回执已因 reset／版本变化失效，或课程、View 回执、课件包不匹配。
- `CONTROLLER_VERSION_CONFLICT`：另一位 Admin DM 已推进；刷新后按新版本操作。
- `PRODUCTION_RELEASE_REQUIRED`：正式课堂尝试使用 Candidate。
- `COURSEWARE_RELEASE_REQUIRED`：正式课堂课件尚未发布。
- `PRODUCTION_RESET_FORBIDDEN`：正式课堂禁止重置。
- `CLASSROOM_ACCESS_FORBIDDEN`：当前账号没有该实例的 Membership 或 Admin DM。
- `410 Gone`：使用了退休的 `/alpha` 或全局 `/control`；改用实例路由。

## 发布前最短核对

- [ ] Candidate exact revision／digest 已记录。
- [ ] 所有 Block 与所有支持人数都已验收。
- [ ] ViewAcceptanceReceipt 有效。
- [ ] 真实 TEST 已完整运行。
- [ ] 末页解锁后已由导师单独确认结束本次 Run。
- [ ] 16 项 UI 检查已完成。
- [ ] UiAcceptanceReceipt 有效。
- [ ] 四套课件 exact 版本与回执一致且已发布。
- [ ] Released 已生成。
- [ ] PRODUCTION 页面显示永久环境标识且没有 reset。


<!-- ui-acceptance-checklist:start -->
- `sameRuntimeUi`：Test 与 Production 使用同一套页面、API 与状态机
- `membershipsAndRbac`：四导师、N 学员、Admin DM 的 Membership 与 RBAC 均正确
- `mentorTasksAndCourseware`：四位导师各自看到正确任务与 exact 课件入口
- `learnerTasks`：每名学员都能看懂并完成当前私人任务
- `learnerPrivacy`：学员只看到自己的私密卡、RP 与个人钱包
- `sharedScreenRedaction`：公共投屏未泄漏手牌、讲稿、账号、钱包或未公开提交
- `scriptUnlockFlow`：导师确认后只顺序解锁下一页，不能跳页、重复或倒退
- `independentNavigation`：多人独立回看；新页解锁只通知、不强制其他窗口跳页
- `testRoleSwitching`：Test 角色 Tab 能真实切换中控、四导师、全部学员和投屏
- `explicitClassroomFinish`：末页解锁后由导师另行确认结束；解锁、结束和作品验收没有混为一件事
- `refreshAndRelogin`：刷新和重新登录后，席位、手牌与课堂进度保持正确
- `concurrencyConflict`：旧版本并发操作被拒绝，没有覆盖较新的解锁边界
- `testReset`：Test reset 已实测且只重置本课堂，不影响其他实例
- `responsiveLayouts`：手机、电脑与公共投屏尺寸均已人工检查
- `immutableRuntime`：Studio 后续保存没有热更新正在运行的课堂
- `exactVersions`：课程与 P／D／M／O 课件 revision／digest 与锁定值一致
<!-- ui-acceptance-checklist:end -->
