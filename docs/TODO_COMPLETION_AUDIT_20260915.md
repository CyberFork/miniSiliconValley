# 2026-09-15 Todo 全量查漏与交付审计

> 结论：59 份 canonical Todo 已逐项复核。当前没有 `backlog` 或 `in-progress`；56 项完成，3 项只被真实设备／真实资料所有者阻断。结构错误为 0。完成项中仍有 4 项共 6 条“用户人工验收”没有被自动化代签，并由审计器持续警告。

## 1. 审计范围与证据

- 唯一仓库：`https://github.com/CyberFork/miniSiliconValley.git`。
- 本轮功能与部署源码：`0b5d9b1670d961336871130469862fe7a031d890`。
- 生产发布：`20260915T015003CST-t125-todo-audit-r2`，`workspaceProvenance.verified=true`。
- Canonical 队列：`.codex/inbox/todos/*.md`，共 59 份。
- 交叉来源：旧 `dev` 队列、canonical 队列、Todo 之间的 `T-xxx` 引用、Git 历史、当前生产 `release.json`、路由与测试契约。
- 损坏旧工作区未删除，完整保存在：`/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/dev-retired-corrupt-20260915T015529CST`。
- 持久开发目录 `dev` 已从 origin/main 重新克隆，并通过 `git fsck --full`；不再从临时目录与损坏旧树并行写 Todo。

## 2. 为什么会漏掉 Todo

### 根因 A：编号不是全局唯一

- `T-124` 同时被用于“学员时空终端”和“孵化器项目”；清单只看 ID 时，前者完成会把后者错误遮蔽。
- `T-121` 在旧树曾表示“学员时空终端”，在 canonical 则表示“学员批量删除”；后来终端改为 T-124，但旧树仍保留旧编号。
- 修复：终端保留 canonical `T-124`；孵化器原始需求和证据完整迁为 `T-126`；历史重编号写进各自 Todo。

### 根因 B：存在两份相互漂移的任务队列

- T-098 原本要求 `dev` 是唯一工程，但该目录的 Git object pack 已损坏且 HEAD 过旧；后续实现改在安全临时 clone 中推进。
- `T-115` 和孵化器 Todo 只写进旧 `dev`，从未进入 canonical Git，所以远端和发布工程看不到。
- 修复：找回 T-115 原编号并补齐既有 Logo 发布证据；找回孵化器 Todo 并重编号；旧树只读归档，新 `dev` 重新克隆。

### 根因 C：状态词不统一且没有机器门禁

- 历史文件混用 `done`、`complete`、`completed`，简单筛选会得到不同结果。
- 过去没有检查文件名前缀、编号缺口、悬空引用、ID 重复、非法状态或“完成但仍有未勾选项”的工具。
- 修复：全部状态统一为 `backlog | in-progress | blocked | completed`；新增 `scripts/audit-todos.ts` 和 `tests/todo-registry.test.ts`；ID 重复、编号缺口、悬空引用、文件名错号、非法状态和无原因阻断都会失败。`test:course-platform` 每次先执行该审计。

## 3. 本轮补做的功能

### T-115｜新版透明 Logo（找回遗漏记录）

- 功能早已完整实现并部署，但 Todo 文件丢在旧树；本轮把原单迁回 canonical 并核对资源摘要、共享组件、全站覆盖与生产证据。
- 正式字标 SHA-256：`4dbbe4dea625fd372c6d760f2344fbf62b7b15f0d2d14e490cddd56e05ffbe87`。

### T-126｜孵化器、背课文、错题集（修复撞号）

- `/incubator/`、`/incubator/projects/`、`/incubator/projects/recitation/`、`/incubator/projects/mistake-notebook/` 已在上一 release 实现并上线；本轮只修正 Todo 身份，不重复开发或覆盖成品。

### T-125｜受控课堂作业（此前唯一可自动化的真实 backlog）

- 模板工坊：短答、长答、单选、多选，保存不可变 revision；模板创建者或 Admin 可修改，其他导师可复用。
- 定向发放：选择 Classroom，确认 TEST／Production、收件人数和模板版本；发放时快照 active learner。
- 学员端：`/terminal/homework/` 查看本人作业、保存草稿、正式提交、查看导师反馈。
- 回收反馈：导师查看完成率、答案、反馈并关闭作业；关闭后学员只读。
- 权限与一致性：Admin 全局；导师仅自己的 DM／Admin DM 课堂；学员仅本人；幂等冲突、CSRF、网关限流、输入上限、TEST/Production 隔离。
- T-119 公开昵称问卷继续独立，不猜测绑定账号。

