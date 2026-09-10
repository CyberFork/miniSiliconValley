---
type: todo
id: T-087
title: "修复 Studio 导航并完善账号切换与受限 Admin DM 委派"
status: completed
created: 2026-09-09
updated: 2026-09-09
captured_by: project-inbox
depends_on:
  - T-085
supports:
  - T-086
tags:
  - todo
  - mini-silicon-valley
  - course-studio
  - navigation
  - authentication
  - account-switching
  - admin-dm
  - authorization
  - testing
---

# 修复 Studio 导航并完善账号切换与受限 Admin DM 委派

## 原始反馈

在生产页面 `https://minisv.vip/studio/` 实际测试时发现：

1. 左侧 `COURSE FACTORY` 中的“工作台、课程编辑器、多角色预览、导师课件库、测试与发布”等按钮点击后没有反应。
2. Studio 页面找不到明显的退出登录入口，无法方便地退出并切换账号。
3. 为了管理和调试，希望在右上角增加多账号管理和快速切换当前账号的能力。
4. Admin DM 权限应当能够授予任意一位导师，方便多人共同管理课堂；但被授予 Admin DM 的导师不能继续向其他人授予 Admin DM 权限。

本任务需要同时解决 Studio 基础可用性、全站账号入口、多账号调试与 Admin DM 非递归委派问题。

## 当前实现事实与缺口

### Studio 左侧导航

当前最新实现中，Studio 导航项已经拥有真实路径：

```text
/studio/
/studio/editor/
/studio/preview/
/studio/courseware/
/studio/releases/
```

源码使用 `<Link>` 与 `<a href>`，CSS 中未直接发现统一禁用点击的 `pointer-events:none`。因此不得未经验证就把问题归因为某一个前端事件；应针对生产构建继续检查：

- 链接上方是否存在透明覆盖层。
- 实际点击是否更新地址栏、但页面 section 没有重渲染。
- Client Navigation／hydration 是否异常。
- 浏览器 Console 是否出现运行错误。
- 点击后请求是否被登录跳转、缓存、Service Worker 或错误边界吞掉。
- 移动端与桌面端是否存在不同问题。

无论最终根因是什么，左侧导航都必须保留无 JavaScript 时也能工作的真实 `href` 兜底。

### 退出登录

- Classroom 与课堂实例顶部已有“退出”入口。
- Account Center 已有“退出当前账号”。
- Studio 右上角目前只显示当前姓名、平台角色和“进入课堂”，没有“账户中心、切换账号、退出登录”。

用户不应该为了退出 Studio 而先猜测进入 Classroom 或 Account Center。

### Admin DM 委派

当前权限实现将所有 `admin-dm` 当成同一级别：只要通过 `requireAdminDm`，即可调用 `grant-admin-dm` 和 `revoke-admin-dm`。这会导致被授予权限的导师继续向其他账号授权，与新的非递归委派规则不一致。

现有权限记录已经保留 `granted_by_profile_id`，但仍需引入明确的“是否可管理 Admin DM 授权”能力并在服务端强制校验。

## 一、修复 Studio 左侧导航

### 预期行为

每个导航项点击后必须同时满足：

- URL 进入对应路径。
- 页面主标题和 active 状态同步变化。
- 新页面开始加载时提供明确状态。
- 加载或 API 失败时显示可操作错误，而不是看起来“没有反应”。
- 浏览器刷新和复制链接直接打开时仍能进入同一页面。
- Ctrl/Cmd＋点击可在新标签页打开。
- 键盘 Tab 可聚焦，Enter 可进入，焦点轮廓清晰。

### 实施要求

- 所有左侧项目使用真实 `<a href>` 语义；可以保留框架 Link，但不得只有客户端事件。
- 不使用 `href="#"`、无 `onClick` 的 button 或只修改本地 section 状态的伪导航。
- 检查导航、内容区、顶部栏及 loading overlay 的 z-index、尺寸和 pointer events。
- 导航失败时显示错误状态并提供“重新加载当前页面”。
- 当前页面 active 状态必须来自实际 pathname／route section，而不是残留客户端状态。
- 对相同页面重复点击应允许刷新数据，或明确提供刷新入口。

### 生产问题记录

浏览器专项回执至少记录：

