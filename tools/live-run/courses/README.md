# Course Package v1

这里保存可移植的课程包契约：

- `course.schema.json`：JSON Schema 2020-12，供 IDE 与外部工具校验。
- `course-template.json`：完整 5 大步 / 13 小块中性模板。

Google 与饿了么的内置课件暂保留在上一级目录；两者均包含可移植的 `sources` 与 5 套 `decks`（每套 12 张）。`campaignId` 只选择运行流程底座，不再充当 Alpha 手牌数据库。生产编辑器把草稿和发布版写入 Hecate 的 `~/Services/minisv/data/courses/`，不会写回不可变 release。

## Candidate

- `candidates/eleme-2008-product-mentor-t091.json`：T-091 的可导入 Candidate。它不改写内置饿了么 r0，而是增加 P 所有的 `CasePackage`、`ScriptPackage`、四个章节检查点、ProductBrief 与 P→D 交接声明。
- `candidates/eleme-2008-product-development-t090.json`：在 T-091 后接入 D 所有的“校园共享设备预约系统失控”模拟剧本、12 张 R 卡、四个 D 检查点、DevelopmentStick 与 D→M 交接；支持 2—6 名学员。
- Candidate 必须先进入 Studio 保存、完成多角色视图验收和 Test Classroom UI 验收，才可成为新的 Released revision；文件存在不等于已经线上发布。
- 课程声明的 P／D 课件 exact ref 会在 ClassroomFactory 创建时强校验，防止课件 revision 变化后检查点悄悄错页。
- `CasePackage.caseType` 必须显式为 `historical` 或 `simulation`。历史包必须带来源与 F 卡；模拟包必须保持来源和 F 卡为空，模拟证据用 `R／课堂模拟` 表达。

T-091 的归属、来源、人工操作和本地测试说明：[`../../../docs/TODO_091_IMPLEMENTATION.md`](../../../docs/TODO_091_IMPLEMENTATION.md)。
T-090 的 D 剧本、课件、DevelopmentStick 和 2／4／6 人验收说明：[`../../../docs/TODO_090_IMPLEMENTATION.md`](../../../docs/TODO_090_IMPLEMENTATION.md)。

权威说明与实施 SOP：[`../../../docs/COURSE_PACKAGE_SOP.md`](../../../docs/COURSE_PACKAGE_SOP.md)。
