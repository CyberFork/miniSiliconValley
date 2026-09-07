# 测试与验收（TESTING）

## 一键生产闸

```bash
npm ci
npm test
```

`npm test` 顺序执行：

1. `npm run typecheck`：TypeScript strict 类型检查。
2. `npm run lint`：ESLint，`--max-warnings=0`。
3. `npm run build`：Vinext/Vite 生产构建。
4. 核心质量闸执行确定性数据、SSR、交互和状态测试。

Work 子路径部署质量闸：

```bash
npm run test:work
```

它在完整核心检查之外生成 `/msv/` 静态构建，并执行 2 项部署契约测试，总计 25 项。

可分开执行：

```bash
npm run validate:data
npm run test:unit
npm run test:render
```

## 自动测试矩阵

### `tests/curriculum.test.ts`

- 旧六段素材索引继续通过数据完整性校验。
- 历史世界只能通过真实 `/course/` 链接进入独立课程站，不保留第二套内存入口。

### `tests/data-validate.test.ts`

- 8/34/74/51/75/66/203/8 数据计数与最低门槛。
- Catalog 与 Mission 零错误、零警告。
- 每个事件有来源，每个来源为 HTTPS。
- 8 个 Mission 与 8 个历史事件严格双向对应。

### `tests/state.test.ts`

- 玩家操作不修改 Original Timeline 或关卡定义。
- 重玩同关替换而非累加结果，无法刷资源。
- 资源被截断到 0–9。
- 导出/导入往返一致。
- 拒绝未知 Schema 与根节点/嵌套危险键。
- 非法领域回退，文本、历史节点、证据和结果数组去重/限长。

### `tests/render.test.ts`

- 从 `dist/server/index.js` 真实服务端渲染首页，检查标题、世界地图和无 Starter 占位内容。
- 4 个 WebP 资源存在且画布尺寸一致，保证跨时代交叉切换不跳位。
- 核心源码无 TODO、旧 Starter 或已拒绝的模板化假历史短语。

### `tests/interaction-contract.test.ts`

- 年份始终限制在 1891—2026；地图缩放始终限制在 1—2.4。
- 四代地图在任意年份只混合相邻图层，透明度总和恒为 1。
- 自动检查桌面/平板/手机断点、弹窗视口约束、减少动态与打印样式。
- 自动锁定时间轴、键盘、搜索、拖动、双指缩放、滚轮、档案和关卡返回契约。
- 打开地图节点只能暂停播放、登记已读并展示详情，不得改写时间轴年份。
- 自动锁定 Modal 焦点/关闭语义和六阶段学习闭环，防止关键交互在重构时静默消失。

### `tests/work-static.test.ts`

- `dist/work/msv/demo.html`、客户端 chunks、favicon 与 4 幅地图必须完整存在。
- HTML 的脚本、样式、图片和图标只能引用 `/msv/` 子路径，Canonical 必须指向 Work 演示地址。
- `demo-manifest.json` 中每个文件的字节数和 SHA-256 必须与产物一致。

### `tests/mission-progress.test.ts`

- 证据组合必须确定性地解锁对应行动，缺证时返回准确的证据标题。
- 学员界面只能显示证据标题，不得暴露 `m4-e4` 一类内部 ID。

## 响应式与无障碍验收

代码级闸检查：

- `390px / 520px / 720px / 900px / 1180px` 布局断点。
- 弹窗宽度不超过 `calc(100vw - 32px)`，所有 Grid 子项 `min-width: 0`，避免窄屏横溢出。
- Modal 的 Escape、背景关闭、焦点陷阱、关闭后焦点恢复。
- 年份键盘操作、地图触摸拖动/双指缩放、按钮可访问名称。
- `prefers-reduced-motion` 及打印样式。

Sites 构建规范不要求用浏览器截图作为发布前置；因此默认质量闸不依赖图形环境或网络，保持 CI 可重复。

## T-077 原样课程站验收

先运行：

```bash
deploy/minisv/scripts/build-chj-course.sh <chj-checkout> <course-output>
```

该门禁检查固定 commit、Git tree、干净工作树、类型、Lint、生产构建、`/course/` 资源前缀及 canonical。发布打包测试还逐文件比较输入和 `site/course/`，证明主站路径重写与主题注入没有触碰同事产物。

