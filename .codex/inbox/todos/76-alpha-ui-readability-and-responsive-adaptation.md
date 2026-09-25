---
type: todo
id: T-076
title: "修复 Alpha 冒险主题可读性并统一八席响应式 UI"
status: completed
created: 2026-09-06
updated: 2026-09-07
captured_by: project-inbox
tags:
  - todo
  - mini-silicon-valley
  - alpha-testing
  - ui
  - accessibility
  - responsive-design
  - design-system
  - visual-regression
---

# 修复 Alpha 冒险主题可读性并统一八席响应式 UI

## 原始记录

当前 Alpha 席位 UI 还没有完全适配。开发导师席位切换到“冒险”主题后，大量任务、验收、观察重点和团队信息文字与深色背景接近，实际已经无法阅读；右上角“UI／当前／冒险”切换器也会挤压或覆盖页面内容。

后续完善时需要参考：

- 同事准备提交到 `chj` 分支的 UI 实现。
- 项目设计 Skill：`../cowork/mini-silicon-valley-design/SKILL.md`。
- 用户提供的 Alpha 席位问题截图及此前确认的 MINI硅谷 UI 方向。

本任务先记录调研结论和实现／验收范围，不在调研阶段直接修改生产 UI。

## 调研结论

### 1. P0 根因：Adventure 全局 token 覆盖了深色席位的正文颜色

Alpha 席位自身在 `tools/live-run/static/seat.css` 中定义了适合深色界面的颜色：

- `--bg: #061720`
- `--panel: #11272e`
- `--ink: #fff5db`

但页面随后加载的 `deploy/minisv/site/ui-theme.css` 在 Adventure 模式下于 `html` 根节点重新定义：

- `--ink: #172b36`
- `--ink-2: #24414b`
- `--coral: var(--msv-adventure-mint)`

由于共享主题 CSS 后加载且自定义属性从根节点继承，席位正文最终使用了深色 `--ink`，落在同样深色的 Panel／Result／List 背景上。

实测对比度：

- Adventure `#172b36` 对 Panel `#11272e`：约 `1.06:1`。
- Adventure `#172b36` 对 Result `#0b2026`：约 `1.15:1`。
- Seat 原本 `#fff5db` 对 Panel `#11272e`：约 `14.29:1`。

前两项远低于 WCAG AA 普通文字 `4.5:1` 的最低标准，足以解释截图中“只记录工具和流程限制”等文字近乎消失的问题。这不是截图色差，而是确定的 CSS token 作用域冲突。

关键位置：

- `deploy/minisv/site/ui-theme.css:88-103`
- `deploy/minisv/site/ui-theme.css:235-248`
- `tools/live-run/static/seat.css:1-10`
- `tools/live-run/static/seat.html:5-16`

### 2. P1：主题切换器缺少席位页专用布局位置

`deploy/minisv/site/ui-theme.js` 会优先寻找 `data-msv-theme-slot`；找不到时把切换器作为 fixed floating 控件挂到 body。

Seat 页面没有声明主题插槽，因此使用浮动模式：

- 切换器使用极高 z-index。
- 固定在右上角。
- 宽度由“UI／当前／冒险”三列内容决定。
- 移动端只做 `scale(.9)`，没有为正文预留布局空间。

截图中切换器已经挤出右侧边界，并覆盖／干扰开发导师的顶部身份区域。现有测试甚至明确断言缺失 slot 时使用 floating，但没有验证控件是否遮挡实际页面。

关键位置：

- `deploy/minisv/site/ui-theme.js:75-101`
- `deploy/minisv/site/ui-theme.css:18-39,250-265`
- `tools/live-run/static/seat.html:8`
- `tools/live-run/static/seat.css:2-3,9`
- `deploy/minisv/tests/test_ui_theme.py:67-73`

### 3. P1：共享主题覆盖了业务语义颜色

Adventure 主题把通用 `--coral` 映射成 mint。Editor 和主控中大量错误、危险、待处理、hover 与边框状态继续依赖 `var(--coral)`，可能导致：

- 错误／危险信息显示为绿色。
- 成功、同步和警告状态颜色无法区分。
- 同一种 mint 同时承担成功、主操作、错误和装饰用途。

关键位置：

- `deploy/minisv/site/ui-theme.css:97-103`
- `tools/live-run/static/editor.css`
- `tools/live-run/static/styles.css:1-4`

主题系统必须区分视觉品牌 token 和业务状态 token，不能用换肤逻辑改变 danger／error／warning／success 的含义。

### 4. P1：席位页面的中文信息字号过小

当前 Seat 页面多处使用：

- eyebrow：10px
- Card 标题：11px
- Result／列表正文：12px
- Metric 标签／Chip：10px
- 私密卡小标签：8–9px
- Footer：9px
- 移动端主要任务文字还从 18px 降到 16px

