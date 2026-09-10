---
type: todo
id: T-075
title: "统一课程编辑器、Alpha 与正式课堂的版本化课程真值"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - course-editor
  - alpha-testing
  - classroom
  - course-package
  - single-source-of-truth
  - release-management
---

# 统一课程编辑器、Alpha 与正式课堂的版本化课程真值

> **2026-09-08 架构更新：**继续保留本任务中的单一课程真值、Candidate／Released 和 exact digest 原则；不再把 Editor、Alpha、Classroom 当作三套长期入口。目标改为 Course Studio＋ClassroomFactory＋同源 Test／Production Classroom，统一以 T-085 和 `docs/COURSE_PLATFORM_ARCHITECTURE.md` 为准。

## 原始需求

`https://minisv.vip/classroom/` 是正式对外上课使用的课堂；`https://minisv.vip/alpha/` 是团队内部跑测试的环境；`https://minisv.vip/control/editor/` 是调整和配置课程的制课入口。

正确流程应当是：

1. 在课程编辑器中配置课程。
2. 将指定版本交给 Alpha 内部测试。
3. Alpha 验收通过后，将完全相同的版本发布给正式课堂。

三个入口必须使用同一份课程定义，不能分别维护三套 Campaign、步骤、卡牌或导师配置。

## 当前问题结论

目前还没有实现真正的三端同源：

- `/control/editor/` 与 `/alpha/` 基本围绕 LIVE RUN Course Package、revision 和 digest 工作。
- Alpha 生产控制器通过 Classroom API 操作真实课堂领域数据，但课程正文和流程仍主要来自 LIVE RUN 课程 JSON。
- `/classroom/` 仍内置独立的 Campaign／Chapter 课程定义，没有把课程编辑器发布的 Course Package 作为唯一课程真值。
- 因为存在两套课程定义，当前线上已经出现实质漂移：
  - Alpha 使用“找真问题→定真方案→做真产品→进真市场→跑真运营”的完整五步／13 Block。
  - Classroom 仍使用“找问题→识别真问题→想解决方案→MVP 原型→运营＋品牌”等旧阶段名称。
  - Alpha 将 P／D／M／O 呈现为产品、开发、市场、运营四位导师；Classroom 仍保留 PDMO 是学员可选分工的模型和文案。
  - Alpha 中饿了么是完整五步课程；Classroom 中饿了么仍被描述为“找问题”单章调查课。
- 当前编辑器的保存／发布／刷新链路只能直接证明 Alpha 已加载新版本，不能证明正式课堂加载了同一 digest。

因此，当前属于“底层部分连接、课程产品层未同源”，尚不满足正式发布要求。

## 核心架构原则

### 2026-09-06 产品简化决策：不向用户提供草稿管理

- 编辑器不再要求用户理解或管理 Draft／Candidate 两套版本。
- 用户点击“保存”即生成一个新的不可变 Candidate revision，并成为 Alpha 可测试的最新课程版本。
- 保存后只把新版本标记为“Alpha 有更新待加载”；已经运行的 Alpha 仍需明确点击“全部刷新 Alpha”，避免测试过程被静默改变。
- 保存绝不等于发布正式课堂。只有 exact Candidate 完成 Alpha 验收后，才允许单独执行“发布到正式课堂”。
- 未点击保存的内容只属于浏览器工作区；历史 revision 继续保留，但不需要独立的草稿列表、草稿发布按钮或草稿状态管理页面。
- 本决策覆盖 T-072／T-074 中旧的“先保存草稿、再发布到 Alpha”交互描述；其显式刷新、安全校验和历史版本能力继续保留。

### 1. 一个课程真值

建立唯一的版本化 Course Package／Course Registry：

- 课程编辑器是课程定义的唯一写入口。
- Alpha 和 Classroom 都只能读取注册表中的不可变课程版本。
- Classroom 不再维护另一套手写 Campaign 内容真值。
- 兼容适配可以存在，但不能通过复制课程数据形成新的长期真值。

### 2. 课程内容共用，运行状态隔离

三端必须一致的课程定义包括：

- `courseId`、`schemaVersion`、`revision`、`digest`。
- 一世界、两轨线、三玩法、四导师、五步骤、六分钟 Demo 总纲。
- 五步骤 ID、顺序、名称、目标、主导师与协作导师。
- 13 个 Block 及其推进门槛。
- 卡组、卡牌稳定 ID、正文、证据边界、来源和发牌规则。
- 挑战、资源、经济规则、交付物、验收规则和展示文案。
- 历史资料、来源映射、学员视图和导师视图配置。

必须隔离的运行数据包括：

- Alpha 测试席位与正式课堂账号／成员。
- Alpha Run 与 Classroom Room。
- 当前进度、随机发牌结果、提交、评分、RP、钱包、团队资金和审计日志。
- 内部测试昵称、席位 lease 和正式学员档案。

禁止为了“同一份数据”而让 Alpha 测试动作污染正式课堂运行状态。

### 3. 版本不可变且可追溯

每个可运行课程版本至少包含：

