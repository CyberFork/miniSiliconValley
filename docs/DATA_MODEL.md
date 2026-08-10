# 数据模型（DATA_MODEL）

## 1) 类型与字段（基于 `app/lib/model.ts`）

### Catalog 结构（原始史实）
- `HistoryCatalog`：
  - `schemaVersion`（固定 `1`）
  - `eras`：时代切片
  - `places`：地点
  - `organizations`：组织机构
  - `people`：人物
  - `technologies`：技术/产品/标准/实践
  - `sources`：来源引用
  - `events`：历史事件

### Player 状态（玩家世界线）
- `PlayerState`：
  - `schemaVersion`
  - `currentYear`
  - `selectedCategory`（`all` 或具体类目）
  - `query`
  - `visitedEventIds`
  - `results`
  - `resources`
  - `activeMissionId`
  - `savedAt`

### 任务状态与选择
- `MissionResult`：每次关卡提交记录
  - `missionId`、`choiceId`
  - `evidenceIds`
  - `delta`（该关选择的资源变化）
  - `resources`
  - `reflection`
  - `realityCommitment`
  - `completedAt`

## 2) 关系映射
- `HistoryEvent.placeId -> PlaceRecord`
- `HistoryEvent.organizationIds -> OrganizationRecord`
- `HistoryEvent.personIds -> PersonRecord`
- `HistoryEvent.technologyIds -> TechnologyRecord`
- `HistoryEvent.sourceIds -> SourceRecord`
- `MissionRecord.eventId -> HistoryEvent`
- `PlayerState.results[*].missionId -> MissionRecord`

## 3) 计数（当前代码计算）
通过 `node --import tsx` 直接读取 `historyCatalog` / `missions`：
- Era：`8`
- Place：`34`
- Organization：`74`
- Person：`51`
- Technology：`75`
- Source：`66`
- Event：`203`
- Mission：`8`

## 4) 重要规则
- 时间范围默认限定在 `1891` 到 `2026`。
- 历史事件与来源均要求 HTTPS（`validateCatalog`）。
- 资源分值按 `0~9` 截断。
- 重玩同一关会替换旧 `MissionResult`；总资源由初始值与所有当前 `delta` 重算，不能靠反复重玩刷资源。
- 存档版本必须匹配：`DATA_SCHEMA_VERSION`（当前为 `1`）。
- 导入时拒绝危险键、未知 Schema；限制文本/数组长度、去重任务，并重算而非相信外部 `resources`。

## 5) 数据文件路径
- `app/data/history.ts`：原始时间线实体和事件生成。
- `app/data/missions.ts`：8 个课程关卡。
- `app/lib/state.ts`：状态读写与解析。
- `app/lib/validate.ts`：一致性校验。
