---
type: todo
id: T-085
title: "重构统一课程工厂、Course Studio 与 Classroom 运行体系"
status: done
created: 2026-09-08
updated: 2026-09-08
captured_by: project-inbox
architecture: docs/COURSE_PLATFORM_ARCHITECTURE.md
tags:
  - todo
  - mini-silicon-valley
  - course-studio
  - classroom
  - course-factory
  - courseware
  - membership
  - variable-seats
  - single-source-of-truth
---

# 重构统一课程工厂、Course Studio 与 Classroom 运行体系

## 原始需求与已确认方向

重新组织课程平台：

- 当前 `https://minisv.vip/course/` 中所谓“课程大纲”实际是 P 产品导师的 HTML/PPT 课件之一，不应继续代表整个课程。
- 建立 `/course/{slug}/` 课件库。P/D/M/O 导师可以制作和上传自己的 HTML 课件，在 Classroom 实例开始前指定本次应使用的课件链接。
- 课件不需要建立 Block → Slide 映射；导师在任意时刻从自己的角色卡打开已绑定课件。
- 将内部课程开发能力收口为 `/studio/` Course Studio，不需保留 `/control/`、`/control/editor/` 和 `/alpha/` 兼容入口。
- Studio 包含 Editor、多角色数据视图、Read Only Preview、课件库和发布管理。Preview 在当前页直接展示，不再弹出多个独立窗口。
- `/classroom/` 是对外正式上课系统，使用已预创建并分发的导师／学员账号，不要求学员自行注册和管理账号。
- 每个 Classroom 是一个由版本化课程原型创建的独立实例，拥有自己的成员、课件绑定、中控、进度、手牌、提交、账本和审计数据。
- Admin DM 是权限，不是第五个导师角色。它可分配给当前某位导师，也可分配给课堂外的独立账号。
- 导师账号通过 Membership 参与多个 Classroom，便于未来同时服务多个学生团队。
- 学员人数不得写死为 4。开发环境能设置支持范围和预览人数，Classroom 实例创建时可使用实际的 2、4、6 或课程允许的其他人数。
- 初期采用“一个 Classroom 实例＝一个学生团队”，四位 P/D/M/O 导师可通过多个 Membership 服务多个 Classroom。
- Classroom 同时支持 Test 和 Production 实例。Test 使用与正式课堂完全相同的 UI、API 与状态机，用于真实账号流程验收。

## 架构原则

### 1. 一份课程原型

`CourseDefinition` 是唯一可编辑课程真值。Studio 编辑和校验它；ClassroomFactory 只根据 exact CourseRelease 生成运行实例。

### 2. 一套状态机

Test 和 Production Classroom 必须执行同一套版本化课堂状态机。Studio Preview 使用纯投影器模拟可见状态，不再维护独立 Alpha 运行规则。

### 3. 两套体验，不是两套业务实现

- Studio 为课程开发者提供高密度、多角色、可编辑／只读的数据视图。
- Classroom 为真实导师和学员提供角色化、美化、可操作的正式课堂 UI。
- 两者共用 Course Schema、课程投影器、卡牌渲染器、字段语义和运行契约。

## 目标路由

```text
/studio/                              课程开发台
/studio/editor/                       所见即所得课程编辑器
/studio/preview/                      Read Only 多角色预览
/studio/courseware/                   导师课件库
/studio/releases/                     课程验收与发布
/course/                              课件播放入口
/course/{slug}/                       指定 HTML 课件
/classroom/                           今日课程／课堂列表
/classroom/{classroomId}/             角色化课堂 UI
/classroom/{classroomId}/control      该课堂的独立主控
/classroom/{classroomId}/screen       课堂投屏
/classroom/{classroomId}/members      Admin DM 账号与成员管理
```

不保留旧 `/control/`、`/control/editor/` 和 `/alpha/` 兼容入口。

## 可配置学员与发牌

### Course 级配置

- `defaultLearnerCount`、`minLearnerCount`、`maxLearnerCount`。
- `cardsPerLearner`。
- 不重复／可重复发牌策略。
- 通用学员任务模板和必要的席位覆写。

### Studio 验收

- 可一键切换 2、4、6 名学员或课程定义范围内的任意数量。
- 视图数量动态为 `4 导师 + N 学员 + 1 底部中控`，九视窗只是 N=4 时的默认布局。
- 人数与卡组容量、任务模板或验收规则不兼容时，需显示具体缺口并阻止发布。

### Classroom 实例化

- 实际只有 2 名学员时，不创建／显示两个虚假学员，推进门槛不得等待空席。
- 实际有 6 名学员时，必须生成 6 份私密视图，并在课堂开始前校验卡组容量。
- 不得使用固定 `learner01—learner04` 作为新架构的人数上限。

## 课件库与课堂绑定

