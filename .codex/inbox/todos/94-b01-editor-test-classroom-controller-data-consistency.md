---
type: todo
id: T-094
title: "查清并修复B01编辑器、测试课堂席位与中控内容不一致"
status: completed
created: 2026-09-09
updated: 2026-09-10
captured_by: project-inbox
courseware_role: P
priority: P0
estimated_effort: small-medium
related:
  - T-075
  - T-085
  - T-086
  - T-091
  - T-095
tags:
  - todo
  - mini-silicon-valley
  - b01
  - course-editor
  - test-classroom
  - controller
  - revision
  - digest
  - card-deck
  - single-source-of-truth
---

# 查清并修复B01编辑器、测试课堂席位与中控内容不一致

## 一、现场问题

用户在同一门课程的 B01 中观察到三处内容不一致：

1. 课程编辑器／编辑预览中的私密卡。
2. Test Classroom中的真实学员席位视图。
3. 同一个Test Classroom中的课程中控内容。

截图中可以直接看到卡片组合不同。

### 编辑预览中可见的部分卡片

```text
R 课堂模拟：餐厅同时顾堂食和电话
F 有来源：需要隐藏的信息
F 有来源：你的案发经历
```

### Test Classroom学员4中可见的部分卡片

```text
F 有来源：需要隐藏的信息
F-02：电话和餐厅信息是早期入口
F 有来源：你的公开表态
```

测试课堂中控也没有与课程编辑器显示相同的B01内容。用户认为它们是同一份课件，因此怀疑系统实际使用了两份课程JSON。

## 二、初步判断

从截图本身还不能确定唯一根因，但当前最可能的情况不是简单的“两份同名JSON”，而是系统没有向用户说明以下三层数据的区别：

```text
CourseDefinition
编辑器中的当前草稿／Candidate，是唯一可编辑课程真值

CourseRelease
某一次不可变的revision与digest

ClassroomInstance
从exact CourseRelease创建的测试课堂实例，另有当前Block、发牌seed、席位手牌和提交状态
```

很可能出现了以下情况：

- 编辑器显示当前草稿或较新的Candidate。
- Test Classroom仍锁定创建时使用的旧CourseRelease。
- 学员席位显示该课堂根据Membership和发牌seed产生的真实手牌。
- 编辑预览显示的是固定预览seed或模拟席位，并非当前Test Classroom学员4的真实快照。

如果课程中控和所有真实席位都一致，只与编辑器不同，通常说明 **Classroom锁定旧revision**。这本身符合“已开始课堂不能被编辑器静默覆盖”的原则，但界面必须显示版本差异，并提供显式创建／刷新测试实例的操作。

如果三者显示相同 `courseId + revision + digest + classroomId + runId + blockId + seatId + seed` 后内容仍不同，则属于严重实现错误，可能存在：

- Editor和Classroom使用不同投影器。
- Controller从旧缓存或旧JSON回退。
- 运行实例复制了另一份课程正文。
- 卡片ID、顺序或角色过滤规则在不同端各实现了一次。
- 刷新后客户端仍保留旧payload。

## 三、必须先回答的问题

对同一次复现，记录以下完整标识：

```text
courseId
courseSlug
editorMode：draft／candidate／released／classroom snapshot
revision
digest
releaseStatus
classroomId
runId
blockId：B01
controllerStateVersion
seatId／membershipId
playerCount
cardDeckId与cardDeckRevision
dealSeed
issuedCardIds及顺序
refreshEpoch／cache版本
```

没有这些标识时，界面不能笼统地把三处内容都标成“同一份课件”。

## 四、同一底层JSON与显式数据ID契约

课程编辑器、Studio Preview、Test Classroom中控和Test Classroom各席位必须从**同一份底层课程JSON谱系**读取课程正文，不能各自保存或维护一份内容副本。

每个课程JSON至少包含：

```json
{
  "courseId": "CRS-ELEME-001",
  "courseDataId": "CRS-ELEME-001-R012",
  "revision": 12,
  "digest": "sha256:..."
}
```

字段语义：

```text
courseId
同一门课程长期稳定的业务编号，不因保存新版本而改变

courseDataId
某一份不可变JSON快照的唯一编号；不同内容必须拥有不同数据ID

revision
便于人阅读和排序的版本号

digest
由完整规范化JSON计算的内容摘要，用于机器确认内容逐字节一致
```

仅显示 `courseId` 不能证明两处使用同一份数据，因为同一门课程可以存在多个revision。要确认“完全相同的底层JSON”，至少需要比较：

```text
courseDataId + revision + digest
```

### 数据ID生成规则

- `courseId`在创建课程时由系统生成，不允许编辑器随意修改。
- 每次保存为新的不可变Candidate快照时生成新的`courseDataId`和revision。
- 相同规范化JSON应得到相同digest；任何课程正文、Block、卡牌、来源或行动要求变化都必须改变digest。
- ClassroomInstance只引用`courseDataId + revision + digest`，不能复制出一份可单独编辑的课程正文。
- 运行中的手牌、已读、公开、提交和中控状态属于ClassroomInstance，不进入或改写课程JSON。