`tools/live-run/tests/verify_course_outline_browser.py` 验证：

- `/course/` 在 390、430、768、1440 px 正常载入同事原版“青少年AI创业营”首页；
- 工作台图片和 `/course/_next/` 客户端代码真实加载，不出现主站主题脚本；
- “课程大纲”和“开始”都进入原版 9 章／4 阶段页面，返回首页可用；
- `/`、`/world/`、`/framework/`、`/parents/` 在手机和桌面都有可见 `/course/` 入口；
- 无浏览器 `pageerror`。

部署测试还覆盖 `/course → /course/`、不透明目录复制、固定 chj 身份、manifest 和生产 smoke。最终版本见 `TODO_077_IMPLEMENTATION.md` 和发布回执。

## T-083 九视窗课程工作台验收

核心测试：

```bash
python3 -m unittest discover -s tools/live-run/tests -p 'test_*.py'
node tools/live-run/tests/test_card_view.mjs
node tools/live-run/tests/test_t083_course_preview.mjs
node --test tools/live-run/tests/test_remote_console_security.mjs
python3 tools/live-run/tests/verify_t083_browser.py
python3 tools/live-run/tests/verify_t074_browser.py
python3 tools/live-run/tests/verify_editor_layout_browser.py
python3 tools/live-run/tests/verify_todos_071_072_browser.py
```

覆盖内容：

- 两门内置课程的 26 个 Block 均生成确定性 9 窗契约快照。
- 每个 Block 检查 4 导师、4 学员、1 中控同步，且只有一位导师主导。
- 固定 seed 的 4×3 手牌可重现且 12 张唯一；换 seed 后结果变化。
- 所见字段反查唯一 Course Package 路径，输入后所有受影响窗口同步；派生字段只读。
- 五种画布布局、底部可调中控、撤销／重做与粘性保存可用。
- 保存 Candidate 不改变活动 Run；Released API 拒绝无 Candidate、非 exact digest 和未完成验收。
- T-083 前旧 digest 的活动 Run 在升级重启后保持 Run ID、当前 Block、状态与尝试次数，不得静默新建课堂。
- 真实 seat 与 controller 复用共享渲染器，同时不显示编辑控件或预览模拟状态。
- 1440／1180／768／430／390 px 无横向溢出、无过小基础字号。

生产环境使用只读脚本；账号密码只允许由受控环境变量注入，不得写入命令历史、日志或回执：

```bash
MSV_QA_ORIGIN=https://minisv.vip \
MSV_QA_USERNAME='<受控导师账号>' \
MSV_QA_PASSWORD='<受控密码>' \
MSV_QA_RELEASE='<release-id>' \
MSV_QA_MAIN_SHA='<release-main-sha>' \
python3 tools/live-run/tests/verify_t083_production_readonly.py
```

脚本登录后只发送 `GET/HEAD/OPTIONS`，读取 `/control/api/bootstrap` 的 `editorBuild=t083-nine-pane-studio-r1`，并复验 Google 与饿了么的 5×13、9 窗、五种画布、确定性发牌、角色隔离、可见字段路径、派生只读及五档响应式布局。部署前后另以服务端状态文件的归一化玩法哈希证明 Run、进度、尝试次数、身份、手牌和账本未改变。

## Alpha 席位生产验收

远端席位服务的回归测试必须经过真实 `remote-console/server.mjs`，解析 `seat.html` 并逐项获取其相对 JS/CSS 依赖。不得用直接暴露源码目录的 fixture 替代该边界。

每次 Alpha 相关发布后执行：

```bash
python3 deploy/minisv/scripts/public-smoke.py --base https://minisv.vip
python3 tools/live-run/tests/verify_alpha_public_seat.py \
  --base https://minisv.vip/alpha/
```

第二条命令会临时领取、渲染并释放一个空闲席位，要求没有加载占位残留、错误界面、失败资源或浏览器 console error。若八席都被真实用户占用，验收明确失败但不会抢占或重置任何席位。事故背景见 [`ALPHA_SEAT_LOADING_INCIDENT_2026-09-08.md`](ALPHA_SEAT_LOADING_INCIDENT_2026-09-08.md)。
