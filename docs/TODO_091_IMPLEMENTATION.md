# T-091｜饿了么剧本收敛到 P 产品导师

状态：本地 Candidate 包与完整测试已完成；尚未导入线上 Studio、尚未部署、尚未发布 Released。

## 1. 这次真正收敛了什么

T-091 不改写已经进入历史的饿了么 r0，也不修改同事维护的 P 导师静态课件。它新增一个可由 Course Studio 导入、验收和发布的 Candidate：

```text
tools/live-run/courses/candidates/eleme-2008-product-mentor-t091.json
```

新的课程数据关系是：

```text
四个交大来源
  → historical CasePackage（P 所有，来源与证据 revision 固定）
  → ScriptPackage（P 所有，B01—B04）
  → 四个稳定检查点（只提示 PPT 章节范围）
  → 学员 ProductBrief（B04）
  → P 退回／通过
  → 仅把“已通过”的 ProductBrief 交给 D（B05）
```

四位导师的专业课件仍然全部绑定 Classroom，但“拥有专业工具包”不等于“拥有饿了么历史剧本”。

## 2. 不可变基线

### 饿了么课程 r0

- 文件：`tools/live-run/live-run-script-eleme.json`
- Course ID：`eleme-2008-find-problem`
- revision：`r0`
- digest：`407a24b43ead68ddccf0871fe7910ae21f1ca64ec4b7232a2bc0afeb2cfecb6c`
- 处理：保持逐字节不变；失败的 Candidate 不能污染它。

### P 导师运行时课件

- package：`cw-product-mentor-foundations`
- slug：`product-mentor-foundations`
- revision：`r0`
- digest：`b2852b39462bc05464582b3c36f773e68fa84775b9e7c7673a128fac97d7cda5`
- source commit：`679213a61b835335016eac7649213983a0e48489`
- source tree：`3a041c4714190cc026f6de8e06e15cec0e5f765d`

ClassroomFactory 会核对以上 exact ref。若 Candidate 声明的 P 课件与课堂绑定不同，将以 `COURSE_CONTENT_COURSEWARE_MISMATCH` 拒绝创建，不允许静默错页。

本地 `cowork/课件/product-courseware/course/` 是较新的同事快照，不等同于运行时 r0。本轮只读、不覆盖；待课件所有者审核后，应建立新的不可变 revision，而不是改写 r0。

## 3. 四个 P 导师检查点

1. `B01 / p-a-enter-2008`：进入 2008 年现场，对应第 7—15 页。
2. `B02 / p-b-find-real-problem`：识别真正问题，对应第 16—20 页。
3. `B03 / p-c-rebuild-early-mvp`：重建早期 MVP，对应第 22—33 页。
4. `B04 / p-d-transfer-project`：迁移到学员项目，对应第 36—62 页。

检查点只绑定稳定章节范围，不把课堂状态绑定到每一张 PPT。第 21 页的“2008 饿了么 App”缺少当前来源支持，Candidate 明确跳过，并在 `reviewQueue` 留下待审核项。

## 4. 学员与导师分别看到什么

### 学员

- 随机获得自己的三张信息卡；不固定为 P／D／M／O。
- 卡片持续显示完整边界：`F 有来源 / R 课堂模拟 / G 我们猜的 / U 还不知道`。
- B04 获得十项具体的 ProductBrief 表单。
- 只能读取自己的草稿、状态和 P 导师反馈。
- 看不到 `mentorPrompt` 和五项导师 rubric；这些字段由服务端投影移除，而非仅靠 CSS 隐藏。

### P 产品导师

- B01—B04 看到 P 所有权、检查点目的、PPT 章节提示、公开动作和当值私有主持提示。
- B04 看到 ProductBrief 十项内容、每项导师追问和五项 rubric。
- 可以“退回修改”或“通过并交给 D”。退回必须填写具体反馈。

### D 开发导师

- B01—B04 不获得 P 的历史私有讲稿。
- B05 只获得最近一份已通过 ProductBrief 的结构化交接。
- 保留 B05 自己的开发主持脚本，不重复讲解饿了么历史。

### M／O 导师

- 不获得 P 历史私有讲稿。
- 不获得 P→D 的 ProductBrief 交接。
- 只保留各自步骤的专业任务和课件。

### Admin DM

- 在 Test Classroom 可切换真实角色投影并完成验收。
- 不被建模成第五个导师席。

