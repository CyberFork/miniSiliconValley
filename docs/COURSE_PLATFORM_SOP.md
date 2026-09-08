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

服务端会重新计算“全部 Block × 全部支持人数”矩阵，不能仅凭浏览器勾选生成回执。课程 digest、投影器兼容版本或验收构建版本变化后，旧回执自动失效。

## 3. 创建真实 UI 验收课堂

1. 在验收成功提示中点击“创建 UI 验收课堂”，或从 `/studio/releases/` 进入。
2. `/classroom/#factory` 自动选择 `TEST` 和对应 exact Candidate。
3. 选择真实学员数 N、四个不同导师账号、N 个不同学员账号。
4. 为 P／D／M／O 绑定计划投产的四套 exact 课件。
5. 指定 Admin DM。导师创建课堂时本人必须是初始 Admin DM。
6. 点击“创建真实 UI 验收课堂”。

没有有效 ViewAcceptanceReceipt 的版本不会出现在 TEST 可选列表；伪造或过期回执会被服务端拒绝。

## 4. 运行并签发 UiAcceptanceReceipt

使用真实导师、学员、Admin DM 和投屏路由完整运行：

```text
准备 → 执行 → 收齐结果 → 接受／退回 → 下一 Block
最后 Block：接受 → 完成整门课程
```

完成后，Admin DM 在中控逐项确认 14 项检查：

- TEST／PRODUCTION 同源运行时；
- Membership 与 RBAC；
- 四导师任务及 exact 课件；
- 学员任务；
- 学员私密卡、RP 与钱包隔离；
- 公共投屏脱敏；
- Block 执行、退回、重试与推进；
- 五大步和全部 Block 完成；
- 刷新与重新登录；
- 并发版本冲突；
- TEST reset；
- 手机、电脑与投屏布局；
- 运行实例不受 Studio 后续保存影响；
- 课程与课件 exact 版本。

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

- `VIEW_ACCEPTANCE_RECEIPT_INVALID`：版本、digest、投影器或构建已变化；重新完成视图验收。
- `VIEW_ACCEPTANCE_CAPACITY_INVALID`：某个声明支持的人数无法投影；补齐动态任务或卡牌后保存新 Candidate。
- `UI_ACCEPTANCE_CHECKS_INCOMPLETE`：14 项真实 UI 检查没有全部确认。
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
- [ ] 14 项 UI 检查已完成。
- [ ] UiAcceptanceReceipt 有效。
- [ ] 四套课件 exact 版本与回执一致且已发布。
- [ ] Released 已生成。
- [ ] PRODUCTION 页面显示永久环境标识且没有 reset。
