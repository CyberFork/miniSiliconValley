# 游戏设计说明（GAME_DESIGN）

## 产品定义

**Mini Silicon Valley = 真实科技史驱动的有限开放世界创业 RPG。**

- 开放世界提供时代、地理、企业、人物、技术和任务地图。
- RPG 提供 Young Builder 身份、团队分工、资源和持续成长。
- 历史情境关卡使用信息差、角色目标、证据紧张和关键判断。
- 现实创业任务是主线，Demo Day 是产品发布会式结局，不是试卷。

## 调研到机制的映射

### Reacting to the Past（历史角色游戏）

参考 [Reacting to the Past](https://reacting.barnard.edu/) 的角色沉浸、多目标与学员主导讨论，但不让学员假冒历史人物私密发言。本系统改造为：

- 使用“历史团队成员/合作者”角色，而非伪造本人台词。
- DM 只维护信息边界和裁决规则，不公布“正确选项”。
- 玩家决策后才解锁史料溯源和真实历史，防止后见之明。

### MDA（Mechanics → Dynamics → Aesthetics）

参考 [MDA Framework](https://www.cs.northwestern.edu/~hunicke/MDA.pdf)：

- **Mechanics**：年份、证据夹、前置证据锁、三条路径、四类资源、检查点。
- **Dynamics**：团队交换不完整信息、辩护依据、承担取舍、比较不同世界线。
- **Aesthetics**：参与历史的代入感、建造感、发现感与团队掌控感，而不是单纯积分刺激。

### LM–GM（学习机制↔游戏机制）

参考 [LM–GM Framework](https://seriousgamessociety.files.wordpress.com/2016/09/lmgm_framework.pdf)：

```text
学习机制          游戏机制
识别关键信息      证据卡收集与紧张对照
建立假设          三条可辩护路径
因果推理          资源变化与约束结果
反思与迁移        Original/Player 差异问题
实践与反馈        现实时盒任务与验收条件
```

Twine 和 [Ink](https://github.com/inkle/ink) 被用作分支叙事的调研参照；当前版本将规则写成强类型 `MissionRecord`，便于史料外键校验、教学审阅与自动测试，而不引入不可审计的运行时自由生成。

## 核心概念
- **ORIGINAL TIMELINE（原始时间线）**：
  - 由 `historyCatalog.events` 提供
  - 可核验来源支撑
  - 在课程中不能被玩家改写
- **PLAYER TIMELINE（玩家世界线）**：
  - 由玩家证据选择 + 决策路径生成
  - 可通过 `results` 查看
  - 可重玩覆盖（`WorldApp` 提示“重玩将覆盖”）

## 8 关卡循环
每个 `MissionRecord` 均应遵循固定教学循环：
1. **01 入场**：背景约束 + 角色目标
2. **02 调查**：选择证据卡（至少 2 条才允许决策）
3. **03 决策**：在信息不完备下给出行动
4. **04 世界线结果**：按 `ResourceDelta` 生成并显示约束结果
5. **05 历史对照**：只与原始历史比对，不作是非判定
6. **06 带回现实**：填写复盘与现实任务承诺

证据卡文字是基于来源的课程压缩，不是原始引文。决策前只显示卡片与冲突；决策后把证据来源与历史对照一起解锁。

课程页面文案与按钮中清楚标注：
- `ORIGINAL TIMELINE · 历史信息边界`
- `PLAYER TIMELINE · 你们现在要写下自己的历史`
- `PARALLEL WORLD · 规则化模拟，不是史实`

## 8 个 Mission 的当前设计节奏
- 关卡条目源于 `app/data/missions.ts`
- 当前 mission 数量：**8**（验算脚本输出）
- 目前主界面在关卡列表会显示 `8` 世界线完成进度。
- 每关 `durationMinutes` 与 `realityMission.timeboxMinutes` 支持课程节拍控制。

## 学习目标映射
- 证据意识：从 `mission.evidence` 选择到 `MissionPlayer` 中证据夹。
- 决策能力：平衡证据充分性、历史边界、目标约束。
- 机制理解：`resources` 的变化体现资源位（证据密度、信任、行动窗口、造物能力）。
- 现实迁移：每次结果后提交现实行动承诺，进入 `Dossier`。

## 与历史的关系边界
- 玩家选择不会回写 `event`。
- 事件详情 `source-vault` 只展示原始史实，不展示玩家推演。
- 课程中追问重点是“证据链 + 假设 + 行动后果”，不是“猜对历史时间线”。

## 适配对象
- 年龄层：初高中到高校课程、创业训练营、AI 创业营。
- 适合活动时长：`15 分钟快速演示` / `90 分钟完整课堂`（见 DM 手册）。
