# T-083｜九视窗时序所见即所得课程工作台

状态：实现完成，等待本次发布回执写入
正式入口：<https://minisv.vip/control/editor/>
权限：`admin` / `mentor`
编辑器构建：`t083-nine-pane-studio-r1`

## 1. 交付结果

课程编辑器的默认入口已经从字段表单升级为一个单页课程排练台：

- 顶部持续显示 `Working Copy → Candidate → Alpha Active → Released` 四段版本链。
- 同一页显示五大步、B01—B13 全课程时序轴。
- 中间先排列 W00—W03 四导师席，再排列 W04—W07 四学员席。
- 全宽课程中控固定在八席之后，构成第 9 个视窗。
- 点击任一 Block，八席与中控在同一次渲染中切换到同一个 Block。
- 点击有编辑提示的可见文案，会打开其唯一 Course Package 路径；输入时九视窗立即同步。
- RP、钱包、团队资金、发牌位置、进度和运行状态均明确标为模拟／派生，不能写入课件。
- 高级结构、抽卡内容和 JSON 源码仍然保留，作为精确编辑与诊断入口。

Google 与饿了么均以相同的 5 步、13 Block、4 导师、4 学员、5 卡组课程契约载入；没有建立第二套预览文案数据库。

## 2. 唯一数据流

```text
浏览器内 Course Package Working Copy
            +
Block / 预览状态 / 可见 seed
            ↓
MsvCoursePreview.projectCourse()
            ↓
4 导师 View Model + 4 学员 View Model + 1 中控 View Model
            ↓
共享 renderSeatSurface() / renderControllerSurface()
```

编辑预览、真实席位和真实 LIVE RUN 中控复用同一渲染函数：

- 编辑器：Working Copy → `projectCourse` → 共享渲染器。
- 真实席位：受 lease 保护的 Runtime State → `runtimeSeatView` → 同一 `renderSeatSurface`。
- 真实中控：Runtime State → `runtimeControllerView` → 同一 `renderControllerSurface`。

实现没有 iframe，没有复用 Alpha lease，没有放宽 `X-Frame-Options: DENY` 或 `frame-ancestors 'none'`，也没有让编辑页轮询学员真实私密数据。

## 3. 可逆字段映射

### Course Source｜写回唯一 JSON 路径

可视化编辑覆盖：

- 课程：`course.name`、`course.description`、`course.period`。
- 当前大步：`macroSteps.N.name`、`question`、`exitGate`。
- Block：标题、分钟、当值导师、玩法、双轨、学员提示、导师口播、学员动作、系统动作、道具、验收门、兜底和线下配合。
- 导师席：导师名称、角色承诺、当前状态、当前任务、完成徽标、专业观察内容。
- 学员席：当前任务、世界提示、要说／要问／完成标准。
- 私密卡：用稳定卡牌 ID 反查 `decks.N.cards.M` 的 `boundary`、`title`、`body`、`sharePrompt`。

每个编辑控件携带 `data-course-path`。弹窗展示完整路径、稳定卡牌 ID 和当前受影响的可见位置数。修改先进入浏览器 Working Copy；撤销、重做和保存都以完整课程为原子单位。

### Runtime / Derived｜只读

以下数据没有 Course Package 写入路径：

- 当前 RP、个人钱包、团队资金。
- 已读／已讲出、真实手牌位置、提交数、课堂成员。
- Block 进度、当前执行状态和组合标签。

在编辑预览中点击这类值，只会显示来源解释和“不会写入 JSON／Candidate／Alpha／课堂账本”的边界说明。真实运行页则呈现普通只读值，不显示“模拟”按钮。

## 4. 确定性预览

`deterministicDeal(course, stepIndex, seed)` 使用课程 ID、大步 ID、卡组 ID 和公开 seed 生成可重复洗牌：

- 同一课程、步骤和 seed 的 4×3 手牌顺序完全一致。
- 换 seed 会得到另一组确定性手牌。
- 同轮 12 张卡保持唯一。
- 卡牌副本携带 `sourcePath` 与稳定 ID；编辑永远落回卡组源卡，而不是随机手牌位置。
- 模拟 RP、钱包和团队资金均带显式模拟标签，不会进入真实状态。

