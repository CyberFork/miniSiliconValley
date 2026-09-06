# Mini Silicon Valley 完整收口目标

## 目标

按 `T-075 → T-073 → T-078/T-079/T-080/T-084 → T-076 → T-082 → T-081` 完成课程单一真相链、统一课程语义、入口与编辑器、地图交互、Alpha 可读性、品牌及 Workshop 只读回写，并发布到 Hecate 的 `minisv.vip`。

## 不可妥协约束

- 课程正文只有一份结构化 JSON Course Package；编辑器、Alpha、Classroom 和 Workshop 不复制业务文案。
- `Candidate → Alpha 人工逐块验收 → Released → 新课堂 exact 绑定`；历史 revision、既有正式课堂和验收回执不可静默改写。
- “全部刷新 Alpha”保留 Run ID、执行位置、成员、提交、评分、RP、个人钱包、团队资金和稳定手牌；与重置严格分离。
- 学员统一为 Young Builder，不固定 P/D/M/O；P/D/M/O 只表示四类导师专业分工。
- 课程统一为五步创业闭环与六分钟 Demo Day；事实、模拟、推测、未知边界始终可见。
- 不修改或重写同事 `cowork/chj` 原稿及其 `/course/` 发布内容；`/framework/` 是本项目自有方法页，可以统一站点品牌。
- 不触碰 `cyberforker.com` 主站；只部署 Hecate 和 `minisv.vip`。
- 内部发布接口必须 loopback + service key 防护；密钥不进入 Git、日志或前端。

## 验收

- Google、饿了么均为 5 步 / 13 Block / 5 卡组，每组至少 12 张，Course Package digest 跨 Python/TypeScript 一致。
- 编辑器保存只产生 Candidate；Alpha 显式刷新；13 Block 逐块验收生成 exact approval；Released 指针原子推进。
- 正式课堂只读取 Released；创建时写入 exact revision/digest；发布新版本不改变旧课堂。
- 四导师、四学员、随机 4×3 发牌、三类玩法、RP/个人钱包/团队资金和 Demo Day 完整可运行。
- 相关 TypeScript、Python、网关、构建、响应式与生产只读冒烟测试全部通过。
- 所有目标页面由 `https://minisv.vip/` 导航可达，部署回执和操作文档完整。

## 执行顺序

- [x] T-075 课程版本单一真相链
- [x] T-073 四导师 / Young Builder / 五步语义统一
- [x] T-078、T-079、T-080、T-084 快速收口
- [x] T-076 Alpha 九窗口可读性
- [x] T-082 Logo 与统一品牌入口
- [x] T-081 Workshop Released 只读回写
- [ ] 全量测试、Hecate 部署、生产验收与回执
