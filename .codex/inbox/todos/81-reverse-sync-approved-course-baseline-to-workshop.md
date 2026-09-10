---
type: todo
id: T-081
title: "将已确认与已验收的课程基线反向同步到 Workshop"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - workshop
  - course-package
  - single-source-of-truth
  - reverse-sync
  - release-management
---

# 将已确认与已验收的课程基线反向同步到 Workshop

> 2026-09-10 后续方向更新：用户确认 Workshop 已退出日常使用，应归档，但必须保留较深的可访问入口。见 [T-109](109-public-website-internal-navigation-and-workshop-archive.md)。本单已完成成果与历史记录保留；后续不再以持续反向同步 Workshop 为主生产线目标。归档前需备份浏览器提案/决议等数据并核对同步、打包依赖，不能直接删除。

## 原始需求

当前已经积累了大量已确认的课程共识和已实现、已验收的课程内容，应当能够反向同步给 `https://minisv.vip/workshop/`，避免 Workshop 继续停留在早期课程构想。

## 结论

**可以反向同步，但 Workshop 只能获得“已确认基线的只读投影”，不能成为第二个课程真值或直接回写运行课程。**

Workshop 的定位仍然是早期课程共识、讨论和会议决策工具；真实课程内容的唯一写入口仍然是 `/control/editor/`，Alpha 用于测试精确的 Candidate revision/digest，`/classroom/` 只使用验收通过的 Released revision/digest。

## 必须保持的数据流向

```text
课程编辑器 / Course Registry
  ↓ 保存为不可变 Candidate
Alpha 按 exact revision/digest 验收
  ↓ 明确批准
Released 课程／已确认产品决策
  ↓ 生成带版本和 digest 的只读 Snapshot
Workshop “已确认基线”
  + Workshop 讨论中提案／会议决议／差异
  ↓ 人工审核为变更请求
课程编辑器重新编辑、保存、Alpha 验收和发布
```

禁止建立 `Workshop ↔ 运行课程 JSON` 的自动双向同步，也不得让 Workshop 中未审核的 Agent 建议或会议草案直接进入 Alpha 或 Classroom。

## 当前调研结果

### 1. 主工程已有可生成基线的课程数据

当前 Course Package 已包含五步、13 Block、五组卡组、卡牌内容、来源和 F/R/G/U 边界等数据；编辑器和 Alpha 都消费该课程包。

相关设计与实现记录：

- `docs/COURSE_PACKAGE_SOP.md`
- `docs/TODO_071_072_IMPLEMENTATION.md`
- `docs/TODO_074_IMPLEMENTATION.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`

### 2. Workshop 本地源文件当前无法可靠读取

Workshop 工程位于：

`../mini_silicon_valley_workshop/`

已发现 `README.md`、`index.html`、`app.js`、`scripts/codex_workshop_bridge.py`、`scripts/build_public.py`和测试文件，但当前都是 OneDrive `compressed,dataless` 占位文件，读取反复超时。实施前必须先将该目录完整下载到本地，或从部署源恢复可读版本，再确认现有存储、导入导出和部署链路。

### 3. 与现有 Todo 的关系

- T-073 定义了已确认的“一个世界、两条双轨、三个玩法、四个导师、五个步骤、六分钟 Demo”口径。
- T-074 已明确 Workshop 是历史阶段的课程共识工具，不是 Alpha 运行课程编辑器。
- T-075 要统一编辑器、Alpha 和 Classroom 的版本化课程真值。T-081 只消费该真值的快照，不增加第四个课程写入端。

## 同步范围

### 可以同步到“已确认基线”

- “一个世界、两条双轨、三个玩法、四个导师分工、五个完整步骤、最后六分钟 Demo”。
- PDMO 是产品、开发、市场、运营四位导师的横向专业分工，不是学员分组身份。
- 统一五步：找真问题、定真方案、做真产品、进真市场、跑真运营。
- 13 个 Block 的目标、顺序、交付物、验收规则与 Demo Day 规则。
- 通过结构和来源校验的卡组、卡牌、来源、F/R/G/U 边界与学员可见文案。
- 已验收的课程编辑、Alpha 交互、视觉和语义规则，以简明决策记录展示，不把全部实现细节拷贝进 Workshop。
- 课程身份元数据：`courseId`、`schemaVersion`、`revision`、`digest`、状态、产生时间与来源。
- 已验收实现的摘要、验收回执和对应 Todo ID，用于解释“为什么当前基线是这样”。

### 不得同步

- 浏览器未保存内容、未验收 Candidate、过时 Draft 和未审核 AI 建议。
- Alpha 或 Classroom 的 Run／Room 运行状态、当前进度、操作日志、提交、评分、RP、钱包和团队资金。
- 学员身份与账号数据、内部测试席位 lease、学员私密手牌和实际随机发牌结果。
- API Key、Cookie、Token、密码、服务器路径和其他敏感部署信息。
- 过期 Todo 中已被后续决策替代的旧口径。Todo 不能按文件整体直接导入，必须只导入当前生效的决策。

## 目标数据模型

生成独立、可验证、不可直接改写的 Workshop Snapshot，例如：

```json
{
  "snapshotVersion": 1,
  "generatedAt": "2026-09-06T00:00:00+08:00",
  "source": {
    "courseId": "eleme-five-step",
    "schemaVersion": 1,
    "revision": 12,
    "digest": "sha256:...",
    "status": "released"
  },
  "confirmedFramework": {},
  "mentorRoles": [],
  "macroSteps": [],
  "blocks": [],
  "deckSummary": {},
  "sourceSummary": {},
  "acceptedDecisions": [],
  "acceptanceReceipts": []
}
```

