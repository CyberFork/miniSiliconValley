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

## 待补充清单：追加事件，不自动入库

当模型确认问题的全部或部分内容没有课程资料依据时，服务会把**问题本身**脱敏后追加到：

```text
~/Services/msv-parent-qa/data/knowledge-gaps.ndjson
```

- 每行是一条不可变事件。`observation` 记录一次观察，`review` 记录人工处置，`reopen` 只记录人工显式重开；相同问题使用同一 `gap_...` 标识聚合。
- 新缺口状态为 `pending_dm_review`。重复观察只增加次数和最后观察时间，**不会**把已经人工处理的事项静默重开。
- 人工复核后可明确处置为 `resolved_already_covered`、`resolved_added_to_knowledge` 或 `dismissed_out_of_scope`；只有“显式重新打开”才能恢复为待处理。模型没有审核写入口。
- 只记录脱敏后的当前问题、时间、所用模型和已检索资料 ID；不记录对话历史、IP、User-Agent、模型答案或 API Key。
- 邮箱、手机号、证件号以及显式填写的姓名等信息会在落盘前隐藏。
- 数据目录权限为 `0700`，清单文件权限为 `0600`。
- 记录失败时 API 返回 `knowledgeGapRecorded: false`，页面明确提示“未能写入待补充清单”；内存待重试项不算持久化成功，也不会进入知识库。

该清单**绝不会被问答检索器自动读取，也不会自动晋升为知识**。补充流程必须由人完成：

1. 已登录的 DM／导师进入 Studio「人工审核工作台」：`/studio/reviews/`；
2. 在“家长 QA 知识缺口”区查看脱敏问题、观察次数、最后观察时间和写盘健康状态；
3. 明确选择“已有覆盖”“加入知识”或“超出范围”，填写说明；“加入知识”必须提供可追溯的知识条目或来源标识；
4. 维护者把已核实内容更新到课程源文档和 `app/data/parent-qa-knowledge.ts`，保留来源映射；
5. 复核、测试并发布后，才视为正式入库。需要重新调查时必须点击“显式重新打开”，不能靠刷新或重复提问改变状态。

不建议直接用 `jq` 推导审核状态，因为 v2 状态由 observation/review/reopen 事件折叠得到，且需要同时考虑旧 v1 记录。受信任维护者应使用 Studio 工作台或受令牌保护的 loopback 内部端点；公开 `/health` 不暴露问题详情、失败计数或重试队列。

两个审核队列必须保持独立：

- `CourseDefinition.contentPackages.reviewQueue` 是 exact 课程版本的作者声明，人工处置写入 D1 的追加事件表；
- `knowledge-gaps.ndjson` 是家长 QA 的脱敏知识缺口事件流。

它们可以在同一工作台展示，但不能相互写入、自动合并或进入公开检索。完整语义见 [T-104 实施说明](TODO_104_IMPLEMENTATION.md)。

仅用于离线事件取证时，可以逐行查看原始事件；不得把以下示例当作权威状态计算：

```bash
jq -c 'select(.schema == "msv-parent-qa-knowledge-gap-event-v2") | {eventType, gapId, observedAt, reviewedAt, reopenedAt}' \
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
QA_INTERNAL_REVIEW_TOKEN=<至少 24 字节的随机 server-only-secret>
```

launchd 通过非秘密的 `QA_ENV_FILE` 路径让 Node 服务读取该文件。更换 release 时不移动密钥文件。
launchd 另用 `QA_KNOWLEDGE_GAP_FILE` 指向 release 之外的持久数据目录；更换 release 时不得删除该清单。

同一 `QA_INTERNAL_REVIEW_TOKEN` 还必须存在于主应用的受限环境文件中，供 `/api/studio/parent-qa-reviews` 服务端代理调用 loopback QA 服务。部署脚本应原子校验两处配置一致；令牌永远不能进入浏览器 bundle、HTML、API 响应或 Git。

内部审核接口固定为 `http://127.0.0.1:18789/internal/knowledge-gaps`。主应用代理拒绝非 loopback URL，外部 Nginx 不暴露该路径。

## 发布与验收

1. 运行 `npm run test:parent-qa` 与整站 `npm run test:release`。
2. 运行 `npm run build:parent-qa` 生成无外部依赖的 `dist/parent-qa/server.mjs`。
3. 发布 `com.cyberforker.msv-parent-qa` launchd 服务，确保它指向持久的 `deepseek.env`。
4. 使用 `deploy/minisv/gateway/default.conf` 中的 `/api/qa` 独立限频与 loopback upstream；先 `nginx -t` 再原子切换整站 release。
5. 运行 `npm run build:minisv-static` 生成 `/parents/` 和共享 `_next/`，再由 `deploy/minisv/package_bundle.py` 把静态站、主应用及 `dist/parent-qa/` 纳入同一 Hecate release；禁止手工增量覆盖生产目录。
6. 验证：
   - `GET /parents/` 为 200；
   - `GET /api/qa` 显示 `ready`；
   - 提问“这门课适合多大的孩子？”，回答包含来源标注；
   - 提问价格或排期，回答不猜测；
   - 提问知识库未覆盖的信息，写盘成功时 API 返回 `knowledgeGap: true`、`knowledgeGapRecorded: true`，并生成 v2 `observation` 事件；注入写盘失败时必须返回 `knowledgeGapRecorded: false`，页面不得声称已记录；
   - Studio `/studio/reviews/` 能区分课程审核项与 QA 缺口，三种处置和显式重开均可追溯；重复 observation 不覆盖人工终态；
   - 匿名、学员和普通测试身份不能读取或写入审核工作台；浏览器无法获得内部令牌；
   - 页面源码和静态产物中不含 `DEEPSEEK_API_KEY` 或 `sk-` 密钥。