## 4. 验证与生产复验

- `npm run test:minisv-app`：206/206 平台测试通过，typecheck、ESLint、T-122 构建、应用构建、smoke、Course Platform E2E、P/D 导师 E2E 全通过。
- T-125 真实 Chromium 隔离测试：导师建模板 → 发给 2 名学员 → 390×844 触摸提交 → 导师反馈 → 学员回读；无横向溢出。
- 部署契约：57/57。
- 生产网关复验发现 r1 漏配 `/api/homework/*`（API 404），没有掩盖；补充网关 owner、写限流和契约测试后发布 r2，匿名 401、DM 会话 200。
- 生产 UI：DM 真实登录只读打开 `/console/homework/`，三块工作流可见，0 page error；未创建真实模板、未向真实课堂发放。
- Hecate health 与外部 public smoke 全通过；生产 D1 已生成 6 个 `homework_*` 表（含既有公开作业表）。

## 5. 仍需真人／实体环境完成的门槛

这些不是漏开发，也没有被标成“完成”。对应 Todo 已转为 `blocked`：

- **T-088｜将无实体键盘的 iPad／平板作为学员课堂一等设备**：详见 `88-tablet-mobile-classroom-experience.md` 的 `blocked_reason` 与未勾选清单。
- **T-109｜重组官网、教学与内部入口，整合 World 并深层归档 Workshop**：详见 `109-public-website-internal-navigation-and-workshop-archive.md` 的 `blocked_reason` 与未勾选清单。
- **T-110｜全站排查普通点击不跳转，并优化 Studio 首屏课程加载**：详见 `110-sitewide-navigation-and-studio-startup-regressions.md` 的 `blocked_reason` 与未勾选清单。

以下功能已经部署完成，但仍保留用户人工验收勾选项，审计器每次都会警告：

- **T-119｜免登录课后作业：自填个人信息、游戏策划表与提交查看**：1 条人工验收待签，详见 `119-team-targeted-questionnaires-and-reusable-templates.md`。
- **T-122｜制作 P1 模块思维 HTML-PPT：投屏展示与教师提示双视图**：1 条人工验收待签，详见 `122-p1-module-thinking-html-deck-and-presenter-view.md`。
- **T-123｜官网、学员服务与 /console 内部工作台的信息架构迁移**：2 条人工验收待签，详见 `123-public-portal-and-console-information-architecture.md`。
- **T-124｜学员像素时空终端：账号、课件、公开空间、钱包与装饰商店**：2 条人工验收待签，详见 `124-learner-time-terminal-space-wallet-and-shop.md`。

## 6. 以后如何避免再漏

1. **一个入口**：只允许从持久 `dev/.codex/inbox/todos/` 建单；临时 clone 可实施，但 Todo 必须提交到 origin/main。
2. **创建即审计**：新建或改名后立即运行 `npm run audit:todos`；重复 ID、编号缺口、悬空引用、文件名不匹配和非法状态直接失败。
3. **测试前审计**：`test:course-platform` 已把 Todo 审计放在第一步；结构坏时不允许用后续测试通过掩盖。
4. **跨树集合比对**：发现旧工作区、分支或临时 clone 时，比较 ID 集合和标题，而不是只比较“某编号是否存在”。
5. **完成不吞人工门槛**：`completed` 中存在 `[ ]` 时持续 warning；外部资料／实体设备阻断使用 `blocked` 并写 `blocked_reason`。
6. **部署后再关单**：功能必须同时有代码、最小确定性测试、生产 route/API 复验和 release ID；r1 的 API 404 正是这条门禁捕获的。
7. **不覆盖旧树**：损坏工作区先完整归档再重建，避免为了“收口”删除唯一 Todo 或用户未提交内容。

## 7. 逐项登记（59 项）

