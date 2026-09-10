---
type: todo
id: T-080
title: "为课程卡片编辑增加持续可见的保存入口"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - course-editor
  - card-editor
  - save-flow
  - usability
  - data-safety
---

# 为课程卡片编辑增加持续可见的保存入口

## 原始记录

在 `https://minisv.vip/control/editor/` 修改卡片后，卡片编辑区域没有可见的保存按钮，用户找不到在哪里保存，容易误以为修改会自动保存或根本无法保存。

## 调研结论

### 2026-09-06 产品决策：保存直接生成 Alpha 候选版本

- 不再让用户管理“草稿”和“已发布到 Alpha”两套状态。
- 点击“保存”即保存整门课程，并生成新的不可变 Candidate revision，作为 Alpha 最新可测试版本。
- 保存后当前 Alpha Run 只提示“有更新待加载”；仍需明确点击“全部刷新 Alpha”才更新正在测试的八席。
- “保存”绝不直接发布到正式 Classroom；正式发布必须在 Alpha 对同一 digest 验收通过后单独执行。

### 保存能力实际存在，但离卡片编辑位置太远

当前编辑器顶部工作区 Toolbar 已有：

- `检查结构`
- `版本历史`
- `保存草稿`
- `发布到主控`

这两个旧按钮在新决策下应合并简化为一个清楚的“保存”动作；保存结果直接成为 Alpha Candidate，但不自动刷新活动 Run。

对应：

- `tools/live-run/static/editor.html:40-47`
- `tools/live-run/static/editor.js:539-548,620`

但是该 Toolbar 位于整个 Workspace 顶部，并且不是 sticky。进入“抽卡内容”后，用户会在很长的卡牌列表、卡牌表单、来源选择、学员预览和 Alpha 手牌之间滚动；此时顶部“保存草稿”已经离开视口。

卡片自身的工具栏目前只有：

- 上移
- 下移
- 复制
- 删除

对应 `tools/live-run/static/editor.js:238-281`。这里确实没有保存操作，所以用户的判断在交互层面成立。

### 当前卡片修改只写入浏览器内存

卡片字段输入后，当前实现会：

1. 修改浏览器内存中的 `course` 对象。
2. 调用 `markDirty()`。
3. 实时刷新学员卡片预览。
4. 顶部状态变为“有未保存修改”。

对应 `tools/live-run/static/editor.js:426-442`。

只有点击全局保存按钮后，才会调用 `api/courses/save` 写入版本仓库。当前不是自动保存。

页面关闭时已有 `beforeunload` 未保存提示，但它只能避免部分误关闭，不能解决“保存入口看不见”的核心问题。

### 保存是整门课程的原子保存，不是单张卡独立保存

当前 API 保存完整 Course Package，并使用 `expectedRevision` 防止版本覆盖：

```text
POST api/courses/save
course + status + expectedRevision
```

因此新增的卡片附近按钮可以写“保存修改”，但其真实语义必须明确：**保存整门课程并生成新的 Alpha Candidate**。不得制造一个只保存当前卡、却让其他步骤修改仍未保存的第二套状态模型。

## 产品目标

- 用户编辑卡片时，视口内始终存在明确的“保存”操作。
- 保存状态明确区分：未修改、有未保存修改、正在保存、保存成功、保存失败、版本冲突。
- 保存动作继续原子保存完整课程包。
- 保存后保持当前步骤、当前卡片、筛选条件、预览状态和滚动上下文。
- 保存会生成 Alpha Candidate，但不会自动刷新正在运行的 Alpha，也不会改变正式课堂。

## 推荐交互方案

### 1. Workspace 持续可见保存栏

在编辑工作区增加 sticky Action Bar，至少包含：

- `保存`
- 当前状态：`有未保存修改／正在保存／Candidate rN 已保存／保存失败`
- 必要时显示 `检查结构`
- 不再提供独立的“发布到 Alpha／主控”；保存本身即生成 Alpha Candidate

该保存栏在“课程结构／抽卡内容／JSON 源码”三个模式中都应可见。

### 2. 卡片表单提供上下文保存入口

在卡片标题工具栏或卡片表单底部增加：

```text
保存本次修改（整门课程）
```

- 与顶部／sticky 保存栏调用同一个统一保存动作。
- 不创建第二个卡片保存 API。
- 保存按钮附近显示“Alpha 尚未刷新”的状态说明。
- 当没有修改时可禁用，并显示“已保存”。

### 3. 键盘快捷键

- 支持 `Cmd+S`／`Ctrl+S` 保存课程并生成 Candidate。
- 阻止浏览器默认“保存网页”行为。
- 输入框、Textarea 和 JSON 编辑区聚焦时同样有效。
- 保存进行中不得重复发送请求。

### 4. 明确保存与生效的区别

保存成功后提示：

```text
Candidate rN 已保存
Alpha 有更新待加载；需要明确点击“全部刷新 Alpha”
正式课堂不受影响
```

避免用户把以下动作混淆：

1. 修改浏览器内存。
2. 保存并生成 Candidate。
3. 刷新 Alpha。
4. Alpha 验收 exact digest。
5. 发布正式课堂。

最终发布链路继续遵守 T-075。

## 状态设计

建议统一为明确状态机：

