# Mini Silicon Valley 身份、账号切换与课堂委派

## 正式课堂账号流

```text
导师／管理员预创建账号
  → 明文初始密码只显示一次
  → 用户登录
  → 强制首次改密
  → 依据 Membership／Admin DM 进入课堂
```

正式 Classroom 不依赖注册邀请码、验证码登录、队伍申请或公开 TEAM ID 入队。`/auth/register` 只保留独立体验账号用途，公开注册只能产生 learner，不能获得任何 Classroom Membership。

## 角色

- `admin`：平台管理角色；可进入 Studio、预创建账号和创建课堂，但不会自动穿透所有 Classroom。
- `mentor`：导师角色；可进入 Studio、预创建账号、创建课堂，并在不同 Classroom 承担 P/D/M/O Membership。
- `learner`：只进入已有 Membership 的 Classroom。
- `Primary Admin DM`：Classroom 创建时确定的根管理权限；可与 P/D/M/O 导师重合，也可以是平台管理员；只有它能委派。
- `Delegated Admin DM`：Primary 授予某位有效导师的课堂管理权限；可管理课堂，但不能继续授权或撤销他人。

## 密码与会话

- 密码只保存慢哈希及独立 salt；服务端不读取明文。
- 初始密码由安全随机源生成，仅在创建响应中出现一次，并标记 `mustChangePassword`。
- 未改初始密码时，Studio/Classroom 数据 API 返回 `PASSWORD_CHANGE_REQUIRED`。
- 会话 Cookie 为 Secure、HttpOnly、SameSite，并受服务端过期与撤销控制。
- 写操作验证真实浏览器 Origin；gateway 不得把 Origin 硬编码成可信值。
- 全站账号菜单的“切换账号”会先在服务端撤销当前会话，再回到登录页；系统不保存其他账号密码。
- 平台管理员的 Test 身份模拟与真实会话绑定，最长 30 分钟，只能访问一个明确的 Test Classroom；所有请求保留 actor 与 effective identity。

## 分发规范

一次性 CSV 只交给有权限的现场负责人，并将每组凭据私发本人。密码、Cookie、重置 token、账号全表和 Tunnel credential 不进入聊天群、截图、Git、课程 JSON 或发布回执。

## 找回边界

用户可在账户中心用当前密码修改密码。遗失密码时由受控后台签发单次重置流程；系统不显示旧密码。课堂 Admin DM 能创建新账号和调整 Membership，不等于拥有全平台账号停用／重置权限。

平台管理员若同时显式拥有某间 Test Classroom 的 Admin DM 权限，可在该课堂成员页停用／启用测试账号、重发一次性凭据或临时模拟其身份。该能力不适用于 Production、平台管理员目标或课堂外账号；新明文密码只在重发响应中显示一次。

完整操作与权限矩阵见 [账号切换与 Admin DM 委派 SOP](ACCOUNT_SWITCHING_AND_ADMIN_DM_SOP.md)。
