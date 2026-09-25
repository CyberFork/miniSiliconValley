---
type: todo
id: T-073
title: "全站同步 PDMO 四导师分工与新版五步骤"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - course-design
  - pdmo
  - curriculum-refactor
  - content-consistency
  - production-site
---

# 全站同步 PDMO 四导师分工与新版五步骤

## 原始记录

我现在看 https://minisv.vip/framework/ 中的【M01 找问题、M02 识别真问题、M03 想解决方案、M04 制作与验证 MVP、M05 市场、运营与品牌】和我们后面根据 PDMO 更新的五个步骤好像还没有同步？

再看看还有没有其他地方有这方面问题，先收集为 todo。

## 问题结论

线上首页已经采用新版“一世界、两轨线、三引擎、四导师、五步骤、六分钟”，但课程框架页、世界页内的课程大纲、真实课堂运行层和家长问答仍存在旧结构，当前形成了多套互相冲突的课程真值。

T-068、T-069 的完成回执主要覆盖 `tools/live-run` 的 Alpha 八席运行实现，不能代表 `mini_silicon_valley_world` 主应用、公开官网和课堂 campaign 已全部同步。本 Todo 作为跨产品补漏任务，不回退 T-068、T-069 的已有成果。

## 唯一目标口径

### 1·2·3·4·5·6 总纲

1. 一个世界：真实科技创业有限开放世界。
2. 两条轨道：历史认知轨与现实创业轨。
3. 三种游戏方式：探索、情境、决策三引擎。
4. 四个导师分工：P 产品导师、D 开发导师、M 市场导师、O 运营导师。
5. 五个完整步骤：找真问题、定真方案、做真产品、进真市场、跑真运营。
6. 六分钟 Demo：Demo Day 是五步完成后的终局，不是第六个课程步骤。

### PDMO 边界

- PDMO 是四类导师的专业分工，不是四名学员的固定身份，也不是学员进入任务的必填角色。
- 学员统一是 Young Builder 团队成员，可以在任务中承担不同动作，但产品界面不再要求学员认领 P／D／M／O。
- 历史案例中的人物／身份卡可以继续存在，但必须明确它是情境游戏身份，不等于 PDMO 导师分工。
- 四类导师横向贯穿五步；每一步有主导师和协作导师，但不能再次把导师分工改造成五个互相隔离的专业章节。

### 五步主责

1. 找真问题｜P 主导：发现问题信号、访谈取证、确认目标用户与问题证据。
2. 定真方案｜P＋D 主导：比较解决路径、明确价值主张、判断技术与交付可行性。
3. 做真产品｜D 主导：制作 MVP、真实测试、根据证据迭代。
4. 进真市场｜M 主导：品牌表达、渠道实验、获得第一批真实用户。
5. 跑真运营｜O 主导：用户进入与使用流程、交付 SOP、成本资源、风险合规、反馈留存和下一轮迭代。

## 已确认的未同步位置

### A. 公开课程框架 `/framework/`

对应源码重点：`app/123456/CourseSystem.tsx`、`app/123456/page.tsx` 及页面样式／元数据。

线上仍明确显示以下旧口径：

- 总图仍写“四角色”“五任务”，并说明“四角色是协作，五任务是主线”。
- 第 04 节仍是 `FOUR ROLES`，标题为“PDMO：让每个学生看见完整创业协作”，四张卡是产品探索者、技术建造者、市场讲述者、运营协调者。
- 探索、情境、决策引擎的说明仍把 PDMO 当作学员角色和课堂内角色行动。
- 五任务仍为：找问题、识别真问题、想解决方案、制作与验证 MVP、市场／运营／品牌。
- Google 第一战役、90 分钟导师体验课、知识库结构、交付验收、页尾总结仍使用旧五任务／四角色表述。
- 页面 title、description、锚点、英文标签和可访问性文案需要一起更新，不能只替换五张任务卡标题。

期望修改：

- `FOUR ROLES / 四角色` 改为 `FOUR MENTORS / 四导师`。
- `FIVE MISSIONS / 五任务` 改为 `FIVE STEPS / 五步骤`。
- 重写三引擎中的导师支援方式，删除“PDMO 学员轮流认领”的机制描述。
- 按新版五步重新组织每一步的问题、历史情境、游戏动作、现实实践、交付物、完成门槛、主导师与协作导师。
- 为“跑真运营”保留独立内容、交付物和验收门槛，不再与市场合并。

### B. 世界页中的“课程大纲”视图

对应源码重点：

- `app/data/curriculum.ts`
- `app/components/CurriculumOutline.tsx`
- `app/components/WorldApp.tsx`
- `app/lib/model.ts`

当前 `curriculumCatalog` 仍把课程定义为六个 stage：

1. `find-problem`／找问题
2. `validate-problem`／识别真问题
3. `design-solution`／想解决方案
4. `mvp-vc`／MVP 原型＋VC
5. `operate-brand`／运营＋品牌
6. `demo-day`／Demo Day

