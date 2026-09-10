# Navigation acceptance matrix

> 这是 T-110 的可重复验收入口。源码契约由 `tests/site-navigation-contract.test.ts` 执行；Chromium 结果来自隔离本地 D1 的真实浏览器运行，而不是检查 `href` 后人工填写。Safari／iPad 列必须由 T-088 真机补齐。

## 来源与标签

- 来源：`app/page.tsx`（公共历史世界首页）、`app/components/NavigationLink.tsx`（原生锚封装）、`app/classroom/ClassroomHub.tsx`、`app/studio/StudioRoute.tsx`、`app/studio/editor/page.tsx`、`app/course/page.tsx`、`app/course/[slug]/CoursewareFrame.tsx`、`app/account/page.tsx`、`app/auth/*`。
- 标签：`首页`、`Studio`、`Editor`、`Classroom`、`Course`、`Auth/Account`。
- 统一约束：核心入口必须最终生成真实 `a[href]`；不使用 `javascript:`、纯 `onClick` 或强制 `_blank` 代替导航。`NavigationLink` 不调用 `preventDefault`，因此左键、Enter、触摸、Ctrl/Cmd/Shift/Alt 新标签行为由浏览器保留。

## 机器基线

- 页面存在：`/`、`/studio/`、`/studio/editor/`、`/classroom/`、`/course/`、`/account`、`/auth/login`、`/auth/register`。
- 核心回路：Classroom → Studio、Classroom → Course、Course → Classroom、Editor → Classroom。
- exact 构造：Course 使用 `releasedRevision`/`releasedDigest`；CoursewareFrame 与 Studio preview 使用 `revision`/`digest`；动态 ID 使用 `encodeURIComponent`。
- 登录回跳：Studio、Studio preview、Account 使用受限的 `returnTo`；登录页接收 `returnTo`。
- 退休入口：核心导航源码不得重新产生 `/alpha` 或全局 `/control` href（课堂动态控制台是 `/classroom/{classroomId}/control`，不属于全局退休入口）。

## Chromium 自动验收结果

- `World → Course → Login`：普通左键通过；未登录时保留 `/course/` returnTo。
- `Auth`：错误密码显示可重试反馈；忘记密码普通点击通过；找回页返回登录 Enter 通过；品牌返回首页普通点击通过。
- `Studio`：侧栏、工作台卡片、编辑器返回、多角色视图、验收与发布正文链接均执行真实导航；不是只检查 DOM。
- `Releases → Preview`：普通点击与 Cmd＋点击都保留 exact `course / revision / digest`；bfcache 返回后不永久停留“正在打开…”。
- `Editor`：记录冷／热 document、脚本、bootstrap、课程列表及首门可编辑阶段；部署诊断 503 不阻塞课程编辑。
- `Course`：目录 → exact 课件普通点击、刷新、后退、前进、Cmd 新标签通过；服务端会话失效后登录精确回到原 revision／digest。
- `Account`：账户菜单 → 账户中心普通点击通过。
- `Touch simulation`：390×844、Chromium `hasTouch` 单次 tap 进入多角色视图，无横向溢出。它不是 iPad Safari 真机回执。
- `Classroom`：T-086 浏览器回执已覆盖课堂卡片普通点击、具体课堂深链、Block 回看、角色视角和移动几何；其余内导航继续在 T-109 后的全站复跑中验证。

机器回执：`docs/qa/t110-navigation/browser-receipt.json`。

## 尚未关闭的矩阵行

- T-109 尚未建立的新官网主导航、World 独立入口、课程框架、家长问答、Workshop 归档入口：实现后复跑 T-110，不能拿当前旧首页代替。
- Classroom 的成员管理、公共投屏、exact 导师课件和所有返回入口：当前已有源码契约／局部 T-086 证据，T-109 后需要同一轮全链路浏览器回归。
- 注册、重置密码的完整写流程与无权限/404 页面：认证 API 测试已覆盖数据语义，浏览器导航矩阵仍需补齐。
- Windows Ctrl＋点击、中键、右键新标签与 Safari Cmd＋点击：保留浏览器原生 anchor 契约，但还没有对应硬件回执。
- 桌面 Safari、iPad Safari 单触、系统返回手势与 bfcache：T-088，保持未验收。

## 必须真实浏览器/Pad 验证

- 服务端渲染后的最终 href、部署前缀与 canonical 域名。
- 鼠标左键、键盘 Enter、触摸点击，以及 Ctrl/Cmd/Shift/Alt 点击和上下文菜单新标签。
- bfcache 返回、刷新后 URL/课程 exact 参数和登录后的回跳。
- Studio/Editor/Classroom/Course 的真实角色权限、会话过期与错误页。
- iPad Safari 的触摸、视口、系统返回手势；本文件没有伪造这些结果。
