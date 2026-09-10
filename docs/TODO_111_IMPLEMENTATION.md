# T-111｜多 Test Classroom 与只读归档实现

> 状态：本地实现与自动化验证完成，等待统一发布队列部署  
> 日期：2026-09-11  
> 受众：课程负责人、Admin DM、平台开发与 QA

## 1. 交付结果

课堂中心现在把 Test Classroom 当作可并存的独立运行实例，而不是一门课只有一个“测试槽位”：

- TEST 区标题旁固定显示“＋ 新建测试课堂”，普通单击即可定位 `#factory`。
- 同一 exact 课程版本可以创建多场 Test；r9、r12 等不同 revision 也能并存。
- 每张课堂卡明确显示 `classroomId`、`courseId@revision`、完整 digest、最后更新时间、run generation、学员人数和真实 lifecycle。
- 默认课堂名包含课程名和 revision；手动改名后，切换环境或课程不会覆盖用户名称。
- 活跃 Test 可由该课堂 Admin DM 归档；归档后进入独立历史区，仍可打开 exact 只读档案，或从同一 exact 版本创建新 Test。
- 不实现硬删除或原地恢复。需要继续测试时创建新实例，避免审计、作品与验收回执悬空。

## 2. 生命周期决策

三个操作的语义严格分开：

1. **重置**：同一 `classroomId` 开启下一个 run generation，清理本 run 的可变测试数据。
2. **归档**：不改变最后一个真实 lifecycle，只增加一次不可变保留标记；整个课堂从此只读。
3. **永久删除**：当前产品不提供。课堂可能被 UI 回执、发布记录、作品或审计引用，硬删风险大于收益。

数据库新增 `classroom_archives`。它是一对一、只增不改的记录：

```text
room_id + previous_lifecycle + reset_generation + script_version
+ archived_by_profile_id + idempotency_key + reason + archived_at
```

数据库触发器保证：

- 只有 `environment=test` 的 ClassroomInstance 可写入。
- 归档记录不能 `UPDATE` 或 `DELETE`。
- `room_id` 唯一，一场课堂只能进入历史一次。

`rooms.status = archived` 仅作旧运行时兼容镜像；`classroom_archives` 才是当前归档真值。`classroom_instances.lifecycle` 保留归档前的 `ready/running/completed`，因此历史不会被伪装成另一个运行阶段。

## 3. API 与并发契约

入口：

```http
POST /api/platform/classrooms/{classroomId}/archive
Content-Type: application/json
```

请求必须同时携带：

```json
{
  "expectedRunId": "{classroomId}:run:{resetGeneration}",
  "expectedResetGeneration": 4,
  "expectedScriptVersion": 7,
  "idempotencyKey": "archive.<uuid>",
  "reason": "r13 已替代本轮测试"
}
```

服务端按真实账号校验该课堂 Admin DM 权限。Test 身份模拟、普通导师、学员和 Production 均不能归档。归档事务一次写入：

1. 不可变归档标记；
2. 原子断言；
3. legacy room 状态镜像；
4. Classroom 更新时间；
5. `classroom.test-archived` 审计事件。

run generation 或 script version 在确认弹窗打开后发生变化时，归档失败关闭，不会留下半个归档。同一操作者以同一幂等键重放会返回同一结果；其他重放明确返回 `CLASSROOM_ALREADY_ARCHIVED`。

## 4. 只读边界

归档后仍允许：

- 查看任意已解锁剧本页；
- 切换历史角色视角；
- 查看成员、作品、手牌、资金和诊断信息；
- 打开锁定的 exact 导师课件；
- 从相同 exact 课程版本创建另一场 Test。

归档后服务端拒绝：

- 解锁下一页或结束 run；
- reset；
- 学员提交与导师审核；
- 修改导师、学员或 Admin DM；
- 创建该课堂专属账号或管理 Test 身份；
- 签发新的 UiAcceptanceReceipt。

浏览器也显示醒目的只读横幅并隐藏／禁用写操作，但前端限制不是权限边界；所有关键写入口均由服务端再次检查。

## 5. 验收回执政策

归档不会删除已签发的 UiAcceptanceReceipt。该回执继续可查询并保留其原始内容，但即时变为无效，原因明确显示：

> 来源 Test Classroom 已归档；回执仅保留为历史证据。

因此，归档来源课堂后不能再用旧 UI 回执发布新 Released 或创建新的 Production。若仍需发布，创建新 Test，重新完整运行并进行人工 UI 验收。

Studio 的发布流水线只把未归档 Test 算作活跃验收课堂；历史数量单独显示，避免“已有归档课堂”被误判为当前可验收状态。

## 6. 自动化证据

核心验证：

```bash
npm run typecheck
npm run lint
npm run test:course-platform
npm run build:minisv-app
npm run test:t111:browser
```

覆盖：

- 同 exact 多实例和新 Candidate 多 revision 并存；
- 原课堂不会被新 Candidate 热更新；
- 五个事务节点逐点故障注入均完整回滚；
- 无权限、Production、陈旧 run/script、重复请求失败关闭；
- 归档只影响目标 Test，其他课堂保持活跃；
- 归档记录数据库级不可变；
- 所有当前课堂写入口只读保护；
- 旧 UI 回执保留但失效；
- 编译后真实 ClassroomHub 的普通点击、定向深链、自定义确认框与 390/768px 布局。

浏览器自动化只使用临时本地 D1 和被拦截的合成课堂列表，没有访问生产数据，也没有代签人工验收回执。机器证据在 `docs/qa/t111-test-classrooms/`。

## 7. 部署注意

- 先应用 `drizzle/0012_test_classroom_archives.sql`，再切换包含归档查询的新应用，避免应用先查询不存在的表。
- 发布包必须包含同步生成的 `db/schema-statements.ts`。
- 部署后只做鉴权、页面、API schema 与空数据冒烟；不得拿真实课堂执行归档验证。
- 本功能随当前统一 Hecate／`minisv.vip` 发布队列上线，不部署到 Windows 或旧 `work.cyberforker.com` 路径。
