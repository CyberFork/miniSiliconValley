---
type: todo
id: T-126
title: "建设孵化器介绍与项目列表，并部署背课文、错题集项目"
status: completed
completed: 2026-09-15
created: 2026-09-14
captured_by: project-inbox
related: [T-088, T-109, T-115, T-123, T-124]
tags: [todo, incubator, student-projects, public-site, deployment, recitation, mistake-notebook]
---

# 建设孵化器介绍与项目列表，并部署背课文、错题集项目

> 编号修复：此需求曾在旧工作区误占已用于“学员时空终端”的 T-124；迁入唯一 canonical 队列时改为 T-126，保留原始内容与交付证据。

## 用户原始需求

> 记录一下新的TODO：需要把/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/背课文、错题集 部署到minisv.vip/incubator/projects/{对应项目}，/incubator 本身对孵化器进行描述（也就是我们这个迷你硅谷就是在导师带领下协助学员创建自己的项目），/incubator/projects 放项目列表。

## 1. 页面与路由组织

```text
/incubator/                         MINI硅谷孵化器介绍
/incubator/projects/                项目列表
/incubator/projects/{project-slug}/ 对应项目的实际运行入口
```

- `/incubator/` 说明 MINI硅谷如何在导师带领下协助学员创建自己的项目，突出从学习到动手制作与展示成果，提供项目列表入口。
- `/incubator/projects/` 展示可访问的项目卡片，首批为“背课文”和“错题集”；包含名称、简短用途、真实项目状态和打开入口。截图、作者、团队等资料有来源且适合公开时才加入，不虚构学员案例、使用人数或完成情况。
- 项目卡片进入对应子路径下的应用，不停留在另一个只有“再次打开”按钮的中转页面。
- 各项目提供回到项目列表的清楚入口；站点 Logo 继续返回 MINI硅谷主页。
- 与 T-123 的官网/学员服务/内部工作台边界对齐：孵化器介绍和项目展示属于对外内容，不把内部构建、调试或后台入口混入列表。

## 2. 本轮确认的本地材料

目录已确认存在：

```text
/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/背课文、错题集
```

已核对两个页面的 HTML 标题：

- `背课文.html`：`背课文 · 学习空间`。
- `index.html`：`错题本 · 学习空间`；与用户所称“错题集”对应，正式展示名称在实现时统一。
- 目录另含 `assets/`、`《错题本》开发需求文档.md`、补丁脚本和 QA 文件等；不能把整个工作目录无筛选地公开部署。

建议的可读 slug（尚非用户指定的最终命名）：

```text
背课文  → /incubator/projects/recitation/
错题集  → /incubator/projects/mistake-notebook/
```

本轮仅确认目录与页面标题，未验证完整功能、接口、存储或部署可行性。

## 3. 后续实施要求

- 实施前核对 canonical 最新工程、当前站点路由和发布方式，保留原目录及其他执行 Agent 的工作，不直接覆盖源项目。
- 检查两个页面的共享素材、互相跳转与数据关系，确认对应的运行入口；不要把原先共用一个目录的页面简单复制后造成资源或导航失效。
- 适配子路径部署：图片、脚本、样式、字体、前端导航及实际用到的 API 请求都应正确解析到目标位置，直接打开和刷新子路径可用。
- 检查原型依赖、演示数据、浏览器存储键和服务端接口。不能把演示存储误报为账号间/设备间同步，也不能因共享同一域名覆盖另一个项目或主站的数据。
- 如现有功能需要登录、上传、AI 或外部服务，先明确其运行条件；不把密钥放进前端，不绕过原有授权。介绍/列表公开不等于学生错题、答案或个人学习记录全部公开。
- 仅发布运行必需的资源；构建/补丁脚本、私人配置、开发记录及测试产物不默认暴露到公网。
- 孵化器介绍、列表和必要的公共导航使用 `mini-silicon-valley-design` 与最新 Logo，项目本体优先保留已有可用功能，不无故重做业务。
- 按既有发布流程记录源码来源、构建/发布版本和回滚点；不能以本地页面能打开代替线上部署验收。

## 验收

- [x] `/incubator/` 能清楚说明导师协助学员创建项目的定位，并进入项目列表。
- [x] `/incubator/projects/` 展示两个真实项目及正确入口，普通点击/触摸即可打开。
- [x] 两个项目各自在 `/incubator/projects/{对应项目}/` 实际运行，直接访问、刷新、内部导航、回列表和回主页均正常。
- [x] 子路径下必要资源与接口无错误；两个项目及主站的数据/存储互不误覆盖。
- [x] 根据原项目实际能力完成核心操作回归，未实现或依赖外部配置的功能明确说明，不伪报全部可用。
- [x] 学员 iPad/手机可阅读和完成核心操作，无主要控件遮挡或页面级溢出。
- [x] 公网不暴露开发脚本、密钥或私人学习数据，项目的鉴权边界有明确说明。
- [x] 提供最终 URL、部署版本、来源映射、测试与线上复验证据；未完成项继续保持待办。

## 完成交付（2026-09-15）

- 源码提交：`b750e1d`（功能）与 `b504784`（浏览器验收修正），均已推送至 canonical `main`。
- 生产版本：`20260915T004933CST-incubator-projects-r9`；上一版本为 `20260914T195206CST-retro-terminal-r8`，可回滚。
- 线上入口：`https://minisv.vip/incubator/`、`https://minisv.vip/incubator/projects/`、`https://minisv.vip/incubator/projects/recitation/`、`https://minisv.vip/incubator/projects/mistake-notebook/`。
- 运行边界：两个项目均为无账号数据持久化的浏览器交互原型；刷新恢复预设数据。背课文仅在主动选择语音练习时请求浏览器麦克风权限。
- 资源边界：只发布 26 个清单内运行文件；Phosphor 图标字体已本地化，未发布需求文档、补丁脚本、QA 产物或密钥。
- 自动验证：Course Platform `198/198`、部署 Python `56/56`、本地和生产 Chromium 桌面 `1440×1000` 与触摸手机 `390×844` 均通过；生产 Public Smoke 全路由通过。
