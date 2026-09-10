> 历史／已退休（T-105）：本文仅供历史追溯，不是当前运行规范。旧 `/api/classroom/*` 已退休并返回 410；请以 [COURSE_PLATFORM_ARCHITECTURE.md](COURSE_PLATFORM_ARCHITECTURE.md) 和 `/api/platform/classrooms` 现行架构为准。

# Young Builder 协作课堂架构

> 本文描述当前 `mini_silicon_valley_world` 工作区中的实现，而不是产品路线图。课堂服务是原有历史世界之上的独立受保护入口；凡本文标为“审计注意”的内容，表示代码当前行为或边界，不代表已实现额外能力。

## 1. 系统边界与运行时拓扑

### 1.1 边界

- **既有历史世界**：`/` 继续提供地图、时间轴和原有历史关卡；`/123456` 提供课程框架。这两处仍以 TypeScript 静态数据和浏览器状态为主，不读取课堂房间。
- **Young Builder 课堂**：`/classroom` 是服务端动态页面。它使用平台登录身份进入注册表中的课件战役；当前包含 Google 1995–2004 五章连续战役与饿了么 2008 五章完整闭环（首章“找真问题”）战役。房间、成员、私密发牌、情报网、攻坚、成长和审计状态进入 D1。
- **权威状态**：课堂的房间状态、权限、账本和作品记录均以服务端 D1 为准。浏览器只保存 React 视图、轮询版本和临时表单状态；当前实现没有用 `localStorage` 冒充多人状态，也没有离线写入队列。
- **内容边界**：战役章节、案例身份、信息卡、挑战、压力、资产、来源和 Demo Day 是 `app/data/*-classroom-campaign.ts` 的静态内容，由 `app/data/classroom-campaigns.ts` 统一注册，不在 D1 中重复建 `chapters` 或 `cards` 表。D1 的 `rooms.campaign_id` 和 `chapter_id` 保存内容引用；store 每次按房间解析对应战役，旧房间不会因新增课件改变。
- **谜底边界**：可选的 `campaign.learnerSeal` 定义揭晓前的学员标题、组织、摘要和房间名。服务端在加入响应、Dashboard、房间 DTO 与审计详情上统一投影；DM 始终看到原文，学员只有在 `history_revealed=1` 后才看到真实名称。不能只靠 CSS 隐藏答案。

运行时请求链如下：

```text
浏览器 /msv/demo/app/classroom
    │  HttpOnly 应用会话；Nginx 剥离前缀并清空伪造身份头
    ▼
Work Nginx → 127.0.0.1:18787
    │  页面服务端以 cookie 摘要查询 D1 会话与账号
    ▼
app/classroom/page.tsx ── 已认证：ClassroomApp
    ▼
/api/classroom/*
    │  withClassroomApi：读取身份 → 获取 DB → 确保 D1 schema → 调用 store
    ▼
app/lib/classroom-store.ts
    │  membership/DM/team/phase 校验 + 参数化 D1 查询 + 审计
    ▼
本机持久 D1／SQLite（release 外 `data/`；逻辑绑定仍为 DB）
```

### 1.2 Worker 与托管绑定

- `worker/index.ts` 声明 `Env.DB: D1Database`、`ASSETS` 和 `IMAGES`。除 `/_vinext/image` 外，请求交给 Vinext App Router handler；课堂 API 没有在 Worker 中另写一套鉴权或内存状态。
- `.openai/hosting.json` 将逻辑 D1 绑定名配置为 `"d1": "DB"`，并保留兼容 Sites 构建所需的 `project_id`；文件不保存凭据。Work 的 Wrangler/workerd 运行时把同一逻辑绑定持久到 `~/Services/msv-classroom/data`。`getClassroomDb()` 在缺少 `env.DB` 时直接报错。
- Worker 进程/隔离实例可以是无状态的；D1 才是跨设备和跨实例的持久化边界。运行时的 `schemaReady` 只用于避免同一实例重复初始化，不是课堂数据缓存。

## 2. 路由与请求生命周期

### 2.1 页面与 API 路由

- `GET /classroom`：`app/classroom/page.tsx`。页面是 `force-dynamic`；Work 未登录时安全回跳 `/auth/login`，已登录时渲染 `ClassroomApp`。
- `/auth/login`、`/auth/register`、`/auth/recover`、`/auth/reset`、`/account`：密码登录、开放注册、找回说明、单次链接重置、设备与导师密码协助UI；认证API位于`/api/auth/*`。
- `GET /api/classroom/bootstrap`：读取当前平台用户的个人概览和其 active memberships 所在房间。不带 room ID，因此不能读取陌生房间。
- `POST /api/classroom/rooms`：创建房间。请求体为 JSON `{ title, campaignId? }`；缺少 `campaignId` 时为兼容旧客户端默认 Google。服务端只接受注册表中的战役，创建者成为 DM，并创建首个四席团队、团队金库和初始融资流水。
- `POST /api/classroom/join`：请求体为JSON`{ teamPublicId }`；只创建／恢复pending申请，不创建membership或授予房间读取权限。
- `GET /api/classroom/rooms/[roomId]/learners?q=...`：只允许该房间DM按用户名／昵称搜索active learner，供直接添加。
- `GET /api/classroom/rooms/[roomId]`：读取房间投影；DM 可用 `?team=<teamId>` 选择观察团队，学员只能看到自己团队。
- `POST /api/classroom/rooms/[roomId]/actions`：所有课堂写操作的唯一入口。操作由 `parseClassroomAction` 做 JSON、枚举、长度、标识符和金额格式校验，再交给 `applyClassroomAction`。
- `GET /api/classroom/rooms/[roomId]/export`：只允许该房间 DM 导出 JSON 课堂档案；不是浏览器恢复/导入接口。

所有 API 路由都声明 `dynamic = "force-dynamic"`。`withClassroomApi` 的统一生命周期是：

