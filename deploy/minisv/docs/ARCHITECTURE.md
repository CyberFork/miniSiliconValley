# Mini Silicon Valley 生产架构

## 边界与流量

生产仅运行在 Hecate Mac mini。公网 `minisv.vip` 由 Cloudflare Tunnel 送入本机 loopback Nginx gateway（`127.0.0.1:18780`）；所有应用端口均不直接暴露公网：

- Classroom Worker：`127.0.0.1:18787`
- Parent QA：`127.0.0.1:18789`
- LIVE RUN controller：`127.0.0.1:18790`
- 远程席位 console：`127.0.0.1:18791`
- cloudflared metrics：`127.0.0.1:18792`

Gateway 对外提供语义路由：`/`、`/world/`、`/classroom/`、`/alpha/`、`/control/`、`/framework/`、`/parents/`、`/workshop/`。旧 origin 兼容映射只能在网关内部使用，浏览器应只看到 `minisv.vip`。

## 控制面

LIVE RUN controller 的浏览器端必须有 admin/mentor RBAC 会话。service key 仅可读取 state/script，不得代替浏览器 RBAC 或执行写操作。controller、console、cloudflared 由 launchd labels `com.minisv.live-run-controller`、`com.minisv.remote-console`、`com.minisv.cloudflared` 管理；gateway 由 Docker service `minisv-gateway` 管理。

## 发布布局

`$HOME/Services/minisv/releases/<RELEASE_ID>` 保存不可变发布；`$HOME/Services/minisv/current` 是原子切换的 symlink。部署先校验、再切换 current；回滚切回已存在 release。账户、隧道凭据、service key 必须为 `0600`，不进入发布包或日志。

## Course Package v1

`/control/editor/` 与 `/control/` 由同一个 loopback LIVE RUN 服务提供，并复用课堂 HttpOnly Session 的 admin/mentor RBAC。编辑器只提交声明式 JSON：服务端校验 5×13 安全骨架、课程素材底座、八席任务与人工状态机，然后原子写入 `~/Services/minisv/data/courses/`。草稿、发布版、不可变历史修订分目录保存，release 切换不会覆盖课程数据。运行主控只发现已发布版本；活动 Run 保留内存中已加载的课程，重置/新 Run 才采纳新修订。
