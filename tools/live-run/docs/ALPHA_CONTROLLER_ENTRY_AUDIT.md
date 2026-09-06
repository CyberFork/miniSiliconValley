# Work Alpha 右上角主控入口发布记录

## 用户契约

- Alpha 顶部右侧原有“课程主控已连接”状态后，新增高亮的“打开主控 ↗”按钮。
- DM 点击后，会在独立 app-style popup 中打开 `LIVE RUN SCRIPT`，不离开 Alpha 页面。
- 重复点击会聚焦已有主控窗口，不会生成重复窗口。
- 弹窗被浏览器拦截时，Alpha 会给出明确的站内恢复提示。

## 安全边界

入口严格指向本机 `http://127.0.0.1:18765/`，适用于已经运行主控的 Mac，以及已建立 reverse tunnel 的 Windows 测试机。普通组员电脑没有本地主控时，该入口不会越权连入。

此收口是有意的：Alpha 当前免登录，不能因增加一个 UI 按钮就公开控制课程推进、切课和重置的特权 API。公网 `/msv/alpha/api/bootstrap`、`/api/script` 和 `/api/control` 验收后仍全部返回 404。

## 验收

- Node 远端控制台契约：5/5 通过。
- 隔离 Chrome 本地验收：入口可见、主控可达、标题与一级标题均为 `LIVE RUN SCRIPT`、与 Alpha 为不同 `windowId`、重开未增加 target。
- 公网 Chrome 再验收：同一路径全部通过；公网资源与本地 SHA-256 逐件一致。
- 课程仍为“饿了么｜五步创业闭环”、第 1/13 块、`ready`；验收后占用席位为 0。

机器可读证据：[`ALPHA_CONTROLLER_ENTRY_RELEASE_RECEIPT.json`](ALPHA_CONTROLLER_ENTRY_RELEASE_RECEIPT.json) 与 [`ALPHA_CONTROLLER_ENTRY_BROWSER_RECEIPT.json`](ALPHA_CONTROLLER_ENTRY_BROWSER_RECEIPT.json)。

## 视觉证据

- [公网 Alpha 右上角主控入口](assets/alpha-controller-entry.png)
