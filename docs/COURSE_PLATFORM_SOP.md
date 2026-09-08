# Course Platform 操作 SOP（T-085）

## 角色与入口

- 平台管理员／导师：`/studio/`、`/classroom/`、`/course/`
- 学员：`/classroom/`
- 课堂 Admin DM：`/classroom/{id}/control` 与 `/classroom/{id}/members`
- 共同投屏：`/classroom/{id}/screen`

Admin DM 是某个 Classroom 的权限，不是第五导师，也不等于平台管理员。平台管理员若未被授予某课堂 Admin DM 或 Membership，也不能进入该课堂。

## A. 制作课程

1. 登录导师或管理员账号，进入 `/studio/editor/`。
2. 选择 Google、饿了么或已导入课程。
3. 逐 Block 编辑学员任务、学员视角和动态学员模板；高级区可导入／导出完整 JSON。
4. 在顶部选择 2、4、6 或课程范围内任意 N，查看 `4 + N + 1` 页内投影。
5. 修复所有人数、卡组和任务模板缺口。Preview 可显示失败原因，但保存按钮在定义无效时不可用。
6. 点击“保存 Candidate”。这只生成不可变版本，不改变任何运行中的课堂。

## B. 管理导师课件

1. 进入 `/studio/courseware/`。
2. 新课件填写标题、slug、P/D/M/O 角色并上传完整单文件 HTML；保存后得到不可变 revision。
3. 用“打开 exact 预览”检查该 revision。
4. 点击发布，推进该课件的 Released 指针。
5. 更新既有课件时选择 package，再上传新 HTML；标题、slug 和导师角色保持不变。

同事产品导师原版课件只能通过固定源码构建流程升级，不能在网页中编辑。课堂只锁定 exact 课件版本，不做 Block→Slide 自动映射。

## C. 预创建账号

1. 在 `/classroom/` 的 Classroom Factory 点击“一键生成 4＋N 个测试账号”，或由导师／管理员按需预创建。
2. 立即下载一次性 CSV，并通过私密渠道分别发送给本人。
3. 明文初始密码离开页面后无法再次读取；不得进入群聊、截图、工单或 Git。
4. 用户首次登录后会被强制送到 `/account?first=1`；完成改密后才能读取 Studio/Classroom API。

公开注册页仅用于独立体验账号，不是正式 Classroom 入场流程。

## D. 创建 Test Classroom

1. 在 `/studio/releases/` 找到当前 Candidate，点击“创建 Test Classroom”，或直接在 `/classroom/#factory` 选择 Test。
2. 选择 exact Candidate/Released、实际 N、四个不同 P/D/M/O 导师账号、N 个不同学员账号。
3. 为 P/D/M/O 各选择一套 exact 课件。
4. 确认初始 Admin DM。导师自建课堂时创建者必须是初始 Admin DM；平台管理员可指定导师或管理员。
5. 创建成功后进入 `/classroom/{id}/control`。所有成员在“我的 Classroom”看到同一个独立实例。

## E. 运行与验收 Test

每个 Block 的主控顺序固定：

```text
准备 → 开始执行 → 提交验收 → 接受／退回 → 下一 Block
最后 Block：接受 → 完成课程
```

- 学员在自己的 `/classroom/{id}/` 看任务、私人卡、RP、个人钱包和团队资金，并提交证据。
- 导师只看本角色任务、观察重点和自己的课件入口。
- Admin DM 在 control 看系统动作、验收条件、全员提交和并发版本；多人同时操作时 409 提示刷新。
- screen 只显示全班共同内容，不显示手牌、导师讲稿、提交、账号或钱包。
- 开课前可在 members 替换导师／学员席、授予或撤销 Admin DM；必须始终保留至少一位 Admin DM。
- Test 可 reset；reset 清除运行产物并按同一 course/seed 重新发牌，不改变 exact 课程和课件绑定。

完成全部 Block 后，在 control 逐项确认同源 UI、四导师、学员隐私、五步完成和 exact 版本，签发验收回执。

## F. 发布与创建 Production

1. 回到 `/studio/releases/`，确认回执与当前 exact Candidate 匹配。
2. 点击发布；系统再次校验课程声明的最大 N 是否真的可实例化。
3. 在 Factory 选择 Production。列表只提供 Released CourseRelease，四套课件也必须 Released。
4. 创建后 exact course/courseware 全部锁定；后续 Studio 保存、课件升级和 Test reset 不影响此课堂。
5. Production 没有 reset。需要重开时创建新实例，保留旧课堂与审计。

## G. 异常处理

- `PASSWORD_CHANGE_REQUIRED`：先完成首次改密。
- `CONTROLLER_VERSION_CONFLICT`：另一位 Admin DM 已推进，刷新后按最新状态操作。
- `COURSE_RELEASE_CAPACITY_INVALID`：按提示补齐最大 N 的卡牌或动态任务模板，再保存新 Candidate 并重测。
- `CLASSROOM_ACCESS_FORBIDDEN`：检查 Membership/Admin DM；不要给平台 admin 隐式越权。
- `410 Gone`：使用了退休的 `/alpha` 或全局 `/control`，改用实例路由。