1. `getChatGPTUser()` 按运行模式读取 Sites 平台身份或 Work D1 会话；无身份返回 `401 AUTH_REQUIRED`。
2. `getClassroomDb()` 取得 `DB` 绑定。
3. `ensureClassroomSchema(db)` 在首次使用时幂等初始化课堂表。
4. 调用 store；`ClassroomError` 转成 `{ ok: false, error: { code, message, details? } }`，未知异常只向客户端返回通用 `500 INTERNAL_ERROR`，详细错误写服务端日志。
5. 成功统一返回 `{ ok: true, data }`。

响应设置 `Cache-Control: no-store, private`、`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` 和 `X-Content-Type-Options: nosniff`。请求体必须声明 `application/json`；解析失败或类型不符分别返回 `JSON_REQUIRED` / `INVALID_JSON` 等错误。

## 3. Work／Sites 认证、RBAC与课堂membership分离

### 3.1 平台身份

正式Work运行时使用D1第一方账户：学员开放注册、用户名＋密码登录、设备会话和DM签发的一次性重置URL。密码使用PBKDF2-HMAC-SHA256摘要；会话和重置token只存摘要。浏览器只有路径限定的`HttpOnly; Secure; SameSite=Lax`不透明cookie，不把token写进Web Storage。公开注册固定创建`learner`；`admin/mentor`只从代码或后台配置。

Worker 只监听回环地址；Nginx 清空 `Authorization` 和旧 `x-msv-authenticated-*` 头，不能从公网自报身份。现有六个团队账号在迁移时保持稳定 ID，既有课堂 memberships 与档案连续。

兼容 Sites 构建仍可读取以下平台请求头：

- `oai-authenticated-user-id`：平台用户稳定 ID；课堂 `profiles.id` 使用它作为服务端账户键。
- `oai-authenticated-user-email`：必须存在才认为请求已登录，但不会写入课堂数据库或导出档案。
- `oai-authenticated-user-full-name` 与 `oai-authenticated-user-full-name-encoding`：可选的 percent-encoded 昵称来源；解码失败时回退到 email。

Sites 兼容构建仍使用平台身份头；Work 使用 `/auth/login` 与服务端撤销式退出。两条运行模式共享课堂 store，但 Work 的账号管理能力只依赖自身 D1，不依赖 ChatGPT。

正式认证边界是 Work Nginx＋仅回环 Worker＋D1 会话。线上脚本必须先调用真实登录 API取得 cookie，不能把开发头当成生产证明。账户完整流程见 [`AUTHENTICATION.md`](./AUTHENTICATION.md)。

### 3.2 队伍ID、申请与授权

`TEAM-XXXXXXXX`是公开定位符，不是身份或能力令牌：

- 创建房间或新建队伍时，`crypto.getRandomValues`从非歧义字符集生成8位后缀；`team_access_ids.public_id`唯一。
- `parseJoinRoom`归一化大写后只接受`TEAM-[A-Z2-9]{8}`。
- 学员提交后写入`team_join_requests`的pending状态；pending用户读取房间仍由`requireMembership`返回403。
- DM在集结阶段批准后才以原子batch分配空席并建立active membership；拒绝不授权。每房间最多24名学员，每队默认四席，并发审批依靠唯一席位索引和有界重试保持唯一。
- DM可按用户名／昵称搜索learner后直接添加、移出成员或创建新队伍；移出立即撤销房间访问，历史审计保留。
- `rooms.code`只为旧schema兼容保留；新房间写入非公开internal key，API、UI与导出均不返回该字段。

因此，**应用账户回答“你是谁”，队伍ID回答“你申请哪支队伍”，active membership回答“你是否已经获准访问”**。

### 3.3 课堂创建者、授课导师与学员队伍

课程主持关系不复用学员入队流程：

```text
平台角色 admin/mentor
        │ 创建课堂，或由负责人按准确用户名指派
        ▼
课堂 membership.role = dm，team_id = NULL
        │ 主持阶段、发牌、裁决、成员管理与导出
        ├──────────────────────────────────────┐
        ▼                                      ▼
Alpha Team：4个 learner 席位              Beta Team：4个 learner 席位
P / D / M / O                              P / D / M / O
```

- 创建课堂者同时写入 `rooms.dm_profile_id` 和首个 active `dm` membership，是不可从该课堂移除的最终负责人。
- 课堂创建者或平台 `admin` 可提交 `assign-facilitator { username }`，服务端只接受 active `mentor/admin` 账号；不存在、普通学员、停用账号和已有学员历史均拒绝。
- 被指派导师获得额外 active `dm` membership，登录后的 bootstrap 自动返回这场课堂；无需队伍ID、无需申请审批，也不占 `seat`。
- 被指派导师可主持课堂，但只有创建者或平台 `admin` 能增删授课导师。`remove-facilitator` 立即撤销该房间访问，审计历史保留。
- 每课堂最多8位 active DM，避免误操作无限扩权；所有指派和移除均通过同源、会话、membership、RBAC和审计层。

所以三种关系必须分别理解：**创建者负责课程归属，授课导师负责DM主持，学员membership负责团队席位。**

## 4. D1 28表数据模型

课堂初始迁移包含18张业务表；认证迁移包含8张表（现行`auth_users`、`auth_sessions`、`auth_reset_tokens`、`auth_rate_limits`、`auth_security_events`，以及仅为无损升级保留但已全量失效的3张旧凭据表）；成员收敛迁移增加`team_access_ids`与`team_join_requests`。课堂内容本身仍来自静态campaign。

### 4.1 身份、房间与编组（6张）