- `T-068` · **completed** · 重构课程总纲：PDMO 改为四类导师分工 · `68-pdmo-mentor-role-and-123456-framework.md`
- `T-069` · **completed** · 落实四导师分工与五步创业闭环 · `69-four-mentor-five-step-course-loop.md`
- `T-070` · **completed** · 部署远端内部测试控制台与八窗口环境 · `70-remote-internal-eight-window-test-console.md`
- `T-071` · **completed** · 将五阶段学员卡组纳入课程 JSON 与编辑器 · `71-course-json-stage-card-decks.md`
- `T-072` · **completed** · 实现课程编辑器与 Alpha 调试课程即时同步 · `72-course-editor-alpha-live-sync-controls.md`
- `T-073` · **completed** · 全站同步 PDMO 四导师分工与新版五步骤 · `73-full-system-pdmo-five-step-consistency.md`
- `T-074` · **completed** · 完善 Alpha 实际课程编辑器的卡组编辑、学员预览与同步验收 · `74-alpha-runtime-course-editor-card-completion.md`
- `T-075` · **completed** · 统一课程编辑器、Alpha 与正式课堂的版本化课程真值 · `75-unified-course-source-editor-alpha-classroom.md`
- `T-076` · **completed** · 修复 Alpha 冒险主题可读性并统一八席响应式 UI · `76-alpha-ui-readability-and-responsive-adaptation.md`
- `T-077` · **completed** · 在顶部栏增加课程大纲入口并安全集成 chj 课程 UI · `77-topbar-course-outline-and-chj-integration.md`
- `T-078` · **completed** · 批量替换失效的 /123456 链接为 /framework/ · `78-replace-123456-links-with-framework.md`
- `T-079` · **completed** · 为课程编辑器增加可折叠课程库侧栏 · `79-collapsible-course-library-sidebar.md`
- `T-080` · **completed** · 为课程卡片编辑增加持续可见的保存入口 · `80-card-editor-visible-save-action.md`
- `T-081` · **completed** · 将已确认与已验收的课程基线反向同步到 Workshop · `81-reverse-sync-approved-course-baseline-to-workshop.md`
- `T-082` · **completed** · 统一全站 Logo 资产并将左上角 Logo 设为主页入口 · `82-reuse-chj-ui-and-logo-assets-across-site.md`
- `T-083` · **completed** · 将课程编辑器升级为九视窗时序所见即所得工作台 · `83-nine-pane-wysiwyg-course-studio.md`
- `T-084` · **completed** · 修复 World 地图节点 Hover 提示的层级遮挡 · `84-world-map-hotspot-tooltip-layering.md`
- `T-085` · **completed** · 重构统一课程工厂、Course Studio 与 Classroom 运行体系 · `85-unified-course-factory-studio-classroom-platform.md`
- `T-086` · **completed** · 补齐课程视图验收、真实 UI 验收与正式发布闭环 · `86-two-stage-course-acceptance-and-navigation-flow.md`
- `T-087` · **completed** · 修复 Studio 导航并完善账号切换与受限 Admin DM 委派 · `87-studio-navigation-account-switching-delegated-dm.md`
- `T-088` · **blocked** · 将无实体键盘的 iPad／平板作为学员课堂一等设备 · `88-tablet-mobile-classroom-experience.md`
- `T-089` · **completed** · 优化开发导师 HTML 课件并完整融入‘立棍’分层控制方法 · `89-development-mentor-deck-ligun-integration.md`
- `T-090` · **completed** · 为开发导师‘立棍’PPT制作剧本杀组课件与课堂编排 · `90-development-mentor-scripted-classroom-package.md`
- `T-091` · **completed** · 将既有饿了么剧本组课件收敛到产品导师P课件与课程包 · `91-consolidate-eleme-script-into-product-mentor-courseware.md`
- `T-092` · **completed** · 导入、部署并发布D导师开发课件到正式Courseware路由 · `92-deploy-development-mentor-courseware.md`
- `T-093` · **completed** · 让课件分段进度条可点击跳转到已解锁状态 · `93-clickable-unlocked-courseware-progress.md`
- `T-094` · **completed** · 查清并修复B01编辑器、测试课堂席位与中控内容不一致 · `94-b01-editor-test-classroom-controller-data-consistency.md`
- `T-095` · **completed** · 修复课程编辑器中不同用户字段意外共用与联动修改 · `95-isolate-course-editor-fields-by-role-and-seat.md`
- `T-096` · **completed** · 完善登录后课件目录并首先导入发布P导师课件 · `96-authenticated-courseware-library-and-product-deployment.md`
- `T-097` · **completed** · 新模型全项目设计一致性审计与优化总单 · `97-project-design-consistency-audit-and-roadmap.md`
- `T-098` · **completed** · 收口唯一开发工程、文档和发布来源 · `98-canonical-workspace-and-release-provenance.md`
- `T-099` · **completed** · 修复多人保存课程时的覆盖与exact指针损坏 · `99-candidate-save-concurrency-and-exact-integrity.md`
- `T-100` · **completed** · 闭合课件内部预览、历史发布与多文件资源更新 · `100-courseware-preview-release-history-and-bundles.md`
- `T-101` · **completed** · 保证课堂状态原子更新及弱网下视图和输入一致 · `101-classroom-atomic-state-and-stale-response-protection.md`
- `T-102` · **completed** · 统一验收版本身份、课堂完成语义与测试矩阵 · `102-acceptance-contract-identity-and-completion-semantics.md`
- `T-103` · **completed** · 收口共享投影实现与PDMO五步对外语义 · `103-shared-projection-and-public-course-semantics.md`
- `T-104` · **completed** · 补齐课程待核对和家长QA缺口的人工审核闭环 · `104-human-review-queues-and-gap-recurrence.md`
- `T-105` · **completed** · 收口Studio验收数据可见范围与课程账号准入 · `105-studio-data-scope-and-account-admission-policy.md`
- `T-106` · **completed** · 真正的已登录账号列表与多账号会话切换 · `106-multi-account-session-switcher.md`
- `T-107` · **completed** · 补齐主页账号入口并统一账号下拉菜单可读性 · `107-home-account-entry-and-menu-style-consistency.md`
- `T-108` · **completed** · 修复课堂创建表单空选项、无反馈禁用及验收引导 · `108-classroom-factory-empty-states-and-actionable-gates.md`
- `T-109` · **blocked** · 重组官网、教学与内部入口，整合 World 并深层归档 Workshop · `109-public-website-internal-navigation-and-workshop-archive.md`
- `T-110` · **blocked** · 全站排查普通点击不跳转，并优化 Studio 首屏课程加载 · `110-sitewide-navigation-and-studio-startup-regressions.md`
- `T-111` · **completed** · 补齐多测试课堂的新建入口、版本选择与归档删除管理 · `111-test-classroom-create-version-and-lifecycle-management.md`
- `T-112` · **completed** · 课程按教学主题自定义命名，解除课程与单一案例的旧耦合 · `112-custom-course-names-and-multi-case-separation.md`
- `T-113` · **completed** · 课堂添加学员支持账号搜索选择 · `113-searchable-learner-account-picker.md`
- `T-114` · **completed** · Admin 学员账号中心：CRUD、昵称、备注、密码与像素头像 · `114-dm-learner-account-management-center.md`
- `T-115` · **completed** · 全站左上角升级为 chj 新版 MINI 硅谷 Logo · `115-upgrade-sitewide-header-to-latest-minisv-logo.md`
- `T-116` · **completed** · 课件一键直达：去除播放中转页、World 导览与整站入口绕行 · `116-direct-courseware-entry-and-remove-site-onboarding.md`
- `T-117` · **completed** · P 导师课件大纲：压缩地图背景与对调底部模块 · `117-product-mentor-outline-background-and-layout.md`
- `T-118` · **completed** · 检查并修复登录及账号表单的卡片内边距与响应式布局 · `118-auth-account-form-spacing-and-responsive-audit.md`
- `T-119` · **completed**；人工验收待签 1 条 · 免登录课后作业：自填个人信息、游戏策划表与提交查看 · `119-team-targeted-questionnaires-and-reusable-templates.md`
- `T-120` · **completed** · 整理 XMind 9月14日课程设计：模块思维与立棍两套 PPT 提纲 · `120-xmind-september14-module-thinking-and-ligun-ppt-outlines.md`
- `T-121` · **completed** · Admin 学员管理多选与安全批量删除 · `121-admin-learner-multi-select-bulk-delete.md`
- `T-122` · **completed**；人工验收待签 1 条 · 制作 P1 模块思维 HTML-PPT：投屏展示与教师提示双视图 · `122-p1-module-thinking-html-deck-and-presenter-view.md`
- `T-123` · **completed**；人工验收待签 2 条 · 官网、学员服务与 /console 内部工作台的信息架构迁移 · `123-public-portal-and-console-information-architecture.md`
- `T-124` · **completed**；人工验收待签 2 条 · 学员像素时空终端：账号、课件、公开空间、钱包与装饰商店 · `124-learner-time-terminal-space-wallet-and-shop.md`
- `T-125` · **completed** · 进阶课后作业与问卷：模板复用、课堂定向发放及受控管理 · `125-managed-homework-templates-and-team-distribution.md`
- `T-126` · **completed** · 建设孵化器介绍与项目列表，并部署背课文、错题集项目 · `126-incubator-pages-and-learning-project-deployment.md`

## 8. 当前队列断言

```text
total=59
completed=56
blocked=3
backlog=0
in-progress=0
structural-issues=0
completed-with-human-checks=4 todos / 6 checks
```

机器可读副本：`docs/TODO_COMPLETION_AUDIT_20260915.json`。
