# T-095 → T-092｜课程字段、数据一致性与导师课件上线

## 当前实施队列（2026-09-11）

上一阶段 T-095 → T-092 已完成并保留在本文下方作为交付记录。当前主线转入平台一致性、可验收性与对外／对内入口收口；T-110、T-111 已正式纳入同一实施队列，不作为孤立补丁处理。

```text
T-102 验收身份与课堂完成语义
→ T-110 全站普通点击与 Studio 首屏基线
→ T-108 课堂创建空态、门禁原因与恢复入口
→ T-111 多 Test Classroom、exact 版本选择与安全归档
→ T-106 / T-107 账户入口、菜单与账号切换
→ T-105 Studio 数据可见范围与账号准入
→ T-103 / T-104 投影、文案、人工审核与 QA 收口
→ T-109 官网／World／上课／课件／Studio 信息架构重组
→ T-110 / T-111 在新信息架构下再次全量回归
→ T-088 iPad 真实设备验收
→ T-097 总审计关闭
```

### T-110 队列职责

- 建立全站导航基线，不能只修一个链接或把 Ctrl／Cmd＋点击当作成功。
- 覆盖普通左键、Enter、触摸、前进后退、深链刷新、登录回跳、慢网与失败重试。
- Studio 首屏只加载当前必要 exact 版本；历史按需读取，诊断请求不阻塞编辑。
- T-109 完成信息架构迁移后必须复跑同一清单，防止新首页或导航再次引入回归。

### T-111 队列职责

- 同一账号可同时保留 r9、r12 等不同 exact 版本，以及同版本多场独立 Test Classroom。
- TEST 区顶部始终能发现“新建测试课堂”；缺回执、课程、账号或权限时展示具体原因和可点击修复入口。
- 旧测试课堂采用可审计、永久只读的安全归档；继续测试通过同一 exact 版本新建实例，不实施原地恢复或破坏性硬删除。
- 重置、归档、创建和版本选择复用 T-101 的 run identity、CAS、幂等与原子更新，并遵守 T-102 的回执／构建身份语义。
- 所有新入口纳入 T-110 的普通点击、键盘和触摸回归。

### 当前阶段不可妥协约束

- Test 与 Production 使用同一 ClassroomFactory、UI、API 与状态机，但数据、权限和回执严格隔离。
- 课程、课件、构建和课堂运行均使用 exact 身份；不得把 r9 回执复用为 r12，也不得静默升级既有课堂。
- 自动化只能生成工程测试证据，不能代签人工 View／UI 验收回执。
- 只部署到 Hecate 上的 `minisv.vip`；不触碰 `cyberforker.com` 或 Windows 临时服务。
- 每项 Todo 完成前必须通过定向测试、全量平台测试、构建、真实浏览器导航验证和部署后冒烟。

### 当前实施检查点（2026-09-11）

- T-102：已完成并推送。
- T-110：首轮导航与 Studio 首屏基线已完成并推送；T-109 后仍需总回归。
- T-108：已完成并推送。
- T-111：已完成并推送；同 exact／跨 revision 多 Test、显眼新建入口、完整身份卡、原子只读归档、回执历史化和真实编译 UI 浏览器回归均通过。
- T-106／T-107：实现与隔离浏览器验收完成；服务端浏览器账号集合、A／B 直接切换、退出当前／全部、跨标签身份守卫、官网账号入口和响应式可读性均通过。当前收尾文档并提交，下一项为 T-105。

## 主棍

一份可追溯的 `CourseDefinition` 生成编辑器预览、Test Classroom 中控、导师席和学员席；课件作为独立、不可变的 `CoursewarePackage` 通过统一的登录后 `/course/` 目录播放。

```text
CourseDefinition Candidate
→ 六个稳定学员席与字段身份校验
→ Studio 多角色视图验收
→ exact Test Classroom（锁定 revision + digest）
→ P 导师饿了么课程包复验
→ P 课件上线统一目录
→ D 课件沿用同一目录、认证和播放器
```

## 实现顺序

1. **T-095｜用户字段与六席隔离**
   - 每个可编辑字段具有稳定 `fieldId / scope / ownerId / JSON path`。
   - P/D/M/O 与 learner01—learner06 专属字段均为独立节点。
   - 人数减少只停用席位，不静默删除其内容。
   - 卡片 ID、模板深复制、全局字段影响提示和隔离回归测试完整。
