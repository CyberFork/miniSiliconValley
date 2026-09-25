---
type: todo
id: T-115
title: "全站左上角升级为 chj 新版 MINI 硅谷 Logo"
status: completed
completed: 2026-09-14
created: 2026-09-12
captured_by: project-inbox
related: [T-082, T-096, T-098, T-107, T-109, T-110, T-114]
tags: [todo, branding, logo, chj, navigation, design-system]
---

# 全站左上角升级为 chj 新版 MINI 硅谷 Logo

## 用户原始需求

> 可以看看 chj 分支或者最新的代码，可以把左上角 logo 都换成最新的 mini 硅谷的 logo。添加到 TODO。

本单是 T-082 旧版品牌入口统一之后的新版 Logo 升级；保留旧完成回执，不把旧 W 形 fallback 当成用户现在指定的新 Logo。

## 已核对的来源（2026-09-12）

### 新 Logo：原仓库的 chj 分支

- 仓库：`https://github.com/CyberFork/minisv`，分支 `chj`。
- 本轮读取的 commit：`1d679716583805e5c770739a6fc587aa98ce7b8d`。
- 实际查看了透明版：蓝色“MINI 硅谷”字标，i 的圆点及下部为绿色；不是 W 图标，不需要重新生成或重新设计品牌。
- 推荐复用：`public/assets/mini-silicon-valley-logo-transparent.png`，1650 × 420、542270 字节、RGBA；已检查含透明像素、四角 alpha 为 0。
- 透明版 SHA-256：`4dbbe4dea625fd372c6d760f2344fbf62b7b15f0d2d14e490cddd56e05ffbe87`。
- 另有 `public/assets/mini-silicon-valley-logo-cropped.png`（1650 × 420）和 `public/assets/mini-silicon-valley-logo.png` 原图，不能因为文件名相似随机选取不同版本。
- chj 的 `app/components/CourseHome.tsx` 页头及 `WorldApp.tsx` 顶栏已引用透明版，可参考其资源使用方式；**不能照搬其仅切换内部 view 的按钮行为**，本项目仍须真正返回网站主页。

### 当前主工程仍使用旧标识

- canonical 主工程：`CyberFork/miniSiliconValley`，本轮 main 为 `553c1263ec5f5fa67d27f3d3d2a59a90fc076c45`；该仓库本轮未发现 `chj` 分支。不要因查错仓库而宣称新 Logo 不存在。
- `app/components/BrandHomeLink.tsx` 当前直接使用 `/favicon.svg`，宽高 64 × 64；该 SVG 是旧 W 形标识，不适合直接把横向新字标塞入原来的正方形尺寸。
- `docs/BRAND_ASSET_INVENTORY.md` 仍称唯一受控资源是旧 favicon，应随本次升级修订，不能继续引用旧 fallback 决策阻止新版资产进入主工程。
- 上述结论来自指定提交的源码和资源检查；本轮未对全部线上页面逐一验收。

## 实施范围

1. 将确认的新 Logo 从来源仓库导入 canonical 主工程的共享品牌资产目录，记录来源 commit、原文件和 digest；如有更新版本先核对再采用，不能默默换图。
2. 统一共享 Logo / BrandHomeLink 组件及静态页面品牌入口。保留原比例、合理留白和清晰度，必要的网页尺寸优化保留原始素材与可追溯关系；不拉伸为正方形、不自行重画或用滤镜改变品牌色。
3. 按当前实际存在的入口列出替换清单：官网、World、Framework、Classroom 中心与导师/学员/DM/投屏视图、Studio 工作台/编辑器/预览/课件库/验收发布、课件目录及播放器外壳、登录/账号/后台管理、家长 QA、自有错误页与历史归档入口。
4. 退役 Alpha/control 不为换 Logo 而恢复旧系统；历史归档的可用导航外壳仍纳入核对。新增 T-114 学员管理等页面也复用同一组件，不能继续复制 W 形图标。
5. 所有自有页面左上角 Logo 保持真实主页链接，普通点击与 Enter 在当前标签页到达 `/`，生产对应 `https://minisv.vip/`；保留编辑器未保存内容的离开保护，不能改成子系统首页或 chj 内部 view 切换。
6. 只替换品牌图形和相关布局，不误删旁边的页面名称、返回按钮或账号菜单；窄屏可调整布局，但不能把新 Logo 挤没、遮挡导航或缩小到不可辨认。
7. 统一检查深色/浅色背景与桌面、Pad、手机；沿用 `mini-silicon-valley-design` 和现有 UI，不为本单改造课程流程或状态机。
8. 将导航 Logo 与 favicon 的用途解耦。浏览器标签等若仍显示旧 W，应登记并采用来源确认的适配版本；不能把完整横向字标硬压成不可读的小方块或临时发明新图标。

