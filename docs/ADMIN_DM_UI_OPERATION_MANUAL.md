# 终极管理员／DM 导师主持人操作手册（T-086）

> 本手册逐项对应当前 T-086 界面。完整发布链与异常处理见 [Course Platform 操作 SOP](COURSE_PLATFORM_SOP.md)。

## 1. 先分清三种身份

- **平台管理员**：可以管理 Course Studio、预创建平台账号，也可以创建 Classroom；但不会因此自动看见所有课堂。
- **导师**：平台账号角色为 mentor，可担任 P／D／M／O 任一导师席并创建课堂。
- **Admin DM**：某一场 Classroom 的独立权限，负责该课堂的中控和成员操作；它不是第五位导师，也不等于平台管理员。

一位导师可以同时担任某个 P／D／M／O 导师席和 Admin DM。未获得该课堂 Membership 或 Admin DM 的平台管理员不能越权进入。

## 2. 第一次登录

1. 打开 `/auth/login/`，输入用户名和一次性初始密码。
2. 系统自动进入 `/account?first=1`；设置本人长期密码。
3. 完成改密后进入 `/classroom/`。未完成时，Studio 和 Classroom API 会返回 `PASSWORD_CHANGE_REQUIRED`，不会泄漏课堂数据。

公开注册页只用于独立体验。正式课堂人员由导师／管理员预创建账号，再绑定到 Classroom 席位。

## 3. 开课前检查课程和课件

### 3.1 课程

1. 进入 `/studio/editor/`，选择或导入 CourseDefinition。
2. 逐 Block 检查学员任务、学员视角、导师脚本和动态学员模板。
3. 切换预览人数 N，确认页面数量始终为 `4 位导师 + N 位学员 + 1 个中控`。
4. 点击“保存 Candidate”。保存产生新的不可变 revision，不会改写已运行课堂。

### 3.2 四套导师课件

1. 进入 `/studio/courseware/`。
2. 检查 P／D／M／O 四类课件都有可用 exact revision。
3. 用“打开 exact 预览”验收实际 HTML。
4. Production 只能绑定 Released 课件；Test 可以绑定最新 revision。

## 4. 预创建 4＋N 个账号

1. 打开 `/classroom/#factory`。
2. 先选择学员人数，再点击“一键生成 4＋N 个测试账号”。
3. 立即点击“下载 CSV”，分别安全发给四位导师与每位学员。
4. 明文初始密码只显示一次；不要粘贴到群聊、工单、文档或 Git。
5. 如已有可用账号，可以跳过生成，在 Factory 中直接选择；账号可加入多个课堂，Membership 彼此独立。

## 5. 用 Classroom Factory 创建 Test

按界面从上到下操作：

1. “课堂环境”选择 `Test · 可用 Candidate、可重置`。
2. 填课堂名称。
3. 在“课程 exact 版本”选择目标 Candidate／Released。
4. 选择真实学员人数 N；下拉范围来自课程自己的 `learnerPolicy`。
5. 确认 Admin DM。mentor 自建时，创建者必须是初始 Admin DM；平台管理员可以指定其他导师／管理员。
6. 在“四个导师 Membership”分别选择四个不同账号：P 产品、D 开发、M 市场、O 运营。
7. 在“四套 exact 导师课件”分别选择 P／D／M／O 课件 revision。
8. 为学员 1…N 选择 N 个不同 learner 账号。
9. 点击“创建 Test Classroom →”。系统用一次原子事务生成课堂、团队、`4＋N` 个 Membership、四套课件绑定、中控和初始牌。
10. 在“课堂中心”的对应 TEST／PRODUCTION 分组打开新课堂，记住它的独立路径 `/classroom/{id}/`。

若创建失败，不要绕过校验。界面会明确指出重复导师、人数不符、卡组容量不足、课件缺失或版本不可用。

## 6. 开课前管理成员

只有 Admin DM 可以打开 `/classroom/{id}/members`。

- **替换学员席**：选择“替换学员席”→席位→目标 learner→“确认操作”。
- **替换导师席**：选择“替换导师席”→P／D／M／O 席位→目标 mentor/admin→“确认操作”。
- **授予 Admin DM**：选择目标导师或管理员再确认；不会新增导师席。
- **撤销 Admin DM**：只能撤销非最后一条管理路径，系统始终要求至少保留一名 Admin DM。
- **临时补账号**：右侧选择角色、数量和用户名开头，点击“生成账号与一次性密码”；创建后仍需在左侧绑定席位。

