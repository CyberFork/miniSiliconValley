# T-077｜课程大纲改为 chj 原版独立站点

状态：已修正、已发布、生产验收通过
正式入口：<https://minisv.vip/course/>

## 1. 修正原因

上一版错误地把“集成 chj 课程 UI”解释成了“抽取视觉资产，并由 main 重新编写一套课程页面”。这改变了同事已经完成的页面结构、文案、交互和视觉，也把 Course Package 的 5×13 结构强行投影到同事作品中，不符合“原模原样部署”的要求。

修正后的边界非常明确：

- main 只提供顶部“课程大纲”入口、`/course/` 路由和 Hecate 托管；
- 页面本身完整来自同事仓库，不在 main 中复制、翻译、优化或重写；
- 课程编辑器、Alpha、Classroom 和 Course Package 继续保持原有职责，不再被拿来改造该页面；
- 若同事页面后续要改，必须先在同事仓库形成新提交，再重新固定、测试和发布。

## 2. 不可变来源

```text
仓库      CyberFork/minisv
分支快照  chj
commit    679213a61b835335016eac7649213983a0e48489
Git tree  3a041c4714190cc026f6de8e06e15cec0e5f765d
```

构建脚本在开始和结束时都检查 HEAD、Git tree 与空工作树。任何本地源码修改都会立即终止构建。

## 3. 原样构建方式

同事仓库自身已经支持 `MSV_PUBLIC_BASE`、`MSV_SITE_ORIGIN` 和 `MSV_CANONICAL_URL`。发布只设置：

```text
MSV_PUBLIC_BASE=/course/
MSV_SITE_ORIGIN=https://minisv.vip
MSV_CANONICAL_URL=https://minisv.vip/course/
```

随后执行同事项目自身的类型检查、Lint 和 Vinext 生产构建。外部渲染器只调用原构建 worker 的 `/`，再把完整 `dist/client` 与服务端生成的 HTML 放入暂存目录；不修改任何 HTML、CSS、JavaScript、图片或源文件。

## 4. 防止二次改写

`package_release.py` 的处理顺序是：

1. 组装 main 的世界页和既有公共页面；
2. 对这些 main 页面执行旧路径迁移和共享主题注入；
3. 上述改写全部结束后，才将 chj 暂存目录复制到 `site/course/`；
4. 比较复制前后的目录 SHA-256、文件数和总字节数；
5. 检查原版标识、`/course/_next/`、`/course/assets/`，并拒绝 `/ui-theme.js` 和旧自制页面标识。

所以 `/course/` 是一个不透明、不可变的子站，不会再被主站“顺手优化”。

## 5. 已撤销的错误实现

main 中上一版新增的以下派生实现已删除：

- `app/course/` 自制课程页面；
- `app/lib/course-outline.ts` 课程投影；
- 两张二次转码的 chj WebP；
- 针对自制五步页面的测试和浏览器验收。

历史世界仍保留真实 `<a href="/course/">课程大纲</a>`，公共首页、方法页和家长页也继续指向同一 URL。

## 6. 验收范围

- 同事源码：HEAD 与 Git tree 固定，构建前后工作树为空；
- 同事项目：TypeScript、ESLint、Vinext build；
- 产物：canonical 为 `https://minisv.vip/course/`，脚本、样式和图片都使用 `/course/` 前缀；
- 字节一致性：进入 release 前后课程目录摘要、文件数、字节数完全一致；
- 浏览器：390、430、768、1440 px 显示原版首页；“课程大纲”“开始”“返回首页”可用；原版 9 章／4 阶段可见；资源加载成功且无 pageerror；
- 回归：主站、世界、课堂、Alpha、主控、编辑器、方法、家长和工坊路由继续可用；
- 生产：只部署到 Hecate 的 `minisv.vip`，不修改 `cyberforker.com`。

## 7. 上游测试说明

固定 chj 提交的完整 `npm test` 当前结果为 26/27：类型检查、Lint、构建和其余 26 项均通过；唯一失败是同事测试仍断言课程总览包含“外卖平台”，而固定提交页面已不含该字符串。因为本任务要求不改同事内容，本次不会为了让断言变绿而修改其源码或测试。部署门禁独立执行类型、Lint、生产构建、原样产物校验和真实浏览器交互。

## 8. 发布回执

- Hecate release：`20260906T100023Z-t077-chj-verbatim-r1`；
- main 集成提交：`e4871ae25cc55f99efb985e2425070284587d369`；
- 课程 artifact：`e39ebedc…f17b8f9`，103 个文件，114,365,669 bytes，`transformed=false`；
- 生产浏览器四档视口与 8 项公共入口检查通过；
- 发布前后玩法语义哈希一致；
- 回滚目标：`20260906T085800Z-t077-course-outline-r2`。

机器可读明细见 `TODO_077_PRODUCTION_RECEIPT.json`。
