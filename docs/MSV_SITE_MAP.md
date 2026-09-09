# Mini Silicon Valley 网站地图（T-087）

## 公开静态入口

- `/`：总导航与生产健康状态。
- `/world/`：科技史世界线。
- `/framework/`：一世界、两条双轨、三玩法、四导师、五步骤、六分钟 Demo。
- `/parents/`：家长问答。
- `/workshop/`：内容工坊只读 Released 基线与既有创作工具。
- `/courseware/product-mentor-foundations/`：同事原版 P 导师课件，不是完整课程大纲。
- `/courseware/development-mentor-ligun/`：D 导师 18 页“先立棍”课件，需登录。
- `/courseware/market-mentor-user-system/`：M 导师 49 页“产品的用户体系”课件，需登录。

## 登录与账户

- `/auth/login`：第一方账号登录。
- `/account`：首次改密、账户安全与会话管理。
- 所有登录后的 Studio、Classroom、导师 Courseware、Account 页面右上角使用同一个账号菜单，可进入账户中心、切换账号或安全退出。共同投屏 `/screen` 保持完全脱敏，不显示私人账号控件。

## Course Studio：课程生产

```text
课程生产
/studio/             00 课程工作台；显示两次验收、一次发布的完整状态
/studio/editor/      01 课程编辑器；CourseDefinition 唯一写入口
/studio/preview/     02 多角色视图验收；签发 ViewAcceptanceReceipt
/studio/releases/    03 验收与发布；两级 exact 回执总闸门

资源管理
/studio/courseware/  04 导师课件库；创建、版本化与发布 P/D/M/O 课件
/course/             05 导师课件播放；只播放 exact 课件版本

课堂交付
/classroom/          06 课堂中心；ClassroomFactory 与用户课堂列表
```

“UI 预览”不是独立路由。它直接创建并进入真实 TEST Classroom。

## Classroom 实例

- `/classroom/{id}/`：当前登录人的真实导师／学员席位。
- `/classroom/{id}/control`：该实例的 Admin DM 中控、14 项 UI 验收与回执签发。
- `/classroom/{id}/screen`：成员可打开的服务端脱敏共同投屏。
- `/classroom/{id}/members`：该实例的成员、席位和 Primary／Delegated Admin DM 管理；符合条件的 Test Classroom 还提供测试账号管理与受限身份模拟。

`/classroom/` 永久分组显示：

- `TEST · UI 验收课堂`：可重置，不进入正式学习档案。
- `PRODUCTION · 正式课堂`：不可重置，只能使用 Released 课程及验收过的 exact 课件。

## API

- `/api/auth/*`：会话、登录、首次改密、服务端登出与 Test 身份模拟。
- `/api/studio/bootstrap`：课程、Candidate／Released、两类回执、课件和验收课堂摘要。
- `/api/studio/candidates`：保存不可变 Candidate。
- `/api/studio/view-acceptance`：签发 exact ViewAcceptanceReceipt。
- `/api/studio/releases`：使用两张有效回执发布 exact Candidate。
- `/api/studio/courseware/*`：导师课件创建、版本化、预览与发布。
- `/api/platform/classrooms/*`：课堂创建、成员、中控、提交、screen、TEST reset 与 UiAcceptanceReceipt。
- `/api/platform/classrooms/{id}/test-identities`：仅真实平台管理员 + 本课堂 Admin DM 可用的 Test 账号状态、一次性凭据重发与身份入口；Production 失败关闭。
- `/api/qa`：限流的 Parent Q&A。

## 退休或内部边界

- `/alpha*`、全局 `/control*`：410。
- `/api/classroom/*`：410。
- `/api/internal/*`：公网 404。
- `work.cyberforker.com/msv/*`：仅有限历史重定向，不是现行应用入口。
