# 从旧页面迁移到 Mini Silicon Valley

## 语义路由映射

旧 `work.cyberforker.com` 页面及 `/msv/...` 前缀不再作为用户入口；新入口统一为 `https://minisv.vip`：

- 旧 demo/home → `/world/`
- 旧 classroom → `/classroom/`
- 旧 alpha → `/alpha/`
- 旧 control → `/control/`
- 旧 framework/课程 → `/framework/`
- 旧 QA → `/parents/`
- workshop → `/workshop/`
- 根入口 → `/`

兼容改写只存在于 Nginx origin 代理，前端链接、重定向和 Cookie 均应使用新域名与新路径。

## 切换清单

1. 在 Hecate 部署并通过 `healthcheck-hecate.sh`；确认服务均绑定 loopback，Windows 不再是运行依赖。
2. 校验 Tunnel 配置、路由及 metrics `127.0.0.1:18792`；准备 DNS TTL 与变更窗口。
3. 在 Cloudflare 以同一批次把 apex 与 `www` 指向目标 Tunnel；切换前后记录均离线备份，避免新旧 origin 同时权威。
4. 验证 DNS、TLS、八个语义路由、登录/RBAC、课堂与家长 QA；检查浏览器不出现旧域名或 `/msv/` 链接。
5. 观察 gateway、controller、console、cloudflared 日志和健康状态，记录发布时间与 release ID。

## 回退清单

若验证失败，先从受控 DNS 备份恢复 Cloudflare 记录（或切入维护页），再执行 `./scripts/rollback-hecate.sh <KNOWN_GOOD_RELEASE_ID>`，验证 loopback 健康检查和旧兼容映射，最后重新检查 DNS 缓存、TLS、RBAC 与日志。问题关闭前保留变更记录和失败 release，不删除证据。

## 旧 Alpha 入口退役

`https://work.cyberforker.com/msv/alpha/` 只保留到 `https://minisv.vip/alpha/` 的 308 兼容跳转，不再代理 Windows 或局域网端口。开发机上的 `com.cyberforker.msv-live-run-tunnel` 已卸载并禁用；新的生产链路不依赖反向 SSH。
