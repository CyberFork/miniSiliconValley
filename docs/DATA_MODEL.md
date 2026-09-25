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

### Curriculum 结构（0→1 教学组织）
- `CurriculumCatalog`：
  - `stages`：当前五个学习步骤（旧版六步字段仅作兼容读取）
  - `companyJourneys`：按同一企业横向组织的当前五步流程与独立 Demo Day
  - `contributionProtocol`：内容同事新增材料时的八项必填字段
  - `nonNegotiables`：史实边界、实操闭环、VC 与 Demo Day 原则
- `CurriculumStage`：核心问题、学习目标、行动、交付物、门槛和跨企业案例。
- `CurriculumExample`：通过 `eventIds` 关联史实，通过可选 `missionId` 关联历史战役。
- `mappingKind`：
  - `direct`：史实直接体现该阶段机制。
  - `course-analogy`：教学重组；不得冒充企业当年使用的流程术语。

## 2) 关系映射
- `HistoryEvent.placeId -> PlaceRecord`
- `HistoryEvent.organizationIds -> OrganizationRecord`
- `HistoryEvent.personIds -> PersonRecord`
- `HistoryEvent.technologyIds -> TechnologyRecord`
- `HistoryEvent.sourceIds -> SourceRecord`
- `MissionRecord.eventId -> HistoryEvent`
- `CurriculumExample.eventIds -> HistoryEvent`
- `CompanyJourney.steps[*].eventIds -> HistoryEvent`
- `CurriculumExample.missionId -> MissionRecord`（可选）
- `CompanyJourney.missionId -> MissionRecord`（可选）
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
- Curriculum Stage：`6`
- Curriculum Example：`18`
- Company Journey：`1`
- Company Journey Step：`6`

## 4) 重要规则
- 时间范围默认限定在 `1891` 到 `2026`。
- 历史事件与来源均要求 HTTPS（`validateCatalog`）。
- 资源分值按 `0~9` 截断。
- 重玩同一关会替换旧 `MissionResult`；总资源由初始值与所有当前 `delta` 重算，不能靠反复重玩刷资源。
- 存档版本必须匹配：`DATA_SCHEMA_VERSION`（当前为 `1`）。
- 导入时拒绝危险键、未知 Schema；限制文本/数组长度、去重任务，并重算而非相信外部 `resources`。
- 当前课程语义为五步：找真问题 → 定真方案 → 做真产品 → 进真市场 → 跑真运营；Demo Day 独立为六分钟终局。旧版六步排列仅保留在历史兼容资料中。
- 每个当前步骤至少 3 个历史案例；企业流程覆盖五步并单列 Demo Day。
- 课程案例必须引用已有史实事件；新事实先进入来源治理流程，再进入课程大纲。

## 5) 数据文件路径
- `app/data/history.ts`：原始时间线实体和事件生成。
- `app/data/missions.ts`：8 个课程关卡。
- `app/data/curriculum.ts`：课程案例、企业流程与归集协议（兼容历史旧版六步字段）。
- `app/lib/state.ts`：状态读写与解析。
- `app/lib/validate.ts`：一致性校验。
