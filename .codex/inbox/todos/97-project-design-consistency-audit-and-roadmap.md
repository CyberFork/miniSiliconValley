---
type: todo
id: T-097
title: "新模型全项目设计一致性审计与优化总单"
status: backlog
created: 2026-09-10
updated: 2026-09-10
captured_by: project-inbox
audit_status: completed
implementation_status: in-progress
priority: P0
priority_basis: audit-recommendation
related: [T-085, T-086, T-088, T-090, T-091, T-094, T-095, T-096]
children: [T-098, T-099, T-100, T-101, T-102, T-103, T-104, T-105]
tags: [todo, audit, architecture, single-source-of-truth]
---

# 新模型全项目设计一致性审计与优化总单

## 原始需求与本轮边界

> 当前已经切换到新模型，使用该模型审计本项目，检查各项设计的一致性，以及进行相关优化等，写出todo。

本轮已完成只读审计和隔离复现，未实施业务优化。只记录项目 TODO 与脱敏审计证据；未改业务代码、未部署、未签署人工验收、未操作生产账号/课堂/数据库、未调用计费模型。不是知识库入库任务。

优先级和执行顺序是审计建议，不代表已排期；无预设负责人、工期或截止日期。

## 1. 先确认审计的究竟是哪份代码

- 用户工作目录：`AI教培-mini硅谷/dev`，HEAD `dd28a57`（2026-09-06 初始化版本），仍有用户已有未提交/未跟踪 TODO 和架构文档。
- 找到较新源码：`/private/tmp/minisv-sequence-work.axC0Th/repo`，HEAD `6400928c90d6c2fd59ca5b8513cc91a3ada93956`。
- 只读 `git ls-remote origin refs/heads/main` 返回同一 `6400928`。
- 线上 `/release.json`：`20260910T032647CST-market-mentor-user-system-r2`，源码 `f1b063b56aa4800a5316103da94c09dcef870a78`。
- `f1b063b..6400928` 仅增加市场课件回执、说明和 goal 记录，无业务源码变化。因此本轮使用较新源码审计，而不是把 dev 中旧 Alpha 架构误报为线上现状。
- **代码基线分裂本身是问题**：T-098 先收口。没有执行 fetch/pull/reset 或把临时目录覆盖到用户目录。

下列源码路径和行号均以 `6400928` 为准，不保证可在当前旧 dev 树直接找到。

## 2. 已确认合理、不要推倒重做的设计

- CourseDefinition / CourseRelease / ClassroomInstance 分离；课程原型不等于课堂实例。
- Test 与 Production 共用工厂和真实 Runtime；不能恢复两套独立 Alpha/Classroom 状态机。
- Course revision 与 Courseware revision 分属不同对象，不能直接比较 r0/r9。
- PDMO 是导师分工，学员人数由 policy 决定；稳定 seatId、fieldId、cardId 与 cardAssignmentId 各负其责。
- 已开始课堂锁定 exact 课程与课件；编辑器保存不应直接热更新正式课堂。
- 学员只读课件库是已确认需求，不应退回“只有导师能看”。
- 自动化通过不能替代人工 View/UI 验收，更不能由 AI 自动将待审内容入库。

## 3. 验证结果与边界

本轮实际执行：
- TypeScript typecheck：通过。
- 数据校验：203 个历史事件、5 步、0 error / 0 warning。
- 平台契约测试：83/83。
- QA / auth-crypto / evidence-boundary 定向单元：16/16。
- 部署 Python 契约：35/35。
- 额外投影正向检查：13 Block × 2/3/4/5/6 人 × 3 seed，共 195 场景；学员任务和 cardId 顺序前后端一致，包括中文/emoji seed。
- 匿名只读 HTTP：Studio、Classroom、课件目录/深链跳登录；课件深链保留 revision/slide/step；D 静态课件为 401 且 private/no-store；Alpha、control、旧 classroom API 为 410。
- QA 健康响应显示 ready、20 条知识、knowledgeGapRecording=true；这只证明配置启用，不证明每次写盘一定成功。
- 当前线上已有 P、D、M 静态课件；O 仍有内部 fallback，不能宣称已有真实 O 导师 PPT。

本轮未做：完整 release build、登录后线上 E2E、生产数据库状态核对、真人 View/UI 签署、iPad/Android 实机课堂。不得把“代码可通过”写成“已正式验收可开课”。

特别说明：T-094/T-095 的旧 B01 发牌问题本轮没有复现；195 场景通过。后续建议是防再次分叉，不是宣称它们没修好。

## 4. 新增 TODO 与证据等级

