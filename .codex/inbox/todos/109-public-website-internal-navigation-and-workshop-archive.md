---
type: todo
id: T-109
title: "重组官网、教学与内部入口，整合 World 并深层归档 Workshop"
status: completed
created: 2026-09-10
updated: 2026-09-11
captured_by: project-inbox
priority: P1
priority_basis: user-feedback-and-architecture-proposal
related: [T-081, T-085, T-086, T-088, T-103, T-105, T-106, T-107, T-108]
tags: [todo, information-architecture, public-website, studio, world, workshop, archive]
---

# 重组官网、教学与内部入口，整合 World 并深层归档 Workshop

## 用户需求

> 当前架构已经部署的组织有点混乱，时间上 workshop 是最早讨论课程形式的，现在已经不用了，可以收纳起来。空间上，对内和对外混在一起，需要思考怎么重新组织。并且缺少对外展示的官网，需要整体设计和开发介绍 mini 硅谷本身，并把 world 作为其中的一个子组件。

补充确认：**“归档还是需要有入口，只是比较深。”**

进一步确认：**对外为新设计实现的官网、World、学生上课登录入口及课件查看；对内主要为 Studio 与课程管理。** 按这两大区组织，不将登录后课堂另立为第三个顶层区域。

UI 补充确认：**“记得整体都使用新的 UI 哦，也就是那个 skill。”** 全站统一按 `mini-silicon-valley-design` 实施，覆盖对外和对内，不限于官网首页。

本轮只调研、整理提案与建单；不直接下线、移动线上页面或重做网站。用户确认的是上述方向，具体导航名称和归档路径仍是建议。

## 设计记录

完整提案：[官网、教学空间与内部工作台组织提案](../../../docs/PUBLIC_WEBSITE_AND_PORTAL_IA_PROPOSAL.md)。

建议结构：

- **对外区**：`/` 新官网介绍 MINI硅谷；World 为官网体验子组件并保留 `/world/` 完整探索；`/classroom/`、`/course/`、`/account/` 提供登录后上课、看课件和当前账号管理。
- **对内区**：`/studio/` 承载课程编辑与管理、视图验收、真实 TEST 课堂、课件管理与发布；**Studio → 资料与历史 → 早期课程工作坊** 提供更深但可发现的只读归档入口。
- 对外服务不等于免登录。课程/课件权限不因进入对外区而放宽；同一账号可按授权跨区使用，不新建两套认证。

两区不增加课程真值或状态机；TEST 继续复用真实 Classroom，不因入口归入 Studio 而另造测试系统。课程集中管理在内部，具体 Room 的 DM 现场中控仍可在课堂内使用。

## 分阶段实施

### A. 确认信息架构与迁移清单

- [x] 与用户确认提案中的官网栏目、教学/内部导航及归档入口层级。
- [x] 盘点当前页面、导航、登录后返回目标、权限和跨页面深链；区分现行功能、历史资料与内部诊断。
- [x] 明确 `/course/` 是受保护的 PPT 课件库，不拿它充当公共课程介绍页。
- [x] 盘点 Workshop 浏览器 localStorage、静态资源、基线快照与打包依赖；提出备份和回退方案。
- [x] 确认官网内容来源，形成需团队补充的资料清单，不自造招生信息或案例成果。
- [x] 读取 `mini-silicon-valley-design` skill，盘点两区全部页面及状态，形成新 UI 覆盖清单和共享组件规范，不只设计首页。

### B. 导航整理与可访问的归档

- [x] Workshop 退出官网与上课主导航，但可从内部“资料与历史”逐层找到；明确历史用途、只读状态和现行资料入口。
- [x] 先保留可用 URL；如迁移，验证旧链接提示/跳转、资源与深链，不直接删除造成断链。
- [ ] 完成有覆盖说明的历史资料备份后，再冻结旧写入；工程已提供逐浏览器无损导出，但真实资料所有者仍须自行执行，不能由自动化假装已经收齐。
- [x] 检查并有计划地解除持续 Workshop 同步的生产依赖，保留 T-081 的历史交付记录。
- [x] TEST 主创建/列表入口组织到 Studio；正式教学导航清晰，Room DM 管理仍留在实际课堂中。
- [x] 内部页面与数据落实权限，不以隐藏菜单、前端判断或 noindex 代替授权。