### 第一阶段

- P/D/M/O 每个角色可指定一个默认课件。
- 数据模型保留课件拥有者和多课件能力，后续可让导师账号管理多套课件。
- Classroom 开始前，Admin DM 或导师选定本实例的课件指向。
- 导师在自己的角色卡中任意时刻打开课件，Controller 不自动翻页。

### 版本边界

- 上传或更新课件由系统自动生成新版本。
- 已开始 Classroom 绑定 exact 课件版本，不因 `/course/{slug}/` 的最新指针变化而静默更换。
- 课件版本管理对导师保持简单，不要求导师手工输入 digest。

## 账号、Membership 和 Admin DM

- 学员账号由 Admin DM 批量创建并分发，无自助注册依赖。
- 导师和学员都通过 Membership 加入 Classroom；账号与课堂实例解耦。
- 一个导师账号可在多个 Classroom 中分别承担 P/D/M/O 角色。
- Admin DM 作为 Classroom 权限单独授予，可与导师席位重合，也可是不占席的课堂外账号。
- Classroom Admin 不自动继承平台管理员权限。

## Test 与 Production

### Test Classroom

- 使用完全相同的 Classroom UI、API 和状态机。
- 允许 Candidate，允许重置，使用测试账号和隔离数据。
- 用于四人双浏览器／双账号的真实 UI 端到端课堂测试。
- 验收回执绑定 exact CourseRelease 和 CoursewarePackage 版本。

### Production Classroom

- 只允许 Released CourseRelease。
- 开始后锁定课程和 P/D/M/O 课件版本。
- 保存正式学习档案、统计和审计。
- Studio 保存、新发布或 Test 重置对运行中 Production Classroom 为零副作用。

## 实施分阶段

### Phase 0：收口代码与数据责任

- 盘点当前主工程中 Course Package、LIVE RUN controller 与 Alpha 的能力。
- 将当前独立 `mini_silicon_valley_world` 工程中的 Classroom 账号、Room、动作、账本与 UI 源码纳入统一工程边界。
- 停止新功能继续写入旧 Classroom Campaign 或独立 Alpha 运行真值。

### Phase 1：建立课程工厂与版本模型

- 定义 CourseDefinition、CourseRelease、CoursewarePackage、ClassroomInstance、Team、Account、Membership 和 ControllerState Schema。
- 实现唯一 ClassroomFactory，Test/Production 通过参数而非分支代码创建。
- 将 CourseRelease 和 ClassroomInstance 的真值／状态分离。

### Phase 2：重建 Course Studio

- 建立 `/studio/` 信息架构，迁移 Editor、Preview、Courseware 和 Releases。
- 将 T-083 的固定九视窗升级为 `4 导师 + N 学员 + 1 底部中控`。
- Studio Preview 与 Editor 使用同一页面画布与共享渲染器，不打开多窗口。
- 增加学员人数、发牌 seed、预览状态与容量校验控件。

### Phase 3：建立导师课件库

- 将当前 `/course/` 内容迁移为 P 导师课件包，清除其“完整课程大纲”语义。
- 建立 HTML 课件上传、校验、版本化、预览和发布能力。
- 在导师角色卡和 Admin DM 视图提供课件超链接。

### Phase 4：重构 Classroom 与账号分发

- 建立课堂列表、今日课程、创建 Classroom、创建 Team 和批量创建账号流程。
- 注册不作为学员进入课堂的必经流程。
- 实现 Membership、P/D/M/O 席位、Admin DM 授权和多 Classroom 导师工作台。
- 按实际学员人数生成角色化 UI，不再固定八账号的数据上限。

### Phase 5：课堂实例主控与真实 UI

- 将课程中控改为按 `classroomId` 绑定的 ControllerState。
- 实现 `/classroom/{id}/control`、角色化今日课程和课堂投屏。
- 用统一 CourseRelease 投影五步、Block、卡牌、PDMO 导师和 Demo，停止继续使用旧 Classroom Campaign 真值。

### Phase 6：Test/Production 发布闭环

- Studio 保存生成不可变 Candidate。
- Test Classroom 绑定 Candidate，用真实 UI 和测试账号执行完整课堂。
- 验收 exact digest 后发布 Released，Production Classroom 只能选择 Released。
- 完成迁移后删除旧 Alpha 多弹窗、全局 Run 和旧路由。

### Phase 7：内部 Studio 权限

- 为 `/studio/` 增加内部账号、RBAC 与审计。
- 该阶段当前不紧急，但上线前必须完成威胁模型；权限缺失期间不得放入真实账号、密钥或未脱敏数据。

## 验收标准

### 课程真值与工厂

