# Mini Silicon Valley 架构说明

本文件描述当前 T-087 架构。详细领域决策见 [COURSE_PLATFORM_ARCHITECTURE.md](COURSE_PLATFORM_ARCHITECTURE.md)。历史 Alpha、固定九弹窗和旧 Course Registry 文档仅供追溯，不再是运行规范。

## 1. 三个产品面

- **历史世界 `/world/`**：地图、时间轴、史实节点、战役和个人档案；事实底座与玩家平行世界分离。
- **Course Studio `/studio/`**：唯一课程写入口、页内 `4 + N + 1` 预览、导师课件管理和发布门。
- **Classroom `/classroom/`**：真实账号与 Membership、按实例中控、角色私密视图、共同投屏和课堂数据。

导师课件库位于 `/course/`。P／D／M 已发布课件是其中三件不可变静态产物，分别位于 `/courseware/product-mentor-foundations/`、`/courseware/development-mentor-ligun/`、`/courseware/market-mentor-user-system/`；它们是角色可见的电子课件，不替代 CourseDefinition 课程真值。

## 2. 单一真值与版本链

```text
CourseDefinition（D1 course_versions）
  → Candidate pointer
  → exact ViewAcceptanceReceipt
  → exact Test Classroom + exact Courseware bindings
  → exact UiAcceptanceReceipt
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
- `ClassroomAdminDmGrant`：课堂级 `primary | delegated` 管理授权；只有 Primary 具有委派能力，不等同平台管理员或第五导师。
- `AuthImpersonation`：真实平台管理员会话上的短时 Test 身份覆盖；始终锁定一个 Test Classroom，并同时保留 actor/effective identity。
- `ViewAcceptanceReceipt`：对 exact Candidate 的全部 Block、支持人数与共享投影结果验收。
- `UiAcceptanceReceipt`：完成真实 Test 后，对 exact course、课堂成员、运行版本与四件 exact courseware 的 UI 验收回执。

## 4. 可见性与权限

- 平台 `admin`／`mentor` 可进入 Studio、预创建账号和创建课堂。
- 导师创建课堂时必须把自己列为初始 Admin DM；平台 admin 可指定任一导师／管理员。
- Classroom 访问必须来自导师 Membership、学员 Membership 或该课堂 Admin DM 权限；平台 admin 不自动穿透所有课堂。
- 学员仅收到自己的任务、自己持久化手牌、自己的提交和账户值；不会收到中控验收门或导师私密脚本。
- `/screen` 使用专门的 allow-list API，不从浏览器端隐藏私密字段。
- `/course/` 与 `/course/{slug}/` 对真实管理员、导师和学员开放；inline HTML 在无 `allow-same-origin` 的 sandbox iframe 中播放，静态 bundle 统一经 cookie-only 网关保护。
- 所有写 API 使用第一方 HttpOnly Session、首次改密门禁、同源 Origin 校验和服务端 RBAC。
- Studio、Classroom、导师 Courseware 与 Account 使用同一个账号菜单；脱敏共同投屏是唯一例外。普通切换先撤销服务端 Session；Test 模拟只替换当前请求的 effective identity，不改 Cookie 中的真实 actor。
- Admin DM 委派是非递归授权：Primary 可授予／撤销导师的 Delegated；Delegated 可运行课堂但无委派能力。旧的平面 `classroom_permissions` 仅作为迁移期回滚镜像，不参与授权判定。

## 5. 动态学员人数

`learnerPolicy` 声明 `minCount/defaultCount/maxCount/cardsPerLearner/dealPolicy`。创建及发布时都会校验人数范围、卡组容量和第 5 名以后通用任务模板。N=2 不出现虚假空席；N=6 生成 6 份隔离私密视图；容量不足会显示具体缺口并阻止开课或发布。

## 6. 生产拓扑

```text
Cloudflare Tunnel
  → 127.0.0.1:18780  Nginx gateway
      ├─ current/site                 静态世界、门户、P／D／M 导师课件
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
