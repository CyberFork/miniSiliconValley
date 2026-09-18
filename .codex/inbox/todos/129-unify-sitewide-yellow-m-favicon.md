---
type: todo
id: T-129
title: "全站统一网页图标：使用模块思维教师视图的黄色 M favicon"
status: backlog
created: 2026-09-18
updated: 2026-09-18
captured_by: project-inbox
related: [T-115, T-122, T-123]
tags: [todo, branding, favicon, sitewide, consistency]
---

# 全站统一网页图标：使用模块思维教师视图的黄色 M favicon

## 用户原始需求

> todo：需要给所有网站页面统一使用[Image #1]下方这个网页icon

截图中上方“MINI硅谷工作台 | Mini Silicon Valley”仍是旧 W 图标；下方“教师视图｜模块思维”的图标为用户指定目标。

本单统一的是 **浏览器标签页图标 favicon**，不是站内左上角 Logo、账号头像或学员桌面应用图标。本轮只登记 TODO，不修改业务页面、图标或部署。

## 已确认的目标资产

- 外观：深蓝底、黄色像素 M、顶部薄荷绿小方块；复用现有成品，不另行设计或生成相似图案。
- 已只读定位到源文件：

```text
/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/课件/development-courseware/module-thinking-deck/favicon.svg
```

- 本地 `presenter.html` 标题为“教师视图｜模块思维”，第 8 行通过 `<link rel="icon" href="favicon.svg" type="image/svg+xml">` 引用该文件。
- `dist/teacher/favicon.svg` 与上述源图标文本一致。
- 2026-09-18 源 SVG SHA-256：`1f8f0a43980007cbc3000449803ce1503de17155f07ee69d2eea9e76a3d7f1f4`。
- SVG 为 32×32 视框，底色 `#10293f`、M 字色 `#f2c84b`、点缀色 `#63d7b0`。这些信息用于确认同一资产，不要求逐页复制手写 SVG。
- 截图来源：`/var/folders/d3/gw39tkk14y91pt678ybcwhb00000gn/T/codex-clipboard-W3EYFP.png`；临时截图若失效，以上源资产及页面引用仍可用于核对。

## 实施范围

1. **全站盘点，不只修改首页。** 覆盖实际存在的官网、World、登录/账号、学员终端、课后作业、课件目录、课件投屏/教师视图、Classroom、内部 Console/Studio、孵化器及项目子页；检查仍可访问的独立 HTML、归档页和错误页，形成页面/入口覆盖清单。
2. 建立统一维护的 favicon 源与引用约定，优先从共享布局或构建模板统一注入。独立 HTML/静态课件同步接入，不能只覆盖主应用框架。
3. 清理各页面中的旧 W、旧框架默认图标、重复或冲突的 `rel="icon"`/`shortcut icon` 声明。检查根路径 `/favicon.ico` 等回退资源，避免浏览器仍取旧图标。
4. 如现有站点已有 Web Manifest、Apple Touch Icon 或其他安装/书签图标声明，相关版本统一由同一视觉源生成，不能保留互相矛盾的旧 W；不为此新建 PWA 或额外桌面系统。
5. 深层路由、带查询参数的课件入口、重定向后的落地页及子目录均能正确取得图标。不要机械采用会在不同部署基路径下失效的相对路径。
6. 按项目部署策略更新资源版本和缓存，使旧用户刷新后能取得新图标，不能仅在开发者清缓存后才看起来正确。
7. 保持现有站内品牌 Logo、页面标题、账号/课堂权限和课程数据不变。对于锁定 revision/digest 的课件，按既有版本发布流程处理，不为替换图标原地篡改历史快照或破坏摘要校验。

## 验收

- [ ] 用户截图上方工作台的旧 W 已替换为与下方教师视图一致的黄色 M 图标。
- [ ] 页面覆盖清单中的各类入口、独立 HTML、深层路由均通过检查；没有只修首页、遗漏 Console 或课件子页。
- [ ] 页面最终 icon 声明无冲突，实际图标请求成功且内容正确；根路径回退图标与声明图标一致，不返回旧图标或登录页 HTML。
- [ ] 已登录、未登录及登录跳转后的页面图标一致，业务权限和登录流程没有改变。
- [ ] Chrome、Safari 的标签页显示核对通过；已有移动端书签/安装图标的入口使用同一视觉源。
- [ ] 同时检查新浏览器上下文和已有缓存的访问场景，并记录刷新/缓存生效结果。
- [ ] 课件版本和摘要、历史快照以及站内 Logo 未被错误修改；发布记录列明涉及页面和图标资产版本。

## 下一步与边界

- 下一步：从已确认 SVG 和共享页面头配置入手，盘点全站不同技术入口的 favicon 来源，再统一替换并回归验证。
- [T-115](115-upgrade-sitewide-header-to-latest-minisv-logo.md) 负责站内页头 Logo；本单专门补浏览器 favicon 的全站一致性，不混为同一项。
- [T-122](122-p1-module-thinking-html-deck-and-presenter-view.md) 的教师视图提供本次指定图标来源。
- [T-123](123-public-portal-and-console-information-architecture.md) 提供现有对外/对内入口组织背景；实施时以最新实际路由清单为准。
