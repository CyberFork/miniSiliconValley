---
type: todo
id: T-071
title: "将五阶段学员卡组纳入课程 JSON 与编辑器"
status: complete
created: 2026-09-06
updated: 2026-09-06
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - course-editor
  - course-json
  - card-system
---

# 将五阶段学员卡组纳入课程 JSON 与编辑器

## 原始记录

当前的课程编辑器中，学员每个不同阶段的抽卡我好像没有看到json中有？

记录到todo中，后续继续完善。

## 简要整理

当前课程 JSON 只记录五大步骤、十三小块、何时发牌、导师口播、学员动作与系统动作；具体身份卡、阶段信息卡及卡牌正文仍由课堂后端的 Google／饿了么 campaign 素材代码提供。课程编辑器只能通过 `case.campaignId` 选择既有素材底座，不能查看、编辑或新建五个阶段的实际卡组，因此尚未真正实现“一个 JSON 即一套可独立维护的新课件”。

## 目标形态

1. 将具体卡组数据从固定课堂素材代码迁入或同步到课程 JSON，课程包成为课程内容的可移植真值来源。
2. 五个完整步骤分别拥有明确卡组与抽卡时点：找真问题 B01、定真方案 B04、做真产品 B06、进真市场 B09、跑真运营 B11。
3. 每张卡至少包含稳定 ID、学员可读标题、正文、分享提示、F／R／G／U 证据边界和来源引用。
4. 抽卡规则可声明且可验证：默认四名学员、每人三张、同轮不重复、随机结果不与身份或 P／D／M／O 绑定。
5. 课程编辑器增加“阶段卡组”视图，支持查看、新增、复制、删除、排序、预览和模拟发牌。
6. 新建课程时只需要编辑或导入课程 JSON，不应再要求开发者修改 TypeScript campaign 文件。

## 建议 JSON 骨架

```json
{
  "decks": [
    {
      "id": "find-information",
      "macroStepId": "find",
      "drawAtBlockId": "B01",
      "cardsPerLearner": 3,
      "uniqueDeal": true,
      "shuffle": true,
      "cards": [
        {
          "id": "find-F-001",
          "boundary": "F",
          "title": "学员看到的具体线索",
          "body": "用初中生可以直接理解的语言描述信息。",
          "sharePrompt": "告诉队友这条信息说明了什么。",
          "sourceIds": ["source-001"]
        }
      ]
    }
  ]
}
```

## 原计划下一步

先盘点 `google-classroom-campaign.ts`、`eleme-classroom-campaign.ts` 中五章身份、信息卡和来源字段，形成统一 `decks` Schema；随后扩展课程校验、课堂运行适配器和课程编辑器，确保旧课程可无损迁移，新课程可以只依赖 JSON 完整运行。

## 验收标准

- Google 与饿了么课程 JSON 均包含五阶段实际卡组，而不仅是“随机发牌”的文字说明。
- 编辑器能够逐阶段查看和编辑卡牌，并显示每阶段卡牌数量与结构错误。
- 可在编辑器中模拟四人发牌，验证每人三张且十二张不重复。
- F 类事实卡必须具备有效来源；R／G／U 在学员端展示完整中文含义。
- 课堂后端按所选课程 JSON 发牌，不再把 `campaignId` 当作隐藏卡牌数据库。
- 克隆一门课程、替换卡牌、发布并创建新 Run 后，学员席位能看到新卡且不影响已运行课堂。
- 旧 Google、饿了么课程完成迁移并通过课程、API、八席隔离及浏览器交互回归测试。

## 关键控制点

课程 JSON 是否成为内容真值；五阶段卡组边界；卡牌来源与 F／R／G／U；随机且不重复发牌；学员语言可读性；旧 campaign 数据迁移；活动 Run 版本固定；编辑器预览和模拟发牌；八席私密信息隔离。

## 来源上下文

当前对话；承接 [[69-four-mentor-five-step-course-loop|T-069]]；当前课程 Schema、课程编辑器和课堂发牌适配器盘点。

## 完成回执（2026-09-06）

- 状态：完成。课程 JSON 已成为 Alpha 学员卡牌内容真值；`campaignId` 仅保留为课堂流程底座，不再提供 Alpha 卡牌正文。
- Google 与饿了么均已迁移为 5 个阶段卡组、每组 12 张，共 60 张；发牌固定为 4 名学员每人 3 张、同阶段 12 张不重复且不绑定 P／D／M／O。
- Schema 已验证稳定 ID、抽卡时点、F／R／G／U、来源引用；F 事实卡缺来源会被拒绝。
- 编辑器已支持逐阶段查看、新增、复制、删除、排序、预览、来源选择与 4×3 模拟发牌。
- 学员席位只收到自己的三张私密卡，并显示完整中文证据边界；个人 RP、个人钱包和团队资金继续保留。
- 已完成克隆课程、替换卡牌、发布、新 Run 发牌、旧课程迁移、席位隔离与浏览器回归测试。
- 生产 Release：`20260906T042434Z-course-decks-live-sync`；入口：`https://minisv.vip/control/editor/`。
- 实施说明：`docs/TODO_071_072_IMPLEMENTATION.md`；机读回执：`tools/live-run/docs/TODO_071_072_PRODUCTION_RECEIPT.json`。
