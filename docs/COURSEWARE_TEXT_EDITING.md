# 教师课件点击编辑（2026-09-21）

## 使用

从 `/course/` 开发导师分组进入 P1 或 P2 教师视图。启用「编辑课件文字」，点击当前预览中的标题、副标题或带编辑框的静态正文，即可弹窗修改。

- 「预览修改」只影响教师本地预览；「保存为新版」成功后才同步当前场次投屏。
- 保存进入服务器，不是浏览器临时草稿。未来新场次默认读取最新文字版。
- 已开启的其他场次保持原版本；需要采用新版时点击「加载最新文字版」。
- 历史下拉可查看旧文字版；返回最新后才能继续编辑。「恢复原文」同样需要保存才生效。
- 保存失败保留输入。多人同时编辑时，后提交者收到冲突提示；保留输入、退出弹窗、加载最新后核对再改，不会静默覆盖。
- 学员不能编辑；教师备注、按钮行为、Three.js 场景及页面布局不属于本次文字编辑范围。

## 两种版本

静态课件包 P1 r9 / P2 r4 包含布局、互动、原文与编辑器。旧 P1 r8 / P2 r3 继续原样可用，不重写历史文件。

包内部的文字版 v0 是原文；v1、v2… 是每次成功保存后的不可变完整补丁快照。现有服务器数据库及其备份持久保存这些版本。刷新、换浏览器不丢失；会话本地只记录当前采用的版本号，不作为内容真值。

## 工程边界

- `courseware/shared/text-editions.js`：两课共用字段定位、弹窗接入、版本选择及场次通知；使用 textContent 写入，用户输入不执行 HTML。
- `courseware/shared/text-editor-dialog.js`：键盘可用的原生 dialog；显式前景／背景配色，避免白底白字。
- `app/api/courseware/text-editions/[deckId]/route.ts`：同源、已登录 API；写入仅真实导师／管理员。模拟身份禁止。
- `drizzle/0022_courseware_text_editions.sql`：新增表，不修改课堂、课程版本、发布证据等数据。单条带 expectedRevision 条件的 INSERT 作为发布点，避免多人保存丢失更新。
- `app/lib/courseware-text-catalog.json` 锁定包内 model.id/version/slideIds；构建时核对。未来改变 DOM 或课件版本时必须新增基线条目并明确迁移文字补丁，不能悄悄将旧字段路径套用到新布局。历史条目不得删除。
- BroadcastChannel（或 storage 事件降级）只发送同场次版本号，投屏自行读取服务器快照。沿用现有同浏览器双窗口投屏范围，不引入跨设备投屏服务。

## 自动验证

- `tests/courseware-text-editions.test.ts`：真实 SQLite、不可变历史、竞争保存、权限、输入安全、恢复原文。
- `tools/live-run/tests/verify_courseware_text_edits_browser.py`：隔离本地数据库及真实 API，实际点击／弹窗／保存／刷新／换上下文／投屏同步／其他场次隔离／冲突／历史／恢复／P2／手机宽度。
- `courseware/shared/tests/verify-text-editor-dialog.py`：弹窗键盘、保存中保护、失败保留输入、恶意 HTML 显示为纯文字。
- `courseware/shared/tests/verify-browser.py`：双课 54 页的双视图、对比度、溢出、交互及同步回归。

线上只读取、打开／取消编辑，不往真实教学内容写入测试文字。自动检查不代替人工教学验收。
