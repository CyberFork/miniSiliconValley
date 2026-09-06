# Mini Silicon Valley 部署说明

## 唯一生产环境

- 正式域名：`https://minisv.vip`
- 运行主机：Hecate Mac mini
- 公网入口：Cloudflare Tunnel → loopback Nginx gateway
- 不依赖 Windows 或局域网机器，不修改 `cyberforker.com` 的其他站点。

主要路由：

```text
/                 公开总导航
/world/           历史世界
/course/          同事原版课程站（固定 chj 提交，独立构建）
/classroom/       账号与课堂
/alpha/           八席课堂视图
/control/         LIVE RUN 主控
/control/editor/  课程编辑器
/framework/       方法同步页
/parents/         家长问答
/workshop/        内容工坊
```

## 发布前门禁

```bash
npm ci
npm run validate:data
npm test
npm run build:minisv-static
deploy/minisv/scripts/build-chj-course.sh <chj-checkout> <course-output>
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
python3 -m unittest discover -s tools/live-run/tests -p 'test_*.py'
git diff --check
```

chj checkout 必须精确位于提交 `679213a61b835335016eac7649213983a0e48489`，Git tree 为 `3a041c4714190cc026f6de8e06e15cec0e5f765d`，且工作树为空。脚本只通过仓库已支持的 `MSV_PUBLIC_BASE`、`MSV_SITE_ORIGIN`、`MSV_CANONICAL_URL` 环境变量适配部署路径，不编辑同事源码。浏览器验收用 `tools/live-run/tests/verify_course_outline_browser.py` 检查原版首页、内部课程大纲、四档视口和公共入口。

## 组装 release

`deploy/minisv/package_release.py` 需要五类输入：

```bash
python3 deploy/minisv/package_release.py \
  --legacy-root <既有静态产品根目录> \
  --app-client-root dist/client \
  --app-static-root dist/minisv-static \
  --course-static-root <原样 chj 课程构建目录> \
  --portal-root deploy/minisv/site \
  --output <新 site 目录> \
  --release-id <唯一 RELEASE_ID> \
  --main-sha <已验证并提交的 40 位 main SHA>
```

打包器先组装 `/world/` 与既有 Classroom／Alpha／Editor／QA／Workshop，重写已退休路径并注入共享 UI；最后才把 chj 课程目录按字节复制到 `/course/`。课程目录前后 tree digest、文件数和字节数必须一致，且不得出现共享主题或先前自制课程页标识。产物生成 `release.json`、`sitemap.json`、`MANIFEST.sha256`。

## Hecate 原子发布

1. 以当前生产 release 为底座，替换本次验证后的 `site/`、`ops/`、`docs/`；运行态数据和 secrets 不进入压缩包。
2. 将压缩包传到 Hecate。
3. 使用私有环境变量执行 `ops/scripts/deploy-hecate.sh`。
4. 脚本先验证 manifest、Python／Node／launchd 配置，再建立不可变 release，原子切换 `~/Services/minisv/current`。
5. 发布后运行 loopback healthcheck、公开 smoke 和真实浏览器验收。
6. 对比发布前后的 `run-state.json`，确保活动 Run、进度、RP、钱包、团队资金和手牌没有变化。

凭据只能来自 Hecate 的 `~/Services/minisv/secrets/` 或受控环境变量，不得写入仓库、命令回执或 URL。

## 回滚

```bash
~/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_RELEASE_ID>
```

回滚只是切换到已验证的不可变 release；持久化账户、课堂和课程库不随静态 release 回退。回滚后必须重新执行健康检查和公共 smoke。
