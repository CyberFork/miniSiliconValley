# T-094｜Editor、Preview、Test Classroom 与中控数据一致性

## 根因

现场看到的差异同时包含“合理差异”和三个真实实现错误：

1. **合理差异：** 编辑器 Working Copy、当前 Candidate 和已创建 Classroom 本来就是不同生命周期；旧课堂必须继续锁定创建时的 revision + digest。
2. **投影器差异：** 浏览器预览使用 `for…of + codePointAt`，服务端使用 UTF-16 `charCodeAt`；含扩展 Unicode 的 seed 会产生不同洗牌。
3. **seed 格式差异：** 浏览器把 seed、course、step、deck 用竖线拼接，服务端使用 `courseId:deckId:seed`。
4. **卡组选择差异：** 浏览器只按五大步找卡组，忽略 ScriptPackage checkpoint 在 B05 等 Block 声明的私密卡组。
5. **顺序差异：** 运行时从数据库按随机 UUID 的 `card_grants.id` 读取，破坏了确定性投影器给出的卡片顺序。

## 修复后的单一身份

```text
courseDataId = {courseId}@r{revision}:{64位digest}
runId        = {classroomId}:run:{resetGeneration}
dealSeed      = classroom:{classroomId}:run:{resetGeneration}
```

- Editor 未保存 Working Copy 明确显示“没有不可变数据 ID”，不伪造 ID。
- Studio Preview 显示 exact Candidate／Released 的完整 courseDataId 与 digest。
- Test Classroom 中控和所有角色席显示同一 runtimeIdentity。
- 当前 Candidate 与课堂锁定版本不同时，界面明确显示“课堂锁定旧版本”。
- 只有显式 Test 重置才递增 `resetGeneration`、runId 和 dealSeed；刷新、重登、回看不变。

## Test 诊断字段

“TEST 数据身份”面板可以复制脱敏后的完整诊断：

```text
courseDataId
classroomId / runId
blockId / seatId / membershipId
dealSeed / deckId / deckRevision
stateMachineVersion / scriptStateVersion / controllerStateVersion
resetGeneration / cacheEpoch
cardAssignmentId → cardId 顺序
current Candidate exact-match 结果
```

该面板只存在于 Test Classroom；Production 不接受 `viewAs` 或 control surface 模拟。

## 一致性契约

- 浏览器 Editor Preview 与 TypeScript 服务端投影器使用同一 hash、seed、卡组选择和洗牌契约。
- 运行时持久化发牌只负责证明 assignment；显示顺序始终按照 exact projector，不按数据库 UUID 排序。
- 相同 `courseDataId + runId + blockId + seatId + dealSeed` 时，卡片 ID 与顺序完全相同。
- 中控可看到更多管理信息，但不会维护第二份课程正文。
- 旧课堂不会被新 Candidate 静默热更新；Studio 直接提供同 exact Test Classroom 入口。

## 回归覆盖

- B01 在 2／4／6 人下逐席逐卡比对浏览器与服务端结果。
- B05 验证 checkpoint 私密卡组覆盖五大步默认卡组。
- Test reset 前后 runId/seed 改变；普通刷新保持不变。
- persisted `cardAssignmentId → cardId` 与投影顺序一致。
- Production 拒绝测试身份和中控模拟。
