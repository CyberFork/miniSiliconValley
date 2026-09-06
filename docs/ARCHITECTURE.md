# 架构说明（ARCHITECTURE）

## 一、系统结构
- **前端框架**：React + Next App Router，使用 `vinext` 进行构建。
- **核心展示**：
  - 世界地图/时间轴/节点浏览：`app/components/WorldApp.tsx`
  - 历史世界顶部栏：真实链接 `/course/`
  - 课程大纲子站：同事仓库 `CyberFork/minisv@679213a…` 的原样构建产物，由发布管线挂载，不在 main 中复制组件或文案
  - 旧六段素材索引：`app/components/CurriculumOutline.tsx`（不再拥有公开入口，仅保留兼容资料）
  - 关卡交互：`app/components/MissionPlayer.tsx`
  - 学员档案页：`app/components/WorldApp.tsx` 内的 `Dossier`
  - DM 手册：`app/components/MentorGuide.tsx`
- **历史世界数据层**：以 TypeScript 常量导出为主。
- **正式课件数据层**：`tools/live-run/*.json` 的 Course Package v1；`CourseRepository` 管理草稿、发布版与不可变历史。
- **持久化**：历史世界使用 `localStorage`；课堂、账号、Course Package 与 LIVE RUN 使用 Hecate 上的服务数据目录。

## 二、数据流
- `app/data/history.ts`
  - 导出 `historyCatalog`。
  - 包含时代、地点、机构、人物、技术、来源、事件。
- `app/data/missions.ts`
  - 导出 `missions`，按 `order` 表示 8 个课程关卡。
- `app/data/curriculum.ts`
  - 导出 `curriculumCatalog`，包括项目六步、18 个纵向历史案例、企业全流程和内容归集协议。
  - 只保存教学组织和史实外键；事实正文仍由 `historyCatalog.events` 提供，避免复制后漂移。
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
- **COLLEAGUE COURSE SITE**：`/course/` 是固定 chj 提交的独立、不可变构建产物；main 只提供入口和托管，不改写其课程结构。
- **LEGACY CURRICULUM MAPPING**：旧六段素材索引仍可供内部参考，但不再拥有公开课程入口。
- 课程 UI 中明确标注该边界：
  - Event 卡片 `EventDetail` 标注 `ORIGINAL TIMELINE`
  - 关卡结果页标注 `PARALLEL WORLD`
  - 档案页标注 `ORIGINAL ≠ PLAYER`

## 五、校验与质量闸
- `app/lib/validate.ts`
  - `validateCatalog`：校验实体 ID 唯一性、外键完整性、坐标范围、年份范围、基础数据量阈值。
  - `validateMissions`：校验每关卡证据/路径/复盘/现实任务等完整性。
  - `validateCurriculum`：校验六步顺序、案例数量、企业流程完整性、史实/战役外键和八项归集字段。
- `npm run validate:data` 在命令行运行三类校验；`npm test` 还覆盖类型、静态规则、生产构建、存档安全和服务端渲染。

## 六、关键路径和组件责任
- **时间轴播放/筛选**：`WorldApp` 的查询、标签筛选、时间变更。
- **事件详情**：点击地图或列表 -> `EventDetail`。
- **关卡入口**：地图高亮节点 -> `launchMission` -> `MissionPlayer`。
- **课程目录**：顶栏真实链接 `/course/` -> 进入同事原版课程首页和课程大纲；其内部导航、章节结构和文案保持源提交行为。
- **世界线归档**：`Dossier`（成绩、反思、现实承诺、导入导出）。
- **DM 辅助**：`MentorGuide` 与页面内 runbook/protocol。

## 七、地图渲染与交互
- 4 张同尺寸 WebP 是不同建设时代的同一相机位，`mapLayerOpacity` 按年份插值交叉渐变。
- 史实热点坐标来自 `PlaceRecord`，仅在事件年份到达后出现；全球中心用 `portal` 节点表示。
- 地图支持指针拖动、滚轮、双指缩放、按钮缩放与归位；进入关卡前保存年份和地图视口，关闭后恢复。

## 八、部署入口
- `app/page.tsx` 渲染历史世界；`scripts/build-minisv-static.ts` 只导出 `/world/`。
- `deploy/minisv/scripts/build-chj-course.sh` 校验 chj HEAD、Git tree 和干净工作树，再用环境变量构建 `/course/`；整个课程产物在 main 的路径重写和主题注入完成后才按字节复制。
- `.openai/hosting.json` 仅保存 Sites `project_id` 与可选逻辑绑定，不保存凭据。
- 该站点不需要 D1/R2；生产包由 Vinext 输出 Cloudflare Workers 兼容的 `dist/server/index.js`。
