# T-106 多账号会话切换实施记录

## 结果

同一个浏览器现在可以保留最多 8 个已经验证的账号，并在账号列表中直接切换。系统始终只有一个当前身份；切换会在服务端重新校验目标账号并轮换 Session，而不是把多个有效身份交给前端自行选择。

## 数据与安全边界

- `auth_browser_sets`：浏览器账号集合、唯一当前身份、CAS version 与失效时间。
- `auth_browser_accounts`：最小身份关联、凭据版本、记住状态、过期／重验／移除状态。
- `auth_browser_session_links`：Session 与账号集合的服务端关联。
- `auth_browser_mutations`：切换、移除、退出的幂等记录。
- 数据库触发器验证 active user／active session 必须属于同一集合且仍然有效。
- 浏览器仅接收 `__Secure-msv_accounts` 和 `__Secure-msv_session` 两个 Secure、HttpOnly、SameSite=Lax Cookie；D1 只存集合令牌的 SHA-256 摘要。
- 密码、Session token、浏览器集合 token 均不进入 localStorage、URL、页面源码、日志或测试证据。
- 非记住登录有效期 12 小时，记住登录 30 天；失效账号的最小选择器元数据最多保留 90 天，必须重新验证后才能切入。

## 服务端契约

`GET /api/auth/accounts` 返回当前浏览器账号集合的最小投影。`POST /api/auth/accounts` 支持：

- `ensure`：把旧单 Session 安全升级为账号集合；
- `switch`：按 `expectedVersion + idempotencyKey` 原子切换；
- `remove`：只移除指定浏览器账号，不删除平台 Account；
- `logout-current`：退出当前账号，保留其他账号；
- `logout-all`：撤销整个集合及其关联 Session。

登录、注册、密码重置都会把新 Session 接入同一个集合。账号停用、改密、凭据重发或 Session 撤销会同步使目标账号不可切换。Test impersonation 与真实账号列表完全分离。

## 客户端行为

- 登录页先展示已登录账号；可切换账号免重复输入密码，过期账号显示“需要重新登录”。
- 全站账号菜单支持账号列表、添加、重验、移除、退出当前、退出全部和账户中心。
- `BroadcastChannel` 只广播“身份已变化”的无敏感通知；其他标签页重新向服务端取真值。
- 身份变化时旧页面内容先变为 inert，阻止旧身份继续提交；Studio 有未保存草稿时要求明确确认，恢复原身份不会丢失草稿标记。
- 目标账号无权访问原页面时使用角色安全落点，例如 learner 从 Studio 切换后进入课堂中心并看到解释。

## 验证

```bash
npm run typecheck
npm run lint
npm run test:course-platform
npm run build:minisv-app
npm run test:t106-t107:browser
```

隔离 Chromium 证据：`docs/qa/t106-t107-accounts/browser-automated-evidence.json`。覆盖 A↔B、失败添加、过期／改密、最终账号移除、退出全部、浏览器后退、多标签、未保存草稿、四个受保护产品面和匿名隔离；不接触生产账号。
