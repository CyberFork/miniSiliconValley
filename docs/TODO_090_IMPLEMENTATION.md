# T-090｜D 导师剧本组课件与开发立棍闭环

状态：开发、完整自动化测试、生产部署和线上 Studio Candidate 导入已完成；exact Candidate r10 等待团队进行两级人工验收后再发布 Released。

## 1. 成品关系

T-090 没有另造一套课堂，也没有把 PPT 每页硬编码成 Block。它在 T-091 的 P 导师历史课程后接入一个独立的 D 导师课堂模拟：

```text
P 历史案例（B01—B04）
  → P 验收 ProductBrief
  → D 读取已通过的上游成果
  → 校园共享设备预约系统失控（B05—B08，R 课堂模拟）
  → 学员随机获得私密事故卡并交流
  → 团队建立主棍、子棍、微棍与测试
  → D 退回／验收 DevelopmentStick
  → M 在 B09 读取已通过的开发交付物
```

可导入课程真值：

```text
tools/live-run/courses/candidates/eleme-2008-product-development-t090.json
```

该文件是本地 Candidate 源文件，不等于线上 Candidate，更不等于 Released。

## 2. 历史与模拟彻底分开

课程契约现在显式区分两种 `CasePackage`：

- `historical`：必须与课程 case ID 一致，必须声明来源和 F 卡，所有事实可追溯。
- `simulation`：可以拥有独立 case ID；`sourceIds` 与 `factCardIds` 必须为空；私密卡只能是无来源的 `R／课堂模拟`。

本 Candidate 同时包含：

- `case-eleme-2008-product-discovery`：P 所有的饿了么历史案例。
- `case-device-booking-incident`：D 所有的校园预约事故模拟。

因此课堂不会把模拟日志、模拟用户、模拟业务规则或模拟测试冒充为饿了么历史。

## 3. D 导师 exact 课件

T-089 的 18 页本地课件被逐字节冻结为运行时静态包：

```text
public/courseware/development-mentor-ligun/
```

Exact ref：

```text
packageId  cw-development-mentor-ligun
slug       development-mentor-ligun
revision   r0
digest     cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d
slides     18
```

`SOURCE-MANIFEST.json` 记录 HTML、四张本地图片、每个文件 SHA-256 和内容树 SHA-256：

```text
ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234
```

ClassroomFactory 会强校验 D 的 package／slug／revision／digest。绑定旧的 `development-mentor-field-kit` 会以 `COURSE_CONTENT_COURSEWARE_MISMATCH` 失败关闭，不能静默错配。

## 4. 一个事故、四个稳定检查点

1. `B05 / d-a-system-failure`：系统失控与私密证据；PPT 第 1—5 页。
2. `B06 / d-b-establish-main-stick`：建立一级主棍；PPT 第 6—10 页。
3. `B07 / d-c-split-and-test`：拆分子棍、微棍与测试；PPT 第 11—15 页。
4. `B08 / d-d-incident-and-correction`：突发偏差、纠偏与提交；PPT 第 16—18 页。

绑定的是四段稳定章节，不是 18 组 Slide→Block 映射。PPT 只负责讲解和公共叙事；Classroom 仍是解锁、手牌、作品和验收的唯一运行真值。

## 5. 12 张私密事故卡

卡组 `device-booking-incident-private-evidence` 包含 12 张短卡：

```text
用户现场       3
系统与数据     3
业务规则       2
测试记录       2
边界与未知     2
```

全部满足：

- `boundary = R`；
- 正文以“课堂模拟：”开头；
- `sourceIds = []`；
- 一卡只讲一个主要现象，并带一个可以说给队友的动作；
- 不绑定 P／D／M／O 学员身份。

2、4、6 人课堂均为每人两张、团队内不重复；同一 Classroom、同一学员在 B05—B08 回看和刷新时保持同一手牌。

## 6. DevelopmentStick／开发立棍卡

B08 提供十项触摸可填写的结构化交付物：

1. 当前情况与真实故障。
2. 用户要完成的事。
3. 一级主棍目标。
4. 最小完整用户路径（3—6 条）。
5. 最终验收标准（2—6 条）。
6. 约束、禁止事项与红线（2—6 条）。
7. 二级子棍（严格 2—3 条）。
8. 三级微棍（1—6 条）。
9. 可执行测试（1—6 条）。
10. 偏差、原因与纠偏记录。

列表条数由浏览器和服务端共同校验；未知字段、漏填、过短、过长和条数越界都会拒绝。学员端不投影 `mentorPrompt` 与六项导师 rubric。

作品生命周期与电子剧本解锁、经济系统相互独立：