### ID展示位置

至少在以下位置提供肉眼可见、可以复制的数据ID：

1. **课程编辑器顶部状态栏**：持续显示当前Draft／Candidate的课程ID、数据ID、revision和短digest。
2. **Studio Preview顶部状态栏**：显示当前预览对应的数据ID，并标明预览模式和固定seed。
3. **Test Classroom中控顶部或“课程信息”面板**：显示该课堂锁定的数据ID、revision、digest、classroomId和runId。
4. **Test Classroom各席位**：在不挤占主任务的页脚或“课程信息”弹层中显示同一数据ID和短digest。
5. **发布与验收回执**：保存完整数据ID和完整digest，方便事后审计。

推荐显示格式：

```text
课程 CRS-ELEME-001
数据 CRS-ELEME-001-R012
rev 12 · sha256:ab12cd34…
```

内部测试页面还应提供明确的一致性结果：

```text
✓ 与当前测试课堂使用同一份课程数据

或

⚠ 编辑器 CRS-ELEME-001-R013
  测试课堂 CRS-ELEME-001-R012
  当前不是同一份课程数据
```

该ID必须来自实际API响应和Classroom绑定，不得由前端根据课程名称拼接或写死，否则仍然无法证明数据来源一致。

## 五、根因分类与判断标准

### A. revision或digest不同

说明编辑器和Test Classroom查看的是同一课程的不同不可变版本。

处理：保留课堂版本锁定，但清楚显示版本差异，并提供“用当前Candidate创建新Test Classroom”或显式重建测试实例的入口。

### B. revision相同，但seat或dealSeed不同

说明课程正文相同，实际发牌结果不同。

处理：编辑预览必须明确显示自己模拟的seat和seed；提供“预览当前Classroom／当前席位真实快照”模式。随机手牌不同可以是正常行为，但不能伪装为同一席位预览。

### C. exact标识全部相同，但卡片内容不同

说明存在多投影器、缓存、legacy fallback或重复JSON问题。

处理：停止发布，定位并删除并行数据路径，让Editor Preview、Seat和Controller共享同一CourseRelease投影器及同一卡片选择函数。

### D. 同一个Classroom的中控和席位不一致

如果不是权限脱敏导致的预期差异，则说明Controller和Seat没有读取同一个ClassroomInstance／ControllerState。

处理：两者统一按`classroomId + runId + stateVersion`读取；中控推进后产生单一原子状态版本，席位只投影其有权限看到的内容。

## 六、诊断步骤

1. 在Editor、Studio Preview、Test Classroom中控和学员4页面增加或打开内部诊断条。
2. 在同一时刻记录上述course、release、classroom、run、block、seat和seed标识。
3. 导出四个页面实际收到的只读JSON payload，脱敏后逐字段比较。
4. 比较B01的卡片ID、顺序、来源类型、正文、行动要求和发牌归属。
5. 查找服务端是否同时读取draft、Candidate、Released、内置fallback、旧课程目录或数据库副本。
6. 查找Editor Preview和Classroom Seat是否分别实现了卡片过滤、排序和发牌逻辑。
7. 检查Test Classroom创建时间与最新Candidate发布时间，确认是否锁定旧revision。
8. 检查用户是否只保存了草稿，但没有创建新Candidate／新Test Classroom。
9. 检查刷新、后退和重置是否真正重新读取服务器状态，还是继续使用浏览器缓存。
10. 将根因、修复位置和受影响的课程实例记录到完成回执。

## 七、建议的产品修复

### 所有内部视图显示数据来源

在Editor、Preview、Test Classroom中控和测试席位顶部显示可复制的诊断信息：

```text
Course eleme · Candidate r12 · sha256:abcd…
或
Test Classroom TC-004 · Released r11 · sha256:1234… · Run 2 · B01 · seed 417
```

不能只显示课程名称和B01，因为同名课程可能存在多个revision和多个运行实例。

### 编辑器提供两种清楚的预览

```text
预览当前Candidate
用于验收正在编辑的课程正文，可选择人数、席位和固定seed

预览某个Test Classroom
只读展示该课堂锁定的exact release、真实运行状态和指定席位手牌
```

两种模式不能共用含糊的“编辑预览”标签。

### 显式更新测试课堂

- 已开始的Test Classroom不能被保存草稿或发布Candidate静默修改。
- 提供“从当前Candidate创建新Test Classroom”作为推荐操作。
- 如果允许重建现有测试课堂，必须明确会重置手牌、提交、RP、钱包和当前Block，并经过二次确认。
- 更新后显示新旧revision／digest变化和新的发牌seed。

### 统一投影路径

