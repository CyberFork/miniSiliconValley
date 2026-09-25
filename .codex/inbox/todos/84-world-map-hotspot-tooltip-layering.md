---
type: todo
id: T-084
title: "修复 World 地图节点 Hover 提示的层级遮挡"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - world-map
  - ui
  - css
  - accessibility
---

# 修复 World 地图节点 Hover 提示的层级遮挡

## 原始问题

`https://minisv.vip/world/` 中，鼠标 Hover 或键盘聚焦某个地图节点后，展开的标题提示卡会被附近节点图标压在上面。截图中“NCSA Mosaic 发布”提示卡被右下方 `NET` 节点覆盖，导致内容和边框被截断。

## 初步根因

相关实现：

- `app/components/WorldApp.tsx:446-466`：所有节点作为 `.map-hotspot` 兄弟元素按 `mapEvents` 顺序渲染。
- `app/globals.css:661-669`：`.map-hotspot` 使用 `transform`，每个节点形成自己的 stacking context，但父节点没有在 hover/focus 时提升 `z-index`。
- `app/globals.css:717-753`：`.hotspot-label` 虽然设置 `z-index: 20`，该层级只在当前 `.map-hotspot` 的 stacking context 内有效，无法越过后续兄弟节点。

因此，这不是单纯继续增大 `.hotspot-label` 自身 `z-index` 就能稳定解决的问题，需要提升被交互的**整个节点父容器**。

## 实现方向

- 为 `.map-hotspot:hover`、`.map-hotspot:focus-visible` 以及后续可能的点击展开状态统一提升父节点 `z-index`。
- 保持节点默认层级一致，只让当前 hover／focus／active 节点临时置顶，避免依赖数据顺序或 DOM 顺序。
- Hover 和键盘 `focus-visible` 必须具有同样的渲染层级，不得只修鼠标状态。
- 如果移动端后续采用点击展开 tooltip，需要明确的 active 状态，不能仅依赖 `:hover`。
- 不通过将整个 `.hotspot-layer` 无限提高来规避问题；地图图例、控件、导航和 Modal 的全局层级仍应保持清晰。

## 验收标准

- [x] Hover 任意地图节点时，它的完整提示卡始终显示在其他普通、任务和门户节点之上。
- [x] 键盘 Tab 聚焦节点时与 Hover 行为一致，提示内容不被其他节点覆盖。
- [x] “NCSA Mosaic 发布”与附近 `NET` 节点的截图场景通过回归验收。
- [x] 在地图拖动、归位以及多个缩放比例下都不依赖 DOM 顺序。
- [x] 视口外的地图内容仍由 `.map-viewport` 正常裁切，修复不导致页面横向滚动或 tooltip 穿透到 Modal 之上。
- [x] 增加最小化的浏览器回归测试，通过 `elementFromPoint` 或截图校验确认 tooltip 位于重叠节点之上。

## 优先级

- **P1：**地图节点的标题是用户识别历史事件的主要交互反馈，被相邻热点遮挡会直接影响可读性与可点击性。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- 相关证据：<https://minisv.vip/world/>。
