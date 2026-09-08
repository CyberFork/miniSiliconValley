# T-086 实施记录：两级课程验收与发布闭环

> 实施日期：2026-09-09
> 依赖：T-085 统一课程工厂
> 目标：把“编辑器 → 视图预览 → UI 预览 → 正式课程”落实为可审计、不可绕过的产品与服务端流程。

## 1. 最终结果

T-086 没有增加第二套课堂预览系统，而是在 T-085 单一真值／单一工厂之上完成：

```text
Editor
→ Candidate
→ ViewAcceptanceReceipt
→ real TEST Classroom
→ UiAcceptanceReceipt
→ Released
→ PRODUCTION Classroom
```

每次状态切换都由服务端核对 exact `courseId + revision + digest`。UI 按钮和 URL 预选只帮助操作，不构成权限或发布证明。

## 2. 数据与领域实现

### 新表

`drizzle/0005_two_stage_course_acceptance.sql` 与生成后的 `db/schema-statements.ts` 新增：

- `course_view_acceptance_receipts`
- `course_ui_acceptance_receipts`
- `classroom_acceptance_bindings`

两类回执按不可变业务指纹唯一；重复签发返回同一 receipt id。外键、状态、人数与索引约束在 D1 层同步失败关闭。

### 验收服务

`app/lib/course-acceptance.ts` 实现：

- Studio 投影场景矩阵生成与 View 回执签发。
- View 回执列表、exact 校验与失效判断。
- 14 项真实 UI 检查和 Ui 回执签发。
- UI 回执对 TEST 完成状态、reset generation、状态机、成员、Admin DM、四套课件和构建版本的绑定。
- TEST reset 后解除当前 UI binding，历史回执保留但无效。

### 工厂与发布门

- `classroom-factory.ts`：所有 TEST／PRODUCTION 都要求 View 回执；PRODUCTION 额外要求 UI 回执。
- `classroom-platform-store.ts`：创建实例时重新验证两张回执，原子写入 acceptance binding；生产课堂严格对齐 UI 回执中的四套课件。
- `course-registry.ts`：Released 操作必须同时提交并验证 View／UI receipt id。
- `courseware-store.ts`：课件 bundle digest 先规范化字段顺序再哈希，修复 API 与 D1 对象属性顺序导致 digest 漂移的问题。

## 3. API 实现

- 新增 `POST /api/studio/view-acceptance`。
- `/api/studio/bootstrap` 返回 View 回执、UI 回执、验收课堂摘要与验收运行时版本。
- `/api/studio/releases` 接收并验证两张 exact 回执。
- `/api/platform/classrooms/{id}/receipt` 接收 14 项检查和 browser／platform／viewport client matrix。
- ClassroomFactory 请求契约新增 View／UI receipt id，并按环境强制校验。

所有错误继续使用结构化 API envelope；缺失、失效、版本不一致、课件不一致或检查不全均拒绝，不产生半发布或半课堂。

## 4. Studio 产品流

Studio 导航重新按职责分组：

```text
课程生产：00 工作台 → 01 编辑器 → 02 多角色视图验收 → 03 验收与发布
资源管理：04 导师课件库 → 05 导师课件播放
课堂交付：06 课堂中心
```

### Editor

- 保留 T-074／T-085 已确认的可视化直改工作台和原有布局。
- 版本矩阵扩展为 Working／Candidate／View／UI／Released。
- 保存 Candidate 后明确提供“前往多角色视图验收”。
- 编辑时的 Working Copy 投影仍只是辅助，不冒充正式验收。

### 多角色视图验收

- 只读取 URL／选择器锁定的 exact Candidate。
- 使用共享投影器在同页显示 `4 + N + 1`。
- 必须在浏览器中遍历全部 Block 与课程声明的每个支持人数。
- 服务端再次完整重算后才签发 ViewAcceptanceReceipt。
- 成功后直接进入预选 exact 版本的 TEST ClassroomFactory。

### 验收与发布

每个版本显示：Candidate、View、TEST、UI、课件、Released 五级状态及唯一“下一步主操作”。只有两张回执同时有效时，发布按钮才出现；服务端仍再次验证。

## 5. Classroom 产品流

- `/classroom/` 永久区分 `TEST · UI 验收课堂` 和 `PRODUCTION · 正式课堂`。
- TEST 可选项只包含具有有效 View 回执的 Candidate／Released。
- PRODUCTION 可选项只包含具有有效 View + UI 回执的 Released。
- 选择 UI 回执后自动锁定其 P／D／M／O exact 课件；任一课件未发布或 digest 不一致即阻止创建。
- TEST 中控在完成整门课程后显示 14 项验收清单；成功签发后展示 receipt id 和发布入口。
- TEST reset 清空当前 UI receipt binding；PRODUCTION 永不提供 reset。
- TEST 与 PRODUCTION 继续复用相同 Runtime、API、Factory 和状态机。

## 6. 关键失败关闭场景

实现和自动化测试覆盖：

- 无 View 回执或伪造 View 回执创建 TEST。
- 未完成课程或 14 项检查缺失时签 UI 回执。
- 缺任一回执发布 Released。
- Candidate 更新后复用旧未发布 View 回执。
- TEST reset 后复用旧 UI 回执。
- UI 回执课程、课堂、View 回执、课件 bundle 或 build 不一致。
- Production 使用 Candidate、未发布课件或另一组 exact 课件。
- 动态最大人数下任务／卡牌容量不足。
- 并发中控使用过期版本覆盖状态。

## 7. 测试与验证

核心命令：

```bash
npm run typecheck
npm run lint
npm run test:course-platform
npm run test:minisv-app
npm run test:studio-editor:browser
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
zsh -n deploy/minisv/scripts/*.sh
git diff --check
```

真实 HTTP + D1 E2E 覆盖 View 回执、TEST 完整 13 Block、14 项检查、UI 回执、双回执发布、同课件 Production、reset 失效、并发冲突、N=6 和隐私隔离。

最终测试结果、commit、release id、生产健康检查和公开 URL 会写入同目录的 `TODO_086_PRODUCTION_RECEIPT.json`。

## 8. 操作文档

- 架构真值：`docs/COURSE_PLATFORM_ARCHITECTURE.md`
- 实际操作：`docs/COURSE_PLATFORM_SOP.md`
- 测试矩阵：`docs/TESTING.md`
- 路由地图：`docs/MSV_SITE_MAP.md`
- 编辑器不可退化边界：`docs/COURSE_STUDIO_EDITOR_GUARDRAILS.md`

## 9. 验收对应

- Editor 保存不可变 Candidate：已实现。
- Editor 下一步进入 View 验收：已实现。
- Preview 只读 exact Candidate、遍历全部 Block／人数：已实现。
- View receipt exact 绑定与失效：已实现。
- 无 View receipt 不得创建 TEST：已实现。
- 真实 TEST 而非第二套 UI Preview：已实现。
- TEST／PRODUCTION 同源：已保持。
- 全课程 + 14 项检查后签 UI receipt：已实现。
- UI receipt 绑定成员、课件、客户端矩阵与审计：已实现。
- 双回执发布门：已实现。
- Production 只用 Released 与验收过的 exact 课件：已实现。
- Studio／TEST 变化不影响运行中 Production：已实现并纳入 E2E。
- Studio、Course 与 Classroom 导航消歧：已实现。
- 退休入口不回流新导航：已实现并保持 410。