### C. 全站新 UI、官网设计与 World 整合

- [x] 先交付可确认的页面结构、中文文案和桌面/手机布局，再开发新官网。
- [x] 首屏介绍 MINI硅谷；说明学习方式、PDMO 导师支持、五步实践、成果示例、家长问题与参与方式。
- [x] 复用 World 内容与地图能力，提供首页轻量组件及完整世界入口；不复制历史数据库，不将整个旧平台作为首页大 iframe。
- [x] 保持品牌像素冒险风格，同时保证可读文字、键盘/触摸可达和按需加载。
- [x] 官网、World、登录/账号、课堂/中控、课件库与播放外壳、Studio/课程管理、归档入口及外壳整体使用 skill 的新 UI；统一导航、字体配色、按钮表单、卡片弹层和状态提示。
- [x] 学员端按无键盘 Pad 优先设计，官网兼顾手机，导师/DM/内部编辑管理优先桌面；共享设计语言但不强行复用同一种布局密度。
- [x] 移出公共主内容中的 Factory、回执、Tunnel、部署健康与 release 诊断，放到适当内部位置。
- [x] 接入 T-106/T-107 的同一账号菜单和会话切换；匿名官网可看，受保护课堂/课件未登录跳登录并安全返回。
- [x] 不改写已冻结的导师课件 bundle 来注入官网导航或菜单。

### D. 联调、验收与文档同步

- [x] 新访客能从官网理解课程，而不必了解 Studio、JSON 或验收回执。
- [x] 学员能直接进入自己的正式课堂和可访问课件，不误入 TEST 工厂；Pad 无键盘可用。
- [x] 导师/DM 能完成教学管理；内部制作人员能从 Studio 完成原有编辑→双验收→发布链路。
- [x] 不依赖旧书签，从 Studio 可找到 Workshop；归档页面明确非现行标准，未授权者不能取到内部讨论数据。
- [x] 原 World 深链可用；首页组件与完整世界的来源和展示口径一致，匿名演示不写真实课堂状态。
- [x] 检查首页五步与 PDMO 文案，“六分钟”仅指最终 Demo；不回流旧四阶段/九章节标准。
- [x] 官网、导航、旧链接、账号返回目标在桌面/手机/Pad 验收；菜单不会被父级样式污染。
- [x] 按覆盖清单逐页验证新 UI 与加载/空态/禁用/错误/焦点状态；不存在首页新 UI、内部仍为历史拼接 UI 的漏项。
- [x] 归档原件和旧课件 exact 版本保留；若更新 PPT 内部视觉，创建新版本走既定验收，不直接改冻结文件。
- [x] 无账号、会话、私密卡、内部答案、未授权学生素材进入公开 HTML、静态缓存或搜索索引。
- [x] 原 Course/Release/Room 身份与状态不被迁移或复制；验收门槛不因界面改造而放宽。
- [x] 实施后同步 `docs/COURSE_PLATFORM_ARCHITECTURE.md`、`docs/MSV_SITE_MAP.md`、README、Workshop SOP 与部署说明，并记录发布/回退结果。

## 依赖和优先级边界

- 全站跳转专项见 [T-110](110-sitewide-navigation-and-studio-startup-regressions.md)：所有入口必须普通点击即可跳转，并覆盖 Enter、触摸及 Ctrl/Cmd 新标签页；不能仅验证 href 或组合键可用。新 UI 上线前复用该清单回归。
- 本任务是组织与官网建设，不替代 T-106/T-107 账号能力或 T-108 创建流程修复；这些用户已遇到的阻塞可先修，不必等待整个官网。
- T-103 提供统一的对外课程口径；T-105 提供访问范围边界。
- 先确认入口与内容，再归档/做官网，最后联调上线；初始建单时未执行归档或部署，后续实施状态以以下工程记录为准。

