# MiniSV 安全边界

## 网络

- Cloudflare Tunnel 是唯一公网入口。
- 18780、18787、18789、18792 只绑定 loopback；18790/18791 必须关闭。
- Gateway 清空外部 Authorization 和伪造身份头，向应用透传浏览器真实 `Origin`；应用对写操作执行同源校验。
- 公网 `/api/internal/*` 为 404；退休 API/页面为 410。

## 身份与授权

- 会话使用 Secure、HttpOnly、SameSite Cookie。
- 预创建账号的初始密码只显示一次；首次改密前平台数据 API 拒绝访问。
- Studio 只允许平台 admin/mentor。
- Classroom 必须有 Membership 或该实例 `admin-dm`；平台 admin 不隐式穿透课堂。
- Admin DM 是课堂权限，不是平台提权或第五导师。
- 学员不接收导师脚本、中控验收门或他人私密卡；screen 由服务端专用 allow-list 生成。
- inline HTML 课件在无 same-origin 权限的 sandbox iframe 中播放。

## 文件与发布

- secrets、账号明文、D1/SQLite 数据和 symlink 不进入 bundle。
- secret 文件 0600，目录 0700；日志不得含密码、Cookie、token、用户名清单或课件私密正文。
- 同事 P 课件只从固定 commit/tree 构建；主项目不编辑、注入或改写。
- 发布前验证 manifests；失败部署恢复之前 exact symlink，不用未校验目录拼接修复。

## 事件处理

凭据泄露时立即撤销／轮换并记录范围；课程或课件 digest 异常时停止发布、保留 release 与审计证据；不得用重建数据库或覆盖不可变 revision 隐藏问题。
