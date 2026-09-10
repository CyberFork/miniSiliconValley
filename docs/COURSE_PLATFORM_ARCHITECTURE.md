# Mini Silicon Valley 课程平台架构

> 状态：T-111 本地实现后的现行架构
> 日期：2026-09-11
> 基础架构：T-085 统一课程工厂
> 当前闭环：两次验收、一次发布

## 1. 不可跳过的生产线

Mini Silicon Valley 只保留一份可编辑课程真值、一套课堂工厂和一套运行状态机。课程从编辑到正式课堂必须依次经过两张可审计回执：

```text
CourseDefinition Working Copy
  → Candidate CourseRelease（exact revision + digest）
  → Studio 多角色视图验收
  → ViewAcceptanceReceipt
  → 真实 TEST Classroom 完整运行
  → UiAcceptanceReceipt
  → Released CourseRelease
  → PRODUCTION ClassroomInstance
```

这条链解决两个不同问题：

- **ViewAcceptanceReceipt** 证明已保存 Candidate 在共享投影器中能覆盖全部 Block、全部支持人数、四导师、N 学员、卡牌与中控。
- **UiAcceptanceReceipt** 证明该 exact Candidate 与四套 exact 导师课件已经在真实 TEST Classroom 的 UI、API、权限和状态机中走完。

两张回执均为不可变证据，而不是可手改的布尔状态。服务端在创建课堂、签发回执和发布时都会重新核验 exact 引用。

## 2. 三个产品面

### Course Studio：课程生产

```text
/studio/             00 课程工作台
/studio/editor/      01 课程编辑器
/studio/preview/     02 多角色视图验收
/studio/releases/    03 验收与发布
/studio/courseware/  04 导师课件库
/course/             05 导师课件播放
```

- Editor 是 CourseDefinition 正文的唯一写入口。
- Preview 只读已保存 Candidate，不读取浏览器未保存 Working Copy。
- Releases 汇总 Candidate、两张回执、课件绑定、Released 与下一步主操作。
- Courseware 是并行资源线，不是 CourseDefinition 的下一步骤。
- `/course/` 只负责导师课件播放，不代表完整课程大纲。

### Classroom：真实课堂交付

```text
/classroom/                        06 课堂中心与 ClassroomFactory
/classroom/{classroomId}/          当前登录人的真实席位 UI
/classroom/{classroomId}/control   该实例的 Admin DM 中控
/classroom/{classroomId}/screen    脱敏共同投屏
/classroom/{classroomId}/members   成员、席位、Admin DM 与 Test 身份管理
```

课堂中心永久分为：

- `TEST · UI 验收课堂`：可绑定 Candidate 或 Released，可重置，不进入正式学习档案。
- `PRODUCTION · 正式课堂`：只能绑定 Released，不可重置，进入正式学习与审计。

所谓“UI 预览”就是一间真实 TEST Classroom。系统不维护第二套预览页面、API 或状态机。

### 历史世界：学习叙事

`/world/` 仍负责真实科技史、时间轴、地图和关卡入口。它消费发布后的课程内容，不拥有另一份可编辑课程真值。

## 3. 领域对象

### CourseDefinition

唯一可编辑课程原型，包含：

- 一世界、两轨线、三玩法、四导师、五步骤、六分钟 Demo。
- Macro Step、Block、中控脚本、P／D／M／O 导师任务与学员任务。
- 卡组、卡牌、来源、F／R／G／U 边界和发牌策略。
- `learnerPolicy`：支持人数、默认人数、每人手牌数与发牌规则。
- 可选 `contentPackages`：案例、剧本所有权、少量课件检查点、结构化交付物、跨导师交接和待审核项。

`contentPackages` 把“谁拥有案例内容”与“课堂绑定了哪些导师工具包”分开：四套 P／D／M／O 专业课件仍可同时绑定；某个 P 所有的历史 ScriptPackage 不会因此复制给 D／M／O。ScriptPackage 必须固定它编写时使用的 exact Courseware ref，ClassroomFactory 发现 revision／digest 不一致时失败关闭。

