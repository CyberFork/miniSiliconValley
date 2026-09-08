# Mini Silicon Valley 身份与账号

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
- `admin-dm`：某个 Classroom 的权限，不是平台角色；可与 P/D/M/O 导师重合，也可授予另一导师／管理员。

## 密码与会话

- 密码只保存慢哈希及独立 salt；服务端不读取明文。
- 初始密码由安全随机源生成，仅在创建响应中出现一次，并标记 `mustChangePassword`。
- 未改初始密码时，Studio/Classroom 数据 API 返回 `PASSWORD_CHANGE_REQUIRED`。
- 会话 Cookie 为 Secure、HttpOnly、SameSite，并受服务端过期与撤销控制。
- 写操作验证真实浏览器 Origin；gateway 不得把 Origin 硬编码成可信值。

## 分发规范

一次性 CSV 只交给有权限的现场负责人，并将每组凭据私发本人。密码、Cookie、重置 token、账号全表和 Tunnel credential 不进入聊天群、截图、Git、课程 JSON 或发布回执。

## 找回边界

用户可在账户中心用当前密码修改密码。遗失密码时由受控后台签发单次重置流程；系统不显示旧密码。课堂 Admin DM 能创建新账号和调整 Membership，不等于拥有全平台账号停用／重置权限。