- `profiles`：平台用户 ID、课堂昵称和时间戳。没有 email、full name 或认证 token 字段。
- `rooms`：内部兼容键、标题、`campaign_id`、当前`chapter_id`、13阶段`phase`、active/archived状态、DM profile、单调`version`、暂停/计时、玩家世界线冻结和史实揭晓标记。
- `teams`：房间内团队、名称和 `seat_limit`，默认四席。
- `team_access_ids`：每队唯一的公开`TEAM-XXXXXXXX`定位符。
- `team_join_requests`：队伍、申请profile、pending/approved/rejected、裁决人和时间。
- `memberships`：房间成员关系；保存 profile、team、`dm`/`learner` 角色、座位、章节案例身份、当前 PDMO、支撑承诺、active 状态和最后在线时间。它与长期 `profiles` 分离。

### 4.2 发牌与情报网（3 张）

- `card_grants`：每章向某成员发出的卡；带 team、`unread/read/published` 状态、发牌和公开时间。唯一索引防止同队同章同卡重复发放。
- `intelligence_nodes`：团队自行发布的用户/人物、需求、事件、技术、约束或证据节点；来源卡 ID 以 JSON 保存。
- `intelligence_edges`：同队节点之间的 `causes/supports/limits/contradicts/hypothesis` 关系和解释。

### 4.3 攻坚行动（2 张）

- `challenge_runs`：团队在当前章节选定的一项 L1/L2/L3 挑战、压力骰面、当前轮次、状态、后果、量规和结算 JSON；同队同章唯一。
- `challenge_actions`：每名成员每轮的 PDMO、目标、方法、依据、资源、成功信号和停止条件；同一 run/round/member 唯一，第二轮必须与第一轮有改动。

### 4.4 成长与团队经营（5 张）

- `reputation_entries`：个人 RP 的逐项证据流水；按房间、章节、profile、维度和作品证据去重，支持冲正引用。
- `team_assets`：团队已购资产、购入价、启用状态、购入时间和最后维护章节。
- `purchase_proposals`：团队资产购买提案、发起成员、状态和幂等键。
- `purchase_votes`：每个提案每位成员一票；重复投票是同一行 upsert，不会增加票数。
- `gratitude_votes`：成长盘的有理由协作感谢；同一房间/章节/发送者唯一，只能感谢同队其他成员。

### 4.5 三账户账本（2 张）

- `ledger_accounts`：`team-treasury` 团队金库和 `personal-wallet` 个人钱包。个人钱包 `room_id` 为空，以 profile 归属；余额为 tenths 整数并受非负 CHECK 约束。
- `ledger_transactions`：来源/去向账户、金额、分类、章节、来源对象、执行成员、幂等键、原因、时间和 `reversal_of`。幂等键、房间/分类/来源对象和冲正目标都有唯一性约束，便于审计重放。

### 4.6 玩家世界线与审计（2 张）

- `worldline_entries`：团队决定、个人工具和个人反思等玩家轨迹；可绑定 team/member，冻结时间单独保存。
- `audit_events`：所有重要控制、发牌、公开、阶段、经济、揭晓和归档动作；保留 actor profile、目标、结构化详情和时间。

20张课堂／成员表合计：`6 + 3 + 2 + 5 + 2 + 2 = 20`。另有8张认证／认证迁移兼容表，共28张。静态章节中的`identities/infoCards/challenges/pressureEvents/historyReveal/realityMission`不在D1复制；运行时通过room当前章节ID从campaign查回。

## 5. 服务端权限与投影

### 5.1 写入前的统一检查

`applyClassroomAction` 对每次操作先执行 `requireMembership(db, roomId, user.userId)`。之后按操作再执行：

- `requireDm`：成员审批／直加／移出／建队、阶段推进、计时、暂停、发/撤卡、选挑战、投压力、公开结算、记RP、分配利润、融资、冲正、揭晓、推进章节和归档等DM操作。
- `requireLearner`：读/发布自己的卡、情报节点/关系、PDMO、行动、感谢、资产提案/投票、个人工具、返投和反思。
- `requireTeamAccess`：冻结指定团队世界线时，只有 DM 或该 team 的成员可操作。
- 所有 team、proposal、challenge、node、card grant 查询都会把 `room_id`/`team_id` 与当前成员关系绑定，避免只相信客户端传来的 ID。
- 归档房间禁止继续修改，唯一保留 `set-nickname`；暂停时学员的所有写操作被拒绝，DM仍可恢复课堂。

输入层 `app/lib/classroom-validation.ts` 另外限制字符串长度、控制字符、枚举、正整数、`idempotencyKey` 格式和允许的 JSON 数组长度。服务端不接受客户端直接提交余额、RP、身份或权限结果。

### 5.2 `getClassroomRoom` 的最小投影

同一个 room API 根据 viewer 角色和 team 生成不同 DTO，而不是把 D1 行原样返回：

- **公共章节**：返回章节标题、阶段、边界、挑战、压力、现实任务和 DM 指南，但移除完整 `identities`、`infoCards` 与 `historyReveal`；身份只投影 `id/name/nature/publicGoal`，卡片数量只投影 `infoCardCount`。学生投影视图进一步隐藏 DM 指南、未抽中挑战和原始复杂卡文案。
- **学员身份与手牌**：`holderIdentityId` 仅是内容编写来源/叙事参考，不是发牌归属；身份与信息卡分别独立随机。`myIdentity` 只由当前 membership 的 `case_identity_id` 查回；`myCards` 只由当前 membership 的 `card_grants` 查回，卡片状态仍是 unread/read/published。
- **DM 密封内容**：仅 DM 获得 `dmSecrets`，包括本章全部 identities、全部卡、所有发牌映射和完整 history reveal。
- **已发布情报**：只返回当前团队已发布的卡；情报节点和边按当前团队过滤。DM 可以用 `?team=` 观察某队，普通学员的 focus team 强制为自己的队。
- **成员资料**：昵称、角色、team、座位、案例身份、PDMO 和 RP 可按课堂投影；其他学员的钱包返回 `null`，DM 或本人才能看到钱包金额。
- **RP 证据**：DM 查看选定团队的本章证据，学员只查看自己的本章证据；RP 总额按 profile 的流水求和。
- **世界线**：DM 可看房间内全部条目；学员按个人隐私投影只看到本团队的 `problem-statement`/`team-decision`/`demo-day` 条目，以及 `member_id` 属于自己的条目（包括 `personal-item`/`reflection`）；他队团队条目和其他成员的个人条目不返回。审计事件只投影给 DM。
- **目录**：资产、个人工具、声望解锁和 Demo Day 作为 catalog 返回；来源目录对 DM 始终返回，普通学员在 `history_revealed = false` 时收到空 `sources`，只有玩家决定冻结且 DM 揭晓史实后才收到来源标题和链接。