## 不可变课件边界

- 最新 `/course/` 目录与平台播放器外壳属于本次统一范围；旧文档把整个 `/course/` 都视作原样课件的说法需按当前架构纠正。
- 已发布、按 digest 锁定的导师 HTML/PPT 包不能原地改字节或注入 Logo。其内部若有旧标，必须单列：能在平台外壳更新的先更新；需要改课件正文的由新课件 revision 承接，旧包继续保留。
- 不默默忽略这些页面，也不通过批量替换破坏既有课程/课件 exact 引用和验收证据。

## 验收

- [x] 新资源来源、commit、digest 和视觉已核对，页头显示正确的蓝绿 MINI 硅谷字标，不再使用旧 W 形占位标识。
- [x] 当前有效页面逐页列出 URL、旧引用、新引用和截图结果；不能只改首页或 React 组件而漏掉静态页、后台和课件外壳。
- [x] 桌面、768px Pad、390px 及 320px 窄屏中比例正常，深浅背景清晰，无白色底块、拉伸、裁切、布局溢出或菜单遮挡。
- [x] 直接点击、键盘 Enter 和触摸均能回主页；编辑器选择取消离开后未保存内容仍在，不能依赖 Ctrl/Cmd 点击。
- [x] 共享组件之外的直接引用已核对；品牌盘点文档、旧 favicon 与新增后台入口没有互相矛盾的版本说明。
- [x] Logo 请求成功、无 404，缓存更新后实际客户端显示新版资源；新资源没有造成明显的页头加载或布局抖动问题。
- [x] 已发布不可变课件 digest、课程 JSON、课堂进度、权限和原始 chj 分支内容均未被误改；受保护包的遗留项明确记录。
- [x] 分别记录实现、测试、部署构建身份及线上逐入口复验，不以“下载了资源”或“本地首页显示正常”作为全站完成。

原始建单时仅完成调研。后续已完整实施，并于 2026-09-14 以 `20260914T102054CST-transparent-wordmark-r7` 部署：

- 正式透明字标进入 `public/assets/mini-silicon-valley-logo-transparent.png`，SHA-256 为 `4dbbe4dea625fd372c6d760f2344fbf62b7b15f0d2d14e490cddd56e05ffbe87`。
- React 页面复用 `BrandHomeLink`，静态页面复用 `.msv-static-brand`；导航字标和浏览器 favicon 用途分离。
- `tests/brand-contract.test.ts`、部署契约与 `verify_brand_browser.py` 覆盖 320／390／768／1440 视窗、透明背景、无 404、普通点击／Enter 回首页。
- `docs/BRAND_ASSET_INVENTORY.md` 保存来源、摘要、覆盖面、缓存键和复验命令。
- 发布没有改写已冻结课件 bundle、课程 JSON、课堂进度或权限数据。

> 队列修复说明：本 Todo 的实现已存在于 canonical 代码和生产发布中，但 Todo 文件只留在损坏的旧 `dev` 工作区，未进入 canonical Git，因此曾从清单中消失。2026-09-15 完整审计时将本单原编号无损迁回唯一队列。
