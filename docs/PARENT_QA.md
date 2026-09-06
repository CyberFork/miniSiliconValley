# Mini Silicon Valley 家长问答知识库

## 产品入口

- 公开页面：`https://minisv.vip/parents/`
- 同源服务端 API：`POST /api/qa`
- 模型：DeepSeek，默认 `deepseek-v4-flash`

浏览器只向本站 API 发送问题。DeepSeek API Key 只存在 Hecate 服务器的受限环境文件中，不进入 HTML、JavaScript 产物、Git 或响应数据。

## 知识链路

```text
家长问题
  ↓ 输入校验／同源检查／限频
本地中文检索
  ↓ 选出最相关的课程事实
DeepSeek Chat Completions
  ↓ 只允许根据检索资料组织答复
答案 + [资料n] 标注 + 公开来源卡
  ↓ 若任一部分没有资料依据
脱敏后写入“待 DM／导师审核”清单
```

结构化知识位于 `app/data/parent-qa-knowledge.ts`，主要来源是：

- `README.md`
- `docs/CURRICULUM_OUTLINE.md`
- `docs/DM_MENTOR_MANUAL.md`
- `docs/FACILITATOR_GUIDE.md`
- `docs/GAMEIFIED_COURSE_BUILD_V3.md`
- `docs/GAME_DESIGN.md`
- `docs/AUTHENTICATION.md`
- `docs/PARENT_QA_CURATED_FACTS.md`（仅限课程负责人、DM 或导师人工确认的补充事实）

检索与模型约束位于 `app/lib/parent-qa.ts`，独立本地服务位于 `services/parent-qa/server.ts`。该服务与账户／课堂 Worker 分离，只监听回环地址 `127.0.0.1:18789`。

## 不可推断的运营信息

当前知识源没有可验证的以下信息：

- 价格、优惠、付款和退费规则；
- 当期开课日期、每周频次和报名截止日；
- 线下地点、剩余名额和录取承诺。

对这些问题，助手必须说明“当前资料还不能确认”，并请家长向课程团队确认，不得猜测。

## 待补充清单：只记录，不自动入库

当模型确认问题的全部或部分内容没有课程资料依据时，服务会把**问题本身**脱敏后追加到：

```text
~/Services/msv-parent-qa/data/knowledge-gaps.ndjson
```

- 每行是一条 JSON 记录；新缺口状态为 `pending_dm_review`，相同问题使用相同的 `gap_...` 标识，便于按出现次数汇总。
- 人工复核后可显式更新为 `resolved_already_covered`、`resolved_added_to_knowledge` 或 `dismissed_out_of_scope`，同时保留复核人、时间和说明；模型无权更改审核状态。
- 只记录脱敏后的当前问题、时间、所用模型和已检索资料 ID；不记录对话历史、IP、User-Agent、模型答案或 API Key。
- 邮箱、手机号、证件号以及显式填写的姓名等信息会在落盘前隐藏。
- 数据目录权限为 `0700`，清单文件权限为 `0600`。
- 记录失败不会把未经审核的内容写进知识库，也不会改变现有课程事实。

该清单**绝不会被问答检索器自动读取，也不会自动晋升为知识**。补充流程必须由人完成：

1. DM／导师按清单确认问题是否属于课程范围，并合并同类项；
2. DM／导师提供可核对的正式资料与来源，不采用模型自行生成的事实；
3. 维护者把已核实内容更新到课程源文档和 `app/data/parent-qa-knowledge.ts`，保留来源映射；
4. 复核、测试并发布后，才视为正式入库。

服务器上可用以下命令按问题汇总清单：

```bash
jq -s 'sort_by(.id) | group_by(.id) | map(select(.[-1].reviewStatus == "pending_dm_review") | {id: .[0].id, question: .[0].question, occurrences: length, lastObservedAt: .[-1].observedAt, reviewStatus: .[-1].reviewStatus})' \
  ~/Services/msv-parent-qa/data/knowledge-gaps.ndjson
```

## 隐私与成本边界

- 页面明示提醒家长不要输入孩子的真实姓名、电话、学校或住址。
- API 限制单题 600 字、最多 6 条短对话历史和 12 KB 请求体。
- Worker 做本地窗口限频；Nginx 对计费问答端点另设独立 IP 限频区。
- 回答不返回 DeepSeek 推理内容、API Key 或内部文件路径。
- 未覆盖问题只进入人工审核清单，不会自动写入课程知识库。
- 服务端请求有 50 秒超时，Nginx 保留 65 秒上游时间。

## 服务器密钥配置

远端文件：

```text
~/Services/msv-parent-qa/secrets/deepseek.env
```

权限必须为 `0600`，内容格式：

```dotenv
DEEPSEEK_API_KEY=<server-only-secret>
DEEPSEEK_MODEL=deepseek-v4-flash
```

launchd 通过非秘密的 `QA_ENV_FILE` 路径让 Node 服务读取该文件。更换 release 时不移动密钥文件。
launchd 另用 `QA_KNOWLEDGE_GAP_FILE` 指向 release 之外的持久数据目录；更换 release 时不得删除该清单。

## 发布与验收

1. 运行 `npm run test:parent-qa` 与整站 `npm run test:release`。
2. 运行 `npm run build:parent-qa` 生成无外部依赖的 `dist/parent-qa/server.mjs`。
3. 发布 `com.cyberforker.msv-parent-qa` launchd 服务，确保它指向持久的 `deepseek.env`。
4. 使用 `deploy/minisv/gateway/default.conf` 中的 `/api/qa` 独立限频与 loopback upstream；先 `nginx -t` 再原子切换整站 release。
5. 运行 `npm run build:minisv-static`，由 `deploy/minisv/package_release.py` 把 `/parents/`、共享 `_next/` 和服务产物纳入同一 Hecate release；禁止手工增量覆盖生产目录。
6. 验证：
   - `GET /parents/` 为 200；
   - `GET /api/qa` 显示 `ready`；
   - 提问“这门课适合多大的孩子？”，回答包含来源标注；
   - 提问价格或排期，回答不猜测；
   - 提问知识库未覆盖的信息，API 返回 `knowledgeGap: true`、页面显示“已加入待补充清单”，并在服务器生成 `pending_dm_review` 记录；
   - 页面源码和静态产物中不含 `DEEPSEEK_API_KEY` 或 `sk-` 密钥。