课堂开始后导师席和学员席锁定，避免中途换人破坏私密手牌和审计；Admin DM 权限仍按受控规则管理。

## 7. 每个 Block 的现场推进

Admin DM 打开 `/classroom/{id}/control`。LIVE RUN SCRIPT 是唯一推进主棍，每个 Block 只按以下按钮顺序走：

```text
执行当前块
→ 学员／导师完成线下活动与页面提交
→ 收齐现场结果，进入验收
→ 验收通过 或 退回补证据
→ 进入下一 Block
```

最后一个 Block 验收通过后点击“完成整门课程”。

### 7.1 点击“执行当前块”前

- 朗读“系统动作”和“人工验收门”。
- 确认当前主导师；其余导师按页面提示观察、支援或待命。
- 将 `/classroom/{id}/screen` 投到公共屏幕。共同投屏只显示共同任务与进度，不显示私人卡、导师讲稿、提交文本、账号、RP 或钱包。

### 7.2 执行中

- 学员在自己的 `/classroom/{id}/` 查看“你看到的世界、先讲给队友、再一起追问、完成的样子”和私人情报卡。
- 学员先用自己的话讲卡片，再听队友的二次信息；不要把“我们猜的”说成“有来源”。
- 导师打开自己的 exact 课件，只在学生经历之后命名复杂方法。
- 学员页保留个人声望 RP、个人钱包 C 和团队资金 C；这些数据由课堂账本统一计算，不靠口头补记。

### 7.3 人工验收

- 点击“收齐现场结果，进入验收”后，在右侧“本块提交”逐人检查作品。
- 达到本块“人工验收门”才点“验收通过”。
- 证据不具体时点“退回补证据”；系统保留尝试次数和原因，故事不会因一次失败停住。
- 多位 Admin DM 同时操作时，旧页面会收到 `CONTROLLER_VERSION_CONFLICT`；刷新后以最新 Controller version 为准，禁止盲目重试。

## 8. 签发 Test 验收回执

完成全部 Block 后，中控显示五个勾选项：

1. Test 与 Production 使用同一页面、API 和状态机。
2. P／D／M／O 四导师席和课件入口正确。
3. 学员只看见自己的私密卡，投屏未泄漏私密信息。
4. 五大步与全部 Block 已在真实 UI 中走完。
5. CourseRelease 与四套课件 revision／digest 和课堂锁定值一致。

逐项真实核验后点击“生成 exact 验收回执”。重复点击同一验收不会生成第二张不同回执。Test 可点击“重置 Test 实例”重新演练；Production 没有该按钮。

## 9. 发布并创建 Production

1. 进入 `/studio/releases/`，找到与回执 exact 匹配的 Candidate。
2. 点击发布。服务端会再次验证课程声明的最大 N 确实能实例化。
3. 返回 `/classroom/#factory`，选择 `Production · 仅 Released、不可重置`。
4. 重新绑定四导师、N 位学员和四套 Released exact 课件，创建 Production Classroom。
5. 开课后即使 Studio 保存新 Candidate、课件产生新 revision，既有 Production 仍固定读取创建时的 CourseRelease 和 CoursewareRelease。

## 10. 现场故障最短处理

- 一直“正在连接课堂”：先返回 `/classroom/` 确认本人是否有该课堂 Membership；再检查是否已完成首次改密。
- 看不到“主控”或“成员”：本人没有该课堂 Admin DM 权限，不要用平台 admin 身份绕过。
- 学员看到别人的卡或钱包：立即停课并保留实例 ID，不继续推进；这是隐私验收失败。
- 409 版本冲突：刷新中控，不重复点击。
- 410 Gone：打开了已退役的 `/alpha` 或全局 `/control`；使用 `/classroom/{id}/...`。
- Production 配错人或版本：不要重置或原地改写，创建新实例并保留旧实例审计。

## 11. 下课收尾

1. 确认最后一个 Block 已“完成整门课程”。
2. 记录 Classroom ID、CourseRelease revision/digest、四套课件 revision/digest、ViewAcceptanceReceipt 与 UiAcceptanceReceipt（如为验收课堂）。
3. 检查每位学员的最终作品、个人 RP／钱包与团队资金来自服务端账本。
4. 保留 Production 课堂作为不可变审计记录；下一次开课用 Factory 创建新实例。