`CasePackage.caseType` 明确隔离史实与课堂模拟：`historical` 必须绑定课程 case、来源和 F 卡；`simulation` 可以使用独立 case ID，但来源与 F 卡必须为空，其私密证据只能作为无来源的 R 模拟卡。一个 CourseDefinition 可以像 T-090 一样先运行 P 历史 ScriptPackage，再运行 D 模拟 ScriptPackage，两者不能共享“事实”身份。

T-095 起，新 Candidate 还包含 `fieldModel`：它只为正文中已有值建立稳定的 `fieldId / scope / ownerId / JSON path` 索引，不复制第二份内容。`global` 是明确共享的公共字段；四导师、learner01—learner06、每张 card 和新席位模板分别拥有独立节点。课程人数减少只把超出容量的既有席位标为 inactive，不删除内容；ClassroomInstance 的手牌、提交、RP、钱包和资金永远不进入该模型。

### CourseRelease

每次保存产生不可变版本：

```json
{
  "courseId": "eleme-five-step",
  "revision": 12,
  "digest": "sha256:…",
  "status": "candidate"
}
```

同一正文可以复用相同 digest；不同正文必须产生新 revision／digest。发布只移动 Released pointer，不改写旧版本正文。

### ViewAcceptanceReceipt

签发条件：

- 精确绑定 `courseId + revision + digest`。
- 共享投影器成功覆盖课程声明的全部 Block 和每个支持人数。
- 四导师、N 学员、动态任务、中控、卡组容量、稳定发牌和私密卡分配均通过。
- 保存签发者、场景矩阵、检查结果、projector compatibility contract、实际 `sourceCommit`／`appBuildId` 与时间。

有效性同时取决于：

- 该 exact 版本仍是当前 Candidate 或 Released；
- 当前 projector compatibility contract 兼容；
- 回执结果为 passed。

一个未发布 Candidate 被新 Candidate 替代后，旧 View 回执自动失效。当前 Released 的回执仍可用于其正式课堂。

### UiAcceptanceReceipt

签发条件：

- 绑定 exact CourseRelease、有效 ViewAcceptanceReceipt 和一间 TEST Classroom。
- TEST 已解锁同一版本状态机的全部 Block，并由导师另行显式结束该 Run。
- 锁定学员人数、seed、reset generation、四导师 Membership、N 学员 Membership、Admin DM。
- 锁定 P／D／M／O 四套 CoursewarePackage 的 exact revision／digest。
- 16 项真实 UI 检查全部确认。
- 保存浏览器／平台／视口矩阵、projector/runtime compatibility contracts、实际 `sourceCommit`／`appBuildId`、操作者、时间和审计摘要。

TEST reset 不删除历史回执，但会增加 reset generation、解除当前课堂绑定并使旧回执失效。回执不能移植到另一间课堂或另一组课件。

TEST archive 也不删除历史回执。它保留原回执供审计查询，但立即使其失去后续发布与 Production 准入资格，并明确标记“来源 Test Classroom 已归档”。

### CoursewarePackage

- 每个课件版本不可变，并拥有 canonical bundle digest。
- digest 在哈希前按固定字段顺序规范化，不受 JavaScript 对象插入顺序影响。
- TEST 可以绑定 Candidate 或 Released 课件版本。
- PRODUCTION 只能绑定已发布、且与 UI 回执完全一致的四套 exact 版本。

### ClassroomInstance

- 只保存 exact 课程与课件引用，不复制可编辑正文。
- 拥有独立 ControllerState、Membership、手牌、提交、RP、钱包、团队资金和审计。
- `classroom_acceptance_bindings` 保存创建时使用的 View 回执与当前 UI 回执。
- TEST 与 PRODUCTION 的数据和 ControllerState 以 classroomId 隔离。
- 同一 exact 版本可以创建多场独立 TEST；不同 revision 也可并存。保存新 Candidate 或 reset 旧课堂都不会替换既有 exact 引用。

### Test Classroom Archive

