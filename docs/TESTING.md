# Mini Silicon Valley 测试与验收

## 1. 快速平台闸

```bash
npm run typecheck
npm run lint
npm run test:course-platform
npm run build:minisv-app
npm run test:course-platform:e2e
```

`npm run test:minisv-app` 串联上述核心步骤并执行应用 smoke。

## 2. T-085 自动验收矩阵

### CourseDefinition 与 `4 + N + 1`

- 同一投影器生成 4 位导师、N 位学员和 1 个中控。
- N=2/4/6 的席位数、任务、固定 seed 和手牌确定性。
- `unique-within-step` 不重复发牌；`repeat-when-needed` 只在显式配置时重复。
- 人数越界、卡数不足或动态任务模板缺失给出精确缺口。
- 声明的 `maxCount` 无法实例化时阻止 Released。

### 工厂、权限与隐私

- Test/Production 共用 `ClassroomFactory` 和 state machine version。
- Test 接受 Candidate 或 Released；Production 只接受 Released。
- P/D/M/O 恰好四个不同导师账号；学员账号数等于 N。
- Admin DM 是独立权限；平台 admin 不自动获得某课堂访问权。
- 一次性初始密码未修改前，所有 Studio/Classroom 数据 API 返回 `PASSWORD_CHANGE_REQUIRED`。
- 学员响应无中控验收条件和导师脚本；每个学员只收到自己的持久化卡牌。
- `/screen` 专用 allow-list 不含 `myView/privateCards/privateScript/submissions/economy/accounts/courseware`。
- 导师课件库不向学员开放。

### 版本与发布链

真实 HTTP+D1 E2E 必须证明：

```text
Candidate
  → Test Classroom 完成 13 Block
  → 完整验收清单
  → 重复签收仍返回同一个持久 receipt id
  → Released
  → Production
```

还要验证：

- inline HTML 课件可创建、exact 预览、发布和绑定。
- Production 开始后，后续课程 Candidate、课件新版本和 Test reset 对其 exact 引用与 ControllerState 零副作用。
- Production reset 返回 `PRODUCTION_RESET_FORBIDDEN`。
- N=6 的 18 张手牌在六个账号之间隔离且唯一。

### 部署包

```bash
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
zsh -n deploy/minisv/scripts/*.sh
```

覆盖：manifest 完整清单、篡改拒绝、secret/symlink 拒绝、统一 app+site+ops、固定 P 课件身份、gateway 路由、真实 Origin 透传、旧全局端口退休、原子切换和失败回滚契约。

## 3. 真实 release drill

每次生产发布前必须从干净构建执行一次完整组装：

1. `build:minisv-app` 与 `render:minisv-static`。
2. 从固定 commit/tree 的干净 chj checkout 构建 P 课件。
3. 运行 `package_release.py`。
4. 运行 `package_bundle.py --archive`。
5. 从 archive 解包到新目录，复验根 manifest、site manifest 和 app worker 配置。
6. 确认包内无 secrets、SQLite、运行数据或 symlink。

## 4. 浏览器验收

至少使用桌面和 390px 手机视口，分别以管理员／导师／学员登录：

- Studio Editor：切换课程、Block、2/4/6 人、seed；无横向遮挡；错误 JSON 不崩溃且不伪装成功。
- Preview：页内呈现 `4 + N + 1`，没有独立九窗口依赖。
- Courseware：创建 HTML、打开 exact revision、发布；同事 P 课件从独立原版页面打开。
- Classroom：创建 Test、首次改密、不同角色进入、提交、逐块推进、投屏、成员管理、reset。
- Release：验收回执出现后发布；Production 只能选择 Released，且无 reset。
- 退休入口：`/alpha/`、`/control/` 为 410；`/api/internal/*` 公网 404。

浏览器 console error、资源 404、私密字段越权、内容横溢、按钮无响应或版本静默漂移均视为失败。

## 5. 完整兼容回归

```bash
npm run validate:data
npm run test:release
```

它覆盖历史世界、Work 旧构建、Parent Q&A 和旧资料兼容。历史测试名称里出现“课程大纲”不代表 `/course/` 当前语义；当前路由权威以本文件和 `COURSE_PLATFORM_ARCHITECTURE.md` 为准。
