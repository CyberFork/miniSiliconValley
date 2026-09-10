# T-104｜课程待核对与家长 QA 人工审核闭环

> 状态：工程实现与隔离浏览器回归已完成（2026-09-11）。本文定义“待处理”如何被记录、人工如何处置，以及哪些内容绝不能被自动化流程当作已解决。自动化证据不代替真实 DM／导师的内容或 UI 验收。

## 1. 两类审核对象，两个真值

系统存在两类相似但不可合并的工作对象：

1. **课程内容审核项**：来自 `CourseDefinition.contentPackages.reviewQueue`。它是课程作者在一个不可变课程版本中声明的待核对事项。
2. **家长 QA 知识缺口**：来自 `knowledge-gaps.ndjson`。它记录家长提问中需要 DM/导师确认的缺口。

二者可以在 Studio 的同一“审核工作台”中并列展示，但必须保留不同的 ID、来源、存储、生命周期和权限。课程项不能写入家长 QA NDJSON；家长问题不能伪装成课程项，也不能自动改变课程包或知识库。

## 2. CourseDefinition 审核处置

### 2.1 作者声明不可变

`CourseDefinition.contentPackages.reviewQueue` 随课程版本保存，是作者声明的原始事实；人工审核不得原地修改它。每一项至少由 `courseId + revision + digest + itemId` 精确定位。审核结果写入独立的、追加写入（append-only）的 D1 事件表，并保留事件时间、操作人、序号/幂等键、处置说明及必要的来源引用。

审核读取必须按完整版本指纹查询，不能把相同 `itemId` 从别的 revision 的结果借用过来。

### 2.2 处置语义

处置不是简单的“通过/失败”，至少区分：

- **要求修订（revision-required）**：当前版本仍开放并明确阻断本版发布，要求作者修订课程包；它不表示本项已修复。
- **补充来源（source-added）**：人工确认已补足来源或证据，记录来源引用与说明；该版本的原始声明仍保留，结果可追溯。
- **本次显式排除（excluded-this-release）**：明确说明本次发布范围不处理，并记录理由；它不是“已修复”、不是“全部通过”。

另设**显式 reopen** 事件：只有导师/DM明确执行重新打开时，才可把一个人工终态恢复为待处理；重开状态明确阻断本版发布。未做人工决定的作者 open 项保持醒目但不自动阻断，避免把所有待核对项错误等同为发布失败。重复观察、刷新页面或模型建议都不得隐式 reopen。

### 2.3 并发与重复提交

审核写入使用乐观 `sequence`（或等价版本条件）和幂等键：客户端重复提交同一操作不得产生重复有效处置；过期 sequence 必须返回冲突并要求重新读取，而不是静默覆盖别人的结果。事件流保留完整审计链，最新状态只是由事件折叠得到的投影。

## 3. Studio 审核工作台与权限

Studio 提供独立的审核工作台，不把审核动作埋在普通预览或课堂播放按钮中。工作台应同时显示：对象类型、精确课程版本/问题 ID、当前状态、历史事件、处置说明、操作人和时间。

- **允许**：Primary Admin DM、Delegated Admin DM（按平台既定权限）及被授权导师/DM。
- **禁止**：学员、匿名访问、普通测试身份，以及模型/自动化代理。
- 测试身份只能查看测试数据，不得借此获得生产审核写权限。
- 审核工作台的“已处理”标签必须明确写出具体处置（补充来源/本次排除等），不能只显示绿色“通过”。

## 4. Parent QA 事件模型

`knowledge-gaps.ndjson` 采用追加事件而非覆盖记录，事件类型为：

- `observation`：记录一次经过脱敏的观察；同一 gap 重复出现时只增加观察次数、最后观察时间等统计，不改变人工终态。
- `review`：记录人工处置及操作人、时间、说明；三种终态必须可区分：`resolved_already_covered`（已有覆盖）、`resolved_added_to_knowledge`（已加入知识）、`dismissed_out_of_scope`（超出范围）。
- `reopen`：仅由人工明确发起，说明重新打开原因，并回到待 DM 审核状态。

同一问题的稳定 ID 可以用于聚合，但聚合不能抹掉原始事件。重复 observation 不得把已解决项重新标记 pending；只有显式 reopen 才能重开。完整问题文本必须按既有规则脱敏，不能把对话全文、密钥或个人敏感信息写入事件。

## 5. 写盘失败与健康状态