这套投影保护的是“未发布卡、未分配卡、DM密封内容、他队运行数据和其他成员个人世界线”。来源 catalog 的揭晓前泄漏已由服务端空目录投影消除：DM 可在揭晓前看到来源，学员要等 `history_revealed` 才能看到。来源 URL 一旦投影仍可打开外部网页；这不是对外部来源网站的网络级封锁。

## 6. 13 阶段状态机

`CLASSROOM_PHASES` 的唯一顺序如下：

```text
01 lobby
02 identity
03 private-read
04 intel-brief
05 intel-network
06 dm-gate
07 pdmo
08 challenge-one
09 challenge-two
10 growth
11 history
12 debrief
13 completed
```

DM 的 `move-phase` 使用 `getAdjacentPhase`，前进/后退都被夹在首尾，不能越出数组。前进时 `assertPhaseGate` 按当前阶段执行以下证据门：

1. **lobby → identity**：至少 4 名学员；本章每名学员 3 张卡已经发放。
2. **identity → private-read**：所有 active 学员都已获得案例身份。
3. **private-read → intel-brief**：当前章所有卡都不再是 `unread`。
4. **intel-brief → intel-network**：每名学员至少公开 1 张卡。
5. **intel-network → dm-gate**：每个团队至少 2 个有来源节点、一个 person/user 节点、一个 constraint 节点和一条 contradicts/limits 关系。
6. **dm-gate → pdmo**：每个团队必须有一条持久化的 `problem-statement` 世界线作品；`submit-problem-statement` 写入用户、场景损失、证据摘要、不确定点和本轮决策问题后，DM 才能推进。
7. **pdmo → challenge-one**：PDMO不是阶段门。入门团队可不分岗直接进入挑战；如已使用进阶 P/D/M/O，则角色唯一性与支撑承诺继续持久化。
8. **challenge-one → challenge-two**：每个团队的第一轮 challenge action 数量等于 active 学员数；移动时将 run 的 `round` 更新为 2。
9. **challenge-two → growth**：所有团队都有 challenge run，且每个 run 都已由 DM 公开结算；结算前还要求每名学员提交第二轮行动。
10. **growth → history**：没有额外 `assertPhaseGate`；团队应在成长盘完成资金、资产和 RP 工作。
11. **history → debrief**：只有 `rooms.history_revealed` 为真时才允许前进。
12. **debrief → 下一章/完成战役**：通用 `move-phase` 被拒绝，必须使用 `next-chapter`；该入口强制每名学员提交反思并结算维护。最后一章还要求每个团队提交七段式 Demo Day 团队作品。
13. **completed**：`getAdjacentPhase` 不再前进；`next-chapter` 在最后一章完成 Demo Day 门后将房间保持为 `completed` 并记录 `campaign.complete`。

章节推进不是简单改阶段：`next-chapter` 只接受 `debrief`/`completed`，检查本章每名学员的 reflection，逐队结算资产维护；有下一章时清空案例身份/PDMO/承诺、重置 freeze/reveal 并进入下一章 `lobby`；最后一章还按团队检查 `demo-day` 作品，缺任一团队即拒绝完成战役。

### 6.1 各动作的阶段范围

- 身份发牌：`lobby`/`identity`；卡片撤回/补发也只在这两段。
- 卡片读/发布：`identity`、`private-read`、`intel-brief`、`intel-network`、`dm-gate`。
- 情报节点和关系：`intel-brief`、`intel-network`、`dm-gate`；节点来源卡必须是团队已发布卡，关系两端必须是同队节点，节点和关系都由服务端检查当前阶段。
- 问题陈述：`submit-problem-statement` 仅在 `dm-gate` 写入/更新本团队的持久作品；阶段门按团队计数，不能靠客户端状态跳过。
- PDMO：`pdmo`、`challenge-one`、`challenge-two` 中可选；同队同一角色不能被两人占用，服务端先查占用，数据库唯一索引竞态会转成 `PDMO_OCCUPIED` 409。未认领的学员仍可提交挑战行动，服务端在行动审计中以 `TEAM` 和 `collaborationMode=team` 记录，不伪造P/D/M/O。
- 挑战选择/压力：DM 只在 `challenge-one` 操作；行动在两轮攻坚阶段提交。
- 结算：DM 只在 `challenge-two` 评分，量规为 evidence/logic/execution/collaboration 四项 0/1。
- RP、感谢、分润、购买、个人工具、融资和资产维护：主要发生在 `growth`；RP 也允许 `debrief` 结算。
- 世界线：团队在 `growth`/`history` 冻结；DM 进入 `history` 且所有团队冻结后才可揭晓；反思要求已揭晓历史。`submit-demo-day` 仅在最终章节 `debrief` 写入七段式作品，完成门按团队计数。
- 实体纸账本补录：DM 可通过 `record-paper-ledger` 补录受限收入/支出；类别、方向、正整数金额、团队归属、幂等键和账本余额都由服务端校验并批量写入。

审计注意：情报节点与边现在都在服务端检查允许阶段和同队约束；前端入口不是安全边界。`debrief` 的通用 `move-phase` 不能绕过反思、维护或最终 Demo Day 门。通用 DM 后退仍不恢复或撤销已写入的业务数据，后退应视为主持控制而非数据库回滚。

## 7. 短轮询同步与并发边界

