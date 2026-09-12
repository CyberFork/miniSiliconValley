# MiniSV Hecate 生产架构

## 流量与进程

```text
minisv.vip / www.minisv.vip
  → Cloudflare Tunnel
  → 127.0.0.1:18780 Nginx gateway
      ├─ current/site
      ├─ 127.0.0.1:18787 unified Vinext Worker
      └─ 127.0.0.1:18789 Parent Q&A
127.0.0.1:18792 cloudflared metrics
```

全部 origin 仅绑定 loopback。18790/18791 的全局 controller/console 已退休并必须关闭。Windows 与局域网机器不是生产依赖。

## 路由所有权

- 静态公开：`/` 官网、`/world/`、`/framework/`、`/parents/`。首页轻量历史预览与完整 World 共用构建期 `historyCatalog`。
- 静态受保护：`/workshop/` 是 mentor/admin 只读历史归档；旧工具源码在 release 的 `_source` 中逐字节保留，但 Gateway 固定返回 404。归档页只读导出当前浏览器遗留记录。
- 动态应用：`/studio/*`、`/course/*`、`/classroom/*`、`/account/*`、`/auth/*`、`/api/studio/*`、`/api/platform/*`。
- Released-only 公共摘要：`/api/public/courses` 由统一 Worker 的 allow-list DTO 提供。
- 固定 P／D／M 课件：产品经理课件历史 `r0` 位于 `/courseware/product-mentor-foundations/`、当前 `r1` 位于其 `/r1/` 子路径；D／M 分别位于 `/courseware/development-mentor-ligun/`、`/courseware/market-mentor-user-system/`。各版本原样复制并统一经 cookie-only `auth_request` 保护；导师与学员从 `/course/` 只读访问。
- 退休：`/alpha*`、`/control*` 返回 410；`/api/classroom/*` 返回 410；公网 `/api/internal/*` 返回 404。

Gateway 只允许官网、World、方法框架和家长入口被索引；认证、教学、内部、归档、API 与运维端点统一 noindex。隐藏或 noindex 都不替代服务端鉴权。

## 单一 release

`~/Services/minisv/releases/<ID>` 同时包含 `site/`、`app/dist/` 和 `ops/`。Nginx 的 volume 与 `com.cyberforker.msv-classroom` launchd 都跟随 `~/Services/minisv/current`。每个 bundle 有根 manifest 和 `bundle.json`；data/secrets 不打包。

## 数据与课程

D1-compatible 数据位于 `~/Services/msv-classroom/data`。CourseDefinition→Candidate→Test receipt→Released→Production 全在统一 Worker 中执行。每个 Classroom 锁定一个 exact course script，并保存创建时的导师课件审计快照、P/D/M/O + N Membership、Admin DM permission 和独立 ControllerState；课件播放不读取该快照。

产品经理导师课件使用同一 package 的不可变版本：历史 `r0` 来自 commit `679213a61b835335016eac7649213983a0e48489`、tree `3a041c4714190cc026f6de8e06e15cec0e5f765d`；当前 `r1` 来自 `chj9-11` commit `d9d45f1396b54a7ac6b41715b31122d8ffc597ff`、tree `d26045a3eb1c249629092dcddeb82e7812ff0ff5`。构建不得编辑同事源码。历史 `r0` 仅供审计或显式版本预览；所有课堂的 P 导师入口每次打开都解析当前发布指针 `r1`。
