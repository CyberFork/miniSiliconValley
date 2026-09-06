# Mini Silicon Valley Classroom 发布回执

> 最新生产发布：2026-09-01（Asia/Shanghai）
> 最新本地候选：2026-09-02，饿了么已从单章恢复为完整五步，尚未部署
> 正式归属：Work 自托管；团队验收入口不是 ChatGPT Sites

## 本地候选｜2026-09-02 饿了么完整五步恢复

本轮保留战役 ID `eleme-2008-find-problem`，但将其恢复为真正可连续推进的 5 章／13 块课程，而不再在“找真问题”后直接 Demo：

- 找真问题：B01—B03，四人随机抽完 12 张卡，用毛线交换、F／R／G／U 与可推翻调查冻结问题。
- 定真方案：B04—B05，用同一订餐任务比较三条路，冻结主路、备用路与不做清单。
- 做真产品：B06—B08，做可操作 V0，用压力失败找到断点，再只因证据改出 V1。
- 进真市场：B09—B10，锁定第一小群人、十秒承诺与一个真实或明确标 R 的渠道实验。
- 跑真运营：B11—B12，跑通七步 SOP、三单订单、团队收支、个人垫付与反馈改版。
- B13：连续 360 秒／7 段 Demo，展示完整五步、四人贡献与玩家世界线／历史世界线边界。

内容边界：第 1 章以有来源的早期历史行动为叙事基底；第 2—5 章是明确标记的玩家平行世界。后四章每章只保留 2 张有来源的历史边界卡，其余 10 张全部标 R，不把课堂的方案、数字、产品或账本写成饿了么史实。

本地验收证据：

- 课堂内容：2 门课程、10 章、120 张信息卡、40 个情境身份、30 个挑战、60 个压力面、10 个历史对照。
- 学员层：18／18 聚焦验收通过；所有 60 张饿了么学员卡在历史揭晓前不泄露公司、人名或院校答案。
- 课堂 E2E：`CLASSROOM_E2E_PASS googleChapters=5 elemeChapters=5 phase=completed audit=100`。
- Work App：TypeScript、ESLint、子路径构建及完整冒烟全部通过；退役的 `/api/auth/recover` 现在明确返回 `404`，不再误报 `503`。
- LIVE RUN：28／28 单元／契约测试通过；真实课堂 API 完整跑完 13 块，每块都经“执行 → 等待人工验收”门禁。
- 九窗口：8 个手机视窗按 2 × 4 在 macOS 安全工作区 `52,33,1676×1084` 无重叠铺满，另有 1 个可置顶的 LIVE RUN SCRIPT 主控窗口。
- 脱敏回执：[`REAL_ACCEPTANCE_ELEME_RECEIPT.json`](../tools/live-run/docs/REAL_ACCEPTANCE_ELEME_RECEIPT.json) 与 [`BROWSER_ACCEPTANCE_ELEME_RECEIPT.json`](../tools/live-run/docs/BROWSER_ACCEPTANCE_ELEME_RECEIPT.json)。

当前本机已留在饿了么 B01 的“待人工验收”状态，方便团队从第一块开始人工验收。本节是本地候选回执；下方 2026-09-01 单章记录仅作历史审计，不代表当前源码能力。

## 0. 2026-09-01 饿了么 2008 单章课件与多战役框架

同事原稿 `cowork/【饿了么】游戏方案.md` 已按“只陈述材料覆盖范围、不用后见之明补齐五章”的原则，作为可独立创建、运行、结算、发布和归档的 `find-problem` 单章战役接入课堂：

- 战役 `eleme-2008-find-problem`、章节 `eleme-2008-investigate-ordering`；创建课堂时可在 Google 五章与饿了么单章之间明确选择，旧客户端不传 `campaignId` 时仍默认 Google。
- 原稿 A／B／C／结局四袋映射为完整 12 张随机手牌；4 个复合身份与手牌分别随机，仍不按角色发牌。早期协作不强制学员认领 P／D／M／O；需要进阶责任训练时才开启可轮换工作位。
- 单章包含 3 个可结算挑战、6 面压力骰、10 件团队工具、两轮行动、史实揭晓、个人复盘和七段式 360 秒调查发布；完成后直接进入 `completed`，不会寻找不存在的第二章。
- F／C 卡必须带大学公开来源；R 卡无来源并明确标记“课堂模拟”。学员层只显示具体场景、三步动作和可见产物，DM 层保留史实边界、来源、抽象方法和 10 颗调查星结算口径。
- `classroom-campaigns.ts` 成为多战役注册表；房间投影、阶段推进、来源、资产、历史揭晓、Demo Day 与导出全部按持久化的 `rooms.campaign_id` 解析，不再硬编码 Google。
- 课程目录“找问题”纵切新增饿了么案例；历史地图新增上海交通大学、饿了么、张旭豪、4 条来源和 2008 早期订餐实践事件。