归档不是新的 run lifecycle，而是一张一对一、不可变的 `classroom_archives` 保留标记。`classroom_instances.lifecycle` 保留归档前的真实值；`rooms.status=archived` 只为旧运行时提供兼容镜像。

- 只有该课堂真实登录的 Admin DM 可以归档；Test 身份模拟、普通成员和 Production 失败关闭。
- 请求必须匹配 exact `runId + resetGeneration + scriptVersion`，并在一个 D1 batch 中写入标记、状态镜像、更新时间和审计事件。
- 归档后所有课堂级写入均由服务端拒绝；剧本、成员、作品、经济记录、课件和审计仍可只读回看。
- 系统不提供原地恢复或永久删除。继续测试时，从历史卡片携带相同 `courseId/revision/digest` 创建新 TEST。
- 已有 UI 回执保留为历史证据，但不再可用于新的发布或 Production 创建。

### Account、Membership 与 Admin DM

- Account 可加入多个课堂，不嵌入某个课堂文档。
- Membership 将账号绑定到课堂和导师／学员席位。
- 四位导师分别承担 P／D／M／O；学员不固定为 P／D／M／O。
- ClassroomFactory 指定的第一位 Admin DM 是 Primary；它可以是导师或平台管理员，并拥有唯一委派能力。
- Primary 只能把 Delegated Admin DM 授予有效导师。Delegated 可运行课堂但不能递归授予／撤销；权限按 Classroom 隔离。
- 平台 admin 不自动穿透所有课堂，仍需要 Membership 或课堂 Admin DM 权限。
- 平台 admin 若显式拥有 Test Classroom 的 Admin DM，可在真实 Session 上短时模拟该课堂非管理员成员；actor、effective identity 与 scope 始终同时保留。

## 4. 共享投影与动态人数

课程声明：

```json
{
  "learnerPolicy": {
    "defaultCount": 4,
    "minCount": 2,
    "maxCount": 6,
    "cardsPerLearner": 3,
    "dealPolicy": "unique-within-step"
  }
}
```

`buildStudioProjection()` 是 Editor 辅助视图和正式 Preview 验收的共享投影器。它必须证明：

- N=2 不生成虚假空席；N=6 能生成六份独立任务和私密视图。
- 卡牌容量满足 `learnerCount × cardsPerLearner`。
- `unique-within-step` 不重复发牌；固定 seed 的结果可复现。
- 第五名以后使用通用学员任务模板，不能依赖写死的 learner01—learner04。
- 任一声明支持人数无法实例化时，不能签发 View 回执。

Preview 无副作用：不创建 Classroom、Membership、手牌、账本或审计记录。

## 5. Script Layer 与课堂运行时

Script Layer 只持久化 append-only 的 `unlockedThroughBlockId`、`unlockedThroughBlockIndex` 与 `version`；初始边界为 B01，不存在“全局当前页”。每个浏览器以 `?block=Bxx` 独立查看已解锁页；解锁通知不强制跳转，历史页始终可一键回到最新。支持键盘 `←/→/Home/End` 切页。

P/D/M/O 任一导师和 Admin DM 可在 Production 弹窗确认顺序解锁；学员不可解锁。Test 中任意课堂参与者可在角色 Tabs 真实测试中控、四导师、N 学员和 `/screen` 投屏；Production 严禁 `viewAs`。`leadMentorId` 仅建议主讲，不是权限。

Activity 按 block 保存并覆盖同 kind 的工作记录；Economy／卡牌与浏览、解锁彻底解耦。回看或解锁不要求重新提交，也不重置已有数据。“重新提交”不是剧本流程状态：只有用户主动再次保存同一 block/kind 才更新该记录。课程可以声明任意命名的结构化作品，例如 `ProductBrief` 和 `DevelopmentStick`，共同使用 `submitted → rejected → submitted → accepted`；状态只属于作品，绝不阻塞剧本回看或偷偷改动经济数据。列表字段可以声明最少／最多条数，并在客户端和服务端同时失败关闭。已通过作品可以按 ScriptPackage 的显式规则投影给下一位导师，未通过草稿不跨专业泄漏。遗留 `classroom_controller_states` 仅作兼容镜像，Runtime 不读取。

