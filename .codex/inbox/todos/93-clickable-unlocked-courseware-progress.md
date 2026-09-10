---
type: todo
id: T-093
title: "让课件分段进度条可点击跳转到已解锁状态"
status: completed
created: 2026-09-09
updated: 2026-09-10
captured_by: project-inbox
priority: P1
estimated_effort: small
depends_on:
  - T-089
related:
  - T-092
tags:
  - todo
  - mini-silicon-valley
  - courseware-player
  - progress
  - navigation
  - unlocked-state
  - accessibility
---

# 让课件分段进度条可点击跳转到已解锁状态

> 完成回执（2026-09-09）：已在本地编辑源与 public/courseware/development-mentor-ligun/ 同步实现；专项 Chromium 验收通过。固定 r0 digest 为 cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d，内容树为 ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234。完整记录见仓库 docs/TODO_093_IMPLEMENTATION.md。

## 原始需求

课件播放器顶部的分段进度条不应只是视觉提示。用户应能点击已经解锁的进度段，直接回到对应页面或揭示状态；尚未解锁的未来状态仍然不可访问。

## 状态语义

```text
已完成／已解锁    薄荷绿色，可点击回看
当前状态          黄色，表示当前所在位置
尚未解锁          深色或灰色，不可点击
```

建议将进度条状态与播放器的真实导航状态绑定，而不是根据CSS宽度推算：

```text
currentState       当前页面及当前揭示步骤
maxUnlockedState   本次播放已经到达的最远状态
stateId            可稳定定位的页面／揭示状态标识
```

返回旧页面后，已经解锁的后续状态不能重新变成锁定；只有刷新策略、重新开始课程或Classroom权限变化可以重置解锁边界。

## 交互规则

- 点击薄荷绿色进度段，直接跳转到该段对应的已解锁状态。
- 点击当前黄色进度段不推进下一步，也不重复触发动画。
- 点击尚未解锁的进度段不发生跳转，并显示“尚未解锁”的可理解提示。
- 点击进度条必须阻止事件冒泡，不能同时触发幻灯片的“下一步”。
- 跳回旧状态后，使用下一步操作可以继续正常播放，不丢失已解锁记录。
- 如果一个进度段对应一张幻灯片，应恢复该幻灯片最后一次已解锁的揭示状态；不得因为回看而意外显示尚未解锁答案。
- 总览、全屏、普通窗口和嵌入Courseware外壳时行为保持一致。
- 进度条跳转只改变当前课件播放器位置，不直接推进、回退或解锁Classroom的课程Block。

## URL与版本参数

跳转后更新可恢复的URL状态，同时保留其他查询参数：

```text
/course/development-mentor-field-kit/?revision=1&slide=6&step=2
```

- 更新 `slide`／`step` 时不得删除 `revision`。
- 从深链接进入时，播放器应恢复对应页面和合法揭示状态。
- 深链接不能绕过Classroom或Courseware的解锁与权限边界。
- 如果链接要求的状态尚未解锁，应回落到当前允许的最远状态并给出提示。

## 视觉与无障碍

- 保留当前薄荷绿、黄色和深色的状态语言。
- 视觉进度段可以保持较细，但实际点击热区应足够大，避免需要精确点击细线。
- 鼠标悬停、键盘聚焦和当前状态需要有可见反馈。
- 每个可点击段使用真实按钮或等价语义，提供页面名称和进度，例如“第6页，立棍的定义，已解锁”。
- 锁定段使用 `aria-disabled` 或等价语义，不能只靠颜色表达锁定。
- 支持Tab聚焦，并可用Enter或Space打开已解锁状态。
- 不应因为增加点击热区而遮挡课件正文、工具栏或浏览器全屏控制。

## 实现范围

第一验收对象是：

```text
/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/cowork/课件/dev/mentor-development-deck/index.html
```

如果分段进度条实际由统一Courseware Player外壳提供，则优先在共享播放器实现，避免P、D、M、O课件分别维护四套导航逻辑。独立打开HTML课件时仍应具备等价的基本回看能力。

完成后由T-092将包含该交互的确定课件revision导入并部署。

## 验收场景

- [x] 顺序播放到第6个状态后，第1～6段均保持已解锁。
- [x] 点击第2个已解锁段，可以直接回到准确页面／揭示状态。
- [x] 回看第2段后，第3～6段仍然保持可点击。
- [x] 点击第7个尚未解锁段不会跳转，也不会泄露内容。
- [x] 点击当前黄色段不会推进下一步。
- [x] 点击进度段不会因为冒泡再执行一次幻灯片点击操作。
- [x] 键盘Tab、Enter和Space可以操作已解锁段。
- [x] 屏幕阅读器可以识别当前、已解锁和未解锁状态。
- [x] URL更新保留`revision`，并正确记录`slide`和`step`。
- [x] 浏览器刷新后可恢复允许范围内的当前状态。
- [x] 在全屏、总览和Courseware嵌入模式下完成回归测试。
- [x] 跳转进度条不会改变Classroom的全局Block状态。
- [x] 浏览器控制台无错误，原有方向键、逐步揭示、总览、打印和深链接功能继续可用。

## 非目标

- 不允许点击未解锁进度段提前查看答案。
- 不把课件内部回看操作等同于DM推进或回退整场课堂。
- 不在本任务中改变D导师PPT内容、视觉主题或页面数量。
- 不在多个课件中复制不同版本的进度状态机。

## 2026-09-10 部署复验

T-093 固定 r0 已随 `20260910T020748CST-t095-t096-course-platform-r3` 再次发布。Chromium 复验覆盖 18 页、鼠标、Tab／Enter／Space、锁定边界、刷新恢复与 `revision/slide/step` 深链，控制台及请求错误均为 0。

