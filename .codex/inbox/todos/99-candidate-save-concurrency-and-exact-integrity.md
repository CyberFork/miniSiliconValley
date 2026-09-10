---
type: todo
id: T-099
title: "修复多人保存课程时的覆盖与exact指针损坏"
status: backlog
created: 2026-09-10
captured_by: project-inbox
priority: P0
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098]
related: [T-094, T-095]
---

# 修复多人保存课程时的覆盖与 exact 指针损坏

## 已隔离复现

源码：course-registry.ts:40–99；api/studio/candidates/route.ts:8–16；public/studio/editor-assets/editor.js:984–1000；drizzle/0003_course_registry.sql:1–21、0004_unified_course_factory.sql:1–8。

- 编辑器只提交完整course，不带base revision/digest。A保存后，B从旧基线保存也成功，新Candidate可静默丢掉A的改动；A历史快照仍在，不等于历史被删除。
- 两写者同时读取MAX(revision)，都选同一新revision。随后INSERT OR IGNORE使第二份正文被忽略，但Candidate pointer仍更新为第二份digest。两次保存均报告成功；按pointer读取出现COURSE_VERSION_NOT_FOUND。
- 外键只约束courseId+revision，没有约束digest属于同一条快照。

见T-097证据probe-results.json的stale-editor-save/concurrent-candidate-save。合成数据SQLite复现，不表示已观察到线上损坏。

## 实现方案

- 保存携带baseRef/expectedCandidateRef，以原子compare-and-swap校验基线；冲突返回409并保留本地Working Copy。
- revision分配、快照写入、pointer变更和成功事件必须形成一个原子条件写链；禁止用INSERT OR IGNORE掩盖不同digest的版本冲突。
- 建立exact组合唯一约束/引用约束或等价数据库守卫；迁移前只读检查现存孤立/错配pointer，先备份再制定修复策略。
- 重复提交同一payload可幂等返回已存在结果；不同payload争抢revision不能都成功。
- 回执/发布pointer的检查与写入同步检查并发，避免检查后Candidate已变化却发布旧对象。
- UI展示冲突作者/时间/基线，支持比较、重新载入或显式合并；不得自动覆盖同事字段。

## 验收

- [ ] A/B同基线并发不同正文：一方成功，另一方明确冲突；无孤立pointer。
- [ ] 旧基线顺序保存也被识别，而不只测试同时请求。
- [ ] 每个成功返回ref能立即loadExact成功且digest匹配。
- [ ] 同正文重试幂等；失败请求不写“成功保存”审计。
- [ ] 发布/保存并发、恢复历史为新版本、fieldModel迁移后保持约束。
- [ ] 接口、数据库真实事务和浏览器冲突提示都测试，不只断言源码含某个字符串。
- [ ] 不修改运行中Classroom和旧不可变快照。

