# Mini Silicon Valley 网站地图（T-085）

## 公开静态入口

- `/`：总导航与生产健康状态。
- `/world/`：科技史世界线。
- `/framework/`：一世界、两条双轨、三玩法、四导师、五步骤、六分钟 Demo。
- `/parents/`：家长问答。
- `/workshop/`：内容工坊只读 Released 基线与既有创作工具。
- `/courseware/product-mentor-foundations/`：同事原版 P 导师课件，不是课程大纲。

## 登录后应用

- `/auth/login`：第一方账号登录。
- `/account`：首次改密与账户安全。
- `/classroom/`：我的课堂与 Classroom Factory（导师／管理员）。
- `/classroom/{id}/`：当前登录人的角色视图。
- `/classroom/{id}/control`：该课堂 Admin DM 中控。
- `/classroom/{id}/screen`：成员可打开的脱敏共同投屏。
- `/classroom/{id}/members`：该课堂 Admin DM 成员与权限管理。
- `/studio/`、`/studio/editor/`、`/studio/preview/`、`/studio/courseware/`、`/studio/releases/`：导师／管理员 Course Studio。
- `/course/`、`/course/{slug}/`：导师／管理员课件库与播放器。

## API

- `/api/auth/*`：会话、登录、首次改密等。
- `/api/studio/*`：Candidate、课件、回执和发布；平台 mentor/admin。
- `/api/platform/classrooms/*`：按 classroomId 的课堂、成员、中控、提交、screen 和 Test reset。
- `/api/qa`：限流的 Parent Q&A。

## 退休或内部边界

- `/alpha*`、全局 `/control*`：410。
- `/api/classroom/*`：410。
- `/api/internal/*`：公网 404。
- `work.cyberforker.com/msv/*`：仅有限历史重定向，不是现行应用入口。