### P0：先稳定源头与数据写入
- [T-098 收口唯一工程与发布基线](98-canonical-workspace-and-release-provenance.md)：**已完成**；`dev` 已切换到 canonical 远端，旧树、Todo 与审计证据已保全，发布来源默认失败关闭。
- [T-099 课程保存的并发和 exact 指针一致性](99-candidate-save-concurrency-and-exact-integrity.md)：**已隔离复现**两个保存均成功、Candidate 指向不存在的 digest；另有旧编辑副本静默覆盖新正文。

### P1：再完成可持续运行的版本与课堂链
- [T-100 课件预览、历史发布与资源更新闭环](100-courseware-preview-release-history-and-bundles.md)：**已隔离复现**未发布预览被正式目录 gate 拦截；发布 r1 后旧 r0 不再可见。当前业务源码还有 fallback 链接与静态包更新通道缺口。
- [T-101 课堂状态原子性及弱网响应一致性](101-classroom-atomic-state-and-stale-response-protection.md)：**源码确认的非原子边界/待故障注入验证**；不能声称线上已经发生故障。
- [T-102 验收身份、完成语义和回归矩阵](102-acceptance-contract-identity-and-completion-semantics.md)：**源码确认**验收 build ID 为固定 T-090 常量；T-095 修改投影/Runtime 后未改该标识，文档仍为14项、代码为16项。

### P1/P2：内容与权限收口，避免下一轮漂移
- [T-103 共享投影器及对外课程语义同步](103-shared-projection-and-public-course-semantics.md)：当前结果通过，但浏览器/TS仍是两套实现；权威文档 D=设计、Runtime D=开发，README漏写学员课件权限等已确认文字冲突。
- [T-104 两类人工审核清单与缺口复发规则](104-human-review-queues-and-gap-recurrence.md)：**已隔离复现事件语义**：同一问题再次出现会写 pending，按文档 latest-event 汇总时覆盖已解决状态。课程 reviewQueue 与 QA gaps 必须分别由人处理。
- [T-105 Studio 数据范围与账号准入一致性](105-studio-data-scope-and-account-admission-policy.md)：**源码确认、未登录线上越权测试**：Studio bootstrap 给所有 mentor 返回全局验收清单；公开自注册与预配账号的产品边界待明确。

## 5. 推荐依赖与执行顺序

```text
T-098  唯一代码/发布基线
  ├─ T-099  课程保存与数据库约束（优先修复）
  ├─ T-100  课件预览与旧版本可用性
  └─ T-101  课堂事务与弱网一致性
       ↓
T-102  验收契约标识与完整回归
  ├─ T-103  收口投影实现与课程语义
  ├─ T-104  人工待审清单
  └─ T-105  权限范围与准入策略
       ↓
T-088  学员 Pad 无键盘真实流程验收（沿用原任务）
       ↓
人工 View → Test 真实 UI → Released → Production
```

- T-099/T-100/T-101 可按模块独立实现，但都要从 T-098 确认的同一代码基线出发。
- T-105 涉及权限边界，应在扩大导师/团队试用前完成；不要因排列靠后理解为可忽略。
- T-103 的基础语义修订与 T-104 人工复核可提前进行，不必等待所有技术任务。
- T-088 不重复建单；T-101 的弱网恢复、T-100 的课件入口和 T-102 的真实设备矩阵并入其验收前提。
- 已完成 T-085～T-096 不整体改回未完成；这些是新增边界修复与持续验收。T-090/T-091 中早期“仅本地”描述须参考后续部署回执，不当成当前未部署结论。
- 最近代码回执仍把 r11 记为 Candidate、人工 View/UI 未签；本轮没有查询生产数据库，实际当前签署状态需由有权限的人在 Studio 确认。

## 6. 证据与复现

证据目录：[`../audits/2026-09-10-design-consistency/`](../audits/2026-09-10-design-consistency/)

- `audit-baseline.json`：目录/commit/线上发布身份、测试范围。
- `probe.mts` + `probe-results.json`：真实库函数 + SQLite 内存库，合成数据，无网络、无生产写入。
- `public-routes.json`：匿名只读路由状态。
- `platform-tests.log`、`extra-tests.log`、`deployment-tests.log`：本轮实际测试输出。

复现（在有依赖的较新源码目录执行，第二个参数显式指向源码根）：

```bash
node --import tsx "/项目dev/.codex/inbox/audits/2026-09-10-design-consistency/probe.mts" "$PWD"
```

该脚本是**缺陷现状证据**：部分断言期待旧缺陷存在；修复后应改写为“不再发生”的产品回归测试，不能把“缺陷复现成功”当发布成功。

## 总体验收

- [ ] 子任务逐项给出代码/测试/部署/人工验收各层独立证据。
- [ ] 实现前向用户确认标注为“待决策”的准入/完成语义，不擅自重构产品规则。
- [ ] 保留旧课程、旧课件、课堂状态和人工审核历史。
- [ ] 最终对用户回报本轮发现如何解决、哪些仍待人工验收；不把 TODO 已写等同于功能已完成。