```text
submitted → rejected + 具体反馈 → submitted → accepted
```

回看、前进、刷新和导师审核不会重发手牌，也不会改动 RP、个人钱包或团队资金。只有已通过的 DevelopmentStick 才会在 B09 投影给 M 导师；其他学员、P、O 看不到 D 的原始提交或错误交接。

验收接口先校验调用者是否属于该课堂，再查询不透明的提交 UUID；课堂外账号探测真实／虚构 UUID 都只得到同一个 `403 CLASSROOM_ACCESS_FORBIDDEN`，不能用响应差异枚举作品。审核更新同时绑定 `expectedUpdatedAt`，过期页面不能覆盖刚刚重交或刚刚审核的版本。

本次角色投影与课堂验收契约已提升为：

```text
course-projector-v5
minisv-t090-development-v1
```

因此旧投影器或旧应用构建签发的验收回执不会继续授权 Production；正式发布前必须针对当前 exact Candidate 重新完成两级人工验收。

## 7. Studio 与 Test Classroom 验收 SOP

1. 在 Course Studio 导入 `eleme-2008-product-development-t090.json`，保存为新 Candidate；不要覆盖 r0 或 T-091 文件。
2. 进入“多角色视图验收”，用左右方向键检查 B01—B13。
3. 在 B05—B08 展开 D 导师，确认四个检查点分别映射 1—5、6—10、11—15、16—18 页。
4. 依次选择 2、3、4、5、6 人，展开每名学员，确认每人两张 `R 课堂模拟` 私密卡。
5. 签发 ViewAcceptanceReceipt，创建 Test Classroom；绑定 exact D r0。
6. 在 B04 提交并由 P 验收 ProductBrief；解锁 B05 后确认 D 看到该上游成果和自己的模拟剧本。
7. 在学员视角交换两张事故卡，依次推进 B05—B08。
8. 用 Pad／手机视窗填写 DevelopmentStick；先让 D 退回一次，再修改并通过。
9. 解锁 B09，切换 M 导师，确认只读到已通过的 DevelopmentStick。
10. 用“上一页”“回到最新”和桌面方向键回看，确认作品、手牌、经济数据与解锁前沿均未改变。
11. 完成实际多设备课堂后，再签发 UiAcceptanceReceipt；本地自动测试没有替人签发正式回执。

## 8. 关键实现文件

- Candidate：`tools/live-run/courses/candidates/eleme-2008-product-development-t090.json`
- D exact 课件：`public/courseware/development-mentor-ligun/`
- 内容契约：`app/lib/course-package.ts`、`tools/live-run/course.py`
- 动态发牌与 Studio 投影：`app/lib/course-platform.ts`
- 作品校验：`app/lib/course-submission.ts`
- 课堂权限、持久化与交接：`app/lib/classroom-platform-store.ts`
- 学员／导师 UI：`app/classroom/ClassroomRuntime.tsx`
- 单元测试：`tests/development-mentor-package.test.ts`、`tests/course-submission.test.ts`
- API E2E：`scripts/test-t090-development-mentor-e2e.ts`
- 浏览器验收：`tools/live-run/tests/verify_t090_development_mentor_browser.py`
- 机器盘点：`docs/DEVICE_BOOKING_T090_CONTENT_INVENTORY.json`
- 本地测试回执：`docs/TODO_090_LOCAL_TEST_RECEIPT.json`

## 9. 生产交付状态

2026-09-09 已完成可回滚生产部署，并将本 Candidate 导入线上 Studio：

```text
Hecate Release  20260909T205212CST-t090-t093-course-release-r1
Source commit   4edfdffa3eaeca1491da7c44d61b69b30d7193e4
Course          eleme-2008-find-problem
Candidate       r10
Course digest   bbb3d912b94b93127422d83cd03c1ad1aca3119b48f38797af1718dc99db281a
D courseware    development-mentor-ligun r0
D digest        cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d
```

- `https://minisv.vip/` 已由 Hecate 提供该构建，公网与本机健康检查通过。
- D 导师课件的匿名直链返回 `401`；导师账号登录后 exact 深链返回 `200`，并保留 `revision`、`slide`、`step`。
- Candidate r10 已在生产 D1 中校验为当前 Candidate，仍未标记 Released。
- 没有自动伪造 `ViewAcceptanceReceipt` 或 `UiAcceptanceReceipt`，也没有绕过门禁创建 Production Classroom。
- 下一步由团队在 Studio 多角色视图和真实 Test Classroom 中完成两级人工验收；完成后才能发布 r10。

完整部署证据见 `docs/TODO_090_093_PRODUCTION_DEPLOYMENT_RECEIPT.json`。
