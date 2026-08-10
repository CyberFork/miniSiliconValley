# 架构说明（ARCHITECTURE）

## 一、系统结构
- **前端框架**：React + Next App Router，使用 `vinext` 进行构建。
- **核心展示**：
  - 世界地图/时间轴/节点浏览：`app/components/WorldApp.tsx`
  - 关卡交互：`app/components/MissionPlayer.tsx`
  - 学员档案页：`app/components/WorldApp.tsx` 内的 `Dossier`
  - DM 手册：`app/components/MentorGuide.tsx`
- **数据层**：以 TypeScript 常量导出为主，不使用运行时后端数据库。
- **持久化**：`localStorage` + JSON 文件导入导出（见下）。

## 二、数据流
- `app/data/history.ts`
  - 导出 `historyCatalog`。
  - 包含时代、地点、机构、人物、技术、来源、事件。
- `app/data/missions.ts`
  - 导出 `missions`，按 `order` 表示 8 个课程关卡。
- `WorldApp` 渲染时从 `historyCatalog` + `missions` 建立索引 Map。
- 用户动作只更新前端 `PlayerState`，在状态变更后通过 `serializeState` 写入 `localStorage`。

## 三、状态与安全边界
- 当前状态入口：`app/lib/state.ts`
- 关键常量：
  - `STORAGE_KEY = "msv-world-state-v1"`
  - `CHECKPOINT_KEY = "msv-world-checkpoint-v1"`
  - `MAX_IMPORT_BYTES = 2 * 1024 * 1024`
- 资源字段：`evidence / trust / runway / craft`（0~9，`clampResource` 保底）。
- 解析安全：`parseState` 做 schema、数值、字符串长度和数组类型防护。

## 四、时间线两层分离
- **ORIGINAL TIMELINE**：由 `historyCatalog.events` 与 `sources` 提供，不允许被游戏世界线覆盖。
- **PLAYER TIMELINE**：保存在 `results`，由 `MissionPlayer` 决策与 `applyChoice` 生成。
- 课程 UI 中明确标注该边界：
  - Event 卡片 `EventDetail` 标注 `ORIGINAL TIMELINE`
  - 关卡结果页标注 `PARALLEL WORLD`
  - 档案页标注 `ORIGINAL ≠ PLAYER`

## 五、校验与质量闸
- `app/lib/validate.ts`
  - `validateCatalog`：校验实体 ID 唯一性、外键完整性、坐标范围、年份范围、基础数据量阈值。
  - `validateMissions`：校验每关卡证据/路径/复盘/现实任务等完整性。
- `npm run validate:data` 在命令行运行两类校验；`npm test` 还覆盖类型、静态规则、生产构建、存档安全和服务端渲染。

## 六、关键路径和组件责任
- **时间轴播放/筛选**：`WorldApp` 的查询、标签筛选、时间变更。
- **事件详情**：点击地图或列表 -> `EventDetail`。
- **关卡入口**：地图高亮节点 -> `launchMission` -> `MissionPlayer`。
- **世界线归档**：`Dossier`（成绩、反思、现实承诺、导入导出）。
- **DM 辅助**：`MentorGuide` 与页面内 runbook/protocol。

## 七、地图渲染与交互
- 4 张同尺寸 WebP 是不同建设时代的同一相机位，`mapLayerOpacity` 按年份插值交叉渐变。
- 史实热点坐标来自 `PlaceRecord`，仅在事件年份到达后出现；全球中心用 `portal` 节点表示。
- 地图支持指针拖动、滚轮、双指缩放、按钮缩放与归位；进入关卡前保存年份和地图视口，关闭后恢复。

## 八、部署入口
- `app/page.tsx` 直接渲染 `WorldApp`，无 Starter/占位入口。
- `.openai/hosting.json` 仅保存 Sites `project_id` 与可选逻辑绑定，不保存凭据。
- 该站点不需要 D1/R2；生产包由 Vinext 输出 Cloudflare Workers 兼容的 `dist/server/index.js`。
