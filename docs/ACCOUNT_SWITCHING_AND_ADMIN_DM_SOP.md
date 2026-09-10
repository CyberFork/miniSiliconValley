# 多账号切换与 Admin DM 委派 SOP

> 适用版本：T-106／T-107 及以后
> 真值边界：第一方 Session、浏览器账号集合、`classroom_admin_dm_grants`、`auth_impersonations`。界面隐藏不是权限控制，所有规则均由服务端再次验证。

## 1. 三种动作不要混用

### 已登录账号之间切换

适用于所有登录用户。右上角账号菜单会先列出**这台浏览器已经验证过的账号**：

1. 点一个状态为“可切换”的账号，服务端重新校验账号状态、凭据版本和有效期。
2. 服务端在同一个原子批次中撤销旧的活跃 Session、签发目标账号 Session，并更新浏览器账号集合的唯一当前身份。
3. 页面按目标角色返回原位置；目标无权访问 Studio 时改去课堂中心，并明确说明原因。
4. 其他标签页收到身份变化通知后停止旧身份写入；存在未保存 Studio 草稿时先提示，草稿仍绑定原账号。

未选中目标账号时不会调用退出接口。系统不保存、读取或自动填充任何账号的明文密码；浏览器只持有两个 Secure、HttpOnly Cookie，D1 只保存其不可逆摘要和最小账号元数据。`returnTo` 只接受单斜杠开头的站内路径；`//host`、外部 URL 和认证页回跳均降级到安全入口。

### 添加或重新验证账号

- **添加账号**：打开登录页的“添加账号”，输入另一个账号的用户名和密码。成功后加入本浏览器列表；取消或失败不会退出当前账号。
- **需要重新登录**：过期、停用、改密或被撤销的账号不能直接切换。列表保留最小身份提示，用户只对目标账号重新验证。
- 每个浏览器最多保留 8 个已验证账号；这不是全平台用户目录，也不会授予任何额外权限。

### 退出与移除

- **退出当前账号**：撤销当前 Session 并从本浏览器账号集合移除它；若还有可用账号，进入账号选择页。
- **从此设备移除**：只撤销该账号在本浏览器集合中的凭据，不删除平台 Account、Membership 或课堂记录。
- **退出此设备全部账号**：经确认后原子撤销整个集合及其关联 Session，并清理浏览器缓存／站点存储。浏览器后退不能恢复受保护访问。

### Test 身份模拟

这是平台管理员做 UI 验收的调试能力，不是免密登录，也不是多标签并发账号：

- actor：真实登录的平台管理员，Cookie 与 Session 始终属于 actor。
- effective：一个明确 Test Classroom 内的导师、学员或 Delegated Admin DM。
- scope：只允许该 Test Classroom。
- TTL：30 分钟；返回、登出、过期、停用、重发凭据、Membership／DM 撤销均立即结束。

所有模拟状态下仍可访问的受保护页面持续显示黄色横幅：`真实管理员 → 当前测试身份`、剩余时间和“返回管理员身份”。Studio、Account、导师 Courseware 与共同投屏在模拟状态下直接返回绑定课堂；同一浏览器要并发观察多个真实账号时，仍使用不同 Browser Profile／Context。

## 2. 使用 Test 身份模拟

前置条件：

1. 课堂 `environment=test`。
2. 当前账号平台角色为 `admin`，且不是正在模拟的 effective identity。
3. 当前管理员显式拥有该课堂 Admin DM；平台 admin 不自动穿透课堂。
4. 目标不是平台管理员，且有本课堂有效导师／学员 Membership 或 Admin DM 授权。

操作：

1. 进入 `/classroom/{id}/members`。
2. 从右上角账号菜单点“测试账号管理”，或滚动到 `TEST ONLY · ACCOUNT ISOLATION`。
3. 核对目标姓名、`@username`、导师／学员席、账号状态和首次改密状态。
4. 点“以此身份进入”；系统跳到该课堂席位并显示黄色横幅。
5. 验证其私密任务、手牌、RP、个人钱包、提交和允许操作。
6. 尝试进入 Studio、Account、其他 Classroom 或 Production 时应被拒绝／带回绑定课堂。
7. 点“返回管理员身份”；确认横幅消失、账号菜单恢复 actor、目标私密信息不再出现。

测试账号管理还支持：