这不符合 MINI硅谷 Design Skill 的要求：中文主要信息需要适合课堂投影，英文 mono 标签只能装饰，不能承担主要信息。即使修复颜色，远距离投影和普通手机浏览仍会吃力。

关键位置：`tools/live-run/static/seat.css:3-10`。

### 5. P2：Remote Console 的中等宽度布局过密

远程控制台在 `<=760px` 时仍保持两列席位卡，只在 `<=430px` 时变成单列。430–600px 范围内容易出现：

- 角色标题、昵称、状态挤压。
- 领取／释放按钮换行或触控区域过小。
- 主题切换器、连接状态和“打开主控”按钮互相抢占顶部空间。

关键位置：

- `tools/live-run/remote-console/static/console.css`
- `tools/live-run/remote-console/static/index.html:19-29`

### 6. 当前测试没有捕获真实可读性故障

现有主题测试主要验证：

- 所有页面加载主题资源。
- 主题切换器存在。
- Editor 容器没有明显横向 overflow。
- Adventure Hero 不改变部分几何属性。

但没有验证：

- 最终 computed color 与背景的实际对比度。
- Seat／Console 的核心文字是否可见。
- 切换器 bounding box 是否完整落在视口内。
- 切换器是否与标题／主操作发生遮挡。
- 390、430、600、768px 下是否存在横向滚动和按钮裁切。
- Classic 与 Adventure 的错误／成功状态是否仍保留正确语义。

相关测试：

- `deploy/minisv/tests/test_ui_theme.py`
- `deploy/minisv/tests/test_ui_theme_runtime.mjs`
- `tools/live-run/tests/verify_editor_layout_browser.py`
- `tools/live-run/tests/verify_t074_production_readonly.py`

## chj 分支调研状态

截至 2026-09-06 本次调研时，远端 `CyberFork/minisv` 的 `chj` 分支仍是我们创建的空孤儿分支：

- Commit：`fd7e1b7b8bd7fd9dca4837a0672c9d60f7160baa`
- 文件数：0
- 当前没有同事 UI 代码可供差异审计。

因此，不能在本 Todo 中假定 chj 的具体颜色、组件或布局已经可复用。待 CHJ222 成功推送后，必须补做一次只读 UI Diff，再决定哪些设计纳入主线；不得因为“参考 chj”而整分支覆盖 Alpha 的课程逻辑、席位安全边界或已有交互。

## 设计基准

按照 `mini-silicon-valley-design` Skill，Alpha 应保持“可玩的创业任务控制台”，而不是通用企业后台：

- 主色使用 MINI硅谷品牌蓝。
- mint／fresh green 用于同步、通过和可行动提示。
- 黄色用于线索、当前步骤、等待验收和解锁。
- 红色只用于危险、错误、禁止和不可逆操作。
- 深色 navy Panel 可以用于席位、终端、计时器和扫描界面，但所有主要中文必须高对比。
- 英文 mono 小标签只作辅助装饰，主要动作和结果必须用清晰中文表达。
- 保留像素边框、任务卡、进度条、状态章和触感按钮，但不能以“像素感”为由牺牲字号和可读性。
- 内容保持真实 HTML，不能把席位文字烘焙为图片。

## 目标范围

本任务覆盖 Alpha 全部实际工作面，而不是只修截图中的一页：

1. `/alpha/` 八席入口控制台。
2. `/alpha/seat.html` 四导师与四学员席位。
3. `/control/` LIVE RUN 主控。
4. `/control/editor/` 课程编辑器。
5. Seat loading／连接中／断线／空状态／错误状态。
6. Classic 与 Adventure 两种主题。
7. 桌面、课堂投影、平板和手机宽度。

## 建议实现方案

### A. 消除 token 污染

- 不再用全局 Adventure 规则覆盖无命名空间的 `--ink`、`--coral` 等通用变量。
- 为主题建立命名空间 token，例如：
  - `--msv-text-primary-dark`
  - `--msv-text-secondary-dark`
  - `--msv-surface-dark`
  - `--msv-status-success`
  - `--msv-status-warning`
  - `--msv-status-danger`
- 或为 Seat 建立 `--seat-*` 组件 token，避免被官网／Editor 的 light-surface token 覆盖。
- `data-msv-surface="dark"` 必须显式提供高对比正文、次要文字、禁用文字、链接、按钮和焦点颜色。
- danger／error／warning／success 的业务语义 token 不允许被主题换肤重映射。

### B. 重做主题切换器布局

- Seat 页面增加明确的 `data-msv-theme-slot` 或独立工具栏，不再依赖 floating fallback。
- 切换器必须参与正常布局，不覆盖标题、角色编号、进度和主操作。
- 手机下允许缩短为图标＋当前主题、下拉或分段按钮，但必须保留可访问名称。
- 主题切换是内部 A/B 工具；确认最终 UI 后评估是否仍需在正式 Alpha 席位中长期展示。