2. **T-094｜Editor、Preview、Test Classroom 与中控一致性**
   - 四端显示并使用相同 `courseId / courseDataId / revision / digest`。
   - Test Runtime 显示 classroom/run/block/seat/deal/state/reset 等诊断身份。
   - B01 固定 seed 投影与实际发牌逐字段一致，并能识别旧课堂与当前 Candidate 的差异。
3. **T-091｜重新验收 P 导师饿了么课程包**
   - P 拥有饿了么历史案例与 B01—B04 检查点；D/M/O 不重复主讲。
   - F/R/G/U 来源边界、私密卡、Product Brief 与 P 课件 exact 引用通过测试。
4. **T-096｜统一 `/course/` 目录并首先上线 P 课件**
   - 登录后的导师和学员均可只读访问 Released 静态课件。
   - 匿名访问完整保留 returnTo；Candidate、测试身份和管理操作不泄漏。
   - P 与 D 原始静态资源使用同一鉴权和 `no-store` 规则。
5. **T-093｜D 课件已解锁进度跳转复验**
   - 已解锁段可点击与键盘操作；未解锁段不可泄漏；URL 保留 revision/slide/step。
6. **T-092｜D 课件沿用统一目录与播放器复验**
   - 复用现有稳定身份 `cw-development-mentor-ligun / development-mentor-ligun / r0`，不创建第二套 slug。
   - 新课堂锁定 exact 课件；既有课堂不可被新 Candidate 静默覆盖。

## 不可妥协约束

- 不修改既有不可变 Candidate、Released JSON 或其 digest；修复产生新的 Candidate revision。
- 不伪造人工 `ViewAcceptanceReceipt` 或 `UiAcceptanceReceipt`。
- 编辑器、Preview 和 Classroom 共用同一套服务端投影契约；浏览器副本必须有契约测试。
- 课程正文、课件资源和课堂运行状态分层：运行时手牌、提交、RP、钱包和资金不得写回 CourseDefinition。
- 学员只看到其席位私密内容；课件目录只暴露 Released 静态课件，不显示导师讲稿、rubric、其他学员数据或管理入口。
- 生产根域为 Hecate 的 `minisv.vip`；不触碰 `cyberforker.com`。
- 部署前必须完成 typecheck、lint、课程平台测试、构建、浏览器／E2E 回归与生产冒烟。

## 验收

- 修改 learner01/P 导师/任一卡片边界，只改变对应 owner；global 修改明确列出影响范围。
- 2、4、6 人配置均能显示稳定席位；learner05/06 有独立任务字段与发牌身份。
- 同一 exact CourseDefinition 的 B01 在 Editor Preview、Studio Preview、中控与席位的可见数据一致。
- Test Classroom 可复制诊断身份并明确显示“与当前 Candidate 相同／不同”；旧课堂保持原 revision。
- `/course/` 从真实 Courseware 注册表只列出 P、D 已发布静态课件；导师与学生均能只读播放。
- 匿名 P/D 深链登录回跳不丢 `revision / slide / step`；原始静态路径无法绕过鉴权。
- P 课程包先完成复验与上线；D 的进度跳转和上线随后沿用同一机制完成。

## 完成状态（2026-09-10）

- T-095：完成；六席、981 字段身份和新 Candidate r11 已进入生产 Studio。
- T-094：完成；Editor／Preview／Test Controller／Seat 使用同一 exact 投影与运行身份契约。
- T-091：完成工程复验；P B01—B04、ProductBrief 与 P→D 交接通过，人工视图验收仍由团队执行。
- T-096：完成；统一 `/course/` 已在 Hecate 上线，真实导师和学员可只读访问 Released P/D。
- T-093：完成并复验；D 课件 18 段进度跳转、锁边界、刷新恢复和深链均通过。
- T-092：完成；D r0 使用同一目录、认证、播放器与缓存策略上线。

生产 release：`20260910T020748CST-t095-t096-course-platform-r3`。课程 r11 保持 Candidate；系统没有伪造人工 View/UI 回执，也没有创建 Production Classroom。

## M 导师课件扩展（2026-09-10）

- 将 `cowork/课件/user-system-slides.html` 归集为 M 导师 49 页“产品的用户体系”不可变静态课件。
- `cowork/课件` 顶层统一为 `product-courseware / development-courseware / market-courseware`。
- M 课件沿用 `/course/` 目录、第一方账号、cookie-only 静态鉴权和 exact revision／digest 机制。
- 修复快速首尾跳转、深链恢复、查询参数保留、密集页适配和外部字体依赖后再发布。
- 已以 `20260910T032647CST-market-mentor-user-system-r2` 部署到 Hecate；真实导师／学员与匿名边界均通过生产验收。
