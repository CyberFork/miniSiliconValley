# Mini Silicon Valley 课程平台架构

> 状态：T-086 已实现的现行架构
> 日期：2026-09-09
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
/classroom/{classroomId}/members   成员、席位与 Admin DM
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
- P／D／M／O 默认课件引用。

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
- 保存签发者、场景矩阵、检查结果、`projectorVersion`、`appBuildId` 与时间。

有效性同时取决于：

- 该 exact 版本仍是当前 Candidate 或 Released；
- 当前投影器版本与构建兼容；
- 回执结果为 passed。

一个未发布 Candidate 被新 Candidate 替代后，旧 View 回执自动失效。当前 Released 的回执仍可用于其正式课堂。

### UiAcceptanceReceipt

签发条件：

- 绑定 exact CourseRelease、有效 ViewAcceptanceReceipt 和一间 TEST Classroom。
- TEST 已完成同一版本状态机的全部 Block。
- 锁定学员人数、seed、reset generation、四导师 Membership、N 学员 Membership、Admin DM。
- 锁定 P／D／M／O 四套 CoursewarePackage 的 exact revision／digest。
- 14 项真实 UI 检查全部确认。
- 保存浏览器／平台／视口矩阵、`appBuildId`、操作者、时间和审计摘要。

TEST reset 不删除历史回执，但会增加 reset generation、解除当前课堂绑定并使旧回执失效。回执不能移植到另一间课堂或另一组课件。

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

### Account、Membership 与 Admin DM

- Account 可加入多个课堂，不嵌入某个课堂文档。
- Membership 将账号绑定到课堂和导师／学员席位。
- 四位导师分别承担 P／D／M／O；学员不固定为 P／D／M／O。
- Admin DM 是课堂级权限，不是第五位导师；可授予某位导师或独立管理员。
- 平台 admin 不自动穿透所有课堂，仍需要 Membership 或课堂 Admin DM 权限。

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

## 5. 同一课堂工厂与状态机

Test 与 Production 均调用同一个 `ClassroomFactory.create()`，并执行同一个版本化状态机：

```text
ready → executing → awaiting-acceptance → accepted → next block
                            └→ rejected / retry
```

共同准入：

- exact CourseRelease 合法；
- 学员人数、账号角色、导师唯一性和卡牌容量合法；
- 有效 ViewAcceptanceReceipt 与 exact 课程一致。

Production 额外准入：

- 课程状态是 Released；
- 有效 UiAcceptanceReceipt 与 exact 课程、View 回执和 Test Classroom 一致；
- 计划绑定的四套课件与 UI 回执逐项相同且均已 Released。

创建使用单次 D1 事务／batch 写入实例、成员、权限、课件与回执绑定，失败时不留下半个课堂。

## 6. 14 项真实 UI 验收

Admin DM 只有在 TEST 完成全部课程后，才能逐项确认并签发 UI 回执：

1. TEST／PRODUCTION 使用同源运行时。
2. Membership 与 RBAC 正确。
3. 四导师任务与 exact 课件正确。
4. 学员任务正确。
5. 私密卡、RP 与钱包隔离。
6. 公共投屏脱敏。
7. Block 执行、退回、重试与推进正确。
8. 五大步与全部 Block 完成。
9. 刷新后状态恢复。
10. 重新登录后身份与席位恢复。
11. 并发版本冲突被拒绝并可恢复。
12. TEST reset 行为正确。
13. 手机、桌面和投屏布局通过。
14. 运行中实例不受 Studio 后续保存影响，课程与课件 exact 引用不漂移。

浏览器复选框只表达人工结果；签发 API 仍会校验课堂环境、生命周期、状态机、成员、课件、View 回执、reset generation 和构建版本。

## 7. 失败关闭与失效规则

以下情况必须返回结构化错误，不能静默降级：

- Candidate／receipt 的 revision 或 digest 不一致。
- View 回执缺失、过期、投影器不兼容或容量校验失败。
- TEST 未完成或 14 项检查不全。
- UI 回执来自另一课堂、另一 reset generation 或另一套课件。
- PRODUCTION 绑定 Candidate、未发布课件或未经验收的课件。
- 课堂开始后试图替换课程或课件版本。
- 并发 ControllerState 写入使用旧 version。
- 投屏载荷包含私密卡、导师讲稿、账号、钱包或未公开提交。

失效不会篡改历史回执；系统通过当前 Candidate／Released pointer、投影器与构建版本、reset generation 和 exact digest 动态判断有效性。

## 8. 权限与隐私边界

- `/studio/*`、`/course/*`：平台 mentor／admin，且必须完成首次改密。
- Classroom：仅该实例 Membership 或 Admin DM。
- 学员只收到自己的任务、持久化手牌、提交、RP 与钱包。
- 导师不接收其他导师不需要的私密脚本。
- `/screen` 使用服务端 allow-list，不依赖 CSS 或客户端隐藏。
- inline HTML 课件在不含 `allow-same-origin` 的 sandbox iframe 中播放。
- 写 API 使用第一方 HttpOnly Session、同源 Origin 校验、服务端 RBAC 与审计。

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