生产发布证据：

- Release：`20260901T062700Z-89546c6c7525`
- 上一版本：`releases/20260901T060618Z-d6e33707bbb2`（完整生产 E2E 版本；最终包进一步把揭晓前地点收敛为“上海某所大学”）
- 排序文件清单聚合 SHA-256：`89546c6c7525950623c447bd1d0641d62726334c2846ee72f788b6c94beee7a4`
- 传输包 SHA-256：`d1f4de2154ec054b7190775963cd89efbe58abb06e386fbcfdbd0a5655831e66`
- 产物：`127` files，`6,020,560` bytes；压缩包 `3,894,627` bytes
- 发布前一致性备份：`~/Services/msv-classroom/backups/data-20260901T063601Z.tgz`，`737,395` bytes
- 最终地点谜底生产 QA 种子／清理备份：`data-qa-seed-20260901T063906Z.tgz`（`737,393` bytes）与 `data-qa-cleanup-20260901T064135Z.tgz`（`742,638` bytes）
- 服务：`running`，最终 PID `66953`；回环匿名课堂 API 为 `401`；应用首页、课堂和登录页均为 `200`

验证结果：

- TypeScript、ESLint、`git diff --check`：全部通过；基础测试 `73/73 PASS`，Work 静态测试集合 `75/75 PASS`。
- 本地 E2E 同时完成 Google 五章与饿了么单章，二者均到 `completed`；Work 账号、注册、重置、成员管理、导师指派与 RBAC 冒烟通过。
- 上一候选包完成生产六账号完整 E2E：Google `b55cd2c7-5452-4163-b622-71fc07de1bde` 完成 5 章，饿了么 `b6dcd98f-72df-464d-8724-3e1ff121fc27` 完成 1 章，`audit=100`；并发发牌房间也通过。该 E2E 明确断言揭晓前不含“饿了么”或“张旭豪”，揭晓后才恢复真实课件名。
- 最终精确产物另以生产真实 HTTP 流程创建饿了么房间 `95b98bf3-24b0-44ff-9524-9885177f66ac`，完成 DM 登录、选课建房、学员申请、DM 审批和双视角读取；加入回执、学员 Dashboard 与房间 JSON 在揭晓前均不含“饿了么”“张旭豪”“上海交通大学”，地点严格为“上海某所大学宿舍与周边餐厅”，结果 `PRODUCTION_ELEME_LOCATION_SEAL_PASS`。
- 本轮生产验收房间全部归档；最终地点 QA 的 3 个临时账号全部禁用，活动会话 `0`、活动房间 `0`；回执不记录密码、cookie 或 token，临时明文文件已删除。
- 用户课堂 `96938369-a4d4-419e-908d-7800af2ba2a8` 在发布、QA 种子、完整 E2E 和清理前后，安全快照 SHA-256 始终为 `25e8bb2aa6ed512881a0c3d3792f11a958c23dbc524637503e81478a47db5461`；`TEAM-MHKNJEAG` 的成员、发牌、阶段、账本与进度未被本轮改动。
- 本轮不需要 schema 迁移；回执不记录密码、cookie 或 token。

完整内容映射、史实边界与主持顺序见[《饿了么 2008 课件接入说明》](./ELEME_CASE_INTEGRATION.md)。

## 0.1 2026-08-31 初中生具象层与全课程四拍节奏

本轮把课程信息分成两个真正隔离的呈现层，而不是只在同一页上换几个词：

