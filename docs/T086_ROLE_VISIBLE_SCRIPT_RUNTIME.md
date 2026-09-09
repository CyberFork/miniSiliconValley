# T-086 Role-visible Script Runtime

## 运行模型

- Script Layer 仅 append-only 保存 `unlockedThroughBlockId`、`unlockedThroughBlockIndex`、`version`；B01 为初始边界，无全局当前页。
- 浏览器通过 `?block=Bxx` 独立浏览已解锁页；解锁通知不跳转。历史页可一键“回到最新”；支持 `←/→/Home/End`。
- Production 中 P/D/M/O 任一导师或 Admin DM 可在弹窗确认顺序解锁，学员不可。Test 任意参与者在角色 Tabs 中测试 Controller、四导师、N 学员及投屏；Production 禁止 `viewAs`。
- `leadMentorId` 只是主讲建议，不构成权限。

## 数据边界

Activity 按 `block + kind` 保存并覆盖同类记录；Economy、卡牌、浏览、解锁相互独立。回看/解锁不要求重新提交，不重置提交、RP、钱包或团队资金。“重新提交”不是状态，只有用户主动再次保存同一 block/kind 才更新记录。

遗留 `classroom_controller_states` 仅用于兼容镜像，Runtime 不读取。

## 验收与路由

1. Stage 1 `/studio/preview/`：内部桌面内容验收，完整字段、hover/点击固定展开、Block 键盘切换。
2. Stage 2 `/classroom/{id}/`：真实 Test Classroom UI；中控 `/control`，共同投屏 `/screen`。
3. exact `ViewAcceptanceReceipt` + `UiAcceptanceReceipt` 是 Released 门禁。

## 0007 迁移

仅将旧 `blockIndex` 解释为已解锁边界；保留提交、卡牌、RP、钱包、团队资金和历史 Activity，不重放旧流程或清空数据。

## 操作手册

- 导师：进入课堂席位，按 Block 浏览并保存 Activity；Production 由有权导师/Admin DM 确认解锁；需要时点击“回到最新”。
- 学员：在自己的席位查看任务与私密卡，按需回看历史；不能解锁、不能 viewAs。
- 测试验收者：在 Test 课堂依次打开 `/control`、四导师席位、N 学员席位和 `/screen`，核对隐私、并发与刷新恢复，再签发 UI 回执。

## 安全、审计与并发

Test 与 Production 按 classroomId 隔离；所有解锁确认记录 actor、effective identity、block、version 与时间。旧 version 的并发写入拒绝并可恢复；投屏永不包含私密卡、导师讲稿、账号、钱包或未公开提交。
