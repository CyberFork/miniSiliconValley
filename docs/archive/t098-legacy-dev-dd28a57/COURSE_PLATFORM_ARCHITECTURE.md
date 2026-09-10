# Mini Silicon Valley 课程平台架构

> 状态：已确认的目标架构  
> 日期：2026-09-08  
> 实施总任务：T-085

## 1. 核心决策

Mini Silicon Valley 只保留一份课程真值和一套课堂状态机，在此基础上提供两个环境：

1. **Course Studio 内部课程开发环境**：课程编辑、多角色数据视图、课件库、Read Only 预览、校验与发布。
2. **Classroom 正式课堂环境**：预创建账号、真实团队协作、角色化课堂 UI、投屏、每个课堂实例的独立中控与持久化状态。

两个环境可以有不同的信息密度和 UI，但不得形成两份课程 JSON、两套推进规则或两套卡牌真值。

## 2. 工厂模式类比

课程开发环境产生的不是一场正在运行的课堂，而是可被实例化的版本化课程原型。

```text
CourseDefinition            课程原型／类
CourseRelease               已编译、不可变的类版本
ClassroomFactory.create()   课堂实例创建器
ClassroomInstance           一场具体的课堂实例
ControllerState             该实例独立的运行状态
```

```text
Course Studio
  ↓ 编辑与保存
Candidate CourseRelease
  ↓ Classroom Test Instance 真实 UI 验收
Approved Candidate
  ↓ 发布
Released CourseRelease
  ↓ ClassroomFactory.create(config)
Production ClassroomInstance
```

Classroom 实例只持有 exact `courseId + revision + digest` 引用和自己的运行状态，不再复制一份可独立编辑的课程正文。

## 3. 目标路由

### Course Studio（内部）

```text
/studio/             内部课程开发台
/studio/editor/      课程编辑器和所见即所得视图
/studio/preview/     已保存 Candidate 的 Read Only 多角色预览
/studio/courseware/  P/D/M/O 导师课件库与上传管理
/studio/releases/    Candidate、测试回执与 Released 管理
```

### 导师课件播放

```text
/course/             已发布课件入口／课件库
/course/{slug}/      一套可播放的 HTML 课件
```

当前 `/course/` 中被称为“课程大纲”的内容，实际应归类为 **P 产品导师课件之一**，不再代表整个课程真值。

### Classroom（正式交付）

```text
/classroom/                        用户的课堂列表／今日课程
/classroom/{classroomId}/          当前角色的真实课堂 UI
/classroom/{classroomId}/control   该课堂的独立主控
/classroom/{classroomId}/screen    课堂内共同投屏视图
/classroom/{classroomId}/members   Admin DM 成员与账号管理
```

旧 `/control/`、`/control/editor/` 和 `/alpha/` 不作为目标架构的兼容入口；新系统直接按 `/studio/` 和 `/classroom/` 的职责重建。

## 4. 领域对象

### CourseDefinition

唯一可编辑课程原型，包含：

- 一世界、两轨线、三玩法、四导师、五步骤、六分钟 Demo。
- 五个 Macro Step 和所属 Block。
- 中控脚本、导师任务、学员任务、验收条件和系统动作。
- 卡组、卡牌、来源、F/R/G/U 边界和发牌策略。
- 学员人数支持范围与默认值。
- P/D/M/O 默认课件指向。

### CourseRelease

CourseDefinition 每次保存产生的不可变版本：

```json
{
  "courseId": "eleme-five-step",
  "revision": 12,
  "digest": "sha256:...",
  "status": "candidate"
}
```

对用户只暴露简化的“保存、测试、发布”流程，不要求用户管理独立 Draft 列表。

### CoursewarePackage

由导师创建或上传的 HTML 课件：

- 拥有者账号、标题、slug、适用导师角色和版本。
- 不要求建立 Block → Slide 细粒度映射。
- 导师可以在任意时刻从自己的课堂角色卡打开已选课件。
- 上传新内容自动产生新的不可变课件版本，不原地改写已开始课堂引用的版本。

### ClassroomInstance

一场具体课堂，包含：

- `environment: test | production`。
- exact CourseRelease 引用。
- 课堂开始前选定的 P/D/M/O 课件版本。
- 四个导师席位和可配置数量的学员席位。
- 当前 Block、执行／验收状态、手牌、提交、RP、钱包、团队资金与审计日志。
- 一个与本实例绑定的 ControllerState。

### Account 与 Membership

- Account 是可在多个 Classroom 中复用的身份，不嵌入单个 Classroom 文档。
- Membership 将账号绑定到某个 Classroom、Team 和席位。
- 导师 Membership 可指定 P/D/M/O；一个导师账号可同时参与多个 Classroom。
- Admin DM 是权限，不是第五个导师席位。它可分配给当前某位导师，也可分配给课堂外的独立账号。

## 5. 可配置学员人数

当前“4 导师＋4 学员＋1 中控”只是默认模板，不是永久数据假设。

