# M 导师课件｜产品的用户体系

## 归集结果

`cowork/课件` 顶层已统一为角色可识别的三个目录：

```text
product-courseware/
development-courseware/
market-courseware/
```

原 `user-system-slides.html` 已归入：

```text
cowork/课件/market-courseware/course/index.html
```

`market-courseware/README.md` 和 `manifest.json` 记录本地打开方式、生产地址、页数及源文件摘要；D 课件原 `dev/` 目录同步改名为 `development-courseware/`，未改动其课件正文和既有不可变 r0 身份。

## 不可变课件身份

```text
mentorRole      M
packageId       cw-market-mentor-user-system
slug            market-mentor-user-system
revision        r0
title           市场导师｜产品的用户体系
slides          49
entryPath       /courseware/market-mentor-user-system/
source SHA-256  aace20f86a717b965f0be1629f254ec3d58e4859850f0d20f0491999fcee1682
content tree    48b01a256bd3d408a5d539f798470e6aad0058a19dcdeb8b5d212b0e64add862
registry digest c48010b29cf4e9319552cee7748b6a8126ddf2c00486390e967e5b40d10cdc20
```

M r0 是新的 static-bundle，没有覆盖隐藏的 `market-mentor-field-kit` 系统占位包；旧 Classroom 继续锁定创建时的 exact 引用，新 Classroom 和 `/course/` 可选择正式 M r0。

## 播放修复

原始 49 页课件在快速按 `Home`／`End` 时会因为平滑滚动和 IntersectionObserver 竞争而停在错误页，部分密集页在 1280×720 下也会被裁切。归集时完成：

- 取消跨页平滑滚动，键盘跳转与页码保持原子一致。
- 支持 `?revision=0&slide=N&step=N` 深链，并保留未知查询参数。
- 根据每页真实内容高度自动缩放舞台，窗口改变时重新计算。
- 移除被生产 CSP 阻止的 Google Fonts 请求，保留系统中文字体栈，不再依赖外部运行时资源。
- 保留 49 页正文、配色、组件和逐项 reveal 节奏。

## 认证与发布

- 目录播放器：`https://minisv.vip/course/market-mentor-user-system/?revision=0`
- 原始资源：`https://minisv.vip/courseware/market-mentor-user-system/`
- `/course/` 仅展示 Released 课件；管理员、导师和学员登录后只读访问。
- 原始静态路径与 P／D 共用 cookie-only `auth_request`；匿名为 401。
- 响应使用 `private, no-store, no-transform`；release assembler 在主题转换完成后原样复制并复核 exact manifest。

## 验收

- 静态身份：文件、字节数、SHA-256、content tree、registry digest 全链一致。
- 浏览器：49 页，1600×900、1280×720、1024×768、390×844 无横向溢出或舞台裁切。
- 交互：鼠标、方向键、Home／End、触摸、深链及查询参数保留通过。
- 安全：匿名静态访问 401，无课件正文泄漏；真实导师与学员登录后可打开。
- 平台：Course Studio、Course Library、Test Classroom 共用同一个 packageId／revision／digest。

## 生产结果

- 正式 release：`20260910T032647CST-market-mentor-user-system-r2`
- 运行时代码：`f1b063b56aa4800a5316103da94c09dcef870a78`
- 上一版（已含 M r0）：`20260910T031544CST-market-mentor-user-system-r1`
- 上线 M 前的已知良好版：`20260910T020748CST-t095-t096-course-platform-r3`
- Hecate healthcheck、公开冒烟、真实导师与真实学员的登录后目录／播放器／原始课件访问全部通过。
- 生产返回的原始 HTML SHA-256 与源文件一致；49 页完整，缓存响应只有 `private, no-store, no-transform`。

机器可读的完整回执见 [`MARKET_MENTOR_USER_SYSTEM_PRODUCTION_RECEIPT.json`](MARKET_MENTOR_USER_SYSTEM_PRODUCTION_RECEIPT.json)。
