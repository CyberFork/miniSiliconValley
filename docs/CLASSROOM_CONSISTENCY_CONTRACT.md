# 课堂一致性契约（T-101）

本契约覆盖课堂运行时、导师/学员写入和弱网 UI；不改变“可自由回看已解锁页”及“作品验收独立于翻页”。

## 运行身份与版本

- 每个课堂实例以 `classroomId + resetGeneration` 定义运行；`runId` 为 `${classroomId}:run:${resetGeneration}`。所有写入必须携带并校验 `expectedRunId`、`expectedResetGeneration`，旧运行统一返回 `409 CLASSROOM_RUN_CONFLICT`。
- 脚本进度使用同一运行内单调 `version` 做 CAS；提交/评审使用作品 revision `version` 做 CAS。版本只在当前 run 内比较，reset 后不得用旧 run 版本覆盖新 run。
- 解锁的 progress、lifecycle、mutation 记录和审计事件在同一 D1 batch 中提交；提交/评审、reset 同理。batch 任一节点失败必须整体回滚。

## 幂等、Claim 与 assertion

- 每次 mutation 需合法 `idempotencyKey`（8–128 字符）和 `expectedVersion`；同键同 payload 重试返回原结果（`idempotent: true`），同键不同操作或 payload 返回 `409 IDEMPOTENCY_KEY_REUSED`。
- CAS 失败返回 `409 SCRIPT_VERSION_CONFLICT` 或 `SUBMISSION_VERSION_CONFLICT`，客户端应重新读取后由用户决定重试，不得静默覆盖。
- D1 mutation 采用“claim + assertion”：mutation 表先以当前 run/version 条件 claim，随后以 `classroom_atomic_assertions` 检查 mutation 已落库；断言失败视为事务失败。reset 也必须带当前 run 条件，不能重置 Production。

## 弱网响应与草稿

- GET 请求按 classroom、block、viewProfile、surface 建立 identity，并以请求世代（`AbortController`/generation）提交；仅最新世代、匹配身份且 `resetGeneration >= 当前运行` 的响应可进入视图。故意延迟的旧 block、旧角色、旧 run 响应必须丢弃。
- 草稿只保存在设备本地，key 隔离 actor、viewProfile、classroom、run、seat、block、schema；输入内容不进入 URL 或日志。导师反馈、轮询、横竖屏及切页不能静默清除当前草稿；换账号/运行不得继承。
- `offline` 显示“连接中断·草稿保留在此设备”并提供重连；恢复后重新同步。此契约不承诺完整离线课堂。

## 环境边界与错误码

- Test reset 仅允许 Test Classroom 的授权 admin/DM，推进 `resetGeneration` 并关闭旧 run；Production 路径不可调用 Test reset，Studio 保存不应影响运行实例。
- 主要错误码：`CLASSROOM_RUN_CONFLICT`、`SCRIPT_VERSION_CONFLICT`、`SUBMISSION_VERSION_CONFLICT`、`IDEMPOTENCY_KEY_REUSED`、`IDEMPOTENCY_KEY_INVALID`、`SUBMISSION_VERSION_INVALID`；冲突均为 409，输入格式错误为 400。

## 验证清单与证据

- `tests/classroom-atomicity.test.ts`：故障注入覆盖解锁/提交/评审/reset 的每个 batch 节点，验证全回滚、审计完整；覆盖导师 CAS 竞态、提交幂等/复用键、reset 后旧 run 写入拒绝。
- 同文件自动化覆盖延迟旧 block/角色/run 响应淘汰、草稿 key 全维度隔离、无输入内容泄漏、offline/online 与 AbortController 源码契约。
- 已运行：`npm run test:classroom -- --test-name-pattern='(applyScriptAction|two mentors|submission CAS|review CAS|reset rolls back|runtime source|delayed B01|device drafts)'`（通过）；`git diff --check`（通过）。
- Pad 输入中收反馈、横竖屏和真实设备人工验收不在本轮证据内，仍归 T-088；本轮仅证明自动化及工程门槛，未声称 Pad 实机完成。