写盘失败必须向调用方明确返回 `knowledgeGapRecorded: false`，页面明确显示“未能写入待补充清单”，绝不能返回成功或让用户误以为“已记录”。内部健康状态应可供受信任的运营/DM 检查，包括最近失败时间、失败计数、待重试数量和成功/失败时间；错误正文不进入响应或审核日志。

允许保留脱敏的内存重试队列，但它不是持久化成功证明：服务重启会丢失内存项，界面必须标注“待显式重试/尚未写入”。重试只能由明确的内部动作触发并再次确认结果；成功后才可返回/展示已记录。详细健康状态和重试动作只位于 loopback 服务的 Bearer-token 内部端点，再由已登录 Studio 服务端代理；公开 `/health` 只显示服务与记录器是否配置，不暴露审核详情。

## 6. 检索与模型边界

`pending_dm_review`、课程 open 项及任何未完成人工处置，永远不得进入静态知识检索、公开课程投影或学员可见上下文。它们只能在受权限保护的审核工作台中显示。

模型可以提出候选分类或建议，但没有审核写入口，不能创建 review/reopen 事件，不能修改 CourseDefinition、知识库或审核投影。任何模型建议都必须等待人工确认后才成为事件。

## 7. 自动化测试与人工验收边界

自动化测试只能使用合成数据或已脱敏夹具，覆盖以下检查：

- 相同 QA gap 的重复 observation 会累计但保留人工终态；只有显式 reopen 才回到 pending。
- 三种人工终态可区分、可追溯，且不会被后续 observation 覆盖。
- CourseDefinition 原始 reviewQueue 不被修改；处置严格绑定 course/revision/digest/item。
- 乐观 sequence 冲突、幂等重复提交、跨版本错配均会安全失败。
- 写盘失败返回 `knowledgeGapRecorded=false`，健康状态可见，显式重试成功后才改变状态。
- pending 内容不出现在静态检索、公开 DTO、学员视图或模型写接口。
- 学员/测试身份无权执行审核写操作。

自动化通过也不构成人工课程验收、UI 验收或上线证明；发布前仍须由真实 DM/导师按真实课程版本完成审核并留下可追溯回执。每次交付记录只可填写当次实际执行的命令和结果，不能沿用本文件的设计清单冒充通过证据。

## 8. 已落地实现

- `drizzle/0014_human_review_workflows.sql`：exact 课程审核追加事件、复合外键、item 存在性触发器及 UPDATE/DELETE 禁止触发器。
- `app/lib/course-content-review.ts` 与 `/api/studio/content-reviews`：CAS、幂等、跨版本隔离、显式重开及发布阻断判定。
- `/studio/reviews/`：课程审核和家长 QA 两区并列但不混库；完整显示理由、建议、历史、具体处置和来源引用。
- `services/parent-qa/knowledge-gap-store.ts`：兼容 v1 的 v2 observation/review/reopen 事件折叠、写盘健康状态和显式重试。
- `/api/studio/parent-qa-reviews`：登录 Studio 服务端代理；内部 Bearer token 和 loopback 地址不进入浏览器。
- 统一 Hecate bundle：Parent-QA manifest/server 与主应用同 release，两个 LaunchAgent 同时跟随 `minisv/current`；令牌同步器不回显秘密，不一致时在改动运行态前失败关闭。

## 9. 本轮实际测试证据

```text
npm run typecheck                                      PASS
npm run lint                                           PASS
npm run test:course-platform                           157 / 157 PASS
node --import tsx --test tests/parent-qa.test.ts        14 / 14 PASS
python3 -m unittest discover -s deploy/minisv/tests     53 / 53 PASS
npm run build:minisv-app                               PASS
npm run build:parent-qa                                PASS
python3 tools/live-run/tests/verify_t104_human_review_browser.py  PASS
zsh -n deploy/minisv/scripts/deploy-hecate.sh           PASS
zsh -n deploy/minisv/scripts/rollback-hecate.sh         PASS
sh -n deploy/minisv/scripts/healthcheck-hecate.sh       PASS
```

隔离浏览器回归使用临时 D1、合成账号及合成脱敏 QA 事件，实际完成课程处置／显式重开与 QA 处置／显式重开；没有读写生产数据。证据文件：

- `docs/qa/t104-human-review/browser-receipt.json`
- `docs/qa/t104-human-review/human-review-workbench.png`

尚未代签真实 DM／导师内容验收、ViewAcceptanceReceipt 或 UiAcceptanceReceipt；这些仍须在对应 exact Candidate 与 Test Classroom 中由人完成。
