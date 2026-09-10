---
type: todo
id: T-099
title: "修复多人保存课程时的覆盖与exact指针损坏"
status: done
created: 2026-09-10
completed: 2026-09-10
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

- [x] A/B同基线并发不同正文：一方成功，另一方明确冲突；无孤立pointer。
- [x] 旧基线顺序保存也被识别，而不只测试同时请求。
- [x] 每个成功返回ref能立即loadExact成功且digest匹配。
- [x] 同正文重试幂等；失败请求不写“成功保存”审计。
- [x] 发布/保存并发、恢复历史为新版本、fieldModel迁移后保持约束。
- [x] 接口、数据库真实事务和浏览器冲突提示都测试，不只断言源码含某个字符串。
- [x] 不修改运行中Classroom和旧不可变快照。

## 完成记录（2026-09-10）

- Candidate 保存 API 已改为 exact `expectedCandidateRef` CAS；首次创建必须显式传 `null`，旧基线返回 `409 CANDIDATE_SAVE_CONFLICT`。
- revision 分配、不可变快照插入、Candidate pointer 移动和成功事件写入组成原子条件批次；相同正文重试幂等，不再用 `INSERT OR IGNORE` 掩盖不同正文竞争。
- `0008_candidate_cas_and_exact_integrity.sql` 增加迁移前失败关闭检查、九类 exact 引用守卫，以及 `course_versions` UPDATE/DELETE 不可变守卫。
- 发布路径增加 exact Candidate CAS，验收后发生新保存时不发布旧 Candidate。
- Studio 编辑器保留 Working Copy，展示基线、最新作者/时间与双方字段路径；同路径合并和破坏性重载均需二次确认，合并后必须手动再保存。
- Hecate 部署脚本先停止服务并备份，再以只读 SQLite preflight 检查；发现错配、损坏或多个注册库时中止，不自动修复。
- 实际验证：平台测试 92/92、部署测试 45/45、T-099 并发/数据库测试 8/8、TypeScript、ESLint、构建、完整 E2E 和 Chromium 151 真实浏览器流程全部通过。
- 证据与说明：`docs/TODO_099_IMPLEMENTATION.md`、`docs/qa/t099-candidate-conflict/browser-receipt.json`、`docs/qa/t099-candidate-conflict/candidate-conflict.png`。
