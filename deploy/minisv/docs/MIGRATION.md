# T-085 迁移说明

## 路由迁移

```text
旧 /alpha/*             → 已退休，410
旧全局 /control/*       → 已退休，410
旧 /control/editor/     → /studio/editor/
旧 Alpha 多窗口预览     → /studio/preview/ 页内 4 + N + 1
旧全局 LIVE RUN         → /classroom/{id}/control
旧 /course/ 静态大纲    → /course/ 动态导师课件库
同事原版 P 课件         → /courseware/product-mentor-foundations/
D 导师立棍课件          → /courseware/development-mentor-ligun/
M 导师用户体系课件      → /courseware/market-mentor-user-system/
正式课堂                → /classroom/{id}/
```

旧 Work 域名和 `/msv/*` 仅保留有限静态入口重定向；前端、Cookie、API 和正式文档一律使用 `https://minisv.vip`。

## 运行迁移

- 从三个 release/运行单元收口为一个 `site + app + ops` bundle。
- `com.cyberforker.msv-classroom` 攗为读取 `~/Services/minisv/current/app/dist`。
- `com.minisv.live-run-controller` 与 `com.minisv.remote-console` 停止、禁用并删除 plist；18790/18791 必须关闭。
- D1-compatible 数据继续位于 `~/Services/msv-classroom/data`，发布前停机备份，绝不复制进 release。
- 首次统一部署失败时恢复部署前捕获的 exact `current` symlink，即使旧 release 还是 static-only 也可恢复。

## 数据迁移

`drizzle/0004_unified_course_factory.sql` 只新增 Candidate、Test receipt、Courseware、ClassroomInstance、mentor seat、permission、controller、submission、wallet 和 factory event 表，不删除旧审计数据。runtime schema bootstrap 使用 `IF NOT EXISTS`，旧凭据退休更新必须带幂等条件。

## 验收

迁移完成必须同时满足：统一 bundle manifest 通过、worker/gateway 同一 release、Test/Production E2E 通过、P 课件整树不变、旧端口关闭、旧路由 410、公网 smoke 和真实角色浏览器验收通过。
