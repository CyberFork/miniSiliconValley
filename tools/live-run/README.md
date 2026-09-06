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

编辑器提供“课程结构／抽卡内容／JSON 源码”三个一级工作区，支持 60 卡全文搜索与多维筛选、学员同款预览、当前 Alpha 4×3 手牌反查、卡组 CRUD/来源/模拟发牌、版本诊断、不可变历史恢复、导入、导出、检查、草稿、发布与克隆。每门课的 `sources`＋5 套 `decks` 是学员手牌内容真值；Google 与饿了么均为 5 套、60 张。

正式课堂不会静默换稿。Alpha 会提示存在新修订，导师点击“全部刷新 Alpha”后在原 Run 加载最新完整草稿或发布版；Run、真实进度、RP、钱包、团队资金与手牌位置保留。“回看”只改变八席显示，不撤销副作用。

生产课程数据位于 Hecate 的 `~/Services/minisv/data/courses/{drafts,published,history}`，不随 release 被覆盖。完整 SOP：[`../../docs/COURSE_PACKAGE_SOP.md`](../../docs/COURSE_PACKAGE_SOP.md)。

## 测试

```bash
cd tools/live-run
python3 course.py --write-json
python3 -m py_compile course.py controller.py classroom_api.py
node --check static/controller.js
node --check static/card-view.js
node --check static/editor.js
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -v
```

部署、回滚与权限边界见 [`../../deploy/minisv/docs/OPERATIONS.md`](../../deploy/minisv/docs/OPERATIONS.md)。
