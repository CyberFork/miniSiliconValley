# 历史来源与引用治理（HISTORY_SOURCES）

## 1) 来源模型
- 来源记录类型：`SourceRecord`
- 必填字段：`id / title / organization / url / kind`
- 额外字段：`accessed`（当前为 `2026-08-10`）与 `note`
- 来源 `kind` 枚举：`university / company-history / government / research-paper / official-archive / museum / standards-body`

## 2) 当前数据规模
- `SourceRecord` 总量：`66`
- 来源 URL 统一为 HTTPS（通过 `validateCatalog` 强校验）。

## 3) 如何分离事实与模拟
- Original Timeline（`EventDetail`、事件卡）只展示 `sources`、`significance`、`organizationIds` 等。
- Player Timeline 仅记录玩家选择与结果，不回写 `sources`。
- `MissionHistory` 对照区给出“可核验史实摘要 + 来源链接”，但不把该摘要作为世界线规则。

## 4) 来源更新流程（建议）
1. 新增来源时先补齐 `id/title/organization/url/kind/accessed`。
2. 将来源 ID 回填到：
   - `history.ts` 中相关 `event` 的 `sourceIds`
   - 需要的 `mission.evidence[].sourceIds`、`mission.history.sourceIds`
3. 运行 `npm run validate:data`，确认不出现 ID 失配、无来源事件或数量倒退。
4. 在变更摘要中记录：新增来源、变更事件、影响任务编号。
5. 导出一份来源变更日志（例如在 PR 描述或课程发布记录）。

## 5) 来源质量要求（课程使用）
- 原则：每条史实必须可追溯。
- 每个史实事件至少 1 条来源；每个任务证据建议来自 2 条以上来源。
- 证据不能由任务编造文本替代；若缺来源应降级为“推演场景”而非“史实断言”。

## 6) 已有来源分布与风险点
- 来源覆盖时间跨度：`1891-2026`
- 典型高风险字段：
  - 近年财务/融资/产品里程碑（变化频繁）
  - 年度运行数据（如量化数值）
- 处理方式：在事件字段 `caveat` 里注明口径差异，保留 `certainty`。

## 7) 2026-08-10 链接实测

对 66 个来源执行了跟随跳转的 HEAD/GET 审计：

- 58 个由审计客户端直接返回成功。
- 7 个 OpenAI 官方页对自动客户端返回 403，已用搜索索引/浏览器结果确认页面存在；这是机器人访问策略，不是死链。
- 1 个深圳市政府页在 Python TLS 客户端出现证书曲线兼容错误，但已通过浏览器索引确认正文和 1985 年时间点。

审计中发现的 Android、GitHub、NASA Ames、SRI、TensorFlow 旧路径均已替换为可用的官方页；ChatGPT 来源改为 2022-11-30 的原始发布页，Waymo 2026 城市扩展改为对应日期的具体文章。
