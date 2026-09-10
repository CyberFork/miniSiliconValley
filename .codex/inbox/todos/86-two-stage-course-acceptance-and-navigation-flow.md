---
type: todo
id: T-086
title: "补齐课程视图验收、真实 UI 验收与正式发布闭环"
status: done
created: 2026-09-08
updated: 2026-09-09
captured_by: project-inbox
depends_on:
  - T-085
tags:
  - todo
  - mini-silicon-valley
  - course-studio
  - classroom
  - acceptance
  - release-gate
  - navigation
  - single-source-of-truth
---

# 补齐课程视图验收、真实 UI 验收与正式发布闭环

> [!IMPORTANT]
> **2026-09-09 最新架构口径**：两级验收与 Released 门禁继续保留；下文原始需求中把 Classroom 描述成全局 `ControllerState`、执行／提交验收／退回／重试／接受／推进状态链的部分，已经被“角色可见电子剧本”模型取代。课堂只共享单调递增的**已解锁边界**，每个角色浏览器独立翻阅已解锁页面；Activity、手牌与 Economy 均与剧本浏览／解锁解耦。最终实现与验收以本文末尾“第二次架构校准”以及主仓库 `docs/T086_ROLE_VISIBLE_SCRIPT_RUNTIME.md` 为准。

## 原始需求

T-085 已完成开发，下一阶段需要由课程负责人亲自测试和验收。平台应明确组织成：

```text
课程编辑器
→ 视图预览
→ UI 预览
→ 正式课程
```

其中：

- 课程编辑器的结果由视图预览验收。
- 正式课程由真实 UI 预览验收。
- 需要重新梳理 Course Studio、Editor、Preview、Courseware、Releases、Course 和 Classroom 这些入口的操作关系与导航表达。
- 当前先按已确认方案记录 Todo；后续实际使用中发现新问题时再继续优化。

## 产品结论

最终流程应被明确为“两次验收、一次发布”，而不是再创建一套独立 UI 预览系统：

```text
CourseDefinition
  ↓ 在 Editor 保存
Candidate CourseRelease
  ↓ Studio Preview 多角色视图验收
ViewAcceptanceReceipt
  ↓ 使用真实 Classroom 创建 Test 实例
Test Classroom 真实 UI 验收
  ↓ 完整运行并签发
UiAcceptanceReceipt
  ↓ Releases 发布
Released CourseRelease
  ↓ ClassroomFactory 创建
Production ClassroomInstance
```

### 不改变 T-085 的基础架构

- `CourseDefinition` 仍是唯一可编辑课程真值。
- Editor 仍是课程正文唯一写入口。
- Candidate 和 Released 仍是不可变 `CourseRelease`，通过 `courseId + revision + digest` 精确引用。
- Test 和 Production 仍使用同一个 ClassroomFactory、页面、API 和状态机。
- Studio Preview 仍是无副作用的数据投影，不写 Classroom 运行状态。
- UI 预览直接使用真实 Test Classroom，不新增第二套 UI Preview 渲染器。
- Production 只能绑定 Released；开始后锁定课程和课件 exact 版本。

## 一、路由职责与建议名称

### Course Studio 内部课程生产

#### `/studio/`：课程生产工作台

- 作为内部制课、验收和发布的统一总入口。
- 显示每个课程当前 Candidate、视图验收、Test Classroom、UI 验收、Released 和 Production 状态。
- 首页突出一条不可跳过的生产线：

```text
① 编辑课程 → ② 验收多角色视图 → ③ 验收真实课堂 UI → ④ 发布正式版本 → ⑤ 创建正式课堂
```

#### `/studio/editor/`：课程编辑器

- 编辑唯一 `CourseDefinition`。
- 编辑五步骤、Block、P/D/M/O 任务、学员任务、卡牌、人数和验收规则。
- 编辑时可即时重算派生视图，但即时画面只用于辅助编辑，不等于正式验收。
- “保存 Candidate”生成新 revision/digest，不改变已有 Test/Production Classroom。
- 保存成功后提供明确主操作：“前往多角色视图验收”。

#### `/studio/preview/`：多角色视图验收