解锁末页不自动改变 v3 Classroom lifecycle。导师必须在中控弹窗中另行确认结束；该确认使用 run identity、script version、幂等键和原子 mutation。默认课程不设作品门槛；只有 exact CourseDefinition 的 `rules.completion.requiredAcceptedSubmissionSchemaIds` 明确列出的 schema，才会在“结束”操作时检查已通过证据。已有 v2 课堂保留原先末页自动完成语义，Test reset 后才升级到 v3，既有 Production 不被静默改写。

Stage 1 `/studio/preview/` 是桌面内部内容投影验收：单页展示 4 导师、N 学员和中控摘要，支持完整字段核验及 hover/点击固定展开。Stage 2 才是真实 `/classroom/{id}/` Test Classroom UI；两级 exact 回执门禁后才能 Released。

T-094 起，所有 exact 课程快照统一显示 `courseDataId = {courseId}@r{revision}:{digest}`。Test Runtime 另外公开 `classroomId / runId / blockId / seatId / membershipId / dealSeed / deckId / state versions / resetGeneration / cardAssignmentId` 的内部诊断。浏览器预览与服务端共享相同 UTF-16 hash、`courseId:deckId:seed` 和 checkpoint 卡组选择契约；数据库随机 assignment ID 不参与卡片显示排序。只有显式 Test reset 才生成新 runId 与 dealSeed。

共同准入仍由 `ClassroomFactory.create()` 负责：exact CourseRelease、人数、成员与有效 ViewAcceptanceReceipt 必须一致。Production 额外要求 Released、有效 UiAcceptanceReceipt 及四套 exact 课件。创建使用单次 D1 事务／batch 写入，失败不留下半个课堂。

`/classroom/#factory` 的选择界面不是准入规则本身。它展示所有当前 Candidate／Released，并把课程、View、UI、P／D／M／O 课件、4 + N 成员和 Admin DM 转换成持久可见的就绪清单；未通过的版本仍可选择和进入 exact 修复路径，但创建按钮保持失败关闭。课堂列表、课程/回执和账号分别读取、分别重试，刷新失败保留上一次成功数据与合法表单值。显式 exact 深链失效时绝不回退到另一版本。

TEST 区标题旁永久提供普通链接“新建测试课堂”。课堂卡公开完整 `classroomId / courseId@revision / digest / learnerCount / lifecycle / updatedAt`，避免多个版本或同版本多次测试相互混淆。已归档 Test 从活跃区移入独立历史区；Studio 的当前验收计数不把它当成活跃 Test。

## 6. 16 项真实 UI 验收

Admin DM 只有在 TEST 解锁全部剧本页并显式结束该 Run 后，才能逐项确认并签发 UI 回执。唯一清单由 `app/lib/course-acceptance-contract.ts` 维护：

1. Test 与 Production 使用同一套页面、API 与状态机。
2. 四导师、N 学员、Admin DM 的 Membership 与 RBAC 均正确。
3. 四位导师各自看到正确任务与 exact 课件入口。
4. 每名学员都能看懂并完成当前私人任务。
5. 学员只看到自己的私密卡、RP 与个人钱包。
6. 公共投屏未泄漏手牌、讲稿、账号、钱包或未公开提交。
7. 导师确认后只顺序解锁下一页，不能跳页、重复或倒退。
8. 多人独立回看；新页解锁只通知、不强制其他窗口跳页。
9. Test 角色 Tab 能真实切换中控、四导师、全部学员和投屏。
10. 末页解锁后由导师另行确认结束；解锁、结束和作品验收没有混为一件事。
11. 刷新和重新登录后，席位、手牌与课堂进度保持正确。
12. 旧版本并发操作被拒绝，没有覆盖较新的解锁边界。
13. Test reset 已实测且只重置本课堂，不影响其他实例。
14. 手机、电脑与公共投屏尺寸均已人工检查。
15. Studio 后续保存没有热更新正在运行的课堂。
16. 课程与 P／D／M／O 课件 revision／digest 与锁定值一致。

