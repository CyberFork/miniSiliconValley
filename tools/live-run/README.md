# Mini Silicon Valley LIVE RUN

生产课堂控制器与课程 JSON 运行时。公开入口：

- 八席控制台：<https://minisv.vip/alpha/>
- 导师主控：<https://minisv.vip/control/>
- 课程编辑器：<https://minisv.vip/control/editor/>

## 课程包

- `live-run-script.json`：Google 5 大步 / 13 小块。
- `live-run-script-eleme.json`：饿了么 5 大步 / 13 小块。
- `courses/course.schema.json`：Course Package v1 JSON Schema。
- `courses/course-template.json`：中性完整模板。

编辑器支持结构化编辑、JSON 源码、导入、导出、检查、草稿、发布与克隆。草稿不会进入上课选课区；发布版只由新 Run 或重置 Run 加载。活动 Run 把开课时的 JSON 固定到 `active-course.json`，服务重启不会中途换稿。

生产课程数据位于 Hecate 的 `~/Services/minisv/data/courses/{drafts,published,history}`，不随 release 被覆盖。完整 SOP：[`../../docs/COURSE_PACKAGE_SOP.md`](../../docs/COURSE_PACKAGE_SOP.md)。

## 测试

```bash
cd tools/live-run
python3 course.py --write-json
python3 -m py_compile course.py controller.py classroom_api.py
node --check static/controller.js
node --check static/editor.js
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -v
```

部署、回滚与权限边界见 [`../../deploy/minisv/docs/OPERATIONS.md`](../../deploy/minisv/docs/OPERATIONS.md)。
