# Mini Silicon Valley · 科技史创业 RPG

> 开放世界是地图，RPG 是身份，历史情境是关卡，真实创业是主线。

Mini Silicon Valley 是面向青少年的、由可核验科技史驱动的有限开放世界创业学习平台。学员以 Young Builder 团队进入真实历史情境，经历调查、判断、行动、反馈和复盘，再把能力带回现实项目。

## 正式入口

- 总导航：<https://minisv.vip/>
- 历史世界：<https://minisv.vip/world/>
- 课堂列表：<https://minisv.vip/classroom/>
- 导师课件库：<https://minisv.vip/course/>
- Course Studio：<https://minisv.vip/studio/>
- 方法框架：<https://minisv.vip/framework/>
- 家长问答：<https://minisv.vip/parents/>
- 内容工坊：<https://minisv.vip/workshop/>

`/course/` 是需要导师或管理员登录的课件库，不是整门课程大纲。同事交付的产品导师原版课件作为一个不可变 CoursewarePackage 发布在 `/courseware/product-mentor-foundations/`。旧 `/alpha/` 和全局 `/control/` 已退休并返回 410。

## 课程平台主棍

```text
CourseDefinition
  → 保存为不可变 Candidate
  → 用同一 ClassroomFactory 创建真实 Test Classroom
  → 4 位导师 + N 位学员走完同一 UI、API 与状态机
  → Admin DM 签发 exact 验收回执
  → 发布为 Released
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
- `app/lib/course-registry.ts`：Candidate、验收回执和 Released exact 版本链。
- `app/lib/courseware-store.ts`：导师 HTML 课件、不可变版本和发布指针。
- `app/lib/classroom-factory.ts`：唯一 ClassroomFactory 与状态机。
- `app/lib/classroom-platform-store.ts`：课堂实例、成员、私密手牌、提交、中控、Test reset 和审计。
- `app/studio/`：Editor、Read Only Preview、课件库与发布管理。
- `app/classroom/`：课堂工厂、角色 UI、中控、投屏和成员管理。
- `drizzle/0004_unified_course_factory.sql`：统一课程工厂 D1 模型。
- `deploy/minisv/package_bundle.py`：静态站、应用 worker 与 ops 的单一不可变发布包。
- `scripts/test-course-platform-e2e.ts`：真实 D1／HTTP 端到端验收。

## 生产边界

生产只在 Hecate 运行，通过 Cloudflare Tunnel 和 `minisv.vip` 访问；Windows 与局域网机器不是依赖。运行数据和 secrets 永远在 release 之外。同事 P 课件固定为经批准的 commit/tree，构建管线不得编辑其源码或改写成主站 UI。
