# T-088｜学员 Pad 无键盘体验工程验收

> 日期：2026-09-11
> 状态：工程实现与 Chromium 触摸/响应式自动化通过；真实 iPad Safari、Android 触摸设备仍需团队人工验收。
> 边界：本记录不签发 ViewAcceptanceReceipt 或 UiAcceptanceReceipt，不创建 Production Classroom。

## 1. 已实现的学员端契约

学员只用触摸即可完成这条主线：

```text
登录 → 进入自己的课堂 → 查看当前任务与私密卡
→ 在已解锁剧本中前后翻阅 → 填写结构化成果
→ 提交 → 看导师退回 → 保留原稿修改并重交 → 查看通过
→ 打开账号菜单 → 切换账号或安全退出
```

实现要点：

- Classroom、登录、账户菜单使用 `viewport-fit=cover`、`100svh` 和 safe-area 内边距。
- 粗指针设备上的学员关键按钮、链接、选择器和账号动作均至少 44×44 CSS px。
- 输入框/文本域在 Pad/手机保持至少 16px，避免 iOS Safari 聚焦时自动放大。
- 输入控件设置软键盘滚动余量；主内容与底部操作避开 Home Indicator。
- 触摸按钮使用 `touch-action: manipulation`；核心流程不依赖 hover、右键、拖拽或实体键盘。
- 私密卡以完整正文显示，F/R/G/U 使用中文含义；不会缩成看不全的摘要卡。
- 表单草稿按 actor、view、classroom、run、seat、block 和 schema 隔离保存在设备端；刷新、短暂断网和导师退回不会清空。
- 提交、审核、翻页、解锁分别使用服务器 run identity、版本 CAS 和幂等键；重复点击不会重复记账。
- “上一页／下一页／回到最新解锁”是可见触摸控件；键盘快捷键仅作为额外能力，不再写成学员唯一操作方式。
- 提交状态带 `role=status` 与中文反馈，等待、退回、通过、断线和重连均可区分。

## 2. 自动化验收

命令：

```bash
npm run test:t088:browser
```

脚本复用 T-090 的真实端到端环境，而不是搭一个静态假页面：

1. 临时 D1 中创建 Admin DM、P/D/M/O、六名学员。
2. 保存真实饿了么 Candidate，创建 exact Test Classroom。
3. 解锁 B05—B09，生成两名学员不同的私密卡。
4. 学员提交 10 字段 DevelopmentStick；D 导师退回、学员修改重交、D 再通过。
5. 注入断网与恢复，验证已提交内容和本地草稿恢复。
6. 使用**真实 learner 账号**重新登录，不依赖 Admin DM `viewAs`。
7. 仅通过可见按钮从 B05 触摸前进到 B08，检查私密卡不串给 learner02。
8. 在以下 10 个 viewport 验收横向溢出、关键触摸目标、16px 编辑字号与 hover-none：

```text
744×1133   1133×744   820×1180   1180×820
1024×1366  1366×1024  800×1280  1280×800
390×844    430×932
```

本轮结果：10/10 无页面级横向溢出；每个页面测得 31—34 个学员关键控件，0 个小于 44×44；10 个表单字段中 0 个小于 16px；0 page error，0 非计划资源失败。

证据：

```text
docs/qa/t088-tablet-mobile/browser-receipt.json
docs/qa/t090-development-mentor/t088-ipad-mini-portrait.png
docs/qa/t090-development-mentor/t088-ipad-pro-landscape.png
docs/qa/t090-development-mentor/t088-android-tablet-portrait.png
docs/qa/t090-development-mentor/t088-phone-390.png
```

## 3. 真实设备人工门禁

自动化不能模拟 Safari 的软键盘、系统返回手势、锁屏快照、Home Indicator、Apple Pencil，也不能代表 Android 厂商 WebView。Production 前由团队在真实设备逐项执行：

### iPad Safari（必须）

- 记录设备型号、iPadOS、Safari、横/竖屏、网络、CourseRelease exact ID 和 App Build ID。
- 不接实体键盘；手指完成登录、首次改密、进入课堂、读任务、看私密卡、提交、退回修改、通过、退出。
- 逐个字段唤起/收起软键盘；确认焦点、错误和提交按钮可达，页面不跳顶，输入不丢。
- 横竖屏切换、锁屏再解锁、切到其他 App 再回来；Block、草稿、账号和当前卡保持正确。
- 断网 10 秒后恢复；状态先显示离线，恢复后同步，不重复提交/RP/扣款。
- 退出后用浏览器后退；不得看到前一学员私密卡、钱包或作品。

### Android Chrome（必须；无平板时先登记手机缺口）

执行同一流程，并额外检查系统返回键、不同软键盘高度和地址栏收缩。若只有 Android 手机，只能登记为兼容证据，不能宣称 Android 平板门禁已关闭。

### 失败即停止发布

任一设备出现横向溢出、按钮被软键盘遮住、核心动作依赖 hover/键盘、私密信息串号、断网重复写入或退出后缓存泄露，均不得签发最终 UiAcceptanceReceipt。修复后必须以同一 exact 版本重新演练。