```text
App Build ID
登录账号与角色
浏览器／版本／视口
点击前 URL 与主标题
点击的导航文字、href 和 DOM role
点击后 URL、主标题和 active 状态
Console error
Network 请求与状态码
截图／录屏
```

## 二、建立全站统一账号菜单

### 位置

在所有需要登录的页面右上角统一显示账号菜单，至少包括：

- `/studio/*`
- `/classroom/*`
- `/account/*`
- 后续其他内部管理页面

### 菜单内容

```text
当前账号姓名
用户名
平台角色
当前 Classroom／席位（存在时）
────────────
账户中心
切换账号
退出登录
```

### 退出登录

- Studio 中必须直接可见，不要求先进入其他页面。
- 调用服务端登出端点，撤销当前会话，而不是只清理前端状态。
- 退出后回到登录页，并使用受控 `returnTo` 返回原页面。
- 防止开放重定向；`returnTo` 只能接受站内安全路径。
- 退出后，浏览器后退不能继续读取受保护 API 或缓存的账号数据。

## 三、多账号管理与安全切换

用户希望右上角可以快速切换账号，用于管理和调试。需要区分两种能力，不能把任意账号选择器直接等同于免密登录。

### 模式 A：普通切换账号

面向所有登录用户：

1. 点击“切换账号”。
2. 服务端退出当前会话。
3. 返回登录页并保留安全的当前 `returnTo`。
4. 用户使用另一个账号的用户名和密码登录。

要求：

- 不在服务端或前端保存其他账号的明文密码。
- 不把账号凭据写入 localStorage、URL、日志或审计正文。
- 可以记住最近使用过的用户名，但重新登录仍需凭据。

### 模式 B：平台管理员测试身份切换

为了快速验收 T-086，可为平台管理员提供受限的测试身份模拟，但必须满足：

- 只允许 `system/platform admin` 使用。
- 只允许进入 `environment=test` 的 Classroom 测试账号。
- 目标账号必须是该 Test Classroom 的导师、学员或受委派 Admin DM。
- 禁止模拟其他平台管理员。
- 禁止用模拟身份进入 Production Classroom。
- 禁止读取、导出或重置目标账号密码。
- 服务端签发短时效、可撤销的 impersonation session；不能通过前端修改 `userId`、URL 或 localStorage 假装切换。
- 页面持续显示醒目的调试横幅：

```text
正在以「Young Builder 2」测试
真实操作者：平台管理员 XXX
Test Classroom：TEST-...
[返回管理员身份]
```

- 每个 API 请求的授权上下文同时保留：

```text
actorProfileId       真实操作者
effectiveProfileId   当前测试身份
impersonationId      本次模拟会话
classroomId          允许访问的 Test Classroom
expiresAt            自动失效时间
```

- 所有切换、退出模拟、过期和越权尝试写入审计日志。
- 切换后清空或重新按 `actor + effective identity + permission version` 隔离客户端缓存，防止串读 Candidate、私密卡、钱包和课堂状态。

### 多账号管理入口

平台管理员右上角账号菜单增加“测试账号管理”：

- 按 Test Classroom 查看导师、学员和 Admin DM 账号。
- 显示账号状态、角色、Membership、首次改密状态和最后活动时间。
- 可以停用、重新生成一次性凭据或进入受限测试身份。
- 明文初始密码仍然只在创建／重新生成时显示一次。

同一浏览器 Cookie 会话中的“切换”表示替换当前有效身份，不代表能够在多个标签页同时保持多个身份。需要并发观察多个真实账号时，仍应使用不同浏览器 Profile／无痕上下文，或使用 Studio 的多角色只读视图。

## 四、Admin DM 非递归委派

### 产品规则

- Admin DM 是 Classroom 范围内的权限，不是第五位导师。
- 创建 Classroom 时指定的初始 Admin DM 是 `Primary/Root Admin DM`。
- Primary Admin DM 可以把本 Classroom 的 Admin DM 权限授予任意一个有效导师账号。
- 被授予权限的导师是 `Delegated Admin DM`。
- Delegated Admin DM 可以执行课堂管理工作，但不能继续授予或撤销其他人的 Admin DM 权限。
- 平台管理员不因全局角色自动获得所有 Classroom 数据访问；仅在创建、显式 Membership／权限或审计化恢复流程中操作。

