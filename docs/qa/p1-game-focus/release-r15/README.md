# 2026-09-23 工坊启动与固定最新版入口

## 根因与处理

- nginx 标准 MIME 表不识别 `.mjs`，在 `nosniff` 下 ES Module 被拒绝；补充 `application/javascript mjs`，保留原完整 MIME 表。
- 本地 Rapier WASM 需要 CSP `wasm-unsafe-eval`；只在 P1 课件域内允许，未启用 JavaScript `unsafe-eval`，未允许远端脚本。
- P1 内嵌 route-game 只允许同源 iframe；其余页面仍禁止被嵌入。导师权限子请求不变。
- 经典 JS loader 在模块启动之前运行，0–4 实际阶段（不是下载百分比）、60 秒无进展提示重试；失败不会删除作品或 localStorage。

## 日常入口

- `/courseware/latest/p1/`
- `/courseware/latest/p2/`
- `/courseware/latest/p1/workshop/`

`package_release.py` 从验证过的当次构建 manifest 生成 `courseware-current.json`，固定入口自动跳到它指定的页面。只传递 session/slideId/slide/step，不携带旧 digest/revision。

历史课件文件本身保持不变。网关只对导师入口 HTML 响应附加同源导航脚本（明确的响应层增强；磁盘上的历史包与 digest 未改动）。它在旧版提供新窗口打开最新版与复制未保存文字。不会自动保存、清除、刷新或关闭旧页；已保存内容继续使用 shared-v1。原有公开投屏主页面不注入此导航。

## 验证边界

- Node 工坊测试 29 PASS；部署 unittest 77 PASS；最新入口 pytest 6 PASS。
- `verify-latest-navigation.mjs` 动态验证固定入口、workshop 深链、query 白名单、旧窗口保留与恶意地址拒绝。
- P1/P2 构建/结构测试、ESLint 通过。
- CUA Chrome 隔离 HTTP 环境人为延迟 render.mjs 12 秒：实际看到 1/4 进度条；随后看到真实 3D 网格且进度退出。控制台仅浏览器扩展警告，无工坊启动错误。
- 不替用户签署实体课堂试讲、iPad 或完整车辆操作验收。
- 没有关闭或刷新用户原有包含未保存文字的 r12 标签页。
