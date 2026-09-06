# Mini Silicon Valley 账户、登录与课堂成员权限

> 当前实现：2026-08-30。本文是现行操作规范，不是路线图。

## 1. 产品结论

Work 正式版使用第一方应用账户和 `HttpOnly` 会话，不使用浏览器 HTTP Basic Auth 弹窗，也不依赖邮件、手机号或外部验证码服务。

```text
学员身份：自行注册 → 用户名＋密码登录
课堂归属：提交 TEAM-XXXXXXXX → 等待DM审批 → 获得membership
密码协助：告诉DM用户名/昵称 → DM生成单次链接 → 学员自行设置新密码
导师身份：代码或后台配置 admin/mentor RBAC → 密码登录
```

统一入口：

- 登录：`/msv/demo/app/auth/login`
- 开放注册：`/msv/demo/app/auth/register`
- 忘记密码说明：`/msv/demo/app/auth/recover`
- 使用重置链接：`/msv/demo/app/auth/reset#token=…`
- 账户与密码协助：`/msv/demo/app/account`
- Classroom：`/msv/demo/app/classroom`

## 2. 学员账户旅程

### 2.1 自行注册

1. 打开注册页，不需要任何邀请。
2. 设置稳定用户名、安全昵称和至少12个字符的密码短语。
3. 系统只创建 `learner` 角色；请求体不能指定或提升角色。
4. 注册成功即建立安全会话并进入课堂大厅。
5. 用户名用于登录；昵称可在账户中心修改。

用户名重复返回 `409`。注册按客户端指纹限流，不能用批量请求滥建账号。

### 2.2 密码登录

1. 输入用户名和密码。
2. 可选“在这台私人设备上保持登录”。普通会话最长12小时，保持登录最长30天。
3. 成功后返回原本准备访问的受保护页面。
4. 用户不存在、密码错误或账号停用统一返回相同错误，避免账号枚举。

登录只有这一种交互方式。旧的数字登录码接口和UI已经删除。

登录、注册、找回、账户中心和课堂之间的跨页导航使用带完整 Work 部署前缀的原生链接。普通单击会直接完成页面跳转，不需要 `Ctrl`／`Command` 点击；认证边界不再交给当前部署中会抛错的客户端 Link 路由，以免链接看似可点但页面保持不动。

### 2.3 修改密码与设备

账户中心允许当前用户：

- 修改显示名称；
- 用当前密码设置新密码；
- 查看自己的登录设备并逐个退出；
- 退出当前账号。

修改密码会撤销其他设备会话，当前操作设备继续有效。

## 3. 忘记密码

当前不收集邮箱或手机号，因此找回页只说明联系DM，不接受任何数字代码。

1. 学员把用户名或课堂昵称私下告诉DM。
2. DM在课堂成员面板或账户中心搜索该学员，点击“生成重置链接”。
3. 系统只向DM展示一次完整URL；链接30分钟有效、只能使用一次。
4. 学员打开链接并自行输入新密码。DM看不到新密码。
5. 成功后旧会话全部撤销，并为当前浏览器建立新会话。

安全边界：

- token为32字节CSPRNG随机值；D1只保存SHA-256摘要。
- token放在URL fragment中，不会随HTTP请求进入反向代理日志或 `Referer`。
- 重置页读取fragment后立即用 `history.replaceState` 从地址栏和历史记录清除。
- 数据库通过 `consumed_at IS NULL` compare-and-set原子领取；顺序重放或并发双花只有一个赢家。
- 新链接会主动使同一账号此前未使用的重置链接失效。
- `mentor`只能帮助自己主持课堂中的成员或待审批学员；`admin`可帮助全部普通账号。
- `admin/mentor`属于特权账号，网页端禁止为其签发重置链接；由负责人通过代码或后台安全维护。

## 4. 课堂与队伍

账户回答“你是谁”，队伍membership回答“你能看哪一间课堂”。两者不能混用。

### 4.1 申请加入

