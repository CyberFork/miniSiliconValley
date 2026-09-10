# 终极管理员／DM 导师主持人操作手册（T-087）

> 本手册逐项对应当前 T-087 界面。完整发布链与异常处理见 [Course Platform 操作 SOP](COURSE_PLATFORM_SOP.md)。

## 1. 先分清三种身份

- **平台管理员**：可以管理 Course Studio、预创建平台账号，也可以创建 Classroom；但不会因此自动看见所有课堂。
- **导师**：平台账号角色为 mentor，可担任 P／D／M／O 任一导师席并创建课堂。
- **Primary Admin DM**：某一场 Classroom 的根管理权限；负责中控、成员操作和委派，不能自行退出或被撤销。
- **Delegated Admin DM**：Primary 授予某位导师的非递归权限；可执行课堂运营，但不能授予或撤销 Admin DM。

Admin DM 是课堂范围权限，不是第五位导师。一位导师可以同时担任某个 P／D／M／O 导师席和 Admin DM。未获得该课堂 Membership 或 Admin DM 的平台管理员不能越权进入。

## 2. 第一次登录

1. 打开 `/auth/login/`，输入用户名和一次性初始密码。
2. 系统自动进入 `/account?first=1`；设置本人长期密码。
3. 完成改密后进入 `/classroom/`。未完成时，Studio 和 Classroom API 会返回 `PASSWORD_CHANGE_REQUIRED`，不会泄漏课堂数据。

公开注册页只用于独立体验。正式课堂人员由导师／管理员预创建账号，再绑定到 Classroom 席位。

## 3. Studio 导航、账号切换与退出

1. `/studio/` 左侧 00—04 都是真实链接。点击后 URL、主标题与高亮项应同步变化；Cmd/Ctrl＋点击可在新标签打开。
2. 任一 Studio、Classroom、导师 Courseware 或 Account 页面右上角点击头像，均可看到当前姓名、用户名、平台角色和课堂席位（如有）。共同投屏 `/screen` 是唯一例外，它故意不显示任何私人账号控件。
3. “切换账号”会先撤销当前服务端会话，再回到登录页；输入另一个账号的凭据即可。它不会保存或代填其他账号密码。
4. “退出登录”同样撤销服务端会话；退出后浏览器后退也不能继续读取受保护 API。
5. 测试身份模拟时，全站持续显示黄色 `TEST 身份模拟` 横幅。完成查看后必须点击“返回管理员身份”，不能把模拟身份当作真实登录账号继续工作。

## 4. 开课前检查课程和课件

### 4.1 课程

1. 进入 `/studio/editor/`，选择或导入 CourseDefinition。
2. 逐 Block 检查学员任务、学员视角、导师脚本和动态学员模板。
3. 切换预览人数 N，确认页面数量始终为 `4 位导师 + N 位学员 + 1 个中控`。
4. 点击“保存 Candidate”。保存产生新的不可变 revision，不会改写已运行课堂。

### 4.2 四套导师课件

1. 进入 `/studio/courseware/`。
2. 检查 P／D／M／O 四类课件都有可用 exact revision。
3. 用“打开 exact 预览”验收实际 HTML。
4. Production 只能绑定 Released 课件；Test 可以绑定最新 revision。

## 5. 预创建 4＋N 个账号

1. 打开 `/classroom/#factory`。
2. 先选择学员人数，再点击“一键生成 4＋N 个测试账号”。
3. 立即点击“下载 CSV”，分别安全发给四位导师与每位学员。
4. 明文初始密码只显示一次；不要粘贴到群聊、工单、文档或 Git。
5. 如已有可用账号，可以跳过生成，在 Factory 中直接选择；账号可加入多个课堂，Membership 彼此独立。

## 6. 用 Classroom Factory 创建 Test

按界面从上到下操作：

1. “课堂环境”选择 `Test · 可用 Candidate、可重置`。
2. 填课堂名称。
3. 在“课程 exact 版本”选择目标 Candidate／Released。
4. 选择真实学员人数 N；下拉范围来自课程自己的 `learnerPolicy`。
5. 确认 Primary Admin DM。mentor 自建时，创建者必须是 Primary；平台管理员可以指定一位导师／管理员作为 Primary。额外初始 Admin DM 必须是导师，并自动成为 Delegated。
6. 在“四个导师 Membership”分别选择四个不同账号：P 产品、D 开发、M 市场、O 运营。
7. 在“四套 exact 导师课件”分别选择 P／D／M／O 课件 revision。
8. 为学员 1…N 选择 N 个不同 learner 账号。
9. 点击“创建 Test Classroom →”。系统用一次原子事务生成课堂、团队、`4＋N` 个 Membership、四套课件绑定、中控和初始牌。
10. 在“课堂中心”的对应 TEST／PRODUCTION 分组打开新课堂，记住它的独立路径 `/classroom/{id}/`。

若创建失败，不要绕过校验。界面会明确指出重复导师、人数不符、卡组容量不足、课件缺失或版本不可用。

## 7. 开课前管理成员与 Admin DM

只有 Admin DM 可以打开 `/classroom/{id}/members`。

- **替换学员席**：选择“替换学员席”→席位→目标 learner→“确认操作”。
- **替换导师席**：选择“替换导师席”→P／D／M／O 席位→目标 mentor/admin→“确认操作”。
- **授予 Delegated Admin DM**：只有 Primary 可选择有效导师并确认；不会新增导师席，也不会赋予继续委派能力。
- **撤销 Delegated Admin DM**：只有 Primary 可操作；Primary 自身永远受保护。
- **主动退出 Admin DM**：Delegated 可退出自己的权限；Primary 不可退出。
- **临时补账号**：右侧选择角色、数量和用户名开头，点击“生成账号与一次性密码”；创建后仍需在左侧绑定席位。

