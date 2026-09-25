# P1 / P2 最后一页复习回顾

## 需求与实施

用户询问两课是否有总结复习页，并要求缺少时补充。检查原结尾：P1 是下一课预告，P2 是成果保存与课后行动，均不足以代替专门的知识回顾。因此不删旧页，各追加一页到真正的最后。

- P1：26 页，末页 `module-review`《复习回顾：模块怎样合作？》。从变形玩具→乐高→方块，回顾 WHAT/WHY/HOW、模块描述六字段、三项成果，最后用自己的游戏复述。
- P2：28 页，末页 `ligun-review`《复习回顾：怎样让 AI 做对？》。回顾主棍/全部子棍/微棍边界、固定六项、逐问对齐、执行—检查—修正—同输入复查，用 A/B/B 说明修错而不是放宽规则。
- 每页三次揭示：问题先显示，回答后再显示重点；教师讲稿同步，提示不进入投屏包。
- P1 原 S16 由5分钟调整为2分钟，新回顾3分钟；P2 原第27页由3分钟调整为1分钟，新回顾2分钟。两课仍各120分钟、原阶段总预算不变；休息由导师机动安排。
- 页面字号/前景背景显式设置于共享 `recap.css`，不继承教师壳的白色字体。原交互引擎、Three.js、模板、案例和非结尾讲解内容未改动。

## 不可变版本

- P1 r8，内容 `2026.09.19-p1-r9`，digest `971cc25ef8fba30f6377a2d5caa86841f29bbf8a56f227776bc9ab0909236c17`。
- P2 r3，内容 `2026.09.19-p2-r3`，digest `dba0adb24b45d1942d36a06b9baa97fe833bffd53e0fd9a71f65956c90587396`。
- 打包须保留 P1 r4/r5/r6/r7 和 P2 r0/r1/r2；缺少历史文件或 hash 不符拒绝发布。

## 验证

- `npm run test:t132-t133:courseware`：54页、讲稿、120分钟、旧尾页/语义ID、六项顺序、三次揭示、样式双包和历史身份。
- `python3 courseware/shared/tests/verify-browser.py`：54页×双表面对比度与溢出；原复制、下载、打印、可玩游戏与会话隔离。
- `python3 courseware/shared/tests/verify-recap-browser.py`：真实从旧尾页翻入新增回顾，点击/键盘揭示、后退复习、教师/投屏同步、刷新恢复、Pad尺寸触摸。
- 平台测试222项、部署测试65项、TypeScript/ESLint/应用构建/smoke/T-090 E2E。

人工试讲与学生理解程度未代签。


## 部署与线上复验完成

- 发布：`20260919T1710CST-course-recaps`，源提交 `049264fd69feaf90e222bc6779d2d2a77a6b05f9`；Hecate 健康检查及公开冒烟通过。
- P1 r8 / P2 r3 已进入课程库最新入口，566 个原有课件文件逐字节保留。
- 线上两版共 84 个文件 hash 与构建一致；匿名、学员、导师访问边界以及历史版本入口通过。
- 线上真实从旧尾页翻入复习页，三次揭示、键盘后退、刷新恢复、Pad 触摸和教师/投屏同步均通过；无浏览器异常。截图已由开发代理目视检查，无浅底白字或内容截断。
- 本地 54 页 × 双表面检查、222 项平台测试、65 项部署测试、TypeScript / ESLint / 构建 / smoke / T-090 E2E 均通过。
- 证据目录：`docs/evidence/course-recaps/`（本地测试、线上截图/报告、访问与哈希、发布日志及 release.json）。

### 导师检查入口

- [P1 第26页：模块怎样合作？](https://minisv.vip/courseware/development-mentor-module-thinking/r8/teacher/presenter.html?slideId=module-review)
- [P2 第28页：怎样让 AI 做对？](https://minisv.vip/courseware/development-mentor-ligun/r3/teacher/presenter.html?slideId=ligun-review)

使用导师账号登录；点击“揭示 / 继续”分三次回顾，或打开投屏观察同步。每课仍为120分钟。教学效果和现场试讲留给导师确认，没有代签人工 View/UI 验收。
