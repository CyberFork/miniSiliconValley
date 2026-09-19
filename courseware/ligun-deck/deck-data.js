(function () {
  "use strict";
  window.MSV_MODULE_DECK = Object.freeze({
  "id": "ligun-p2",
  "version": "2026.09.19-p2-r2",
  "title": "立棍｜把我的游戏交给 AI，一步步做对",
  "footer": "立棍 · 说清楚，做一轮，再验证",
  "slides": [
    {
      "id": "ligun-01",
      "source": "P2-01",
      "phase": "01 · 别让 AI 跑偏",
      "section": "别让 AI 跑偏",
      "minutes": 4,
      "title": "一句话，AI 就能开工吗？",
      "subtitle": "旧例子：请帮我做一个校园设备预约系统，越快越好。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>到底给谁用</h3><p>学生想预约，管理员要管设备；他们看的内容一样吗？</p></article><article><h3>什么算预约成功</h3><p>看到按钮变绿，还是预约真的保存、不会撞时间？</p></article><article><h3>哪些不该收</h3><p>预约设备不需要家庭住址和家长手机号。</p></article><article><h3>先投票</h3><p>一句话够不够？选一个你最想追问的问题。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>跑得快，不等于跑对方向。</span></div>"
    },
    {
      "id": "ligun-02",
      "source": "P2-02",
      "phase": "01 · 别让 AI 跑偏",
      "section": "别让 AI 跑偏",
      "minutes": 4,
      "title": "漂亮页面，为什么还是没做好？",
      "subtitle": "设备预约的三个坑，也会出现在你的游戏里。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>同一台设备被订两次</h3><p>像同一条线索被重复记成三条。</p></article><article><h3>屏幕说成功，实际没保存</h3><p>像背包图标亮了，但重开就什么也没有。</p></article><article><h3>顺手加了不需要的功能</h3><p>像你只要寻宝，它却先做商城和排行榜。</p></article><article><h3>复杂度在增加</h3><p>分支、状态、失败越来越多；不能靠你盯住每行代码。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>你要的是可靠结果，不是一句“已经做好了”。</span></div>"
    },
    {
      "id": "ligun-03",
      "source": "P2-03",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 2,
      "title": "立棍：给 AI 方向，也给检查标准",
      "subtitle": "像导航：知道从哪出发、去哪里、哪些路不能走。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-3\"><article><h3>起点</h3><p>谁来做？现在有什么？</p></article><article><h3>目标</h3><p>要让玩家得到什么结果？</p></article><article><h3>终点条件</h3><p>守住边界，用实际结果证明到达。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>立棍不只是一张任务清单，还管做偏后怎样拉回来。</span></div>"
    },
    {
      "id": "ligun-04",
      "source": "P2-04",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 3,
      "title": "一根棍，写清六件事",
      "subtitle": "从整款游戏到每个模块，都使用同一顺序。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-3\"><article><h3>① 谁来帮我做</h3><p>执行者</p></article><article><h3>② 我的游戏是什么样</h3><p>上下文与项目设计</p></article><article><h3>③ 这次做成什么</h3><p>目标</p></article><article><h3>④ 一定要遵守</h3><p>约束</p></article><article><h3>⑤ 绝对不要</h3><p>避免</p></article><article><h3>⑥ 怎么证明做好了</h3><p>验收</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>这六项用于交代任务；P1 的六字段用于描述模块，别混在一起。</span></div>"
    },
    {
      "id": "ligun-05",
      "source": "P2-05",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 2,
      "title": "谁来做？谁来拍板？",
      "subtitle": "角色设定不能凭空给 AI 增加工具或权限。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>AI 帮我做</h3><p>按已有设计制作、检查、提出修改建议。</p></article><article><h3>我来决定</h3><p>游戏玩法、优先顺序、重要规则和是否接受结果。</p></article><article><h3>遇到不清楚</h3><p>一次只问一个问题；不要替我编一个答案。</p></article><article><h3>能用什么</h3><p>只使用当前工具实际支持且已授权的能力。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>说“你是专家”，不能代替给它材料和检查结果。</span></div>"
    },
    {
      "id": "ligun-06",
      "source": "P2-06",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 4,
      "title": "校园寻宝：先看完整游戏",
      "subtitle": "虚构校园里收集三条不同线索，带到出口；不是去真实校园定位。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>地图＋移动</h3><p>地图说明可走位置；移动按方向提出下一步位置。</p></article><article><h3>线索＋背包</h3><p>发现线索编号；背包保管已得到的不同编号。</p></article><article><h3>障碍＋胜负</h3><p>障碍判断能不能走；胜负判断线索够不够、到没到出口。</p></article><article><h3>共同约定</h3><p>位置用 x、y；线索用 A／B／C；谁保存状态必须说清。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>模块不是六张漂亮页面，而是六种明确责任。</span></div><a class=\"lesson-link\" href=\"demo/index.html\" data-resource=\"demo\" target=\"_blank\" rel=\"noopener\">打开校园寻宝 · 试错与修正 →</a>"
    },
    {
      "id": "ligun-07",
      "source": "P2-07",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 2,
      "title": "主棍：整款游戏的一张总说明",
      "subtitle": "先看完整愿景，再圈出本轮范围；共同规则不会因为分工而消失。",
      "theme": "paper",
      "content": "<div class=\"p2-visual\" data-p2-visual=\"master\"><div class=\"p2-six\"><article data-field=\"执行者\"><h3><i>1</i>执行者</h3><p>AI 制作与检查<br>学生确认玩法和结果</p></article><article data-field=\"上下文与项目设计\"><h3><i>2</i>上下文与项目设计</h3><p><b>完整游戏：</b>虚构校园寻宝<br>六个模块一起配合</p></article><article data-field=\"目标\"><h3><i>3</i>目标</h3><p><b>最终：</b>集齐 A、B、C，到出口才能赢<br><mark>本轮：</mark>小地图避墙，收下一条线索</p></article><article data-field=\"约束\" data-reveal><h3><i>4</i>约束</h3><p><em>全员继承</em>坐标 x、y；编号 A／B／C<br>背包只保存不同编号</p></article><article data-field=\"避免\" data-reveal><h3><i>5</i>避免</h3><p>不收真实身份、位置<br>不把“捡三次”当“不同三条”</p></article><article data-field=\"验收\" data-reveal><h3><i>6</i>验收</h3><p>本轮：拿到 A，背包为 1<br>完整：三条不同＋出口才赢</p></article></div><div class=\"p2-strip\"><b>完整愿景 ≠ 本轮全做完</b><span>其他模块仍保留子棍，按依赖逐步接入。</span></div></div>"
    },
    {
      "id": "ligun-08",
      "source": "P2-08",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 2,
      "title": "约束：必须遵守的约定",
      "subtitle": "先写会影响玩法和合作的条件。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>运行条件</h3><p>默认做浏览器原型；其他项目可选真正可验证的形式。</p></article><article><h3>共同规则</h3><p>地图坐标、线索编号、背包格式沿用主棍。</p></article><article><h3>可操作</h3><p>键盘和屏幕方向按钮都能移动；停在边界不会跑出地图。</p></article><article><h3>隐私</h3><p>示例使用虚构地点，不收真实学生位置或私密资料。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>约束不是装饰；写下了就要能检查。</span></div>"
    },
    {
      "id": "ligun-09",
      "source": "P2-09",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 2,
      "title": "避免：别走这些“省事”捷径",
      "subtitle": "明确不能做什么，比只说“做好一点”更有用。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>别假装成功</h3><p>只做背包图标，不保存获得的线索，不算完成。</p></article><article><h3>别悄悄改规则</h3><p>重复线索不能变成新线索，不能改胜利条件让测试变绿。</p></article><article><h3>别绕过测试</h3><p>不能删掉失败用例后说“全部通过”。</p></article><article><h3>别顺手扩项目</h3><p>不能先加付费、广告、账号系统等无关内容。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>发现问题，报告并修正；不要把证据藏起来。</span></div>"
    },
    {
      "id": "ligun-10",
      "source": "P2-10",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 3,
      "title": "验收：让结果自己说话",
      "subtitle": "先写怎样检查，再让 AI 做；不只检查正常情况。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>正常</h3><p>拿到 A，背包有 A，数量是 1。</p></article><article><h3>异常</h3><p>再拿 A，还是 1；没有编号则拒绝。</p></article><article><h3>接起来</h3><p>集齐三条不同线索，到出口才获胜。</p></article><article><h3>留证据</h3><p>实际输入、实际结果、差异、修正后再测。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>AI 说“测过了”还不够；你要看到真实测试怎么做、结果是什么。</span></div>"
    },
    {
      "id": "ligun-11",
      "source": "P2-11",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 3,
      "title": "一根主棍，分出六份清楚的责任",
      "subtitle": "虚线表示“分工与继承”，不是六个模块的执行顺序。",
      "theme": "paper",
      "content": "<div class=\"p2-visual\" data-p2-visual=\"decomposition\"><div class=\"p2-root\"><b>校园寻宝 · 主棍</b><span>完整目标 · 共同规则 · 本轮范围 · 整体验收</span></div><svg class=\"p2-branches\" viewBox=\"0 0 1200 40\" preserveAspectRatio=\"none\" aria-hidden=\"true\"><path d=\"M600 0V40\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\" stroke-dasharray=\"8 6\"/></svg><div class=\"p2-roles\"><article data-reveal><h3>地图子棍</h3><p><b>负责：</b>给出布局、入口、出口</p><p><b>不负责：</b>不保存玩家位置</p></article><article data-reveal><h3>移动子棍</h3><p><b>负责：</b>接收方向，更新位置</p><p><b>不负责：</b>不自己决定哪里能走</p></article><article data-reveal><h3>线索子棍</h3><p><b>负责：</b>按位置交出编号</p><p><b>不负责：</b>不保存已收集列表</p></article><article data-reveal><h3>背包子棍</h3><p><b>负责：</b>保存不同编号并展示</p><p><b>不负责：</b>不决定输赢</p></article><article data-reveal><h3>障碍子棍</h3><p><b>负责：</b>判断越界或撞墙</p><p><b>不负责：</b>不直接移动玩家</p></article><article data-reveal><h3>胜负子棍</h3><p><b>负责：</b>读背包与出口位置</p><p><b>不负责：</b>不修改线索数量</p></article></div><div class=\"p2-strip\"><b>六份同级，都沿用六项</b><span>模块之间“交什么、何时交”，在交接图里另看。</span></div></div>"
    },
    {
      "id": "ligun-12",
      "source": "P2-12",
      "phase": "02 · 六项与校园寻宝",
      "section": "六项与校园寻宝",
      "minutes": 4,
      "title": "你看方向和证据，AI 拆执行细节",
      "subtitle": "微棍：AI 为完成子棍继续拆的小任务；知道即可，不用你填写。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>人保留</h3><p>重要玩法、共同接口、是否通过，以及最终责任。</p></article><article><h3>AI 负责</h3><p>把子棍拆小任务，编写、检查、局部修正。</p></article><article><h3>必须回来告诉我</h3><p>实际结果、失败、偏差、需要我决定的问题。</p></article><article><h3>不要混淆</h3><p>提示词是说明，工具才执行动作；连接工具不等于万能。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>减少你盯细节的负担，不是把判断责任也交出去。</span></div>"
    },
    {
      "id": "ligun-13",
      "source": "P2-13",
      "phase": "03 · 一次只问一个",
      "section": "一次只问一个",
      "minutes": 3,
      "title": "先别替我设计，先问清楚",
      "subtitle": "模糊的地方不清楚，写一大段也会跑偏。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>学生的原话</h3><p>我想做一个校园寻宝游戏，要好玩一点。</p></article><article><h3>一次一个问题</h3><p>“找到几条线索才算完成？”问完等我回答。</p></article><article><h3>重要的先问</h3><p>玩家目标、完成条件、障碍、已有材料和本轮范围。</p></article><article><h3>我可以说不知道</h3><p>写进“待决定”，不让 AI 偷偷选一个。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>不是每个模块都重复问同一套问题。</span></div>"
    },
    {
      "id": "ligun-14",
      "source": "P2-14",
      "phase": "03 · 一次只问一个",
      "section": "一次只问一个",
      "minutes": 4,
      "title": "把答案留下，别下一轮又忘了",
      "subtitle": "校园寻宝示范：三条不同线索，在出口核验。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>已经确认</h3><p>虚构校园；线索 A／B／C；背包去重；出口才判赢。</p></article><article><h3>还待决定</h3><p>是否限时、未来关卡数量；不影响本轮小地图。</p></article><article><h3>不可以偷偷改变</h3><p>不能把“三条不同”改成“捡三次”。</p></article><article><h3>停止条件</h3><p>关键接口没确认，就先问清或暂停受影响模块。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>每次回答后更新决定清单；先前答案只有学生明确修改时才改变。</span></div>"
    },
    {
      "id": "ligun-15",
      "source": "P2-15",
      "phase": "03 · 一次只问一个",
      "section": "一次只问一个",
      "minutes": 3,
      "title": "问够关键问题，就先出初稿",
      "subtitle": "先问影响最大的 5–8 个；不是等所有想法完美才开始。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>可一键复制</h3><p>用“对齐模式启动词”，带上自己的游戏资料。</p></article><article><h3>不猜答案</h3><p>不知道就标待决定，不能伪装成确定需求。</p></article><article><h3>先给初稿</h3><p>输出主棍和所有模块子棍；列出缺项与受影响部分。</p></article><article><h3>我来确认</h3><p>看清关键条件再执行；可以继续补问和修订。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>初稿是继续合作的起点，不是“所有问题已解决”的证明。</span></div><a class=\"lesson-link\" href=\"workbook/index.html\" data-resource=\"workbook\" target=\"_blank\" rel=\"noopener\">打开可编辑模板 · 复制／下载 →</a>"
    },
    {
      "id": "ligun-16",
      "source": "P2-16",
      "phase": "04 · 写好我的主棍与子棍",
      "section": "写好我的主棍与子棍",
      "minutes": 4,
      "title": "把 P1 的材料带过来",
      "subtitle": "自己的同一个游戏，不换题目，也不用重写整份产品作业。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>拿出三项材料</h3><p>模块地图、一个关键模块设计卡、正常／异常记录。</p></article><article><h3>自己提取文字</h3><p>自行用工具识图或手动录入，再核对有没有认错。</p></article><article><h3>整理成项目背景</h3><p>地图放整体结构，卡片放模块说明，记录放验收依据。</p></article><article><h3>标明实际进度</h3><p>“计划做到”不是“已经实现”；纸面走查不是程序运行。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>官网不做识图、上传或同步；你决定给 AI 哪些材料。</span></div>"
    },
    {
      "id": "ligun-17",
      "source": "P2-17",
      "phase": "04 · 写好我的主棍与子棍",
      "section": "写好我的主棍与子棍",
      "minutes": 10,
      "title": "先完成我的游戏主棍",
      "subtitle": "完整愿景写在一起；本轮先做什么，单独圈出来。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>前 3 分钟</h3><p>执行者＋上下文：游戏是谁玩、怎么玩、有哪些模块。</p></article><article><h3>中间 4 分钟</h3><p>目标＋约束＋避免：最终目标、本轮范围与共同规则。</p></article><article><h3>最后 3 分钟</h3><p>验收：正常、失败和完整玩家路径；列待决定项。</p></article><article><h3>随时检查</h3><p>看到“不太清楚”，允许开启逐问对齐，不凭空填答案。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>用六项组织已有设计，不是比赛谁写的提示词更长。</span></div><a class=\"lesson-link\" href=\"workbook/index.html\" data-resource=\"workbook\" target=\"_blank\" rel=\"noopener\">打开可编辑模板 · 复制／下载 →</a>"
    },
    {
      "id": "ligun-18",
      "source": "P2-18",
      "phase": "04 · 写好我的主棍与子棍",
      "section": "写好我的主棍与子棍",
      "minutes": 14,
      "title": "放大一根子棍：背包也写同样六项",
      "subtitle": "青色是继承，蓝色是自己负责；然后给你的每个模块各写一份。",
      "theme": "paper",
      "content": "<div class=\"p2-visual\" data-p2-visual=\"child\"><div class=\"p2-legend\"><span class=\"p2-inherit\">继承主棍：共同规则</span><span class=\"p2-own\">背包自己：职责与处理</span><span>交接：收编号 → 交唯一列表</span></div><div class=\"p2-six\"><article data-field=\"执行者\"><h3><i>1</i>执行者</h3><p>AI 做背包；学生确认改变<br><em>继承</em>校园寻宝主棍 v1</p></article><article data-field=\"上下文与项目设计\"><h3><i>2</i>上下文与项目设计</h3><p><b>只管背包：</b>接收线索编号<br>有效、未拥有才加入列表</p></article><article data-field=\"目标\"><h3><i>3</i>目标</h3><p>保存并展示不同编号<br>交付模块、调用样例与检查结果</p></article><article data-field=\"约束\" data-reveal><h3><i>4</i>约束</h3><p><em>继承</em>A／B／C、隐私与运行条件<br>背包是已收集状态唯一来源</p></article><article data-field=\"避免\" data-reveal><h3><i>5</i>避免</h3><p>不接管移动或胜负<br>不改“集齐 A、B、C，到出口才能赢”</p></article><article data-field=\"验收\" data-reveal><h3><i>6</i>验收</h3><p>A、B、B → [A, B]／2<br>空编号拒绝；重置清空</p></article></div><div class=\"p2-handoff\" data-reveal><span>线索交来编号</span><b>→</b><span>背包保存不同编号</span><b>→</b><span>胜负只读列表</span></div><a class=\"p2-link\" data-resource=\"workbook\" href=\"workbook/index.html\" target=\"_blank\" rel=\"noopener\">为全部模块填写子棍 ↗</a></div>"
    },
    {
      "id": "ligun-19",
      "source": "P2-19",
      "phase": "04 · 写好我的主棍与子棍",
      "section": "写好我的主棍与子棍",
      "minutes": 8,
      "title": "各自会做，还得接得上",
      "subtitle": "这次看数据交接：箭头表示交给谁、交什么，不是上一张分工树。",
      "theme": "paper",
      "content": "<div class=\"p2-visual\" data-p2-visual=\"integration\"><div class=\"p2-flow-row\"><article><h3>地图</h3><p>布局、墙、出口、线索位置</p></article><b class=\"p2-arrow\">→ 提供共同布局</b><article><h3>移动 ↔ 障碍</h3><p>方向 → 下一位置 → 能否进入<br>允许才更新玩家位置</p></article></div><div class=\"p2-chain\" data-reveal><article><h3>线索</h3><p>按当前位置<br>交出编号 A／B／C</p></article><b>→</b><article><h3>背包</h3><p>收下不同编号<br>交出唯一列表</p></article><b>→</b><article><h3>胜负</h3><p>读列表＋当前位置<br>齐了且到出口才赢</p></article></div><div class=\"p2-checks\" data-reveal><span><b>正常：</b>A、B、C ＋出口 → 赢</span><span><b>重复：</b>A、B、B ＋出口 → 不赢</span><span><b>未到：</b>A、B、C ＋非出口 → 不赢</span></div><div class=\"p2-strip\"><b>两人互查</b><span>一人读输出，一人读输入；格式、时机、失败都对得上吗？</span></div></div>"
    },
    {
      "id": "ligun-20",
      "source": "P2-20",
      "phase": "04 · 写好我的主棍与子棍",
      "section": "写好我的主棍与子棍",
      "minutes": 4,
      "title": "选本轮优先项，不删掉其他愿望",
      "subtitle": "选一条最能看出游戏玩法、又能实际检查的小路径。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>选关键路径</h3><p>例如移动到第一条线索，并确认它进了背包。</p></article><article><h3>看前置条件</h3><p>地图和障碍数据没准备时，不能假装移动已集成。</p></article><article><h3>确定交付</h3><p>说清在哪里打开、怎么操作、怎样重跑测试。</p></article><article><h3>安排课后</h3><p>其他子棍有位置、有依赖顺序，之后再逐步做。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>主棍讲完整愿景，执行可以一小轮一小轮来。</span></div>"
    },
    {
      "id": "ligun-21",
      "source": "P2-21",
      "phase": "05 · 让 AI 做，再检查",
      "section": "让 AI 做，再检查",
      "minutes": 2,
      "title": "现在，把优先子棍交给 AI",
      "subtitle": "豆包 Work 或 WorkBuddy，由你自选；方法不依赖按钮长相。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>一起交代</h3><p>主棍共同规则＋优先子棍＋所需材料。</p></article><article><h3>要求真实交付</h3><p>默认可在浏览器运行的原型，其他形式也要能实际验证。</p></article><article><h3>保留控制权</h3><p>新问题一次一问；重要玩法改变先回来确认。</p></article><article><h3>拿不到结果时</h3><p>如实写出受阻原因和下一步，不把聊天回答当成果。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>先看真实结果，再看它有没有达到你写的要求。</span></div>"
    },
    {
      "id": "ligun-22",
      "source": "P2-22",
      "phase": "05 · 让 AI 做，再检查",
      "section": "让 AI 做，再检查",
      "minutes": 5,
      "title": "要求没变，错的是这次结果",
      "subtitle": "预设课堂示范：不是学生 AI 的生成结果。用同一组输入，看清哪里要改。",
      "theme": "paper",
      "content": "<div class=\"p2-visual\" data-p2-visual=\"repair\"><div class=\"p2-repair\"><div class=\"p2-repair-steps\"><div class=\"p2-repair-row\"><b>要求</b><span>主棍：集齐 A、B、C，到出口才能赢</span></div><div class=\"p2-repair-row\" data-reveal><b>交给 AI</b><span>主棍＋背包子棍：同一编号只算一次</span></div><div class=\"p2-repair-row\" data-reveal><b>首版结果</b><span>输入 A、B、B → 列表 [A, B, B]，数量 3</span></div><div class=\"p2-repair-row\" data-reveal><b>指出偏差</b><span>错在重复计数；不是把胜利条件改成“捡三次”</span></div><div class=\"p2-repair-row\" data-reveal><b>修正与复查</b><span>同样输入 A、B、B → [A, B]，数量 2；还缺 C</span></div></div><aside><h3>说清楚再返工</h3><p>哪里不符？<br>原本应该怎样？<br>只修哪一块？<br>改完重测什么？</p><strong>规则不变<br>输入不变</strong></aside></div><div class=\"p2-strip\"><b>再检查完整路径</b><span>A、B、C 集齐但未到出口仍不赢；到出口才赢。</span></div><a class=\"p2-link\" data-resource=\"demo\" href=\"demo/index.html\" target=\"_blank\" rel=\"noopener\">打开演示：重放 A、B、B ↗</a></div>"
    },
    {
      "id": "ligun-23",
      "source": "P2-23",
      "phase": "05 · 让 AI 做，再检查",
      "section": "让 AI 做，再检查",
      "minutes": 10,
      "title": "打开你的首版，按约定试一遍",
      "subtitle": "先看结果在哪里、怎么运行，再做正常与异常检查。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>正常路径</h3><p>按子棍约定给正常输入，记录实际结果。</p></article><article><h3>不顺利路径</h3><p>少一项输入、重复操作或遇到障碍，看看怎样回应。</p></article><article><h3>连接检查</h3><p>一块的输出能不能被下一块接住？</p></article><article><h3>记录证据</h3><p>操作步骤、预期、实际、截图或运行记录；不要预填“通过”。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>发现问题不是丢脸；隐瞒或假装通过才会让项目越来越难改。</span></div>"
    },
    {
      "id": "ligun-24",
      "source": "P2-24",
      "phase": "05 · 让 AI 做，再检查",
      "section": "让 AI 做，再检查",
      "minutes": 5,
      "title": "把问题说具体，再让 AI 改一次",
      "subtitle": "不是“还是不行”，而是让别人能重现同一个问题。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>我怎么操作</h3><p>先做了什么，再给了什么输入。</p></article><article><h3>原来应该怎样</h3><p>引用主棍／子棍中的哪条验收。</p></article><article><h3>实际哪里不对</h3><p>发生什么、证据在哪里、哪些仍正常。</p></article><article><h3>修改边界</h3><p>只修相关模块；保留其他规则；用原用例重新检查。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>修正也要遵守主棍，不能把别的模块改坏来遮住眼前问题。</span></div><a class=\"lesson-link\" href=\"workbook/index.html\" data-resource=\"workbook\" target=\"_blank\" rel=\"noopener\">打开可编辑模板 · 复制／下载 →</a>"
    },
    {
      "id": "ligun-25",
      "source": "P2-25",
      "phase": "06 · 互查与课后继续",
      "section": "互查与课后继续",
      "minutes": 6,
      "title": "交换检查：能照着做、照着验吗？",
      "subtitle": "一人读主棍和子棍，一人用自己的话复述，再交换。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>方向与价值</h3><p>你理解的游戏还是我想做的那个吗？</p></article><article><h3>范围与连接</h3><p>全部模块有位置吗？这轮做什么？接口接得上吗？</p></article><article><h3>边界与证据</h3><p>哪些不能改？怎样证明做到了？</p></article><article><h3>异常与纠偏</h3><p>还有什么待决定？失败时 AI 应怎样回来问我？</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>六问检查：价值、方向、边界、证据、对齐、纠偏。</span></div>"
    },
    {
      "id": "ligun-26",
      "source": "P2-26",
      "phase": "06 · 互查与课后继续",
      "section": "互查与课后继续",
      "minutes": 4,
      "title": "把同一张图，换成你自己的游戏",
      "subtitle": "每块分别能用，还要检查它们接起来能不能完成整件事。",
      "theme": "paper",
      "content": "<div class=\"p2-visual\" data-p2-visual=\"transfer\"><div class=\"p2-transfer\"><article><h3>看示例：校园寻宝</h3><div class=\"p2-game-root\">主棍：集齐 A、B、C，到出口才能赢</div><div class=\"p2-chip-grid\"><span>地图子棍</span><span>移动子棍</span><span>线索子棍</span><span>背包子棍</span><span>障碍子棍</span><span>胜负子棍</span></div><p>从入口走到结局<br>同时检查正常、失败、重置</p></article><b class=\"p2-transfer-arrow\">换成<br>我的 →</b><article data-reveal><h3>马上对照：我的游戏</h3><div class=\"p2-game-root\">主棍：玩家要完成什么整件事？</div><div class=\"p2-chip-grid\"><span>我的模块…</span><span>我的模块…</span><span>还有哪些？</span></div><p>每个模块都有子棍<br>选本轮路径 → 执行 → 检查 → 修正</p></article></div><div class=\"p2-strip\" data-reveal><b>不用照抄六个模块</b><span>你的游戏有几块，就写几份；共同规则要一致。</span></div><a class=\"p2-link\" data-resource=\"workbook\" href=\"workbook/index.html\" target=\"_blank\" rel=\"noopener\">带走我的主棍与全部子棍 ↗</a></div>"
    },
    {
      "id": "ligun-27",
      "source": "P2-27",
      "phase": "06 · 互查与课后继续",
      "section": "互查与课后继续",
      "minutes": 3,
      "title": "把今天的成果带走，课后接着做",
      "subtitle": "不是今天完成整款游戏，而是已经知道怎样继续。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>带走完整主棍</h3><p>六项齐全、全愿景和本轮范围明确。</p></article><article><h3>带走全部子棍</h3><p>每个模块有核心模板，与主棍保持一致。</p></article><article><h3>带走执行记录</h3><p>首版、检查、至少一次修正及复测；未完成如实列出。</p></article><article><h3>写下一步</h3><p>下一根优先子棍、依赖条件、待决定问题。</p></article></div><div class=\"lesson-banner\" data-reveal><b>记住这一句</b><span>P1 学会描述模块；P2 学会把整体说清，并启动真实制作。</span></div><a class=\"lesson-link\" href=\"workbook/index.html\" data-resource=\"workbook\" target=\"_blank\" rel=\"noopener\">打开可编辑模板 · 复制／下载 →</a>"
    }
  ]
});
})();