```json
{
  "courseId": "eleme-five-step",
  "schemaVersion": 1,
  "revision": 12,
  "digest": "sha256:...",
  "status": "candidate",
  "createdAt": "...",
  "createdBy": "..."
}
```

- 相同 `courseId + revision + digest` 的内容不可原地覆盖。
- 每次保存直接生成新的 Candidate revision，不改写此前 Candidate 或已发布版本。
- Alpha 验收和正式发布都只改变版本状态／发布指针，不复制或重写正文。
- 所有入口必须能显示和回传当前实际加载的 revision 与 digest。

## 目标发布流程

```text
课程编辑器
  ↓ 保存（直接生成 Alpha 候选版本）
Candidate（不可变 revision/digest，Alpha 显示有更新待加载）
  ↓ 新 Run 自动加载，或现有 Run 明确“全部刷新 Alpha”
Active Alpha Candidate
  ↓ Alpha 按指定版本测试并生成验收记录
Approved Candidate
  ↓ 明确执行“发布到正式课堂”
Released
  ↓ Classroom 新课堂绑定该 exact revision/digest
```

### 编辑器

- “保存”：直接生成不可变 Candidate，不再提供独立的草稿管理和“发布到 Alpha”步骤。
- 保存后新 Candidate 立即出现在 Alpha 可用版本中；现有 Alpha Run 只显示“有更新待加载”，不会静默换版。
- “发布到正式课堂”：只能选择已通过 Alpha 验收的 exact Candidate。
- 发布前显示结构校验、内容差异、Alpha 验收结果、目标 revision 和 digest。
- 禁止把浏览器未保存内容或未验收 Candidate 直接发布给正式课堂。

### Alpha

- 页面明确显示正在测试的 `courseId / revision / digest / refreshEpoch`。
- 测试回执绑定 exact digest；内容变化后旧回执自动失效。
- “全部刷新 Alpha”只更新内部测试 Run，不影响正式课堂。
- 刷新是否保留测试 Run 状态继续遵守 T-072／T-074 的显式同步规则。

### Classroom

- 创建新课堂时绑定一个 Released 课程版本，并在房间数据中持久化 exact revision／digest。
- 已经开始的课堂默认锁定版本，不因编辑器继续修改或发布新版而静默变化。
- 如确需课堂中途升级，必须是 DM 可见、显式确认、可审计并带兼容检查的独立操作；默认不提供自动升级。
- 正式课堂只能读取 Released，不得读取 Candidate 或浏览器未保存内容。
- Classroom 页面、API、导出和审计记录都应包含实际绑定的课程版本。

## 统一 PDMO 与五步口径

同源课程包必须落实 T-073 已确认的唯一课程口径：

- PDMO 是四位导师的专业分工：产品导师、开发导师、市场导师、运营导师。
- PDMO 不是四名学员的固定或可选课程身份，也不是推进门槛。
- 五步骤只能是：找真问题、定真方案、做真产品、进真市场、跑真运营。
- Demo Day 是五步结束后的六分钟终局，不是第六个课程步骤。
- 四位导师横向贯穿五步，每一步可以配置主导师和协作导师。
- 历史人物／情境身份卡继续独立存在，不得与 PDMO 导师分工混为一谈。

## 实现范围

### A. 统一 Course Package Schema

- 盘点 LIVE RUN Course Package 与 Classroom Campaign／Chapter 的字段差异。
- 将 Classroom 所需但 Course Package 缺少的学习目标、房间动作、挑战、经济、历史揭晓、复盘和档案字段纳入统一 Schema，或定义有版本约束的运行投影。
- 五步骤、导师配置、卡牌和 Demo 只能有一份声明式定义。
- 为旧课程包和旧 Classroom Campaign 提供明确的版本化兼容读取器，禁止长期双写。

### B. 建立 Course Registry

- 对用户可见的持久化状态只需 Candidate、Released、Retired；未保存工作区不是注册表版本。
- 提供按 `courseId + revision`、digest、当前 Candidate、当前 Released 查询的稳定接口。
- 内容存储必须跨应用发布保持稳定，不能因为 release symlink 切换而丢失。
- 发布指针更新必须原子化，并保留操作者、时间、来源版本和验收回执。
- 只有 admin／mentor 制课权限可以写课程；Alpha 席位和学员只读。

### C. 改造课程编辑器

- 编辑器直接读写 Course Registry，不再只维护 Alpha 私有课程副本。
- 页面展示未保存工作区、最新 Alpha Candidate、Alpha Active、Production Released 之间的差异。
- 增加“保存”“查看 Alpha 验收”“发布到正式课堂”明确动作；不再单列“发布到 Alpha”。
- 正式发布按钮必须校验 digest 对应的 Alpha 回执，而不是只检查课程名称或 revision 数字。

### D. 改造 Alpha

- Alpha 通过 Registry 加载 Candidate，不再从独立复制文件推断最新课程。
- Run 快照保存 exact course reference；席位、主控和编辑器显示同一 digest。
- 验收回执至少记录课程版本、五步／13 Block 完整性、四导师映射、卡组／卡牌数量、关键浏览器流程和测试时间。

### E. 改造 Classroom