- `ClassroomApp` 打开房间后每 3 秒轮询一次 `GET /api/classroom/rooms/[roomId]`，仅在 `document.visibilityState === "visible"` 时刷新；浏览器 `online` 事件会立即刷新。
- 客户端保存上次 `room.version`，服务端每次主要 mutation 通过 `bumpRoomStatement` 将 `rooms.version` 加一。版本变化时客户端显示“已同步队友的最新进展”，不是通过 WebSocket 推送。
- 所有 GET 和客户端 `fetch` 使用 `cache: "no-store"`；页面顶部显示最近同步时间与 online/offline 状态。离线时保留当前已读画面，但没有本地权威写入，恢复网络后依靠重试/轮询读取 D1。
- 请求正在提交时前端以 `working` 防止同一页面重复点击；真正的重复请求保护仍由服务端幂等键、唯一索引、upsert 和结算重放判断承担。
- 加入房间的成员唯一索引和捕获并发插入后的再次查询，避免同一平台用户在竞态中出现两条 membership；座位碰撞会重新读取容量并最多重试 4 次，仍冲突时返回 `ROOM_JOIN_BUSY` 409。座位唯一索引防止同队同席位重复。
- PDMO 角色由应用预检查和 `uidx_memberships_team_pdmo` 双重约束；并发抢同一角色时统一返回 `PDMO_OCCUPIED` 409，而不是写入两个持有人。

当前没有 WebSocket、SSE、长轮询或客户端乐观余额。网络同步延迟最多约一个轮询周期，动作成功后客户端会主动再读一次。

## 8. 三账户、原子 batch 与账本不变量

### 8.1 账户语义

- **个人声望 RP**：不是货币。RP 来自 DM 依据作品写入 `reputation_entries`，按 evidence/modeling/delivery/support/iteration/responsibility 六维限制，并由 `calculateReputation` 计算解锁；不能消费、转账或换成 C。页面显示本章最多 12 RP 的教学节奏。
- **团队资金 C**：存于 `team-treasury`。创建房间和新团队各有 100 tenths（10 C）的初始融资流水；挑战收入进入团队金库，资产、维护和分配从金库扣除。
- **个人钱包 C**：存于 `personal-wallet`，ID 形如 `wallet:<profileId>`。只有团队公开利润分配进入钱包；学员可购买个人工具或把自己的钱包返投本队，不能直接给另一位玩家转账。

三者不能互换。个人钱包与团队金库的显示和授权不同；RP 仅由 reputation entries 求和，不进入账本。

### 8.2 收入与分配

- `resolveChallenge` 按四项公开量规计算：4 分为 `base + 2 C`，3 分为 base，2 分为 `max(0, base - 1 C)` 并要求后果，0–1 分为 0 C、获得洞察并要求后果；学习性失败不会终止剧情。
- `record-financing` 是外部融资，进入金库但分类为 `financing`；`getChapterEconomics` 不把它计入本章可分配收入。
- 本章经营先统计 `mission-contract/user-validation/asset-revenue` 收入，再扣 research/product/market/operations/maintenance 成本和已分配额；分配时额外保留 2 C 储备。
- `calculateProfitDistribution` 对可分配池使用 50% 平等劳动、30% 角色交付、20% 有理由协作感谢；使用整数 tenths 和最大余数分配，确保支出总额等于分配池。

### 8.3 原子性、幂等与冲正

- 购买、挑战收入、个人分配、融资、维护、返投、个人购买和冲正等资金操作把账户余额更新、`ledger_transactions` 插入、相关业务行和 audit 写入同一个 `db.batch(statements)`；D1 batch 失败时不会接受部分业务结果。
- `ledger_transactions.idempotency_key` 唯一；`sourceObjectId` 与分类/房间也有唯一索引。重试时 store 先查幂等键，已完成则返回 `replayed: true`；余额不足或非负 CHECK 失败映射为 `INSUFFICIENT_FUNDS` 等业务错误。
- 购买提案和投票使用提案/成员唯一键与 `ON CONFLICT`；挑战行动、反思和团队决定使用唯一业务行的 upsert。购买在过半数赞成后才以 batch 扣金库、插账本、写资产并接受提案；`team_assets(team_id, asset_id)` 唯一索引防重复成交，成交 batch 发生并发冲突时会再查幂等交易和现有资产，已成交即按重放处理，避免重复扣款/建资产。
- 实体纸账本补录由 DM 通过 `record-paper-ledger` 执行：收入只允许 `user-validation`/`asset-revenue`，支出只允许 `research`/`product`/`market`/`operations`/`maintenance`；正整数金额、团队归属、非负金库、幂等键和账本交易、审计记录在同一 batch 中完成。它是受限补录，不是任意导入或覆盖余额。
- 账本金额必须是正整数 tenths，来源和去向不能相同。错误交易不能删除或直接覆盖：DM 使用 `reverse-transaction`，系统写一笔 `correction`，反向更新账户并填充 `reversal_of`、幂等键和理由；同一原交易不能二次冲正。
- 资产在章节推进时结算维护；维护余额不足时 batch 不产生维护扣款，而将资产标为 inactive 并写审计，后续可见“暂停·维护不足”。

## 9. 玩家世界线与史实双轨隔离

- `worldline_entries.kind = team-decision` 保存团队的决定和 rationale；在 `growth`/`history` 由成员或 DM 冻结后不可覆盖。
- DM 只能在 `history` 且所有团队都有冻结记录时执行 `reveal-history`；这同时把 `rooms.player_timeline_frozen` 和 `rooms.history_revealed` 置为真。
- 学员在冻结前可看到自己的玩家写作区，但 `chapter.historyReveal` 为 `null`；冻结并揭晓后才得到 `happened/comparisonPrompts/sourceIds`。历史对照是比较提示，不参与历史相似度评分。
- `getClassroomRoom` 对世界线执行个人隐私投影：DM 看房间全部条目；学员只看本团队的 `problem-statement`/`team-decision`/`demo-day`，以及 `member_id` 属于自己的条目（例如自己的 `personal-item`/`reflection`）。其他团队和其他成员的个人条目不会随 room DTO 下发。
- `worldline_entries.kind = reflection` 保存每位学员六问答案和现实行动；`next-chapter` 要求本章 active learner 全部有 reflection。
- 最终章节的 `worldline_entries.kind = demo-day` 保存每个团队的七段式 Demo Day 标题、段落说明和 360 秒时长；最后一次 `next-chapter` 按团队检查该作品。
- 原始历史仍来自静态 campaign 的 `historyReveal` 与来源链接，不被玩家决定回写。玩家决定、挑战后果、个人工具和反思都是另一个轨道。

