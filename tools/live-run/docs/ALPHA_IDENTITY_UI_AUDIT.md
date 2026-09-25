# Work Alpha 席位身份 UI 审计与发布记录

## 用户可见契约

- 测试昵称通过系统视觉一致的站内对话框录入，不使用浏览器原生弹窗。
- 已领取席位的主标题是“角色 · 昵称”，例如“市场导师 · forker”；“我在用／他人使用”只负责表达占用状态，不重复昵称。
- 用户修改昵称后，已有席位的服务端昵称也同步更新；其他浏览器可见，席位 lease 不变。
- 全局重置使用站内高风险对话框；空值或错误确认文字会留在对话框内并显示行内错误。

## 本次发现并解决的问题

1. 首次领席、编辑昵称和全局重置原先使用三个 `window.prompt`；现已全部改为可访问的 `<dialog>`。
2. HTML `required` 原本会触发浏览器原生校验气泡；表单现使用 `novalidate` 并统一走站内行内校验。
3. 用户输入纯空格后再改正，旧的 `close` 监听流程会丢失 Promise，导致领席永久等待；现改为 `submit` 中校验、`close` 单独取消的可重试状态机。
4. 旧版 localStorage 可能保留超长或含控制字符的昵称；客户端现与服务端使用相同的规范化边界：移除控制字符、去首尾空格、最多 24 个字符。
5. 席位卡旧版只显示角色；现在本人和他人的卡片都在角色后显示服务端 `claimedBy`。
6. 单席页现会在发起请求前检查 `clientId` 和 `lease` 是否同时存在，缺失时直接告知返回席位控制台，不做无效轮询。
7. 扩展审计发现 LIVE RUN SCRIPT 本地主控的“切换课程”和“重置 Run”仍使用两个原生 `confirm`；源码已替换为同设计系统的高风险确认对话框。
8. 本地主控已安全重载新静态资源；原 `runId` `run-20260904-062413-0b88a2`、“饿了么｜五步创业闭环”、`ready` 状态和第 1 块保持不变，公网 Alpha 重新确认主控已连接。

## 验收

- Python 功能契约测试：30/30 通过；Node remote console 契约测试：5/5 通过。
- Python controller HTTP 测试：5/5 通过。
- 隔离 Chrome E2E：覆盖空值、纯空格、重试、领席、改名、第二客户端可见、释放、重置错误／取消／正确三路，以及主控切换课程对话框。
- 公网 Chrome 冒烟：实际领取 W00，看到“主 DM · 产品导师 · forker发布验收”，随后释放；验收前后均为 0 个占用席位。
- 公网与本地的 HTML/CSS/JS SHA-256 逐件一致；特权路由仍统一返回 404。

完整机器可读证据见 [`ALPHA_IDENTITY_UI_RELEASE_RECEIPT.json`](ALPHA_IDENTITY_UI_RELEASE_RECEIPT.json)。

## 视觉证据

- [站内昵称对话框](assets/alpha-nickname-dialog.png)
- [隔离环境角色·昵称](assets/alpha-role-nickname.png)
- [公网发布后角色·昵称](assets/alpha-production-role-nickname.png)
- [LIVE RUN SCRIPT 风险确认对话框](assets/live-run-confirm-dialog.png)
