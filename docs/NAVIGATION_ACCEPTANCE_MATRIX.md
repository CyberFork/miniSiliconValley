# Navigation acceptance matrix

> 这是 T-110 的可重复验收入口。源码契约由 `tests/site-navigation-contract.test.ts` 执行；Chromium 结果来自隔离本地 D1 的真实浏览器运行，而不是检查 `href` 后人工填写。Safari／iPad 列必须由 T-088 真机补齐。

## 来源与标签

- 来源：`deploy/minisv/site/index.html`（公开官网）、`app/world/page.tsx`（完整历史世界）、`app/components/NavigationLink.tsx`（原生锚封装）、`app/classroom/ClassroomHub.tsx`、`app/studio/StudioRoute.tsx`、`app/studio/editor/page.tsx`、`app/course/page.tsx`、`app/course/[slug]/CoursewareFrame.tsx`、`app/account/page.tsx`、`app/auth/*`。
- 标签：`官网`、`World`、`Studio`、`Editor`、`Classroom`、`Course`、`Auth/Account`、`Workshop Archive`。
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
- `T-109 公开区`：官网普通点击进入 World、方法框架、家长入口、去上课和课件查看；1440px／390px 无横向溢出，World 滑杆和触摸入口可用，公开 HTML 不含内部入口。
- `T-109 内部历史`：Studio 侧栏和资料页均能普通点击进入 `/studio/history/`；归档说明页可找到 `/workshop/`，Workshop 不回流官网主导航。
- `T-111 回归`：TEST 顶部新建、exact 版本深链、归档和“用相同版本新建”普通链接在 T-109 后复跑通过。
- `T-088 工程回归`：真实 learner 会话以可见按钮从 B05 触摸前进到 B08；10 个 Pad/手机 viewport 无横向溢出，学员关键控件均不小于 44×44，输入字号不小于 16px，账号菜单与退出可触摸。该结果仍不是 iPad Safari/Android 真机回执。

机器回执：`docs/qa/t110-navigation/browser-receipt.json`、`docs/qa/t109-public-internal-ia/browser-receipt.json`、`docs/qa/t111-test-classrooms/browser-automated-evidence.json`、`docs/qa/t088-tablet-mobile/browser-receipt.json`。

异浏览器与真实输入设备必须逐组合填写 `docs/qa/t110-navigation/REAL_BROWSER_ACCEPTANCE_TEMPLATE.md`。该模板不预填结果，也不能用来替代课程 View/UI 验收回执。

## 尚未关闭的矩阵行

- 注册、重置密码的完整写流程：认证 API 测试已覆盖数据语义；真实浏览器不得为了导航验收擅自创建账号或修改密码。若另行批准，应使用专用 TEST 身份并单独记录数据清理。
- 404、无权限、课堂中控／成员／投屏、exact 导师课件与返回入口：已有源码契约及 Chromium 分项证据；仍需在上述真实浏览器模板中确认部署后的平台行为。
- Windows Ctrl＋点击、中键、右键新标签与 Safari Cmd＋点击：保留浏览器原生 anchor 契约，但还没有对应硬件回执。
- 桌面 Safari、iPad Safari 单触、系统返回手势与 bfcache：T-088，保持未验收。

## 必须真实浏览器/Pad 验证

- 服务端渲染后的最终 href、部署前缀与 canonical 域名。
- 鼠标左键、键盘 Enter、触摸点击，以及 Ctrl/Cmd/Shift/Alt 点击和上下文菜单新标签。
- bfcache 返回、刷新后 URL/课程 exact 参数和登录后的回跳。
- Studio/Editor/Classroom/Course 的真实角色权限、会话过期与错误页。
- iPad Safari 的触摸、视口、系统返回手势；本文件没有伪造这些结果。
