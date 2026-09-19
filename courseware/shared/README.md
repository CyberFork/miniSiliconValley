# 开发导师 120 分钟双课件

当前部署：`20260919T1537CST-p1-voxel-reuse-r6`。P1 已补充细颗粒方块与贯穿案例，最新 r6；P2 r1 未改。保留 P1 r5/r4 与立棍 r0；不代签 View/UI 或现场试讲。

## 预览

在仓库根目录运行：

```sh
npm run build:t132-t133:courseware
python3 -m http.server 18132 --bind 127.0.0.1 --directory courseware
```

打开 `http://127.0.0.1:18132/review.html`。从教师视图打开投屏，教师端保留讲稿、下一页和手动计时；投屏不含教师提示。仅同一设备的同源浏览器窗口同步，不宣称跨设备云同步。

- P1：`module-thinking-deck/dist/teacher/presenter.html`
- P2：`ligun-deck/dist/teacher/presenter.html`
- P1 材料：`module-thinking-deck/dist/audience/printables/index.html`
- P2 提示词：`ligun-deck/dist/audience/workbook/index.html`
- P2 实际示范：`ligun-deck/dist/audience/demo/index.html`

## 操作与边界

- `→ / ←` 逐步揭示／回收；教师端 `Shift + → / ←` 直接整页；目录或投屏下拉框直接跳页。
- 输入框和原生下拉框内的键盘不抢占；交互按钮上的空格仍是原生点击。
- P1 原页 ID 保留；新深链推荐 `?slideId=module-my-card`。旧数字 `slide` 使用原 18 页映射，避免重排导致静默错页。
- P1/P2 使用 `课程ID + 版本 + session` 隔离状态。同名会话不串课；同一版本／会话刷新恢复。
- 计时器需要手动启动，切页重置为本页建议时长，不自动翻页；课间由导师机动安排。
- 课件不推进 Classroom、不发币、不调用 AI、不保存学生到服务器。
- P2 编辑器在本页面内暂存；复制或下载备份后再关页。复制失败会选中文本，提示手动复制，不伪报成功。
- `audience-offline.zip` 不含教师提示；`teacher-private.zip` **私有**。两者分别解压为同级 `audience/` 和 `teacher/`，再用本地 HTTP 服务运行，不能混进公开静态目录。
- 浏览器直接 `file://` 打开不保证模块、剪贴板或双屏同步可用，使用本地 HTTP。

## 构建与测试

```sh
npm run test:t132-t133:courseware
npm run test:t132-t133:browser
npm run test:t122:browser
npm run typecheck
npm run lint
```

浏览器测试依赖 Python Playwright、pypdf 和本机 Chrome，测试启动隔离 localhost 服务器，不读写真实课堂。证据默认在 `/tmp/msv-p132-p133-evidence/`。

共享引擎目前由 P1 源文件提供；构建复制到 P2，不维护两份可变 runtime/CSS。Markdown 为提示词唯一正文，catalog 仅存元数据，浏览器 catalog.js 构建时派生。Three.js 本地依赖和许可随包，P2 不无谓加载 Three.js。

## 线上发布

- P1 教师：https://minisv.vip/courseware/development-mentor-module-thinking/r6/teacher/presenter.html
- P2 教师：https://minisv.vip/courseware/development-mentor-ligun/r1/teacher/presenter.html
- 用教师账号从 `/course/` 也可进入；两端都有“打开投屏窗口”。
- `BUILD-MANIFEST.json` 标记 `deployment-ready`，不代表试讲签名；发布使用不可变新版本 URL、字节哈希及服务端教师权限。详见 `docs/T132_T133_IMPLEMENTATION_RECEIPT.md` 与 `docs/DEPLOYMENT.md`。

## 人工检查

现场导师需试讲两个独立 120 分钟课，检查六年级学生理解、40 分钟个人实践容量、实际投影及自选 AI 工具。四张 A4 仅内容初稿，由同事制作最终实体物料。这些不由自动化代签。

P1 r6 补充验收：`python3 courseware/module-thinking-deck/tests/verify-reuse.py`；细化与发布记录见 `docs/P1_R6_VOXEL_REUSE_RECEIPT.md`。
