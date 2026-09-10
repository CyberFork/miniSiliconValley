---
type: todo
id: T-098
title: "收口唯一开发工程、文档和发布来源"
status: completed
created: 2026-09-10
updated: 2026-09-10
captured_by: project-inbox
priority: P0
priority_basis: audit-recommendation
parent: T-097
related: [T-085, T-096]
---

# 收口唯一开发工程、文档和发布来源

## 已确认问题

用户指定的 dev 工程 HEAD 为 dd28a57；新功能源码在临时目录，HEAD 为6400928且与远端main一致。T-085/T-094/T-096等完成回执在dev存在，但实现模块和对应回执JSON不在该工作树。旧dev的package.json/tests仍支持六步与旧Alpha，不能用于评价或发布当前平台。

详见 [T-097](97-project-design-consistency-audit-and-roadmap.md) 与 audit-baseline.json。线上源码f1b063b和较新HEAD之间只有文档差异。

## 实现建议

1. 确认稳定、可恢复的唯一开发根目录；长期源码不能仅依赖/private/tmp。
2. 先保存并分类dev已有未提交文件，特别是用户TODO、架构约定、非仓库资源；逐文件合并，不使用reset --hard、目录覆盖或删除旧树作为同步捷径。
3. 将远端版本恢复到选定工程，验证commit、build脚本、db迁移、Studio/Runtime/课件资源完整。
4. 项目说明标明唯一源码、cowork作者素材、临时构建、部署bundle、运行数据分别存放何处；素材不直接成为运行真值。
5. 发布manifest关联sourceCommit、构建产物hash、schema/contract版本；默认阻止从未审计脏树或旧工程发布，必要例外必须显式记录。
6. 将临时目录内新增回执和当前架构文档纳入稳定仓库，不改写已有历史回执。
7. 删除/封存临时目录是另行操作，本任务不默认授权清理。

## 验收

- [x] 从稳定目录干净检出可找到全部现行模块与课件manifest，不依赖旧临时目录。
- [x] 用户原有未提交内容无丢失，TODO编号和引用保持连续。
- [x] 页面诊断、release.json、Git commit、构建hash可以交叉对应。
- [x] 在旧dev执行构建/发布时有明确防误用提示，而不是重新发布旧Alpha。
- [x] T-099以后均在该基线上实现和复核。

## 完成回执

- 唯一工程：`AI教培-mini硅谷/dev`。
- 唯一远端：`CyberFork/miniSiliconValley`。
- 旧工程：`dev-legacy-minisv-dd28a57-20260910/`，已标记 retired 且完整保留。
- 未提交内容：45 份 `.codex/inbox` 文件原样迁入；2 份冲突架构文档单独归档，未覆盖 canonical 新版。
- 发布门禁：旧远端、退役标记、SHA 不符、未同步 HEAD 或未记录的脏树全部失败关闭。
- 证据：`docs/TODO_098_IMPLEMENTATION.md` 与 `docs/TODO_098_PRE_MIGRATION_SNAPSHOT.json`。

本任务未部署、未改生产数据、未删除旧工程或 `/private/tmp` 检出。
