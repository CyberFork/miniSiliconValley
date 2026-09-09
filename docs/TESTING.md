# Mini Silicon Valley 测试与验收（T-087）

## 1. 自动化总闸

开发时最短闭环：

```bash
npm run typecheck
npm run lint
npm run test:course-platform
npm run build:minisv-app
npm run test:course-platform:e2e
```

一次执行核心应用闸：

```bash
npm run test:minisv-app
```

它覆盖类型、Lint、领域／路由契约、生产构建、应用 smoke 和真实 HTTP + D1 课程平台 E2E。

## 2. 两次验收、一次发布

自动化必须证明以下顺序不可绕过：

```text
Candidate exact revision/digest
  → ViewAcceptanceReceipt
  → TEST Classroom 完成全部 Block
  → 14 项 UI 检查
  → UiAcceptanceReceipt
  → Released
  → PRODUCTION Classroom
```

### ViewAcceptanceReceipt

- 只读取已保存 Candidate，不读取浏览器 Working Copy。
- 使用共享 `buildStudioProjection()` 遍历全部 Block 和课程声明的每个支持人数。
- 校验 `4 + N + 1` 视图、动态任务、卡牌容量、固定 seed、不重复发牌和私密卡分配。
- exact revision／digest、projector version 或 app build 不一致时失效。
- 未发布 Candidate 被新 Candidate 取代后，旧回执失效。
- 当前 Released 可继续保留其 exact 有效回执。
- 重复签发同一业务指纹返回同一持久 receipt id。

### UiAcceptanceReceipt

- 只能由完成全部 Block 的 TEST Classroom 签发。
- 14 个必检项缺一即拒绝。
- 锁定 exact Candidate、View 回执、Test Classroom、N、seed、reset generation、state machine、4 + N Membership、Admin DM 和四套课件。
- 保存 browser／platform／viewport client matrix、app build、操作者和审计摘要。
- TEST reset 后历史回执保留但立即失效，课堂当前 binding 被清空。
- 重复签发同一业务指纹返回同一持久 receipt id。

### Released 与 Production

- 缺少任一有效回执时不能 Released。
- Production 只能选择 Released。
- Production 只能复用 UiAcceptanceReceipt 中四套 exact 且已发布课件；不能静默替换“最新版”。
- 课件 bundle digest 采用 canonical 字段顺序，API 与 D1 的对象插入顺序不得改变结果。
- Production 创建后，Studio 新 Candidate、课件新版本和 TEST reset 对其 exact 引用及 ControllerState 零副作用。
- Production reset 返回 `PRODUCTION_RESET_FORBIDDEN`。

## 3. 课程工厂、权限与隐私

- Test／Production 共用 `ClassroomFactory`、页面、API 和 state machine version。
- 两种环境都要求有效 ViewAcceptanceReceipt。
- Test 接受 Candidate 或 Released；Production 额外要求有效 UiAcceptanceReceipt。
- P／D／M／O 恰好四个不同导师账号；学员账号数等于 N。
- Admin DM 是独立课堂权限；平台 admin 不自动获得所有课堂访问权。
- Account 可通过 Membership 加入多个 Classroom。
- 首次密码未修改前，Studio／Classroom 数据 API 返回 `PASSWORD_CHANGE_REQUIRED`。
- 学员只收到自己的任务、持久化私密卡、提交、RP 与钱包。
- `/screen` 专用 allow-list 不包含 `myView/privateCards/privateScript/submissions/economy/accounts/courseware`。
- Released 课件库和播放页允许真实 admin／mentor／learner 只读访问；Candidate、内部 fallback、observer 和 Test impersonation 不得进入。
- 过期 ControllerState version 的并发写入必须返回冲突，不得覆盖新状态。
- Primary Admin DM 可以委派任一有效导师；Delegated 能管理本课堂，但其授权／撤销请求在 API 层返回 403 并写审计。
- 平台管理员 Test 模拟必须同时满足明确 Test Classroom、有效目标 Membership／DM、管理员自身显式 DM 权限；Production、平台管理员目标和跨课堂请求全部拒绝。
- 普通切换和退出都必须撤销服务端 session；Test 模拟在返回、过期、停用、凭据重发或权限撤销后立即失效。

## 4. 动态 `4 + N + 1`

- N=2／4／6 的席位数、任务、固定 seed 与发牌均可确定性投影。
- `unique-within-step` 不重复发牌；`repeat-when-needed` 只在显式配置时重复。
- N=2 不显示虚假学员；当前 T-095 策略下 N=6 的 12 张手牌在六个账号之间隔离且唯一（每人 2 张），数量不得写死为 3。
- 人数越界、动态任务模板缺失或卡牌容量不足时显示精确缺口。
- 声明的 `maxCount` 无法实例化时不能签 View 回执、创建 Test 或 Released。
- `fieldModel` 的每个非公共字段必须有唯一 fieldId、owner 和 JSON path；learner01—06、四导师与卡片互不串改。
- 浏览器与服务端在相同 courseDataId、block、seat、seed 下必须产生相同 cardId 顺序；checkpoint 卡组覆盖规则也必须一致。

## 5. HTTP + D1 E2E 场景