### 建议能力拆分

不要只用一个平面的 `admin-dm` 布尔值判断全部操作，至少拆成：

```text
admin-dm             课堂运营管理能力
admin-dm-delegate    授予／撤销 Admin DM 的能力
```

权限矩阵：

```text
Primary Admin DM
  admin-dm          ✓
  admin-dm-delegate ✓

Delegated Admin DM
  admin-dm          ✓
  admin-dm-delegate ✗

普通 P/D/M/O 导师
  admin-dm          ✗
  admin-dm-delegate ✗
```

### Delegated Admin DM 允许执行

除权限委派外，按现有 Admin DM 业务能力管理本课堂：

- 打开实例中控并推进、退回、重试和验收 Block。
- 查看本课堂全员状态与提交。
- 管理开课前的导师／学员 Membership。
- 打开成员、锁定版本和投屏管理页面。
- 重置 Test Classroom。
- 在满足 T-086 条件时完成 Test Classroom UI 验收。

### Delegated Admin DM 禁止执行

- 向任何账号授予 Admin DM。
- 撤销其他账号的 Admin DM。
- 把自己升级为 Primary Admin DM 或增加委派能力。
- 修改授权来源、范围或有效期。
- 创建平台管理员、修改平台角色或跨 Classroom 操作。

如需要允许其主动放弃权限，应提供独立的“放弃我的 Admin DM”动作，并确保 Classroom 仍保留至少一个 Primary Admin DM。

### 数据与服务端约束

Admin DM 授权记录至少包含：

```text
classroomId
granteeProfileId
permission = admin-dm
delegationMode = primary | delegated
canDelegate = true | false
grantedByProfileId
grantedAt
revokedByProfileId
revokedAt
```

- ClassroomFactory 创建的初始 Admin DM 写入 `primary + canDelegate=true`。
- Primary 授予导师时只能生成 `delegated + canDelegate=false`。
- Delegated 调用 `grant-admin-dm` 或 `revoke-admin-dm` 时，服务端返回 403；不能只在 UI 隐藏按钮。
- 客户端不得提交或伪造 `canDelegate=true`；该值由服务端根据授权链产生。
- Primary 可以撤销 delegated 权限，但不得让 Classroom 失去最后一个 Primary。
- 同一个导师可以在多个 Classroom 分别拥有不同 DM 权限，权限不能跨实例继承。
- 授权、撤销、自愿放弃和被拒绝的越权尝试全部写入审计事件。

### UI 表达

成员页明确区分：

```text
张老师 · P 导师 · Primary Admin DM
李老师 · D 导师 · Delegated Admin DM
王老师 · M 导师
```

- Primary 看得到“授予 Admin DM”和“撤销 Admin DM”。
- Delegated 看不到或禁用这些操作，并显示“你可以管理课堂，但不能委派 Admin DM”。
- 普通导师看不到 Classroom 管理入口，除非另有对应权限。

## 五、失败关闭与安全规则

以下情况必须在服务端拒绝，并返回明确错误码：

- Delegated Admin DM 尝试授予或撤销 DM。
- 普通导师或学员尝试进入中控／成员管理。
- 客户端伪造授权者、Primary 标识或 `canDelegate`。
- 对其他 Classroom 发起成员或权限操作。
- 撤销最后一个 Primary Admin DM。
- 被撤销权限的旧会话继续调用 Admin DM API。
- 平台管理员测试身份尝试进入 Production。
- 通过账号切换访问未授权账号或 Classroom。
- 切换后仍读取前一账号的缓存、私密卡、钱包或 Candidate。
- 退出后旧页面继续读取受保护接口。

权限变更后必须更新权限版本或撤销相关会话，使结果立即生效，而不是等待浏览器刷新或 Cookie 自然过期。

## 六、测试矩阵

### Studio 导航

- 桌面和移动端逐个点击 00—04。
- 验证 URL、页面标题、active 状态和数据加载。
- 验证 Cmd/Ctrl＋点击、新标签页和刷新直达。
- 验证键盘 Tab、Enter 和焦点可见。
- 验证 hydration 失败、API 401／403／500 和断网时的反馈。
- 检查透明层、z-index、pointer events 和横向滚动区域。

### 退出与普通账号切换