导航名称由容易含混的“只读预览”明确为“多角色视图验收”。

- 只读取已保存 Candidate，不读取未保存浏览器工作副本。
- 通过共享投影器显示 `4 位导师 + N 名学员 + 1 个底部中控`。
- 支持切换所有 Block、课程允许的学员人数和固定发牌 seed。
- 对课程数据、任务映射、卡牌容量、席位隔离和中控投影做第一层验收。
- 增加“确认视图验收”操作并生成 exact `ViewAcceptanceReceipt`。
- 验收失败时返回 Editor；验收成功后提供“创建 UI 验收课堂”。

#### `/studio/releases/`：验收与发布

导航名称建议从“发布管理”明确为“验收与发布”。

- 汇总 Candidate、ViewAcceptanceReceipt、Test Classroom、UiAcceptanceReceipt 与 Released 状态。
- 是两级验收和正式发布的总闸门。
- 可以从已通过视图验收的 Candidate 创建 Test Classroom。
- 只有两级 exact 回执同时有效时，才启用“发布为 Released”。
- 发布成功后提供“创建 Production Classroom”。

### 课件并行支线

#### `/studio/courseware/`：导师课件库

- 创建、上传、预览、版本化和发布 P/D/M/O 导师课件。
- 它是与课程定义并行的资源生产线，不是 CourseDefinition 的下一步骤。
- UI 验收前必须确定本次 Test Classroom 要绑定的四套 exact 课件。
- Production 必须绑定已发布且经过对应 UI 验收的 exact 课件版本。

#### `/course/`：导师课件播放

导航中不要把它简称为“课程”或“完整课程大纲”，建议统一显示“导师课件播放”。

- 展示或打开已安装的导师课件。
- 播放 `/course/{slug}/?revision={revision}` exact 版本。
- 供 Courseware Library 的 exact 预览和导师课堂角色卡跳转。
- 不编辑 CourseDefinition，不推进课堂，不代表正式课程。

### 课堂交付

#### `/classroom/`：课堂中心

导航名称不应只写“正式课堂”，因为同一入口同时包含 Test 和 Production。

- 导师／管理员查看自己的 UI 验收课堂和正式课堂。
- 学员查看分配给自己的课堂。
- Classroom Factory 创建 Test 或 Production 实例。
- 页面按环境清晰分组并显示永久徽标：

```text
UI 验收课堂
- TEST
- 可绑定 Candidate 或 Released
- 可重置
- 不进入正式学习档案

正式课堂
- PRODUCTION
- 只能绑定 Released
- 不可重置
- 进入正式学习档案和审计
```

#### Classroom 实例路由

```text
/classroom/{id}/          导师／学员真实席位 UI
/classroom/{id}/control   Admin DM 独立中控
/classroom/{id}/screen    公共投屏
/classroom/{id}/members   成员、席位、Admin DM 与锁定版本
```

所谓“UI 预览”必须由这些真实 Test Classroom 路由完成。可以在 Studio 中提供“UI 预览”快捷入口，但快捷入口只能跳转 Test Classroom，不得维护另一份页面、API 或状态机。

## 二、实际操作流程

### Step 0：准备导师课件

1. 进入 `/studio/courseware/`。
2. 为 P/D/M/O 上传或选择课件。
3. 打开 `/course/{slug}/?revision={revision}` 检查 exact 版本。
4. 确认计划用于 UI 验收的四套课件版本。

课件准备可以与课程编辑并行，但必须在创建 Test Classroom 前汇合。

### Step 1：编辑并保存 Candidate

1. 进入 `/studio/editor/`。
2. 选择目标课程。
3. 逐 Block 编辑并检查即时派生结果。
4. 修复 Schema、人数、任务模板和卡组容量问题。
5. 点击“保存 Candidate”。
6. 记录生成的 `courseId + revision + digest`。

### Step 2：完成多角色视图验收

1. 进入 `/studio/preview/`，选择刚保存的 exact Candidate。
2. 遍历五步骤及全部 Block。
3. 按课程支持范围验收 N=2、N=4、N=6 或其他必须支持的人数。
4. 使用固定 seed 检查发牌稳定性与私密卡隔离。
5. 检查四导师、N 学员和底部中控的任务映射。
6. 全部通过后点击“确认视图验收”。
7. 生成 `ViewAcceptanceReceipt`；失败则返回 Editor 修改并产生新 Candidate。

