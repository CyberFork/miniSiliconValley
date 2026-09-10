---
type: todo
id: T-078
title: "批量替换失效的 /123456 链接为 /framework/"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - broken-links
  - framework
  - navigation
  - redirects
  - seo
---

# 批量替换失效的 /123456 链接为 /framework/

## 原始记录

`https://minisv.vip/123456` 已经失效，正式课程框架地址已经是：

`https://minisv.vip/framework/`

需要盘点并批量替换站内、发布产物、导航、文档和外部可控内容中的旧链接，避免用户继续进入 404。

## 线上确认

2026-09-06 实测：

- `https://minisv.vip/123456` → `404`
- `https://minisv.vip/123456/` → `404`
- `https://minisv.vip/framework` → `308` 到 `/framework/`
- `https://minisv.vip/framework/` → `200`

因此当前问题不仅是旧文案，而是存在真实失效入口。

## 唯一正式地址

以后所有用户可见链接、canonical 和站内导航统一使用：

```text
https://minisv.vip/framework/
```

站内相对链接统一使用：

```text
/framework/
```

保留尾部 `/`，避免不必要的额外重定向。

## 已发现的问题

### 1. 网关只兼容了部分旧形式

当前 `deploy/minisv/gateway/default.conf` 只对 `/123456.html` 配置了到 `/framework/` 的 308 跳转，没有覆盖：

- `/123456`
- `/123456/`
- 可能带查询参数和锚点的旧链接

这就是当前两个线上地址直接返回 404 的原因之一。

### 2. 生产应用 Bundle 仍可能生成 `/123456`

已确认生产 Classroom 前端 Bundle 的公共导航曾包含 `/123456`。即使源码目录或旧构建内部仍叫 `app/123456`，用户可见的链接也必须通过公共路径映射为 `/framework/`。

需要检查所有当前生产 Bundle、静态 HTML 和运行时路由生成器，不能只在仓库文本中搜索一次。

### 3. 当前发布脚本仍保留多种旧地址兼容

当前仓库已经存在部分替换规则：

- `deploy/minisv/gateway/app-proxy.conf`
- `deploy/minisv/package_release.py`
- `deploy/minisv/gateway/default.conf`

这些规则主要处理：

- `/msv/demo/app/123456`
- `/msv/123456.html`
- 旧 `work.cyberforker.com` 地址

需要保留必要的旧地址兼容，但所有新生成内容必须直接输出 `/framework/`，不能长期依赖 `sub_filter` 修补错误链接。

## 批量盘点范围

### 源码与组件

- 顶部栏、页脚、侧边导航和课程卡片。
- 首页、世界页、Classroom、Parents、登录页和账户页。
- chj 分支准备接入的 Course Home／Course Outline／Course Overview。
- `publicPath()`、Link、anchor、window.location 和分享链接生成器。
- 页面元数据、canonical、Open Graph、结构化数据和 sitemap。

### Alpha 与内部工具

- `/alpha/`
- `/control/`
- `/control/editor/`
- Remote Console 和八个席位页面。
- 发布回执及内部操作手册中可点击的现行链接。

历史回执可以保留旧地址作为事实记录，但必须明确标注“旧地址”，不能继续作为操作入口。

### 部署与网关

- Nginx gateway。
- Cloudflare Tunnel 后的统一域名路由。
- `package_release.py` 的 HTML／JS 替换规则。
- 静态发布脚本和 smoke test。
- 旧 `work.cyberforker.com/msv/...` 兼容映射。

### 文档和对外材料

- README、部署文档、导师手册、家长材料和团队验收文档。
- 可控的邮件模板、二维码、分享按钮、内部操作说明。
- 外部已经发布且无法立即修改的链接，应依靠永久重定向兜底。

## 实施方案

### A. 修复公共链接源头

