# AI 投屏互动统一修复 · 2026-09-24

根因：deck-runtime 的 MSVAiLessons.wire 在 controlled=1 时传 null，将全套 AI 按钮设为 disabled。controlled 应代表教师同步，而非只读。

- 移除 AI 共用 wire 的 controlled/null 分支。保持已有 setState(..., true) 向教师发布状态，不改变当前页。
- 保留教师下一页缩略图只读、三问结束限制、先同步再验收的业务规则。
- 审计其他交互：模块地图/3D关系/拆装/WHY tabs/背包3D/接口/回顾均有投屏回调；小游戏仍可显式接管，未修改其锁和权限。
- 测试实际执行 10 页、88 组 AI 按钮绑定（普通＋controlled），校验启用、reduce 结果、发布、页码不变。
- VM 执行真实教师接收器，确认投屏状态进入教师渲染，跨 session 消息被忽略。
- Native Safari 实际打开 controlled=1 的 AI-02，点击「说清楚再做」，内容从模糊要求切换为两格／满包拒收／带钥匙成功。真实双窗口点击复测受系统 UI 会话中断影响未完成，不代签。
- AI merge、73 个游戏/工坊、88 个部署测试通过。无文字迁移，无课件 revision 升级。

已部署 20260924-audience-controls。2098 个原课件文件字节未改；在线版本及投屏 runtime 哈希匹配测试产物，r23 不变。
