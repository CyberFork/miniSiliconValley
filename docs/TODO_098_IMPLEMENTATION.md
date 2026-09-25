# T-098 实施记录｜唯一工程与发布来源

## 结果

- `AI教培-mini硅谷/dev` 已是 `CyberFork/miniSiliconValley` `main` 的完整稳定检出，不再依赖 `/private/tmp`。
- 旧 `CyberFork/minisv` 工程整体改名保全，未删除、未 hard reset、未覆盖。
- 38 份 Todo、7 份审计文件及 2 份旧架构文档均以 SHA-256 校验保留。
- 现行架构文档保持 canonical 新版；旧文档只作历史快照，不参与构建。
- 发布 CLI 新增远端、HEAD、`origin/main`、脏树和退役标记门禁；结果进入 `release.json`。
- 旧树的开发、构建、打包和部署入口已实际接入失败关闭守卫，不是只放一份说明文件。

## 保全映射

```text
旧 dev                      → dev-legacy-minisv-dd28a57-20260910/
旧 .codex/inbox            → 新 dev/.codex/inbox
旧 ARCHITECTURE.md         → docs/archive/t098-legacy-dev-dd28a57/
旧 COURSE_PLATFORM_*.md    → docs/archive/t098-legacy-dev-dd28a57/
现行仓库                  → dev/ + CyberFork/miniSiliconValley
```

机器可读的切换前清单为 [`TODO_098_PRE_MIGRATION_SNAPSHOT.json`](TODO_098_PRE_MIGRATION_SNAPSHOT.json)。

## 验收命令

```bash
git remote get-url origin
git rev-parse HEAD origin/main
git status --short --branch
python3 -m unittest deploy/minisv/tests/test_release_workspace.py
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
npm run test:minisv-app
git diff --check
```

旧树防误用也已分别执行 `npm run build`、`package_release.py --help` 与 `deploy-hecate.sh`；三个入口均在触及构建、发布或生产输入前返回码 2 并输出 `MINISV_RETIRED_WORKSPACE`。

T-099 及后续任务只能在该稳定 `dev` 基线上实施。T-098 不修改生产运行数据，不部署，不清理旧工程或临时目录。
