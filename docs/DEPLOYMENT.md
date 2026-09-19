# Mini Silicon Valley 部署说明

## 生产边界

- 域名：`https://minisv.vip`
- 主机：Hecate Mac mini
- 入口：Cloudflare Tunnel → loopback Nginx `127.0.0.1:18780`
- 应用：Vinext/Worker `127.0.0.1:18787`
- Parent Q&A：`127.0.0.1:18789`
- 数据：`~/Services/msv-classroom/data`，独立于 release
- 18790/18791 已退休；Windows 和局域网机器不参与生产。

## 发布前门禁

只能从稳定 `AI教培-mini硅谷/dev` 工程发布。发布前先确认唯一远端、同步状态和源提交：

```bash
test "$(git remote get-url origin)" = "https://github.com/CyberFork/miniSiliconValley.git"
git fetch origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
test -z "$(git status --porcelain=v1 --untracked-files=all)"
```

```bash
npm ci
npm run validate:data
npm run test:minisv-app
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
zsh -n deploy/minisv/scripts/*.sh
git diff --check
```

需要全量历史兼容回归时再执行 `npm run test:release`。

## 构建同事 P／产品经理导师课件

历史 `r0` 必须精确匹配并永久保留：

```text
commit 679213a61b835335016eac7649213983a0e48489
tree   3a041c4714190cc026f6de8e06e15cec0e5f765d
```

执行：

```bash
deploy/minisv/scripts/build-chj-course.sh <chj-checkout> <courseware-output>
```

当前 `r1` 来自同事仓库 `chj9-11`，必须精确匹配：

```text
commit d9d45f1396b54a7ac6b41715b31122d8ffc597ff
tree   d26045a3eb1c249629092dcddeb82e7812ff0ff5
```

执行：

```bash
deploy/minisv/scripts/build-chj-product-course-r1.sh <chj9-11-checkout> <courseware-r1-output>
```

当前 `r2` 是在同一课件源码中完成 T-116/T-117 后发布的新不可变版本，必须精确匹配：

```text
commit 806d804932e4cd4ae2796d84578d39197d7ea4ce
tree   bde3426ee770272dc3263064a16d60659fffff9b
```

执行：

```bash
deploy/minisv/scripts/build-chj-product-course-r2.sh <chj9-11-checkout> <courseware-r2-output>
```

三个版本构建脚本只使用课件工程已支持的 base/canonical 环境变量，源工作树前后必须干净。`r0` 位于 `/courseware/product-mentor-foundations/`，`r1` 位于 `/courseware/product-mentor-foundations/r1/`，`r2` 位于 `/courseware/product-mentor-foundations/r2/`；组装前后分别按整树 digest、文件数和字节数验证。禁止主题注入或 HTML/CSS/JS 重写，也禁止用新版本字节覆盖历史 exact 版本。

`r2` 构建脚本会校验 exact commit/tree，执行类型检查、数据校验、课程大纲交互测试、生产构建、核心数据／任务／渲染／状态测试并生成静态成品。发布器仍会逐字节复核输入与输出，任何漂移都失败关闭。

## 组装静态 site

```bash
npm run build:minisv-app
npm run render:minisv-static

python3 deploy/minisv/package_release.py   --legacy-root <已验收的静态基线>   --app-client-root dist/client   --app-static-root dist/minisv-static   --course-static-root <courseware-r0-output>   --product-courseware-r1-root <courseware-r1-output>   --product-courseware-r2-root <courseware-r2-output>   --module-thinking-root courseware/module-thinking-deck/dist   --portal-root deploy/minisv/site   --output <site-output>   --release-id <RELEASE_ID>   --main-sha "$(git rev-parse HEAD)"
```

`package_release.py` 生成 `release.json`、`sitemap.json` 和 `site/MANIFEST.sha256`。动态 `/course/` 由应用拥有；产品导师课件 `r0`／`r1`／`r2` 分别原样复制并在 `productCoursewareArtifacts` 中逐版留证，仓库中带 exact manifest 的 D／M 课件复制到各自 `/courseware/{slug}/`。T-122 模块思维课件必须先运行 `npm run test:t122:courseware`，再使用它的 `dist/`组装：`audience/` 使用普通已登录课件门禁，`teacher/` 使用服务端 Admin／Mentor 专用门禁。所有课件都在全局主题转换之后写入，禁止静默改写已发布字节。

打包器会再次校验 Git 根目录、`origin`、HEAD、`origin/main`、退役标记及工作树，并把结果写入 `release.json.workspaceProvenance`。默认拒绝旧工程、未推送提交和脏工作树。确有应急需求时可用 `--allow-dirty-reason "<12—500字单行原因>"`，但例外会进入发布清单，不能隐藏。

## 组装统一 bundle

```bash
npm run build:parent-qa
python3 deploy/minisv/package_bundle.py   --site-root <site-output>   --app-dist-root dist   --ops-root deploy/minisv   --output <bundle-output>   --release-id <RELEASE_ID>   --main-sha <40位提交SHA>   --archive <RELEASE_ID>.tar.gz
```

bundle 必须同时含：

```text
site/          公开静态资产
app/dist/      与本 release 同版本的 Worker 与客户端
app/dist/parent-qa/  同版本的 loopback 家长问答服务与内容清单
ops/           gateway、launchd、部署和回滚脚本
bundle.json
MANIFEST.sha256
```