- Editor Preview、Test Seat和Controller共用相同的CourseRelease解析与Block投影函数。
- Seat只在共享投影结果上做权限过滤，不重新解释课程JSON。
- Controller只增加管理信息，不维护另一份课程正文。
- 运行状态单独保存在ClassroomInstance中，不写回CourseDefinition。
- 删除或停用仍参与B01渲染的legacy JSON、内置fallback和重复静态数据。

## 八、卡片一致性契约

当以下标识完全相同时：

```text
courseId + revision + digest
classroomId + runId + blockId
seatId + dealSeed
```

Editor的“当前课堂快照预览”和真实Seat必须得到完全相同的：

- 卡片ID集合。
- 卡片顺序。
- F／R／猜测／未知边界。
- 来源编号和来源链接。
- 标题、正文和行动要求。
- 是否在手中、是否已读、是否已公开等运行状态。

Controller可以看到更多管理信息，但同一张卡的正文和来源边界不能不同。

## 九、自动化回归测试

- [x] 从Candidate创建Test Classroom后，记录并锁定exact revision与digest。
- [x] 使用固定人数、固定seat和固定seed时，Preview与真实Seat的卡片ID及顺序完全一致。
- [x] Controller与所有Seat读取相同的classroomId、runId、B01和stateVersion。
- [x] 保存新草稿不会改变已经开始的Test Classroom。
- [x] 发布新Candidate后，旧Test Classroom继续显示旧revision，并清楚标注“不是最新Candidate”。
- [x] 使用新Candidate创建的新Test Classroom显示新内容。
- [x] 切换预览seat时只改变权限和发牌结果，不改变课程正文与来源边界。
- [x] 同一个seat更换浏览器或刷新后仍恢复相同手牌。
- [x] 重置发牌只有在显式操作后才改变seed和手牌，并写入审计日志。
- [x] 中控前进、后退和刷新后，所有Seat收敛到同一stateVersion。
- [x] F卡来源、R卡模拟标记和行动要求在三端保持一致。
- [x] 不存在仍参与渲染的第二份饿了么课程JSON或legacy fallback。
- [x] Editor、Preview、Controller和Seat从API显示相同的`courseDataId + revision + digest`时，课程正文payload完全一致。
- [x] 修改任意B01卡片字段并保存新Candidate后，数据ID、revision和digest均发生变化。
- [x] 数据ID展示值来自实际绑定对象，不是前端按名称写死或临时拼接。

## 十、验收标准

- [x] 已确定本次不一致属于版本差异、发牌差异、投影器差异、缓存差异或重复数据中的哪一种。
- [x] Editor、Preview、Test Controller和Test Seat都显示可核对的revision、digest和运行标识。
- [x] 课程JSON具有稳定`courseId`和不可变快照`courseDataId`。
- [x] 至少在编辑器顶部、Studio Preview、Test中控和Test席位的课程信息区域显式展示数据ID。
- [x] 内部测试界面直接显示“同一份课程数据”或列出双方不同数据ID，不再依靠人工猜测。
- [x] 用户可以明确选择“当前Candidate预览”或“指定Test Classroom快照预览”。
- [x] 相同exact标识下，B01卡片内容与顺序完全一致。
- [x] 不同revision或seed导致的合理差异得到明确解释，不再显示成“同一份课件”。
- [x] 已开始Test Classroom继续保持版本锁定，不因编辑器保存而静默改变。
- [x] 用户可以方便地从当前Candidate创建新的Test Classroom进行最新内容验收。
- [x] Test Classroom中控与所有席位使用同一个ClassroomInstance和ControllerState。
- [x] 课程系统仍只有一个可编辑CourseDefinition，不存在第二份并行课程真值。
- [x] 修复后再继续T-091的饿了么产品导师内容收敛与最短路径验收。

## 十一、非目标

- 不通过让活动课堂自动跟随编辑器草稿来掩盖版本差异。
- 不把随机手牌差异一律当成课程正文不一致。
- 不为了让截图相同而破坏学生私密卡隔离。
- 不在没有比对revision、digest、seat和seed前直接覆盖生产课程数据。
- 不由AI自行补写缺少来源的B01内容；缺口继续进入人工待审核列表。

课程编辑器内部不同用户字段共用对象导致的联动修改，由 T-095 单独修复；T-094继续负责跨Editor、Preview、Test Controller和Test Seat的数据版本与投影一致性。

## 2026-09-10 完成回执

- 根因已定位并修复：浏览器／服务端 hash 与 seed 不同、checkpoint 卡组选择不同、数据库 UUID 破坏卡序，以及旧课堂与新 Candidate 的合理版本差异未被解释。
- `courseDataId / classroomId / runId / blockId / seatId / dealSeed / stateVersion / resetGeneration / cardAssignmentId` 已进入 Test Runtime 诊断。
- Editor Preview 与服务端投影对 B01、B05 及 2／4／6 人逐席逐卡一致；只有显式 Test reset 才改变 run/seed。
- 新定义已作为 r11 Candidate 导入；旧 Classroom 和旧 revision 均保持不可变。

