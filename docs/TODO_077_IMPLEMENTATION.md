# T-077｜统一课程大纲与 chj 视觉集成

状态：已实现，等待本次发布回执写入
正式入口：<https://minisv.vip/course/>

## 1. 交付结果

Mini Silicon Valley 现在只有一个对外课程大纲入口：`/course/`。它是可直接访问、刷新、复制和浏览器前进／后退的稳定页面，而不是 `WorldApp` 内存中的临时 View。

入口已经连接到：

- 公开总导航 `/`；
- 历史世界 `/world/`；
- 课程页自身导航；
- 方法页 `/framework/` 与家长页 `/parents/` 的共享导航增强。

`/framework/` 仍负责团队方法同步，不再冒充课程目录；旧的 `CurriculumOutline` 不再从公开世界页渲染，因此不存在两个“课程大纲”入口争夺课程真值。

## 2. chj 集成边界

候选仓库和版本已经固定：

- 仓库：`CyberFork/minisv`
- 分支：`chj`
- 审计 SHA：`679213a61b835335016eac7649213983a0e48489`

没有把 chj 整分支覆盖 main。文件审计确认 chj 是独立产品分支，包含 108 MB 资产和旧的 4 步／9 章／15 分钟等口径。此次只吸收它的像素地图视觉语言和两张实际使用的图片：

- `course-outline-world-map.webp`：1671×941，约 479 KiB；
- `course-outline-chapter-icons.webp`：633×621，约 224 KiB。

两张图片由原始 PNG 转为 WebP；未引入 chj 的压缩交付物、部署配置、未使用 Overview 大图或任何凭据。

## 3. 课程数据主棍

课程页不维护第三份章节文案。`app/lib/course-outline.ts` 只把现有 Course Package v1 的 Released 内置基线投影成只读页面：

- 饿了么：`eleme-2008-find-problem`，r0；
- Google：`google-1995-2004`，r0；
- 每课固定 5 大步、13 Block、5 卡组；
- 五步：找真问题 → 定真方案 → 做真产品 → 进真市场 → 跑真运营；
- P／D／M／O 是产品、开发、市场、运营四导师，不是四名学员角色；
- 六分钟 Demo Day 位于第五步之后，是终局，不是第六步。

页面显示 `courseId / revision / SHA-256 digest`，便于和 Editor、Alpha 以及 Classroom 对照。摘要、任务、导师顺序、双轨、三玩法和学员视角全部从课程 JSON 生成。

当前投影使用仓库内置 Released r0 基线；后续由 Editor 发布的新 revision 仍按既有规则供新 Run／重置 Run 使用，不会静默热切换正在进行的课堂。

## 4. 路由和交互

- 正式 URL：`/course/`；`/course` 由网关 308 到带斜杠地址。
- `next.config.ts` 使用 `trailingSlash`，页面 canonical 固定为 `https://minisv.vip/course/`。
- 课程、步骤、Block 选择写入 URL hash，例如：
  `/course/#course=google-1995-2004&step=build&block=B07`。
- hash 可分享、刷新恢复，并原生支持前进／后退；不会触发静态 RSC 请求。
- 地图使用 1671:941 固定比例 Stage；五个按钮 Overlay 与背景一起缩放，移动端另有真实 HTML 步骤导航。
- 学员详情优先呈现“你在哪里、要说什么、可以问什么、怎样过关”；复杂方法只留给导师。

## 5. 发布结构

`npm run build:minisv-static` 从当前 Vinext build 服务端渲染：

- `dist/minisv-static/world/index.html`
- `dist/minisv-static/course/index.html`

`deploy/minisv/package_release.py` 使用 `--app-static-root` 将这两个当前页面与既有 Classroom、Alpha、Editor、QA、Workshop 一起组装进同一原子 release。打包器会拒绝：

- 缺少 `/course/`；
- 公开首页／世界／课程页缺少统一入口；
- 方法页／家长页缺少共享课程快捷入口；
- 产物残留旧域名、局域网地址或 `/msv/` 路径。

## 6. 验收矩阵

自动化覆盖：

- TypeScript、ESLint、Vinext build 和核心单元／渲染／交互测试；
- Course Package 两门课程的精确 digest、5×13、四导师、学员不分 PDMO；
- release 打包、网关路由、共享 UI runtime 和 manifest；
- 课程页 390／430／768／1440 px；
- 公开页 `/`、`/world/`、`/course/`、`/framework/`、`/parents/` 在 390／1440 px；
- 无横向溢出、地图节点不漂移、图片加载、选中态、键盘语义、hash 分享和浏览器返回；
- Alpha、Editor 和 CourseRepository 全套回归。

生产 release、main 集成提交和回滚目标记录在本次发布回执中。
