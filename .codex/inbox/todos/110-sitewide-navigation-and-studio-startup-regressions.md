---
type: todo
id: T-110
title: "全站排查普通点击不跳转，并优化 Studio 首屏课程加载"
status: in-progress
created: 2026-09-10
captured_by: project-inbox
priority: P1
priority_basis: user-reported-workflow-blocker
related: [T-087, T-094, T-099, T-106, T-107, T-108, T-109]
tags: [todo, navigation, studio, performance, regression, accessibility]
---

# 全站排查普通点击不跳转，并优化 Studio 首屏课程加载

## 用户反馈与范围

- `/studio/editor/` 进入后左侧课程库约 20 秒才加载。
- `/studio/releases/` 中“前往多角色视图验收”普通点击没有反应。
- 用户进一步确认：**验收、发布等跳转入口只有 Ctrl＋点击能打开，普通点击无法跳转；要求对所有同类情况进行检查。**

不能只修一个按钮、只检查 `href` 存在，或将“组合键能打开”算作验收通过。全站跳转专项为待完成范围，本轮局部修复不能代表全站已通过。

## 已查明与待验证

### 加载等待链

`app/studio/editor/page.tsx` → afterInteractive loader → 四脚本逐个下载/执行 → `/release.json` → `/api/studio/bootstrap` → 课程库渲染。

- 课程列表原先等待非必要的部署诊断请求。
- bootstrap 原先读取、校验并传输所有课程的全部历史正文；进入课程库并不需要这些历史版本。
- 线上匿名只读抽样中，五个编辑器脚本各请求约 1.0—2.3 秒；四个依赖累计约 7 秒。该测量不是登录后的完整性能录制，不能据此断言线上 20 秒的全部时间构成。
- 不删除历史、不改课程数据、不缓存鉴权结果、不取消 exact 校验；优化应缩短请求等待链和首屏数据范围。

### 普通点击与组合键差异

- Studio 侧栏已有原生 `<a>`，但正文验收/发布流程仍使用 `next/link`。
- Ctrl／Cmd＋点击可打开而普通点击不跳转，与客户端路由拦截路径故障相符；**具体浏览器根因仍需实测网络、事件与控制台确认**，不能把推断写成已完整复现的结论。
- 检查点包括 `preventDefault`、嵌套可交互元素、覆盖层/pointer-events、RSC/客户端路由响应、hydration、base path、错误 URL 与无反馈长等待。
- 真正的“发布”写操作不是导航链接，不得为了可点击就改成 GET 链接，或靠新窗口绕过权限/验收门禁。

## 当前局部实现（未作为全站验收结论）

- 编辑器依赖提前并行 preload，仍按依赖顺序执行；任一脚本失败停止后续执行。
- 部署诊断不再阻塞课程初始化，并有超时；课程身份仍来自服务端 exact 引用。
- 增加 bootstrap `scope=current`：SQL 先筛选当前 Candidate、Released 和最新必要快照，再做正文校验；旧的完整查询契约保留。
- 点击历史时使用 `scope=history&course=…` 按课程读取，不将全部历史作为首屏必需数据；迟到响应不能覆盖新选课程或未保存编辑。
- Studio 正文流程导航复用原生链接组件，保留完整 course/revision/digest，普通点击显示“正在打开…”，不拦截浏览器默认导航。
- 指定 exact 视图不存在/失效时明确说明，不能静默打开另一门课或另一版本。
- 编辑器现在暴露只读的 `window.__MSV_EDITOR_STARTUP__` 单调时序，分别标记 loader、预加载、脚本完成、`scope=current` bootstrap、课程列表与首门课可编辑；该诊断不参与课程身份或业务判断。

上述改动需要构建、集成及部署后真实验收；尚未在本单中宣布线上修复完成。

### 本地验证记录

