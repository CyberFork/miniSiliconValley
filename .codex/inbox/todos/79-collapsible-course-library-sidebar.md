---
type: todo
id: T-079
title: "为课程编辑器增加可折叠课程库侧栏"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - course-editor
  - responsive-design
  - sidebar
  - accessibility
---

# 为课程编辑器增加可折叠课程库侧栏

## 原始记录

`https://minisv.vip/control/editor/` 左侧的“课程库”需要支持折叠和展开。当前课程库长期占用固定宽度，部分设备可供课程结构、卡牌编辑和学员预览使用的横向空间不足。

## 当前结构

课程编辑器当前采用三栏布局：

```text
课程库 230–270px｜编辑工作区｜制作指南 230–280px
```

对应实现：

- `tools/live-run/static/editor.html:25-35`：左侧 `.library.panel`。
- `tools/live-run/static/editor.html:37-119`：中央 `.workspace.panel`。
- `tools/live-run/static/editor.html:121-135`：右侧 `.guide.panel`。
- `tools/live-run/static/editor.css:18-19`：三栏 Grid 和 Sticky Sidebar。
- `tools/live-run/static/editor.css:42-46`：1450／1180／1040／660px 响应式规则。

目前：

- `>=1450px` 同时显示课程库、工作区和制作指南。
- `<1450px` 制作指南移到底部，仍保留左侧课程库。
- `<1040px` 才将课程库和工作区改为单列。
- 没有折叠按钮、折叠状态、键盘语义或偏好记忆。

这会导致 1040–1450px 范围内中央编辑区被左栏持续挤压；在更窄设备上，课程库虽然变成整行，但会把真正的编辑区域推到首屏以下。

## 产品目标

- 用户可以随时折叠／展开左侧课程库。
- 折叠后将主要横向空间让给课程结构、卡牌表单、JSON 和学员预览。
- 当前选中课程、未保存状态、筛选状态和滚动位置不因折叠而丢失。
- 小屏设备优先展示编辑工作区，课程库作为可打开的 Drawer／折叠区使用。
- 不影响课程加载、导入、导出、新建课程和诊断信息。

## 推荐交互

### 桌面与宽屏

- 在“课程库”标题旁增加明确的折叠按钮。
- 展开时显示完整课程列表、提示、诊断、导入和导出操作。
- 折叠时保留约 48–60px 的窄栏和展开按钮；可显示课程数量／当前课程简写，但不能只靠难以理解的图标传递当前课程。
- 按钮文案与 tooltip：
  - 展开状态：`收起课程库`
  - 折叠状态：`展开课程库`
- 编辑器初次进入宽屏时默认展开；用户主动选择后记住偏好。

### 中等宽度与平板

- 达到工作区明显受挤压的断点时，默认折叠课程库。
- 用户仍可主动展开；展开可以采用覆盖式侧栏，避免再次压缩编辑表单。
- 点击课程后可在窄屏自动关闭侧栏并回到工作区，同时保留当前课程选择。

### 手机

- 不保留占据整行的大型课程库 Panel。
- 使用“课程库（当前课程名）”按钮打开 Drawer／Sheet。
- Drawer 支持点击关闭、Escape 关闭、返回焦点和背景滚动锁定。
- 新建、导入、导出和诊断信息仍可到达，不能因为折叠而消失。

## 状态和可访问性

- 折叠按钮使用真实 `<button type="button">`。
- 使用 `aria-expanded="true|false"`。
- 使用 `aria-controls` 指向课程库可折叠内容容器。
- 按钮的可访问名称随状态变化。
- 被折叠内容必须真正从 Tab 顺序移除；不能仅设置透明度或移到屏幕外。
- Drawer 打开时管理焦点，关闭后焦点回到触发按钮。
- 不使用 hover 作为唯一展开方式。
- 折叠状态不应被课程 API 保存到课程 JSON；它只是本浏览器的 UI 偏好。

可使用独立 localStorage key，例如：

```text
minisv.course-editor.library-collapsed
```

读取失败时正常回退，不得影响课程编辑器启动。

## 实现范围

### HTML

- 修改 `tools/live-run/static/editor.html`。
- 在 `.panel-head` 中增加折叠／展开按钮。
- 为课程列表、提示、诊断和底部操作增加统一的可折叠内容容器。
- 为移动端 Drawer 增加必要 backdrop／close 结构，但避免复制第二份课程列表 DOM。

### CSS