- [x] Studio 是 CourseDefinition 的唯一写入入口，不存在可独立修改的 Alpha/Classroom 课程正文。
- [x] Test 和 Production Classroom 由同一 ClassroomFactory 从 exact CourseRelease 创建。
- [x] 两种 Classroom 执行同一状态机；仅权限、可选版本和数据持久化策略不同。

### Studio

- [x] `/studio/editor/` 可视化编辑 `4+N+1` 视图，顶部为课程时序轴，底部为课程中控。
- [x] `/studio/preview/` 直接在页内 Read Only 展示已保存 Candidate，无独立席位弹窗。
- [x] 可切换学员人数并即时看到视图、任务和发牌容量变化。
- [x] 旧 `/control/`、`/control/editor/` 和 `/alpha/` 不再作为新系统入口。

### 课件库

- [x] 当前 `/course/` 产品导师课件已正确分类，不再显示为整个课程大纲。
- [x] P/D/M/O 导师可上传、预览和版本化自己的 HTML 课件。
- [x] Classroom 开始前可为四位导师指定课件；开始后指向被锁定。
- [x] 导师可在自己的角色卡中任意时刻打开课件，不需要 Block → Slide 映射。

### Classroom 与账号

- [x] Admin DM 可创建 Classroom、Team、预创建导师／学员账号并分发凭据。
- [x] 学员可直接使用分发凭据登录，无需自行注册。
- [x] Admin DM 权限可授予导师或课堂外独立账号，不占用 P/D/M/O 席位。
- [x] 导师账号可通过 Membership 同时查看和进入多个 Classroom。
- [x] 每个 Classroom 拥有独立 ControllerState，不存在跨课堂的全局进度污染。

### 动态学员人数

- [x] N=2 时无虚假空席、无固定四人门槛，可执行完整课程。
- [x] N=4 时保持当前默认教学体验。
- [x] N=6 时生成 6 份隔离视图，并在卡组容量不足时阻止开课与发布。
- [x] 玩家数量、卡数、每人手牌数和不重复规则有自动契约测试。

### 真实 UI 测试与发布

- [x] Test Classroom 与 Production Classroom 的页面、API、状态机和课件入口同源。
- [x] Candidate 经真实 Test Classroom 端到端验收后才能成为 Released。
- [x] Production Classroom 仅能选择 Released，开始后锁定 exact 课程与课件版本。
- [x] Studio Preview、Test 重置、课程保存和新版本发布对运行中 Production Classroom 零副作用。

## 旧 Todo 的整合关系

- **T-070** 的八个独立 Alpha 窗口降级为旧调试实现，不再是目标产品。
- **T-075** 保留单一课程真值、Candidate/Released 和 exact digest 原则；用 Studio／ClassroomFactory／Test-Production 实例替换“Editor、Alpha、Classroom 三端”表述。
- **T-077** 中将 `chj` 整站当作课程大纲的方向取消；当前内容作为 P 导师课件迁入 Courseware Library。
- **T-083** 保留时序轴、所见即所得和底部中控；将固定“4 导师＋4 学员＋1 中控”修正为 `4+N+1`。

## 交付物

- `docs/COURSE_PLATFORM_ARCHITECTURE.md` 持久架构决策。
- 统一领域 Schema 与版本化状态机。
- Course Studio 的 Editor、Preview、Courseware 和 Releases。
- 课件库、课件版本和 Classroom 课件绑定。
- 支持可变学员人数的 ClassroomFactory。
- 预创建账号、Membership、Admin DM 和多 Classroom 管理。
- 每个 Classroom 独立主控、角色 UI 与课堂投屏。
- Test/Production 真实 UI 测试与发布闭环。

## 优先级

- **P0：平台架构与课程交付主线。**
- 执行顺序必须先统一对象、状态机和路由责任，再大规模制作 Studio/Classroom UI，避免继续建设两套需要重复验收的系统。

## 实施回执

### 完成结论

T-085 已于 2026-09-08 完整实施、测试、提交、推送并部署到 Hecate。生产环境现在由一份版本化 `CourseDefinition`、一套 `ClassroomFactory` 和同一课堂状态机驱动；Course Studio、Test Classroom 与 Production Classroom 不再维护平行真值。

### 代码与不可变发布

- 主实现提交：`8e55eec19ec53cf5c139343624d9aadd30312ac0`。
- 发布校验加固：`119bd6a0c04dcb7ba5c15c8e12f44961152c9785`。
- Hecate 发布脚本修复：`31c806c8f45b177827b7d5bb8ccfad32adfce22f`。
- 移动端账号导航可访问性修复：`86df01b618be2bb88b577458cc719e96a555bebc`。
- 最终生产 Release：`20260908T182550CST-t085-unified-course-platform-r4`。
- App Build ID：`6a56ea81-4ce8-4e62-8bd2-9752a6fee0df`。
- 部署前课堂数据备份：`~/Services/minisv/backups/20260908T102943Z-20260908T182550CST-t085-unified-course-platform-r4/`。
- GitHub `main` 已推送，工作树与 `origin/main` 一致。

