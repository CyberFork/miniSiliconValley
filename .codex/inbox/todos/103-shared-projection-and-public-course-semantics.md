---
type: todo
id: T-103
title: "收口共享投影实现与PDMO五步对外语义"
status: complete
created: 2026-09-10
captured_by: project-inbox
priority: P2
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098]
related: [T-073, T-081, T-094, T-095, T-102]
---

# 收口共享投影实现与 PDMO 五步对外语义

## 已确认、但不要误报的现状

- 浏览器public/studio/editor-assets/course-preview.js与服务端app/lib/course-platform.ts分别实现hash、shuffle、选deck、任务投影；当前195场景任务/cardId顺序一致。
- tests/course-projection-consistency.test.ts原重点为B01的2/4/6人和B05检查点；原修复确实有效。本任务是去掉重复实现并扩展回归，不是重开旧发牌缺陷。
- 旧课程缺learnerPolicy时回退2–4人，是已测试兼容策略，不应强改到6人使旧卡组容量不足。
- docs/COURSE_SEMANTICS.md:10自称权威，却写D（设计）；Runtime/课件/QA为D开发导师。
- 该文档:9把三玩法写为历史探索/团队决策/现实建造，而课程预览MODE_LABELS为毛线信息/美式攻坚/德式经营；可能是概念层次不同，需明确命名映射，不机械同词替换。
- README:18写/course只需导师/管理员登录，漏了已实现且用户明确要求的learner。
- app/data/parent-qa-knowledge.ts:63仍讲标准4导师4学员、产品担任主DM；应区分“默认班型”与动态2–6人、Admin DM可独立授权的当前能力，不能把默认值讲成平台硬限制。

## 实现方案

- 把确定性业务投影提取为一份模块，由构建生成浏览器可用产物，服务端同源引用；UI排版/编辑path元数据可不同。
- 统一校验错误语义：人数越界、卡组容量不足、unknownBlock不能一端报错另一端静默裁剪；编辑辅助容错必须显式标注未通过。
- 扩展全Block、声明全部人数、Unicode seed、checkpoint覆盖、卡牌正文/来源/顺序、导师字段、中控字段、空值和重复发牌策略测试。
- 课程平台、历史世界、Framework、Workshop、QA分别保留职责：
  - 历史事件是独立只读史实底座，不自动被课程编辑改写。
  - 对外课程摘要从批准的Released公共投影生成，禁止公开私密卡、内部剧本或未审核内容。
  - 历史文档/旧回执保留时间戳和“历史”标识，不全站无脑替换。
- 权威术语、默认班型/可支持人数、三玩法层次由负责人确认后同步说明；D按用户已确认“开发导师”收口。
- 当前固定13 Block/5步映射先明确是课程模板约束还是平台约束；若仍要实现用户5×n编辑，不直接破坏旧exact版本，另制定schema演进。

## 验收

- [x] 修改共享发牌/任务规则只需改一处源码，生成产物可重建。
- [x] 当前T-095全部195正向场景保持通过，并补导师/中控等未覆盖字段。
- [x] D名称、5步与独立6分钟Demo、默认人数和可支持人数表述一致。
- [x] README与匿名/mentor/learner课件权限实测一致。
- [x] 公开投影不暴露内部或未审内容；历史世界线仍不可被运行状态改写。
- [x] 完成会影响投影的重构后按T-102更新兼容契约与回执验证。

## 完成记录（2026-09-11）

实现与验证见 `docs/TODO_103_IMPLEMENTATION.md`。兼容契约升级为 `course-projector-v7`；没有生成或代签人工回执，也没有移动 Candidate／Released pointer。