- `app/data/*classroom-campaign*` 不再作为正式课程内容真值。
- Classroom 创建房间时从 Registry 选择／读取 Released Course Package，并生成受版本约束的运行投影。
- API bootstrap、房间详情、导出和审计日志返回 course reference。
- 课堂界面按统一包渲染五步、导师职责、卡牌、挑战和 Demo。
- 迁移后不得继续显示旧五步骤和学员 PDMO 分工。

### F. 数据迁移与兼容

- 已有正式课堂和历史档案保持可读，不进行破坏性重命名。
- 为旧房间记录 legacy course version／compatibility adapter，明确它们不会自动升级。
- 新建课堂只能使用统一 Registry 的 Released 版本。
- 迁移完成后停止 Classroom Campaign 与 Course Package 的双写，防止再次漂移。

## 自动化一致性检查

新增三端契约测试，至少验证：

- 编辑器 Candidate、Alpha Active 和 Classroom Released 的 digest 可以逐项比较。
- 已验收 Candidate 的 digest 与正式发布 digest 完全相同。
- 五步骤 ID、顺序和显示名完全一致。
- 四导师 P／D／M／O 职责和主责／协作映射一致。
- 13 Block、卡组、卡牌 ID、来源和 Demo 结构一致。
- Classroom 不再引用旧步骤显示名或学员 `pdmoRole` 作为推进条件。
- 修改一个字后 digest 改变，旧 Alpha 验收不能用于发布新内容。
- Alpha 测试运行状态不会出现在正式课堂。
- 已开始的正式课堂在发布新版本后仍保持原绑定版本。
- 新建正式课堂采用最新 Released 版本。

## 产品可见性要求

三个入口均应显示可核对的课程版本信息：

```text
课程：饿了么五步创业闭环
Course ID：eleme-five-step
版本：r12
Digest：407a24b43ead68dd
状态：未保存 / Candidate / Alpha Active / Released
```

- 编辑器显示三环境版本矩阵和差异。
- Alpha 控制台显示正在测试的 Candidate。
- Classroom 的 DM 端显示当前房间绑定的 Released 版本；学员端可以只显示简化版本号。
- 版本不一致时必须显式报警，禁止静默回退到内置 Campaign。

## 实施顺序

1. 冻结统一术语、五步骤、四导师及 Course Package vNext Schema。
2. 建立 Course Registry、版本状态、digest 和发布指针。
3. 让编辑器每次保存直接生成 Candidate，并让 Alpha 只加载指定 Candidate。
4. 将 Alpha 验收结果绑定 exact digest。
5. 将 Classroom Campaign 转为统一 Course Package 的运行投影。
6. 增加“验收后发布正式课堂”流程和权限／审计。
7. 迁移旧课堂为只读兼容版本，停止双真值。
8. 完成三端契约测试、浏览器验收和生产发布回执。

## 验收标准

- 课程编辑器、Alpha 和 Classroom 不再维护三份或两份课程正文。
- 任意已发布课程均可从三端核对同一个 `courseId / revision / digest`。
- Alpha 测试的 exact digest 才能被批准为 Classroom Released。
- Classroom 新建课堂加载的内容与 Alpha 验收内容逐字节一致。
- Classroom 正式课程使用新版五步骤和 PDMO 四导师模型。
- 编辑器保存 Candidate 不会静默改变正在运行的 Alpha，也不会改变正式课堂。
- Alpha 刷新不会改变正式课堂。
- 正式发布新版不会静默改变已经开始的课堂。
- 旧课堂和归档可读，新课堂不再使用 legacy Campaign 真值。
- 自动测试能阻止步骤、导师、卡牌、来源、Block 或 Demo 在三端发生漂移。
- 生产回执同时提供 Editor Candidate、Alpha Active、Classroom Released 的版本与 digest 证据。

## 非目标

- 不让 Alpha 和正式课堂共用同一个 Run／Room 状态。
- 不允许 Alpha 无鉴权席位访问正式学员数据。
- 不让 `/workshop/` 成为新的课程运行真值；它仍是早期课程共识工具。
- 不通过复制 JSON 到三个目录来伪装“同源”。
- 不自动把知识库缺口或模型生成内容写入正式课程；人工审核规则保持不变。

## 关联 Todo

- [[71-course-json-stage-card-decks|T-071]]
- [[72-course-editor-alpha-live-sync-controls|T-072]]
- [[73-full-system-pdmo-five-step-consistency|T-073]]
- [[74-alpha-runtime-course-editor-card-completion|T-074]]

## 关键控制点

唯一课程真值；编辑器唯一写入口；Alpha 测试 Candidate；Classroom 只读 Released；exact digest 验收与发布；课程内容共享；运行状态隔离；正式课堂版本锁定；PDMO 四导师；新版五步骤；Demo Day 终局；旧课堂兼容；停止双写；三端自动一致性验收。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- Eleme Released：`r9`，digest=`5e18ab82b30cd6f61b37bb4d0d217c1ef3b2a795354a16d9a2ce3c6a5f4ab4e4`。
- Alpha run：`run-20260907-014609-04bf7f`。
- 相关证据：<https://minisv.vip/control/editor/>。
