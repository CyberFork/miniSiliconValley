> 当前政策（T-105）：公开注册保持开放，始终创建 active learner；可浏览 Released 课件但不自动获得 Classroom membership。正式课堂必须由 Admin DM 分配 membership。无 Studio、Candidate 预览或 Test 身份模拟权限。

# Mini Silicon Valley 身份、账号切换与课堂委派

## 账号准入与正式课堂流

```text
路径 A：学员自行注册 → active learner → 浏览 World／Released 课件
路径 B：导师预创建账号 → 单次初始密码 → 学员首次改密

任一路径
  → Admin DM 在 Classroom Factory／成员管理中明确分配 Membership
  → 学员进入被分配的具体 Classroom
```

正式 Classroom 不依赖注册邀请码、验证码登录、队伍申请或公开 TEAM ID 入队。`/auth/register` 始终只创建 active learner；它不是入队动作，也不会附带任何 Classroom Membership。自行注册者把完整用户名或昵称告诉 Admin DM 后，导师可通过 exact 查找把该账号加入待配置列表，再显式分配席位。

## 角色

- `admin`：平台管理角色；可进入 Studio、预创建账号和创建课堂，但不会自动穿透所有 Classroom。
- `mentor`：导师角色；可进入 Studio、预创建账号、创建课堂，并在不同 Classroom 承担 P/D/M/O Membership。
- `learner`：无需 Membership 即可浏览 World 与 Released 课件；只进入自己已有 Membership 的 Classroom。
- `Primary Admin DM`：Classroom 创建时确定的根管理权限；可与 P/D/M/O 导师重合，也可以是平台管理员；只有它能委派。
- `Delegated Admin DM`：Primary 授予某位有效导师的课堂管理权限；可管理课堂，但不能继续授权或撤销他人。

## 密码与会话

- 密码只保存慢哈希及独立 salt；服务端不读取明文。
- 初始密码由安全随机源生成，仅在创建响应中出现一次，并标记 `mustChangePassword`。
- 未改初始密码时，Studio/Classroom 数据 API 返回 `PASSWORD_CHANGE_REQUIRED`。
- 会话 Cookie 为 Secure、HttpOnly、SameSite，并受服务端过期与撤销控制。
- 写操作验证真实浏览器 Origin；gateway 不得把 Origin 硬编码成可信值。
- 全站账号菜单列出本浏览器已经验证的账号；直接切换时服务端校验目标凭据并原子轮换唯一活跃 Session，不重复索要密码，也不把会话令牌或密码放入前端存储。添加／重验失败不会退出当前账号。
- 浏览器账号集合使用独立 Secure、HttpOnly Cookie，D1 只保存令牌摘要；最多 8 个账号。退出当前只移除当前账号，退出全部撤销整个集合及其关联 Session。
- 平台管理员的 Test 身份模拟与真实会话绑定，最长 30 分钟，只能访问一个明确的 Test Classroom；所有请求保留 actor 与 effective identity。

## 分发规范

一次性 CSV 只交给有权限的现场负责人，并将每组凭据私发本人。密码、Cookie、重置 token、账号全表和 Tunnel credential 不进入聊天群、截图、Git、课程 JSON 或发布回执。

## 找回边界

用户可在账户中心用当前密码修改密码。遗失密码时由受控后台签发单次重置流程；系统不显示旧密码。课堂 Admin DM 能创建新账号和调整 Membership，不等于拥有全平台账号停用／重置权限。

平台管理员若同时显式拥有某间 Test Classroom 的 Admin DM 权限，可在该课堂成员页停用／启用测试账号、重发一次性凭据或临时模拟其身份。该能力不适用于 Production、平台管理员目标或课堂外账号；新明文密码只在重发响应中显示一次。

完整操作与权限矩阵见 [账号切换与 Admin DM 委派 SOP](ACCOUNT_SWITCHING_AND_ADMIN_DM_SOP.md)。
