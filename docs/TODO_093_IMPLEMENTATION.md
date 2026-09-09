# T-093｜课件已解锁进度导航

状态：本地开发、浏览器验收和生产发布均已完成；D 导师 exact r0 已上线。

## 交互真值

- `index`：当前正在观看的页。
- `maxUnlockedState`：本次浏览器会话到达过的最远页，只能按顺序增加。
- `revealedCounts`：当前页此刻显示到的揭示步骤。
- `maxRevealedCounts`：每页曾经到达的最远揭示步骤；回看后再次进入会恢复到这个边界。

顶部/底部分段进度不再是 CSS 宽度：每一段都是带中文 `aria-label` 的按钮。

- 薄荷绿：已经解锁，可用鼠标、Tab + Enter／Space 回看。
- 黄色：当前页，点击不会推进。
- 深色：尚未解锁，点击只提示，不跳转、不泄露内容。

点击进度段会阻止冒泡，不能误触发课件“下一步”。`Home` 回到第一页，`End` 回到当前已解锁前沿，不能越过锁定边界。

## 恢复与深链接

播放器以 `pathname + revision` 为键将解锁边界和揭示进度保存在 `sessionStorage`：

- 回看后刷新仍保留最远解锁位置；
- URL 始终保留 `revision` 和其他独立查询参数，并更新 `slide`、`step`；
- 已有会话手工把 URL 改到未解锁未来页时，会回落到合法边界；
- 新的导师播放会话可以从有权限的 exact 深链接进入指定页与合法揭示步骤。

这只是课件播放器位置，不会推进或回退 Classroom Block，也不会改动作品、手牌或经济数据。

## 固定身份

```text
packageId  cw-development-mentor-ligun
slug       development-mentor-ligun
revision   r0
digest     cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d
tree       ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234
slides     18
```

本地编辑源与运行时包的 `index.html` SHA-256 均为：

```text
b13cd12a59d7ebdd6c97cfe426b999633348b35fea85f87571ff104eb3658c1b
```

## 验收

- `python3 tools/live-run/tests/verify_t093_courseware_progress.py`：18 页；鼠标、键盘、锁定边界、刷新恢复、查询参数保留全部通过；0 console error，0 request failure。
- `python3 tests/verify_deck.py`（本地编辑源）：4 个桌面/投影视口、方向键、Home/End、总览、打印、4 张离线图片全部通过。
- `tests/development-mentor-package.test.ts`：清单文件、逐文件 SHA-256、内容树和 Courseware digest 一致。
- `git diff --check`：通过。

## 生产结果

- 课件入口：<https://minisv.vip/course/development-mentor-ligun/?revision=0>
- 可验证深链：<https://minisv.vip/course/development-mentor-ligun/?revision=0&slide=6&step=2>
- 匿名访问会进入登录流程，并完整保留 `revision`、`slide`、`step`；导师登录后返回 exact 位置。
- 静态文件由受保护的 `/courseware/development-mentor-ligun/` 提供，匿名请求返回 `401`，导师请求返回 `200`。
- Hecate Release：`20260909T223953CST-t090-t093-course-release-r3`。
- 完整部署证据见 `docs/TODO_090_093_PRODUCTION_DEPLOYMENT_RECEIPT.json`。