- **Young Builder层**只给具体场景、三个动作、看得见的完成物和即时反馈；不要求先理解PDMO、证据链、商业模型、历史边界等抽象框架。
- **DM／导师层**继续保留原始史料、来源、理论说明、全部挑战与压力备选、评分和经济规则，并负责在学员做过之后给方法命名。
- 五章统一采用`做 → 说 → 导师命名 → 立刻再做`：学员先完成动作，向队友讲清所见；导师只讲本轮刚用到的方法；团队马上把方法用于第二版。
- 13个课堂阶段全部改成初中生可执行的动词句，每阶段固定三步，不再让学员靠猜测“还需阅读”或“下一步是什么”。
- 五章场景、60张信息卡、20个身份、15个挑战、30个压力事件、10件工具、5次历史揭晓与六分钟Demo Day均有完整学员版；ID、可信度和来源关系保持不变。
- 身份与手牌分别随机：每章完整12张牌无重复发完，每人3张，不按P／D／M／O或身份预先绑定；导师仍可撤回与补发个别牌。

生产发布证据：

- Release：`20260831T122917Z-b10206b3e1ae`
- 上一版本：`releases/20260831T084039Z-4e4be898bd0d`
- 排序文件清单聚合 SHA-256：`b10206b3e1ae2335a4a883a1d2a704922464b56a9d8185db40b518aa2a89a782`
- 传输包 SHA-256：`3d42555bf7639cfdf5718a8d235d5841b5ec16a6fff8b840d0c7a3e09345ba4b`
- 产物：`123` files，`5,795,046` bytes；压缩包 `3,833,505` bytes
- 一致性备份：`~/Services/msv-classroom/backups/data-20260831T123627Z.tgz`，`474,138` bytes
- 服务：`running`，PID `22991`；回环匿名课堂API为`401`；网关`running/healthy`
- 新课堂客户端：`ClassroomApp-CcaLfqO1.js`，生产返回`200`

验证结果：

- TypeScript、ESLint、`git diff --check`：全部通过。
- 课堂单元与内容隔离测试：`31/31 PASS`；全仓测试：`66/66 PASS`；导师手册契约：`4/4 PASS`。
- 本地完整五章E2E：`CLASSROOM_E2E_PASS ... chapters=5 phase=completed audit=100`。
- Work认证、注册、重置、成员审批、导师指派与RBAC冒烟：`WORK_APP_SMOKE_PASS`。
- 生产临时六账号完整五章E2E：`CLASSROOM_E2E_PASS room=975c9b88-6aee-4364-97f4-36c5677d812d chapters=5 phase=completed audit=100`；同时通过并发重复入队折叠与随机发牌唯一性验证。
- 生产验收产生的2个技术房间均已归档；6个临时QA账号全部禁用，活动会话`0`、活动QA房间`0`，本地与远端临时明文文件已删除。
- 公共应用、登录、注册、找回、地图、课程框架与Launch均返回预期状态；未出现Basic Auth挑战；新客户端包含全部具象化交互文本。
- 用户课堂`96938369-a4d4-419e-908d-7800af2ba2a8`发布前、发布后及完整E2E清理后快照SHA-256始终为`83172389f1c3242100a3b28c4a87209f6f7fc413f000588432357ca6f530cd1c`，既有成员、发牌、阶段、账本和进度均未被改动。
- 本轮没有schema迁移，不记录密码、cookie或token。

完整分层规则见[《初中生／导师双层内容与课堂节奏》](./STUDENT_MENTOR_LAYERING.md)，现场主持步骤见[《终极管理员／DM 导师主持人操作手册》](./ADMIN_DM_UI_OPERATION_MANUAL.md)。

## 0.2 2026-08-31 集结大厅行动入口与管理员／DM操作手册

生产验收复现了用户所见的“点击后没有反应”：课堂处于 `lobby` 时，阶段元数据把所有角色都导向 `mission`；而用户本来已经在任务大厅，因此按钮只执行了一次 `setTab("mission")`，界面、焦点和滚动都不变化。顶部 NOW 区的“进入当前工作区”也有同一根因。

本轮完成了角色相关的当前工作区导航：

- DM在集结大厅的真实操作目标改为 `导师控制台`；Young Builder仍停留在任务大厅等待审批。
- 任务大厅按钮明确写成 `去导师控制台完成当前阶段：集结大厅 →`。
- NOW按钮明确写成 `进入导师控制台 →`；左侧 `NOW` 标记同步落在导师控制台。
- 顶部阶段栏、左侧工作区、NOW入口和任务大厅入口统一经过同一导航函数。
- 切换后聚焦 `#classroom-main` 并滚动到主工作区；开启“减少动态效果”时使用即时滚动。
- 新客户端使用不可变文件名，旧客户端文件返回 `404`，避免一年缓存继续执行旧空操作。