### Step 3：创建真实 UI 验收课堂

1. 在 `/studio/releases/` 找到同时具有有效 ViewAcceptanceReceipt 的 Candidate。
2. 点击“创建 UI 验收课堂”。
3. 跳转 `/classroom/#factory`，环境固定为 Test，并预选 exact Candidate。
4. 选择实际 N、四位不同导师账号、N 个学员账号和 Admin DM。
5. 为 P/D/M/O 绑定计划发布的四套 exact 课件。
6. 创建 Test Classroom 后进入 `/classroom/{id}/control`。

### Step 4：完成真实 UI 验收

使用真实导师、学员和 Admin DM 登录，完整运行课堂：

- 验收角色权限和 Membership。
- 验收导师任务、学员任务和课件入口。
- 验收学员只看到自己的私密卡、RP 和个人钱包。
- 验收公共投屏不暴露手牌、导师讲稿、账号、钱包和未公开提交。
- 验收 Block 的执行、提交、退回、重试、接受和推进。
- 验收全部五步骤／Block 能够完成。
- 验收刷新、重新登录、并发版本冲突和 Test reset。
- 验收手机、电脑和投屏尺寸。
- 验收正在运行的实例不受 Studio 后续保存影响。

完成后由 `/classroom/{id}/control` 生成 exact `UiAcceptanceReceipt`。

### Step 5：发布 Released

1. 返回 `/studio/releases/`。
2. 确认 ViewAcceptanceReceipt 与 UiAcceptanceReceipt 都绑定当前 exact Candidate。
3. 确认 UI 回执中的四套课件 revision/digest 与计划投产版本一致。
4. 点击“发布为 Released”。
5. 发布前服务端重新执行最大人数、卡组容量、Schema 和回执绑定校验。

### Step 6：创建正式课堂

1. 进入 `/classroom/` 的 Classroom Factory。
2. 环境选择 Production。
3. 只允许选择 Released CourseRelease。
4. 设置本次真实学员人数和正式成员账号。
5. 绑定与 UI 验收一致的 Released P/D/M/O 课件版本。
6. 创建 Production Classroom。
7. 将账号和课堂入口分发给实际参与者。

正式参与者的最短路径是：

```text
登录 → /classroom/ → 进入分配给自己的 Production Classroom
```

他们不需要进入 Studio、Preview 或 Releases。

## 三、ViewAcceptanceReceipt

当前 Preview 只读能力不能自动等同于“已经有人验收”。需要新增可审计的不可变回执。

建议 Schema：

```json
{
  "receiptId": "view-...",
  "courseRef": {
    "courseId": "eleme-five-step",
    "revision": 12,
    "digest": "sha256:..."
  },
  "environment": "studio-preview",
  "scenarios": [
    {
      "learnerCount": 2,
      "seed": "acceptance-2",
      "blockIds": ["B01", "..."],
      "result": "passed"
    },
    {
      "learnerCount": 4,
      "seed": "acceptance-4",
      "blockIds": ["B01", "..."],
      "result": "passed"
    },
    {
      "learnerCount": 6,
      "seed": "acceptance-6",
      "blockIds": ["B01", "..."],
      "result": "passed"
    }
  ],
  "checks": {
    "fiveMacroSteps": true,
    "allBlocksReviewed": true,
    "pdmoProjection": true,
    "learnerTaskProjection": true,
    "controllerProjection": true,
    "cardCapacity": true,
    "uniqueDealRule": true,
    "privateCardAssignment": true
  },
  "projectorVersion": "...",
  "appBuildId": "...",
  "result": "passed",
  "reviewerProfileId": "...",
  "createdAt": "..."
}
```

### 回执有效性

- 必须绑定 exact Candidate revision/digest。
- Candidate 发生任何修改并生成新 digest 后，旧回执自动失效。
- 共享投影器产生不兼容版本变化时，需要提示重新验收。
- 任一课程声明必须支持的人数、Block 或必检项失败时，回执不得为 passed。
- Preview 不写入 Classroom ControllerState、成员、手牌、账本或审计命名空间。

