# 模块思维 P1｜HTML-PPT 与教师视图

T-122 的本地完整交付。它把 XMind 中的 P1 模块提纲实现为一套同源的 16:9 投屏课件和一个教师控制视图。

## 入口

启动本地静态服务器：

```sh
cd module-thinking-deck
python3 -m http.server 8122
```

- 投屏端：`http://127.0.0.1:8122/index.html`
- 教师端：`http://127.0.0.1:8122/presenter.html`
- 模块地图打印版：`http://127.0.0.1:8122/printables/module-map.html`
- 接口卡打印版：`http://127.0.0.1:8122/printables/interface-card.html`

正常上课从教师端进入，点击“打开投屏窗口”。把新窗口移动到扩展屏，并在投屏窗口点击 `⛶` 全屏。教师屏保留提示、下一页预览和控制按钮。

## 操作

教师端：

- `→` / 空格：揭示本页答案；答案已揭示时进入下一页。
- `←`：收起本页答案；没有已揭示内容时回到上一页。
- `Shift + →` / `Shift + ←`：直接切换整页。
- `O`：打开或聚焦投屏窗口。
- 左侧目录：明确跳到指定页面，并同步投屏。
- “新播放会话”：创建隔离的 session；不同课堂不会互相抢页。

投屏端也支持方向键、空格、触摸按钮和全屏。由教师端打开时，状态通过带 session 的 `BroadcastChannel` 同步，并以 localStorage 作为刷新恢复和兼容回退。

## 双屏边界

- 使用扩展屏，不要使用镜像。
- 线上授课只共享投屏窗口，不共享整个桌面。
- 单屏设备无法保证教师提示不被旁观者看到。
- 浏览器拦截弹窗时，教师端会保留显式重开按钮。
- 翻页和揭示只改变本 PPT，不推进 Classroom Block，不提交学生答案，也不自动发放硅谷币。

## 内容与奖励

- 标准版为 60 分钟。
- 每页先让学生选择、表达或动手，再由导师命名概念。
- 硅谷币全部由导师手动发放；教师端给出参与、理由、证据和协作的建议，不调用钱包 API。
- 学生答错不扣币；避免只奖励抢答最快者。
- 前半段使用校园失物招领解释路径，S12 切换到校园订餐验证方法迁移；两者都属于课堂案例，不冒充真实公司技术史。

## 构建公开与教师包

```sh
node scripts/build.mjs
node tests/verify.mjs
```

输出：

```text
dist/audience/   可作为学员课件静态 bundle
dist/teacher/    教师资料，必须由服务端导师权限保护
dist/BUILD-MANIFEST.json
```

不要把整个源码目录直接复制进公开 `/courseware/`。`audience` 包不会包含教师提示；`teacher` 包只有在 `/console/` 或现有导师权限路由完成服务端鉴权后才可部署。仅靠隐藏链接、CSS 或 `noindex` 不是权限保护。

## 文件职责

- `deck-data.js`：学生可见的 16 页内容真值。
- `deck-runtime.js`：投屏渲染、缩放、键盘/触摸与状态同步。
- `presenter-notes.js`：教师私有讲述、误区、验收和发币提示。
- `presenter-runtime.js`：教师控制、预览、目录和多会话隔离。
- `source/p1-outline.json`：XMind P1 子树的独立快照。
- `source/content-map.md`：稳定 slideId 映射与课程选择。
- `printables/`：学员模块地图与接口卡。

## 发布状态

本交付已实现并可本地运行，但尚未发布到生产。正式上线必须先为教师 bundle 提供服务端导师权限保护，并沿现有 Courseware Library 建立不可变版本；不得静默覆盖既有 P、D、M 课件。