同时交付了与生产界面逐项对齐的[《终极管理员／DM 导师主持人操作手册》](./ADMIN_DM_UI_OPERATION_MANUAL.md)：

- 区分平台RBAC、课堂DM关系和P／D／M／O学员席位。
- 覆盖管理员建课、指派导师、申请审批、直接添加、发牌、13阶段门槛、两轮攻坚、经济、史实、复盘、Demo Day、导出和归档。
- 明确顶部13阶段圆点只切换工作区，真正推进在导师控制台。
- 将当前 `TEAM-MHKNJEAG` 的最后一人手动申请写成十步快速路径。
- 使用生产验收截图标注“当前动作按钮”和进入后的导师控制台。
- 旧DM手册和团队验收手册中不一致的发牌、发布、两轮挑战与复盘步骤已经同步纠正。

生产发布证据：

- Release：`20260831T084039Z-4e4be898bd0d`
- 上一版本：`releases/20260830T134535Z-122ee1f6e5bd`
- 排序文件清单聚合 SHA-256：`4e4be898bd0d5b2bd6ba718d058ee93642cc179acd0722a33051dfb95cd1e51c`
- 传输包 SHA-256：`e43b42edce5e8b8423c2426f9d4d7287bf6223cd37c243e87b225d3681c549ba`
- 产物：`144` files，`6,058,118` bytes；压缩包 `3,881,401` bytes
- Build ID：`msv-lobby-guide-07bdce59c6fb`
- 一致性备份：`~/Services/msv-classroom/backups/data-20260831T084658Z.tgz`
- 服务：`running`，PID `88013`；网关：`running/healthy`
- 新客户端：`ClassroomApp-MSVLobbyGuide-07bdce59c6fb.js` 为 `200`；旧客户端为 `404`

验证结果：

- TypeScript、定向ESLint、交互／规则／文档测试：`27/27 PASS`；`git diff --check`：`PASS`。
- 完整Work应用冒烟：`WORK_APP_SMOKE_PASS`。
- 本地产物真实浏览器：两个入口都打开导师控制台，焦点为 `classroom-main`，页面错误 `0`。
- 生产真实账号：`msv-owner` 与被指派的 `msv-mentor-01` 都完成两个入口和10个工作区逐项验收；页面错误 `0`。
- 管理员看得到授课导师管理表单；被指派导师只看到权限说明，RBAC与实际手册一致。
- 生产公共应用、登录、注册、找回、地图、课程框架、Launch和新客户端均为 `200`；匿名课堂API为 `401`。
- 验收前后用户测试课堂安全快照完全一致：仍为 `active/lobby`、版本 `11`、Alpha Team `3/4`、学员02/03/04、四位导师加创建者、无待审批、无发牌、无挑战；`msv-student-01` 仍保留给用户手动申请。
- 本轮无schema迁移，不记录密码、cookie或token。

## 0.3 2026-08-30 登录普通点击修复与团队测试阵容就绪

生产复现确认：登录页“还没有账号？直接注册 Young Builder”的 `href` 一直正确，但普通单击被生成的客户端 Link 路由截获后，在 `link-HOJMJXgf.js` 抛出 `TypeError: e is not a function`，因此地址和页面都不变化；`Ctrl`／`Command` 点击会绕过该客户端路由并执行浏览器原生导航，所以能够打开新页。

本轮不是只给一个按钮加临时事件，而是清除了应用中同类故障源：

- 登录、注册、找回、认证导航、账户中心和课堂导航全部改为带 Work 子路径的原生 `<a>`。
- 登录页“直接注册 Young Builder”“忘记密码”、注册页“返回登录”和找回页“返回登录”均由浏览器直接导航。
- 账户中心与课堂中的跨页入口同步处理，避免下一个页面出现相同的“普通点击无反应”。
- 三个客户端入口全部更换 immutable 文件名，旧缓存文件返回 `404`。

同时按团队测试要求整理真实课堂 `TEAM-MHKNJEAG`：