1. DM创建课堂，系统同时创建首支队伍及公开ID，例如 `TEAM-ABCD2345`。
2. 学员登录后输入该队伍ID并提交。
3. 服务端只建立 `pending` 申请；学员此时仍不能读取课堂、成员或私密内容。
4. DM在成员管理区批准或拒绝。
5. 批准后服务端创建active membership并分配空席，课堂才出现在学员列表。

队伍ID是公开定位符，不是密码或能力令牌。真正授权始终由服务端membership校验完成。

### 4.2 DM直接管理

DM还可以：

- 按用户名或昵称搜索active learner；
- 选择目标队伍直接添加；
- 移出学员并立即撤销该课堂访问；
- 创建新队伍，获得各自独立且稳定的队伍ID；
- 查看队伍容量与待审批申请。

建队、添加与审批只在课堂的集结阶段开放，防止开局后破坏私密信息边界。已发过私密卡的移出成员不能被随意换席重加。

## 5. RBAC

```text
角色       来源               创建课堂   申请学员席位   被指派为DM   普通账号重置链接
admin      代码/后台配置      是         否             是          全部普通账号
mentor     代码/后台配置      是         否             是          自己主持课堂/待审批
learner    开放注册/后台种子  否         是             否          否
observer   后台种子           否         否             否          否
```

创建课堂后，创建者在该课堂获得 `dm` membership，并写入 `rooms.dm_profile_id` 成为最终负责人。创建者或系统管理员可在课堂“授课导师”区域输入准确导师用户名，把 active `mentor/admin` 账号指派为同一课堂的额外 `dm` membership；该导师随后自动在自己的课堂列表看到课程并获得主持能力。导师不进入任何团队、不占P／D／M／O席位，也不能通过 `TEAM-XXXXXXXX` 申请学员席位。

被指派导师可以主持阶段、发牌、裁决和管理学员，但只有课堂创建者或系统管理员可以增删授课导师；创建者本身不可被移除。指派和移除都写审计日志。平台RBAC与课堂内 `dm/learner` 身份分开保存；隐藏按钮不是授权依据，所有API都重新检查会话、membership和DM角色。

种子文件可给DM明确配置角色：

```json
{
  "dm": {
    "username": "msv-dm",
    "name": "课程导师",
    "password": "由安全渠道提供的长密码",
    "role": "mentor"
  },
  "learners": [],
  "outsider": {
    "username": "msv-observer",
    "password": "由安全渠道提供的长密码"
  }
}
```

`dm.role`只接受 `admin` 或 `mentor`。生成命令见[部署说明](./DEPLOYMENT.md)。

## 6. 会话与请求安全

- Cookie：`__Secure-msv_session`，`HttpOnly; Secure; SameSite=Lax`，路径限定为 `/msv/demo/app`。
- D1只保存会话token摘要，不保存明文token。
- 登录、注册和重置分别限流；Nginx另有粗粒度edge限流。
- 认证写操作检查可信 `Origin`、JSON类型和16 KiB体积上限。
- 密码使用每账号独立salt和600,000次PBKDF2-HMAC-SHA256。
- 安全事件不记录密码、cookie或明文重置token。
- 课堂写操作另行检查可信Origin、32 KiB体积、房间成员和当前阶段。

## 7. 退役机制与迁移

以下机制已经从路由、UI和操作手册中退役：注册邀请、数字登录码、个人恢复代码、数字密码重置码、六位课堂房间码及其轮换。

迁移保留旧表是为了审计和无损升级，不代表功能仍可调用。`0002_simplified_accounts_and_team_access.sql` 会把所有未使用旧凭据标为已消费／已撤销；旧接口返回404。新房间的遗留 `rooms.code` 列只写内部兼容键，不向API、UI或导出暴露。

## 8. 自动验收

```bash
npm run test:work-app
```

必须看到：

```text
WORK_APP_SMOKE_PASS auth=password registration=open reset=single-use-fragment team=request-approve-direct-add-remove rbac=server-enforced
```

冒烟覆盖：开放注册、密码成功/失败、旧路由404、cookie属性、请求同源/体积/频率限制、pending不授权、DM审批、直接添加、移出撤权、创建多队、fragment重置链接、旧会话撤销、token不可重放、特权账号禁止网页重置。
