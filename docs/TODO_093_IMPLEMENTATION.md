# T-093｜课件与 Classroom 已解锁进度导航

状态：实现与隔离自动化完成；等待本轮生产发布后更新线上回执。历史 D 导师课件子范围已经上线。

## 两套互不混淆的游标

### Courseware Player

- `index`：当前课件页。
- `maxUnlockedState`：该播放器会话到达过的最远课件状态。
- `revealedCounts` / `maxRevealedCounts`：逐步揭示的当前位置与已解锁边界。

课件分段条使用真实按钮；薄荷绿可回看、黄色为当前、深色为锁定。URL 保留 `revision` 并更新 `slide` / `step`。这套游标不改变 Classroom Block。

### Classroom Runtime

- `script.unlockedThroughIndex`：全课堂唯一的解锁前沿，只能由既有中控解锁动作推进。
- `scriptNavigation.viewedIndex`：当前浏览器正在看的 Block，是个人游标。
- `scriptNavigation.blocks`：服务端给出的稳定 Block 索引；正文、私卡和角色秘密仍只按当前合法页面投影。

Classroom 的 13 段进度条现在复用既有 `navigateTo` 与服务端 `SCRIPT_PAGE_LOCKED` 校验：

- 已解锁段可用鼠标、触摸、Tab + Enter／Space 直达；
- 当前段幂等，只提示“正在查看”，不推进；
- 锁定段仍可聚焦和获得中文说明，但不导航；手改 URL/API 同样返回 409；
- 浏览历史使用 `pushState`，刷新、前进、后退恢复个人位置；角色、课堂与其他查询参数不丢失；
- 导师、学员、Admin DM 的 TEST 角色视图和投屏预览复用同一个进度组件；
- 视觉细线保持原样，实际按钮热区为 44px；`aria-current`、`aria-disabled` 与完整中文标签不只依赖颜色；
- 进度点击只发 GET，不调用控制、提交、发牌、记账、重置、验收或删除接口。

## 关键实现

- `app/lib/classroom-platform-store.ts`：在现有导航投影中增加完整 Block 索引，不另建状态机。
- `app/classroom/ClassroomRuntime.tsx`：唯一 `PageNavigator/Progress`、个人 URL 历史恢复、锁定说明。
- `app/classroom/platform.module.css`：44px 热区、三态视觉、键盘焦点与粗指针适配。
- `tests/classroom-script-runtime.test.ts`：个人游标/全局前沿分离及进度控件契约。
- `tools/live-run/tests/verify_t093_classroom_progress_browser.py`：编译后真实 UI + 临时 D1 的端到端验证。

## 自动化证据

Classroom 专项场景固定为“全局已解锁 B07、学员正在看 B04”：

- 鼠标到 B02、触摸到 B06、Enter 到 B07、Space 回 B04；
- B08 锁定且直接 API 返回 `SCRIPT_PAGE_LOCKED` 409；
- 另一 Admin DM 浏览器持续停在 B04；exact 课程引用与全局前沿持续为原值；
- B02 未提交设备草稿在往返后恢复；浏览器前进/后退通过；
- P 导师视图与投屏进度条通过；触发的写请求数量为 0；
- Pad 视口无横向溢出，最小热区 44px；无控制台和关键资源错误。

机器证据：

- `docs/qa/t093-classroom-progress/browser-automated-evidence.json`
- `docs/qa/t093-classroom-progress/learner-pad-progress-b02.png`
- `docs/qa/t093-classroom-progress/mentor-screen-progress-b05.png`

执行：

```bash
npm run test:t093:browser
```

该命令仍包含原 D 导师课件 18 页专项回归；PPT 子范围的固定 r0 digest 仍为 `cafb8878e710a698237631523428dff7e0832180415c1b5605acbe6f3ddcf69d`，没有被本轮改写。

## 安全与验收边界

- 自动化只使用临时本地 D1，没有读写生产课堂。
- 没有代替用户签署 ViewAcceptanceReceipt 或 UiAcceptanceReceipt。
- 生产发布与只读线上复验完成后，才可把本轮 Classroom 补齐标记为完成。