浏览器复选框只表达人工结果；签发 API 仍会校验课堂环境、显式结束后的 lifecycle、状态机、成员、课件、View 回执、reset generation 和兼容契约。自动化只能验证门禁，不能替人签发这张人工回执。

## 7. 失败关闭与失效规则

以下情况必须返回结构化错误，不能静默降级：

- Candidate／receipt 的 revision 或 digest 不一致。
- View 回执缺失、过期、投影器不兼容或容量校验失败。
- TEST 未完成或 16 项检查不全。
- UI 回执来自另一课堂、另一 reset generation 或另一套课件。
- UI 回执来源 TEST 已归档；历史内容仍可查，但不能继续作为当前发布证据。
- PRODUCTION 绑定 Candidate、未发布课件或未经验收的课件。
- 课堂开始后试图替换课程或课件版本。
- 并发 ControllerState 写入使用旧 version。
- 归档请求使用旧 run/script version，或归档后继续尝试提交、审核、改成员、重置或签收。
- 投屏载荷包含私密卡、导师讲稿、账号、钱包或未公开提交。

失效不会篡改历史回执；系统通过当前 Candidate／Released pointer、projector/runtime compatibility contracts、reset generation 和 exact digest 动态判断有效性。`sourceCommit`／`appBuildId` 保留实际验收构建的来源记录，但兼容契约不变时，纯 CSS 构建不会单独使回执失效。

## 8. 权限与隐私边界

- `/studio/*`：平台 mentor／admin，且必须完成首次改密。
- `/course/*`：真实 admin／mentor／learner 登录账号只读访问 Released 课件；Candidate、测试模拟身份和内部 fallback 不进入目录。
- Classroom：仅该实例 Membership 或 Admin DM。
- 学员只收到自己的任务、持久化手牌、提交、RP 与钱包。
- 导师不接收其他导师不需要的私密脚本。
- `/screen` 使用服务端 allow-list，不依赖 CSS 或客户端隐藏。
- inline HTML 课件在不含 `allow-same-origin` 的 sandbox iframe 中播放。
- 写 API 使用第一方 HttpOnly Session、同源 Origin 校验、服务端 RBAC 与审计。
- 普通账号切换从服务端维护的浏览器账号集合选择已验证身份，并原子轮换唯一活跃 Session；密码、会话令牌不进入 localStorage、URL 或页面源码。Test 模拟独立于该集合，最长 30 分钟且仅限一间 Test Classroom；Production、Studio、Account、跨课堂与管理员目标失败关闭。
- `classroom_admin_dm_grants` 是授权真值；旧 `classroom_permissions` 仅是迁移期回滚镜像，不参与新请求的 RBAC 判断。

## 9. 数据模型与迁移

T-086 新增：

- `course_view_acceptance_receipts`
- `course_ui_acceptance_receipts`
- `classroom_acceptance_bindings`

关键约束：

- 两类回执按 exact 业务指纹唯一，重复签发返回同一持久 ID。
- 所有引用均有外键和 digest 校验；课堂只能有一个当前 acceptance binding。
- migration 幂等执行，失败不覆盖现有 D1 数据。
- 既有 `course_test_receipts` 保留用于历史数据读取，但不再满足新的发布门禁。

T-087 新增：

- `classroom_admin_dm_grants`
- `auth_impersonations`

迁移先把现有统一课堂的 owner 回填为 Primary，再把其他旧 Admin DM 回填为 Delegated；每课堂单一 active Primary 的唯一索引提供数据库级不变量，冲突安全 backfill 可重复执行且不会复活已撤销授权。模拟记录与真实 `auth_sessions` 级联，停用账号、重发凭据或撤销 Delegated 时主动结束。

T-106 新增：

- `auth_browser_sets`
- `auth_browser_accounts`
- `auth_browser_session_links`
- `auth_browser_mutations`