- `msv-student-02/03/04` 已分别进入 Alpha Team 第 `1/2/3` 席，当前为 `3/4`。
- 临时验收账号 `lintron` 已移出该测试队伍，为正式四人测试阵容释放席位。
- `msv-student-01` 当前没有membership、没有待审批申请，可由团队手动完成最后一次申请与审批。
- `msv-mentor-01/02/03/04` 全部获得该课堂 `dm` membership；四位导师均不占学员席位。
- 课堂仍为 `active/lobby`，尚未发牌或推进剧情。

生产发布证据：

- Release：`20260830T134535Z-122ee1f6e5bd`
- 上一版本：`releases/20260830T062000Z-00097c4ce192`
- 排序文件清单聚合 SHA-256：`122ee1f6e5bdd189322467fb6fcddba2baf80df9e858d4c9bfe3f0cd1b997790`
- 传输包 SHA-256：`9882702bf8148e94db78568969146c06a83f693e66e5663c8d0e0da86a57eba4`
- 产物：`144` files，`6,056,874` bytes；压缩包 `3,880,697` bytes
- Build ID：`msv-native-nav-831f684d6abe`
- 一致性备份：`~/Services/msv-classroom/backups/data-20260830T134843Z.tgz`
- 服务：`running`，PID `36083`；网关：`running/healthy`
- 新客户端 `AuthForms-MSVNativeNav-f78305731975.js`、`AccountClient-MSVNativeNav-d9e137748355.js`、`ClassroomApp-MSVNativeNav-d4c0e83883dd.js` 均为 `200`
- 对应上一版三个客户端文件均为 `404`

验证结果：

- 源码校验与交互契约：`16/16 PASS`
- TypeScript 定向类型检查、`git diff --check`：`PASS`
- Work app 完整冒烟：`WORK_APP_SMOKE_PASS ... facilitator=assign-host-remove rbac=server-enforced`
- 生产无头浏览器真实普通单击：登录 → 注册 → 登录 → 找回 → 登录全部成功
- 生产点击过程中页面脚本错误：`0`
- 生产结果：`PRODUCTION_NATIVE_NAVIGATION_PASS`
- 应用首页、登录、注册、找回、公共地图、课程框架和 Launch 页面均为 `200`
- 重启后测试阵容仍为三名学员、四名授课导师和一名最终负责人，数据持久化通过
- 本轮无 schema 迁移，不记录密码、cookie或token

## 0.4 2026-08-30 管理员代建课堂的授课导师指派修复

截图验收暴露了一个真实的关系缺口：平台已经区分 `admin/mentor/learner`，课堂也已经区分 `dm/learner`，但管理员创建课堂后，没有入口把另一个 `mentor` 账号指派为该课堂的 `dm`。因此导师既不能占用学员席位，又没有其他方式进入管理员代建的课堂。

本轮将三层关系彻底分开：

- **平台RBAC**：`admin/mentor/learner/observer` 决定账号能做哪类平台操作。
- **课堂主持关系**：课堂创建者是最终负责人；创建者或平台管理员可按准确用户名指派 active `mentor/admin` 为“授课导师”。被指派账号获得该房间的 `dm` membership，并自动在自己的课堂列表看到课程。
- **学员队伍关系**：`TEAM-XXXXXXXX` 只用于 Young Builder 申请P／D／M／O席位。导师不是队员，不使用队伍ID，也不占4个学员席位。

课堂界面新增独立的“授课导师”管理区，当前DM会明确标记“课堂创建者”或“授课导师 · DM”。被指派导师可以发牌、推进阶段、裁决和管理学员；只有课堂创建者或平台管理员能增删授课导师，创建者不可被移除。每次指派和移除都进入审计日志，移除立即撤销该房间访问。

生产发布证据：

- Release：`20260830T062000Z-00097c4ce192`
- 上一版本：`releases/20260830T051814Z-901111d3120f`
- `dist/` 聚合 SHA-256：`00097c4ce192a01b361f7746ae56a2753229fe23e6b3f086567bf37e0027d9c9`
- 传输包 SHA-256：`26114f615831073c223b3d9657b6976a2995aa528215e2506c3b6136739510fb`
- 产物：`144` files，`6,056,524` bytes；压缩包 `3,880,233` bytes
- 一致性备份：`~/Services/msv-classroom/backups/data-20260830T062410Z.tgz`
- 服务：`running`，PID `76465`；回环未登录课堂 API 为 `401`
- 网关：`running/healthy`；应用首页、登录、公共地图、课程框架和 Launch 页面均为 `200`
- 新客户端：`ClassroomApp-MSVFacilitator-7e238931481b.js` 为 `200`；旧客户端 `ClassroomApp-MSVJoin-dab2e034f4.js` 为 `404`

