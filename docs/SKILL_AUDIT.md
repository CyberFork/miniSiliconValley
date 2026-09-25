# Agentskill 审核记录（SKILL_AUDIT）

## 考察范围
课程站点文档与开发体验中曾考虑的社区技能（community skills）：
1. `frontend-design`
2. `game-development`
3. `web-design-guidelines`
4. `lint-and-validate`

## 审核结论
未安装以上社区技能的原因：
- 已有官方/内置可复用能力：`Sites`、`imagegen`、`browser`、`technical-writer`。
- 避免供应链重复：同类模板和校验行为可通过已内置能力覆盖。
- 本任务是完整的历史数据、游戏交互、视觉资产、测试和发布工程；内置能力已经覆盖全部生产环节，未出现社区技能独占性优势。

## 实际采用

- `Sites`：搭建并发布独立 Web 产品。
- `imagegen`：生成同机位、无商标与文字的原创等距像素地图底图。
- `browser` / Web 检索：核验官方史料、现行页面和公开部署。
- `technical-writer` 方法：编写导师手册、架构、数据、测试与部署文档。
- 本地 TypeScript、ESLint、Node Test Runner 与 Vinext 构建：替代来源不明的第三方校验自动化。

## 参考链接（按用户要求记录）
- For Developers：`https://agentskill.sh/for/game-developer`
- frontend-design 插件页：`https://agentskill.sh/plugins/duyet/frontend-design`
- 平台总入口：`https://agentskill.sh/readme`

## 风险与后续
- 若未来引入外包交互组件或自动化课堂评测，建议再次评估 `game-development` 与 `lint-and-validate`。
- 若出现可视化规范争议，可考虑按需临时启用 `web-design-guidelines`。
