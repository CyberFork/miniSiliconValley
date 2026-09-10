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

## 构建同事 P 导师课件

准备干净 checkout，必须精确匹配：

```text
commit 679213a61b835335016eac7649213983a0e48489
tree   3a041c4714190cc026f6de8e06e15cec0e5f765d
```

执行：

```bash
deploy/minisv/scripts/build-chj-course.sh <chj-checkout> <courseware-output>
```

脚本只使用同事工程已支持的 base/canonical 环境变量，源工作树前后必须干净。产物位于 `/courseware/product-mentor-foundations/`，组装前后按整树 digest、文件数和字节数验证；禁止主题注入或 HTML/CSS/JS 重写。

## 组装静态 site

```bash
npm run build:minisv-app
npm run render:minisv-static

python3 deploy/minisv/package_release.py   --legacy-root <已验收的静态基线>   --app-client-root dist/client   --app-static-root dist/minisv-static   --course-static-root <courseware-output>   --portal-root deploy/minisv/site   --output <site-output>   --release-id <RELEASE_ID>   --main-sha "$(git rev-parse HEAD)"
```

`package_release.py` 生成 `release.json`、`sitemap.json` 和 `site/MANIFEST.sha256`。动态 `/course/` 由应用拥有；P 课件整树复制到 `/courseware/product-mentor-foundations/`，仓库中带 exact manifest 的 D／M 课件复制到各自 `/courseware/{slug}/`，三者都在全局主题转换之后写入，禁止静默改写已发布字节。

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

1. 验证 archive 安全性、根/site manifests、Worker、Parent-QA 内容清单和全部 launchd plist。
2. 将包放入不可变 `~/Services/minisv/releases/<RELEASE_ID>`。
3. 在改动运行态前校验主应用与 Parent-QA 的内部审核令牌一致；缺失时安全生成／补齐，不一致时失败关闭且不回显令牌。
4. 停止课堂 worker 与 Parent-QA，分别备份 D1-compatible 数据和 QA NDJSON 数据目录。
4. 退休 18790/18791 全局服务。
5. 原子切换 `~/Services/minisv/current`，再启动同版本应用与 gateway。
6. 保留健康且配置未变的 cloudflared，避免无意义断流。
7. 执行 loopback health；失败时恢复之前捕获的 symlink、配置和 launchd。

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