验证结果：

- 课堂动作校验与交互契约：`15/15 PASS`
- TypeScript 定向类型检查：`PASS`
- Work app 全流程冒烟：`WORK_APP_SMOKE_PASS ... facilitator=assign-host-remove rbac=server-enforced`
- 生产双账号验收：`PRODUCTION_FACILITATOR_ACCEPTANCE_PASS`
- 真实课堂 `TEAM-MHKNJEAG`：创建者 `msv-owner` 保持 `admin + room dm`；`msv-mentor-01` 已指派为 `mentor + room dm`
- `msv-mentor-01` 已能看到并主持房间 `96938369-a4d4-419e-908d-7800af2ba2a8`，但不能改动授课导师名单
- 指派前后 Alpha Team 学员数均为 `1`；导师的 `team_id` 与 `seat` 均为空，没有占用学员席位
- 导师再次提交队伍ID仍返回 `LEARNER_ACCOUNT_REQUIRED`；这是一条保留的安全边界，不再是进入课堂的唯一入口
- `facilitator.assign` 审计事件已写入；课堂仍为 `active/lobby`，既有学员、队伍和进度未被修改
- 本轮无 schema 迁移，不移动数据目录，不记录密码、cookie或token

## 0.5 2026-08-30 队伍ID防错修复

截图验收确认：生产队伍 `TEAM-MHKNJEAG` 一直存在；学员页实际提交的是另一个值 `TEAM-MSVMENTO`。根因不是课堂或数据库丢失，而是旧复制交互无法保证剪贴板写入成功，学员可能粘贴到旧内容，错误页又没有回显本次提交值。

本轮已完整修复：

- DM队伍卡新增“复制入队链接”；链接携带经过白名单校验的稳定队伍ID。
- 未登录学员打开链接时，队伍ID会穿过登录／注册返回路径；进入课堂后自动填入，并明确要求与导师页面再次核对。
- “复制队伍ID”和“复制入队链接”都有 Clipboard API、传统复制和手动复制三层降级，并在同一管理区回显实际复制内容。
- 队伍不存在时，API明确回显学员本次实际提交的ID，不再只显示泛化错误。
- 客户端 JS/CSS 使用新内容哈希文件名，旧资产返回 `404`，避免浏览器一年的 immutable 缓存继续使用旧交互。

生产发布证据：

- Release：`20260830T051814Z-901111d3120f`
- 上一版本：`releases/20260829T141046Z-8b8d99c75b13`
- `dist/` 聚合 SHA-256：`901111d3120f20347ed54123fc1a2056d8dbe601e0942ca3efa65b33c463fcc2`
- 传输包 SHA-256：`157ed3d0371c2dc955c4d1c8c7264b094ca5417414a32b252a3482668bc47d6a`
- 产物：`144` files，`6,033,908` bytes；压缩包 `3,875,420` bytes
- 一致性备份：`~/Services/msv-classroom/backups/data-20260830T052032Z.tgz`
- 服务：`running`，PID `66357`；回环未登录课堂 API 为 `401`
- 网关：`running/healthy`；公共地图、课程框架与 Launch 页面均为 `200`

验证结果：

- 队伍ID规范化／课堂交互契约：`15/15 PASS`
- Work app 全流程冒烟：`WORK_APP_SMOKE_PASS`
- 生产真实学员登录、共享链接、缓存破除、错误ID回显与退出：全部通过
- 生产五账号五章节 E2E：`CLASSROOM_E2E_PASS room=20f4828e-931b-4279-b35d-209dfd4a8f29 chapters=5 phase=completed audit=100`；技术房间已归档
- 用户原课堂仍为 `active/lobby`，`TEAM-MHKNJEAG`、`Alpha Team` 和既有数据均未改变，待审批申请为 `0`
- 本轮无 schema 迁移，不移动数据目录，不记录密码、cookie或重置 token

## 1. 正式入口

