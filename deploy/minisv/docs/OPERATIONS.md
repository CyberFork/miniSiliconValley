# MiniSV Hecate 运维

命令中的 `<...>` 都是占位符。不要把任何真实凭据写入文档、日志或 Git。

## 部署统一 bundle

```bash
export MINISV_RELEASE_ARCHIVE=<release.tar.gz>
export MINISV_RELEASE_ID=<RELEASE_ID>
export MINISV_ACCOUNTS_SOURCE=<private accounts.json>
export MINISV_TUNNEL_ID=<TUNNEL_ID>
export MINISV_TUNNEL_CREDENTIAL_SOURCE=<private tunnel credential json>
./ops/scripts/deploy-hecate.sh
```

脚本验证 archive、根/site manifests、app worker、plist 和 Nginx 配置；备份 D1-compatible 数据；原子切换 `current`；启动同版本 worker/gateway；保留健康且配置未变的 cloudflared；失败恢复之前的 exact current symlink 与配置。

## 健康检查

```bash
$HOME/Services/minisv/current/ops/scripts/healthcheck-hecate.sh
curl -fsS -H 'Host: minisv.vip' http://127.0.0.1:18780/healthz
curl -sS -o /dev/null -w '%{http_code}
'   -H 'Host: minisv.vip' -H 'X-Forwarded-Host: minisv.vip' -H 'X-Forwarded-Proto: https'   http://127.0.0.1:18787/api/auth/session
curl -fsS http://127.0.0.1:18792/metrics >/dev/null
python3 $HOME/Services/minisv/current/ops/scripts/public-smoke.py --base https://minisv.vip
```

应用 session 未登录预期 401。18790/18791 必须拒绝连接。

## 进程

```bash
launchctl print gui/$(id -u)/com.cyberforker.msv-classroom
launchctl print gui/$(id -u)/com.cyberforker.msv-parent-qa
launchctl print gui/$(id -u)/com.minisv.cloudflared
cd $HOME/Services/minisv && /usr/local/bin/docker compose -f compose.yml ps
```

只在确认相应进程有问题后有界重启：

```bash
launchctl kickstart -k gui/$(id -u)/com.cyberforker.msv-classroom
launchctl kickstart -k gui/$(id -u)/com.minisv.cloudflared
cd $HOME/Services/minisv && /usr/local/bin/docker compose -f compose.yml up -d --force-recreate gateway
```

## 课件检查

```bash
test "$(curl -sS -o /dev/null -w '%{http_code}' https://minisv.vip/courseware/product-mentor-foundations/)" = 401
curl -sSI https://minisv.vip/courseware/product-mentor-foundations | grep -i '^location:'
```

`release.json.coursewareArtifact` 必须记录固定 chj source、`transformed=false`、整树 digest/files/bytes。匿名访问 P／D 原始静态课件均须返回 401 且不得泄漏正文；登录后的导师和学员从动态 `/course/` 目录只读打开。

## 回滚与数据

```bash
$HOME/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_UNIFIED_RELEASE_ID>
```

数据位于 release 外，不随代码回滚。每次部署备份 `~/Services/msv-classroom/data` 到受控 backup；不得通过删除数据库解决 schema 或登录故障。