- **停用／启用**：停用会撤销目标全部会话与进行中的模拟；Primary Admin DM 不可停用。
- **重发一次性密码**：只对启用账号开放；撤销旧会话、旧 reset token 和模拟，明文仅显示一次。

## 3. Admin DM 权限矩阵

```text
能力                              Primary       Delegated      普通导师
打开本课堂中控／成员页               ✓              ✓              —
推进、退回、重试、验收 Block         ✓              ✓              —
管理开课前 Membership                ✓              ✓              —
Test reset／UI 验收                  ✓              ✓              —
授予 Delegated Admin DM              ✓              —              —
撤销 Delegated Admin DM              ✓              —              —
主动退出自己的 Admin DM              —              ✓              —
把自己／他人升级为 Primary            —              —              —
跨 Classroom 继承权限                 —              —              —
```

### 授予

Primary 在成员页选择 **授予 Delegated Admin DM** 和目标有效导师。服务端忽略客户端提交的任何 `canDelegate`／`primary` 字段，只产生：

```text
delegationMode = delegated
canDelegate    = false
```

重复授予保持幂等；被撤销后重新授予会增加授权版本，但不会恢复旧模拟会话。

### 撤销

Primary 只能撤销 Delegated。撤销立即：

- 标记授权 `revoked_at/revoked_by/version`；
- 删除旧 `classroom_permissions` 回滚镜像；
- 结束以该 Delegated 为 effective identity 的模拟；
- 使其下一次中控／成员 API 请求返回 403；
- 写入课堂工厂审计事件。

Primary 不能被撤销或主动退出，因此课堂永远保留根管理路径。Delegated 可用独立动作退出自己，但模拟状态下不允许执行。

## 4. 审计字段

每次测试模拟、拒绝、Admin DM 授予／撤销／退出及模拟中的课堂写操作都记录：

```text
actorProfileId       真实操作者
effectiveProfileId   当前生效身份
impersonationId      模拟 ID；正常会话为空
classroomId          明确课堂范围
expiresAt            模拟失效时间
requestedAction      权限变更动作（如适用）
errorCode/reason     被拒绝原因（如适用）
```

审计正文不得包含密码、Cookie、reset token、私密卡正文或个人钱包内容。

## 5. 失败关闭清单

以下结果都应是服务端拒绝，而不只是看不到按钮：

- Delegated 授予／撤销 Admin DM：`ADMIN_DM_DELEGATION_REQUIRED`。
- 对管理员或非导师授予 Delegated：`DELEGATED_DM_MENTOR_REQUIRED`。
- 撤销 Primary：`PRIMARY_ADMIN_DM_PROTECTED`。
- Primary 主动退出：`PRIMARY_RELINQUISH_FORBIDDEN`。
- 非管理员开始模拟：`PLATFORM_ADMIN_REQUIRED`。
- 模拟 Production：`IMPERSONATION_PRODUCTION_FORBIDDEN`。
- 模拟管理员：`IMPERSONATION_ADMIN_FORBIDDEN`。
- 模拟课堂外或已停用账号：`IMPERSONATION_MEMBERSHIP_REQUIRED`。
- 模拟状态访问 Studio／创建课堂／账号安全操作：对应 `IMPERSONATION_*_FORBIDDEN`。
- 模拟状态访问另一 Classroom：`IMPERSONATION_SCOPE_FORBIDDEN`。

## 6. 最短验收脚本

1. Primary 登录 → Studio 00—04 逐项点击 → URL／标题／高亮一致。
2. 登录 A 并添加 B → 在账号菜单 A／B 双向直接切换，无需重复输入密码；旧 Session API 失效。
3. Primary 给 D 导师授予 Delegated → D 可进中控。
4. D 直接调用授予接口 → 403 且审计存在。
5. Primary 撤销 D → D 下一次管理请求立即 403。
6. 在 Test 中以学员身份进入 → 只见本人卡／RP／钱包，黄色横幅持续存在。
7. 尝试 Production、Studio、Account 和另一 Classroom → 全部失败关闭。
8. 退出 B 后 A 仍可选择；退出此设备全部账号后旧 API 与浏览器后退均不能恢复访问。

自动化入口：`npm run test:course-platform`、`npm run test:course-platform:e2e`、`npm run test:t087:browser` 和 `npm run test:t106-t107:browser`。浏览器命令会先构建根路径版 minisv.app，避免误用 `/msv/` 兼容构建造成静态资源 404。