- 将所有用户可见 `/123456`、`/123456/`、`/123456.html` 链接改为 `/framework/`。
- 将绝对地址 `https://minisv.vip/123456...` 改为 `https://minisv.vip/framework/`。
- 更新导航选中态和路径判断逻辑。
- T-077 新增的顶部栏“课程大纲”入口应直接指向 `/framework/`；如果 chj UI 替换课程大纲内容，也应部署在这个稳定公共地址下，而不是再创造新的课程框架 URL。

### B. 增加旧地址永久重定向

网关和应用层至少兼容：

```text
/123456       → 308 /framework/
/123456/      → 308 /framework/
/123456.html  → 308 /framework/
```

- 查询参数必须保留。
- 锚点由浏览器保留在客户端，验证旧带锚点链接不会落到错误页面。
- 应同时提供应用层 redirect，避免绕过生产网关的应用 Origin 在测试／预览环境继续 404。
- 不允许形成 `/123456 → /framework → /framework/` 多跳链；旧地址应直接到最终地址。

### C. 区分 URL 替换和源码目录

禁止执行无判断的全仓字符串替换：

- `app/123456/` 可能仍是构建内部的源码目录或旧路由实现。
- 历史文档、迁移测试和兼容规则需要保留旧字符串以验证跳转。
- 只能批量替换“当前用户入口”，兼容代码中应明确列出旧路径并配套测试。

如决定将源码路由目录也从 `app/123456` 迁移到 `app/framework`，必须单独处理 import、构建、元数据、缓存和旧路径 redirect，不能与普通链接替换混在一次机械操作中。

### D. 清理构建产物和缓存

- 重新构建生产应用，确认新 Bundle 不再生成 `/123456` 用户链接。
- 更新静态资源版本／缓存键。
- 原子发布后清理 Cloudflare／浏览器可能继续使用的旧 HTML 入口缓存。
- 不直接编辑不可复现的生产 Bundle；所有修复必须回到源码和发布流程。

## 自动化检查

### 仓库扫描

增加允许列表式扫描：

- 非兼容代码、非历史回执中出现 `/123456` 时测试失败。
- 允许出现的位置仅限 redirect、migration、compatibility test 和明确标记的历史记录。
- 扫描源码、HTML、JSON、Markdown、配置、脚本和构建后的可发布 Bundle。

### 路由测试

- `/framework/` 返回 200。
- `/framework` 只进行一次规范化跳转。
- `/123456`、`/123456/`、`/123456.html` 均直接 308 到 `/framework/`。
- 查询参数得到保留。
- 不存在 redirect loop。

### 浏览器爬取

- 从首页、Classroom 登录页、Parents、世界页、顶部栏和课程卡片点击“课程大纲”，最终都落到 `/framework/`。
- 收集当前站内链接，断言没有链接目标返回 4xx。
- 验证桌面和移动端导航选中态正确。

## 验收标准

- 所有当前用户可见“课程大纲／课程框架”链接都使用 `/framework/`。
- `https://minisv.vip/123456` 和尾斜杠／HTML 变体不再返回 404，而是直接永久跳转到最终地址。
- 生产 Classroom Bundle 不再把公共导航指向 `/123456`。
- T-077 的新顶部栏入口以 `/framework/` 为稳定目标。
- 站内爬取没有发现仍指向 `/123456` 的可点击链接。
- 兼容规则、迁移测试和历史回执中的旧地址得到明确允许，不被错误删除。
- 发布后从公网重新检查状态码、重定向次数、查询参数和主要页面导航。

## 关联 Todo

- [[73-full-system-pdmo-five-step-consistency|T-073]]
- [[75-unified-course-source-editor-alpha-classroom|T-075]]
- [[77-topbar-course-outline-and-chj-integration|T-077]]

## 关键控制点

唯一正式地址 `/framework/`；用户链接源头替换；旧地址永久重定向；无多跳；保留查询参数；不盲目重命名源码目录；生产 Bundle 重新构建；兼容代码允许列表；站内全链路爬取；T-077 顶部栏统一指向正式地址。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- 相关证据：<https://minisv.vip/framework/>。