- 修改 `tools/live-run/static/editor.css`。
- 为 `.studio` 增加展开／折叠两种 Grid 模式。
- 折叠状态必须释放真实 Grid 宽度，而不是只隐藏内容但继续保留 230–270px 列。
- 保持 `.workspace` 的 `minmax(0,1fr)` 和容器查询正确工作。
- 为 Drawer、遮罩、safe area、触控尺寸和 reduced motion 补充规则。
- 与 T-076 的主题修复共同验证 Classic／Adventure，避免折叠按钮出现低对比或被主题切换器覆盖。

### JavaScript

- 修改 `tools/live-run/static/editor.js`。
- 初始化响应式默认值和用户偏好。
- 更新 `aria-expanded`、按钮文案、CSS 状态属性和 localStorage。
- 监听必要的 media query 变化，但不能在窗口变化时覆盖用户本次会话中的明确选择。
- 选择课程、加载失败或出现 diagnostics 时保证课程库仍可重新打开。

### 测试与文档

- 扩展 `deploy/minisv/tests/test_ui_theme.py` 的编辑器结构契约。
- 扩展 `tools/live-run/tests/verify_editor_layout_browser.py`。
- 扩展 T-074 编辑器浏览器验收，确认折叠不破坏卡牌搜索、预览和 Alpha 同步。
- 更新课程编辑器操作说明和生产验收回执。

## 关键边界

- 折叠只是 UI 布局状态，不得触发课程重新加载或保存。
- 不得改变当前 `courseId / revision / digest`。
- 不得清空未保存表单、卡牌搜索条件或当前卡牌选择。
- 导入文件 Input 即使隐藏在折叠内容中也要保持原有事件绑定。
- 诊断错误不能永久藏在折叠栏里；工作区顶部应保留可见的错误摘要或“课程库有错误”提示。
- 折叠后不能遮挡保存草稿、发布到主控、全部刷新 Alpha 等关键操作。
- 不通过复制两份 `#courseList` 实现桌面和移动布局，避免 ID、状态和事件漂移。

## 浏览器验收矩阵

至少验证：

- 1440px：展开／折叠后 Grid 宽度真实变化。
- 1180px：折叠后工作区获得更多空间，制作指南保持正确位置。
- 1040px：断点前后无布局跳坏。
- 768px：课程库可作为覆盖层／折叠区打开和关闭。
- 390px、430px：手机 Drawer 不溢出，工作区优先显示。
- Classic 与 Adventure 两种主题。
- 课程结构、抽卡内容、JSON 源码三种编辑模式。

## 自动化断言

- 折叠按钮具有正确 `aria-expanded` 和 `aria-controls`。
- 折叠后课程库内容不可聚焦，展开后恢复。
- 折叠前后中央工作区宽度确实增加。
- 当前课程 ID、revision、digest、dirty 状态保持不变。
- 刷新页面后恢复用户偏好。
- localStorage 不可用时仍可折叠且编辑器正常工作。
- 移动 Drawer 打开后 Escape 可关闭，焦点返回触发按钮。
- 所有视口 `scrollWidth <= innerWidth`。
- 保存、发布、导入、导出、新建、切换课程和诊断流程全部通过回归。

## 验收标准

- 左侧“课程库”有清晰可用的折叠／展开控制。
- 折叠后不再保留原 230–270px 空白列。
- 1040–1450px 设备的编辑工作区获得明显更多有效宽度。
- 手机和平板不再因为课程库占据整行而把编辑区长期推到首屏以下。
- 用户偏好可恢复，但响应式默认不会造成不可逆隐藏。
- 折叠不会丢失任何课程编辑状态或影响 Alpha／发布数据。
- 键盘、触控、屏幕阅读器、Classic／Adventure 和主要视口均完成验收。

## 关联 Todo

- [[72-course-editor-alpha-live-sync-controls|T-072]]
- [[74-alpha-runtime-course-editor-card-completion|T-074]]
- [[75-unified-course-source-editor-alpha-classroom|T-075]]
- [[76-alpha-ui-readability-and-responsive-adaptation|T-076]]

## 关键控制点

课程库可折叠；折叠真实释放宽度；移动端 Drawer；状态不进入课程 JSON；选中课程和未保存内容不丢失；诊断仍可见；ARIA 与焦点管理；localStorage 安全回退；Classic／Adventure 双主题；全视口无溢出；不复制课程列表 DOM。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- 相关证据：<https://minisv.vip/control/editor/>。
