# T-086｜角色可见电子剧本课堂闭环

## 主棍

Mini Silicon Valley Classroom 不是一条强制所有人同步跳转的工作流，而是一组按角色分发、逐页解锁的电子剧本／PPT：

- 全课堂只共享“已经解锁到哪一页”。
- 每位导师、学员与投屏独立翻阅已经解锁的页面。
- 回看历史页不会修改课堂状态、提交、RP、钱包、团队资金或任何游戏记录。
- 导师确认后只解锁下一页并通知全员，不强制任何人的屏幕跳页。
- 学员不能解锁新页；P／D／M／O 任一导师和 Admin DM 都可以确认解锁。
- Test Classroom 可在同一真实运行时中切换角色视角并执行真实测试操作；Production 不提供角色切换。
- `leadMentorId` 只是本页建议主讲人，不是权限边界。

## 分层契约

1. **Script Layer**：角色可见内容、课程页序、全局已解锁边界、独立浏览页游标。
2. **Activity Layer**：信息卡、讨论、回答、提交、导师反馈与 Demo 作品；按 Block 持久化，但不阻塞翻页或解锁。
3. **Economy Layer**：个人 RP、个人钱包、团队资金、工具与账本；与脚本浏览完全解耦。
4. **Acceptance Layer**：Stage 1 验收角色内容投影；Stage 2 在真实 Test Classroom UI 中验收；两级 exact 回执共同门禁 Released。

## 不可妥协约束

- 不存在全局“当前页”；服务端只保存单调递增的 `unlockedThroughIndex`。
- 浏览位置属于每个浏览器视图，以 URL／本地 UI 状态表达，不能写成课堂业务状态。
- 非最新页始终提供“一键回到最新解锁页”。
- 右方向键在已解锁范围内只翻页；处于解锁边界时，学员收到“下一页尚未解锁”，导师弹出明确确认后才能解锁下一页。
- 解锁采用乐观并发版本，重复／过期操作不可越页或覆盖新状态，并记录真实 actor 与 Test effective identity。
- 既有课堂迁移以旧 `blockIndex` 作为已解锁边界；不删除提交、手牌、身份、RP、钱包、团队资金、账本或验收绑定。
- Test 角色切换只在目标 Test Classroom 内有效；不得进入 Studio、其他课堂或 Production，不得泄漏其他人的密码。
- Production 只显示登录者自己的角色剧本；服务端拒绝任何 Test-only 视角参数。
- `cyberforker.com` 不触碰；只部署 Hecate 的 `minisv.vip`。

## 交付范围

- [x] Stage 1：桌面多角色内容验收完整字段、Hover／点击固定、←／→ 切 B01—B13。
- [x] Classroom Center：普通点击、Enter、Cmd/Ctrl-click 均按浏览器语义可靠进入课堂。
- [x] Script Progress：全局解锁边界、独立页游标、通知、回到最新页、确认解锁。
- [x] Test Role Tabs：中控、P／D／M／O、学员 1…N、投屏；保持页码并使用真实 API。
- [x] Control：移除执行／提交验收／退回／尝试次数对导航的门禁，保留每页主持提示和现场数据雷达。
- [x] UI Acceptance：完成全部页解锁后可签发新 build 的 UiAcceptanceReceipt；旧 build 回执自动失效。
- [x] 测试与文档：单元、API、迁移、并发、权限、浏览器键盘／导航、生产隔离、操作手册。
- [ ] Hecate/minisv.vip 部署与生产冒烟回执。

## 验收

- B01 初始解锁；导师依次确认解锁至末页，不能跳号、倒退或重复写入。
- 两个用户分别停留在 B02／B05 时，解锁 B06 后只收到通知，页面不被强制切换。
- 任意已解锁历史页可左右翻阅，并一键回到最新解锁页。
- 刷新、重登和并发解锁后边界、私密视图、提交和经济数据都正确。
- Test 可切换所有角色并执行该角色的真实页面操作；Production 前后端都没有该能力。
- 学员只能看自己的私密卡与个人经济；共享投屏不泄漏私密卡、导师讲稿、账号、钱包或未公开提交。
- Candidate 经过 Stage 1 和完整 Test UI 验收后才可 Released；Production 只能绑定对应 exact Released 与有效 UI 回执。
