---
type: todo
id: T-101
title: "保证课堂状态原子更新及弱网下视图和输入一致"
status: backlog
created: 2026-09-10
captured_by: project-inbox
priority: P1
priority_basis: audit-recommendation
parent: T-097
depends_on: [T-098]
related: [T-088, T-094]
---

# 保证课堂状态原子更新及弱网下视图和输入一致

## 源码发现（待故障注入与真实UI复现）

- classroom-platform-store.ts:1024–1044：先独立run更新script_progress，再batch写lifecycle与审计。第二段失败时，解锁已持久化但状态/审计可能未更新；两次解锁交错或Test reset交错也需覆盖。
- ClassroomRuntime.tsx:75–99、211–237：定时读取后直接setData(next)，effect退出只清timer，未取消已发请求或检查请求世代。快速换Block/角色、慢响应可能把旧payload覆盖新视图。
- 普通活动记录在SeatView组件state里；结构化表单key包含updatedAt（:334），轮询收到导师反馈/同账号其他设备提交会重建表单。未保存输入是否丢失须实测，不把此风险写成已发生事故。
- submitClassroomBlockWork(:861–920)按room/block/profile/kind覆盖，没有expectedVersion；导师review已有expectedUpdatedAt，双向编辑一致性需统一。

## 建议方案

1. 解锁CAS、lifecycle、时间戳、审计合为一个原子业务操作；reset/提交/解锁加入runId或resetGeneration的条件守卫，跨run旧请求失败关闭。
2. GET响应按classroomId/runId/blockId/seatId及请求世代验证；取消失效请求，拒收旧响应。版本比较必须在同一run内，不能用旧run的大version压过新run。
3. 表单草稿按课堂/运行/席位/Block/schema隔离，换页先保存或提示；导师反馈不能静默清除学员正在输入的内容。
4. 写入支持expectedVersion/幂等键和409恢复；不能在失败后自动重复发牌、重复记账或伪装提交成功。
5. 明确断网/重连提示、最近同步时间；先实现网络恢复和输入不丢，不默认建设完整离线课堂。
6. 不改变“学员自由回看已解锁页”和“活动作品验收独立于翻页”这两个已确认规则。

## 验收

- [ ] 在数据库各写入节点故障注入：全部成功或全部回滚，审计不缺失。
- [ ] 两导师解锁/解锁与reset/提交与reset交错保持同一run的完整状态。
- [ ] 延迟B01响应至B02之后、延迟旧角色响应至切换后，界面不回退。
- [ ] 两设备同席提交明确冲突，不悄悄抹掉同伴或本人更新。
- [ ] Pad输入中收导师反馈、横竖屏、短暂断网、切页回看不丢草稿。
- [ ] 换账号不继承前账号私密草稿；不在URL/日志放学员输入。
- [ ] Production不能被Test reset或Studio保存影响。

并入T-088无键盘学员验收；本轮未故障注入生产系统。