## 四、UiAcceptanceReceipt

UI 回执必须绑定：

- exact Candidate CourseRelease。
- exact Test Classroom ID。
- Test Classroom 的人数和 seed。
- 四位 P/D/M/O 导师 Membership。
- N 名学员 Membership。
- Admin DM。
- 四套 exact CoursewarePackage revision/digest。
- UI、API、状态机、权限、私密数据和投屏检查结果。
- 浏览器、视口、App Build ID、操作者、完成时间和审计日志摘要。

只有 Test Classroom 真正完成全部课程，且所有必检项通过后才能签发。

## 五、Studio 导航与页面信息架构

建议分组三层显示：

```text
课程生产
00 课程工作台
01 课程编辑器
02 多角色视图验收
03 验收与发布

资源管理
04 导师课件库
05 导师课件播放

课堂交付
06 课堂中心
```

其中：

- “导师课件播放”可以链接 `/course/`。
- “课堂中心”链接 `/classroom/`。
- “UI 预览”不建立新渲染路由，只在 Studio 工作台和 Releases 中作为 Test Classroom 快捷操作出现。
- Studio 首页和 Releases 页面均应显示当前 exact 版本及每个门禁状态。

## 六、Releases 状态展示

每个 Candidate 应显示：

```text
Candidate r12 · sha256:...
├─ 多角色视图验收：未开始／失败／已通过
├─ UI 验收课堂：未创建／运行中／已完成
├─ UI 验收回执：缺失／失效／已通过
├─ P/D/M/O 课件：exact revision/digest
├─ 正式发布：未发布／Released
└─ Production：已创建 N 场
```

页面应始终显示“下一步主操作”，避免用户自己猜测应该打开哪个入口。

## 七、失败关闭规则

以下任一情况必须在状态切换前阻止创建、签发或发布：

- Candidate digest 与任一验收回执不一致。
- ViewAcceptanceReceipt 缺失、失败或失效。
- UiAcceptanceReceipt 缺失、失败或绑定了其他 Test Classroom。
- 课程修改后仍尝试复用旧回执。
- 学员人数超出课程支持范围。
- 卡组容量不足或不满足不重复发牌规则。
- 五步骤、Block、导师角色或任务投影不完整。
- F 卡来源无效、稳定 ID 重复或 Schema 不一致。
- UI 回执中的课件版本与 Production 计划绑定版本不一致。
- Production 尝试绑定 Candidate 或未发布课件。
- 课堂开始后尝试替换课程或课件版本。
- 投屏载荷出现私密卡、导师讲稿、账号、钱包或未公开提交。
- Test 与 Production 的数据命名空间或 ControllerState 交叉。

失败必须返回可定位的问题列表，不得产生半发布、半创建或静默回退。

## 八、测试矩阵

### 领域与契约测试

- CourseDefinition Schema 与 digest 稳定性。
- Candidate／Released 状态转换。
- ViewAcceptanceReceipt 创建、绑定、失效与重复签发。
- UiAcceptanceReceipt 创建、绑定与失效。
- 两级回执发布门禁。
- ClassroomFactory 的 Test／Production 准入。
- 学员人数、卡牌容量和不重复发牌。
- 课件 exact 版本锁定。
- 私密卡、投屏脱敏和权限边界。
- Test／Production 数据与 ControllerState 隔离。

### Studio UI 测试

- Editor 保存 Candidate 并跳转 Preview。
- Preview 只读且只读取已保存 Candidate。
- 2／4／6 人及全部 Block 视图验收。
- 回执生成、失败原因、digest 失效提示。
- 未通过视图验收时不能创建 Test Classroom。
- Releases 正确展示两级门禁与下一步操作。
- Courseware 上传、exact 预览、发布和版本选择。

### Test Classroom E2E

- Admin DM、四导师和 N 名学员登录。
- 首次密码修改与会话撤销。
- 成员、角色与权限。
- 课堂创建、推进、退回、重试、完成和重置。
- 私密卡隔离和公共投屏脱敏。
- 导师课件入口与 exact 版本。
- 运行实例与 Studio 后续保存解耦。
- 完成后才能签发 UI 回执。

