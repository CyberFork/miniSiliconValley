# Mini Silicon Valley · 科技史创业 RPG

> 开放世界是地图，RPG 是身份，历史情境是关卡，真实创业是主线。

Mini Silicon Valley 是面向青少年的、由可核验科技史驱动的有限开放世界创业学习平台。学员以 Young Builder 团队进入真实历史情境，经历调查、判断、行动、反馈和复盘，再把能力带回现实项目。

## 唯一开发工程

- 稳定工作目录：`AI教培-mini硅谷/dev`
- 唯一远端：<https://github.com/CyberFork/miniSiliconValley.git>
- `cowork/` 是作者素材与交付区，不是应用运行真值。
- `/private/tmp/` 中的检出、构建与 bundle 均是可丢弃产物，不得作为后续开发根目录。

详细边界、旧工程归档和发布来源校验见 [Development Workspace](docs/DEVELOPMENT_WORKSPACE.md)。

## 正式入口

- 官网：<https://minisv.vip/>
- 历史世界：<https://minisv.vip/world/>
- 方法框架：<https://minisv.vip/framework/>
- 家长入口：<https://minisv.vip/parents/>
- 去上课：<https://minisv.vip/classroom/>
- 课件查看：<https://minisv.vip/course/>
- 账户中心：<https://minisv.vip/account/>
- Course Studio（对内）：<https://minisv.vip/studio/>

网站只分两区：对外官网与教学服务、对内 Studio 与课程管理；两区共用账号和课程底层，不复制系统。`/course/` 是登录后的 admin／mentor／learner 均可只读浏览 Released 课件的课件库，不是整门课程大纲；Candidate 和内部 fallback 不进入目录。匿名课程摘要使用独立的 Released-only 公共投影，不泄漏私密卡、内部剧本或未审核内容。

早期 Workshop 已从主导航退出，仅能由 `Studio → 资料与历史 → 早期课程工作坊` 找到。`/workshop/` 是 mentor/admin 可访问的只读历史归档，不是编辑入口；归档页只能读取和导出当前浏览器遗留的十个已知键，服务器无法自动收集其他设备数据。旧 `/alpha/` 和全局 `/control/` 已退休并返回 410。

## 课程平台主棍

```text
CourseDefinition
  → 保存为不可变 Candidate
  → Studio 多角色视图验收并签发 ViewAcceptanceReceipt
  → 用同一 ClassroomFactory 创建真实 Test Classroom
  → 4 位导师 + N 位学员走完同一 UI、API 与状态机
  → Admin DM 签发 exact UiAcceptanceReceipt
  → 两张回执同时有效后发布为 Released
  → 创建不可重置的 Production Classroom
```

- **唯一课程真值**：Studio 只编辑 CourseDefinition；运行中的 Classroom 只引用 exact `courseId + revision + digest`。
- **一个工厂**：Test 与 Production 共用工厂、页面、API 和版本化状态机。
- **动态人数**：课程声明 `min/default/max`、每人手牌数和发牌策略；默认 4 人，不写死为 4。
- **角色隔离**：4 位 P/D/M/O 导师、N 位非固定 PDMO 的学员、1 个课堂中控。
- **课件版本**：P/D/M/O 课件独立版本化；课堂开始前绑定 exact 版本，后续更新不影响既有课堂。
- **Admin DM**：课堂级权限，不是第五位导师；可与导师席重合，也可单独授权。
- **账号分发**：导师或管理员预创建账号；初始密码仅显示一次，首次登录必须修改。

详细架构见 [Course Platform Architecture](docs/COURSE_PLATFORM_ARCHITECTURE.md)，实际操作见 [Course Platform SOP](docs/COURSE_PLATFORM_SOP.md)。

## 历史世界内容

- 1891—2026 时间轴与连续建设的像素正交地图。
- 203 个带来源事件，覆盖地点、企业、人物和技术关系。
- Google、饿了么等五步创业闭环课程；一世界、两条双轨、三类玩法、四类导师、五步骤、六分钟 Demo Day。
- `ORIGINAL TIMELINE` 与玩家平行世界严格分离。

## 本地开发与质量闸

```bash
npm ci
npm run dev

npm run validate:data
npm run test:minisv-app
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
git diff --check
```

完整发布测试可执行 `npm run test:release`。生产发布还必须完成统一 release bundle 演练、真实浏览器角色验收和公网只读 smoke。

## 代码地图

- `app/lib/course-package.ts`：CourseDefinition schema 与 Google／饿了么内置定义。
- `app/lib/course-platform.ts`：无副作用 `4 + N + 1` 投影、动态人数和发牌容量校验。
- `app/lib/course-registry.ts`：Candidate、Released 与双回执发布门禁。
- `app/lib/course-acceptance.ts`：View／UI 两类 exact 验收回执、有效性与失效规则。
- `app/lib/courseware-store.ts`：导师 HTML 课件、不可变版本和发布指针。
- `app/lib/classroom-factory.ts`：唯一 ClassroomFactory 与状态机。
- `app/lib/classroom-platform-store.ts`：课堂实例、成员、私密手牌、提交、中控、Test reset 和审计。
- `app/studio/`：Editor、多角色视图验收、导师课件库与验收发布。
- `app/classroom/`：课堂工厂、角色 UI、中控、投屏和成员管理。
- `deploy/minisv/site/`：公开官网、轻量历史预览、robots 与 sitemap。
- `deploy/minisv/workshop/archive.*`：受保护的早期 Workshop 只读归档外壳。
- `drizzle/0004_unified_course_factory.sql`：统一课程工厂 D1 模型。
- `drizzle/0005_two_stage_course_acceptance.sql`：两级验收回执与课堂绑定。
- `deploy/minisv/package_bundle.py`：静态站、应用 worker 与 ops 的单一不可变发布包。
- `scripts/test-course-platform-e2e.ts`：真实 D1／HTTP 端到端验收。

## 生产边界

生产只在 Hecate 运行，通过 Cloudflare Tunnel 和 `minisv.vip` 访问；Windows 与局域网机器不是依赖。运行数据和 secrets 永远在 release 之外。同事 P 课件固定为经批准的 commit/tree，构建管线不得编辑其源码或改写成主站 UI。