审计注意：DM 在任何阶段的 room 投影中可直接收到 `dmSecrets.historyReveal`，这是主持人密封信息；普通学员的 chapter reveal 在房间揭晓前为 `null`，且 `catalog.sources` 在揭晓前为空，避免来源标题/URL 提前泄漏。揭晓后学员可获得来源外链；服务端不负责阻断外部来源页面。

## 10. Schema 初始化与迁移来源

当前数据库来源链为：

```text
db/schema.ts（Drizzle SQLite schema）
        │ drizzle-kit generate（npm run db:generate）
        ▼
drizzle/0000_aromatic_mandroid.sql（当前唯一迁移，18张表）
        │ scripts/generate-schema-statements.ts
        ▼
db/schema-statements.ts（生成的 IF NOT EXISTS 语句）
        │ db/index.ts / ensureClassroomSchema
        ▼
每个 Worker 隔离实例首次课堂请求时 db.batch 初始化 D1
```

- `drizzle.config.ts` 指向 `db/schema.ts`、`drizzle/` 输出目录和 SQLite 方言；迁移元数据在 `drizzle/meta/`。
- `scripts/generate-schema-statements.ts` 读取 `drizzle/*.sql`，按 statement breakpoint 拆分，将 `CREATE TABLE/INDEX` 改成 `IF NOT EXISTS` 后写入 `db/schema-statements.ts`。该文件头明确标记为 generated，不应手工编辑。
- `db/index.ts` 的 `ensureClassroomSchema` 用模块级 `schemaReady: Promise<void> | null` 合并同一 Worker 实例的并发初始化；`initializeSchema` 将生成的语句全部交给一次 D1 `batch`。初始化失败会清空 promise，下一请求可以重试。
- 运行时DDL均使用`IF NOT EXISTS`；旧凭据退役使用带`IS NULL`条件的幂等UPDATE。当前没有另一套手写D1列补丁。新增／变更字段应先改变Drizzle schema、生成迁移，再重新生成运行时语句。

## 11. 导出与隐私

`GET /api/classroom/rooms/[roomId]/export` 先要求 active membership，再 `requireDm`；它导出 campaign 内容、房间阶段快照、团队、成员课堂字段、发牌、情报、挑战、RP、三账户余额、账本交易、资产、购买投票、感谢、世界线和全部 audit。

导出时的隐私处理：

- room DTO 和成员导出都只使用课堂昵称、membership ID、team/seat/角色和时间；`profile_id`/平台 user ID 从不下发给客户端，也不导出；email 或 full name 同样不写入档案。
- 账户别名改写为 `team:<teamId>:treasury` 或 `member:<membershipId>:wallet`；交易执行者改成昵称。
- audit的`profile` target改写成membership ID，找不到对应成员时写`profile:redacted`，actor改成昵称；detail中的任意profile ID也递归改写为对应membership ID。其他内部课堂ID保留用于审计关联。
- 返回 `privacy` 声明：档案不包含邮箱、真实姓名或平台用户 ID，只含课堂昵称和课堂内成员 ID。
- 导出调用不把 JSON 写回浏览器存储，也没有对应的导入/恢复 API；它是 DM 的审计/教研归档。D1 故障后的数据恢复依赖托管数据库备份与该导出留档，不能把“导出”描述为自动恢复功能。

## 12. 安全威胁、控制与残余边界

- **未登录或伪造页面入口**：课堂页与每个 API 都服务端读取 D1 会话；无有效、未撤销、未过期会话返回 401。Worker 仅监听回环，Nginx 清空旧身份头与 `Authorization`。
- **凭据泄漏与离线破解**：密码采用独立salt的PBKDF2摘要；会话／重置token只存摘要；cookie为HttpOnly/Secure，不写浏览器存储或日志。重置URL使用fragment且页面立即清除地址栏。
- **账号枚举与暴力尝试**：登录对未知账号使用统一错误；登录、注册和重置分别限流，Nginx对认证API二次粗限流。
- **越权读陌生房间**：房间GET、写操作和导出均先查active membership；非成员得到403，pending申请本身不授权。
- **DM/学员权限混淆**：高影响控制调用 `requireDm`；学员操作调用 `requireLearner` 和 team 约束。客户端隐藏按钮不是安全边界，服务端会重复检查。
- **私密卡泄漏**：`myCards` 按 member grant 过滤；未发布卡不进入团队 published pool；DM 才得 `dmSecrets`。来源目录在揭晓前对学员为空，DM 可见全部密封内容；揭晓后学员可访问已投影的来源外链，服务端不阻断外部网页。
- **跨队情报或资金写入**：节点边必须连接同队节点，挑战/购买/感谢/返投均校验 team；账户余额由服务端查询和 D1 CHECK 维护，不接受客户端余额。
- **重复请求、双扣和并发**：交易幂等键、source/category 唯一索引、提案/投票/成员唯一索引、D1 batch 和重放返回保护关键路径。资产成交还依靠 `team_assets` 唯一索引；并发成交 batch 失败后复查幂等交易和已有资产，已存在即按已完成处理。投票统计与成交仍是分开的查询/batch，D1 没有应用层串行锁；竞态下客户端可能收到重放或业务冲突，需刷新确认最终投影。
- **账本篡改**：交易只追加；原交易不能删除，冲正要求 DM、原因、反向账户更新和 `reversal_of`，冲正本身不能再次冲正。
- **SQL/标识符注入**：业务 SQL 使用 `prepare().bind()`；导出动态表名通过固定 allowlist；输入验证限制 ID 正则、枚举、文本控制字符和长度。
- **脚本/响应注入**：API 返回 `nosniff` 和严格默认 CSP；React 将成员提交文本作为文本渲染而非 HTML。外部来源链接是静态 catalog URL，并以新窗口/noreferrer 打开。
- **开放重定向**：登录/退出回跳只允许安全相对路径，并拒绝保留认证路径。
- **队伍ID泄漏／资源滥用**：队伍ID即使公开也只创建pending申请；每账号待审批上限、active房间／lobby检查、队伍容量和24名学员上限共同约束，只有DM裁决才创建membership。
- **史实提前读取**：服务端在揭晓前不给普通学员 `historyReveal`，并把 `catalog.sources` 设为空；DM 仍可预先看到密封史实和来源。揭晓后来源外链可被学员访问，这是内容投影边界而非外站网络封锁。
- **CSRF/请求来源**：课堂与认证写操作要求同源；Work 只在 `MSV_SELF_HOSTED_AUTH=app-session` 且受信前缀匹配时采用 Nginx 覆盖的 forwarded host/proto。跨源写入返回 403；会话另有 SameSite cookie 防线。
- **请求体 DoS**：`readJson` 同时检查 `Content-Length` 与实际 UTF-8 字节数，JSON 上限 32 KB；Nginx 再限制为 64 KB。提前拒绝 403/413/415 时有界 drain 请求流，避免 workerd 把下一次 POST 短暂变成 503。
- **日志隐私**：通用错误只返回用户友好文案；导出与 audit 避免平台 ID/email，但服务端异常日志仍应按生产日志访问策略保护。

