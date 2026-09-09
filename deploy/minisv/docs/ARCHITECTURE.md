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

- 静态：`/`、`/world/`、`/framework/`、`/parents/`、`/workshop/`。
- 动态应用：`/studio/*`、`/course/*`、`/classroom/*`、`/account/*`、`/auth/*`、`/api/studio/*`、`/api/platform/*`。
- 固定 P／D 课件：`/courseware/product-mentor-foundations/`、`/courseware/development-mentor-ligun/`，原样复制并统一经 cookie-only `auth_request` 保护；导师与学员从 `/course/` 只读访问。
- 退休：`/alpha*`、`/control*` 返回 410；`/api/classroom/*` 返回 410；公网 `/api/internal/*` 返回 404。

## 单一 release

`~/Services/minisv/releases/<ID>` 同时包含 `site/`、`app/dist/` 和 `ops/`。Nginx 的 volume 与 `com.cyberforker.msv-classroom` launchd 都跟随 `~/Services/minisv/current`。每个 bundle 有根 manifest 和 `bundle.json`；data/secrets 不打包。

## 数据与课程

D1-compatible 数据位于 `~/Services/msv-classroom/data`。CourseDefinition→Candidate→Test receipt→Released→Production 全在统一 Worker 中执行。每个 Classroom 有 exact course/courseware bindings、P/D/M/O + N Membership、Admin DM permission 和独立 ControllerState。

固定产品导师课件来自 chj commit `679213a61b835335016eac7649213983a0e48489`、tree `3a041c4714190cc026f6de8e06e15cec0e5f765d`；构建不得编辑同事源码。
