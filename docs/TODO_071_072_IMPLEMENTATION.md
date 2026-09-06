# T-071 / T-072 实施记录：课程卡组真值与 Alpha 即时同步

日期：2026-09-06
状态：已实现、已测试、已部署

## 结论

- Course Package v1 现在由同一个 JSON 携带 `sources`、5 套 `decks`、5 大步和 13 小块；Google 与饿了么各有 60 张阶段卡。
- Alpha 运行时只从活动课程 JSON 生成学员可见手牌。`campaignId` 只保留为身份、挑战、账本与历史揭晓流程底座，不再决定 Alpha 学员手牌正文。
- 卡牌按阶段首次执行时随机发给 4 名学员，每人 3 张、同轮 12 张不重复；卡牌不含 `holderIdentityId`，不按身份或 P/D/M/O 分配。
- 课程编辑器新增卡组查看、新增、复制、删除、排序、来源选择、卡面编辑和 4×3 模拟发牌。
- 编辑器保存只生成新修订并让 Alpha 显示“待刷新”。点击“全部刷新 Alpha”才在原 Run 中显式采用最新有效草稿或发布版。
- 热刷新保留 Run ID、真实执行位置、课堂、提交、评分、RP、个人钱包、团队资金与手牌位置；卡 ID 仍存在时更新同一张卡的正文，卡 ID 被删除时只为缺位补抽且仍保证 12 张不重复。
- “回看上一块 / 回看向前”只移动八席调试显示指针，不回滚任何真实副作用；回看时禁止执行、验收与重试。
- 每个席位同步 `courseRevision`、`courseDigest` 和 `refreshEpoch`；远程席位投影只包含自己的私密手牌。

## 原子性与失败边界

1. 最新 JSON 先通过完整服务端校验，才会替换活动脚本。
2. 课程 ID、B01—B13 稳定 ID 必须一致；真实课堂已创建后禁止热换运行流程底座。
3. 替换、手牌对齐、席位重建或持久化任一环节失败，内存恢复到原脚本与原状态，并记录 `course.refresh.failed`。
4. 草稿或发布文件损坏时，活动 Run 继续使用上一个完整版本。
5. 正式课堂没有自动订阅编辑器保存；热更新动作只存在于受导师/管理员 RBAC 保护的 Alpha 主控。

## 数据契约

每套 `decks[]`：

- `macroStepId`: `find / decide / build / market / operate`
- `drawAtBlockId`: `B01 / B04 / B06 / B09 / B11`
- `cardsPerLearner`: `3`
- `uniqueDeal`: `true`
- `shuffle`: `true`
- `cards`: 至少 12 张

每张卡：`id`、`boundary`、`title`、`body`、`sharePrompt`、`sourceIds`。其中 F 卡至少引用一个同包 `sources[].id`。

## 验证入口

```bash
python3 -m unittest discover -s tools/live-run/tests -p 'test_*.py'
node --test tools/live-run/tests/test_remote_console_security.mjs
python3 tools/live-run/tests/verify_todos_071_072_browser.py
```

课程内容操作详见 [`COURSE_PACKAGE_SOP.md`](COURSE_PACKAGE_SOP.md)。生产验收机读回执见 [`TODO_071_072_PRODUCTION_RECEIPT.json`](../tools/live-run/docs/TODO_071_072_PRODUCTION_RECEIPT.json)。

## 生产落点

- 入口：`https://minisv.vip/alpha/`
- 主控：`https://minisv.vip/control/`（需导师或管理员登录）
- 课程编辑器：`https://minisv.vip/control/editor/`（需导师或管理员登录）
- Release：`20260906T042434Z-course-decks-live-sync`
- 生产只读浏览器验收覆盖双主题同布局、主控三项调试动作、五阶段卡组和 4×3 唯一发牌模拟；验收过程没有改动现场 Run。
