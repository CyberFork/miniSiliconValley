# T-109｜官网、教学入口与内部归档实施记录

> 日期：2026-09-11
> 状态：本地实现与自动化验收完成；生产发布和线上 smoke 由统一 release 收口。
> 产品边界：对外为官网与教学服务；对内为 Studio 与课程管理。两区共用账号、CourseDefinition、ClassroomFactory、权限与状态机。

## 1. 交付结果

### 公开官网

`deploy/minisv/site/index.html` 不再是运维/模块总导航，而是面向学生、家长和合作方的 MINI硅谷官网：

- 首屏：真实科技史驱动的创业 RPG；主要行动为探索学习方式、历史世界和去上课。
- 课程主棍：一世界、两轨线、三种玩法、四类导师、五步创业实践、最终六分钟 Demo。
- 五步：找真问题、定真方案、做真产品、进真市场、跑真运营。
- 三种玩法：毛线桌游收集和交换信息，美式情境共同攻坚，德式资源投入与收益权衡。
- P/D/M/O 是导师专业支持，不是给初中生固定分工。
- 公开成果只展示问题证据、方案、MVP、市场验证、运营复盘和 Demo，不显示内部 JSON、回执或部署术语。

桌面与 390px 手机均保留普通点击、键盘焦点和触摸目标；没有仅靠 hover 才能访问的主要内容。

### World 整合

- 新增显式 `/world/` 路由，保留完整历史地图和深链。
- `scripts/build-minisv-static.ts` 从同一 `historyCatalog` 与 `MAP_LAYERS` 生成 `world-preview.json`，官网只加载精选节点和轻量图层。
- 首页选段与完整 World 不复制史实数据库，不读写 Classroom 进度。
- 精选节点涵盖 1939 HP、1957 Fairchild、1969 ARPANET、1975 Homebrew、1998 Google、2007 iPhone、2022 ChatGPT，并保留原目录中的来源数量和历史意义摘要。

### 教学与 Studio 入口

- 对外登录后入口固定为：`/classroom/` 去上课、`/course/` 课件查看、`/account/` 账号管理。
- `/course/` 全站统一称为“课件查看”，明确它是 Released-only 静态课件服务，不是完整课程介绍页。
- Studio 侧栏增加：Test 课堂验收、正式课堂、资料与历史、早期课程工作坊。
- 新增 `/studio/history/`；从这里可以普通点击进入 Workshop，同时看到现行 Editor、Preview、Releases 去向。
- Test 的主要发现入口归到 Studio，但 `/classroom/` 仍运行唯一 ClassroomFactory、真实 UI、API 和状态机。
- learner 的课堂首页使用“我的课堂”语义，不展示课程生产工厂或内部回执说明。

### Workshop 冻结归档

发布组装时：

1. 旧 Workshop 原始 bundle 在任何全局 HTML 替换之前移入 `workshop/_source/`。
2. 对原始树计算 SHA-256、文件数与字节数，并写入 `SOURCE-MANIFEST.json`；摘要范围明确不包括随后创建的 manifest 本身。
3. 可服务目录只保留新的只读归档外壳、schema 和 `public-redacted-summary` 基线。
4. Gateway 对 `_source` 固定 404，并通过 `/api/auth/studio-archive-access` 要求真实 mentor/admin 会话。

归档页只读扫描十个固定 localStorage 键；屏幕预览可截断，下载始终包含完整 rawValue。导出后逐键比较保证值未变化。页面没有 localStorage 写/删/清空、课程写 API、自动同意或自动上传。

服务器不能读取其他设备或浏览器配置的 localStorage。因此自动化只证明机制，不声称团队历史已经全部收集；资料所有者仍须逐设备导出并人工合并。

## 2. 搜索、缓存与隐私