### Production E2E

- 只有 Released 可以创建。
- 只能绑定经过对应 UI 验收的 Released 课件版本。
- Production 不提供 reset。
- 课程与课件 exact revision/digest 在开课后保持锁定。
- Studio 保存、发布、Preview 和 Test reset 对运行中 Production 零副作用。
- 正式成员、提交、账本、审计和 ControllerState 按 Classroom 隔离。

### 路由与部署验收

- `/studio/*`、`/course/*`、`/classroom/*` 路由、登录与 RBAC。
- Studio 导航名称和下一步操作一致。
- `/course/` 不再被描述为完整课程真值。
- `/classroom/` 对 Test／Production 分组明确。
- 旧 `/alpha/`、`/control/`、`/control/editor/` 不出现在新导航，并按既定策略返回 410。
- 公网、404、CSP、敏感字段和部署包完整性检查。

## 九、验收标准

- [x] Editor 保存后产生不可变 Candidate CourseRelease 和 exact digest。
- [x] Editor 保存成功后提供“前往多角色视图验收”。
- [x] Preview 使用共享投影器读取已保存 Candidate，不读取未保存工作副本。
- [x] Preview 可完整验收所有 Block 与课程声明支持的人数配置。
- [x] Preview 可以签发绑定 exact Candidate 的 ViewAcceptanceReceipt。
- [x] Candidate 修改或不兼容投影器升级后，旧 ViewAcceptanceReceipt 自动失效。
- [x] 只有通过视图验收的 Candidate 才能创建 Test Classroom。
- [x] “UI 预览”直接使用真实 Test Classroom，不存在第二套 UI Preview 页面、API 或状态机。
- [x] Test Classroom 与 Production 使用同源 UI、API、ClassroomFactory 和状态机。
- [x] Test Classroom 完成全部课程和必检项后才能签发 UiAcceptanceReceipt。
- [x] UiAcceptanceReceipt 绑定 exact Candidate、Test Classroom、成员配置与四套课件版本。
- [x] 只有同时具备两级有效回执的 Candidate 才能转为 Released。
- [x] Production 只能从 Released 创建，并锁定课程与课件 exact revision/digest。
- [x] Studio 保存、发布、Preview、Test reset 不影响运行中的 Production。
- [x] `/studio/` 和 `/studio/releases/` 清楚显示每个版本的当前门禁及下一步操作。
- [x] `/course/` 统一标记为导师课件播放，不再被误解为完整课程。
- [x] `/classroom/` 统一标记为课堂中心，并清楚区分 UI 验收课堂与正式课堂。
- [x] 新导航不再暴露旧 `/alpha/`、`/control/` 和 `/control/editor/`。

## 十、与 T-085 的关系

本任务是 T-085 完成后的验收闭环补强，不推翻或复制 T-085 已实现的平台。

保留：

- 单一 CourseDefinition 真值。
- 单一课堂状态机。
- Candidate／Released 版本模型。
- ClassroomFactory。
- Test／Production 实例隔离。
- `4 + N + 1` Studio 投影。
- P/D/M/O CoursewarePackage 独立版本化。
- Account、Membership 和 Admin DM 权限模型。

新增：

- 可审计的 ViewAcceptanceReceipt。
- 两级回执的发布门槛。
- 从视图验收到真实 UI 验收的明确下一步操作。
- Studio、Courseware 与 Classroom 的导航分组和名称校准。
- Releases 对完整交付状态的统一展示。

## 优先级

- **P0：T-085 上线后的人工验收与正式课程发布门禁。**
- 应先补齐显式回执和导航，再用真实账号开展第一轮正式验收，避免测试完成但无法证明测试对应哪个 exact Candidate 或课件版本。

## 实施完成（2026-09-09）

