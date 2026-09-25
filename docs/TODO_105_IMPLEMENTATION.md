# TODO-105：课堂 API 与最小化数据暴露

> 状态：工程实现与本地自动化核验完成；尚未部署，本文件不构成人工验收证明。

## 已锁定政策

- 公开注册继续开放，注册始终创建 `active learner`。
- 注册用户可浏览 Released 课件，但不会自动获得任何 Classroom membership。
- 注册用户无 Studio、Candidate 预览、Test 身份模拟权限。
- 正式课堂 membership 必须由 Admin DM 分配。
- 旧 `/api/classroom/*` 已退休；网关和应用均返回 `410`。当前仅允许 `/api/platform/classrooms`。
- Studio 数据最小化：导师只能看到自己有 membership 或 active Admin-DM grant 的课堂验收摘要；平台 admin 可看全局必要摘要。
- bootstrap 永不暴露成员/profile ID、`dealSeed`、详细 `clientMatrix`、`audit` 或 `checks`。

## 实现核对清单

- [x] 认证注册路径固定创建 active learner，且不创建 Classroom membership。
- [x] Released 课件浏览权限与 Studio、Candidate、Test 权限严格分离。
- [x] 旧课堂 API 在网关与应用路由均返回 410；无旧写入口残留。
- [x] `/api/platform/classrooms` 按 membership/Admin-DM grant 做课堂详情授权；Studio 列表仅给出按权限过滤的脱敏摘要。
- [x] 导师摘要响应不含成员/profile ID、dealSeed、详细 clientMatrix/audit/checks。
- [x] 平台 admin 全局摘要仅返回必要字段。
- [x] 自动化测试覆盖上述拒绝与 410 边界。

## 自动化证据（2026-09-11）

- `npm run test:course-platform`：145/145。
- `node --import tsx --test tests/*.test.ts`：241/241。
- `npm run build:minisv-app`：通过。
- `MSV_APP_SMOKE_TARGET=minisv npx tsx scripts/test-work-app-smoke.ts`：通过。
- `npx tsx scripts/test-classroom-e2e.ts`、`scripts/test-course-platform-e2e.ts`、`scripts/test-t091-product-mentor-e2e.ts`、`scripts/test-t090-development-mentor-e2e.ts`：通过。

本 TODO 不构成线上部署、生产验证或人工验收证明；冻结课件不在本批次修改范围内。