```text
clean → dirty → saving → saved
                    ↘ error
                    ↘ conflict
```

- `clean`：载入版本后没有修改。
- `dirty`：至少一个课程字段发生变化。
- `saving`：保存请求进行中，所有保存入口同步禁用。
- `saved`：服务端返回新 revision／digest。
- `error`：网络或校验失败，浏览器内修改必须继续保留。
- `conflict`：`expectedRevision` 不一致，不允许静默覆盖他人版本。

所有重复出现的保存按钮必须绑定同一个状态和同一 Promise，避免一个显示已保存、另一个仍显示未保存。

## 实现范围

### HTML

- 修改 `tools/live-run/static/editor.html`。
- 增加共享 sticky Save Bar 容器。
- 在卡片编辑工具栏／表单底部增加上下文保存按钮。
- 为保存状态增加 `role="status"`／`aria-live="polite"`。

### CSS

- 修改 `tools/live-run/static/editor.css`。
- 保存栏在桌面、平板和手机均保持可见，但不能遮挡表单、Toast、浏览器 safe area 或 Alpha 操作。
- 手机下按钮可以固定于底部安全区或成为紧凑 sticky bar。
- 与 T-079 可折叠课程库同时验收，侧栏展开／折叠不能导致保存栏溢出。
- 与 T-076 同时验证 Classic／Adventure 对比度和状态颜色。

### JavaScript

- 修改 `tools/live-run/static/editor.js`。
- 所有保存入口复用统一的 Candidate 保存函数；后端可兼容旧参数，但 UI 不再暴露草稿管理。
- 增加统一保存锁，防止重复请求。
- 保存完成后更新全部保存按钮、revision、digest 和 dirty 状态。
- 保存失败时保留内存课程、当前卡片和编辑上下文。
- 增加 Cmd／Ctrl+S。
- 保留 `beforeunload` 防丢失保护。

## 关键边界

- 不实现“修改一个字段就自动保存”，除非后续另行确认自动保存产品策略。
- 不增加单卡局部版本；Course Package 继续整体版本化。
- 卡片校验失败时不得清空用户输入。
- F 卡缺少来源、卡组少于门槛或 Schema 错误时不得生成可测试 Candidate；页面必须保留浏览器内修改并明确列出修复项。
- 保存 Candidate 后不得自动触发 Alpha Refresh。
- 保存过程中切换课程、恢复历史或关闭页面时必须有明确保护。
- 同一账号多窗口编辑产生 revision 冲突时不得最后写入者静默覆盖。

## 浏览器验收场景

1. 打开“抽卡内容”，滚动到页面中下部。
2. 修改卡牌标题、正文、分享提示和来源。
3. 不滚回页面顶部即可看到并点击保存。
4. 页面显示“正在保存”。
5. 成功后显示新 revision／digest。
6. 刷新浏览器，修改仍然存在。
7. 当前卡牌、步骤和筛选上下文合理保留。
8. Alpha 继续显示旧 revision，直到用户明确刷新。
9. 模拟 API 失败，用户输入不丢失且可重试。
10. 模拟 revision 冲突，阻止覆盖并提示重新载入／另存处理。

## 自动化断言

- 卡片编辑视图中存在可见保存按钮。
- 页面滚动到卡片表单底部时，至少一个保存入口仍在视口内。
- 点击上下文保存与顶部保存调用同一保存函数／API。
- Cmd／Ctrl+S 只触发一次保存请求。
- 保存请求期间不能重复提交。
- 成功保存后 `dirty=false`，revision 增加且 digest 更新。
- 保存失败后 `dirty=true` 且输入值保留。
- 刷新后服务端返回已修改卡牌。
- 保存不会改变当前 Alpha `runId / currentBlock / courseDigest`。
- 390、430、768、1180、1440px 下保存栏无溢出、遮挡或不可点击问题。
- Classic／Adventure 下状态文字和按钮满足对比度要求。

## 验收标准

- 用户在卡片编辑区域不需要寻找页面顶部即可保存。
- 页面明确说明保存的是整门课程 Candidate，而不是只保存当前卡。
- 保存、发布、Alpha 刷新和正式发布的语义不再混淆。
- 保存后 revision／digest 和成功状态可见。
- 网络失败、校验失败和版本冲突不会丢失编辑内容。
- 键盘、移动端、可折叠课程库和双主题均完成验收。
- 自动化测试能够证明“修改卡片→保存→重新加载仍存在”，且 Alpha 不会被静默刷新。

## 关联 Todo

- [[72-course-editor-alpha-live-sync-controls|T-072]]
- [[74-alpha-runtime-course-editor-card-completion|T-074]]
- [[75-unified-course-source-editor-alpha-classroom|T-075]]
- [[76-alpha-ui-readability-and-responsive-adaptation|T-076]]
- [[79-collapsible-course-library-sidebar|T-079]]

## 关键控制点

卡片区域始终可保存；保存整门课程并直接生成 Candidate；不管理草稿；单一保存状态机；不自动刷新活动 Alpha；不影响正式课堂；Cmd／Ctrl+S；保存失败不丢内容；revision 冲突不覆盖；保存后保留编辑上下文；移动端和双主题持续可见。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- 相关证据：<https://minisv.vip/control/editor/>。
