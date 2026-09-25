---
type: todo
id: T-077
title: "在顶部栏增加课程大纲入口并安全集成 chj 课程 UI"
status: completed
created: 2026-09-06
updated: 2026-09-06
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - navigation
  - course-outline
  - chj-branch
  - deployment
  - ui-integration
---

# 在顶部栏增加课程大纲入口并安全集成 chj 课程 UI

> **2026-09-08 架构更新：**取消把 `chj` 整站继续作为完整“课程大纲”的方向；其现有内容归类为 P 产品导师的一个 CoursewarePackage，并迁入 `/course/{slug}/` 课件库。统一以 T-085 和 `docs/COURSE_PLATFORM_ARCHITECTURE.md` 为准。

## 原始记录

在站点顶部栏增加一个明确的“课程大纲”入口，并把当前 `chj` 分支中已经制作的课程首页／课程大纲 UI 集成和部署到正式站点。

本任务的目标不是把 `chj` 整个分支直接覆盖生产，而是把其中已验证的课程 UI 作为课程大纲产品入口安全接入现有 MiniSV 系统，同时保留主分支现有的 Alpha、课程编辑器、课堂、家长问答、部署脚本和安全能力。

## 当前 chj 分支快照

本 Todo 创建时的远端状态：

- 仓库：`CyberFork/minisv`
- 分支：`chj`
- 当前提交：`679213a61b835335016eac7649213983a0e48489`
- 提交信息：`first commit`
- 文件数：151

实施时必须先重新 fetch，并将实际评审／部署版本固定到明确 commit SHA；不能仅使用会继续移动的 `chj` 分支名作为发布依据。

## 调研结论

### 1. chj 已经包含独立的课程大纲体验

主要实现包括：

- `app/components/CourseHome.tsx`
- `app/components/CourseOutline.tsx`
- `app/components/CourseOverview.tsx`
- `app/components/CourseChapterOne.tsx`
- `app/components/CourseChapterDeck.tsx`
- `app/components/ProblemHunter.tsx`
- `app/components/WorldApp.tsx`
- `app/game-home/page.tsx`
- `app/globals.css`

主要视觉资产包括：

- `public/assets/course-outline-world-map-v2.png`
- `public/assets/course-outline-chapter-icons.png`
- `public/assets/mini-silicon-valley-logo*.png`
- `public/assets/home-*.png`
- `public/assets/course-overview-*.png／jpg`
- `public/assets/mission-*.png`

chj 的课程 UI 已出现“课程大纲”导航按钮、像素课程地图、课程概览和章节内容，因此可以作为新入口的候选基础。

### 2. chj 与 main 不是可整分支替换的同构实现

当前 `chj` 相对 `main` 的差异接近一次独立产品分支，而不是一个小型导航补丁。直接用 chj 部署覆盖 main 会删除或丢失大量主线能力，包括：

- `.codex/inbox/todos` 项目 Todo。
- `tools/live-run/` Alpha 主控、八席控制台、席位页和课程编辑器。
- `deploy/minisv/` 网关、Hecate 发布、回滚、安全配置和 UI Theme。
- Course Package Schema、课程 JSON、Alpha 测试和发布回执。
- 主分支现有 `CurriculumOutline` 与部分课程数据／测试。

因此禁止直接执行“将 chj 强制覆盖 main”或“从 chj 整站发布到当前生产根目录”。正确方式是文件级／组件级审查、移植和集成。

### 3. chj 课程大纲当前主要是应用内部 view，不是稳定 URL

`chj` 的 `WorldApp.tsx` 通过内部 `view === "outline"` 显示 `CourseOutline`；多个导航按钮调用状态切换。若直接照搬，可能出现：

- 浏览器地址不变化，课程大纲无法可靠分享和刷新恢复。
- 顶部栏不同页面各自维护一套导航状态。
- 从 `/classroom/`、`/alpha/` 或外部链接返回课程大纲时行为不一致。

