# T-111｜多 Test Classroom、归档与依赖受控删除

> 状态：实现与隔离自动化完成；等待本轮生产发布后更新线上回执
> 日期：2026-09-11

## 1. 生命周期不是同义按钮

- **重置**：保留 classroomId，开始新的 run generation。
- **归档**：保留整场数据和历史证据，只读，不可原地恢复。
- **删除**：对无阻断依赖的指定 TEST 做物理级联删除；活跃列表、历史列表与旧运行链接都不再可用。

归档不能代替删除。删除后只留下不含学员正文、私卡正文或作品内容的不可变最小墓碑，用于幂等重放、旧链接 410 与安全审计。

## 2. UI 流程

课堂中心的活跃 TEST 卡和“已归档测试课堂”历史卡，都为该课堂真实 Admin DM 显示“删除测试课堂”。Production 和无权限账号不显示入口。

自定义二次确认框在任何写入前从服务端读取并展示：

- 标题、classroomId、TEST / lifecycle、exact course revision 与 digest；
- 将删除的 Membership、提交、私卡、经济、运行/课堂审计记录数量；
- 明确保留的共享账号、课程 JSON、导师课件、其他课堂和平台级证据；
- 每一组阻断依赖及其 reference ID。

用户必须勾选“确认永久删除这一个 TEST”后才能提交。取消不产生请求。网络失败、并发冲突或新增依赖时，弹窗保留并重新读取目标，明确写出“删除没有执行”。

## 3. API 与权限

```http
GET    /api/platform/classrooms/{classroomId}?deletePreview=1
DELETE /api/platform/classrooms/{classroomId}
```

两者都要求真实登录的该课堂 Admin DM；测试身份模拟、普通导师、学员和 Production 均被服务端拒绝。DELETE 需要：

```text
expectedRunId + expectedResetGeneration + expectedScriptVersion
+ expectedStateToken + confirmClassroomId + idempotencyKey + optional reason
```

同一操作者以完全相同幂等键重试会得到同一删除结果；其他请求返回 410，不会误删同名或相邻课堂。

## 4. 依赖门禁

以下任一引用存在即禁止删除，并建议保留只读归档：

1. `course_ui_acceptance_receipts` 真实 UI 验收回执；
2. `course_test_receipts` 历史验收记录；
3. `course_release_pointers.approval_json` 发布批准链；
4. 通过该 UI 回执建立的 Production Classroom。

应用层预览和 DELETE 会重复检查；数据库 `trg_classroom_deletion_evidence_guard` 再次失败关闭，直接 SQL 也不能绕过证据边界。

## 5. 原子删除与数据边界

`drizzle/0015_test_classroom_deletions.sql` 新增：

- `classroom_deletions`：无 rooms 外键、不可 UPDATE/DELETE 的墓碑；
- TEST-only 与 evidence guard；
- room delete guard：ClassroomInstance 必须先有合法墓碑；
- archive delete guard：只有同一事务已经写入墓碑时，归档标记才允许被清理。

一次 D1 batch 完成：墓碑 CAS → 事务断言 → 删除可选归档标记 → 删除 room 并依靠 FK 级联清除课堂私有行 → 写平台安全事件。任一节点失败，整批回滚。

确认预览使用 room/script/run、factory events、submission revisions 以及五类影响计数作 CAS 见证；确认期间发生作品更新、课堂动作、发牌/经济/审计行新增或证据依赖，都中止而不留下半删除状态。

全局 `auth_users`、`profiles`、`course_versions`、`courseware_versions`、其他课堂与跨课堂账号从不作为删除目标。

## 6. 自动化证据

单元/数据库测试覆盖：

- 无依赖活跃 TEST 的真实物理删除、旧链接 410、列表消失；
- 无依赖归档 TEST 从历史入口真实删除；
- 5 个 batch 节点逐点故障注入全部回滚；
- 同幂等键重放、不同键拒绝、目标隔离与共享资源计数不变；
- 作品同数量更新和新审计行两类 stale preview 均冲突；
- UI 回执/发布证据数据库门禁、Production 目标拒绝、学员权限拒绝；
- 墓碑不可改删，且不含测试中的私有作品正文。

编译后浏览器 + 临时本地 D1 覆盖：

- 活跃列表打开弹窗、取消无写入、勾选二次确认后真实删除；
- 历史列表真实删除归档 TEST；
- 旧链接均为 410；幂等重试有效；
- 合成自动化 UI 回执显示具体 blocker（明确不是人工验收）；
- 中断 DELETE 网络后目标仍在，界面明确说明未执行；
- 学员无按钮且 API 为 403；Pad 无横向溢出。

机器证据：`docs/qa/t111-test-classrooms/browser-automated-evidence.json`。

```bash
npm run test:t111:browser
```

## 7. 发布边界

- 部署前必须先备份停止状态的 D1 数据；新应用启动时幂等创建删除表与升级归档 guard。
- 自动化只操作临时 D1，绝不拿用户真实 TEST / Production 做破坏性冒烟。
- 线上复验只检查构建身份、鉴权门禁、页面/脚本标记和只读 API 行为。
- 没有代替用户签署 ViewAcceptanceReceipt 或 UiAcceptanceReceipt。
