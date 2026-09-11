---
type: todo
id: T-097
title: "新模型全项目设计一致性审计与优化总单"
status: in-progress
created: 2026-09-10
updated: 2026-09-11
captured_by: project-inbox
audit_status: completed
implementation_status: in-progress
priority: P0
priority_basis: audit-recommendation
related: [T-085, T-086, T-088, T-090, T-091, T-094, T-095, T-096, T-109, T-110, T-111]
children: [T-098, T-099, T-100, T-101, T-102, T-103, T-104, T-105, T-109, T-110, T-111]
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
- [T-099 课程保存的并发和 exact 指针一致性](99-candidate-save-concurrency-and-exact-integrity.md)：**已完成**；exact Candidate CAS、数据库不可变/引用守卫、发布竞态保护、部署只读 preflight 和浏览器显式冲突处理均已通过验证。

### P1：再完成可持续运行的版本与课堂链
- [T-100 课件预览、历史发布与资源更新闭环](100-courseware-preview-release-history-and-bundles.md)：**已完成**；Candidate 使用受控 Studio exact 预览，发布历史与默认 pointer 分离，旧 Released/旧课堂 exact 入口持续可读，并新增经服务端逐文件校验的不可变多文件资源包上传与播放链路。
- [T-101 课堂状态原子性及弱网响应一致性](101-classroom-atomic-state-and-stale-response-protection.md)：**已完成**；课堂推进、结束、重置、提交、审核与归档均使用服务端 CAS、事务和幂等键，故障注入与迟到响应保护通过。
- [T-102 验收身份、完成语义和回归矩阵](102-acceptance-contract-identity-and-completion-semantics.md)：**已完成**；构建身份、16 项验收清单、显式完成语义和真实矩阵已统一。

### P1/P2：内容与权限收口，避免下一轮漂移
- [T-103 共享投影器及对外课程语义同步](103-shared-projection-and-public-course-semantics.md)：**已完成**；生成式共享投影核心和 P/D/M/O 对外语义已收口。
- [T-104 两类人工审核清单与缺口复发规则](104-human-review-queues-and-gap-recurrence.md)：**已完成**；课程内容审核与家长 QA 缺口分离、追加式审计和复发规则已实现，仍只允许人作出终态判断。
- [T-105 Studio 数据范围与账号准入一致性](105-studio-data-scope-and-account-admission-policy.md)：**已完成**；Studio 数据按授权范围裁剪，公开自注册只产生学员账号，显式课堂加入与角色授权保持服务端控制。

## 实施收口进度（2026-09-11）

- T-098～T-109 与 T-111 已完成并部署至 Hecate；当前统一平台发布为 `20260911T120044CST-t088-privacy-r1`（源码 `7244ead4fcca36d7d5b5c52c352bf1bbaaafc3e0`），在 T-109 r4 基线上补入课堂后台／bfcache 隐私屏。健康检查、双端 public smoke、匿名生产浏览器、历史预览数据路由与生产 bundle 标记均通过，未操作生产课堂数据。
- T-110 已在 T-109 后通过 Chromium 总回归，仍等待 T-088 的 Safari／真实触摸设备行，因此保持 `in-progress`。
- T-088 已用真实隔离 Candidate、Test Classroom 和学员账号完成 10 组 Chromium 响应式／粗指针工程验收：无横向溢出、关键控件不小于 44×44、编辑字段不小于 16px、私卡隔离、触摸翻页、结构化提交、导师退回／重交／通过、离线恢复和完整 viewport 隐私遮挡均通过。
- 真实 iPad Safari 与 Android 触摸设备仍必须由人执行；标准记录模板为 `docs/qa/t088-tablet-mobile/REAL_DEVICE_ACCEPTANCE_TEMPLATE.md`。本总单不会用模拟器结果代签 ViewAcceptanceReceipt 或 UiAcceptanceReceipt。工程发布完成后，唯一剩余关闭条件是两类设备的可追溯人工验收记录。

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

## 7. 2026-09-11 原始需求细项与交付覆盖复核（进行中）

### 用户反馈与本轮已确认项

- **T-093：范围漏项且曾提前关闭。** 旧回执只验证 D 导师 PPT；现已补齐 Classroom 真实进度条，并完成隔离浏览器验证、生产发布及登录后只读真实控件复验。人工 View/UI 验收未代签。
- **T-111：删除曾被弱化为可选。** 现已恢复为必交付项；活跃/历史 TEST 的删除 UI、API、权限、原子数据库删除和证据阻断已完成，隔离临时 D1 中已真实删除并验证旧链接 410，生产已发布且完成非破坏性权限/Schema/构建复验。归档、重置没有被当作删除证据，也没有拿用户真实课堂做破坏性冒烟。
- **T-110：代码与部署状态继续分开。** 本地或 Chromium 通过不替代真实 Safari/触摸设备与用户人工验收。
- 以上不是对“全部历史需求丢失”的证明，也不能凭两项推算漏项数量。全量复核仍需区分未记录、记录失真、实现遗漏、未部署、已部署未验收及后续需求变更。

### 复核方法与产物

- [ ] 覆盖导航/账号、验收发布、TEST 生命周期、课程数据与角色字段、学员 Pad 交互，再逐项复核其余历史 TODO。
- [ ] 每项拆为可观察行为，记录原话/截图入口 → TODO → 实现位置 → 测试 → 发布构建 → 实际验收。
- [x] 对 T-093 区分 PPT 与 Classroom；使用真实 Classroom 进度条测试，不用下拉框或 PPT 替代。
- [x] 对 T-111 区分 C/R/U/D；使用临时 D1 实际物理删除，不用归档或重置替代。
- [ ] 对其余 completed/done 条目逐项查漏；确有遗漏则重开原单并保留已完成子范围。
- [x] 已记录生产发布身份、点击验收路径和剩余人工项，并在本次最终交付中同步；代码或局部测试未被当作上线。

本总单保持 `in-progress`；T-093/T-111 的本轮工程交付不会被用来把整个 T-097 标记完成。

## 总体验收

- [x] 子任务逐项给出代码、自动化测试和部署证据；人工设备验收继续单列，未被机器证据替代。
- [x] 实现前已按用户确认收口准入/完成语义，没有擅自重构产品规则。
- [x] 保留旧课程、旧课件、课堂状态和人工审核历史。
- [ ] 最终对用户回报本轮发现如何解决、哪些仍待人工验收；不把 TODO 已写等同于功能已完成。
