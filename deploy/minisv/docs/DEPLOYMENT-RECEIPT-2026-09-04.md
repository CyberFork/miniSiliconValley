# Mini Silicon Valley 生产迁移回执｜2026-09-04

本回执不包含 API Token、Tunnel credential、账户密码、Cookie、service key 或席位能力值。

## 交付结果

- 权威域名：`https://minisv.vip/`
- 生产节点：Hecate Mac mini（唯一应用 origin）
- 发布版本：`20260904T053331Z-79a4f1ad28b5`
- 发布包 SHA-256：`76148e42980d44e9759d47bd1512f4347cc35c9da8853dabb8fec499a94182de`
- 发布包内容：137 个普通文件
- Cloudflare Tunnel：`minisv-hecate-prod`
- Tunnel ID：`f5e79a9c-ff96-450f-9543-e16530d09cc9`
- DNS：apex 与 `www` 均为代理 CNAME，指向该 Tunnel；`www` 规范跳转 apex
- DNS 切换证据：Hecate `~/Services/minisv/backups/20260904T045900Z-dns-cutover/`

## 单节点拓扑

公网只经 Cloudflare Tunnel 到 Hecate `127.0.0.1:18780`。Gateway 再路由 Classroom `18787`、Parent QA `18789`、LIVE RUN controller `18790` 与 remote console `18791`；cloudflared metrics 位于 `18792`。所有 origin 端口都只监听 loopback。

旧 `work.cyberforker.com/msv/alpha/` 已改为到新域名的 308 兼容跳转。开发机到 Windows 的 MSV 反向 SSH LaunchAgent 已卸载并禁用；Windows 上旧 `MSV-Live-Run-Console` 与 `MSV-Live-Run-Grid` 任务已停止并禁用，任务 XML 备份在 `C:\msv-live-run-console\decommission-backup-20260904T054214Z`。Windows、`192.168.*` 和开发机 loopback 均不在新生产链路中；退役后再次执行公网 smoke 与 Alpha 八席位检查，结果通过。

## 公网验收

- `/`、`/world/`、`/framework/`、`/parents/`、`/workshop/`、`/auth/login`、`/alpha/`、`/healthz`、`/release.json`、`/sitemap.json`：预期成功。
- `/classroom/`：未登录时 307 到登录页；`/control/`：未登录时 303 到登录页。
- `http://minisv.vip/`：308 到 HTTPS；`https://www.minisv.vip/`：308 到 apex。
- 所有响应经 Hecate gateway 返回 `X-MiniSV-Origin: hecate`；HSTS、CSP、`nosniff` 等安全头已核验。
- 根导航实时读取 `/healthz` 与 `/release.json`，桌面和手机端均显示“Hecate 生产服务在线”，不使用演示状态。
- 普通访客无法读取 LIVE RUN 主控脚本、控制令牌或执行主控写操作；导师可访问主控，学员收到 403。
- Google 与饿了么课程均通过 5 个宏步骤、13 个脚本块、每块 8 个席位任务的结构校验。
- 八个独立客户端并发领取 4 导师 + 4 学员席位，在 2.94 秒内读到同一 Run、课程、版本和块位；测试后 8 个租约全部释放。

## 自动化与浏览器验收

- LIVE RUN Python：13 项通过。
- LIVE RUN Node：4 项通过。
- Hecate 单节点／退役命令契约：3 项通过；旧 Windows 与反向隧道命令均 fail-closed。
- Gateway / 发布切换：7 项通过。
- Hecate 健康检查与公网 smoke：全部通过。
- 桌面与手机浏览器视觉验收：6 个场景、0 console error、0 横向溢出。
- 账号权限：4 个导师与 4 个学员凭据有效；导师主控 200、学员主控 403、匿名主控重定向。
- 重启恢复：Run `run-20260904-123314-30fb89`、课程、版本和当前块保持不变。
- 回滚演练：成功切换到上一 release，再原子前滚至本回执版本。

迁移前 Alpha/Remote Console JSON 回执保留原始旧地址以维持证据不可改写，但已由 `tools/live-run/docs/HISTORICAL-RECEIPTS.md` 明确分类为历史记录；当前操作手册只使用 `minisv.vip`。

## 凭据与回滚

Tunnel credential、账户文件和 controller service key 位于 Hecate `~/Services/minisv/secrets/`，目录 `0700`、文件 `0600`，不在 release 或仓库中。部署期间使用的临时最小权限 Cloudflare Token 在验收后撤销，本机临时副本清除。

应用回滚执行：

```sh
$HOME/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_RELEASE_ID>
```

DNS 回滚必须使用受控备份并重新执行 TLS、域名、RBAC 与公网 smoke 验收。

## 依据

- Cloudflare Tunnel API：<https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel-api/>
- Tunnel DNS 路由：<https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/>
- DNS batch：<https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/batch/>
- API Token：<https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/>
