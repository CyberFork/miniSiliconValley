# Mini Silicon Valley 协作课堂运维手册

> 正式入口：<https://minisv.vip/classroom/>
> 运行位置：Hecate；公网经 Cloudflare Tunnel 到本机回环网关。
> 完整整站运维见 [`deploy/minisv/docs/OPERATIONS.md`](../deploy/minisv/docs/OPERATIONS.md)。

## 1. 服务拓扑

```text
Cloudflare Tunnel
  → 127.0.0.1:18780  minisv-gateway (Nginx)
      ├─ 静态站点 current/site
      ├─ 127.0.0.1:18787  Classroom Worker/Vinext
      ├─ 127.0.0.1:18789  Parent Q&A
      ├─ 127.0.0.1:18790  LIVE RUN controller
      └─ 127.0.0.1:18791  Alpha remote console
```

正式课堂的数据存于 Hecate 上由 Wrangler/workerd 提供的持久化 D1-compatible SQLite（逻辑绑定名仍为 `DB`，数据目录在 release 之外的 `~/Services/msv-classroom/data`）；Course Registry 以不可变 `courseId + revision + digest` 保存 Candidate／Released。Hecate 文件 Registry 为编辑器、Alpha 与 Workshop 快照服务，不是学员数据存储。

## 2. 日常健康检查

```bash
ssh hecate-work
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

launchctl print gui/$(id -u)/com.cyberforker.msv-classroom | grep -E 'state =|runs =|pid =|last exit code'
launchctl print gui/$(id -u)/com.cyberforker.msv-parent-qa | grep -E 'state =|runs =|pid =|last exit code'
launchctl print gui/$(id -u)/com.minisv.live-run-controller | grep -E 'state =|runs =|pid =|last exit code'
launchctl print gui/$(id -u)/com.minisv.remote-console | grep -E 'state =|runs =|pid =|last exit code'
/usr/local/bin/docker inspect --format 'gateway={{.State.Status}} health={{.State.Health.Status}}' minisv-gateway
/usr/local/bin/docker exec minisv-gateway nginx -t
$HOME/Services/minisv/current/ops/scripts/healthcheck-hecate.sh
```

公网只读检查：

```bash
python3 $HOME/Services/minisv/current/ops/scripts/public-smoke.py --base https://minisv.vip
curl -fsS https://minisv.vip/healthz
curl -fsS https://minisv.vip/release.json
```

预期：四个 launchd 服务为 `running`，网关 `running/healthy`，未登录课堂 API 返回 401，公网 `/api/internal/*` 返回 404。

## 3. 账号与课堂

- 学员自行注册，公开注册只能创建 `learner`。
- `admin`／`mentor` 由受控后台配置，不能通过公开注册提权。
- 管理员创建课堂后，在“导师控制台 → 授课导师”输入准确用户名指派导师；导师不占 4 个 Young Builder 席位。
- 学员使用 `TEAM-XXXXXXXX` 或入队链接提交申请；批准前没有课堂访问权。
- 忘记密码时，有权限的 DM 为普通账号生成 30 分钟、单次、fragment token 重置 URL，并只私发本人；服务端只存摘要。
- 密码、Cookie、重置 URL、service key 和 Tunnel credential 不进入群聊、截图、日志、回执或 Git。

## 4. Course Package 发布链

```text
编辑器 Working Copy
  → 保存：不可变 Candidate revision/digest
  → Alpha 显式“全部刷新”
  → 13 Block 逐块人工验收
  → exact approval
  → 发布：原子推进 Released 指针
  → 新课堂创建时绑定 exact Released
```

已经创建的正式课堂保持原 exact revision，不随新发布静默变化。Alpha 刷新与重置不同：刷新保留 Run ID、成员、进度、提交、RP、钱包、团队资金和仍存在的稳定手牌。

发布操作、失败补偿和 D1 迁移步骤见 [`COURSE_REGISTRY_RELEASE_SOP.md`](COURSE_REGISTRY_RELEASE_SOP.md)。Workshop Released 快照见 [`WORKSHOP_RELEASED_BASELINE_SOP.md`](WORKSHOP_RELEASED_BASELINE_SOP.md)。

## 5. 发布与回滚

本地必须先通过：

```bash
npm ci
npm run test:release
npm run test:parent-qa
python3 -m unittest discover -s tools/live-run/tests -p 'test_*.py'
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
```

整站 release 必须同时包含：主应用、同事 `/course/` 原样产物、Framework、Workshop、Alpha／Control、运维文件和 `release.json`。使用 `deploy/minisv/scripts/deploy-hecate.sh` 原子切换 `current`；失败自动保留旧版可用。回滚只指向已通过 manifest 校验的已知良好 release：

```bash
$HOME/Services/minisv/current/ops/scripts/rollback-hecate.sh <KNOWN_GOOD_RELEASE_ID>
```

## 6. 故障定位

- **页面 404**：先检查 `release.json` 与 gateway `try_files`，不要通过复制一份页面制造第二入口。
- **课堂 401／403**：区分未登录、RBAC、导师指派、pending 入队和 active membership；不要重建账号掩盖授权问题。
- **编辑器 409**：Working Copy 基于旧 revision；重新加载差异后另存新 Candidate，不能覆盖历史版本。
- **Alpha 未更新**：保存只产生 Candidate；在主控明确执行“全部刷新 Alpha”。
- **正式课堂仍是旧课件**：这是已建课堂 exact 绑定的预期行为；新建课堂验证新 Released，不得静默换版。
- **Q&A 503**：检查 Parent Q&A launchd 与受控密钥环境；不要把密钥写进静态产物。
- **网关异常**：先运行 `nginx -t`、loopback health 和公网 smoke；不要靠反复重启替代根因检查。

## 7. 数据与审计

- D1 迁移先备份、后 apply、再执行真实接口冒烟；迁移不可删除历史课堂或审计流水。
- 文件 Registry 目录保持 `0700`，JSON 与密钥 `0600`。
- 每次发布记录 Git SHA、Course Package exact refs、同事课程提交／树哈希、Workshop snapshot digest、公开 URL 结果与回滚目标。
- 不在发布脚本中修改同事 `/course/` 内容；必须从固定提交构建并验证 `transformed=false` 和整树摘要。
