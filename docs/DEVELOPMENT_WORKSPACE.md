# MiniSV 唯一开发工程与发布来源

## 唯一真值

```text
稳定工作目录  AI教培-mini硅谷/dev
唯一 Git 远端 https://github.com/CyberFork/miniSiliconValley.git
生产主机      Hecate
生产域名      https://minisv.vip
```

T-098 之前，`dev` 指向与现行平台无共同 Git 历史的旧 `CyberFork/minisv` 工程，而生产实现只存在 `/private/tmp/minisv-sequence-work.axC0Th/repo` 及 `CyberFork/miniSiliconValley` 远端。现已将稳定 `dev` 切换为该唯一远端的完整检出。

## 路径边界

- `dev/`：业务源码、迁移、测试、运维脚本、已纳管课件 manifest 与正式文档。
- `cowork/`：同事原始素材和作者交付；只有经过完整性校验、产生不可变 CoursewarePackage 后才进入运行时。
- `/private/tmp/`：临时 checkout、测试库、site 组装和 bundle；可丢弃，不是开发真值。
- Hecate `~/Services/minisv/releases/`：不可变发布包；`current` 只能原子指向其中一份。
- Hecate `~/Services/msv-classroom/data`：运行数据，始终在 release 外。
- Hecate `~/Services/minisv/secrets`：账号和 Tunnel 机密，不进入 Git、bundle 或回执。

## 旧工程保全

旧工程已整体保留为同级目录：

```text
dev-legacy-minisv-dd28a57-20260910/
```

它保留 `dd28a57`、旧远端、已跟踪文件、未提交内容和完整 `.git`；根目录的 `.MINISV_WORKSPACE_RETIRED` 与 `README-RETIRED-WORKSPACE.md` 明确禁止从该目录构建或发布。没有删除、`reset --hard` 或覆盖旧树。

旧树的 `npm run dev/build/build:work/start`、`package_release.py` 和 `deploy-hecate.sh` 也均在任何实际构建或部署前以 `MINISV_RETIRED_WORKSPACE` 失败关闭，并指向唯一工程与远端。标记不只是文档提示。

旧 `.codex/inbox` 的 38 份 Todo 和 7 份脱敏审计证据已逐文件校验后进入新 `dev`。两份与当前真值不同的旧架构文档没有覆盖新版，而是原样放在 `docs/archive/t098-legacy-dev-dd28a57/`。每个文件的摘要见 `TODO_098_PRE_MIGRATION_SNAPSHOT.json`。

## 发布失败关闭

`deploy/minisv/package_release.py` 的 CLI 在写入发布目录前必须证明：

1. 正在 Git 顶层目录执行。
2. `origin` 是唯一远端。
3. `--main-sha` 等于 HEAD。
4. HEAD 等于已获取的 `origin/main`。
5. 无退役标记。
6. 工作树干净，或者显式留下例外原因。

验证结果会写入 `release.json.workspaceProvenance`。`bundle.json` 另外锁定应用构建 ID、应用整树摘要和静态 site 摘要，可与 Git commit 和页面诊断交叉核对。

## 日常操作

```bash
cd "/Users/hecate/Library/CloudStorage/OneDrive-个人/Work/CHJ、DL/AI教培-mini硅谷/dev"
git fetch origin main
git status --short --branch
git rev-parse HEAD origin/main
```

业务开发、测试、commit 和 release 组装均从该目录开始。临时目录只能作为它的可丢弃检出，不能反过来成为源头。
