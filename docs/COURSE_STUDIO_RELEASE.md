# Course Studio 发布说明

> **Legacy（T-085 已替代）**：旧固定九视窗 `/control/editor` 已由 `/studio/editor/` 和页内动态 `4 + N + 1` 取代。现行流程见 [Course Platform SOP](COURSE_PLATFORM_SOP.md)。


发布：`20260906T064756Z-t074-layout-r2`

入口：<https://minisv.vip/control/editor/>

权限：`admin` / `mentor`
生产主机：`hecate-work`

## T-074 本次完成

- 课程编辑器固定为三个一级工作区：**课程结构／抽卡内容／JSON 源码**。
- “抽卡内容”提供跨五步全文搜索，以及步骤、F/R/G/U、来源状态、当前 Alpha 已发/未发筛选。
- 编辑器与 Alpha 学员席位复用唯一 `card-view.js` 渲染器；标题清理、证据边界、卡片状态和 HTML 转义不再维护两套逻辑。
- F 卡展示可追溯来源，R 卡明确提示“课堂模拟／不是史实”；内部稳定 ID 不进入学员预览。
- 导师后台可查看当前 Alpha 4 名学员 × 3 张手牌的稳定 ID，并点击反查卡牌。
- 顶部持续诊断 release、build、Schema、5 步、13 块、卡组/卡数、revision、digest 与 Alpha refresh epoch。
- 发布门槛为恰好 5 个卡组且每组至少 12 张；F 卡无有效来源、稳定 ID 重复或前后端版本不一致时阻止发布。
- 新增不可变版本历史；旧快照只能恢复为新的草稿 revision，不覆盖历史、不自动刷新 Alpha。
- 修复结构编辑区左侧块标题的 intrinsic minimum size 溢出；按钮现在始终被轨道约束，不会再覆盖右侧表单。
- 保存草稿仍不改变当前 Run；“全部刷新 Alpha”才显式换稿，并保留 Run ID、执行位置、课堂成员、账本和已发手牌。
- Google、饿了么两门内置课件均保持 5 步 / 13 块 / 5 卡组 / 60 张卡。

## 验收结果

- Python：部署测试 14/14、LIVE RUN/编辑器测试 33/33。
- Node：主题运行时 1/1、共享卡片渲染器与远程控制台 8/8。
- Web 应用：TypeScript、ESLint、生产构建全部通过，应用契约与渲染测试 23/23。
- 隔离浏览器 E2E：搜索指定三卡、F/R 预览、4×3 手牌、保存不静默更新、显式刷新保留 Run、append-only 恢复、390px 移动端布局全部通过。
- 桌面布局：1660/1366/1100/900/768/430 六档视口无横向溢出；当前版与冒险版几何一致。
- 结构布局：六档视口逐一检查块按钮、左侧轨道与右侧表单矩形，全部无越界、无覆盖，双主题几何一致。
- 生产登录态只读验收：release/build/Schema、饿了么 5/13/5/60、指定三卡、16 张 R 卡、12 个当前手牌稳定 ID、双主题与 390px 移动端全部通过；对生产课程与 Run 的写操作为 0。
- 正式发布切换前后的活动 Run、执行位置、4+4 成员、团队资金与手牌 digest 完全一致。
- 生产部署仍完全位于 Hecate；未修改 `cyberforker.com` 主站。

机器可读回执：`tools/live-run/docs/TODO_074_PRODUCTION_RECEIPT.json`。
