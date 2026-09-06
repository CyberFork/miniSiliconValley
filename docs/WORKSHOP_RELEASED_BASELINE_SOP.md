# Workshop Released 基线发布 SOP

## 目的与单一真值链

课程内容沿着 `Candidate → Alpha exact revision/digest → Released → Classroom` 单向流动。Workshop 只读 `public-redacted Released` 快照；不自动与编辑器或 Classroom 双向同步。唯一写入口是 `/control/editor/`。

每个 Released 版本必须保留不可变 `revision` 与内容 `digest`。Workshop 产物为 `deploy/minisv/workshop/confirmed-baseline.json`，由 `tools/live-run/workshop_snapshot.py` 生成；它是确认后的展示快照，不是另一个课程编辑源。

## 操作流程

1. 在 `/control/editor/` 编辑 Candidate，执行 schema、结构、来源和脱敏校验。
2. 生成 Alpha revision；记录 revision、canonical digest、生成时间和操作者。Alpha 必须精确引用该 revision/digest。
3. 评审并标记 Released；不得原地覆盖历史 revision。
4. 用工具从 **Hecate 当前课程 Registry 目录**生成 public-redacted 快照。它可以包含用于完整性核对的稳定卡牌 ID，但绝不包含卡牌正文、导师脚本、学员数据、手牌、RP、钱包、账本、租约、密钥或内部路径。
5. 把通过校验的静态源快照随发布包写为 `/workshop/confirmed-baseline.json`；`package_release.py --workshop-snapshot <path>` 会在打包阶段再次验证来源、五步/13 Block/5 卡组结构、aggregate digest、integrity digest 与脱敏边界。
6. Workshop 浏览器只把该文件当作“课程源最新 Released”。它不会静默建立或替换本次会议基线：用户须先预览差异，再在确认对话框填写操作人。确认结果、旧版备份、提案、会议决议和审计日志分别保存在本机 localStorage。
7. 回流只导出 `target=/control/editor/`、`writesCourse=false` 的 Change Request JSON；课程编辑器人工采纳后仍须重新经历 Candidate → Alpha → Released。
8. 源加载、完整性校验或单调版本检查失败时，浏览器继续使用上一次已确认的本机会议信息；不得用半成品替换，不得自动刷新 Alpha、Classroom 或运行数据。

生成示例（命令不输出密钥）：

```sh
python3 tools/live-run/workshop_snapshot.py \
  --registry-dir /secure/read-only-copy/of/hecate/Services/minisv/data/courses \
  --generated-at 2026-09-07T00:00:00+08:00 \
  --actor release-exporter \
  --output /tmp/minisv-workshop-released.json

python3 deploy/minisv/package_release.py \
  ... \
  --workshop-snapshot /tmp/minisv-workshop-released.json
```

## 回滚

静态源快照随整站 release 原子回滚；浏览器中的“已确认会议基线”另有 backup key，源失败时不会删除。回滚 Workshop 不会回滚 Released、Alpha 或 Classroom。任何内容修复都创建新 Candidate/revision，重新走发布链。

本机存储键：

- `msv.workshop.confirmed-baseline.v1`：当前会议明确确认的只读基线。
- `msv.workshop.confirmed-baseline.backup.v1`：确认更新前的上一版。
- `msv.workshop.baseline.proposals.v1`：讨论提案，绑定创建时 snapshot/course digest。
- `msv.workshop.baseline.decisions.v1`：独立会议决议。
- `msv.workshop.baseline.audit.v1`：最近 100 条操作审计。

## 验收命令

```sh
python3 tools/live-run/workshop_snapshot.py --help
python3 -m unittest -q tools.live-run.tests.test_workshop_snapshot
python3 -m unittest -q deploy.minisv.tests.test_course_release
python3 tools/live-run/tests/verify_workshop_baseline_browser.py
```

人工验收：检查首次载入不自动确认、差异预览、取消确认后本地基线未变、失败后旧基线仍可读、确认后 revision/digest 与静态 Released 源一致，以及回流文件明确声明不会直接写课程。命令与检查是 SOP 要求，不声称已部署结果。
