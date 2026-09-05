# 生产运维手册

以下命令中的 `<...>` 均为占位符，不要替换为文档中的真实凭据。

## 部署

```sh
cd /path/to/minisv-deploy
export MINISV_RELEASE_ARCHIVE=/path/to/release-<ID>.tar.gz
export MINISV_RELEASE_ID=<ID>
export MINISV_ACCOUNTS_SOURCE=/secure/path/accounts.json
export MINISV_TUNNEL_ID=<TUNNEL_ID>
export MINISV_TUNNEL_CREDENTIAL_SOURCE=$HOME/.cloudflared/<TUNNEL_ID>.json
./scripts/deploy-hecate.sh
```
脚本会校验 manifest、Python/Node/launchd 配置，复制 secrets（`0600`），原子更新 `current`，启动 launchd 与 `minisv-gateway`，并执行健康检查。

## 健康检查与观察

```sh
$HOME/Services/minisv/current/ops/scripts/healthcheck-hecate.sh
curl -fsS http://127.0.0.1:18790/healthz
curl -fsS http://127.0.0.1:18791/healthz
curl -fsS -H 'Host: minisv.vip' http://127.0.0.1:18780/healthz
/usr/local/bin/docker compose -f $HOME/Services/minisv/compose.yml ps
log stream --predicate 'process == "cloudflared"' --style compact
```
日志目录为 `$HOME/Services/minisv/logs`；禁止写入 token、Cookie 或密码。

## 重启

```sh
launchctl kickstart -k gui/$(id -u)/com.minisv.live-run-controller
launchctl kickstart -k gui/$(id -u)/com.minisv.remote-console
launchctl kickstart -k gui/$(id -u)/com.minisv.cloudflared
cd $HOME/Services/minisv && /usr/local/bin/docker compose -f compose.yml up -d --force-recreate gateway
```

## 回滚

```sh
$HOME/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_RELEASE_ID>
```
确认健康检查及八个路由后再恢复流量；保留失败发布目录供审计。

## 灾备

定期离线加密备份 `releases/`、`compose.yml`、gateway/cloudflared 配置、controller/console 数据及 launchd plist；secrets 单独以访问受控方式备份。新 Hecate 按部署前置条件安装 Docker、Node、Python、cloudflared，恢复文件后先在 loopback 验证，再恢复 Tunnel DNS。定期演练从最近已知良好 release 回滚。

## 课程库运维

- 编辑入口：`https://minisv.vip/control/editor/`
- 持久目录：`~/Services/minisv/data/courses/{drafts,published,history}`
- 目录权限：0700；JSON 文件由服务以 0600 原子写入。
- 查看已发布课程：登录导师账号后访问 `/control/api/courses`。
- 直接放置文件前，先在 release 的 `live-run/` 目录执行 `python3 course.py --validate <file>`。
- 无效的手工文件会出现在编辑器诊断区，但不会让内置 Google/饿了么课程或活动课堂下线。