- `robots.txt` 与 `sitemap.xml` 只公开官网、World、方法框架和家长入口。
- Gateway 为这四类公开内容设置 index/follow；其余登录、账号、课堂、课件、Studio、Workshop、API、health 和 release 一律 noindex。
- Workshop 响应为 `private, no-store, no-transform`。
- 官网 HTML 不包含 `/studio/`、`/workshop/`、Tunnel、release 诊断、测试账号、回执或私密课程字段。
- `/api/public/courses` 通过 Gateway 显式代理，输出仍由既有 Released-only allow-list 限制。
- 已冻结 P/D/M 导师课件 bundle 未被主题注入或字节改写。

## 3. 主要实现文件

```text
deploy/minisv/site/index.html                 公开官网语义结构
deploy/minisv/site/portal.css                 像素冒险响应式 UI
deploy/minisv/site/portal.js                  轻量 World 与账号菜单
deploy/minisv/site/robots.txt                 搜索边界
deploy/minisv/site/sitemap.xml                公开站点地图
scripts/build-minisv-static.ts                 同源 World 预览构建
app/world/page.tsx                             完整 World 显式路由
app/studio/history/page.tsx                    内部资料与历史入口
app/api/auth/studio-archive-access/route.ts    Workshop 服务端鉴权
deploy/minisv/workshop/archive.{html,css,js}   只读历史归档
deploy/minisv/package_release.py               exact 旧源码冻结与归档组装
deploy/minisv/gateway/default.conf             路由、鉴权、noindex、缓存
```

## 4. 自动化证据

浏览器脚本 `tools/live-run/tests/verify_t109_public_internal_ia_browser.py` 使用本地静态服务器和隔离 Chromium，验证：

- 官网真实课程内容、普通点击、World 滑杆、桌面与手机无横向溢出；
- 公开 HTML 不含内部入口；
- Workshop 读取十个合成键、完整导出、刷新前后逐字节不变；
- 脱敏 Released 基线可读且归档用途明确。

机器证据保存在：

```text
docs/qa/t109-public-internal-ia/browser-receipt.json
docs/qa/t109-public-internal-ia/public-home-desktop.png
docs/qa/t109-public-internal-ia/public-home-mobile.png
docs/qa/t109-public-internal-ia/workshop-readonly-archive.png
```

另外由静态契约、课程平台、release 组装、Gateway、UI theme、构建和部署 smoke 覆盖权限与打包边界。T-109 后必须复跑 T-110 普通点击/深链回归、T-111 多 Test Classroom 生命周期和 T-104 人工审核工作台，不能把本页改版视为这些模块天然未回归。

## 5. 未由机器代替的人工事项

- 自动化没有签发 ViewAcceptanceReceipt、UiAcceptanceReceipt，也没有创建 Production Classroom。
- 隔离 Chromium 的 390px 视口不是 iPad Safari 真机；系统手势、软键盘和硬件上下文菜单属于 T-088。
- 合成的 Workshop localStorage 不是同事浏览器里的真实历史；每个历史资料所有者必须自行导出。
- 官网未虚构年龄、价格、课时、招生档期、师资履历或学生案例成果；这些内容只有团队提供并审核后才可新增。

## 6. 回退

T-109 与 app、Gateway、Parent-QA 一起进入单一不可变 Hecate release。回退只切换 `~/Services/minisv/current` 到上一份整包；运行 D1、账号、secrets、Parent-QA 数据和浏览器 localStorage 均位于 release 外，不被静态回退覆盖。不得单独回退首页而保留不匹配的 Gateway/鉴权规则。

## 7. 生产交付

- 最终 release：`20260911T100357CST-public-ia-t109-r4`。
- canonical source：`662ed523d4cc241c3c858d0895e555b2a971f957`，Hecate `minisv.vip`。
- Gateway 为 `/world-preview.json` 设置明确的 release-owned 静态路由；首页历史组件不再静默进入 offline fallback。
- 部署后 Hecate health、远端／外部 public smoke 均通过。Chromium 依次加载官网、World、课程框架、家长问答和登录页，页面异常、console error 与关键资源失败均为 0；课程框架无 React hydration 418。
- 生产机器证据：`docs/qa/t109-public-internal-ia/production-r4-machine-evidence.json`。这不是人工 View/UI 回执，也不替代 T-088 的真实平板测试。