- 课程查询测试使用隔离 SQLite 数据：同一课程生成 12 次修订并将 r9 设为 Released。完整查询 14 个正文共 2,923,516 B；首屏查询保留 3 个必要正文共 531,795 B，减少约 82%。这是合成数据下的正文体积，不是线上响应总量或加载秒数承诺。
- 验证按课程读取完整历史、当前 exact 正文篡改拒绝，以及既有并发保存/发布保护未回退。
- loader 的提前 preload/有序执行/失败短路/重复启动保护、非阻塞诊断，以及原生链接服务端渲染保留 r12 查询参数均有测试。
- 已转移到完整临时工程基线并通过 typecheck、lint、构建、静态导航契约和真实 Chromium 验收；不再把 OneDrive dataless 占位文件产生的读阻塞算成网站性能。
- 隔离本地 D1、Chromium 151、1440px 的最新一次样本：冷启动首门课程可编辑约 107.1ms，热刷新约 112.3ms；`scope=current` bootstrap 解码正文约 147KB，分别约 31.6ms / 28.2ms。数字只用于拆分等待链，不是线上 SLA，也不能与用户原先看到的 20 秒直接等同。
- 同一浏览器验收已经真实执行：World → Course 登录回跳、错误密码恢复、找回页点击/Enter、Studio 工作流普通点击、编辑器返回、Releases 正文 exact 链接普通点击、Cmd 新标签、前进/后退/刷新、账户中心、课件 exact 深链、会话过期后的 exact returnTo，以及 390px Chromium touch 单击。
- 主动令 `/release.json` 返回 503 时，课程库、首门课程和编辑能力仍完成初始化；该 503 是隔离测试注入并被回执明确记录。
- 证据：`docs/qa/t110-navigation/browser-receipt.json`、`docs/NAVIGATION_ACCEPTANCE_MATRIX.md`、`tools/live-run/tests/verify_t110_site_navigation_browser.py`。
- Safari / iPad 真机、系统后退手势及硬件上下文菜单仍属于 T-088；T-109 重组公开官网与 Workshop 入口后还必须复跑本单，不用 Chromium 模拟冒充真机结论。

### T-109 后总回归（2026-09-11）

- 已在重组后的官网、World、Course、Account、Studio、Workshop 与 Test Classroom 上复跑真实 Chromium 导航脚本，而不是只扫描 `href`。
- 普通点击、Enter、Cmd 新标签、前进／后退／刷新、登录 exact returnTo、390px 单次触摸、T-111 Test 新建与归档入口均通过；页面错误、请求失败和非预期服务端错误为 0。
- Studio 冷启动首门课程可编辑约 116.7ms，热启动约 121.9ms；`scope=current` bootstrap 约 147KB。该隔离本地数据仅用于防性能回退，不作为生产 SLA。
- 机器回执已刷新：`docs/qa/t110-navigation/browser-receipt.json`。桌面 Safari、iPad Safari、系统后退手势和硬件上下文菜单仍留给 T-088 真机验收，因此本单保持 `in-progress`。

## 全站入口清单

- [x] 官网及公共页面：logo 回首页、主导航、World、框架介绍、家长信息/问答、去上课。
- [x] Studio：侧栏、工作台卡片、编辑→视图验收→UI 测试→发布→正式课堂的所有跳转、提示内修复链接、版本/数据诊断深链。
- [x] 编辑器：返回 Studio、验收/发布、历史与课件入口；保留未保存内容保护，不把保护提示误当作路由失效。
- [x] 课堂：我的课堂、席位、中控、成员管理、公共投屏、导师课件及返回入口。
- [x] 课件库与播放：目录、课件、版本、返回导航；跳转不丢 revision、slide 等参数。
- [x] 登录与账户：登录后 returnTo、账户中心、菜单导航。切换账号/退出仍按各自会话语义处理，不一律替换成普通跳转。
- [x] Workshop 深层归档入口及归档外壳（与 T-109 联动）。

## 必须覆盖的操作与环境