- 产品首页：<https://work.cyberforker.com/msv/demo/app>
- 登录：<https://work.cyberforker.com/msv/demo/app/auth/login>
- 开放注册：<https://work.cyberforker.com/msv/demo/app/auth/register>
- 找回说明：<https://work.cyberforker.com/msv/demo/app/auth/recover>
- 账户中心：<https://work.cyberforker.com/msv/demo/app/account>
- Young Builder Classroom：<https://work.cyberforker.com/msv/demo/app/classroom>
- 公共历史地图：<https://work.cyberforker.com/msv/demo.html>
- 课程框架：<https://work.cyberforker.com/msv/123456.html>

匿名用户可以打开首页和认证页面；账户中心与课堂在未登录时跳转到应用登录页。公网响应没有 `WWW-Authenticate`，因此不会再出现浏览器 Basic Auth 弹窗。

## 2. 本轮最终产品规则

- 所有人都可以用用户名、显示名称和密码自行注册；公开注册固定创建 `learner`。
- 登录只使用用户名和密码。
- 学员忘记密码时，由有权限的 DM 生成 30 分钟有效、只能使用一次的重置 URL；URL 把 token 放在 fragment 中，数据库只保存摘要。
- `admin/mentor` 由代码或后台配置；特权账号不能走学员网页重置流程。
- 学员输入稳定的 `TEAM-XXXXXXXX` 队伍 ID 后只生成待审批申请，不获得课堂访问权。
- DM 可以批准或拒绝申请，也可以按用户名／昵称搜索后直接添加，随时移出成员，并在集结大厅创建更多队伍。
- 平台角色与课堂角色分离：`mentor/admin` 决定能否创建课堂，具体房间中的 `dm` membership 决定能否主持该课堂。
- 历史认证表只为兼容审计历史而保留；对应旧路由已删除，旧的未使用凭据已经统一失效。

完整规则见 [`AUTHENTICATION.md`](./AUTHENTICATION.md)，现场步骤见 [`TEAM_ACCEPTANCE_GUIDE.md`](./TEAM_ACCEPTANCE_GUIDE.md)。

## 3. 已发布版本

应用：

- Release：`20260829T141046Z-8b8d99c75b13`
- 上一版本：`releases/20260829T123129Z-affc2ee8c0b5`
- `dist/` 排序逐文件聚合 SHA-256：`8b8d99c75b1345b8a4b597a57d85cdbd2201b5f002289bbacc314819c37d0c39`
- 传输包 SHA-256：`aa65cf8456f08ff534999a6d9e7428a44d006de77e49a543b0dce75b90bc66ab`
- 产物：`144` files，未压缩 `6,026,622` bytes，压缩包 `3,873,662` bytes
- 运行时：Node `v25.9.0`、Wrangler/workerd `4.92.0`
- 服务：`com.cyberforker.msv-classroom`，回环 `127.0.0.1:18787`
- 数据：`~/Services/msv-classroom/data`，与 release 完全分离

网关：

- Nginx 宿主与容器配置 SHA-256 均为 `89c1b83f3a8464bedb8f48ac8876ba1c9582679f92ea502e62d180135d93d2e9`
- `work-sync-gateway` 为 `running/healthy`，`nginx -t` 通过
- 应用路由清空 `Authorization` 与旧身份头，仅把 `/msv/demo/app/*` 转给回环 Worker
- 认证 API 有边缘粗限流；应用内部仍执行身份、同源、体积和频率限制

源码基线为 `55c2cd8e9859`；本轮发布内容以产物哈希为准，未执行 Git commit/push。

## 4. 数据迁移与安全结果

发布前停服并创建一致性备份：

- `~/Services/msv-classroom/backups/data-before-20260829T141046Z-8b8d99c75b13.tgz`
- 备份大小：`203,836` bytes

迁移后：

- 业务表总数：`28`
- `auth_reset_tokens`：存在
- 未消费旧登录凭据：`0`
- 未消费旧个人恢复凭据：`0`
- 未撤销旧注册凭据：`0`
- 新重置 token 只存 SHA-256 摘要；并发消费使用原子 claim
- 重置成功会撤销目标账号的旧会话；同一 token 重放返回 `401`
- DM 只能为自己课堂中的成员或待审批学员生成链接；特权账号返回 `403`

生产验收临时创建了 8 个 `qa-*` 账号。验收结束后全部标记为 `disabled`，活跃 QA session 为 `0`，活跃 QA 房间为 `0`；临时密码、cookie、seed SQL 和重置 URL 均已从本机与远端 `/tmp` 删除。