## 13. 故障恢复与可观测行为

- **网络短暂失败**：客户端把请求错误显示为可关闭的错误 banner；在线事件和可见页面轮询会重新读取房间。动作不是乐观提交，失败不会伪造成功余额或阶段。
- **设备离线**：界面保留最后一次成功投影并标记“离线·保留当前画面”；没有把离线输入当权威，也没有 WebSocket 重连协议。
- **重复提交/超时不确定**：带幂等键的交易重试会返回 replayed；使用唯一索引/ON CONFLICT 的行动、投票和反思可安全重发。若请求失败发生在 batch 提交边界，DM 可刷新账本后再决定是否重试，不能手工覆盖余额。
- **实体纸账本补录**：DM 可用 `record-paper-ledger` 将受限纸账收入/支出补回 D1；方向与类别白名单、正整数金额、团队归属和非负金库检查先行，余额更新、交易流水、房间版本和审计在同一 batch 中完成。幂等键可重放；这不是任意 CSV 导入，错误补录仍需追加冲正。
- **暂停与计时**：DM 暂停时记录 `paused_at`；恢复会把暂停时长加回 deadline。学员写操作在暂停期间拒绝，讨论可在线下继续。
- **D1 初始化失败**：schema 初始化 promise 捕获异常并重置，下一请求可重试；初始化语句是 IF NOT EXISTS，重复执行不会重建表。
- **D1/应用回滚**：课堂没有应用层快照导入接口。正常纠错用追加冲正；版本部署回退不能宣称会回滚已经写入的房间数据，应依赖 D1 数据备份与 DM 导出进行审计恢复。
- **主持人恢复**：DM可以重新打开房间、读取version/审计/账本、管理成员、暂停/恢复、撤回未公开误发卡、用原因冲正并从最近确认状态继续；已发布卡和已冻结世界线不能无痕删除。

## 14. 测试矩阵与验收入口

### 14.1 课堂专项测试

- `tests/classroom-content.test.ts`：五章顺序、每章四身份/十二卡/L1-L3/六压力、每人三卡、来源外键、全局 ID、复合身份、资产数量和 360 秒 Demo Day。
- `tests/classroom-rules.test.ts`：13 阶段边界、情报门、四项量规收入/失败后果、RP 限制与解锁、50/30/20 分配和资金守恒。
- `tests/classroom-validation.test.ts`：JSON类型、文本/ID/枚举/金额/幂等键、队伍ID和成员管理动作、PDMO、六问复盘及恶意控制字符拒绝。
- `tests/classroom-schema.test.ts`：28表迁移、幂等DDL／旧凭据失效、DB绑定、batch/幂等/负余额约束、服务端投影和不读取`SELECT * FROM profiles`。
- `tests/auth-crypto.test.ts`：密码摘要／salt、随机重置token、原子单次领取和账户输入边界。
- `scripts/test-classroom-e2e.ts` / `npm run test:classroom:e2e`：以1个DM＋4个独立测试用户完成五章E2E，含队伍申请/审批/pending隔离、并发席位、私密牌、情报门、PDMO、两轮挑战、幂等结算、三账户、史实密封、导出隐私和Demo Day。
- `npm run test:classroom`：运行所有 `tests/classroom-*.test.ts` 的确定性单元/契约测试。

### 14.2 全量与部署测试

- `npm run typecheck`：全项目 TypeScript 检查。
- `npm run lint`：ESLint，零 warning。
- `npm run build`：Vinext 生产构建。
- `npm test`：上述类型、lint、build、课堂专项以及既有历史/课程/渲染/交互测试。
- `npm run test:work`：额外构建 `/msv/` Work 静态产物和部署契约测试；不等同于课堂 D1 多账号 E2E。
- `npm run test:work-app`：构建`/msv/demo/app`自托管产物，验证开放注册、密码登录、单次重置链接、旧路由404、队伍申请/审批/直加/移出、会话cookie、RBAC、限流、前缀资源、可信Origin和D1。
- `npm run validate:data`：既有历史 catalog、八个历史关卡和课程外键校验；课堂内容由 `tests/classroom-content.test.ts` 单独校验。