集成时应为课程大纲建立正式语义 URL。默认建议使用 `/course/` 或 `/outline/` 中一个经过确认的固定入口，并为旧状态入口提供兼容跳转；最终 URL 必须在实现前固定并写入站点地图。

### 4. 当前已有多个顶部导航实现

chj 中至少存在：

- `WorldApp.tsx` 的 `.topbar / .primary-nav`
- `CourseHome.tsx` 的 `.pixel-home-nav`
- `CourseOutline.tsx` 的 `.pixel-outline-nav`
- `CourseOverview.tsx` 的 `.pixel-home-nav`
- `app/game-home/page.tsx` 的 `.game-home-nav`

不能只在其中一个 Header 增加按钮，否则进入课程页面后入口和选中态会再次漂移。需要统一顶部导航的路由、标签、选中态、移动端布局和返回行为。

## 产品目标

### 顶部栏

- 顶部栏增加一级入口：`课程大纲`。
- 入口在桌面和移动端均清晰可见，不藏在不明确的图标中。
- 当前位于课程大纲及其子页面时显示正确 `aria-current="page"`／选中态。
- 支持键盘、触控和浏览器返回。
- 不破坏现有首页、历史世界、课堂、家长问答、Alpha 内测及账户入口。

### 课程大纲页面

- 使用 chj 的像素课程地图、章节卡、课程概览和必要视觉资产作为候选实现。
- 遵守 `mini-silicon-valley-design` Skill：品牌蓝、mint、黄色线索、真实 HTML、清晰中文、游戏化任务地图和响应式布局。
- 课程结构和文案必须在接入前按 T-073／T-075 校准，不允许把 chj 中可能存在的旧课程真值直接发布。
- 课程大纲只能读取统一 Course Package／Course Registry 的 Released 课程定义；不能成为第三套手写课程数据。

## 安全集成方案

### A. 固定并审计 chj 候选版本

1. Fetch 最新 `origin/chj`。
2. 记录待集成 commit SHA。
3. 对比 `origin/main..<chj-sha>` 的文件、依赖、资产、路由和测试。
4. 对 chj 执行 secret／大文件／生成物扫描。
5. 单独构建 chj 候选版本并生成预览，不先覆盖生产。

### B. 组件级移植，不整分支覆盖

- 优先移植 Course Home／Outline／Overview／Chapter 组件和真正使用到的资产。
- 保留 main 的 Alpha、Editor、Classroom、QA、部署和安全代码。
- 不移入无运行必要的 `output/`、压缩交付包或重复生成物。
- 对大体积图片做使用盘点和 Web 优化；只提交／部署实际引用的资产。
- 逐项解决 `CurriculumOutline` 与 `CourseOutline` 的命名和职责冲突，禁止两套入口长期并存。

### C. 建立稳定路由

- 为课程大纲建立可直接访问、刷新、分享的 URL。
- 顶部栏使用真实链接或正式路由导航，不只依赖内存 `setView()`。
- 子页应能返回课程大纲，浏览器返回不应丢失位置或跳回错误首页。
- 更新 canonical、站点地图、导航测试、网关／静态发布映射和 404 回退。

### D. 接入统一课程数据

- chj UI 中的课程章节、步骤、导师、卡牌和交付物不得作为独立硬编码真值直接上线。
- 页面从 T-075 统一 Course Package 的 Released 版本生成展示投影。
- 五步骤统一为：找真问题、定真方案、做真产品、进真市场、跑真运营。
- PDMO 统一为产品、开发、市场、运营四导师，而不是四名学员角色。
- 六分钟 Demo 是五步完成后的终局。
- 页面显示课程 revision／digest，便于与 Editor、Alpha、Classroom 核对一致性。

### E. 预览、合并与发布

1. 先生成隔离预览 URL，验证课程入口和 chj UI。
2. 在手机、平板、桌面和投影尺寸完成视觉验收。
3. 运行 main 全量测试，重点保证 Alpha／Editor／Classroom 没有回归。
4. 以普通合并提交或经过审查的文件级提交进入 main，禁止 force 覆盖 main。
5. 使用现有 Hecate 原子发布／回滚流程部署。
6. 发布后核验顶部栏、课程大纲 URL、资源、返回行为、版本标识和所有现有入口。

