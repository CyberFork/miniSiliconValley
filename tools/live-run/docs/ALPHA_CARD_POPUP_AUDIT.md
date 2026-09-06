# Work Alpha 席位卡片窗口发布记录

## 用户可见契约

- 点击“领取并打开”后，席位会在独立竖向卡片窗口中打开，不再生成普通浏览器标签页。
- 首次使用时，完成站内昵称对话框后会继续原领取动作，无需再点一次。
- 已领席位的按钮明确显示“打开卡片窗口”。同一席位重复打开会复用已有窗口，不会不断复制。
- 若浏览器拦截弹窗，领取仍会成功，页面会给出明确提示，用户可允许弹窗后通过“打开卡片窗口”重试。

## 实现与失败收口

1. 旧版动态创建 `<a target="_blank">`，所以 Chromium 按普通标签页处理。新版在真实 click 或昵称 form submit 的同步调用栈中预开命名 popup，再发起领取请求，不会在网络 `await` 之后才尝试弹窗。
2. popup 请求约 `440 px` 宽、最高 `860 px`，根据当前屏幕可用区域自动收缩并居中，使用 `popup=yes` 以移除标签栏、工具栏、菜单栏和状态栏。操作系统窗口标题栏仍由浏览器管理，普通网页不会伪造或绕过这条安全边界。
3. 预开后显示同设计系统的“正在准备席位卡片”；服务端返回单席能力链接后用 `location.replace()` 进入私人课堂视角，加载页不留在历史栈中。
4. 请求失败时会关闭预开的加载窗口，不留孤儿窗口；能力窗口的 `opener` 会断开，并继续使用 URL fragment 承载单席能力信息。

## 验收

- Python 课程／主控／HTTP／视角契约：30/30 通过。
- Node 远端控制台契约：5/5 通过；包含 loading card 静态路由、CSP 和 popup 源码契约。
- 本地隔离 Chrome 和公网 Alpha Chrome 均实际完成：昵称→领席→独立窗口→单席页→同席窗口复用→释放。
- CDP 验证席位与控制台的 `windowId` 不同；实测卡片窗口 `440 × 600`（隔离浏览器可用屏幕高度为 664 px），同席重开未增加 target。
- 公网验收前后均为 0 个占用席位；特权 API 仍为 404；本地与公网 HTML/CSS/JS 哈希逐件一致。

机器可读证据：[`ALPHA_CARD_POPUP_RELEASE_RECEIPT.json`](ALPHA_CARD_POPUP_RELEASE_RECEIPT.json) 与 [`ALPHA_CARD_POPUP_BROWSER_RECEIPT.json`](ALPHA_CARD_POPUP_BROWSER_RECEIPT.json)。

## 视觉证据

- [公网席位卡片视角](assets/alpha-seat-card-popup.png)
- [公网控制台](assets/alpha-card-popup-console.png)
- [390 px 移动视图](assets/alpha-card-popup-mobile.png)
