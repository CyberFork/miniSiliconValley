---
type: todo
id: T-131
title: "首款游戏作业详情：逐项弹窗修改与不可变修订"
status: completed
created: 2026-09-19
updated: 2026-09-19
captured_by: project-inbox
related: [T-119]
tags: [todo, homework, teacher, inline-edit, revisions, security]
---

# 首款游戏作业详情：逐项弹窗修改与不可变修订

## 用户需求

提交后的 `/homework/first-game/submissions/{ID}/` 页面中，每一个输入内容都能参考既有课件编辑交互，点击后弹窗修改。

## 权限与数据边界

- 公开访客和学员继续只读，不能因为知道公开 ID 就篡改他人作业。
- 真实登录的导师或管理员可以编辑；测试身份模拟、未改初始密码的会话不得编辑。
- 原始提交保持不可变；每次保存追加完整修订快照，并记录编辑账号和时间。
- 采用期望 revision 防止两个老师同时保存时静默覆盖。

## 验收

- [x] 姓名／昵称、公司名称以及全部文本、单选、多选、表格单元格都可点击打开弹窗。
- [x] 未填写的可选项也能在导师编辑模式中补充；必填规则、选项和长度限制仍由服务端重验。
- [x] 保存后页面即时显示新值，刷新后仍保留；列表摘要同步最新昵称、公司和内容数。
- [x] 未登录、学员、测试身份和过期 revision 均不能保存。
- [x] 原始记录和所有修订不可 UPDATE／DELETE，修改历史可审计。
- [x] 桌面、键盘和移动触摸交互可用；弹窗支持取消、Escape、保存中和错误反馈。
- [x] 自动化、构建、Hecate healthcheck 与生产 public smoke 通过；不代签用户人工验收。

## 交付证据

- 实现提交：`bfc2683ee36f11a22c42090e8829ef294a60c9ae`。
- Hecate 发布：`20260919T1109CST-t131-homework-edit-r5`，`release.json` 已核对到上述提交。
- 真实浏览器链路：鼠标点击弹窗并保存、键盘打开与 Escape、触摸打开、刷新后持久化、390×844 无横向溢出均通过。
- API 与数据：导师／管理员修订成功、过期 revision 返回 409、学员返回 403、匿名生产 PATCH 返回 401；生产修订表及 UPDATE／DELETE 禁止触发器已核对。
- 回归：平台全量 221 项通过；T-131 定向 14 项、部署测试 59 项、TypeScript、ESLint、构建、Hecate healthcheck 与生产 public smoke 均通过。
- 人工 View/UI 验收仍由用户完成，本任务未代签人工验收。
