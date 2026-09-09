# T-095 → T-092｜课程字段、数据一致性与导师课件上线

## 主棍

一份可追溯的 `CourseDefinition` 生成编辑器预览、Test Classroom 中控、导师席和学员席；课件作为独立、不可变的 `CoursewarePackage` 通过统一的登录后 `/course/` 目录播放。

```text
CourseDefinition Candidate
→ 六个稳定学员席与字段身份校验
→ Studio 多角色视图验收
→ exact Test Classroom（锁定 revision + digest）
→ P 导师饿了么课程包复验
→ P 课件上线统一目录
→ D 课件沿用同一目录、认证和播放器
```

## 实现顺序

1. **T-095｜用户字段与六席隔离**
   - 每个可编辑字段具有稳定 `fieldId / scope / ownerId / JSON path`。
   - P/D/M/O 与 learner01—learner06 专属字段均为独立节点。
   - 人数减少只停用席位，不静默删除其内容。
   - 卡片 ID、模板深复制、全局字段影响提示和隔离回归测试完整。
2. **T-094｜Editor、Preview、Test Classroom 与中控一致性**
   - 四端显示并使用相同 `courseId / courseDataId / revision / digest`。
   - Test Runtime 显示 classroom/run/block/seat/deal/state/reset 等诊断身份。
   - B01 固定 seed 投影与实际发牌逐字段一致，并能识别旧课堂与当前 Candidate 的差异。
3. **T-091｜重新验收 P 导师饿了么课程包**
   - P 拥有饿了么历史案例与 B01—B04 检查点；D/M/O 不重复主讲。
   - F/R/G/U 来源边界、私密卡、Product Brief 与 P 课件 exact 引用通过测试。
4. **T-096｜统一 `/course/` 目录并首先上线 P 课件**
   - 登录后的导师和学员均可只读访问 Released 静态课件。
   - 匿名访问完整保留 returnTo；Candidate、测试身份和管理操作不泄漏。
   - P 与 D 原始静态资源使用同一鉴权和 `no-store` 规则。
5. **T-093｜D 课件已解锁进度跳转复验**
   - 已解锁段可点击与键盘操作；未解锁段不可泄漏；URL 保留 revision/slide/step。
6. **T-092｜D 课件沿用统一目录与播放器复验**
   - 复用现有稳定身份 `cw-development-mentor-ligun / development-mentor-ligun / r0`，不创建第二套 slug。
   - 新课堂锁定 exact 课件；既有课堂不可被新 Candidate 静默覆盖。

## 不可妥协约束

- 不修改既有不可变 Candidate、Released JSON 或其 digest；修复产生新的 Candidate revision。
- 不伪造人工 `ViewAcceptanceReceipt` 或 `UiAcceptanceReceipt`。
- 编辑器、Preview 和 Classroom 共用同一套服务端投影契约；浏览器副本必须有契约测试。
- 课程正文、课件资源和课堂运行状态分层：运行时手牌、提交、RP、钱包和资金不得写回 CourseDefinition。
- 学员只看到其席位私密内容；课件目录只暴露 Released 静态课件，不显示导师讲稿、rubric、其他学员数据或管理入口。
- 生产根域为 Hecate 的 `minisv.vip`；不触碰 `cyberforker.com`。
- 部署前必须完成 typecheck、lint、课程平台测试、构建、浏览器／E2E 回归与生产冒烟。

## 验收

- 修改 learner01/P 导师/任一卡片边界，只改变对应 owner；global 修改明确列出影响范围。
- 2、4、6 人配置均能显示稳定席位；learner05/06 有独立任务字段与发牌身份。
- 同一 exact CourseDefinition 的 B01 在 Editor Preview、Studio Preview、中控与席位的可见数据一致。
- Test Classroom 可复制诊断身份并明确显示“与当前 Candidate 相同／不同”；旧课堂保持原 revision。
- `/course/` 从真实 Courseware 注册表只列出 P、D 已发布静态课件；导师与学生均能只读播放。
- 匿名 P/D 深链登录回跳不丢 `revision / slide / step`；原始静态路径无法绕过鉴权。
- P 课程包先完成复验与上线；D 的进度跳转和上线随后沿用同一机制完成。