- Studio 右上角可以直接退出。
- 退出后受保护 API 和历史页面不能继续访问数据。
- `returnTo` 只允许站内安全路径。
- 管理员→导师、导师→学员、学员→管理员重新登录。
- 切换后页面姓名、角色、Membership 和数据完全更新。
- 不保留前一账号的私密缓存。

### 测试身份切换

- 平台管理员切换到 Test 导师、Test 学员和 delegated DM。
- 非管理员不能看到或调用测试身份 API。
- 不能模拟平台管理员或 Production 成员。
- 调试横幅在所有受保护页面持续可见。
- 到期、主动退出和撤销后立即恢复真实管理员身份。
- 审计同时记录 actor 与 effective identity。

### Admin DM 委派

- Primary 给 P、D、M、O 任意导师授予 delegated DM。
- Delegated 可以正常管理课堂和中控。
- Delegated 的授予／撤销请求在 UI 和 API 均失败。
- 普通导师不能自升权。
- Primary 可以撤销 delegated DM。
- Delegated 权限撤销后立即失效。
- 同一导师在 Classroom A 有 DM、在 Classroom B 无 DM 时严格隔离。
- 并发授予、重复请求和撤销保持幂等。
- 永远至少保留一个 Primary Admin DM。

## 七、验收标准

- [x] `/studio/` 左侧 00—04 所有导航在真实生产登录态可点击。
- [x] 点击后 URL、页面标题、active 状态和数据内容同步更新。
- [x] 无 JavaScript 或客户端导航异常时，真实 href 仍可完成整页导航。
- [x] 桌面、移动端和键盘导航全部通过。
- [x] Studio 右上角始终能找到“账户中心、切换账号、退出登录”。
- [x] 退出后当前会话被服务端撤销，旧页面和 API 不再泄露数据。
- [x] 普通切换账号不保存或暴露其他账号密码。
- [x] 平台管理员可以在明确受限和审计的情况下切换 Test Classroom 测试身份。
- [x] 测试身份切换不能进入 Production、不能模拟平台管理员、不能绕过 Membership。
- [x] 切换账号后不存在课程、课件、手牌、钱包、提交或权限串读。
- [x] Primary Admin DM 可以给任意有效导师授予本课堂 delegated DM。
- [x] Delegated Admin DM 可以管理本课堂，但不能授予或撤销他人 DM。
- [x] 委派限制同时由 UI 和服务端 API 强制执行。
- [x] Classroom 始终保留至少一个 Primary Admin DM。
- [x] 所有账号切换、DM 授权、撤销和越权尝试均有完整审计。

## 八、与 T-085／T-086 的关系

- T-085 保持完成状态；本任务不改变单一 CourseDefinition、ClassroomFactory、单一状态机或 Test／Production 隔离。
- 本任务解决 T-085 上线后实际发现的 Studio 可操作性和权限问题。
- 本任务支撑 T-086 的人工验收：只有导航、退出、测试账号切换和 Admin DM 协作可用后，团队才能高效完成两级验收。
- 不新增第二套登录、账号真值、课堂状态机或 UI Preview 渲染器。

## 优先级

- **P0：阻塞 Course Studio 人工测试与 T-086 验收。**
- 建议先修复 Studio 导航和退出入口，再实现普通账号切换；受限测试身份切换和 Admin DM 能力拆分紧随其后。

## 完成与证据

- 实现提交：`69af64e43b80862e9f59b4f6b862da4fbf98c351`
- 生产 Release：`20260909T040321CST-t087-account-delegation-r1`
- 生产入口：`https://minisv.vip/studio/`
- 实施说明：`docs/TODO_087_IMPLEMENTATION.md`
- 操作 SOP：`docs/ACCOUNT_SWITCHING_AND_ADMIN_DM_SOP.md`
- 浏览器回执：`docs/qa/t087-account-navigation/browser-receipt.json`
- 生产回执：`docs/TODO_087_PRODUCTION_RECEIPT.json`
- 验证：全量 Release、隔离 D1/HTTP E2E、Chromium 桌面／手机视口、Hecate 健康检查、公网冒烟、生产登录／登出与数据库不变式全部通过。
- 回滚点：`20260909T010657CST-t086-two-stage-acceptance-r1`