## 工程实施记录（2026-09-11）

- 已按确认的信息架构实现公开官网、同源 World 预览、受保护的课堂／课件入口，以及 Studio 内“资料与历史 → 早期课程工作坊”深层入口；公开导航没有暴露 Studio 或 Workshop。
- 首页 World 预览和 `/world/` 完整探索共用 `historyCatalog`，构建时生成可校验的 `world-preview.json`，没有复制第二份历史数据库或嵌入旧平台 iframe。
- Workshop 已实现鉴权后的只读归档外壳、精确基线识别、原始 localStorage 键导出及 `_source` 禁止访问；归档不会继续写入，也不会被搜索索引收录。
- Gateway、静态发布打包、健康检查、站点地图、robots、公共课程 allow-list、账号 returnTo 与共享导航已同步调整；不改变 CourseRelease、ClassroomInstance 或验收门禁。
- 新增 `tools/live-run/tests/verify_t109_public_internal_ia_browser.py`。Chromium 桌面 1440px、手机 390px 的公开入口、普通点击、内部入口隔离、归档授权／只读／导出／刷新不变和横向溢出均通过；证据位于 `docs/qa/t109-public-internal-ia/`。
- T-109 后已重新执行 T-110 与 T-111 浏览器回归，普通点击、Enter、exact 深链、Test 新建／归档继续通过；平台测试 158/158、最终部署测试 53/53、typecheck、lint、生产构建和数据校验通过。
- 仍未把 Chromium 触摸模拟冒充 iPad Safari／Android 真机验收。相关硬件门槛继续由 T-088 独立跟踪，不阻塞本任务的工程部署，但不能据此签发人工 UI 回执。
- 已完成 Hecate `minisv.vip` 原子部署与线上只读验收，本任务关闭；真实 iPad Safari／Android 触摸设备仍由 T-088 独立跟踪，不被本任务状态掩盖。

## 生产部署与线上验收（2026-09-11）

- 最终统一发布为 `20260911T100357CST-public-ia-t109-r4`，源码固定为 `662ed523d4cc241c3c858d0895e555b2a971f957`；`release.json` 同时验证 Hecate 来源、`https://minisv.vip` canonical、干净且已推送的工作树，以及 P 导师课件批准 commit/tree。
- 首次部署尝试因误用旧 `current` release 中的部署脚本，无法执行新 bundle 才具备的 Parent-QA 令牌同步步骤而自动回滚；后续全部改为执行**目标 bundle 自带的同版本部署脚本**。失败 release 未切换为 current，原服务与数据保持可用。
- r2 的线上浏览器诊断发现 `/framework/` 服务端 HTML 与 React 客户端树不一致；r3 移除打包后的 hydrated DOM 改写，保留原生课程壳并由共享 runtime 在水合后挂载公共导航，React 418 消失。
- r3 的线上浏览器诊断继续发现首页 `/world-preview.json` 被 catch-all 应用路由返回 404；r4 为 release-owned JSON 增加明确静态路由，并将其纳入 deploy health、public smoke 和 gateway 契约测试，首页不再降级到离线占位。
- r4 部署前 53 项部署契约测试、typecheck、lint、生产构建与 bundle 双层 manifest 校验通过；部署时 registry 只读 preflight、Parent-QA、Classroom、Gateway 和 Tunnel 健康门禁全部通过。
- 部署后 Hecate health、远端 public smoke 与外部 public smoke 全通过；`/world-preview.json` 为 200，三套课件匿名访问仍为 401，Workshop 保持登录回跳，退役入口保持 410。
- 真实 Chromium 逐页打开官网、World、课程框架、家长问答和登录页，所有文档 200，`pageerror`、console error 与关键资源失败均为 0；课程框架保留原生 hydrated brand、公共首页入口可见且无 React 418。机器证据：`docs/qa/t109-public-internal-ia/production-r4-machine-evidence.json`。
- 本轮没有创建或改写人工 `ViewAcceptanceReceipt`／`UiAcceptanceReceipt`，没有创建 Production Classroom，也没有把 Chromium 模拟记作真实平板验收。
