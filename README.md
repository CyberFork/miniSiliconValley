# Mini Silicon Valley · 科技史世界线 RPG

> 开放世界是地图，RPG 是身份，历史情境是关卡，真实创业是主线。

面向青少年的、由可核验科技史驱动的有限开放世界创业学习 RPG。学员以 Young Builder 团队身份进入 1891—2026 年的硅谷与全球科技网络，在当时信息边界内调查、判断、获得规则化平行反馈，再对照真实历史并把能力带回现实项目。

**在线体验：**

- 正式总导航：https://minisv.vip/
- 历史世界：https://minisv.vip/world/
- 课程大纲：https://minisv.vip/course/
- 课堂：https://minisv.vip/classroom/
- Alpha 八席与 LIVE RUN：https://minisv.vip/alpha/ 、https://minisv.vip/control/
- 课程编辑器与 Workshop：https://minisv.vip/control/editor/ 、https://minisv.vip/workshop/

## 可玩内容

- **建设中的地图**：4 幅同构原创像素正交地图在果园/车库、芯片、互联网、AI 时代之间连续变化。
- **可操作时间轴**：拖动、播放/暂停、1×/2×/5×、键盘跳转、领域筛选与跨实体搜索。
- **史实胶囊**：203 个事件均有地点、企业/机构、人物、技术、意义、关系线和可打开来源。
- **课程语义**：一世界、两条双轨、三类玩法、四类导师分工、五个学习步骤；Demo Day 为独立终局（六分钟）。详见 [课程语义](docs/COURSE_SEMANTICS.md)。
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
Stage         6       Stage Case    18
Journey       1       Journey Step  6
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

`npm test` 依次执行 TypeScript、ESLint（0 warning）、生产构建和课程、数据、状态、任务引导、世界交互、渲染与品牌契约测试。Hecate 正式发布还必须执行 Classroom、Python、网关、真实浏览器和公网只读冒烟测试。

## 代码地图

- `app/data/history.ts`：史实图谱与来源
- `app/data/missions.ts`：8 个教学战役
- `app/data/curriculum.ts`：课程案例与企业流程（旧版六步资料，仅作兼容索引）
- `app/components/WorldApp.tsx`：地图、时间轴、搜索、档案
- `app/components/CurriculumOutline.tsx`：双轴课程目录与内容归集协议
- `app/components/MissionPlayer.tsx`：六阶段 RPG 循环
- `app/components/MentorGuide.tsx`：在线 DM 手册
- `app/lib/state.ts`：版本化存档、安全导入与重玩规则
- `app/lib/world.ts`：年份、地图层过渡与缩放规则
- `app/lib/public-path.ts`：Sites 根路径与 Work `/msv/` 子路径双构建
- `scripts/build-work-static.ts`：生成可由 Nginx 直接托管的 Work 静态版本
- `app/lib/validate.ts`：外键、唯一性、数量与地理校验
- `app/lib/course-package.ts`、`app/lib/course-registry.ts`：Course Package 与 D1 不可变版本注册表
- `tools/live-run/course.py`：编辑器、Alpha 与发布流程共享的文件课程注册表
- `tools/live-run/workshop_snapshot.py`：从 exact Released 生成 Workshop 公开脱敏快照
- `deploy/minisv/package_release.py`：Hecate 整站原子发布包；保持同事 `/course/` 产物字节不变
- `tests/`：无网络、确定性验收

## 文档

- [架构](docs/ARCHITECTURE.md) · [数据模型](docs/DATA_MODEL.md) · [史料治理](docs/HISTORY_SOURCES.md)
- [课程大纲与归集指南](docs/CURRICULUM_OUTLINE.md) · [游戏设计](docs/GAME_DESIGN.md) · [DM 手册](docs/FACILITATOR_GUIDE.md) · [测试](docs/TESTING.md)
- [课程语义](docs/COURSE_SEMANTICS.md) · [Course Registry 发布 SOP](docs/COURSE_REGISTRY_RELEASE_SOP.md) · [Workshop 基线 SOP](docs/WORKSHOP_RELEASED_BASELINE_SOP.md)
- [品牌资产盘点](docs/BRAND_ASSET_INVENTORY.md)
- [T-073—T-084 生产收口回执](docs/TODO_073_084_PRODUCTION_RECEIPT.md)
- [部署](docs/DEPLOYMENT.md) · [Agentskill 审核](docs/SKILL_AUDIT.md)

## 项目边界

本仓库拥有主站、课程系统、Alpha、Classroom、统一品牌和 Workshop 的**附加 Released 基线层**。Workshop 原有编辑功能继续保留；本仓库不把它变成第二个课程写入口。同事交付的 `/course/` 子站在发布过程中按固定来源原样复制，主项目不得注入、改写或重新设计其 HTML/CSS/资源。
