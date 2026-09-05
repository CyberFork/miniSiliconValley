# 安全边界与密钥管理

## 威胁边界

- Cloudflare Tunnel 是唯一公网入口；18780、18787、18789、18790、18791、18792 必须保持 loopback 绑定。
- Nginx gateway 是路由与 origin 兼容边界；不得绕过 gateway 将内部服务发布到公网。
- controller 浏览器写操作只接受 admin/mentor RBAC 会话；service key 仅只读 state/script。
- Hecate 主机、Cloudflare 账户、发布流水线和备份存储均属受信运维边界，必须最小权限、审计和补丁更新。

## 文件与运行时

账户、Tunnel credentials、controller service key、cloudflared 配置及 launchd 配置设为 `0600`；目录至少 `0700`。发布包不得含秘密，日志和错误输出不得含密码、token、Cookie、账户名。发现泄露时立即撤销并轮换，不要把秘密提交 Git。

## 轮换

建立轮换记录和双人复核：先生成新 service key/账户或 Tunnel credential，更新受控文件并保持 `0600`，重启对应 launchd 服务，执行本地及公网健康检查，确认新凭据生效后撤销旧凭据。轮换期间不在命令行、工单或聊天中粘贴秘密；仅使用 `<...>` 占位符记录操作。