浏览器账号集合的明文能力令牌只存在 Secure、HttpOnly Cookie，D1 仅存 SHA-256 摘要。集合使用 version CAS 与幂等键处理多标签并发；数据库触发器保证 active user、active session 与集合成员一致。密码变更、账号停用和凭据重发会使旧凭据失效；空集合、退出全部和最终账号移除在同一原子批次内撤销。

## 10. 生产拓扑与统一发布

```text
Cloudflare Tunnel
  → 127.0.0.1:18780  Nginx gateway
      ├─ current/site                 静态世界、门户、原版 P 导师课件
      ├─ 127.0.0.1:18787             Vinext/Worker + D1-compatible data
      └─ 127.0.0.1:18789             Parent Q&A
127.0.0.1:18792                       cloudflared metrics
```

统一 release 同时包含 `site/`、`app/dist/`、`ops/`、根 manifest 和 `bundle.json`。运行数据与 secrets 永远位于 release 外；`~/Services/minisv/current` 原子切换到整包版本，避免静态 UI 与 API 跨构建。

## 11. 退休入口与导航约束

- `/alpha`、`/alpha/*`：410
- `/control`、`/control/*`：410
- `/api/classroom/*`：410
- `/api/internal/*`：公网 404

新导航不得再暴露这些路径。现行工作流只使用 `/studio/*`、`/course/*` 和 `/classroom/{classroomId}/*`。

## 12. 不可破坏的架构约束

- Editor 是课程正文唯一写入口，不能退化为仅编辑原始 JSON。
- Preview 只验收已保存 Candidate，不能把 Working Copy 当成已验收版本。
- Test 与 Production 共用工厂、UI、API 和状态机，但不共用运行数据。
- 没有两张 exact 有效回执就不能 Released。
- Production 必须复用 UI 验收过的四套 exact 课件。
- Studio 保存、Preview、发布新版本或 TEST reset 对运行中 Production 零副作用。
- 学员人数不写死为 4；必须由课程策略和实例人数动态投影。
- 回执提供证据链，不能替代真实人工课堂验收。

具体操作步骤见 [Course Platform SOP](COURSE_PLATFORM_SOP.md)，验证命令与矩阵见 [Testing](TESTING.md)。

## 9. Script Runtime、迁移与操作手册

Script Layer 只保存 append-only `unlockedThroughBlockId`、`unlockedThroughBlockIndex`、`version`（B01 初始）；每个浏览器通过 `?block=Bxx` 独立查看，通知不强制跳转，历史页可一键回最新，键盘支持 `←/→/Home/End`。Production 解锁确认仅限任一 P/D/M/O 导师或 Admin DM，Test 可由任意参与者在角色 Tabs 测试；Production 禁止 `viewAs`。`leadMentorId` 仅为主讲建议。

0007 迁移只将旧 `blockIndex` 解释为已解锁边界，保留提交、卡牌、RP、钱包、团队资金与 Activity。Activity 按 block/kind 覆盖保存；Economy、卡牌与浏览/解锁解耦，回看或解锁不重置数据。“重新提交”不是状态，只有用户主动再次保存同一 block/kind 才更新记录。`classroom_controller_states` 仅兼容镜像，Runtime 不读取。

操作路径：导师在 `/classroom/{id}/` 保存工作并在 Production 弹窗确认解锁；学员仅使用自己的席位回看并点击“回到最新”；验收者在 Test 依次检查 `/control`、角色席位与 `/screen`，确认隐私、并发和刷新恢复后签发 UI 回执。


## 完成契约与证据边界

末页解锁、导师 explicit finish、可选 evidence gates 与作品验收彼此解耦；默认没有作品门槛，只有 CourseDefinition.rules.completion 显式声明 requiredAcceptedSubmissionSchemaIds 才要求对应作品。sourceCommit/appBuildId 表示 actual build provenance；projector/runtime contract 是兼容契约，纯 CSS 变化在兼容契约不变时不自动使回执失效。历史快照称 archived，不得冒充当前版本。证据层级为源码、纯函数、API+DB、浏览器、人工、部署；不得伪造人工回执。Pad 实机验收仍属 T-088，尚未完成。
