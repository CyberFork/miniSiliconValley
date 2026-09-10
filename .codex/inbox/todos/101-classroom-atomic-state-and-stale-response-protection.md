---
type: todo
id: T-101
title: "保证课堂状态原子更新及弱网下视图和输入一致"
status: complete
created: 2026-09-10
captured_by: project-inbox
priority: P1
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098]
related: [T-088, T-094]
---

# 保证课堂状态原子更新及弱网下视图和输入一致

## 完成说明

已完成课堂写入原子性、run identity/CAS、幂等键、D1 batch claim+assertion、旧响应淘汰、设备草稿隔离与断线提示；契约见 `docs/CLASSROOM_CONSISTENCY_CONTRACT.md`。

## 验收

- [x] 数据库各写入节点故障注入：全部成功或全部回滚，审计不缺失。
- [x] 两导师解锁/解锁与 reset/提交与 reset 交错保持同一 run 的完整状态。
- [x] 延迟 B01 响应至 B02 之后、延迟旧角色响应至切换后，界面不回退。
- [x] 两设备同席提交以 CAS 明确冲突，幂等重放不重复记账。
- [x] 自动化覆盖断线提示、重连、草稿保留契约；Pad 输入中收导师反馈、横竖屏的真实设备人工验收仍归 T-088，本轮未声称已完成。
- [x] 草稿按账号/视角/课堂/run/席位/Block/schema 隔离；输入不进 URL/日志。
- [x] Test reset 仅限 Test；Production 不受 Test reset 或 Studio 保存影响（代码边界与自动化覆盖）。

## 真实测试证据

- `npm run test:classroom -- --test-name-pattern='(applyScriptAction|two mentors|submission CAS|review CAS|reset rolls back|runtime source|delayed B01|device drafts)'`：通过。
- `git diff --check`：通过。
- 自动化覆盖：batch 每节点失败后的全回滚、CAS 竞态、幂等与复用键、reset 后旧 run 拒绝、弱网旧响应淘汰、草稿 key 隔离及 offline/online/AbortController 源码契约。
- Pad 实机输入中收反馈/旋转/切页人工验证属于 T-088；T-101 的工程门槛已完成，本轮未进行生产故障注入。