## 5. ProductBrief 状态与数据边界

ProductBrief 不是 ScriptProgress 的一部分：

```text
剧本解锁：只决定 B01—B13 哪些电子剧本页可以看
作品状态：submitted / rejected / accepted
经济系统：RP / 个人钱包 / 团队资金
```

三者独立。翻页、回看、解锁或导师验收不会偷偷改 RP、钱包、资金或手牌。

作品流程：

```text
学员提交
  → submitted
  → P 退回：rejected + 具体反馈
  → 学员重交：submitted（旧审核被清除）
  → P 通过：accepted
  → 到 B05 后 D 可读取交接
```

提交使用现有 `classroom_block_submissions`，结构化内容与审核元数据存入版本锁定的 JSON payload；无需数据库迁移。审核使用 `expectedUpdatedAt` 做乐观并发控制，避免导师覆盖学员刚刚重交的版本。

## 6. 来源与卡片审计

- 4 个来源。
- 60 张卡：20 F、16 R、12 G、12 U。
- CasePackage 枚举全部 20 张 F 卡；F 卡必须有 `sourceIds`。
- R 正文必须以“课堂模拟：”开头。
- G 正文必须以“团队推测：”开头。
- U 正文必须以“当前未知：”开头。
- 未解决问题进入 `contentPackages.reviewQueue`，只在 Studio／导师内部显示，不泄漏给学员。

机器可读盘点：[`ELEME_T091_CONTENT_INVENTORY.json`](./ELEME_T091_CONTENT_INVENTORY.json)。

## 7. Studio 到 Test Classroom 的人工 SOP

1. 在旧版 Course Studio 编辑器中导入 `eleme-2008-product-mentor-t091.json`。
2. 保存为 Candidate，不覆盖 r0。
3. 进入“多角色视图验收”。
4. 用左右方向键检查 B01—B13；展开 P／D／M／O 和学员卡片。
5. 在 B01—B04 确认只有 P 显示 P 专属检查点；D／M／O 不复制 P 私有讲稿。
6. 确认内部待审核清单包含课件快照差异与第 21 页来源风险。
7. 签发 ViewAcceptanceReceipt。
8. 创建 Test Classroom，绑定 exact P r0 和 D／M／O 各自课件。
9. 从中控依次解锁到 B04；切换学员视角填写并提交 ProductBrief。
10. 切换 P 导师视角，先退回并填写建议；学员修改后重交；P 再通过。
11. 解锁 B05，切换 D 导师视角，确认只看到已通过 ProductBrief 交接和 D 自己的开发提示。
12. 刷新页面，确认作品、审核状态、手牌、解锁边界和经济数据均保持。

本轮只完成本地开发与自动化验证；没有导入线上 Studio、没有部署、没有生成 Production Release。

## 8. 关键实现文件

- CourseDefinition 契约：`app/lib/course-package.ts`
- Python/JSON Schema 校验：`tools/live-run/course.py`、`tools/live-run/courses/course.schema.json`
- P 所有权与投影：`app/lib/course-platform.ts`
- 提交投影与校验：`app/lib/course-submission.ts`
- Classroom 持久化、审核和交接：`app/lib/classroom-platform-store.ts`
- 提交与审核 API：`app/api/platform/classrooms/[classroomId]/submissions/`
- Classroom UI：`app/classroom/ClassroomRuntime.tsx`、`platform.module.css`
- Studio Preview：`app/studio/StudioApp.tsx`、`studio.module.css`
- 单元契约：`tests/eleme-product-mentor-package.test.ts`、`tests/course-submission.test.ts`
- Python 校验器契约：`tools/live-run/tests/test_course.py`
- 最短真实 E2E：`scripts/test-t091-product-mentor-e2e.ts`
- 浏览器验收：`tools/live-run/tests/verify_t091_product_mentor_browser.py`
- 本地验收回执：`docs/TODO_091_LOCAL_TEST_RECEIPT.json`

## 9. 本地验收命令

```bash
python3 tools/live-run/course.py --validate \
  tools/live-run/courses/candidates/eleme-2008-product-mentor-t091.json

npm run typecheck
npm run lint
npm run test:course-platform
npm run build:minisv-app
npm run test:t091:e2e
```

`test:t091:e2e` 使用临时本地 D1 和本地 Wrangler，不访问或修改线上数据；退出时删除临时数据库。
