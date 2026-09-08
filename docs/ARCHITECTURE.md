# Mini Silicon Valley 架构说明

本文件描述当前 T-085 架构。详细领域决策见 [COURSE_PLATFORM_ARCHITECTURE.md](COURSE_PLATFORM_ARCHITECTURE.md)。历史 Alpha、固定九弹窗和旧 Course Registry 文档仅供追溯，不再是运行规范。

## 1. 三个产品面

- **历史世界 `/world/`**：地图、时间轴、史实节点、战役和个人档案；事实底座与玩家平行世界分离。
- **Course Studio `/studio/`**：唯一课程写入口、页内 `4 + N + 1` 预览、导师课件管理和发布门。
- **Classroom `/classroom/`**：真实账号与 Membership、按实例中控、角色私密视图、共同投屏和课堂数据。

导师课件库位于 `/course/`。同事原版产品导师课件是其中一件不可变静态产物，物理路径为 `/courseware/product-mentor-foundations/`，不代表课程真值。

## 2. 单一真值与版本链

```text
CourseDefinition（D1 course_versions）
  → Candidate pointer
  → exact Test Classroom + exact Courseware bindings
  → accepted course_test_receipt
  → Released pointer
  → Production ClassroomInstance
```

- CourseDefinition 正文以 canonical JSON digest 标识，每次保存只新增或复用完全相同的不可变 revision。
- ClassroomInstance 不复制可编辑课程正文，只锁定 exact course/courseware references。
- Studio Preview 使用 `buildStudioProjection()`，不创建房间、不写账本、不伪造运行数据。
- Test 与 Production 调用同一个 `createClassroomInstance()` 和 `controllerTransition()`；差别只在准入、reset 权限和环境标记。

## 3. 领域对象

- `CourseDefinition`：五步骤、13 个 Block、P/D/M/O 导师任务、学员视角、卡组、来源边界与 learnerPolicy。
- `CourseRelease`：`courseId + revision + digest + candidate/released`。
- `CoursewarePackage/Version`：导师拥有的单文件 HTML 或固定静态 bundle；版本不可变。
- `ClassroomInstance`：环境、生命周期、课程引用、实际 N、独立 ControllerState。
- `Membership`：账号与某个 Classroom 的导师席或学员席关联。
- `ClassroomPermission(admin-dm)`：课堂级管理权限，不等同平台管理员或第五导师。
- `CourseTestReceipt`：完成 Test 后对 exact course 和四件 exact courseware 的验收回执。

## 4. 可见性与权限

- 平台 `admin`／`mentor` 可进入 Studio、预创建账号和创建课堂。
- 导师创建课堂时必须把自己列为初始 Admin DM；平台 admin 可指定任一导师／管理员。
- Classroom 访问必须来自导师 Membership、学员 Membership 或该课堂 Admin DM 权限；平台 admin 不自动穿透所有课堂。
- 学员仅收到自己的任务、自己持久化手牌、自己的提交和账户值；不会收到中控验收门或导师私密脚本。
- `/screen` 使用专门的 allow-list API，不从浏览器端隐藏私密字段。
- `/course/` 与 `/course/{slug}/` 只对导师／管理员开放；inline HTML 在无 `allow-same-origin` 的 sandbox iframe 中播放。
- 所有写 API 使用第一方 HttpOnly Session、首次改密门禁、同源 Origin 校验和服务端 RBAC。

## 5. 动态学员人数

`learnerPolicy` 声明 `minCount/defaultCount/maxCount/cardsPerLearner/dealPolicy`。创建及发布时都会校验人数范围、卡组容量和第 5 名以后通用任务模板。N=2 不出现虚假空席；N=6 生成 6 份隔离私密视图；容量不足会显示具体缺口并阻止开课或发布。

## 6. 生产拓扑

```text
Cloudflare Tunnel
  → 127.0.0.1:18780  Nginx gateway
      ├─ current/site                 静态世界、门户、P 导师原版课件
      ├─ 127.0.0.1:18787             Vinext/Worker + D1-compatible data
      └─ 127.0.0.1:18789             Parent Q&A
127.0.0.1:18792                       cloudflared metrics
```

18790/18791 的全局 LIVE RUN/remote-console 已退休且必须关闭。应用 D1-compatible 数据保存在 `~/Services/msv-classroom/data`，不进入 release。

## 7. 统一发布

一个 release 同时包含 `site/`、`app/dist/`、`ops/`、根 manifest 和 `bundle.json`。`~/Services/minisv/current` 只指向这一份 release；Nginx 和课堂 worker 同时跟随该 symlink，避免静态 UI 与 API 跨版本。失败部署恢复之前捕获的 exact symlink 和配置。

## 8. 退休入口

- `/alpha`、`/alpha/*`：410
- `/control`、`/control/*`：410
- `/api/classroom/*`：410
- `/api/internal/*`：公网 404

现行入口只有 `/studio/*`、`/course/*` 和 `/classroom/{classroomId}/*`。
