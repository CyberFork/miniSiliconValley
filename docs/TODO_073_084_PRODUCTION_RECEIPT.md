# T-073—T-084 课程真值链生产收口回执

> 完成日期：2026-09-07（Asia/Shanghai）
>
> 生产域名：<https://minisv.vip/>
>
> Hecate Release：`20260907T180022Z-truth-chain-final2`
>
> 部署源码：`40c652b562a7634135ff645a9c3cddf32a9da784`

本回执覆盖以下执行顺序：

```text
T-075
→ T-073
→ T-078 + T-079 + T-080 + T-084
→ T-076
→ T-082
→ T-081
```

地图 Hover 任务已使用唯一编号 `T-084`，不再与 Logo 任务 `T-082` 冲突。

## 1. 最终产品结果

### T-075｜一份课程真值

- 唯一写入口是 `/control/editor/`；保存生成新的不可变 Candidate revision，不原地覆盖旧版本。
- Alpha 只在创建新 Run 或人工执行“全部刷新 Alpha”时绑定指定 Candidate；保存不会静默改变进行中的 Run。
- 只有完成 13 个 Block 人工验收的 exact revision/digest 才能成为 Released。
- 正式 Classroom 创建房间时固化 exact Released revision/digest；后续发布不会改写既有房间。
- 文件 Registry 与 Classroom 的 D1 兼容持久层使用同一课程摘要、版本号和 digest 校验规则。
- 内部发布桥只允许 loopback 加 service key；对应公网路由统一返回 `404`。

### T-073｜一套课程语义

- 一个世界：真实科技创业有限开放世界。
- 两条双轨：历史认知轨与现实创业轨。
- 三类玩法：探索、情境、决策。
- 四类导师：P 产品、D 开发、M 市场、O 运营。
- 五个步骤：找真问题、定真方案、做真产品、进真市场、跑真运营。
- 六分钟 Demo Day 是五步完成后的终局，不是第六步。
- 学员身份统一为 Young Builder，不固定分配 P／D／M／O；历史角色卡仍属于情境 RPG。
- F／R／G／U 始终表达“有来源／课堂模拟／我们猜的／还不知道”，避免把平行世界推演写成史实。

### T-078、T-079、T-080、T-084｜入口与编辑体验

- 全站课程入口统一指向 `/course/`，旧 `/123456` 只保留兼容跳转。
- 编辑器课程库可折叠，不再长期挤压主编辑区；桌面和窄屏保持同一信息结构。
- 卡牌编辑提供当前卡片就地保存动作，保存状态与 Candidate 版本动作分层显示。
- World 地图提升当前 hover、键盘 focus 和 active 热点的父 stacking context；提示卡不再被相邻节点压住，并有浏览器回归测试。

### T-076｜Alpha 九窗口可验收

- 1 个 LIVE RUN SCRIPT 主控加 8 个独立席位，席位固定为 4 位导师与 4 位 Young Builder。
- 主控按 13 个 Block 人工执行、人工验收后才推进；8 席实时读取同一 Run、课程版本和块位。
- 导师席显示专业责任与本块主责／支援关系；学员席只显示可执行动作、私人信息、个人 RP、个人钱包和团队资金。
- 信息卡随机发放，不按学员 P／D／M／O 划分；4 人获得 12 张互不重复卡片。
- 宽度、溢出、卡片弹窗与 2 × 4 席位布局均有自动化浏览器验收资产。

### T-082｜统一品牌入口

- **2026-09-12 纠正：**原结论错误地把浏览器 favicon 当成页面 Logo，现已由 `public/assets/mini-silicon-valley-logo-transparent.png` 正式字标替代；`public/favicon.svg` 仅保留为浏览器元数据。
- Next 页面、认证、账户、Classroom、Alpha、Control、Editor、Workshop、家长页和 404 使用一致的品牌／主页入口契约。
- 左上角品牌使用真实链接返回 `/`，支持键盘 focus；编辑器存在未保存内容时保留离开确认。
- `/course/` 是同事交付的独立课件产物，不注入品牌、不改写内容，以字节不变方式发布。

### T-081｜Workshop 只读基线

- Workshop 展示从 exact Released 生成的 `public-redacted` 快照，而不是读取 Alpha Run 或正式课堂运行数据。
- 基线、讨论提案、会议决议和待回流变更保持分层；Workshop 不能直接写入 Candidate 或 Released。
- 更新失败时保留上一份有效快照；快照包含 source revision/digest 和自身 integrity digest。

## 2. 生产课程证据

饿了么课程完成了真实生产验收与发布：

