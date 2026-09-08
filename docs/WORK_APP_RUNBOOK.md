# Mini Silicon Valley 生产运行手册

> 当前架构：T-085 unified release。旧 Alpha/LIVE RUN 操作已退休。

## 服务拓扑

```text
Cloudflare Tunnel
  → 127.0.0.1:18780  minisv-gateway
      ├─ current/site
      ├─ 127.0.0.1:18787  unified Classroom/Studio/Course worker
      └─ 127.0.0.1:18789  Parent Q&A
127.0.0.1:18792  cloudflared metrics
```

18790/18791 必须没有监听。课堂数据位于 `~/Services/msv-classroom/data`；release 位于 `~/Services/minisv/releases/<ID>`；两者分离。

## 日常检查

```bash
ssh hecate-work
launchctl print gui/$(id -u)/com.cyberforker.msv-classroom | grep -E 'state =|pid =|last exit code'
launchctl print gui/$(id -u)/com.cyberforker.msv-parent-qa | grep -E 'state =|pid =|last exit code'
launchctl print gui/$(id -u)/com.minisv.cloudflared | grep -E 'state =|pid =|last exit code'
/usr/local/bin/docker inspect --format 'gateway={{.State.Status}} health={{.State.Health.Status}}' minisv-gateway
$HOME/Services/minisv/current/ops/scripts/healthcheck-hecate.sh
python3 $HOME/Services/minisv/current/ops/scripts/public-smoke.py --base https://minisv.vip
```

预期：应用、Parent QA、cloudflared 与 gateway 健康；`/course/`、`/studio/`、`/classroom/` 未登录重定向；`/alpha/`、`/control/` 为 410；公网 `/api/internal/*` 为 404。

## 账号与课堂

正式课堂使用导师／管理员预创建账号。明文初始密码仅显示一次，首次登录强制改密。账号与 Classroom 解耦，通过 Membership 参与多个课堂。Admin DM 可在 members 页面替换未开课席位、创建新账号并授予课堂权限；它不能自动获得平台管理员权限。

完整 UI 流程见 [COURSE_PLATFORM_SOP.md](COURSE_PLATFORM_SOP.md)。

## 发布

只发布统一 bundle。静态 site 与 app worker 必须拥有同一个 `bundle.json.mainSha` 并一起切换 `current`。发布脚本先停止 worker、备份数据、验证包、切换、重启，再恢复 gateway；失败自动恢复之前捕获的 exact symlink 和配置。

```bash
# Hecate 上使用受控环境变量，不把值写入终端回执
$HOME/path/to/bundle/ops/scripts/deploy-hecate.sh
```

## 回滚

```bash
$HOME/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_UNIFIED_RELEASE_ID>
```

回滚代码不回滚课堂数据。执行后重跑 healthcheck、public smoke 和角色登录验收。

## 常见故障

- 页面与 API 版本不一致：检查 `readlink ~/Services/minisv/current`，确认 gateway 和 launchd 都指向同一 release。
- 课堂 401：会话缺失或过期；重新登录。
- 课堂 403：首次密码未改、无 Membership 或无该课堂 Admin DM。
- Controller 409：并发版本冲突；刷新，不要重复提交旧 version。
- 课件仍为旧版：已开始课堂 exact 锁定的预期行为；新建 Test/Production 验证新版。
- P 课件资源 404：检查 `/courseware/product-mentor-foundations/` 的整树 manifest；不要复制或改写单个文件修补。
- 18790/18791 有监听：视为旧全局运行时复活，停止并禁用对应 launchd，再查部署脚本来源。
- 网关异常：先 `nginx -t`、loopback health、日志和 release manifest；不要用无条件反复重启代替根因。

## 安全记录

发布记录只写 release ID、main SHA、P 课件 commit/tree、manifests、健康结果和回滚目标。绝不写密码、Cookie、reset token、Tunnel credential 或私密课件正文。