- [x] 鼠标普通左键：在当前页或明确标注的新窗口打开正确目标，有即时反馈，失败可重试。
- [x] Tab 聚焦后 Enter：与普通点击语义一致，焦点可见。
- [ ] iPad/手机单次触摸：不依赖 hover、Ctrl、双击或精确命中很小区域。
- [ ] macOS Cmd＋点击、Windows/Linux Ctrl＋点击、中键、右键新标签页：遵循浏览器默认行为且目标参数完整。
- [x] 浏览器前进/后退与 bfcache：恢复页面可继续操作，不永久停留“正在打开”。
- [x] 直接输入深链/刷新：与站内普通点击进入同一页面、同一 exact 课程。
- [x] 登录/未登录/会话过期/无权限/慢网/请求失败：给出真实提示并安全返回目标，不空白、不静默换课程。
- [ ] Chrome 与 Safari 的桌面普通点击；学员使用场景补 iPad Safari/触摸实机或可靠模拟。
- [x] TEST 与正式课堂使用相同导航实现但状态互不影响；不用生产发布/创建课堂来试验按钮是否可点。

## 性能与自动化验收

- [x] 分别记录页面响应、脚本准备、bootstrap、课程列表可见、首门课程可编辑的耗时；至少比较冷/热缓存，注明网络和设备。
- [x] 有多个历史修订时，首屏不再随全部历史正文线性膨胀；历史完整性、旧版恢复、并发保存 CAS 和当前 exact digest 校验回归通过。
- [x] loader 测试验证全部 preload 先开始、执行有序、失败短路、重复启动保护。
- [x] 部署信息请求失败时，课程列表与编辑仍可初始化；永不完成由不等待该 Promise 的单元契约覆盖。
- [x] 导航自动化执行普通点击并断言目标页面与 exact ID；没有把只存在 href 或 Ctrl＋点击算作成功。
- [x] 当前应用入口的来源、目标、权限与自动化结果已写入矩阵；T-109 新入口和 T-088 实机列保持待验。
- [x] 所有写入只发生在隔离临时 D1；没有发布课程、创建 Production、代签人工回执或修改生产用户数据。

## 依赖与顺序

1. 先修已阻断用户操作的 Studio 导航与首屏等待。
2. 扩展为上述全站清单逐项检查，记录确切原因，不将所有失败都盲目归咎于同一框架。
3. T-109 全站新 UI 迁移时复用同一套通过验收的导航与组件；迁移后再次回归，不能因首页改版重现问题。

本单不替代 T-108 的门禁/表单反馈，不绕过未验收版本的创建与发布限制。

## 生产回归（2026-09-11）

- T-109 与 T-111 已纳入同一发布 `20260911T100357CST-public-ia-t109-r4`；Hecate health、远端／外部 public smoke 和匿名生产浏览器逐页诊断通过。
- 官网首页、World、课程框架、家长问答与登录页均无 `pageerror`、console error 或关键资源失败；首页历史预览 JSON 已由 404 修复为 release-owned 200，课程框架无 React hydration 418。
- 本地真实 Chromium 回归继续覆盖 Studio 普通点击、Enter、Cmd 新标签、前进／后退、exact 深链、登录回跳、Test 新建／归档和 390px 触摸模拟。
- 尚未勾选的 iPad 单触、系统上下文菜单、Windows Ctrl／中键和桌面／iPad Safari 项属于 T-088 的实体设备与异浏览器验收；在这些人工行完成前，本单保持 `in-progress`，不以生产部署自动关闭。
- 人工补测已标准化为 `docs/qa/t110-navigation/REAL_BROWSER_ACCEPTANCE_TEMPLATE.md`：每一种实际设备／浏览器组合单独记录 release、Build ID、最终 URL、PASS/FAIL/BLOCK 和脱敏证据；不会把源码 `href` 或 Chromium 结果冒充 Safari／Windows 硬件回执。