### C. 提升信息层级和字号

- 第一屏优先展示：当前身份、当前步骤、现在做什么、需要观察什么、等待／验收状态。
- 中文核心正文移动端原则上不低于 16px；任务标题与关键动作更大。
- 8–11px 只能用于不承载主要含义的辅助英文／版本信息。
- 使用合理行高、段落宽度和留白，减少大片暗色内容堆叠。
- 投影模式下进一步提高字号和关键状态对比度。

### D. 完善响应式布局

- 以内容需要而不是只用 430px 单一断点决定一列／两列。
- Console 席位卡使用明确 `minmax()` 和最小可读宽度；中等手机优先单列。
- 顶部身份、连接、主题、主控入口可换行但不能重叠。
- 使用 `100dvh`、safe-area inset 和触控最小尺寸处理手机浏览器。
- 所有视口保持 `document.documentElement.scrollWidth <= innerWidth`。

### E. 参考 chj 但保护业务边界

CHJ222 推送后进行以下对比：

- 颜色 token、字体层级、卡片密度、按钮层级和移动端断点。
- 是否符合 MINI硅谷 Design Skill 的品牌与课堂可读性要求。
- 是否覆盖 Alpha 的八席投影、课程 revision／digest、私密卡边界和 lease 安全逻辑。
- 只移植已验证的视觉／组件改进，不整页替换控制器或席位数据逻辑。

## 自动化与浏览器验收

### 视口矩阵

至少验证：

- `390×844`：常见手机。
- `430×932`：宽手机。
- `600×960`：中等移动／小平板。
- `768×1024`：平板。
- `1440×900`：桌面／投影控制台。

### 主题与角色矩阵

- Classic 与 Adventure。
- 产品、开发、市场、运营四导师。
- 四个 Young Builder 学员席位至少抽查两个不同手牌状态。
- loading、waiting、awaiting acceptance、error、completed。

### 强制断言

- 普通正文对比度至少 `4.5:1`；大号文字至少 `3:1`。
- 核心任务、验收和错误信息不得使用 disabled opacity 造成低对比。
- 主题切换器 bounding box 完全处于视口内。
- 切换器与标题、席位编号、连接状态、主控按钮没有交叠。
- 页面无横向 overflow。
- 所有主要按钮触控区域至少约 `44×44px`。
- 键盘焦点清晰；主题分段按钮的 `aria-pressed` 和方向键行为保持正确。
- 错误仍为红色语义，成功／同步仍为 mint，等待／线索仍为黄色。
- 主要中文在 100% 缩放和课堂投影截图中可在三秒内识别。

### 视觉回归

- 为 Seat 与 Remote Console 增加 Classic／Adventure 的基准截图。
- 浏览器测试读取 computed style，而不是只搜索 CSS 字符串。
- 对正文 foreground/background 计算真实 contrast ratio。
- 对 switcher、header、主按钮执行 bounding-box 交叠检测。
- 发布前必须人工查看桌面与移动截图，不能只以测试通过代替视觉确认。

## 验收标准

- 用户截图中的所有深色正文恢复清晰可见，Adventure 下不再出现深字落在深色卡上的情况。
- 四导师和四学员席位在 Classic／Adventure 中均满足对比度标准。
- 390–768px 下主题切换器完整可见且不覆盖任何核心内容。
- Console、Seat、Controller、Editor 的状态颜色语义一致。
- 核心中文字号适合手机阅读和课堂投影；辅助英文不会承担主要信息。
- 页面没有横向滚动、裁切、卡片溢出或按钮不可点击。
- chj UI 推送后完成差异审计，并记录保留／拒绝的具体设计决策。
- 自动化测试能稳定复现当前对比度故障，并在修复后防止回归。
- 生产发布后以真实 `/alpha/`、四导师席位、至少两个学员席位和 `/control/`、`/control/editor/` 完成桌面／移动验收。

## 关联 Todo

- [[70-remote-internal-eight-window-test-console|T-070]]
- [[72-course-editor-alpha-live-sync-controls|T-072]]
- [[74-alpha-runtime-course-editor-card-completion|T-074]]
- [[75-unified-course-source-editor-alpha-classroom|T-075]]

## 关键控制点

先修可读性再谈视觉风格；深色／浅色 token 隔离；业务状态颜色不被换肤；主要中文高对比大字号；主题切换器不遮挡；八席与主控／编辑器一起验收；手机／平板／桌面全覆盖；computed-style 对比度测试；chj 代码到位后再做可验证参考；不以 UI 重构破坏课程、席位或安全逻辑。

## 生产完成回执

- 最终 Hecate release：`20260907T180022Z-truth-chain-final2`。
- 部署源码 SHA：`40c652b562a7634135ff645a9c3cddf32a9da784`。
- Alpha run：`run-20260907-014609-04bf7f`。
- 相关证据：<https://minisv.vip/alpha/>。