这与新版“五步骤＋终局 Demo”冲突，也会把旧结构继续传播到世界页弹层、企业 Journey、贡献协议、示例映射和知识关系中。

期望修改：

- 将“找问题＋识别真问题”合并为“找真问题”。
- 将“想解决方案”调整为“定真方案”。
- 将“MVP 原型＋VC”调整为“做真产品”；VC 继续作为贯穿式资源机制，不成为步骤标题。
- 将“运营＋品牌”拆成“进真市场”和“跑真运营”。品牌表达归入市场进入，承诺兑现、交付与留存归入运营；跨步内容按主目标拆分。
- Demo Day 从 `stages` 主步骤中移出，建模为五步完成后的 finale／release gate。
- 同步 Google Journey、example 映射、contribution protocol、非协商原则和所有计数文案。

### C. 真实课堂 `/classroom/` 与 campaign 数据

对应源码重点：

- `app/classroom/ClassroomApp.tsx`
- `app/lib/classroom-model.ts`
- `app/lib/classroom-store.ts`
- `app/lib/classroom-rules.ts`
- `app/lib/classroom-validation.ts`
- `app/data/classroom-campaigns.ts`
- `app/data/google-classroom-campaign.ts`
- `app/data/eleme-classroom-campaign.ts`
- `app/data/student-classroom-copy.ts`
- `app/data/student-classroom-game-copy.ts`

已确认的旧结构包括：

- `CampaignStage` 仍是 `find-problem`、`validate-problem`、`design-solution`、`build-mvp`、`operate-brand`。
- `CLASSROOM_PHASES` 中仍有面向学员的 `pdmo` 阶段。
- 学员 member 数据仍保存 `pdmoRole` 与 `supportCommitment`，挑战仍通过 `recommendedLead`、`requiredSupport` 引用 PDMO。
- 已部署课堂前端仍显示“团队·PDMO”“PDMO 分工”“四个角色共同完成一件事”，部分版本虽将其降为“进阶可选”，仍然没有落实“PDMO 只属于导师分工”。
- 课堂五章导航仍显示“找问题／识别真问题／想解决方案／MVP 原型／运营＋品牌”。
- Google campaign 的五章结构仍是旧 stage；饿了么目前仍被描述为“找问题”单章课。
- 完成提示、Demo Day 前置条件、档案导出和审计文案仍使用“五任务”旧名称。

期望修改：

- 新课程和新 Run 不再给学员分配、保存或展示 PDMO 角色。
- 把 PDMO 变成导师席位／导师专业支援信息；学员行动记录只描述具体贡献，不贴 PDMO 标签。
- campaign 迁移到新版五步骤；历史身份卡继续独立存在，避免误删角色扮演机制。
- 重写阶段导航、阶段完成门、挑战主责、课堂提示、导出结构与 Demo Day 前置判断。
- 兼容已有房间／归档数据：旧 stage ID 和 `pdmoRole` 不可直接破坏性重命名；需要版本化迁移或只读兼容映射。

### D. 家长问答 `/parents/`

对应源码重点：

- `app/data/parent-qa-knowledge.ts`
- `app/lib/parent-qa.ts`
- 家长问答静态页的推荐问题／引导文案
- 已人工审核的课程知识条目和来源映射

当前公开页仍显示“PDMO 四个角色分别做什么？”并提示家长询问“PDMO 分工”。需要确保回答不再把四名学生分别解释成产品、开发、市场、运营角色。

期望修改：

- 推荐问题改为“PDMO 四类导师分别怎样支持孩子？”等不歧义表达。
- 家长答案明确：PDMO 是导师专业分工；孩子是完整参与五步的团队成员，不被固定贴角色标签。
- 课程流程答案同步新版五步骤，说明 Demo Day 是终局而非第六步。
- 对旧知识条目逐条人工审核后再改；知识缺口仍只进入审核清单，禁止模型自行补写或自动入库。

### E. 课程编辑器、课程 JSON 与 Alpha 联调

关联 T-071、T-072。

公开工作坊页面目前没有直接显示旧五步文案，Alpha 入口也已显示“4 导师＋4 学员”；但两者实际加载的课程 JSON、卡组、运行快照和课堂适配器仍需纳入一致性验收。

期望修改：

- 课程 JSON 的宏观步骤只能使用新版五步骤，并记录导师主责／协作关系。
- 编辑器预览、验证器、默认模板、示例课和发布结果均使用同一套步骤字典。
- Alpha 的 4 个导师席位保持 P／D／M／O；4 个学员席位不得再次出现 PDMO 学员身份。
- T-071 的阶段卡组按新版五步归属；T-072 的热同步不能把旧结构重新写回正在调试的 Run。

### F. 文档、测试和发布验收

重点审计范围：