- 状态：已完成、已推送、已部署到 Hecate 正式环境。
- 实现提交：`ed4831d7e68a6eb0fa7787263c01424224fe4bd8`。
- 生产验收回执提交：`3701427`。
- 生产 Release：`20260909T010657CST-t086-two-stage-acceptance-r1`。
- 生产回执：`docs/TODO_086_PRODUCTION_RECEIPT.json`。
- 新增 `ViewAcceptanceReceipt`、`UiAcceptanceReceipt` 与 Classroom 验收绑定数据模型。
- 打通 `Editor → Candidate → 多角色视图验收 → 真实 Test Classroom → UI 验收 → Released → Production` 的不可跳过闭环。
- Test 与 Production 共用 ClassroomFactory、UI、API 和状态机；Production 锁定验收过的 exact 课程与四套课件。
- Test reset、Candidate 变更、投影器或 build 不兼容变更会使对应回执失效；关键签发写入增加了并发条件校验。
- Studio 导航重组为“课程生产”、“资源管理”、“课堂交付”；`/course/` 明确为“导师课件播放”。
- 旧 `/alpha/`、`/control/`、`/control/editor/` 公网均返回 410。
- 自动验证：typecheck、lint、Course Platform 35/35、App Smoke/E2E、Studio Browser、部署测试 34/34、主题运行时、Shell 语法与 `git diff --check` 全部通过。
- 生产真实浏览器验收：Studio、Editor、View Acceptance、Releases、Classroom Center、Courseware Player 均通过；1440px/390px 无水平溢出，0 page error，0 request failure。
- 操作文档：`docs/COURSE_PLATFORM_SOP.md`、`docs/COURSE_PLATFORM_ARCHITECTURE.md`、`docs/TESTING.md`、`docs/MSV_SITE_MAP.md`、`docs/TODO_086_IMPLEMENTATION.md`。

注：上线后现有版本的两类回执初始计数为 0 是预期安全行为；迁移不伪造人工验收。课程负责人需从“多角色视图验收”开始，亲自为对应 exact Candidate 签发回执。

## 第二次架构校准：角色可见电子剧本（2026-09-09）

### 最终课堂模型

- 全课堂只保存 `unlockedThroughBlockId / unlockedThroughIndex / version`，不存在全局“当前页”。
- B01 初始可见；导师确认时只能顺序解锁下一页，其他窗口只收到通知，不被强制跳页。
- 导师、学员和投屏的浏览位置属于各自浏览器，以 `?block=Bxx` 表达；可在已解锁范围内用 `←／→／Home／End` 翻阅。
- 任意非最新已解锁页都显示“一键回到最新解锁”，回看后无需逐页翻回。
- Production 中 P／D／M／O 任一导师或 Admin DM 均可确认解锁；学员不可。建议主导师只决定内容分工，不决定权限。
- Test Classroom 的角色 Tabs 可真实切换中控、四导师、N 学员和投屏并调用对应 API；Production 服务端拒绝 `viewAs`。
- Activity 只按 `block + kind` 保存／更新；重新查看页面不会重新提交。RP、钱包、团队资金、卡牌和账本完全独立。

### 验收与迁移

- Stage 1 仍是内部桌面内容投影验收，支持完整字段、Hover／固定展开和键盘切 Block。
- Stage 2 仍使用真实 Test Classroom UI；所有页解锁并完成检查后，由 Admin DM 签发不可变 UiAcceptanceReceipt。
- `0007_decoupled_script_progress.sql` 只把旧 `blockIndex` 解释为已解锁边界；不删除、不重放、不重置任何既有业务记录。
- 新 App Build 使旧 UI 回执失效，必须按新的独立浏览、Test 角色切换和解锁通知检查重新验收。

### 完成回执

- 实现提交：`583a81d099a2e5209b112cdbaec21d3b166f00b5`，已推送 `origin/main`。
- Hecate Release：`20260909T150600CST-t086-script-runtime-r2`。
- App Build：`7c5ce67f-a337-434c-b03a-c8423a50d1f8`。
- 生产入口：<https://minisv.vip/classroom/>。
- 主仓库回执：`docs/TODO_086_SCRIPT_RUNTIME_PRODUCTION_RECEIPT.json`。
- 自动验收：Course Platform 48/48、浏览器 0 page error／0 request failure、Production DB `1 classroom / 1 progress / 0 missing / 0 invalid`、公网与 Hecate 健康检查全部通过。
