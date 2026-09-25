# T-087 实施记录：Studio 导航、账号切换与非递归 Admin DM

> 实施日期：2026-09-09  
> 依赖：T-085 单一课程工厂、T-086 两级验收门  
> 目标：让 Studio 可操作、账号身份可解释、测试切换受限可审计、课堂委派不递归。

## 1. 最终产品闭环

```text
真实 href 的 Studio 00—04
  + 全站统一账号菜单
  + 服务端 Session 切换／退出
  + Test-only actor/effective 身份模拟
  + Primary → Delegated 非递归课堂委派
```

Studio 路由的 active 状态由实际 section 产生。首次 HTML 就显示当前路由标题和加载状态；API 失败提供可操作重试，不再表现为“点了没反应”。编辑器仍保留既有完整直改工作台，只在右上角嵌入同一个账号菜单。

课堂验收构建已推进为 `minisv-t087-v1`；T-086 旧 UI 回执仍保留审计记录，但不会为采用新身份／权限表面的 Production 创建继续开门。

## 2. 数据迁移

`drizzle/0006_account_switching_and_admin_dm_delegation.sql` 新增：

- `classroom_admin_dm_grants`：`primary | delegated`、服务端 `can_delegate`、授权／撤销来源与版本。
- `auth_impersonations`：绑定真实 Session、actor、effective、Test Classroom、到期／撤销原因。

迁移先把每间统一 Classroom 的 `rooms.dm_profile_id` 回填为唯一 Primary，再把其他旧平面权限回填为 Delegated。`INSERT OR IGNORE`、每课堂单一 active Primary 的数据库唯一索引以及 room/profile 唯一索引共同保证重复 bootstrap 不复活已撤销授权，也不能产生第二个 Primary。`classroom_permissions` 只保留为可回滚镜像；所有新授权判断读取新表。

## 3. 服务端边界

- 当时的普通切换与退出调用 `/api/auth/logout`；该历史方案已由 T-106 的服务端浏览器账号集合取代。现行行为见 `TODO_106_IMPLEMENTATION.md`，直接切换不会先退出其他已验证账号。
- `POST/DELETE /api/auth/impersonation` 只接受真实平台管理员、明确 Test Classroom 与有效非管理员目标；最长 30 分钟。
- 每次请求重新验证 actor、目标状态、Test 环境、Membership／DM 范围和到期时间；不信任 URL/localStorage 身份。
- 模拟只允许绑定课堂，Studio、Account、Factory、旧 Classroom 与 Production 均失败关闭。
- API 审计同时保存 actor/effective/impersonation/classroom，权限撤销、停用和凭据重发立即关闭相关模拟。
- Primary 才能授予／撤销；Delegated 仍可运行中控、成员、reset 和 UI 验收，但无法递归授权。

## 4. UI 实现

- Studio、完整课程编辑器、Classroom Hub、Classroom Runtime、导师 Courseware 与 Account Center 使用 `AccountMenu`；脱敏共同投屏故意不显示私人账号控件。
- 菜单显示姓名、用户名、平台角色与课堂／席位；提供账户中心、测试账号管理（符合条件时）、切换账号和退出。
- 模拟时持续显示黄色 actor → effective 横幅、剩余时间和返回按钮。
- 成员页明确显示 `PRIMARY · 可委派`／`DELEGATED · 不可转授`。
- 只有 Primary 显示授权／撤销动作；Delegated 显示独立“退出本课堂 Admin DM”。
- Test 身份面板显示状态、角色、Membership、首次改密、最近活动；可模拟、停用／启用和重发一次性凭据。

## 5. 验证覆盖

- 源码契约：Studio 真实链接、账号菜单不存凭据、Test 模拟范围、非递归委派、一次性凭据。
- HTTP + 隔离 D1 E2E：导航直达、Session 切换、Primary／Delegated、跨课堂隔离、模拟导师／学员／Delegated、Production／Studio／Account 拒绝、停用和凭据重发。
- 浏览器：鼠标、键盘 Enter、Cmd/Ctrl 新标签、桌面／手机视口、账号菜单、服务端登出、Console 和资源失败。
- 迁移：生成 bootstrap 与 SQL 表、索引和冲突安全 backfill 完全同步，重复执行安全。

浏览器专项入口为 `npm run test:t087:browser`；它固定先生成 `MSV_PUBLIC_BASE=/` 的生产同构构建，再执行隔离 D1 与 Chromium 验收，并保存结构化回执和登录态／登出态截图。

详细操作见 [ACCOUNT_SWITCHING_AND_ADMIN_DM_SOP.md](ACCOUNT_SWITCHING_AND_ADMIN_DM_SOP.md)，最终 release 与生产证据写入 `TODO_087_PRODUCTION_RECEIPT.json`。
