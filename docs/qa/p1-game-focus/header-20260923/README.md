# 教师页最新版控件布局回归修复

- 问题：新增 body 子元素改变全屏教师页的 Grid 自动排布；依赖具体轨道尺寸的补丁对已打开旧脚本/历史页不稳健。
- 修复：控件直接插入 `.session-panel`；工坊插入 `header.top`，不再增加 body 流式子项，不读写 body Grid 轨道。不识别宿主时 fixed 脱离文档流。
- 最新状态改为按钮 title，保留“最新版固定入口/打开最新版”按钮，不新增整条横幅。
- Node VM 回归断言 body 既有 children、gridTemplateRows 不变；teacher/workshop 各归现有宿主；fallback fixed。
- CUA Chrome 实际完整教师页截图确认：顶部恢复紧凑工具栏，最新版按钮和投屏按钮同排，目录/当前页/教师提示均在首屏。
- QA 静态站文字 API 404 属于隔离验证服务边界，本次不修改文字编辑/保存逻辑、数据库、课件包版本与历史内容。