## 5. 自动化质量门

`npm run test:release` 完整通过：

- TypeScript：通过
- ESLint：`0` warning
- 普通构建、Work 静态构建、Work app 子路径构建：通过
- 核心测试：`50/50`
- Work 全量测试：`52/52`
- 本地五任务 E2E：`CLASSROOM_E2E_PASS ... chapters=5 phase=completed audit=100`
- Work 认证与成员冒烟：`WORK_APP_SMOKE_PASS auth=password registration=open reset=single-use-fragment team=request-approve-direct-add-remove rbac=server-enforced`

其他门禁：

- 数据目录：8 era、203 event、66 source、8 mission、6 curriculum stage、18 example，`0 error / 0 warning`
- plist：通过 `plutil -lint`
- 117 个源码／文档文本文件：无尾随空白、无冲突标记
- 响应式契约覆盖桌面、平板、390px 手机、键盘焦点、reduced motion 和 Work 子路径

## 6. 生产验收证据

### 6.1 认证与队伍管理

在正式生产数据库和正式 release 上通过：

```text
PRODUCTION_AUTH_SMOKE_PASS
registration=open
reset=fragment-single-use
team=pending-approve-direct-add-remove-create
rbac=mentor-scoped
```

覆盖：开放注册、重复用户名、学员建房拒绝、观察员入队拒绝、`TEAM-XXXXXXXX` 申请、待审批无访问、DM 审批、待审批学员密码协助、fragment 重置、旧 session 撤销、token 重放拒绝、搜索直加、移出撤权、第二队创建和特权账号网页重置拒绝。技术房间 `6a342d7a-7206-423b-abe7-448f079011b5` 已归档。

### 6.2 完整五任务战役

完整战役在生产主机通过正式 Worker 与正式持久 D1 回环执行；公网入口另做独立 ingress 回归，避免把外部链路抖动误判为业务失败。

- 结果：`CLASSROOM_E2E_PASS`
- 房间：`a8535f41-9dd9-4df4-8569-a67d9d2ed57b`
- Google M01—M05：全部完成
- 最终阶段：`completed`
- 最近审计事件投影：`100`
- 并发入场、四席唯一、私密手牌、情报网、PDMO、两轮挑战、三账户经济、资产、史实揭晓、六问复盘和六分钟 Demo Day：全部通过
- 主战役与并发技术房间均已归档

### 6.3 公网与共享路由

- `/msv/demo/app`：`308` 到规范尾斜杠
- 首页、登录、开放注册、找回说明、重置页：`200`
- 匿名账户中心、课堂：`307` 到应用登录页
- 匿名 session API：`401`
- 已退役认证 API：`404`
- 无 `WWW-Authenticate`
- CSP、Permissions-Policy、Referrer-Policy、`nosniff`、`DENY`、`X-MSV-App-Origin`：存在
- `/msv/demo.html`、`/msv/123456.html`、`/msv/launch.html`、`/golfnine/index.html`：`200`
- `/`：保留 SFTPGo 原有 `302`

### 6.4 重启持久化

1. 验收账号登录并读取已归档、已完成战役。
2. `launchctl kickstart -k` 将服务 PID 从 `22749` 切换为 `25152`。
3. 重启前创建的 session 仍可识别。
4. 同一已完成房间仍为 `archived/completed`。
5. 验证后立即撤销 session 并再次停用 QA 账号。

正式库仍保留用户已有的 `msv-dm` 集结大厅课堂；本轮没有修改或归档该业务房间。

## 7. 回滚证据

- release 在切换前完成解包、文件数和聚合哈希校验。
- 应用切换使用 macOS 安全的 `mv -h -f` 原子换链。
- 健康失败会自动切回 `releases/20260829T123129Z-affc2ee8c0b5`。
- 数据目录不随 release 切换；恢复必须停服后使用一致性备份。
- 当前服务为 `running`，PID `25152`，回环未登录 session 检查为 `401`。

逐命令 SOP 见 [`WORK_APP_RUNBOOK.md`](./WORK_APP_RUNBOOK.md)，架构见 [`CLASSROOM_ARCHITECTURE.md`](./CLASSROOM_ARCHITECTURE.md)，主持流程见 [`DM_MENTOR_MANUAL.md`](./DM_MENTOR_MANUAL.md)。