- `docs/CURRICULUM_OUTLINE.md`
- `docs/GAMEIFIED_COURSE_BUILD_V3.md`
- `docs/DM_MENTOR_MANUAL.md`
- `docs/CLASSROOM_ARCHITECTURE.md`
- `docs/STUDENT_MENTOR_LAYERING.md`
- `docs/TEAM_ACCEPTANCE_GUIDE.md`
- `docs/PARENT_QA*.md`
- `tests/curriculum.test.ts`
- `tests/classroom-*.test.ts`
- `tests/render.test.ts`
- `tests/interaction-contract.test.ts`
- `tests/parent-qa*.test.ts`
- 线上 smoke／release receipt

期望修改：

- 文档中的概念、阶段数量、导师／学员权限与实际产品一致。
- 删除“学员 PDMO 分工必须完成才能推进”等旧断言，新增“学员没有 PDMO 固定身份”的回归测试。
- 新增全站一致性测试，检查五步骤顺序、Demo Day 终局语义、O 的独立步骤和禁用旧显示文案。
- 发布回执必须分别证明 `/framework/`、世界页课程大纲、课堂、家长问答、课程编辑器和 Alpha，而不是只验证其中一个实现。

## 当前已正确或暂不判定为问题的位置

- `https://minisv.vip/` 首页已显示“一世界、两轨线、三引擎、四导师、五步骤、六分钟”，当前口径正确。
- `https://minisv.vip/alpha/` 入口已显示“4 导师＋4 学员”，表层口径正确；仍需验证进入后的实际席位和课程内容。
- `https://minisv.vip/workshop/` 公开表层未发现旧五步标题；是否正确取决于编辑器加载和发布的课程 Schema，归入 T-071、T-072 联合验收。
- 一般语义中的“角色”（例如历史人物、情境身份、DM 扮演 NPC）不应机械删除；只修复把 PDMO 当作学员固定／可选角色的地方。

## 实施顺序

1. 建立唯一课程术语表和新版五步骤 ID／显示名映射，明确 Demo Day 的 finale 数据结构。
2. 设计旧课程、旧课堂房间和归档数据的兼容策略，再调整 Schema；禁止先做全局字符串替换。
3. 迁移 `curriculumCatalog`、Google／饿了么 campaign、课程 JSON 和家长知识条目。
4. 更新 `/framework/`、世界页课程大纲、课堂、家长问答、编辑器和 Alpha 展示。
5. 更新导师手册、学员文案、测试和发布回执。
6. 分环境验证本地、Alpha、正式课堂和公开官网，最后再发布生产。

## 验收标准

- `/framework/` 的 1·2·3·4·5·6 总图、正文、Google 示例、导师体验课、交付标准、元数据和页尾全部使用新版口径。
- 世界页课程大纲只显示五个课程步骤；Demo Day 独立显示为六分钟终局。
- 新建课堂按“找真问题→定真方案→做真产品→进真市场→跑真运营”运行，O 拥有独立目标、动作、作品和完成门槛。
- 学员端不存在认领 P／D／M／O、等待 PDMO 分工或以 PDMO 作为推进前置条件的界面与 API。
- 四个导师席位仍能分别看到 P／D／M／O 的专业责任、当前主责步骤和协作提示。
- 家长问答对 PDMO、课程流程、市场与运营区别的回答与新版口径一致，并继续遵守人工审核入库规则。
- 旧课堂归档可读；新结构上线不破坏已有课堂状态或数据审计链。
- 课程编辑器、课程 JSON、Alpha Run 与正式课堂使用同一版本化课程真值。
- 自动测试和浏览器验收覆盖桌面／移动端、导师／学员视角及五步完整流程。
- 生产发布后再次抓取所有公开入口和前端 bundle；除迁移兼容代码、历史回执或明确引用旧版的文档外，不再出现旧版显示文案。

## 关键控制点

五步课程唯一真值；PDMO 只属于导师分工；历史身份卡与导师专业分工分离；O 独立成步；Demo Day 不是第六步；旧数据兼容；编辑器与课堂同源；家长知识人工审核；全站而非单页验收。

## 盘点证据

- 2026-09-06 实际抓取 `https://minisv.vip/`、`/world/`、`/framework/`、`/parents/`、`/classroom/`、`/alpha/`、`/workshop/`。
- 已检查生产前端 bundle 中的 `CourseSystem`、`WorldApp` 和 `ClassroomApp` 文案与内置课程数据。
- 已检查本地 `app/data/curriculum.ts`、`app/lib/classroom-model.ts`、`app/data/google-classroom-campaign.ts`。

## 关联 Todo

- [[68-pdmo-mentor-role-and-123456-framework|T-068]]
- [[69-four-mentor-five-step-course-loop|T-069]]
- [[71-course-json-stage-card-decks|T-071]]
- [[72-course-editor-alpha-live-sync-controls|T-072]]

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- 相关证据：<https://minisv.vip/>。