原则：

- Snapshot 本体只读；Workshop 另行保存提案、评论、会议决议和差异。
- Snapshot 必须带原始 revision/digest，不以“已经是最新”的无版本文案取代。
- 导入前重新计算 digest；数据校验失败、版本倒退或生成不完整时，不替换当前 Workshop 基线。
- 快照不复制另一套可编辑课程正文；需要展示卡牌全文时，应由同一快照投影生成，并始终标记来源。

## Workshop 界面要求

### 已确认基线

- 增加独立的“已确认基线”区域，不与“Agent 提案”或“讨论中”混排。
- 顶部固定显示来源、courseId、revision、digest、发布／批准状态和最后同步时间。
- 基线卡片显示锁定状态；用户要修改时只能“创建变更提案”，不能原地编辑基线。

### 讨论和差异

- 分开显示：已确认基线、讨论中提案、会议决议、待回流变更。
- 提案必须绑定它基于的 snapshot digest，基线更新后能识别过时提案。
- 提供“当前 Workshop 基线 vs 课程源最新已批准版”的差异预览。
- 只有显式点击“刷新已确认基线”并审阅差异后才切换，禁止静默替换会议中基线。

### 待回流变更

- Workshop 可导出结构化“变更请求”，包含基线 digest、提案差异、会议决议、负责人和审核状态。
- 变更请求必须回到 `/control/editor/` 内人工审核和编辑，不得由 Workshop 直接更新 Candidate、Alpha 或 Released。

## 安全与发布边界

- 当前 `https://minisv.vip/workshop/` 能直接打开。`noindex/nofollow` 不是访问控制。
- 如果快照包含未公开课程全文、内部决策或验收回执，必须先将 Workshop 纳入内部访问控制；在无鉴权状态下只能同步可公开、已脱敏的摘要。
- 快照生成和部署不得读取或写入 Alpha/Classroom 的运行库，并必须证明对生产课堂、Alpha Run、账本和手牌为零副作用。
- 保留上一个可用快照；同步失败时显示错误并继续使用旧快照。

## 实施步骤

1. **恢复 Workshop 本地工程**：materialize OneDrive 文件，盘点当前 localStorage／文件／网关存储、JSON/Markdown 导入导出和发布管道。
2. **定义 Snapshot Schema**：版本化字段、校验规则、脱敏规则和与 Course Package Schema 的映射。
3. **实现主工程导出器**：从 exact 已批准 revision/digest 生成确定性 Snapshot；不从 Alpha 运行状态或 Workshop 现有内容拼湊。
4. **实现 Workshop 只读导入器**：验证 digest、结构和版本单调性，原子替换基线，保留现有提案和决议。
5. **改造 Workshop UI**：将基线、提案、决议和待回流变更分层，增加版本、过期与差异提示。
6. **实现人工回流通道**：仅导出变更请求给课程编辑器，不实现自动写入课程源。
7. **设置内部访问边界**：在导入内部课程全文前完成鉴权，否则只发布脱敏基线。
8. **编写运维回滚文档**：记录快照产生者、来源 revision/digest、操作人、同步时间、成功／失败和回滚方式。

## 验收标准

- [x] Workshop 本地源文件已完整可读，现有数据和发布链路已审计。
- [x] 每个快照都显示 source、courseId、schemaVersion、revision、digest、状态和同步时间。
- [x] 已确认基线、讨论中提案、会议决议和待回流变更在 UI 与存储中完全分离。
- [x] 已确认的 1·2·3·4·5·6 框架和 PDMO 导师定位与 T-073 一致，无旧五步或“PDMO=学员分工”残留。
- [x] 课程快照通过五步、13 Block、5 组卡组、每组至少 12 张、F 卡来源和稳定卡牌 ID 校验。
- [x] 未验收内容、旧 revision、digest 不符、结构缺失或不完整生成均不会替换现有基线。
- [x] 基线更新前显示差异并需要用户明确确认；同步失败可继续使用上一版快照。
- [x] Workshop 内对基线的修改只生成绑定原 digest 的变更提案，不直接改写 Course Package。
- [x] 如果 Workshop 仍无鉴权，只接收已脱敏公开摘要；课程全文与内部回执必须在鉴权后才可见。
- [x] 自动化测试证明生成、同步、失败和回滚过程对 Alpha Run、Classroom Room、账本、手牌和生产课程指针为零副作用。
- [x] 同步与变更回流的操作、操作人、时间和版本均有可审计记录。

## 依赖与优先级

- **优先级：P1**。可以先同步 T-073 等已确认、可公开的产品口径，但课程全量快照应在鉴权与可靠真值接口就绪后再上线。
- **前置**：Workshop 工程可读；确认 Workshop 的内部访问策略。
- **关联**：T-073、T-074、T-075、T-076、T-077、T-080。
- **过渡期数据源**：可从当前已校验的 Course Package 生成快照。
- **终态数据源**：T-075 建立的 Course Registry 中 exact Approved/Released revision + digest。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- Workshop snapshot digest：`93cf31150b241268c3ab6bdd76c1563dc9e8831774e9ccf8791e5b855e7c94cb`。
- 相关证据：<https://minisv.vip/workshop/>。