打包器会逐字节校验 `app/dist/parent-qa/manifest.json` 与 `server.mjs`，并在 `bundle.json.units.parentQa` 单独记录其摘要。secrets、账号明文、SQLite、NDJSON 运行数据和 symlink 会被打包器拒绝。

## Hecate 原子部署

在 Hecate 以受控环境变量运行 bundle 内的 `ops/scripts/deploy-hecate.sh`。脚本会：

> **部署脚本也属于 release。** 新 release 必须从待部署 archive／已校验 staging bundle 中提取并执行它自己的 `ops/scripts/deploy-hecate.sh`；禁止用 `~/Services/minisv/current/ops/scripts/deploy-hecate.sh` 启动更新版本。部署编排、令牌同步、manifest 门禁与回滚步骤会随 bundle 一起演进，旧 `current` 脚本无法安全推断新 release 的前置条件。目标脚本仍须在任何运行态变更前完成 archive 和 manifest 校验。

1. 验证 archive 安全性、根/site manifests、Worker、Parent-QA 内容清单和全部 launchd plist。
2. 将包放入不可变 `~/Services/minisv/releases/<RELEASE_ID>`。
3. 在改动运行态前校验主应用与 Parent-QA 的内部审核令牌一致；缺失时安全生成／补齐，不一致时失败关闭且不回显令牌。
4. 停止课堂 worker 与 Parent-QA，分别备份 D1-compatible 数据和 QA NDJSON 数据目录。
5. 退休 18790/18791 全局服务。
6. 原子切换 `~/Services/minisv/current`，再启动同版本应用与 gateway。
7. 保留健康且配置未变的 cloudflared，避免无意义断流。
8. 执行 loopback health；失败时恢复之前捕获的 symlink、配置和 launchd。

发布后执行：

```bash
$HOME/Services/minisv/current/ops/scripts/healthcheck-hecate.sh
python3 $HOME/Services/minisv/current/ops/scripts/public-smoke.py --base https://minisv.vip
```

随后用真实导师和学员账号完成浏览器验收；不要在终端或回执中打印密码、Cookie、token 或 Tunnel credential。

## 回滚

```bash
$HOME/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_UNIFIED_RELEASE_ID>
```

回滚只允许已通过统一 manifest 的 release。运行数据不随代码回滚；若 schema 变更不向后兼容，必须按该发布的迁移方案恢复受控数据备份，而不是删除数据库。

## T-132／T-133 双 120 分钟课件（2026-09-19）

- 新 P1 使用 `/courseware/development-mentor-module-thinking/r5/audience/`；新 P2 使用 `/courseware/development-mentor-ligun/r1/audience/`。
- 对应 `teacher/presenter.html`、讲稿和所有教师资源均由 mentor-courseware 服务端权限保护；不是仅隐藏入口。
- 原 P1 根路径 r4 与 P2 根路径 r0 保持原字节，不能把新包覆盖旧 URL。
- `npm run build:t132-t133:courseware` 后，打包额外传入 `--module-previous-root <已校验 P1 r4 dist>`、`--ligun-root courseware/ligun-deck/dist`；`--module-thinking-root` 为新 P1 dist。
- packager 必须验证新旧 manifest、哈希、物理分包及复制后字节；P1 历史包必须精确匹配 r4 的登记摘要。P／M 课件不变。
- `deployment-ready` 是部署构建状态，不代表人工 120 分钟试讲通过。保留 `manualAcceptance: not-signed-by-user`。

### P1 r6 及后续版本：历史课件保留门禁

`package_release.py` 新增可重复的 `--module-history-root`。P1 r6 构建除原 `--module-previous-root <已验证 r4 dist>` 外，必须提供 `--module-history-root <已发布 r5 dist>`；r5 内容 identity 固定验证，缺项/重复/篡改均阻止打包。保留 r4 根入口及 r5 版本入口，只将当前登记指针推进到新 r6。P2 r1 本轮内容完全不变。

本次实现和发布复验见 `docs/P1_R6_VOXEL_REUSE_RECEIPT.md`，不要用旧 r5 的发布回执冒充 r6。

P1 r6 已部署 `20260919T1537CST-p1-voxel-reuse-r6`（source `3a90216b7e16627565c6b6a99003558404b31546`）：健康检查、全站公开冒烟、真实线上交互与权限复验通过；444 个历史课件文件逐文件不变。

P1 r7 同样要求 `--module-history-root <r5 dist> --module-history-root <r6 dist>`，两版均按已发布内容摘要验证，防止新发布丢失历史链接。

最终 P1 r7 已部署 `20260919T1551CST-p1-framing-r7`（source `5001fb4ec23321fe6aeb112c9c75a00823eb6dd2`）：默认相机完整取景 18 场景、线上交互与权限通过；486 个历史课件文件不变。P2 r1 未修改。


### 2026-09-19｜T-133 P2 可视化 r2

发布 `20260919T1617CST-p2-visual-r2`，代码 `dde4072`。P2 五组可视化嵌入原有 27 页 / 120 分钟，双视图讲稿和真实 A/B/B 演示一致；新增不可变 r2，原 528 个课件文件不改。P1 仍为 r7。

完整构建、权限、浏览器及部署证据见 [T133_VISUAL_TEACHING_RECEIPT.md](T133_VISUAL_TEACHING_RECEIPT.md)。以后发布 P2 新版须携带 `--ligun-history-root`，缺历史包或 digest 不符将阻止发布。人工教学试讲未签署。
