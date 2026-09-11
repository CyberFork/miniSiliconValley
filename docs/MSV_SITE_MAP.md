# Mini Silicon Valley 网站地图（T-109）

> 现行生产域名只有 `https://minisv.vip`。站点按“对外官网与教学服务 / 对内 Studio”两区组织，共用账号、CourseDefinition、ClassroomFactory、权限和状态机。

## 对外：官网与教学服务

### 匿名公开

- `/`：MINI硅谷官网；解释真实科技史驱动的创业 RPG、三种玩法、四导师、五步实践和六分钟 Demo。
- `/world/`：完整科技史世界；首页轻量地图与此页共用 `historyCatalog`。
- `/framework/`：一世界、两轨线、三玩法、四导师、五步骤、六分钟 Demo。
- `/parents/`：家长信息与问答入口。
- `/auth/login/`、`/auth/register/`：第一方登录和 Young Builder 自助注册。

上述四个内容入口可被索引；公开 HTML 不包含 Studio、Workshop、部署诊断、内部回执、私密卡或测试账号。

### 登录后教学服务

- `/classroom/`：我的课堂；learner 只看到自己的课堂，导师/Admin DM 按课堂授权管理 TEST 或 PRODUCTION。
- `/classroom/{id}/`：当前账号的真实导师／学员席位。
- `/classroom/{id}/control/`：该课堂 Admin DM 中控与 TEST UI 验收。
- `/classroom/{id}/screen/`：成员可打开的服务端脱敏共同投屏。
- `/classroom/{id}/members/`：成员、席位、Primary／Delegated Admin DM 与 Test 身份管理。
- `/course/`：**课件查看**；真实 admin／mentor／learner 只读浏览有权访问的 Released 课件，不是课程介绍页或课程编辑器。
- `/course/{slug}/`：锁定 revision/digest 的课件播放器。
- `/account/`：当前账号、密码与浏览器账号切换。

公开注册只创建 active learner，不自动加入课堂，也不授予 Studio 或 Test 模拟权限。受保护深链未登录时必须保留安全 `returnTo`。

## 对内：Course Studio

```text
课程生产
/studio/             00 课程工作台
/studio/editor/      01 课程编辑器；CourseDefinition 唯一正文写入口
/studio/preview/     02 多角色视图验收；签发 ViewAcceptanceReceipt
/studio/releases/    03 验收与发布；两张 exact 回执总闸门

资源管理
/studio/courseware/  04 导师课件库；P/D/M/O 课件版本化与发布
/course/             05 课件查看；播放 Released exact 课件

课堂交付
/classroom/#factory                06 Test 课堂验收／新建入口
/classroom/#production-classrooms  07 正式课堂

资料与历史
/studio/history/     08 资料与历史索引
/workshop/           09 早期课程工作坊；mentor/admin 只读历史归档
```

TEST 的主要发现入口在 Studio，但仍使用与 PRODUCTION 相同的 Classroom UI、API、Factory 和状态机；不存在第二套“Studio 测试课堂”。Room 中控仍属于真实课堂现场。

## Workshop 历史归档

- `/workshop/` 不再是编辑器，不在官网或上课主导航出现。
- 匿名访问返回登录跳转；learner 返回 403；mentor/admin 才可查看。
- 页面明确标注“历史归档 · 只读 · 不代表当前课程标准”，并链接现行 Studio、架构和编辑入口。
- 归档页只读取并导出当前浏览器的十个已知 Workshop localStorage 键，不写入、不删除、不自动上传。
- `/workshop/_source/*` 固定 404。旧工具源码随不可变 release 保存用于回滚和取证，但不从 Web 暴露。

## 静态导师课件

- `/courseware/product-mentor-foundations/`：P 导师课件，需登录。
- `/courseware/development-mentor-ligun/`：D 导师 18 页“先立棍”，需登录。
- `/courseware/market-mentor-user-system/`：M 导师 49 页“产品的用户体系”，需登录。

三套已发布 bundle 均经同一只读鉴权门和 `private, no-store` 策略提供。发布新内容必须产生新版本，不原地修改冻结字节。

## API 边界

- `/api/public/courses`：Released-only 公共课程摘要 allow-list。
- `/api/auth/*`：会话、登录、首次改密、账号集合与受限 Test 身份模拟。
- `/api/studio/*`：Candidate、视图验收、课程/家长 QA 审核、课件与发布；mentor/admin。
- `/api/platform/classrooms/*`：课堂创建、成员、中控、作品、screen、TEST reset/归档与 UI 回执。
- `/api/qa`：限流的 Parent Q&A。

## 搜索、退休与基础设施边界

- 可索引：`/`、`/world/`、`/framework/`、`/parents/`。
- noindex：登录、账号、课堂、课件、Studio、Workshop、API、health、release 与错误页。
- `/alpha*`、全局 `/control*`：410。
- `/api/classroom/*`：410。
- `/api/internal/*`、`/internal/*`、`/workshop/_source/*`：公网 404。
- `cyberforker.com` 与 Windows/局域网机器不是现行依赖，也不属于发布目标。