CourseDefinition 需要声明：

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

ClassroomFactory 创建实例时选择实际学员人数，并必须校验：

- 课程是否支持该人数。
- 每阶段卡牌数是否满足 `learnerCount × cardsPerLearner` 的不重复发牌需求。
- 八席任务中原本写死的 `learner01—learner04` 是否能由通用学员模板和必要的席位覆写生成。
- 实际只有 2 名学员时，UI 不显示两个虚假学员，课程门槛不依赖未使用席位。
- 设置 6 名学员时，Studio 预览和 Classroom 动态生成 6 个学员视图，并在发牌容量不足时阻止开课。

四个 P/D/M/O 导师席位仍是课程骨架。初期保持“一个 Classroom 实例＝一个学生团队”；四位导师通过多个 Membership 服务多个 Classroom。

## 6. Course Studio 视图

### Editor

- 唯一写入口。
- 顶部显示五大步／Block 时序轴。
- 中间显示 4 导师＋N 学员的所见即所得视图。
- 底部显示课程中控视图。
- 点击可见文案编辑唯一 CourseDefinition 字段；派生的 RP、钱包、进度和随机手牌状态不写回课程原型。

### Preview

- 与 Editor 在同一页面画布中直接展示，不再打开多个独立窗口。
- 读取已保存 Candidate，课程内容 Read Only。
- 可切换 Block、学员人数、固定发牌 seed 和预览状态。
- 应与最终 Classroom 共用课程投影器和核心渲染组件，而不是再复制一套 Alpha UI。

Studio 将来需要内部账号与权限系统，但该工作不阻断第一阶段架构重构。在权限未上线前，不得在公网无保护页面暴露账号、学员数据、内部回执、密钥或未脱敏私密课件。

## 7. Classroom 运行视图

Classroom 只显示当前登录人应该看到的真实 UI：

- **学员**：今日课程、当前任务、私密卡、协作、提交、RP、钱包与作品。
- **P/D/M/O 导师**：当前任务、观察重点、专业线信息、团队状态和“打开我的课件”。
- **Admin DM**：课堂主控、全角色状态、账号、Membership、异常处理和审计。
- **课堂大屏**：全班共同内容，不暴露私密卡、导师讲稿、账号、个人钱包或未公开提交。

导师课件可在任意时刻通过超链接新窗口打开，不由 Controller 自动翻页。

## 8. Test 与 Production Classroom

Studio Preview 只能验证数据投影，不能代替真实 Classroom UI 测试。Classroom 运行时因此支持两种实例模式：

### Test ClassroomInstance

- 使用与正式课堂完全相同的 UI、API 和状态机。
- 可绑定 Candidate。
- 使用测试账号和测试数据命名空间。
- 可重置，不进入正式学习档案与统计。
- 可由 4 名测试人员分别使用两个独立浏览器会话，测试一个导师账号和一个学员账号。

### Production ClassroomInstance

- 只能绑定 Released CourseRelease。
- 课堂开始后锁定 exact course 与 courseware revision/digest。
- 运行数据进入正式档案、统计和审计。
- 不得被 Studio 保存或发布新版本静默修改。

Test 与 Production 是同一 ClassroomFactory 创建的两种实例，不是两套课堂系统。

## 9. 账号与 Admin DM

- 学员不自行注册和管理账号。
- Admin DM 创建 Classroom 和 Team 后，批量创建或选择导师／学员账号，再分发简化登录凭据。
- Admin DM 可重置密码、调整 Membership、停用账号和查看操作审计。
- 密码只保存强哈希；初始凭据仅显示给有权限的 Admin DM，支持重新生成。
- 系统级管理员和 Classroom 级 Admin DM 分开授权，避免任何 Classroom Admin 默认获得全站权限。

## 10. 单一状态机

所有 Test/Production ClassroomInstance 执行同一套版本化课堂状态机：

```text
ready → executing → awaiting-acceptance → accepted → next block
                            └→ rejected/retry
```

- 中控按 `classroomId` 读写 ControllerState，不再使用一个全局 Run 控制所有课堂。
- CourseDefinition 声明规则；ClassroomInstance 仅保存当前运行状态和产生的课堂事件。
- Studio Preview 使用无副作用 Preview Projector 生成同样的可见状态，但不写入 ControllerState。

## 11. 不可破坏的约束

- 课程编辑器是唯一课程写入入口。
- Studio 和 Classroom 不复制课程正文。
- Test 与 Production 不共用运行数据、成员数据、账本或审计命名空间。
- Admin DM 权限不等于 P/D/M/O 导师身份。
- 学员数量不写死为 4，但实例化必须通过课程和发牌容量校验。
- 课件不要求 Block 级自动翻页映射，但已开始课堂需要锁定课件版本。
- 课堂大屏只是课堂内共享视图，不代表无鉴权公网发布。
- 正式课堂必须在 Test Classroom 的真实 UI 验收后才能使用对应 Released digest。