预览支持 `ready`、`executing`、`awaiting-acceptance`、`error`、`completed` 五种视觉状态，但不会调用 `/api/control`。

## 5. 时序轴与九窗布局

### 五大步 × 十三 Block

- 五组 Macro Step 始终按标准骨架排列。
- 每个 Block 显示 ID、标题、建议分钟和当值导师代码。
- 当前块、结构警告和未保存修改分别有独立视觉状态。
- 支持上一块、下一块、点击跳步、只看警告，以及全课程／舒适／详细三档密度。
- B01—B13 的 ID、顺序与 API Action 继续由 Course Schema 锁定，所见即所得不能绕过安全骨架。

### 五种画布

- 八席总览。
- 只看导师。
- 只看学员。
- 单窗精编。
- 双窗对照。

底部第 9 窗可以折叠和调整高度，但不能移动到八席上方。手机和平板改为单列或可横向浏览的时间轴，不制造超小字体和页面横向溢出。

## 6. Candidate 与正式发布

```text
Working Copy
  ↓ 明确保存
不可变 Candidate revision + content digest
  ↓ 明确加载到 Alpha，并手工跑完 13 Block
Exact Candidate 验收回执
  ↓ 明确发布
Released revision + 同一 content digest
```

安全门在浏览器和服务端各执行一次：

- 保存 Candidate 不调用 Alpha 刷新，不改变 Run ID、执行指针、手牌或账本。
- 发布必须存在已保存 Candidate。
- 请求正文必须与当前 Candidate 的完整 content digest 相同。
- 当前 Alpha 必须加载同一课程、同一完整 digest，并处于 `completed`。
- 回执必须绑定当前 Alpha `runId` 和完整 digest。
- `authoring` 中的 revision、状态、时间和回执是注册元数据，不参与内容 digest；因此 Candidate 与其 Released 副本共享同一内容身份。
- 既有正式课堂仍锁定原版本；发布不做静默热切换。

## 7. 关键实现文件

- `tools/live-run/static/course-preview.js`：投影器、确定性发牌、共享 View Model 适配器与渲染器。
- `tools/live-run/static/course-preview.css`：编辑预览和真实席位共享的核心视觉 token／布局。
- `tools/live-run/static/editor.html|css|js`：九视窗工作台、时序轴、字段映射、撤销重做和版本链。
- `tools/live-run/static/seat.js`：真实席位 Runtime State 适配器。
- `tools/live-run/static/controller.js`：真实中控 Runtime State 适配器。
- `tools/live-run/static/card-view.js`：编辑器与学员席位共用的卡牌渲染。
- `tools/live-run/course.py`：稳定内容 digest。
- `tools/live-run/controller.py`：exact Candidate 验收与 Released 服务端门禁。

## 8. 验收覆盖

自动化门禁包括：

- Google 与饿了么共 26 个 Block 课程投影契约快照。
- 每个快照检查 9 窗同 Block、4+4 角色、单一当值导师、4×3 唯一卡和零串席。
- 默认九视窗、五种画布、原子跳块、可见字段即时编辑、稳定卡 ID、派生只读、撤销重做和 Candidate 保存。
- 保存 Candidate 前后活动 Run ID、digest 和执行指针不变。
- 服务端拒绝无 Candidate、错误 digest、错误 Run 或未完成 Alpha 的发布。
- 真实席位和真实中控确实走共享渲染器，运行态不出现编辑路径或模拟按钮。
- 1440、1180、768、430、390 px 无页面横向溢出，席位基础字号不低于 13 px。
- 既有 T-071／072、T-074 编辑器、Alpha 刷新、卡牌搜索和布局回归继续通过。

机器可重复命令见 `docs/TESTING.md`。生产 release、公开 URL、哈希和状态不变证明将在 `docs/TODO_083_PRODUCTION_RECEIPT.json` 中记录。
