# Mini Silicon Valley 八席课堂控制台

## 唯一正式入口

- 席位大厅：<https://minisv.vip/alpha/>
- 导师主控：<https://minisv.vip/control/>
- 全站导航：<https://minisv.vip/>

生产仅运行在 Hecate。Cloudflare Tunnel 把正式域名送入 Hecate loopback Gateway，再分别路由到 LIVE RUN controller 与 remote console；Windows、局域网 IP 和开发机反向 SSH 均已退役。

## 成员操作

1. 打开席位大厅，点击“设置／修改”，输入 1—24 个字符的昵称。
2. 领取 W00—W07 中的一席或两席。“领取并打开”会弹出独立竖向卡片窗口；标题采用“角色 · 昵称”，例如“市场导师 · forker”。
3. 同一浏览器修改昵称时，席位 lease 不变；本人和其他浏览器会同步看到新昵称。
4. 完成后释放席位。租约 5 分钟无操作会自动回收；测试清场可使用带完整确认语句的“全局重置席位”。

席位能力值只保存在 URL fragment，并由席位页转成请求头；fragment 不会发送到 Cloudflare、Nginx 或 Node 请求 URL。服务器每次只返回当前一个 seat 的投影：学员只能看到自己的私密卡、RP 与钱包，导师席不包含 learner view。

## 导师操作

导师或管理员登录后进入主控。主控按 5 个宏步骤、13 个块呈现 Google 或饿了么课程；每块必须先“执行”，再由主 DM 人工“验收并解锁”。主控写请求同时校验第一方会话、admin/mentor RBAC 与正式 Origin；席位 lease 或内部 service key 都不能代替导师权限。

## 生产运维

Hecate 上的服务边界：

- Gateway：`127.0.0.1:18780`
- Classroom：`127.0.0.1:18787`
- Parent QA：`127.0.0.1:18789`
- LIVE RUN controller：`127.0.0.1:18790`
- Remote console：`127.0.0.1:18791`
- cloudflared metrics：`127.0.0.1:18792`

健康检查：

```sh
$HOME/Services/minisv/current/ops/scripts/healthcheck-hecate.sh
curl -fsS https://minisv.vip/healthz
curl -fsS https://minisv.vip/release.json
```

完整的发布、重启、回滚和凭据轮换流程见 [`../../../deploy/minisv/docs/OPERATIONS.md`](../../../deploy/minisv/docs/OPERATIONS.md)，架构见 [`../../../deploy/minisv/docs/ARCHITECTURE.md`](../../../deploy/minisv/docs/ARCHITECTURE.md)，最终迁移回执见 [`../../../deploy/minisv/docs/DEPLOYMENT-RECEIPT-2026-09-04.md`](../../../deploy/minisv/docs/DEPLOYMENT-RECEIPT-2026-09-04.md)。

## 历史实现

`deploy-windows.sh`、`controller-tunnel.sh` 与两个 `windows/` 目录只保留为会明确失败的退役墓碑，防止旧自动化静默复活。迁移前的 Alpha/Remote Console JSON 回执仍保留原始目标地址供审计，不能作为当前操作说明；参见 [`../docs/HISTORICAL-RECEIPTS.md`](../docs/HISTORICAL-RECEIPTS.md)。
