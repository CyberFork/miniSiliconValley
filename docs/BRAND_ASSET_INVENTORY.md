# 品牌资产与全站使用基线

## 正式字标

- 设计源：`cowork/课件/product-courseware/course/assets/mini-silicon-valley-logo-transparent.png`
- 工程受控副本：`public/assets/mini-silicon-valley-logo-transparent.png`
- 线上路径：`/assets/mini-silicon-valley-logo-transparent.png`
- 原始尺寸：`1650 × 420`，RGBA PNG。
- SHA-256：`4dbbe4dea625fd372c6d760f2344fbf62b7b15f0d2d14e490cddd56e05ffbe87`

该蓝绿横向 `MINI硅谷` 字标是页面内唯一正式品牌图形。打包器会校验上述摘要；文件缺失或字节变化时发布失败。`public/favicon.svg` 的方形 W 只保留为浏览器标签页、收藏和 PWA manifest 图标，禁止再作为页面内 Logo。

## 实现边界

- React 页面统一使用 `BrandHomeLink`，静态页面统一使用 `.msv-static-brand`。
- 字标保持原比例并使用 `object-fit: contain`；深色界面使用白色安全底，不使用滤镜改色。
- 桌面完整字标外框为 `154 × 40`；紧凑入口为 `126 × 34`；窄屏紧凑入口为 `112 × 34`。
- 左上角品牌入口必须是原生 `<a href="/">`，辅助名称固定为“返回 Mini Silicon Valley 主页”，支持鼠标、键盘和触摸。
- 上下文名称（课堂名、Course Studio、家长服务台等）可显示在字标旁；不得重复写一个肉眼相同的“MINI硅谷”假字标。
- `/courseware/*` 下已经发布的 P／D／M 导师课件是不可变 bundle，不注入或重写。它们自身已有的品牌属于课件原始字节。

## 覆盖面

- 对外：首页、World、Framework、家长入口、登录／注册／找回、Account、404。
- 教学：课堂中心、课堂席位、主控、成员、共享投屏、加载／错误态、课件目录与播放器外壳。
- 对内：Course Studio、课程编辑器、验收／发布页面、历史 Workshop 归档。
- 本地工具：LIVE RUN 主控、席位、编辑器、远程控制台与 loading 页。

Framework 是独立水合页面：共享 runtime 会在初次装载及后续 DOM 水合后持续修复旧图形，避免重新退回 W 或 `#top`。favicon、manifest、OG 和浏览器元数据仍按各自用途保留，不计为可见页面 Logo。

## 验收命令

```sh
shasum -a 256 public/assets/mini-silicon-valley-logo-transparent.png
node --import tsx --test tests/brand-contract.test.ts
python3 -m unittest discover -s deploy/minisv/tests -p 'test_*.py'
node deploy/minisv/tests/test_ui_theme_runtime.mjs
npm run test:t109:browser
npm run test:t106-t107:browser
MSV_APP_URL=https://minisv.vip/ \
  MSV_QA_ARTIFACT_DIR=docs/qa/t082-shared-brand-home \
  python3 tools/live-run/tests/verify_brand_browser.py
```

最后一条必须在生产发布后执行，逐路由覆盖 `320 / 390 / 768 / 1440` 视窗，并以普通点击或 Enter 验证当前标签返回根主页。以上命令不代替课程内容的人工 View/UI 验收。
