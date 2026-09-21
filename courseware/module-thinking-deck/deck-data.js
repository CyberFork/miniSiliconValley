(function () {
  "use strict";
  window.MSV_MODULE_DECK = Object.freeze({
  "id": "module-thinking-p1",
  "version": "2026.09.21-p1-r10",
  "legacySlideIds": [
    "module-s01",
    "module-s02",
    "module-s02-build",
    "module-s02-voxel",
    "module-s03",
    "module-s04",
    "module-s05",
    "module-s06",
    "module-s07",
    "module-s08",
    "module-s09",
    "module-s10",
    "module-s11",
    "module-s12",
    "module-s13",
    "module-s14",
    "module-s15",
    "module-s16"
  ],
  "title": "模块思维｜学会描述我的游戏模块",
  "sourceHash": "a31489645adcfaf6b7afd3be734349175740c520120cda65552cfa0f3e833793",
  "slides": [
    {
      "id": "module-s01",
      "source": "S01",
      "section": "任务开场",
      "title": "一口吞不下的大象，怎么做？",
      "subtitle": "四个人，要在一小时内做出“校园失物招领工具”。",
      "theme": "mission",
      "content": "\n        <div class=\"scene-grid\">\n          <div class=\"pixel-people\" aria-label=\"四名团队成员同时工作\">\n            <span>🧑‍💻</span><span>🧑‍🎨</span><span>🧑‍🔧</span><span>🧑‍🚀</span>\n            <b class=\"chaos-label\">所有人同时改同一份东西！</b>\n          </div>\n          <div class=\"question-panel\">\n            <div class=\"question-mark\">?</div>\n            <h3>最可能先发生什么？</h3>\n            <div class=\"choice-grid\">\n              <span>A 内容重复</span><span>B 互相覆盖</span>\n              <span>C 彼此等待</span><span>D 都可能</span>\n            </div>\n            <p class=\"action-call\">全员手势投票，再说一句“因为……”</p>\n          </div>\n        </div>\n        <div class=\"reveal-card conclusion\" data-reveal>\n          <b>第一条通关线索</b>\n          <span>先拆块 → 再分工 → 按接口拼回来</span>\n        </div>",
      "phase": "混乱挑战",
      "minutes": 5
    },
    {
      "id": "module-s02",
      "source": "S02-A",
      "section": "预制组件",
      "title": "同一个构件，为什么换了角色？",
      "subtitle": "变形玩具已经把组件设计好；我们在接口与结构约束内重新组合。",
      "theme": "paper",
      "content": "\n        <div class=\"transformer-demo\">\n          <div class=\"transformer-switch\" role=\"group\" aria-label=\"切换课堂示意形态\">\n            <button type=\"button\" aria-pressed=\"true\" data-transform-case=\"car\" data-wheel=\"行驶轮\" data-glass=\"车窗\" data-joint=\"车门铰链\" data-feedback=\"汽车：构件进入道路行驶场景。\">汽车</button>\n            <button type=\"button\" aria-pressed=\"false\" data-transform-case=\"plane\" data-wheel=\"起落架轮\" data-glass=\"座舱透明罩\" data-joint=\"折叠机翼转轴\" data-feedback=\"飞机：同类构件换了位置与角色，接口仍要匹配。\">飞机</button>\n            <button type=\"button\" aria-pressed=\"false\" data-transform-case=\"robot\" data-wheel=\"脚部滚轮\" data-glass=\"胸口观察罩\" data-joint=\"手肘关节\" data-feedback=\"机器人：名称与位置变化，基础能力没有随便改变。\">机器人</button>\n          </div>\n          <div class=\"transformer-stage\" data-transform-stage=\"car\" aria-live=\"polite\">\n            <div class=\"module-3d-host transform-3d\" data-module-3d=\"transform\" data-module-3d-mode=\"car\" aria-label=\"可拖动观察的预制组件三维课堂示意\">\n              <div class=\"module-3d-fallback\" aria-hidden=\"true\">\n                <div class=\"toy-shape\">\n                  <span class=\"toy-part toy-wheel one\"></span><span class=\"toy-part toy-wheel two\"></span>\n                  <span class=\"toy-part toy-glass\"></span><span class=\"toy-part toy-joint\"></span>\n                  <span class=\"toy-shell\"></span><span class=\"toy-wing\"></span>\n                </div>\n              </div>\n              <span class=\"module-3d-hint\">拖动旋转 · 按按钮变形</span>\n            </div>\n            <b data-transform-feedback>汽车：构件进入道路行驶场景。</b>\n            <small>同色标记始终代表同一个构件</small>\n          </div>\n          <div class=\"component-ledger\">\n            <article><i class=\"part-dot wheel\"></i><span><b>轮子</b><em>核心能力：支撑、滚动</em></span><strong data-transform-role=\"wheel\">行驶轮</strong></article>\n            <article><i class=\"part-dot glass\"></i><span><b>透明件</b><em>核心能力：透视、隔离</em></span><strong data-transform-role=\"glass\">车窗</strong></article>\n            <article><i class=\"part-dot joint\"></i><span><b>铰链／转轴</b><em>核心能力：受约束转动</em></span><strong data-transform-role=\"joint\">车门铰链</strong></article>\n          </div>\n        </div>\n        <div class=\"reuse-boundary\">\n          <b>复用失败示例</b><span class=\"bad-plug\">小接口</span><i>≠</i><span class=\"large-plug\">大接口</span><strong>尺寸、方向、空间或强度不匹配，长得像也不能直接用。</strong>\n        </div>\n        <div class=\"reveal-card\" data-reveal><b>第一层：使用预制组件</b><span>位置和场景角色可以改变；基础能力没乱变，接口与约束仍要检查。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 8
    },
    {
      "id": "module-s02-build",
      "source": "S02-B",
      "section": "创造组件",
      "title": "乐高多给了我们哪一层设计权？",
      "subtitle": "基础零件仍有约束，但玩家可以先创造组件，再组合完整作品。",
      "theme": "blueprint",
      "content": "\n        <div class=\"build-observer\" role=\"group\" aria-label=\"观察三层组合关系\">\n          <button type=\"button\" aria-pressed=\"true\" data-build-step=\"parts\" data-feedback=\"先选任务，再挑合适零件；不是随便堆完才起名字。\"><b>01</b>看基础零件</button>\n          <button type=\"button\" aria-pressed=\"false\" data-build-step=\"components\" data-feedback=\"轮胎、轴和连接件组成可滚动轮组；透明件、框架和铰链组成可开合座舱。\"><b>02</b>创造组件</button>\n          <button type=\"button\" aria-pressed=\"false\" data-build-step=\"works\" data-feedback=\"自制组件有明确连接点后，就能像预制组件一样进入汽车、飞机和更大场景。\"><b>03</b>组合整体</button>\n        </div>\n        <div class=\"lego-automation-demo\" data-build-stage=\"parts\">\n          <div class=\"module-3d-host lego-automation-3d\" data-module-3d=\"automation\" data-module-3d-mode=\"parts\" aria-label=\"可拖动观察的积木自动化三维课堂示意\">\n            <div class=\"module-3d-fallback\" aria-hidden=\"true\">\n              <div class=\"brick-bin\">\n                <i class=\"brick b1\"></i><i class=\"brick b2\"></i><i class=\"brick b3\"></i><i class=\"brick wheel\"></i><i class=\"brick axle\"></i><i class=\"brick glass\"></i>\n              </div>\n            </div>\n            <span class=\"module-3d-hint\">拖动旋转 · 第 3 步启动传送带</span>\n          </div>\n          <div class=\"build-layer-rail\">\n            <article data-build-layer=\"parts\" data-active><b>基础零件</b><span>积木、轮胎、轴、透明件、齿轮和连接件</span></article>\n            <i>↓</i>\n            <article data-build-layer=\"components\"><b>功能组件</b><span>轮组、齿轮传动、传送带、感应门</span></article>\n            <i>↓</i>\n            <article data-build-layer=\"works\"><b>自动化整体</b><span>动力输入 → 传动 → 搬运 → 感应</span></article>\n          </div>\n        </div>\n        <div class=\"build-feedback\" data-build-feedback aria-live=\"polite\">先选任务，再挑合适零件；不是随便堆完才起名字。</div>\n        <div class=\"reveal-card conclusion\" data-reveal><b>第二层：先创造，再组合</b><span>自建不一定更好；按需求选择复用或自建，并为结果承担测试和维护。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 8
    },
    {
      "id": "module-s02-voxel",
      "source": "S02-C",
      "section": "方块造物",
      "title": "从方块造组件，再由组件造对象",
      "subtitle": "同一件作品，用更小的方块塑形：每边细分 2 倍，方块数量变成 8 倍。",
      "theme": "blueprint",
      "content": "\n        <div class=\"voxel-toolbar\">\n          <div class=\"voxel-case-switch\" role=\"group\" aria-label=\"选择方块造物案例\">\n            <b>选择案例</b>\n            <button type=\"button\" aria-pressed=\"true\" data-voxel-case=\"car\"\n              data-object-name=\"可滚动小车\"\n              data-material-one=\"橡胶方块 → 四个轮组\"\n              data-material-two=\"铁方块 → 车架\"\n              data-material-three=\"塑料方块 → 方向盘与座椅\"\n              data-blocks-feedback=\"先按材料能力选方块：橡胶、铁和塑料承担不同任务。\"\n              data-components-feedback=\"橡胶块塑成轮组，铁块塑成车架，塑料块塑成驾驶组件。\"\n              data-object-feedback=\"把轮组、车架和驾驶组件按接口对齐，组合成可滚动小车。\">案例一 · 小车</button>\n            <button type=\"button\" aria-pressed=\"false\" data-voxel-case=\"scope\"\n              data-object-name=\"瞄准观察道具（课堂模型）\"\n              data-material-one=\"玻璃方块 + 金属方块 → 瞄准镜\"\n              data-material-two=\"铁方块 → 枪托与主体\"\n              data-material-three=\"标准网格 → 组件对齐接口\"\n              data-blocks-feedback=\"先分清玻璃、金属和铁方块的能力，不把相同外形当成相同材料。\"\n              data-components-feedback=\"玻璃与金属块塑成瞄准镜，铁块塑成枪托与主体。\"\n              data-object-feedback=\"将瞄准镜与枪托主体按网格接口组合成课堂道具模型；不讨论真实武器结构。\">案例二 · 瞄准镜与枪托</button>\n          </div>\n          <div class=\"voxel-step-switch\" role=\"group\" aria-label=\"选择方块组合层级\">\n            <button type=\"button\" aria-pressed=\"true\" data-voxel-step=\"blocks\"><b>01</b>材料方块</button>\n            <button type=\"button\" aria-pressed=\"false\" data-voxel-step=\"components\"><b>02</b>塑形组件</button>\n            <button type=\"button\" aria-pressed=\"false\" data-voxel-step=\"object\"><b>03</b>组合对象</button>\n          </div>\n        </div>\n        <div class=\"voxel-lab\" data-voxel-stage data-voxel-case=\"car\" data-voxel-step=\"blocks\">\n          <div class=\"module-3d-host voxel-forge-3d\" data-module-3d=\"voxel\" data-module-3d-mode=\"car:blocks\" aria-label=\"可拖动观察的方块塑形与组件组合三维课堂示意\">\n            <div class=\"module-3d-fallback voxel-fallback\" aria-hidden=\"true\">\n              <span class=\"voxel-cluster rubber\"></span><span class=\"voxel-cluster iron\"></span><span class=\"voxel-cluster plastic\"></span>\n              <i>→</i><strong>组件</strong><i>→</i><strong>对象</strong>\n            </div>\n            <span class=\"module-3d-hint\">拖动旋转 · 依次观察三层</span>\n          </div>\n          <aside class=\"voxel-ledger\" aria-live=\"polite\">\n            <header><small>当前目标</small><b data-voxel-object-name>可滚动小车</b></header>\n            <article><i class=\"voxel-swatch material-one\"></i><span data-voxel-material=\"one\">橡胶方块 → 四个轮组</span></article>\n            <article><i class=\"voxel-swatch material-two\"></i><span data-voxel-material=\"two\">铁方块 → 车架</span></article>\n            <article><i class=\"voxel-swatch material-three\"></i><span data-voxel-material=\"three\">塑料方块 → 方向盘与座椅</span></article>\n          </aside>\n        </div>\n        <div class=\"voxel-layer-rail\" aria-label=\"方块到对象的三层关系\">\n          <article data-voxel-layer=\"blocks\" data-active><b>材料方块</b><span>小方块，共享网格接口</span></article><i>→</i>\n          <article data-voxel-layer=\"components\"><b>功能组件</b><span>先为任务塑形与命名</span></article><i>→</i>\n          <article data-voxel-layer=\"object\"><b>功能对象</b><span>按接口组合并验证用途</span></article>\n        </div>\n        <div class=\"voxel-feedback\" data-voxel-feedback aria-live=\"polite\">先按材料能力选方块：橡胶、铁和塑料承担不同任务。</div>\n        <div class=\"reveal-card conclusion\" data-reveal><b>第三层：从更细粒度开始设计</b><span>自由度更高，也要承担更多塑形、接口、测试与维护工作；并不是越细越好。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 8
    },
    {
      "id": "module-s03",
      "source": "S03",
      "section": "核心工具",
      "title": "收到什么？怎样做？交回什么？",
      "subtitle": "再看刚才的积木搬运机。这次不数零件，只追踪它怎样完成搬运。",
      "theme": "blueprint",
      "content": "<div class=\"build-observer\" role=\"group\" aria-label=\"复看同一台积木搬运机\"><button type=\"button\" data-build-step=\"components\" data-feedback=\"拆开看：动力、齿轮、传送带、感应门分别负责一件事。\">拆开看组件</button><button type=\"button\" data-build-step=\"works\" data-feedback=\"接回去：动力经过齿轮传到带子，方块被送到另一端。\">接回并运行</button></div><div class=\"case-reuse-grid\"><div data-build-stage=\"components\"><div class=\"module-3d-host case-reuse-scene\" data-module-3d=\"automation\" data-module-3d-mode=\"components\" aria-label=\"同一台积木搬运机：拆开和运行\"><div class=\"module-3d-fallback\"><strong>同一台积木搬运机：拆开和运行</strong></div><span class=\"module-3d-hint\">拖动观察 · 用按钮比较</span></div><div class=\"build-feedback\" data-build-feedback></div></div><div class=\"case-reuse-cards\"><article><h3>输入｜收到什么</h3><p>把待搬的方块放上带子；动力组件带动它。</p></article><article><h3>处理｜怎样做</h3><p>齿轮传动，带子把方块送向另一端。</p></article><article><h3>输出｜交回什么</h3><p>方块到达接收区，下一块才能接着处理。</p></article></div></div><div class=\"lesson-banner\" data-reveal><b>接口是合作约定</b><span>方块多大？从哪里接、向哪里送？软件里也要说清交什么、谁来接。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 5
    },
    {
      "id": "module-description",
      "source": "P1-六句",
      "section": "马上用到我的游戏",
      "title": "用六句话，说清一个模块",
      "subtitle": "继续给这台搬运机的“传送带组件”写工作证，不急着换新例子。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-3\"><article><h3>职责｜我只负责</h3><p>把方块送到接收区；不负责判断它是什么。</p></article><article><h3>输入｜我收到</h3><p>入口处的方块，以及动力组件传来的转动。</p></article><article><h3>处理规则｜我怎么做</h3><p>沿约定方向搬运；太大或卡住时不能硬推。</p></article><article><h3>输出｜我交回</h3><p>把方块送到出口；没送到就不能当成成功。</p></article><article><h3>接口｜我怎样合作</h3><p>说清方块大小、交接位置、方向和停止方式。</p></article><article><h3>正常／异常｜不顺利怎么办</h3><p>正常送达；卡住先停机，再请人检查。</p></article></div><div class=\"lesson-banner\"><b>从演示到设计</b><span>动画演示正常搬运；“卡住怎么办”是我们补上的设计要求，不是假装已经测过。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 5
    },
    {
      "id": "module-s05",
      "source": "S05",
      "section": "概念辨认",
      "title": "功能、模块、产品，不是同一件事",
      "subtitle": "还是刚才的方块小车：看完整作品、拆出的组件，以及它能帮人做什么。",
      "theme": "archive",
      "content": "<div class=\"voxel-toolbar case-reuse-toolbar\"><div class=\"voxel-case-switch\"><button type=\"button\" data-voxel-case=\"car\" data-blocks-feedback=\"小方块是材料；方块数量不是模块数量。\" data-components-feedback=\"拆出轮组、车架、方向盘和座椅，各自负责不同任务。\" data-object-feedback=\"组件接回完整小车；推动、转向是它提供的功能。\">复看同一辆小车</button></div><div class=\"voxel-step-switch\"><button type=\"button\" data-voxel-step=\"object\">看整体</button><button type=\"button\" data-voxel-step=\"components\">拆组件</button><button type=\"button\" data-voxel-step=\"blocks\">看材料</button></div></div><div class=\"case-reuse-grid\"><div data-voxel-stage data-voxel-case=\"car\"><div class=\"module-3d-host case-reuse-scene\" data-module-3d=\"voxel\" data-module-3d-mode=\"car:object\" aria-label=\"同一辆方块小车：整体与组件\"><div class=\"module-3d-fallback\"><strong>同一辆方块小车：整体与组件</strong></div><span class=\"module-3d-hint\">拖动观察 · 用按钮比较</span></div><div class=\"voxel-feedback\" data-voxel-feedback></div></div><div class=\"case-reuse-cards\"><article><h3>产品｜完整解决方案</h3><p>这辆可玩的完整小车，而不是一堆轮子。</p></article><article><h3>模块｜负责一类工作</h3><p>轮组负责支撑和滚动；车架把各部分接住。</p></article><article><h3>功能｜能完成的事</h3><p>推动小车、改变方向；功能不等于某一块零件。</p></article></div></div><div class=\"lesson-banner\" data-reveal><b>换成校园工具也一样</b><span>失物招领工具是整体；信息发布是模块；提交失物信息是一项功能。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 3
    },
    {
      "id": "module-s11",
      "source": "S11",
      "section": "AI 模块",
      "title": "AI 也靠几个帮手一起工作",
      "subtitle": "它会回答，不等于它能找资料、改文件或记住全部事情。",
      "theme": "ai",
      "content": "\n        <div class=\"ai-orbit\">\n          <div class=\"ai-core\">AI<br><small>基础模型</small></div>\n          <article><b>提示词</b><span>任务与边界</span></article>\n          <article><b>工具</b><span>搜索、文件、计算</span></article>\n          <article><b>记忆／数据</b><span>持续需要的信息</span></article>\n          <article><b>编排／验收</b><span>顺序与检查</span></article>\n        </div>\n        <div class=\"mission-question\"><b>AI 侦探</b><span>“它搜到答案却马上忘了”——最可能缺哪一块？</span></div>\n        <div class=\"reveal-card\" data-reveal><b>别把 AI 当英雄</b><span>先看任务需要哪些模块，再决定 AI 在哪一块帮忙。</span></div>",
      "phase": "WHAT · 认识模块",
      "minutes": 3
    },
    {
      "id": "module-s04",
      "source": "S04",
      "section": "为什么拆块",
      "title": "拆成模块，会得到四种超能力",
      "subtitle": "再让预制玩具变一次形：这回解释，拆成组件到底帮了什么忙。",
      "theme": "paper",
      "content": "<div class=\"case-reuse-transform\"><div class=\"transformer-switch\" role=\"group\" aria-label=\"切换课堂示意形态\">\n            <button type=\"button\" aria-pressed=\"true\" data-transform-case=\"car\" data-wheel=\"行驶轮\" data-glass=\"车窗\" data-joint=\"车门铰链\" data-feedback=\"汽车：构件进入道路行驶场景。\">汽车</button>\n            <button type=\"button\" aria-pressed=\"false\" data-transform-case=\"plane\" data-wheel=\"起落架轮\" data-glass=\"座舱透明罩\" data-joint=\"折叠机翼转轴\" data-feedback=\"飞机：同类构件换了位置与角色，接口仍要匹配。\">飞机</button>\n            <button type=\"button\" aria-pressed=\"false\" data-transform-case=\"robot\" data-wheel=\"脚部滚轮\" data-glass=\"胸口观察罩\" data-joint=\"手肘关节\" data-feedback=\"机器人：名称与位置变化，基础能力没有随便改变。\">机器人</button>\n          </div><div class=\"case-reuse-grid\"><div data-transform-stage=\"car\"><div class=\"module-3d-host case-reuse-scene\" data-module-3d=\"transform\" data-module-3d-mode=\"car\" aria-label=\"同一组预制组件：汽车、飞机与机器人\"><div class=\"module-3d-fallback\"><strong>同一组预制组件：汽车、飞机与机器人</strong></div><span class=\"module-3d-hint\">拖动观察 · 用按钮比较</span></div><div class=\"build-feedback\" data-transform-feedback></div></div><div class=\"case-reuse-cards two-column\"><article><h3>看得懂</h3><p>指着轮子、透明件、铰链，就能说出分工。</p></article><article><h3>能分工</h3><p>一人管轮组，一人管车架；先约好连接处。</p></article><article><h3>能替换</h3><p>轮子坏了换轮组，不必重造整辆车。</p></article><article><h3>能复用</h3><p>行驶轮换成起落架轮，仍要检查接口与承重。</p></article></div></div></div><div class=\"lesson-banner\" data-reveal><b>别只说“它变了”</b><span>选同一个构件，说明：任务换了什么？能力保留什么？哪些接口要再检查？</span></div>",
      "phase": "WHY · 为什么要用",
      "minutes": 6
    },
    {
      "id": "module-tradeoff",
      "source": "WHY-取舍",
      "section": "马上用到我的游戏",
      "title": "拆得越碎，就一定越好吗？",
      "subtitle": "把刚才三种做法放在一起：不是越细越好，而是合适就好。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>预制玩具｜直接复用</h3><p>轮组已经合适，就沿用它；先检查接口，不重造轮子。</p></article><article><h3>乐高｜创造组件</h3><p>需要不同的传送带，就用标准零件重新组合，再测试。</p></article><article><h3>方块小车｜细到材料</h3><p>轮子可以雕得更细，但方块多不等于功能多；塑形和检查也更多。</p></article><article><h3>我的游戏｜按任务拆</h3><p>移动、背包各有责任；不用把每个字、每个按钮都拆成模块。</p></article></div><div class=\"lesson-banner\" data-reveal><b>判断问题</b><span>这样拆，是让合作更清楚，还是只是让格子更多？</span></div>",
      "phase": "WHY · 为什么要用",
      "minutes": 4
    },
    {
      "id": "module-s06",
      "source": "S06",
      "section": "用户路径",
      "title": "先跟着人走，不要先跟着技术走",
      "subtitle": "真实用户怎么行动，就是串起模块的主线。",
      "theme": "route",
      "content": "\n        <div class=\"user-route\">\n          <article><b>1</b><span>发现物品</span></article><i>→</i>\n          <article><b>2</b><span>拍照登记</span></article><i>→</i>\n          <article><b>3</b><span>系统发布</span></article><i>→</i>\n          <article><b>4</b><span>失主搜索</span></article><i>→</i>\n          <article><b>5</b><span>身份核对</span></article><i>→</i>\n          <article><b>6</b><span>成功取回</span></article>\n        </div>\n        <div class=\"roleplay-card\"><b>真人演一遍</b><span>每个人只说两句：“我拿到什么？”“我交出什么？”</span></div>\n        <div class=\"reveal-card\" data-reveal><b>每一步都问</b><span>谁，在什么场景下，要完成什么？</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 2
    },
    {
      "id": "module-s07",
      "source": "S07",
      "section": "归纳模块",
      "title": "从需求，走到功能，再归纳模块",
      "subtitle": "大家说法很乱没关系，先找重复动作和共同任务。",
      "theme": "lab",
      "content": "\n        <div class=\"funnel-board\">\n          <div class=\"sticky-row\"><span>“我想拍照”</span><span>“我要搜索”</span><span>“认领后提醒我”</span><span>“先核对身份”</span></div>\n          <div class=\"funnel\">↓ 找共同任务与重复动作 ↓</div>\n          <div class=\"module-row\"><span>信息模块</span><span>搜索模块</span><span>通知模块</span><span>身份模块</span></div>\n        </div>\n        <div class=\"mission-question\"><b>便利贴归队</b><span>把“找、发、认领、通知、上传照片、核对身份”贴到你认为合适的模块。</span></div>\n        <div class=\"reveal-card\" data-reveal><b>允许不同拆法</b><span>只要能说清归类依据，并沿用户路径接得回来。</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 2
    },
    {
      "id": "module-s08",
      "source": "S08",
      "section": "同类任务放一起 · 高内聚",
      "title": "找出通知模块里的“卧底”",
      "subtitle": "一块里面，尽量只做同一类事情。",
      "theme": "challenge",
      "content": "\n        <div class=\"suspect-grid\">\n          <article><b>A</b><span>生成提醒</span></article>\n          <article><b>B</b><span>发送提醒</span></article>\n          <article><b>C</b><span>记录是否送达</span></article>\n          <article class=\"danger\"><b>D</b><span>修改用户积分</span></article>\n        </div>\n        <div class=\"action-call large\">先投票，再说：“它为什么不是通知模块的责任？”</div>\n        <div class=\"reveal-card conclusion\" data-reveal><b>高内聚</b><span>模块内部目标一致、责任集中；“修改积分”应该回到自己的模块。</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 1
    },
    {
      "id": "module-s09",
      "source": "S09",
      "section": "按约定合作 · 低耦合",
      "title": "接口像插头：只按约定合作",
      "subtitle": "记得轮组与车架吗？轴太粗就接不上；订单信息缺一项，也会让配送卡住。",
      "theme": "terminal",
      "content": "\n        <div class=\"interface-demo\">\n          <article><small>订单模块</small><h3>我交出订单卡</h3><div class=\"data-chip\">餐品：炒饭</div><div class=\"data-chip missing\">地址：？？？</div><div class=\"data-chip\">时间：12:10</div></article>\n          <div class=\"plug\">⇄<span>接口</span></div>\n          <article><small>配送模块</small><h3>我按订单卡送达</h3><p>我不需要知道你内部怎么下单。</p></article>\n        </div>\n        <div class=\"mission-question\"><b>接口传话</b><span>配送为什么卡住了？约定里缺了什么？</span></div>\n        <div class=\"reveal-card\" data-reveal><b>低耦合</b><span>约定输入、输出和异常；内部升级时，别人不用跟着重做。</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 2
    },
    {
      "id": "module-s10",
      "source": "S10",
      "section": "黑箱测试",
      "title": "看不见里面，也能先测试它",
      "subtitle": "先研究行为，再决定要不要打开黑箱。",
      "theme": "mystery",
      "content": "\n        <div class=\"blackbox-lab\">\n          <div class=\"input-stack\" aria-label=\"测试输入\">\n            <button type=\"button\" data-blackbox-case=\"0\" data-feedback=\"输入 2 → 返回 4：基础样例通过\" aria-pressed=\"false\"><b>2</b><small>测试输入</small></button>\n            <button type=\"button\" data-blackbox-case=\"1\" data-feedback=\"输入 5 → 返回 10：重复样例通过\" aria-pressed=\"false\"><b>5</b><small>测试输入</small></button>\n            <button type=\"button\" data-blackbox-case=\"2\" data-feedback=\"输入“文字” → 拒绝：发现失败行为\" aria-pressed=\"false\"><b>文字</b><small>故意给错</small></button>\n          </div>\n          <div class=\"blackbox\"><i>?</i><b>神秘模块</b><small data-blackbox-status aria-live=\"polite\">选择一个输入，观察返回</small></div>\n          <div class=\"output-stack\" aria-label=\"模块返回\">\n            <span data-blackbox-output><b>4</b><small>正常返回</small></span>\n            <span data-blackbox-output><b>10</b><small>正常返回</small></span>\n            <span data-blackbox-output data-result=\"拒绝\"><b>?</b><small>异常返回</small></span>\n          </div>\n        </div>\n        <div class=\"three-questions\">\n          <span>给它什么？</span><span>它返回什么？</span><span>失败时怎样？</span>\n        </div>\n        <div class=\"reveal-card\" data-reveal><b>有效测试</b><span>不要只猜规则；还要试边界、异常和“故意给错”的输入。</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 2
    },
    {
      "id": "module-s12",
      "source": "S12",
      "section": "团队实战",
      "title": "把“校园订餐”拆成能工作的模块",
      "subtitle": "七分钟，三道关卡。不是比谁拆得多。",
      "theme": "mission",
      "content": "\n        <div class=\"checkpoint-grid\">\n          <article><b>01</b><h3>画路径</h3><p>从想吃，到收到餐</p><em>先画用户动作</em></article>\n          <article><b>02</b><h3>归模块</h3><p>拆成 4—7 个责任单元</p><em>说清为谁解决什么</em></article>\n          <article><b>03</b><h3>找异常</h3><p>售罄、迟到、地址错……</p><em>至少找到一个断点</em></article>\n        </div>\n        <div class=\"candidate-chips\"><span>菜单</span><span>下单</span><span>商家接单</span><span>配送</span><span>通知</span><span>结算</span><span>反馈</span></div>\n        <div class=\"reveal-card\" data-reveal><b>通关口令</b><span>每个模块都能说：“我只负责……”</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 7
    },
    {
      "id": "module-s13",
      "source": "S13",
      "section": "接口卡",
      "title": "让每个模块拿到一张“工作证”",
      "subtitle": "别人不用猜，就知道怎样和它合作。",
      "theme": "paper",
      "content": "\n        <div class=\"interface-card-demo\">\n          <header><span>MODULE CARD</span><b>模块接口卡</b></header>\n          <div class=\"card-field\"><small>模块名称</small><strong>________________</strong></div>\n          <div class=\"card-field\"><small>唯一责任</small><strong>我只负责 __________________</strong></div>\n          <div class=\"card-pair\"><div><small>输入</small><p>谁把什么交进来？</p></div><div><small>输出</small><p>成功／失败返回什么？</p></div></div>\n          <div class=\"card-pair\"><div><small>依赖</small><p>必须调用谁？</p></div><div><small>负责人</small><p>谁主导、谁支援？</p></div></div>\n        </div>\n        <div class=\"mission-question\"><b>模块相亲</b><span>拿着你的输出，去找能接住它的下一个模块。</span></div>\n        <div class=\"reveal-card\" data-reveal><b>只准问三句</b><span>给你什么？你还我什么？失败怎么办？</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 2
    },
    {
      "id": "module-s14",
      "source": "S14",
      "section": "拼装测试",
      "title": "拆得开，还要接得回",
      "subtitle": "先把同一台积木搬运机拆开再接回，再把这个检查方法用到校园订餐。",
      "theme": "lab",
      "content": "<div class=\"build-observer\" role=\"group\" aria-label=\"复看同一台积木搬运机\"><button type=\"button\" data-build-step=\"components\" data-feedback=\"拆开看：动力、齿轮、传送带、感应门分别负责一件事。\">拆开看组件</button><button type=\"button\" data-build-step=\"works\" data-feedback=\"接回去：动力经过齿轮传到带子，方块被送到另一端。\">接回并运行</button></div><div class=\"case-reuse-grid\"><div data-build-stage=\"components\"><div class=\"module-3d-host case-reuse-scene\" data-module-3d=\"automation\" data-module-3d-mode=\"components\" aria-label=\"积木搬运机：拆开再接回的验证\"><div class=\"module-3d-fallback\"><strong>积木搬运机：拆开再接回的验证</strong></div><span class=\"module-3d-hint\">拖动观察 · 用按钮比较</span></div><div class=\"build-feedback\" data-build-feedback></div></div><div class=\"case-reuse-cards\"><article><h3>拆开看</h3><p>少了齿轮，动力还能传到带子吗？先预测。</p></article><article><h3>接回看</h3><p>点击运行：方块有没有被送走？下一块接不接得住？</p></article><article><h3>换到校园订餐</h3><p>拿掉配送，订单怎样提示？换人工配送后，订单卡要改吗？</p></article></div></div><div class=\"lesson-banner\" data-reveal><b>先预测，再找证据</b><span>模型演示拆分与正常组装；拔掉、卡住、替换后的结果，要另外设计并实际检查。</span></div>",
      "phase": "HOW · 公共案例",
      "minutes": 2
    },
    {
      "id": "module-my-start",
      "source": "HOW-01",
      "section": "马上用到我的游戏",
      "title": "马上用到我的游戏",
      "subtitle": "拿出 Day 2“我的第一款游戏”作业，不用重写整份。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>已经准备好了</h3><p>圈出：谁来玩、做什么、目标、胜负、主要障碍。</p></article><article><h3>还没有写完</h3><p>用 5 分钟速填卡补齐这五点，一样能参加。</p></article><article><h3>今天先不写代码</h3><p>纸上画、开口解释、两人演一遍，也能发现设计问题。</p></article><article><h3>每人都带走</h3><p>我的模块地图＋一个关键模块卡＋正常／异常走查记录。</p></article></div><div class=\"lesson-banner\" data-reveal><b>材料下载</b><span>四份内容初稿在“材料”入口，可下载交同事继续制作。</span></div>",
      "phase": "HOW · 马上用到我的游戏",
      "minutes": 5
    },
    {
      "id": "module-my-map",
      "source": "HOW-02",
      "section": "马上用到我的游戏",
      "title": "画出我的游戏模块",
      "subtitle": "先走一遍玩家路径，再把同一类工作放到一起。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>先画路径</h3><p>进入游戏 → 探索 → 得到线索 → 遇到障碍 → 达成目标。</p></article><article><h3>再标责任</h3><p>谁负责移动？谁保存线索？谁判断胜负？</p></article><article><h3>箭头写内容</h3><p>不只画箭头：写“玩家位置”“获得的线索”“胜负结果”。</p></article><article><h3>保留完整愿景</h3><p>列出想做的全部模块；圈出本轮优先做的，其余标“稍后”。</p></article></div><div class=\"lesson-banner\" data-reveal><b>同伴追问</b><span>你交给下一块的，到底是什么？</span></div>",
      "phase": "HOW · 马上用到我的游戏",
      "minutes": 8
    },
    {
      "id": "module-my-card",
      "source": "HOW-03",
      "section": "马上用到我的游戏",
      "title": "选一个关键模块，说清六件事",
      "subtitle": "选自己游戏的核心模块，不要求大家都选登录。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>职责＋输入</h3><p>背包只保管已获得的线索；收到“收下线索 A”的请求。</p></article><article><h3>处理规则＋输出</h3><p>未收过就记下，重复的不再加；回“已收下”或“已拥有”。</p></article><article><h3>接口＋正常表现</h3><p>接收线索编号；向胜负模块提供已收集列表。</p></article><article><h3>异常表现＋不负责</h3><p>没编号就拒绝并说明；背包不负责移动、也不决定输赢。</p></article></div><div class=\"lesson-banner\" data-reveal><b>接口配对</b><span>你的游戏与同伴游戏不同也没关系：请同伴扮演你游戏里的下一块。</span></div>",
      "phase": "HOW · 马上用到我的游戏",
      "minutes": 9
    },
    {
      "id": "module-my-check",
      "source": "HOW-04",
      "section": "马上用到我的游戏",
      "title": "让模块走一次顺路，再走一次岔路",
      "subtitle": "一人扮演玩家／输入，一人按卡片扮演模块，然后交换。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>正常走一次</h3><p>背包原来为空，交入线索 A；预期列表有 A，数量是 1。</p></article><article><h3>故意给一次不顺利</h3><p>再次交入 A；预期仍只有一份，不会凑够三条。</p></article><article><h3>记下真正发生的</h3><p>卡片有没有说清？同伴实际怎样处理？和预期哪里不一样？</p></article><article><h3>修正后再走</h3><p>补上重复线索规则，再用同样输入走一次，记录结果。</p></article></div><div class=\"lesson-banner\" data-reveal><b>证据边界</b><span>本节是纸面／角色走查；没有运行程序，就不写“程序测试通过”。</span></div>",
      "phase": "HOW · 马上用到我的游戏",
      "minutes": 8
    },
    {
      "id": "module-my-peer",
      "source": "HOW-05",
      "section": "马上用到我的游戏",
      "title": "交换看看：不用你解释，能懂吗？",
      "subtitle": "对方先读，你先听；再交换角色。",
      "theme": "paper",
      "content": "<div class=\"lesson-grid cols-2\"><article><h3>看职责</h3><p>同一件事是不是被两个模块重复负责？</p></article><article><h3>看接口</h3><p>前一块的输出，后一块真的接得住吗？</p></article><article><h3>看失败</h3><p>少一个输入或拿掉一块，游戏怎样给出反馈？</p></article><article><h3>改一个具体地方</h3><p>指出一句说不清的话，改成能检查的规则；记录原因。</p></article></div><div class=\"lesson-banner\" data-reveal><b>反馈句式</b><span>“我收到____，但不知道____。你能把这句补清楚吗？”</span></div>",
      "phase": "HOW · 马上用到我的游戏",
      "minutes": 6
    },
    {
      "id": "module-s15",
      "source": "S15",
      "section": "本课验收",
      "title": "用四句话，介绍我的模块地图",
      "subtitle": "每人说一分钟，同伴听完复述；时间够再全班分享。",
      "theme": "showcase",
      "content": "\n        <div class=\"sentence-grid\">\n          <article><b>1</b><span>我服务的用户是……</span></article>\n          <article><b>2</b><span>用户要走的关键路径是……</span></article>\n          <article><b>3</b><span>我拆成了……模块，因为……</span></article>\n          <article><b>4</b><span>模块通过……输入／输出连接</span></article>\n        </div>\n        <div class=\"delivery-box\"><small>本课交付</small><b>我的游戏模块地图</b><b>关键模块设计卡</b><b>正常／异常走查记录</b></div>\n        <div class=\"reveal-card\" data-reveal><b>听众任务</b><span>交一张票：“最清楚的接口”或“我还想追问”。</span></div>",
      "phase": "HOW · 马上用到我的游戏",
      "minutes": 4
    },
    {
      "id": "module-s16",
      "source": "S16",
      "section": "下一关",
      "title": "模块有了，怎样防止 AI 做偏？",
      "subtitle": "同一句“帮我做登录模块”，每个人和 AI 都可能理解不同。",
      "theme": "finale",
      "content": "\n        <div class=\"forking-paths\">\n          <div class=\"prompt-chip\">帮我做登录模块</div>\n          <i>↙</i><i>↓</i><i>↘</i>\n          <article><b>目标不同</b><span>给谁使用？解决什么？</span></article>\n          <article><b>边界不同</b><span>做什么？不做什么？</span></article>\n          <article><b>完成不同</b><span>怎样才算真的可用？</span></article>\n        </div>\n        <div class=\"mission-question\"><b>最后一问</b><span>不说清哪件事，AI 最容易做偏？</span></div>\n        <div class=\"reveal-card conclusion\" data-reveal><b>下一课：立棍</b><span>把完整游戏写成主棍，把每个模块写成子棍，再交给 AI 实践。</span></div>",
      "phase": "总结与下一课",
      "minutes": 2
    },
    {
      "id": "module-review",
      "source": "P1 · 回顾",
      "phase": "总结与下一课",
      "section": "复习回顾",
      "minutes": 3,
      "title": "复习回顾：模块怎样合作？",
      "subtitle": "先用自己的话回答，再揭示重点。把例子和自己的游戏连起来。",
      "theme": "paper",
      "content": "<div class=\"course-recap\" data-recap=\"p1\"><div class=\"recap-examples\"><span><b>变形玩具</b> · 重组预制组件</span><i>→</i><span><b>乐高</b> · 从零件造组件</span><i>→</i><span><b>方块</b> · 更细颗粒度来组合</span></div><div class=\"recap-cards\">\n<article><h3>WHAT · 模块是什么？</h3><p class=\"recap-question\">随便切小就算模块吗？</p><div data-reveal class=\"recap-answer\"><p>有明确职责，<br>能和别的模块合作。</p><strong>复用或自建，<br>都要讲清接口与约束。</strong></div></article>\n<article><h3>WHY · 为什么要拆？</h3><p class=\"recap-question\">换轮子为什么不用全重做？</p><div data-reveal class=\"recap-answer\"><p>分清责任，方便替换、<br>复用、合作和检查。</p><strong>不是越小越好；<br>连接太多也会变复杂。</strong></div></article>\n<article><h3>HOW · 怎样讲清？</h3><p class=\"recap-question\">别人不听解释也能接上吗？</p><div data-reveal class=\"recap-answer\"><div class=\"recap-fields\"><span>职责</span><span>输入</span><span>处理规则</span><span>输出</span><span>接口</span><span>正常／异常</span></div><strong>先纸面走查，再两人互查。</strong></div></article>\n</div><div class=\"recap-takeaway\"><b>我能带走</b><span>模块地图</span><span>详细设计卡</span><span>正常／异常走查记录</span></div><p class=\"recap-exit\">用自己的游戏说一句：这块负责____，收到____，交出____；失败时____。</p></div>"
    }
  ],
  "footer": "模块思维 · 马上用到我的游戏",
  "timeline": [
    {
      "name": "混乱挑战",
      "minutes": 5,
      "start": 0,
      "end": 5
    },
    {
      "name": "WHAT · 认识模块",
      "minutes": 40,
      "start": 5,
      "end": 45
    },
    {
      "name": "WHY · 为什么要用",
      "minutes": 10,
      "start": 45,
      "end": 55
    },
    {
      "name": "HOW · 公共案例",
      "minutes": 20,
      "start": 55,
      "end": 75
    },
    {
      "name": "HOW · 马上用到我的游戏",
      "minutes": 40,
      "start": 75,
      "end": 115
    },
    {
      "name": "总结与下一课",
      "minutes": 5,
      "start": 115,
      "end": 120
    }
  ]
});
})();