`scripts/test-course-platform-e2e.ts` 使用隔离 D1 和真实路由运行：

1. 保存 Candidate 并签 View 回执。
2. 证明伪造 View 回执不能创建 Test。
3. 创建绑定四套 exact 课件的 TEST。
4. 触发真实并发 409，并在完整运行前测试 reset。
5. 推进并接受全部 13 Block。
6. 证明不完整的 14 项检查不能签收。
7. 签发并重复签发 Ui 回执，验证持久 id 与 classroom binding。
8. 证明缺少 UI 回执不能发布。
9. 使用双回执发布 Released。
10. 用同一组 exact 课件创建 PRODUCTION。
11. reset TEST，验证 UI 回执失效而 PRODUCTION 不漂移。
12. 新 Candidate 使旧未发布 Candidate 的 View 回执失效。
13. 构造容量不足课程，证明 View／Test 失败关闭。
14. 验证 N=6、动态任务、手牌隔离、Admin DM 权限与数据隔离。
15. 验证 Studio 00—04 真实 href、统一账号菜单、服务端登出与安全 returnTo。
16. 验证 Primary／Delegated 非递归委派、主动退出、立即撤销和跨课堂隔离。
17. 验证 Test 导师／学员／Delegated 身份模拟、actor/effective 审计、Production／Studio／Account 失败关闭。
18. 验证 Test 身份停用、启用、一次性凭据重发及相关会话撤销。

成功标记包含：

```text
COURSE_PLATFORM_E2E_PASS t086=view-receipt+ui-receipt+release-gates t087=navigation+account-menu+test-impersonation+nonrecursive-admin-dm
```

## 6. 浏览器验收

至少使用桌面和 390px 手机视口，以管理员、导师和学员真实会话检查：

### Studio

- 分组导航依次显示“课程生产／资源管理／课堂交付”。
- Editor 保留可视化直改工作台，不退化为只读卡片或只能改原始 JSON。
- 保存 Candidate 后出现“前往多角色视图验收”。
- Preview 显示 exact revision／digest，能遍历全部 Block 和支持人数；未遍历完整时不能签收。
- Releases 显示 Candidate、View 回执、TEST、UI 回执、课件、Released 与“下一步主操作”。
- `/course/` 始终标记“课程目录”，并只列出注册表中的真实 Released 课件；P、D 使用同一登录和播放器机制。
- 00—04 都能用鼠标、键盘 Enter、刷新直达和 Cmd/Ctrl＋点击打开；URL、主标题与 `aria-current=page` 一致。
- 右上角账号菜单显示真实账号并可进入账户中心、切换账号和退出；操作后旧 Session API 返回 401。

### Classroom

- `/classroom/` 分为 `TEST · UI 验收课堂` 与 `PRODUCTION · 正式课堂`。
- Test Factory 只列出有有效 View 回执的版本。
- Production Factory 只列出有两张有效回执的 Released，并锁定验收过的课件。
- 导师、N 学员、Admin DM 和 screen 分别只看到权限允许内容。
- 中控能执行、收齐、退回／重试、接受、推进和完成。
- 完成后显示 14 项真实 UI 清单；签收后显示 receipt id 与发布入口。
- TEST 有 reset；PRODUCTION 永远不显示 reset。
- 页面无横向遮挡、控件重叠、按钮无响应、资源 404 或 console error。
- Primary／Delegated 标签准确；Delegated 没有委派控件但仍可使用主控，直接调用委派 API 也必须失败。
- Test 身份全程显示黄色 actor → effective 横幅，返回管理员后不残留目标私密数据。
- Test 的“数据身份”可复制 exact courseDataId、run、block、seat、deal seed、状态版本和 cardAssignment 顺序；与当前 Candidate 不同时明确标为锁定旧版本。

### 路由

- `/alpha/`、`/control/`、`/control/editor/` 返回 410。
- `/api/internal/*` 公网返回 404。
- 新导航不出现退休入口。

## 7. 部署包与发布演练

```bash
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
zsh -n deploy/minisv/scripts/*.sh
```

覆盖 manifest 完整清单、篡改／secret／symlink 拒绝、统一 app + site + ops、固定 P 课件身份、gateway、Origin 透传、原子切换和失败回滚。

每次生产发布必须：

1. 执行 `build:minisv-app` 与 `render:minisv-static`。
2. 从固定 commit／tree 的干净 chj checkout 构建 P 导师原版课件。
3. 运行 `package_release.py` 和 `package_bundle.py --archive`。
4. 从 archive 解包并复验根 manifest、site manifest 和 worker 配置。
5. 确认包内无 secrets、SQLite、运行数据或 symlink。
6. 原子部署到 Hecate 后执行远端健康检查和 `public-smoke.py`。
7. 用域名复验 Studio／Classroom 鉴权、退休路由、CSP 与静态资源。

## 8. 完整兼容回归

```bash
npm run validate:data
npm run test:release
```

它额外覆盖历史世界、Work 旧构建、Parent Q&A 和旧资料兼容。历史文档中的“课程大纲”或旧 Classroom 路由不是现行语义；以本文件、`COURSE_PLATFORM_ARCHITECTURE.md` 与 `MSV_SITE_MAP.md` 为准。
