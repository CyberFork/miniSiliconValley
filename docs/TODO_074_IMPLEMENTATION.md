# T-074｜Alpha 抽卡内容工作台实现说明

状态：已实现、已发布、已完成生产只读验收
入口：<https://minisv.vip/control/editor/>
权限：`admin` / `mentor`

## 1. 主棍

T-074 不再制造另一份卡牌数据，而是把已经存在于课程 JSON 的 `sources + decks` 变成导师能直接查找、编辑、预览、同步和回滚的制课工作台。

唯一真值仍是 Course Package v1：

- 一门课：5 大步 / 13 小块。
- 每一步：1 个阶段卡组；每组至少 12 张。
- 一轮发牌：4 名学员 × 3 张，不重复、不按 P/D/M/O 分牌。
- 一张卡：稳定 `id`、`boundary`、`title`、`body`、`sharePrompt`、`sourceIds`。
- 一个 Run：保存已经发出的稳定卡牌 ID；显式刷新只替换相同 ID 的内容。

## 2. 三个一级工作区

### 课程结构

编辑课程信息、五大步、十三小块、双轨内容、导师 SOP、道具、验收门和八席任务。

### 抽卡内容

新增为真正的一等入口，而不是埋在步骤表单中的“阶段卡组”：

- 全课程搜索：标题、正文、分享提示、稳定卡牌 ID、来源 ID、来源标题、来源组织和 URL。
- 五类筛选：所属步骤、F/R/G/U、是否有来源、是否进入当前 Alpha 手牌。
- 搜索结果显示：证据边界、步骤、发牌块、稳定 ID、来源数和 Alpha 已发状态。
- 点击搜索结果或当前 Alpha 手牌 ID，直接跳到同一张卡的编辑区。
- 当前步骤仍支持新增、复制、排序、受保护删除和 4×3 模拟发牌。

### JSON 源码

仍可编辑完整运行 JSON。应用前必须通过服务端深度校验；课程结构和抽卡内容一起更新。

## 3. 学员同款预览

`static/card-view.js` 是唯一共享渲染器，同时被：

- Alpha 学员席位 `seat.js`；
- 课程编辑器“学员最终看到什么”；
- 模拟 4 人发牌预览

调用。

它统一处理：

- `F 有来源 / R 课堂模拟 / G 我们猜的 / U 还不知道`；
- `可查来源 / 不是史实 / 需要验证 / 继续调查`；
- `在我手中 / 未读 / 已读 / 已向团队讲出`；
- 去掉 `F-02 ·`、`R-04 ·`、`C-05 ·` 等作者侧旧前缀；
- 所有课程文字 HTML 转义；
- F 卡来源编号。

预览状态只是编辑器本地视图，不写入课程 JSON。稳定 ID 只显示在导师编辑区，不进入学员卡片。

## 4. 完整性与版本诊断

API 与编辑器同时显示并校验：

- 编辑器 build 与站点 release；
- 课程来源（内置基线／团队课件）；
- Course Package Schema；
- 5 大步、13 小块；
- 卡组数、总卡数、每组卡数；
- 草稿 revision、发布 revision、digest；
- Alpha active revision、digest、refresh epoch；
- 当前课程与 Alpha 课程是否一致。

发布阻断条件：不是 5 个卡组、任一组少于 12 张、重复稳定 ID、F 卡无来源、引用不存在来源、Schema/浏览器资源版本不一致。内置 Google 与饿了么均严格为 5 组 / 60 张；新课程允许在每组 12 张基础上扩充。

## 5. 当前 Alpha 手牌反查

编辑器只在导师/管理员 RBAC 页面显示当前内部 Alpha Run 的 4×3 稳定 ID：

- 按当前选择的大步骤显示四名 Young Builder；
- 每人三张卡；
- 点击 ID 直接反查课程卡；
- Alpha 运行其他课程时强阻断，不伪造映射；
- 不写入公开 Alpha 总览，也不跨席位下发给学员。

## 6. 保存、刷新与历史恢复

- 保存草稿：只创建新 revision，不改变当前 Run。
- 发布：供新 Run/重置 Run 选择，不热切换正式课堂。
- 全部刷新 Alpha：显式加载最新完整草稿或发布版；保留 Run ID、真实执行位置、课堂成员、提交、评分、RP、个人钱包、团队资金和已发卡牌 ID。
- 刷新失败：控制器恢复旧脚本和旧状态。
- 版本历史：每次保存生成不可变快照；选择旧快照时复制为**新的草稿 revision**，不覆盖历史，也不自动刷新 Alpha。

## 7. 指定卡验收

饿了么课程可以直接搜索：

- `e08-c-05`｜创始成员亲自送餐｜F｜2 个来源；
- `e08-f-02`｜电话和餐厅信息是早期入口｜F｜有来源；
- `e08-r-04`｜多张订单需要排路线｜R｜无史实来源。

自动化浏览器已覆盖：搜索三卡、F/R 预览、边界筛选、4×3 当前手牌、编辑已发卡、保存不静默生效、显式刷新保留 Run、恢复 r0 为新 revision、再次刷新、移动端无横向溢出。

## 8. 结构编辑区布局收口

课程块标题原本使用 `white-space: nowrap`，而左侧 Grid 子项保留了浏览器默认的 intrinsic minimum size。标题较长时，按钮虽不会增加页面 `scrollWidth`，却会越过左侧轨道并绘制在右侧表单上。

已从布局根上修复：

- `.block-layout`、两个 Grid 子项和块按钮明确允许收缩；
- 按钮宽度严格受左侧轨道约束，多余文字在按钮内截断，不再盖住表单；
- 桌面轨道使用 `clamp(170px, 22%, 220px)`，有空间时提高可读性，窄宽度时稳定收缩；
- 容器进入单列时仍保留横向可滑动的块选择器。

布局测试现在直接测量左侧按钮、轨道和右侧表单的矩形关系，而不只检查页面是否出现滚动条。

## 9. 测试命令

```bash
cd tools/live-run
python3 -m py_compile course.py controller.py classroom_api.py
node --check static/card-view.js
node --check static/editor.js
node --check static/seat.js
node --check remote-console/server.mjs
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -q
node --test tests/test_card_view.mjs tests/test_remote_console_security.mjs
PYTHONPATH=. python3 tests/verify_t074_browser.py
PYTHONPATH=. python3 tests/verify_editor_layout_browser.py
# 生产只读验收；凭据只经环境变量传入，不会写入日志或回执。
MSV_QA_USERNAME='...' MSV_QA_PASSWORD='...' \
MSV_QA_RELEASE='20260906T064756Z-t074-layout-r2' \
PYTHONPATH=. python3 tests/verify_t074_production_readonly.py
```

生产回执见 `tools/live-run/docs/TODO_074_PRODUCTION_RECEIPT.json`。回执只记录 release、哈希和验收结论，不记录账号、Cookie、token 或密码。