### 已交付平台能力

1. `CourseDefinition → Candidate CourseRelease → Test Classroom → exact 验收回执 → Released → Production Classroom` 已形成唯一发布链。
2. `/studio/editor/` 是课程正文唯一写入口；`/studio/preview/` 使用同一投影器在页内显示 `4 位导师 + N 名学员 + 1 个中控`。
3. Studio 可在 2／4／6 人及课程允许范围内切换；人数、任务模板、卡组容量、不重复发牌规则不满足时服务端失败关闭并说明缺口。
4. P／D／M／O 课件进入版本化 Courseware Library；课堂开始前绑定 exact revision/digest，开始后锁定。
5. P 导师同事课件按批准的 Git 身份原样发布，没有注入主题、改写页面或复制成第二份课程真值。
6. Test 与 Production 使用相同页面、API、工厂及状态机；Production 只接受 Released，运行中实例不受 Studio 后续保存、发布或 Test 重置影响。
7. Account 与 Classroom 通过 Membership 解耦；导师可以进入多个课堂；Admin DM 是课堂级权限，可与导师席重合，也可由课堂外账号承担。
8. 每个 Classroom 拥有独立成员、课件绑定、私密手牌、提交、账本、ControllerState、屏幕投影与审计数据。
9. 一次性初始密码必须先更换才可访问平台数据；课堂投屏使用独立白名单投影，不读取学员私密席位载荷。
10. `/alpha/`、`/control/` 已返回 `410 Gone`；旧全局 Run 服务与 `18790/18791` 端口均已停用。

### 生产入口

- Course Studio：`https://minisv.vip/studio/`
- Editor：`https://minisv.vip/studio/editor/`
- Read Only Preview：`https://minisv.vip/studio/preview/`
- Courseware Library：`https://minisv.vip/studio/courseware/`
- Releases：`https://minisv.vip/studio/releases/`
- 课件入口：`https://minisv.vip/course/`
- Classroom：`https://minisv.vip/classroom/`
- 课堂实例：`/classroom/{classroomId}/`
- 实例中控／投屏／成员：`/classroom/{classroomId}/control`、`screen`、`members`

### P 导师原样课件证据

- 来源 commit：`679213a61b835335016eac7649213983a0e48489`。
- 来源 tree：`3a041c4714190cc026f6de8e06e15cec0e5f765d`。
- 发布路径：`/courseware/product-mentor-foundations/`。
- 文件数：103；总字节：114,367,157。
- 目录 SHA-256：`347697696787065721fc66ac7d756e8c56338f646bc1a5aba51392133c835b04`。
- `transformed=false`；未修改 `cowork/chj` 同事原稿。

### 自动测试与真实生产验收

- `npm run test:release`：通过。
  - 核心构建与契约测试：27/27。
  - 全量历史、课程、UI、文档、课堂与部署契约：121/121。
  - Google 与饿了么双案例五章 Classroom E2E：通过。
  - Work App 与 Minisv App 登录、RBAC、账号、成员流程冒烟：通过。
  - Course Platform E2E：Candidate 验收发布、Production 隔离、课件锁定、2/6 人实例、18 张私密卡重置、投屏脱敏、容量门、初始密码强制修改、Admin DM 权限重合全部通过。
- Course Platform 定向契约：26/26；Hecate 发布 Python 测试：35/35。
- 公网无密钥冒烟：HTTP→HTTPS、静态入口、受保护入口、404、410、课件原样身份与 Hecate 响应头全部通过。
- 真实生产认证冒烟：Admin 登录、3 个版本、4 个导师课件、Studio Bootstrap、Classroom API、课件入口、登出及旧 Cookie 撤销全部通过。
- 移动端 430×932 CDP 视觉验收：文档宽度 430、无横向溢出；UI 风格切换器位于导航内联槽；收起链接为 `display:none`，不存在被浮层遮挡但仍可聚焦的链接。
- Hecate 服务验收：统一 Classroom Worker 与 Cloudflare Tunnel 正常；旧 Alpha/LIVE RUN 两个 LaunchAgent 不存在；生产 `current` 精确指向最终 Release。

### 发布失败关闭验证

最终发布前，一份根目录层级错误的手工 tar 包被部署器以 `unified release archive incomplete` 在服务切换前拒绝，生产未发生变更。随后使用版本库内唯一 `archive_bundle` 实现重新生成、校验并部署，证明发布边界能在输入不完整时失败关闭。

### 后续验收流程优化

T-085 保持完成状态。上线后的“多角色视图验收 → Test Classroom 真实 UI 验收 → Released → Production”显式两级回执、导航和发布门禁优化，统一转入 **T-086** 跟进。
