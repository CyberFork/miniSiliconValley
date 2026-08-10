# Mini Silicon Valley · 科技史世界线 RPG

> 开放世界是地图，RPG 是身份，历史情境是关卡，真实创业是主线。

面向青少年的、由可核验科技史驱动的有限开放世界创业学习 RPG。学员以 Young Builder 团队身份进入 1891—2026 年的硅谷与全球科技网络，在当时信息边界内调查、判断、获得规则化平行反馈，再对照真实历史并把能力带回现实项目。

**在线体验：**

- Sites 正式版：https://mini-silicon-valley-rpg.cyberforker.chatgpt.site
- Work 演示版：https://work.cyberforker.com/msv/demo.html

## 可玩内容

- **建设中的地图**：4 幅同构原创像素正交地图在果园/车库、芯片、互联网、AI 时代之间连续变化。
- **可操作时间轴**：拖动、播放/暂停、1×/2×/5×、键盘跳转、领域筛选与跨实体搜索。
- **史实胶囊**：203 个事件均有地点、企业/机构、人物、技术、意义、关系线和可打开来源。
- **8 场历史战役**：车库第一单、仙童出走、Homebrew、Mosaic、Google、iPhone、AWS、OpenAI。
- **完整学习环**：入场 → 调查 → 决策 → 平行反馈 → 史实对照 → 现实任务。
- **学习档案**：资源、选择、证据、复盘与现实承诺；支持自动保存、检查点、导入/导出、打印。
- **DM 手册**：15 分钟演示与 90 分钟完整课堂，含信息差、裁决、复盘、未成年人安全和断网恢复。

## 数据快照

```text
Era           8       Place         34
Organization  74      Person        51
Technology    75      Source        66
Event         203     Mission       8
```

`ORIGINAL TIMELINE` 是只读史实底座；`PLAYER TIMELINE` 仅保存玩家选择和模拟结果。两者在数据、界面和存档中分离。

## 本地运行

```bash
npm ci
npm run dev
```

生产质量闸：

```bash
npm run validate:data
npm test
```

`npm test` 依次执行 TypeScript、ESLint（0 warning）、生产构建和 19 项数据、状态、世界交互契约、响应式、渲染与资源测试。部署到 `/msv/demo.html` 前执行 `npm run test:work`，额外验证子路径构建、静态清单与文件哈希，共 21 项。

## 代码地图

- `app/data/history.ts`：史实图谱与来源
- `app/data/missions.ts`：8 个教学战役
- `app/components/WorldApp.tsx`：地图、时间轴、搜索、档案
- `app/components/MissionPlayer.tsx`：六阶段 RPG 循环
- `app/components/MentorGuide.tsx`：在线 DM 手册
- `app/lib/state.ts`：版本化存档、安全导入与重玩规则
- `app/lib/world.ts`：年份、地图层过渡与缩放规则
- `app/lib/public-path.ts`：Sites 根路径与 Work `/msv/` 子路径双构建
- `scripts/build-work-static.ts`：生成可由 Nginx 直接托管的 Work 静态版本
- `app/lib/validate.ts`：外键、唯一性、数量与地理校验
- `tests/`：无网络、确定性验收

## 文档

- [架构](docs/ARCHITECTURE.md) · [数据模型](docs/DATA_MODEL.md) · [史料治理](docs/HISTORY_SOURCES.md)
- [游戏设计](docs/GAME_DESIGN.md) · [DM 手册](docs/FACILITATOR_GUIDE.md) · [测试](docs/TESTING.md)
- [部署](docs/DEPLOYMENT.md) · [Agentskill 审核](docs/SKILL_AUDIT.md)

## 项目边界

该目录是新的独立游戏站点，不覆盖已有 `mini_silicon_valley_workshop/` 课程设计工坊与其 `/msv/launch.html` 入口。