- Course ID：`eleme-2008-find-problem`
- Released revision：`9`
- Course digest：`5e18ab82b30cd6f61b37bb4d0d217c1ef3b2a795354a16d9a2ce3c6a5f4ab4e4`
- Alpha Run：`run-20260907-014609-04bf7f`
- Alpha Room：`f7466050-295f-4bd8-9097-05b9e5995fac`
- Alpha Team：`TEAM-G5KHXL6Z`
- 结构：5 个宏步骤、13 个 Block、4 位导师、4 位学员、12 张无重复随机手牌。
- 学员 PDMO 字段计数：`0`。
- 结果：13 个 Block 均通过人工验收，Run 状态为 completed。

发布后又创建正式 Classroom 房间，验证新房间精确绑定 Released r9 与同一 digest；验证房间随后归档。服务重启后，Alpha 完成态、验收记录与 Released 指针仍保持一致。

Workshop 当前快照：

- Integrity digest：`93cf31150b241268c3ab6bdd76c1563dc9e8831774e9ccf8791e5b855e7c94cb`
- 包含：饿了么 r9 与 Google r0 的公开脱敏摘要。

## 3. 生产站点地图

- 总导航：<https://minisv.vip/>
- 历史世界：<https://minisv.vip/world/>
- 课程大纲：<https://minisv.vip/course/>
- 正式课堂：<https://minisv.vip/classroom/>
- Alpha 席位：<https://minisv.vip/alpha/>
- LIVE RUN 主控：<https://minisv.vip/control/>
- 课程编辑器：<https://minisv.vip/control/editor/>
- 课程框架：<https://minisv.vip/framework/>
- 家长问答：<https://minisv.vip/parents/>
- Workshop：<https://minisv.vip/workshop/>

`/course/` 发布产物固定来自同事已批准源码：

- Source commit：`679213a61b835335016eac7649213983a0e48489`
- Source tree：`3a041c4714190cc026f6de8e06e15cec0e5f765d`
- 发布产物 digest：`e39ebedc1b4b68230e551deeab9860ba6ce1a608c7b400d21c12d87f8f17b8f9`
- 产物：103 files，114,365,669 bytes。

同事源码 checkout 保持 clean；本轮没有修改其内容。

## 4. 验证矩阵

全部测试在部署源码上通过：

```text
npm run test:release       PASS
├─ npm test                27 / 27
├─ Classroom E2E           Google 5 步 + 饿了么 5 步，均 completed
├─ Work tests              100 / 100
├─ Work app smoke          PASS
└─ MiniSV native smoke     PASS

LIVE RUN Node              15 / 15
LIVE RUN Python            77 / 77
Deploy / gateway Python    20 / 20
UI theme runtime           1 / 1
git diff --check           PASS
```

生产只读验证：

- Hecate healthcheck 覆盖 `/healthz`、主页、World、Course、Framework、Parents、Workshop、Alpha、Classroom 和 Control。
- 公网 smoke 覆盖 HTTP→HTTPS、规范斜杠跳转、静态资源、登录入口、自定义 404、安全头和 `X-MiniSV-Origin: hecate`。
- Playwright 在 320、390、768、1440 宽度检查主页、注册、找回、家长页和 404；无横向溢出，品牌与主页入口一致。
- Course Registry 三个内部接口从公网访问均为 `404`。
- 最终发布的 `MANIFEST.sha256` 校验通过。

## 5. 部署与回滚

当前原子链接：

```text
~/Services/minisv/current
  → releases/20260907T180022Z-truth-chain-final2
~/Services/msv-classroom/current
  → releases/20260907T180022Z-truth-chain-final2
~/Services/msv-parent-qa/current
  → releases/20260907T180022Z-truth-chain-final2
```

可用备份：

- 发布前：`~/Services/minisv/backups/20260906T172530Z-pre-20260907T172412Z-truth-chain-pre`
- 最终站点：`~/Services/minisv/backups/20260906T180137Z-20260907T180022Z-truth-chain-final2`
- 最终动态服务：`~/Services/minisv/backups/20260906T180855Z-20260907T180022Z-truth-chain-final2-dynamic`

回滚仍使用 Hecate 原子切换脚本，并在回滚后重新执行健康检查与公网 smoke。运行密钥只存在 Hecate 的受控 secrets 目录，不进入 Git、构建产物、浏览器或本回执。

## 6. 结论

九个 Todo 已从“页面功能列表”收口为同一条可审计链：编辑器产生不可变 Candidate，Alpha 对 exact 版本逐块验收，Released 原子推进，正式课堂精确绑定，Workshop 只读投影。课程语义、学员／导师边界、页面入口、品牌、地图交互和生产部署均由自动化测试与真实生产 Run 双重证明。
