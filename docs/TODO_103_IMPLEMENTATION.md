# T-103 实施记录：共享投影与对外课程语义

## 结果

- 唯一投影源码：`app/lib/course-projection-core.ts`。
- 服务端：`app/lib/course-platform.ts` 直接调用共享核心。
- 浏览器：`scripts/generate-course-projector.ts` 用 esbuild 生成 `public/studio/editor-assets/course-projection-core.js`；Editor Loader 在预览 UI 前顺序加载。
- 防漂移：`npm run check:course-projector` 比较重建结果，`prebuild` 自动重建；生成文件带禁止手改标记。
- 公共课程 DTO：`app/lib/public-course-projection.ts` 只接受 Released exact 版本，只暴露课程摘要、五步、机制、人数范围和六分钟终局。
- 匿名目录 API：`GET /api/public/courses` 只读取 Released pointer 并输出公共 allow-list，不返回 CourseDefinition 正文。

## 统一规则

以下规则只改一处源码：旧课程 2—4 人兼容策略、声明人数、学员席位、任务回退、UTF-16 hash、随机数、shuffle、checkpoint 卡组选择、重复／唯一发牌、四导师、N 学员和中控基础投影。

编辑器仍可显示 0—24 人的诊断场景，但超出课程声明范围时必须返回明确 capacity issues，不能静默裁剪成 maxCount。正式 View 回执和课堂工厂继续失败关闭。unknown Block 不能退回大步骤卡组；`repeat-when-needed` 的空卡组明确不可实例化。

## 兼容与验收

投影语义变化使兼容契约更新为 `course-projector-v7`。旧 v6 回执仍是不可变历史记录，但不再满足当前发布门禁；本任务没有代签 View/UI 回执。

自动化覆盖：

- 13 Block × 2/4/6 人 × 5 状态 = 195 场浏览器／服务端对照。
- 卡牌 ID、正文、来源、顺序、导师字段、学员任务与中控字段。
- Unicode seed、checkpoint 覆盖、重复执行、人数越界、非整数、unknown Block、循环发牌和空卡组。
- Generated artifact 新鲜度、Loader 顺序与缺少核心时失败关闭。
- Released 公共 DTO 无私密卡、讲稿、review queue、来源、规则或运行状态；投影没有写回 CourseDefinition／Original Timeline 的路径。

## 对外口径

- P／D／M／O = 产品／开发／市场／运营导师；学员统一为 Young Builder。
- 五步 = 找真问题、定真方案、做真产品、进真市场、跑真运营；Demo Day 是独立六分钟终局。
- 三层学习引擎 = 探索、决策、建造；对应课堂机制为毛线信息、美式攻坚、德式经营。
- 默认班型为 4 导师 + 4 学员；具体课程可声明 2—6 学员。Admin DM 是可委派权限，不是第五导师。