课堂开始后导师席和学员席锁定，避免中途换人破坏私密手牌和审计；Admin DM 权限仍按受控规则管理。

### 7.1 平台管理员测试身份

仅在以下条件同时满足时出现：当前是真实 `admin` 会话、课堂是 Test、该管理员显式拥有本课堂 Admin DM。

1. 打开 `/classroom/{id}/members#test-identities`，或从右上角账号菜单点击“测试账号管理”。
2. 在目标导师／学员旁点“以此身份进入”。页面进入同一 Test Classroom，并出现 actor → effective 横幅。
3. 检查该角色的私密任务、手牌、钱包和权限边界；不能进入 Studio、Account、其他 Classroom 或 Production。
4. 点击横幅“返回管理员身份”。模拟最长 30 分钟，过期、目标停用、Membership／Delegated 权限撤销都会立即结束。
5. “重发一次性密码”会撤销目标既有会话，明文只显示一次；不要写入截图、Git 或发布回执。

## 8. 每个 Block 的现场推进

Admin DM 打开 `/classroom/{id}/control`。LIVE RUN SCRIPT 是唯一推进主棍，每个 Block 只按以下按钮顺序走：

```text
执行当前块
→ 学员／导师完成线下活动与页面提交
→ 收齐现场结果，进入验收
→ 验收通过 或 退回补证据
→ 进入下一 Block
```

最后一个 Block 验收通过后点击“完成整门课程”。

### 8.1 点击“执行当前块”前

- 朗读“系统动作”和“人工验收门”。
- 确认当前主导师；其余导师按页面提示观察、支援或待命。
- 将 `/classroom/{id}/screen` 投到公共屏幕。共同投屏只显示共同任务与进度，不显示私人卡、导师讲稿、提交文本、账号、RP 或钱包。

### 8.2 执行中

- 学员在自己的 `/classroom/{id}/` 查看“你看到的世界、先讲给队友、再一起追问、完成的样子”和私人情报卡。
- 学员先用自己的话讲卡片，再听队友的二次信息；不要把“我们猜的”说成“有来源”。
- 导师打开自己的 exact 课件，只在学生经历之后命名复杂方法。
- 学员页保留个人声望 RP、个人钱包 C 和团队资金 C；这些数据由课堂账本统一计算，不靠口头补记。

### 8.3 人工验收

- 学员保存的作品与电子剧本翻页相互独立；导师可在本页逐人检查、接受或“退回补证据”，系统保留尝试次数和原因。
- 作品一次失败不会冻结故事。只有课程 JSON 明确把某个作品 schema 列入最终证据门槛时，它才会在“结束本次课堂”时被检查。
- 多位导师同时解锁下一页时，旧页面会收到版本冲突；刷新后以最新 script version 为准，禁止盲目重试。

## 9. 签发 Test 验收回执

全部 Block 解锁后，先讲完末页／Demo／复盘，再由任一导师在中控弹窗中点击“确认结束本次课堂”。末页解锁本身不代表课堂或作品完成。

课堂明确结束后，中控显示完整 16 项真实 UI 清单，覆盖同源运行时、Membership/RBAC、四导师和 N 学员视图、隐私与投屏、顺序解锁与独立回看、Test 角色切换、显式结束、刷新重登、并发、reset、响应式布局、运行快照不漂移及 exact 课程／课件身份。逐项真实核验后由 Admin DM 签发 `UiAcceptanceReceipt`；自动化或模型不得代签。重复提交同一业务指纹返回同一持久回执。Test 可点击“重置 Test 实例”重新演练；Production 没有该按钮。

## 10. 发布并创建 Production

1. 进入 `/studio/releases/`，找到与回执 exact 匹配的 Candidate。
2. 点击发布。服务端会再次验证课程声明的最大 N 确实能实例化。
3. 返回 `/classroom/#factory`，选择 `Production · 仅 Released、不可重置`。
4. 重新绑定四导师、N 位学员和四套 Released exact 课件，创建 Production Classroom。
5. 开课后即使 Studio 保存新 Candidate、课件产生新 revision，既有 Production 仍固定读取创建时的 CourseRelease 和 CoursewareRelease。

## 11. 现场故障最短处理

- 一直“正在连接课堂”：先返回 `/classroom/` 确认本人是否有该课堂 Membership；再检查是否已完成首次改密。
- 看不到“主控”或“成员”：本人没有该课堂 Admin DM 权限，不要用平台 admin 身份绕过。
- 学员看到别人的卡或钱包：立即停课并保留实例 ID，不继续推进；这是隐私验收失败。
- 409 版本冲突：刷新中控，不重复点击。
- 410 Gone：打开了已退役的 `/alpha` 或全局 `/control`；使用 `/classroom/{id}/...`。
- Production 配错人或版本：不要重置或原地改写，创建新实例并保留旧实例审计。
- Delegated 看不到委派按钮：这是正确权限边界；由 Primary 执行授权变更。
- 模拟身份进入了错误页面：系统应拒绝并留审计；从黄色横幅返回真实管理员。若没有拒绝，立即停止验收并记录 Classroom ID。

## 12. 下课收尾

1. 确认最后一个 Block 已“完成整门课程”。
2. 记录 Classroom ID、CourseRelease revision/digest、四套课件 revision/digest、ViewAcceptanceReceipt 与 UiAcceptanceReceipt（如为验收课堂）。
3. 检查每位学员的最终作品、个人 RP／钱包与团队资金来自服务端账本。
4. 保留 Production 课堂作为不可变审计记录；下一次开课用 Factory 创建新实例。
