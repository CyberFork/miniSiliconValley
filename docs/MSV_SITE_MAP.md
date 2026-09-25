# Mini Silicon Valley 网站地图（T-123）

> 现行生产域名只有 `https://minisv.vip`。站点按“公开官网 / 学员服务 / 内部工作台”组织，共用第一方账号、CourseDefinition、ClassroomFactory、权限与状态机；路径归类不替代服务端授权。

## 公开官网

- `/`：MINI硅谷官网；匿名页面只展示品牌、课程方法与参与入口。
- `/world/`：完整科技史世界；与首页轻量地图共用 `historyCatalog`。
- `/framework/`：一世界、两轨线、三玩法、四导师、五步骤、六分钟 Demo。
- `/parents/`：家长信息与问答入口。
- `/u/{studentId}/`：学员主动公开的像素空间；匿名 allow-list 投影，不包含钱包、私密学习数据、管理备注或凭据。
- `/auth/login/`、`/auth/register/`：第一方登录与 Young Builder 自助注册。

官网右上角固定提供“时空终端”。未登录时进入 `/auth/login?returnTo=/terminal/`；服务端确认当前账号为 admin/mentor 后，账号导航才动态增加“工作台”。公共静态 HTML 不烘焙权限清单或内部入口。

## 登录后学员服务

- `/terminal/`：个人像素时空终端；默认登录落点。
  - `/terminal/identity/`：我的身份、昵称、头像与账号入口。
  - `/terminal/courses/`：我的课堂与课件直达。
  - `/terminal/space/`：维护本人公开空间与装备。
  - `/terminal/wallet/`：个人硅谷币余额及可追溯流水。
  - `/terminal/shop/`：装饰预览、确认兑换、持有与装备。
  - `/terminal/homework/`：账号定向作业；查看导师发放、保存草稿、正式提交及读取反馈。
  - `/terminal/games/`：明确的后续开放占位，不伪装成已实现功能。
  - `/terminal/grants/`：授权导师的手动发放与冲正入口；仍按课堂关系和服务端 RBAC 校验。
- `/classroom/`：我的课堂、申请加入与继续课堂；不再包含课堂工厂、删除或全局管理。
- `/classroom/{id}/`：当前账号的真实导师／学员席位；TEST 与 PRODUCTION 共用。
- `/classroom/{id}/screen/`：服务端脱敏共同投屏。
- `/classroom/{id}/members/`：仅相应课堂授权者使用的成员现场入口。
- `/course/`、`/course/{slug}/`：有权访问的 Released 课件目录与隔离播放器。
- `/account/`：只管理当前账号、密码、会话与账号切换，不管理他人。

公开注册只创建 active learner，不自动加入课堂，不授予 Console 或 Test 模拟权限。受保护深链未登录时必须保留安全的同源 `returnTo`。

## 内部 MINI硅谷工作台

```text
/console/                           工作台首页

课程生产
/console/studio/                    Course Studio 总览
/console/studio/editor/             CourseDefinition 唯一正文写入口
/console/studio/preview/            多角色视图验收
/console/studio/releases/           验收与发布
/console/studio/reviews/            人工审核工作台

资源与交付
/console/courseware/                导师课件管理
/console/courseware/{packageId}/    单个课件包版本管理
/console/classrooms/                TEST/Production 工厂、历史与生命周期
/console/classrooms/{id}/control/   导师／Admin DM 课堂中控
/console/homework/                  模板、课堂定向发放、回收与反馈
/console/accounts/                  用户、昵称、备注、密码与 RBAC 管理
/console/qa/                        测试与质量检查
/console/archive/                   Workshop 与历史资料
/console/settings/                  平台设置
```

- admin/mentor 可按实际 RBAC 与资源范围进入相应模块；learner/observer 直接访问得到明确 403。
- 未登录访问 Console 时跳转登录并保留同源 `returnTo`。
- Test 身份模拟、Primary/Delegated Admin DM、课堂详情访问和账号操作继续执行原服务端边界；“看见菜单”从不等于获得权限。
- `/console/studio/` 嵌入原 Studio 工作台和编辑器，不复制 CourseDefinition 或另建状态机。

## 旧路由与归档

- `/studio/*`：短期同源 `308` 到对应 `/console/studio/*`，只做迁移，不维护第二套 UI。
- `/workshop/`：mentor/admin 可访问的只读历史归档；日常入口位于 `/console/archive/`。
- `/workshop/_source/*`：固定 404。
- `/alpha*`、全局 `/control*`：410。
- `/api/classroom/*`：410；当前课堂 API 仅为 `/api/platform/classrooms/*`。
- `/api/internal/*`、`/internal/*`：公网 404。

## 静态导师课件

- `/courseware/product-mentor-foundations/`：P 导师课件，需登录。
- `/courseware/development-mentor-ligun/`：D 导师“先立棍”，需登录。
- `/courseware/market-mentor-user-system/`：M 导师“产品的用户体系”，需登录。

已发布 bundle 经同一只读鉴权门和 `private, no-store` 策略提供；新内容产生新版本，不原地修改冻结字节。

## API 边界

- `/api/public/courses`：Released-only 公共课程摘要 allow-list。
- `/api/public/spaces/{studentId}`：匿名公开空间 allow-list。
- `/api/auth/*`：会话、登录、首次改密、账号集合与受限 Test 身份模拟。
- `/api/terminal/*`：终端 bootstrap、钱包、空间、购买、装备、导师发放与冲正。
- `/api/homework/*`：登录账号的版本化模板、课堂收件人快照、学员草稿／提交和导师反馈；与 `/api/public/homework/*` 的公开练习物理分离。
- `/api/studio/*`：Candidate、视图验收、审核、课件与发布；mentor/admin。
- `/api/platform/classrooms/*`：课堂创建、成员、中控、作品、screen、TEST reset/归档与 UI 回执。
- `/api/qa`：限流的 Parent Q&A。

## 搜索与基础设施边界

- 可索引：`/`、`/world/`、`/framework/`、`/parents/`，以及学员主动公开的 `/u/*`。
- noindex：登录、账号、终端、课堂、课件、Console、Workshop、API、health、release 与错误页。
- `cyberforker.com` 与 Windows/局域网机器不是现行依赖，也不属于发布目标。
