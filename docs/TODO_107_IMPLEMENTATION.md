# T-107 官网账号入口与菜单样式实施记录

## 结果

`minisv.vip/` 的静态官网具备与 Studio、Classroom、课件库和账户页相同语义的账号入口。匿名用户看到登录按钮；登录用户能在官网查看当前身份、切换已验证账号、添加账号、进入账户中心及安全退出。

## 复用方式

- 静态官网只发布账号菜单的 HTML 壳与 `portal.js`；当前身份每次从同源 `/api/auth/accounts` 读取，不进入公共 HTML 或共享缓存。
- 官网动作调用与 React 菜单相同的服务端 action、CAS version 和幂等键，不复制一套弱化的认证逻辑。
- `BroadcastChannel` 只用于失效通知；不广播凭据或身份正文。
- 请求失败会显示明确状态，不把网络故障伪装成已登出，也不继续显示上一账号残留信息。

## 样式修复

- 将外层 `.top nav a`、`.user a` 等宽泛后代规则收紧到自身导航项，防止污染 Portal 中的链接。
- 链接和普通按钮共用一致的字体、颜色、背景、边框、hover／focus／visited 语义；退出操作保留明确且可读的 danger 变体。
- 菜单使用视口内定位和响应式宽度；390px 视口实测左右边界为 6px／384px，不需要 hover 才能操作。

## 浏览器证据

- 桌面初始对比度：15.77:1。
- 桌面 hover／focus 对比度：9.28:1。
- 390×844：根宽 390px，面板宽 378px，无横向溢出。
- 页面错误与服务端 5xx：0。
- 截图：`docs/qa/t106-t107-accounts/homepage-account-menu-desktop.png`、`homepage-account-menu-mobile.png`。

完整机器证据见 `docs/qa/t106-t107-accounts/browser-automated-evidence.json`。自动化使用合成账号和隔离 D1，不包含生产会话或密码。