## 导航范围盘点

实施时至少核查以下表面是否需要显示“课程大纲”：

- MiniSV 公开首页顶部栏。
- 世界／历史地图页面顶部栏。
- 课程大纲及章节页自身导航。
- `/framework/` 与课程大纲的关系和是否需要合并／重定向。
- `/classroom/` 登录前公共导航和登录后是否只保留辅助入口。
- `/parents/` 公共导航。
- `/alpha/`、`/control/`、`/control/editor/` 属于内部工作面，不应机械复制公开站点完整导航；可按需要提供“查看课程大纲”辅助链接。

## 自动化与浏览器验收

### 功能验收

- 顶部栏“课程大纲”从所有约定公共页面都能到达同一稳定 URL。
- 直接打开、刷新、复制链接和浏览器前进／后退均正确。
- 课程章节按钮、返回课程大纲和最终 Demo 入口均可用。
- 当前导航选中态正确且有可访问语义。
- 未引用的 chj 资产和交付压缩包不会进入生产发布。

### 数据一致性验收

- 课程大纲显示的 `courseId / revision / digest` 与正式 Released Course Package 一致。
- 五步骤、四导师、13 Block／章节映射、卡牌和 Demo 结构通过 T-075 三端契约测试。
- 页面中不存在旧五步名称或学员 PDMO 分工的残留显示文案。
- 修改课程必须经过 Editor → Alpha → Released，不能直接修改课程大纲页面硬编码。

### 视觉验收

- 按 `mini-silicon-valley-design` Skill 检查品牌、像素游戏感、中文可读性、地图比例和按钮层级。
- 390、430、768、1440px 下无横向 overflow、重叠、裁切和不可点击区域。
- 顶部栏在移动端不因增加入口而压缩 Logo 或隐藏主要操作。
- 课程地图的背景和 Overlay 作为固定比例 Stage 整体缩放，节点不漂移。
- 所有主要中文保持真实 HTML，图片不替代导航和课程说明。

### 回归验收

- Alpha 八席、`/control/`、`/control/editor/` 仍可用。
- `/classroom/`、`/parents/`、`/framework/` 和历史世界入口不回归。
- 主分支构建、类型检查、Lint、数据验证和现有测试全部通过。
- 生产健康检查和回滚演练通过。

## 验收标准

- 站点顶部栏存在明确且一致的“课程大纲”一级入口。
- 课程大纲拥有稳定、可分享、可刷新的 URL。
- chj 的课程 UI 已经过文件级审计和选择性集成，而不是整分支覆盖生产。
- main 的 Alpha、Editor、Classroom、QA、部署与安全能力完整保留。
- 课程大纲使用统一 Released Course Package，不形成新的课程真值。
- 新版五步骤、四导师和六分钟 Demo 口径正确。
- 桌面、移动端和课堂投影完成浏览器验收。
- 发布版本绑定明确 chj commit 和 main 集成 commit，并保留发布／回滚回执。

## 关联 Todo

- [[73-full-system-pdmo-five-step-consistency|T-073]]
- [[75-unified-course-source-editor-alpha-classroom|T-075]]
- [[76-alpha-ui-readability-and-responsive-adaptation|T-076]]

## 关键控制点

顶部栏统一入口；稳定课程 URL；固定 chj commit；组件级移植；禁止整分支覆盖 main；保留 Alpha／Editor／Classroom／QA；课程大纲读取统一 Released Course Package；新版五步骤与四导师；大图资产治理；移动端与投影验收；原子发布和可回滚。

## 已废止的旧完成回执

> 以下回执对应被用户否决的“抽取视觉并重写页面”版本，仅保留审计记录，不再代表当前生产。


