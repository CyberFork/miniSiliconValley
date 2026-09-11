---
type: todo
id: T-093
title: "让课件分段进度条可点击跳转到已解锁状态"
status: completed
created: 2026-09-09
updated: 2026-09-11
captured_by: project-inbox
priority: P1
estimated_effort: small
depends_on:
  - T-089
related:
  - T-092
  - T-086
  - T-088
  - T-097
  - T-101
  - T-110
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

> **2026-09-11 完成：D 导师 PPT 子范围与 Classroom 分段进度条跳转均已交付。Classroom 实现、隔离自动化、生产发布和线上只读真实进度条复验均有证据；人工 View/UI 验收仍由用户本人签署。**

> PPT 子范围历史完成回执（2026-09-09）：已在本地编辑源与 public/courseware/development-mentor-ligun/ 同步实现；专项 Chromium 验收通过。固定 r0 digest 为 cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d，内容树为 ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234。完整记录见仓库 docs/TODO_093_IMPLEMENTATION.md。

## 2026-09-11 补齐遗漏：Classroom 已解锁 Block 导航

### 用户复核与缺口

用户指出：“我记得我之前提过……可以点击底部蓝色条直接跳转对应已解锁进度的需求？”截图为 TEST Classroom 的 P 导师，正在浏览 B04，全局已解锁至 B07。

- 本单此前把验收对象收窄到 D 导师 PPT，并据此整单标记完成，漏掉课堂页面。不是用户未提出，也不能要求用户重复建一张同义 TODO。
- 当前本地 `app/classroom/ClassroomRuntime.tsx` 的 `Progress` 仅渲染 `span`，只有 `data-done` / `data-current`，没有点击处理或导航回调；SeatView 和 ControlView 均使用它。
- 同文件已有 `navigateTo`、`PageNavigator` 和 `scriptNavigation.unlockedBlocks`，后端 `getClassroomInstance` 已检查 `SCRIPT_PAGE_LOCKED`。应复用现有个人浏览机制，不新建一套解锁状态机。
- 这是“未实现点击”的问题，与 T-110 的普通链接点击被拦截不同，不能仅替换 Link 就宣称解决。
- 证据来自用户截图与本地源码；本轮未登录线上复现，未改课堂代码、未部署。

### Classroom 必须交付的行为

- 截图场景下，B01～B07 都能点击直达，包括位于当前 B04 之后但已解锁的 B05～B07；B08 及以后保持锁定。
- 仅改变操作者的浏览 Block。回看 B02 后，全局仍解锁至 B07，不推进或回退 DM 中控，不改变其他账号的浏览位置。
- 点击当前段是幂等操作，不重复提交作业、发牌、结算、解锁或重置；已有未保存输入沿用明确的离页保护，不能静默丢失。
- 使用稳定 Block ID 与既有个人导航回调；保留 classroomId、exact 课程版本及当前合法角色/视图参数。刷新、返回和迟到轮询不能静默跳回错误页面，关联 T-101。
- TEST 与 Production 共用这项能力；导师、学员及有权限的 DM 视图一致。投屏或只读预览若展示相同进度条，须明确其浏览范围并验证，不能把只读浏览变成课堂写入。
- 细色条保持视觉，但提供适合手指的点击热区、Block 名称和当前/已解锁/锁定提示；键盘可操作，不能只靠 hover 或颜色。关联 T-088 学员 Pad 场景。
- 未解锁页不仅前端不可操作，手工修改 URL / 请求同样受服务端边界约束。

### Classroom 独立验收（全部完成才可再次关闭本单）

- [x] 用隔离 TEST 复现“B04 / 已解锁 B07”，鼠标点击 B02、B06、B07 均到达对应 Block。
- [x] 点击当前 B04 不推进；点击 B08 不跳转，提供锁定说明；直接请求 B08 也无法绕过。
- [x] 回看之后 B01～B07 仍可访问，全局解锁边界、其他用户位置及课程 exact 身份均不变。
- [x] 进度条点击不触发控制/提交/重置接口，不重复发牌、记账或验收；未保存内容有保护。
- [x] 学员和导师真实 UI、DM 相应视图，以及使用相同色条的预览/投屏入口逐一记录覆盖情况。
- [x] Tab、Enter/Space 与 Pad 触摸可用，点击热区不遮挡相邻控件；当前/锁定状态可被辅助技术识别。
- [x] 覆盖刷新、浏览器前进后退、角色切换与迟到响应；已有 PageNavigator 和快捷键无回归。
- [x] 提交覆盖真实进度条点击的测试，而非仅测试下拉框导航或 PPT；记录发布构建身份和对应线上复验结果。

以下保留原 PPT 需求、验收与部署历史；其中“不改变 Classroom 全局 Block”与本次“改变个人浏览 Block”并不冲突。

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

## PPT 子范围历史验收场景

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

## 2026-09-10 PPT 子范围部署复验

T-093 固定 r0 已随 `20260910T020748CST-t095-t096-course-platform-r3` 再次发布。Chromium 复验覆盖 18 页、鼠标、Tab／Enter／Space、锁定边界、刷新恢复与 `revision/slide/step` 深链，控制台及请求错误均为 0。


## 2026-09-11 Classroom 本地实施证据

- `ClassroomRuntime` 的真实 13 段进度条已改为 44px 语义按钮，复用既有个人 `navigateTo` 与服务端 `SCRIPT_PAGE_LOCKED` 校验。
- 编译后 Chromium + 临时 D1 已复现 B04 / 解锁至 B07：鼠标、触摸、Enter、Space、浏览器前进后退、导师、学员和投屏均通过；B08 UI 与直接 API 均不可越界。
- 自动化确认全局前沿、另一用户浏览位置、exact 课程引用与未保存草稿不变，进度操作产生 0 个写请求。
- 证据见 `docs/TODO_093_IMPLEMENTATION.md` 与 `docs/qa/t093-classroom-progress/`。本记录没有代签人工 View/UI 验收。

## 2026-09-11 Classroom 生产部署与只读复验

- 最终生产 release：`20260911T192157CST-t093-t111-r2`。
- 源提交：`256ac17d8b4c2fb6757e8b9408eaffcb929ca417`；App Build ID：`08d0a9e1-9a5e-49ae-9389-57eeecc0df59`。
- Hecate `current` 指向上述不可变 release；完整 healthcheck 与 public smoke 均通过，`release.json` 与源提交一致，公开响应标记 `x-minisv-origin: hecate`。
- 使用已有导师账号执行**登录后的只读生产复验**：真实 Classroom 显示 13 段、已解锁至 B07；依次通过真实进度按钮到达 B01～B07（包括从前沿回到 B04），B08 保持锁定；登录后记录到的非 GET/HEAD/OPTIONS 请求为 0，浏览器错误为 0。
- 线上复验没有推进课堂、提交、发牌、重置、删除或签署验收回执；用户仍需按下文路径完成主观 UI 验收。
