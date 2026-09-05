# Course Package v1

这里保存可移植的课程包契约：

- `course.schema.json`：JSON Schema 2020-12，供 IDE 与外部工具校验。
- `course-template.json`：完整 5 大步 / 13 小块中性模板。

Google 与饿了么的内置课件暂保留在上一级目录，避免破坏已有发布脚本。生产编辑器把草稿和发布版写入 Hecate 的 `~/Services/minisv/data/courses/`，不会写回不可变 release。

权威说明与实施 SOP：[`../../../docs/COURSE_PACKAGE_SOP.md`](../../../docs/COURSE_PACKAGE_SOP.md)。