验收顺序建议：先 `npm run test:classroom`，再 `npm run test:work-app` 与 `npm run test:classroom:e2e`，最后运行 `npm test`、`npm run test:work`。线上多账号测试使用真实 Work 登录 API和会话 cookie，不把本地注入身份头当作生产认证证明。

## 15. 关键文件索引

### 课堂入口与前端

- [`app/classroom/page.tsx`](../app/classroom/page.tsx)：动态页面、登录/退出入口和未登录边界。
- [`app/classroom/ClassroomApp.tsx`](../app/classroom/ClassroomApp.tsx)：Dashboard、房间工作台、3 秒轮询、响应式各工作区和动作客户端。
- [`app/classroom/classroom.module.css`](../app/classroom/classroom.module.css)：课堂页面样式与响应式布局。

### API 与服务端领域

- [`app/api/classroom/_shared.ts`](../app/api/classroom/_shared.ts)：统一认证、DB、schema 初始化、JSON 请求和 API envelope。
- [`app/api/classroom/bootstrap/route.ts`](../app/api/classroom/bootstrap/route.ts)：个人/房间概览。
- [`app/api/classroom/join/route.ts`](../app/api/classroom/join/route.ts)：队伍ID申请。
- [`app/api/classroom/rooms/route.ts`](../app/api/classroom/rooms/route.ts)：建房。
- [`app/api/classroom/rooms/[roomId]/route.ts`](../app/api/classroom/rooms/%5BroomId%5D/route.ts)：房间读取与 DM team focus。
- [`app/api/classroom/rooms/[roomId]/actions/route.ts`](../app/api/classroom/rooms/%5BroomId%5D/actions/route.ts)：统一 mutation 入口。
- [`app/api/classroom/rooms/[roomId]/learners/route.ts`](../app/api/classroom/rooms/%5BroomId%5D/learners/route.ts)：DM学员搜索。
- [`app/api/classroom/rooms/[roomId]/export/route.ts`](../app/api/classroom/rooms/%5BroomId%5D/export/route.ts)：DM JSON 归档。
- [`app/lib/classroom-model.ts`](../app/lib/classroom-model.ts)：阶段、内容、DTO、账本和规则类型。
- [`app/lib/classroom-api.ts`](../app/lib/classroom-api.ts)：认证用户、房间投影和动作联合类型。
- [`app/lib/classroom-validation.ts`](../app/lib/classroom-validation.ts)：请求边界解析和拒绝策略。
- [`app/lib/classroom-store.ts`](../app/lib/classroom-store.ts)：D1 查询、权限、阶段动作、投影、账本、导出和审计。
- [`app/lib/classroom-rules.ts`](../app/lib/classroom-rules.ts)：阶段邻接、情报门、挑战结算、RP、收益分配和金额格式。
- [`app/lib/classroom-errors.ts`](../app/lib/classroom-errors.ts)：结构化课堂错误。

### 内容、数据库与部署

- [`app/data/google-classroom-campaign.ts`](../app/data/google-classroom-campaign.ts)：Google 1995–2004 五章、卡片、挑战、压力、资产、来源和 Demo Day。
- [`app/data/eleme-classroom-campaign.ts`](../app/data/eleme-classroom-campaign.ts)：饿了么 2008 五章完整闭环（首章“找真问题”）、四袋线索映射、挑战、压力、工具、来源和调查发布。
- [`app/data/classroom-campaigns.ts`](../app/data/classroom-campaigns.ts)：多战役注册表、公开摘要和跨战役 ID／引用／数量／Demo Day 完整性断言。
- [`饿了么课件接入说明`](./ELEME_CASE_INTEGRATION.md)：原稿映射、史实边界、DM 实施和验收口径。
- [`app/chatgpt-auth.ts`](../app/chatgpt-auth.ts)：Sites／Work 双运行时受信身份和安全回跳。
- [`db/schema.ts`](../db/schema.ts)：Drizzle SQLite的28张表定义。
- [`drizzle/0000_aromatic_mandroid.sql`](../drizzle/0000_aromatic_mandroid.sql)：课堂初始迁移；后续认证与账户／队伍收敛迁移在同目录按编号执行。
- [`db/schema-statements.ts`](../db/schema-statements.ts)：由迁移生成、供运行时batch使用的幂等DDL和旧凭据失效语句。
- [`db/index.ts`](../db/index.ts)：D1 绑定、schema 初始化 promise 和批量建表。
- [`scripts/generate-schema-statements.ts`](../scripts/generate-schema-statements.ts)：迁移到运行时语句的生成器。
- [`worker/index.ts`](../worker/index.ts)：Cloudflare Worker 入口及 `DB` binding。
- [`.openai/hosting.json`](../.openai/hosting.json)：兼容 Sites 项目和逻辑 D1 绑定配置；Work 使用生成的 Wrangler 配置。

### 配套文档

- [`既有架构说明`](./ARCHITECTURE.md)：原有地图/课程世界的架构边界。
- [`数据模型`](./DATA_MODEL.md)：原有历史 catalog、课程和浏览器 PlayerState。
- [`DM导师手册`](./DM_MENTOR_MANUAL.md)：课堂主持、发牌、情报、攻坚、成长和复盘流程。
- [`经济与产品规格`](./GAME_ECONOMY_AND_PRODUCT_SPEC.md)：课堂经济、实体道具、权限和验收规格。
- [`团队验收指南`](./TEAM_ACCEPTANCE_GUIDE.md)：多账号课堂测试与发布前检查。
- [`测试说明`](./TESTING.md)：既有项目测试和部署质量闸。
- [`部署说明`](./DEPLOYMENT.md)：Work 正式构建、认证、发布和回滚边界。
- [`Work运维手册`](./WORK_APP_RUNBOOK.md)：进程、数据、Nginx、账号与共享静态 release 的操作步骤。