- 正式入口：`https://minisv.vip/course/`。
- Hecate release：`20260906T085800Z-t077-course-outline-r2`。
- 生产源码：main `b05964fac2660f1021a4159924b0e1536faf10e9`；chj 视觉审计 `679213a61b835335016eac7649213983a0e48489`。
- Git 最终回执提交：`6794e512206e7226721656267757b015a0e245e3`，均已推送到 `CyberFork/miniSiliconValley` main。
- 采用稳定 `/course/` 路由和 hash 深链；公开首页、历史世界、课程页、方法页、家长页均可到达同一入口。
- 课程数据只读投影现有 Google／饿了么 Course Package Released r0：每课 5 步、13 Block、5 卡组，四导师分工，学员不固定 PDMO，六分钟 Demo 位于五步之后。
- chj 仅选择性迁移两张 WebP：课程地图约 479 KiB、章节图标约 224 KiB；未迁移 108 MB 资产树、压缩交付物和旧课程硬编码。
- 自动化：核心 Web 27/27、部署契约 17/17、LIVE RUN Python 33/33、UI runtime 通过。
- 浏览器：课程页 390／430／768／1440 px；五个公共页面 390／1440 px；分享、刷新、前进／后退、节点边界、横向溢出与 pageerror 全部通过。
- 发布前后玩法状态逐字段一致；两次受控重启只各追加一条 `classroom.snapshot.refreshed` 审计事件。
- 回滚目标：`20260906T084404Z-t077-course-outline`。
- 实现说明：仓库 `docs/TODO_077_IMPLEMENTATION.md`；机器回执：`docs/TODO_077_PRODUCTION_RECEIPT.json`。


## 用户修正（2026-09-06）

此前“组件级移植并按 T-073／T-075 改写”的实施方向已被用户明确否决。最新且优先级最高的验收口径是：

- 不修改同事任何页面内容；
- 固定 `CyberFork/minisv` chj 提交 `679213a61b835335016eac7649213983a0e48489`；
- 将该提交的完整原版网站构建后部署到 `https://minisv.vip/course/`；
- main 只保留入口、路由、托管和不可变校验；
- 禁止抽取视觉后重写页面，禁止注入 main 主题，禁止将 Course Package 文案覆盖到同事页面。

旧的“选择性迁移”“统一 Released Course Package 投影”“五步骤校准”验收项不再适用于 `/course/` 页面内容；它们仍可用于 Alpha／Editor／Classroom，但不得作为修改同事站点的理由。


## 修正完成回执（2026-09-06）

- 正式入口：`https://minisv.vip/course/`。
- Hecate release：`20260906T100023Z-t077-chj-verbatim-r1`。
- main 集成：`e4871ae25cc55f99efb985e2425070284587d369`；发布回执：`0302546be1cf5672d72280ea4840a396afbd5bac`。
- chj 源码：commit `679213a61b835335016eac7649213983a0e48489`，tree `3a041c4714190cc026f6de8e06e15cec0e5f765d`；构建前后干净且未修改。
- 课程 artifact：103 个文件，114,365,669 bytes，目录摘要 `e39ebedc1b4b68230e551deeab9860ba6ce1a608c7b400d21c12d87f8f17b8f9`；本地输入、release 输出与 Hecate 生产三方一致，`transformed=false`。
- 原错误实现 `app/course/`、课程投影和二次转码视觉资产已从 main 删除。
- 自动化：main 23/23、部署 17/17、LIVE RUN 33/33；本地与生产浏览器均通过 390／430／768／1440 px、原版首页→课程大纲→返回流程及资源加载。
- 固定 chj 提交自身完整测试为 26/27；唯一失败是既存测试仍期待页面出现“外卖平台”，未为追求绿灯而改动同事源码或测试。类型、Lint、生产构建均通过。
- 发布前后玩法语义哈希完全一致；受控重启只新增一条课堂快照审计事件。
- 未触碰 `cyberforker.com`；回滚目标为 `20260906T085800Z-t077-course-outline-r2`。
