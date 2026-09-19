(function () {
  "use strict";

  const slides = [
    {
      id: "module-s01",
      source: "S01",
      section: "任务开场",
      title: "一口吞不下的大象，怎么做？",
      subtitle: "四个人，要在一小时内做出“校园失物招领工具”。",
      theme: "mission",
      content: `
        <div class="scene-grid">
          <div class="pixel-people" aria-label="四名团队成员同时工作">
            <span>🧑‍💻</span><span>🧑‍🎨</span><span>🧑‍🔧</span><span>🧑‍🚀</span>
            <b class="chaos-label">所有人同时改同一份东西！</b>
          </div>
          <div class="question-panel">
            <div class="question-mark">?</div>
            <h3>最可能先发生什么？</h3>
            <div class="choice-grid">
              <span>A 内容重复</span><span>B 互相覆盖</span>
              <span>C 彼此等待</span><span>D 都可能</span>
            </div>
            <p class="action-call">全员手势投票，再说一句“因为……”</p>
          </div>
        </div>
        <div class="reveal-card conclusion" data-reveal>
          <b>第一条通关线索</b>
          <span>先拆块 → 再分工 → 按接口拼回来</span>
        </div>`,
    },
    {
      id: "module-s02",
      source: "S02-A",
      section: "预制组件",
      title: "同一个构件，为什么换了角色？",
      subtitle: "变形玩具已经把组件设计好；我们在接口与结构约束内重新组合。",
      theme: "paper",
      content: `
        <div class="transformer-demo">
          <div class="transformer-switch" role="group" aria-label="切换课堂示意形态">
            <button type="button" aria-pressed="true" data-transform-case="car" data-wheel="行驶轮" data-glass="车窗" data-joint="车门铰链" data-feedback="汽车：构件进入道路行驶场景。">汽车</button>
            <button type="button" aria-pressed="false" data-transform-case="plane" data-wheel="起落架轮" data-glass="座舱透明罩" data-joint="折叠机翼转轴" data-feedback="飞机：同类构件换了位置与角色，接口仍要匹配。">飞机</button>
            <button type="button" aria-pressed="false" data-transform-case="robot" data-wheel="脚部滚轮" data-glass="胸口观察罩" data-joint="手肘关节" data-feedback="机器人：名称与位置变化，基础能力没有随便改变。">机器人</button>
          </div>
          <div class="transformer-stage" data-transform-stage="car" aria-live="polite">
            <div class="module-3d-host transform-3d" data-module-3d="transform" data-module-3d-mode="car" aria-label="可拖动观察的预制组件三维课堂示意">
              <div class="module-3d-fallback" aria-hidden="true">
                <div class="toy-shape">
                  <span class="toy-part toy-wheel one"></span><span class="toy-part toy-wheel two"></span>
                  <span class="toy-part toy-glass"></span><span class="toy-part toy-joint"></span>
                  <span class="toy-shell"></span><span class="toy-wing"></span>
                </div>
              </div>
              <span class="module-3d-hint">拖动旋转 · 按按钮变形</span>
            </div>
            <b data-transform-feedback>汽车：构件进入道路行驶场景。</b>
            <small>同色标记始终代表同一个构件</small>
          </div>
          <div class="component-ledger">
            <article><i class="part-dot wheel"></i><span><b>轮子</b><em>核心能力：支撑、滚动</em></span><strong data-transform-role="wheel">行驶轮</strong></article>
            <article><i class="part-dot glass"></i><span><b>透明件</b><em>核心能力：透视、隔离</em></span><strong data-transform-role="glass">车窗</strong></article>
            <article><i class="part-dot joint"></i><span><b>铰链／转轴</b><em>核心能力：受约束转动</em></span><strong data-transform-role="joint">车门铰链</strong></article>
          </div>
        </div>
        <div class="reuse-boundary">
          <b>复用失败示例</b><span class="bad-plug">小接口</span><i>≠</i><span class="large-plug">大接口</span><strong>尺寸、方向、空间或强度不匹配，长得像也不能直接用。</strong>
        </div>
        <div class="reveal-card" data-reveal><b>第一层：使用预制组件</b><span>位置和场景角色可以改变；基础能力没乱变，接口与约束仍要检查。</span></div>`,
    },
    {
      id: "module-s02-build",
      source: "S02-B",
      section: "创造组件",
      title: "乐高多给了我们哪一层设计权？",
      subtitle: "基础零件仍有约束，但玩家可以先创造组件，再组合完整作品。",
      theme: "blueprint",
      content: `
        <div class="build-observer" role="group" aria-label="观察三层组合关系">
          <button type="button" aria-pressed="true" data-build-step="parts" data-feedback="先选任务，再挑合适零件；不是随便堆完才起名字。"><b>01</b>看基础零件</button>
          <button type="button" aria-pressed="false" data-build-step="components" data-feedback="轮胎、轴和连接件组成可滚动轮组；透明件、框架和铰链组成可开合座舱。"><b>02</b>创造组件</button>
          <button type="button" aria-pressed="false" data-build-step="works" data-feedback="自制组件有明确连接点后，就能像预制组件一样进入汽车、飞机和更大场景。"><b>03</b>组合整体</button>
        </div>
        <div class="lego-automation-demo" data-build-stage="parts">
          <div class="module-3d-host lego-automation-3d" data-module-3d="automation" data-module-3d-mode="parts" aria-label="可拖动观察的积木自动化三维课堂示意">
            <div class="module-3d-fallback" aria-hidden="true">
              <div class="brick-bin">
                <i class="brick b1"></i><i class="brick b2"></i><i class="brick b3"></i><i class="brick wheel"></i><i class="brick axle"></i><i class="brick glass"></i>
              </div>
            </div>
            <span class="module-3d-hint">拖动旋转 · 第 3 步启动传送带</span>
          </div>
          <div class="build-layer-rail">
            <article data-build-layer="parts" data-active><b>基础零件</b><span>积木、轮胎、轴、透明件、齿轮和连接件</span></article>
            <i>↓</i>
            <article data-build-layer="components"><b>功能组件</b><span>轮组、齿轮传动、传送带、感应门</span></article>
            <i>↓</i>
            <article data-build-layer="works"><b>自动化整体</b><span>动力输入 → 传动 → 搬运 → 感应</span></article>
          </div>
        </div>
        <div class="build-feedback" data-build-feedback aria-live="polite">先选任务，再挑合适零件；不是随便堆完才起名字。</div>
        <div class="reveal-card conclusion" data-reveal><b>第二层：先创造，再组合</b><span>自建不一定更好；按需求选择复用或自建，并为结果承担测试和维护。</span></div>`,
    },
    {
      id: "module-s02-voxel",
      source: "S02-C",
      section: "方块造物",
      title: "从方块造组件，再由组件造对象",
      subtitle: "《我的世界》式方块把可编辑粒度再下放一层：共享网格接口，但材料能力不同。",
      theme: "blueprint",
      content: `
        <div class="voxel-toolbar">
          <div class="voxel-case-switch" role="group" aria-label="选择方块造物案例">
            <b>选择案例</b>
            <button type="button" aria-pressed="true" data-voxel-case="car"
              data-object-name="可滚动小车"
              data-material-one="橡胶方块 → 四个轮组"
              data-material-two="铁方块 → 车架"
              data-material-three="塑料方块 → 方向盘与座椅"
              data-blocks-feedback="先按材料能力选方块：橡胶、铁和塑料承担不同任务。"
              data-components-feedback="橡胶块塑成轮组，铁块塑成车架，塑料块塑成驾驶组件。"
              data-object-feedback="把轮组、车架和驾驶组件按接口对齐，组合成可滚动小车。">案例一 · 小车</button>
            <button type="button" aria-pressed="false" data-voxel-case="scope"
              data-object-name="瞄准观察道具（课堂模型）"
              data-material-one="玻璃方块 + 金属方块 → 瞄准镜"
              data-material-two="铁方块 → 枪托与主体"
              data-material-three="标准网格 → 组件对齐接口"
              data-blocks-feedback="先分清玻璃、金属和铁方块的能力，不把相同外形当成相同材料。"
              data-components-feedback="玻璃与金属块塑成瞄准镜，铁块塑成枪托与主体。"
              data-object-feedback="将瞄准镜与枪托主体按网格接口组合成课堂道具模型；不讨论真实武器结构。">案例二 · 瞄准镜与枪托</button>
          </div>
          <div class="voxel-step-switch" role="group" aria-label="选择方块组合层级">
            <button type="button" aria-pressed="true" data-voxel-step="blocks"><b>01</b>材料方块</button>
            <button type="button" aria-pressed="false" data-voxel-step="components"><b>02</b>塑形组件</button>
            <button type="button" aria-pressed="false" data-voxel-step="object"><b>03</b>组合对象</button>
          </div>
        </div>
        <div class="voxel-lab" data-voxel-stage data-voxel-case="car" data-voxel-step="blocks">
          <div class="module-3d-host voxel-forge-3d" data-module-3d="voxel" data-module-3d-mode="car:blocks" aria-label="可拖动观察的方块塑形与组件组合三维课堂示意">
            <div class="module-3d-fallback voxel-fallback" aria-hidden="true">
              <span class="voxel-cluster rubber"></span><span class="voxel-cluster iron"></span><span class="voxel-cluster plastic"></span>
              <i>→</i><strong>组件</strong><i>→</i><strong>对象</strong>
            </div>
            <span class="module-3d-hint">拖动旋转 · 依次观察三层</span>
          </div>
          <aside class="voxel-ledger" aria-live="polite">
            <header><small>当前目标</small><b data-voxel-object-name>可滚动小车</b></header>
            <article><i class="voxel-swatch material-one"></i><span data-voxel-material="one">橡胶方块 → 四个轮组</span></article>
            <article><i class="voxel-swatch material-two"></i><span data-voxel-material="two">铁方块 → 车架</span></article>
            <article><i class="voxel-swatch material-three"></i><span data-voxel-material="three">塑料方块 → 方向盘与座椅</span></article>
          </aside>
        </div>
        <div class="voxel-layer-rail" aria-label="方块到对象的三层关系">
          <article data-voxel-layer="blocks" data-active><b>材料方块</b><span>共享网格，不同材料能力</span></article><i>→</i>
          <article data-voxel-layer="components"><b>功能组件</b><span>先为任务塑形与命名</span></article><i>→</i>
          <article data-voxel-layer="object"><b>功能对象</b><span>按接口组合并验证用途</span></article>
        </div>
        <div class="voxel-feedback" data-voxel-feedback aria-live="polite">先按材料能力选方块：橡胶、铁和塑料承担不同任务。</div>
        <div class="reveal-card conclusion" data-reveal><b>第三层：从更细粒度开始设计</b><span>自由度更高，也要承担更多塑形、接口、测试与维护工作；并不是越细越好。</span></div>`,
    },
    {
      id: "module-s03",
      source: "S03",
      section: "核心工具",
      title: "一个模块，有四个关键部分",
      subtitle: "不是随便切一刀，而是让一块承担清楚的任务。",
      theme: "blueprint",
      content: `
        <div class="pipeline four">
          <article><strong>01</strong><h3>输入</h3><p>交给它什么？</p></article>
          <i>→</i>
          <article><strong>02</strong><h3>处理</h3><p>它负责做什么？</p></article>
          <i>→</i>
          <article><strong>03</strong><h3>输出</h3><p>它交回什么？</p></article>
          <i>→</i>
          <article><strong>04</strong><h3>接口</h3><p>怎样连接别人？</p></article>
        </div>
        <div class="sorting-tray">
          <b>把登录模块的卡片放对位置：</b>
          <span>账号密码</span><span>核对身份</span><span>允许／拒绝进入</span><span>登录按钮与认证 API</span>
        </div>
        <div class="reveal-card conclusion" data-reveal><b>模块</b><span>有明确任务、输入、输出和接口的基本功能单元。</span></div>`,
    },
    {
      id: "module-s04",
      source: "S04",
      section: "为什么拆块",
      title: "拆成模块，会得到四种超能力",
      subtitle: "不是为了显得专业，而是让团队真的做得动。",
      theme: "paper",
      content: `
        <div class="power-grid">
          <article><b>👀</b><h3>看得懂</h3><p>复杂系统变成清楚责任</p></article>
          <article><b>🤝</b><h3>能分工</h3><p>成员可以并行推进</p></article>
          <article><b>🔧</b><h3>能替换</h3><p>坏一块，不必全部重做</p></article>
          <article><b>♻️</b><h3>能复用</h3><p>一块能力服务多个地方</p></article>
        </div>
        <div class="mission-question"><b>快速选择</b><span>轮胎坏了：整辆车重造，还是只换轮胎？对应哪一种超能力？</span></div>
        <div class="reveal-card" data-reveal><b>关键不是“拆得多”</b><span>稳定模块 + 明确接口，才让同一能力能够被替换、复用并接回不同整体。</span></div>`,
    },
    {
      id: "module-s05",
      source: "S05",
      section: "概念辨认",
      title: "功能、模块、产品，不是同一件事",
      subtitle: "从用户动作，到责任单元，再到完整解决方案。",
      theme: "archive",
      content: `
        <div class="layer-stack">
          <article class="layer product"><span>产品</span><b>校园失物招领工具</b><em>真正解决问题的整体</em></article>
          <article class="layer module"><span>模块</span><b>信息发布模块</b><em>支撑一组功能的责任单元</em></article>
          <article class="layer function"><span>功能</span><b>提交失物信息</b><em>用户能完成的一件事</em></article>
        </div>
        <div class="mission-question"><b>尺度题</b><span>轮组相对汽车是组件；相对轮胎和轴，它又是什么？</span></div>
        <div class="reveal-card" data-reveal><b>边界随任务改变</b><span>轮组内部也有更小模块；但一个按钮仍不一定承担完整业务责任。</span></div>`,
    },
    {
      id: "module-s06",
      source: "S06",
      section: "用户路径",
      title: "先跟着人走，不要先跟着技术走",
      subtitle: "真实用户怎么行动，就是串起模块的主线。",
      theme: "route",
      content: `
        <div class="user-route">
          <article><b>1</b><span>发现物品</span></article><i>→</i>
          <article><b>2</b><span>拍照登记</span></article><i>→</i>
          <article><b>3</b><span>系统发布</span></article><i>→</i>
          <article><b>4</b><span>失主搜索</span></article><i>→</i>
          <article><b>5</b><span>身份核对</span></article><i>→</i>
          <article><b>6</b><span>成功取回</span></article>
        </div>
        <div class="roleplay-card"><b>真人演一遍</b><span>每个人只说两句：“我拿到什么？”“我交出什么？”</span></div>
        <div class="reveal-card" data-reveal><b>每一步都问</b><span>谁，在什么场景下，要完成什么？</span></div>`,
    },
    {
      id: "module-s07",
      source: "S07",
      section: "归纳模块",
      title: "从需求，走到功能，再归纳模块",
      subtitle: "大家说法很乱没关系，先找重复动作和共同任务。",
      theme: "lab",
      content: `
        <div class="funnel-board">
          <div class="sticky-row"><span>“我想拍照”</span><span>“我要搜索”</span><span>“认领后提醒我”</span><span>“先核对身份”</span></div>
          <div class="funnel">↓ 找共同任务与重复动作 ↓</div>
          <div class="module-row"><span>信息模块</span><span>搜索模块</span><span>通知模块</span><span>身份模块</span></div>
        </div>
        <div class="mission-question"><b>便利贴归队</b><span>把“找、发、认领、通知、上传照片、核对身份”贴到你认为合适的模块。</span></div>
        <div class="reveal-card" data-reveal><b>允许不同拆法</b><span>只要能说清归类依据，并沿用户路径接得回来。</span></div>`,
    },
    {
      id: "module-s08",
      source: "S08",
      section: "高内聚",
      title: "找出通知模块里的“卧底”",
      subtitle: "一块里面，尽量只做同一类事情。",
      theme: "challenge",
      content: `
        <div class="suspect-grid">
          <article><b>A</b><span>生成提醒</span></article>
          <article><b>B</b><span>发送提醒</span></article>
          <article><b>C</b><span>记录是否送达</span></article>
          <article class="danger"><b>D</b><span>修改用户积分</span></article>
        </div>
        <div class="action-call large">先投票，再说：“它为什么不是通知模块的责任？”</div>
        <div class="reveal-card conclusion" data-reveal><b>高内聚</b><span>模块内部目标一致、责任集中；“修改积分”应该回到自己的模块。</span></div>`,
    },
    {
      id: "module-s09",
      source: "S09",
      section: "低耦合",
      title: "接口像插头：只按约定合作",
      subtitle: "不偷看对方内部，也不依赖对方每个细节。",
      theme: "terminal",
      content: `
        <div class="interface-demo">
          <article><small>订单模块</small><h3>我交出订单卡</h3><div class="data-chip">餐品：炒饭</div><div class="data-chip missing">地址：？？？</div><div class="data-chip">时间：12:10</div></article>
          <div class="plug">⇄<span>接口</span></div>
          <article><small>配送模块</small><h3>我按订单卡送达</h3><p>我不需要知道你内部怎么下单。</p></article>
        </div>
        <div class="mission-question"><b>接口传话</b><span>配送为什么卡住了？约定里缺了什么？</span></div>
        <div class="reveal-card" data-reveal><b>低耦合</b><span>约定输入、输出和异常；内部升级时，别人不用跟着重做。</span></div>`,
    },
    {
      id: "module-s10",
      source: "S10",
      section: "黑箱测试",
      title: "看不见里面，也能先测试它",
      subtitle: "先研究行为，再决定要不要打开黑箱。",
      theme: "mystery",
      content: `
        <div class="blackbox-lab">
          <div class="input-stack" aria-label="测试输入">
            <button type="button" data-blackbox-case="0" data-feedback="输入 2 → 返回 4：基础样例通过" aria-pressed="false"><b>2</b><small>测试输入</small></button>
            <button type="button" data-blackbox-case="1" data-feedback="输入 5 → 返回 10：重复样例通过" aria-pressed="false"><b>5</b><small>测试输入</small></button>
            <button type="button" data-blackbox-case="2" data-feedback="输入“文字” → 拒绝：发现失败行为" aria-pressed="false"><b>文字</b><small>故意给错</small></button>
          </div>
          <div class="blackbox"><i>?</i><b>神秘模块</b><small data-blackbox-status aria-live="polite">选择一个输入，观察返回</small></div>
          <div class="output-stack" aria-label="模块返回">
            <span data-blackbox-output><b>4</b><small>正常返回</small></span>
            <span data-blackbox-output><b>10</b><small>正常返回</small></span>
            <span data-blackbox-output data-result="拒绝"><b>?</b><small>异常返回</small></span>
          </div>
        </div>
        <div class="three-questions">
          <span>给它什么？</span><span>它返回什么？</span><span>失败时怎样？</span>
        </div>
        <div class="reveal-card" data-reveal><b>有效测试</b><span>不要只猜规则；还要试边界、异常和“故意给错”的输入。</span></div>`,
    },
    {
      id: "module-s11",
      source: "S11",
      section: "AI 模块",
      title: "AI 智能体，也不是“一整坨魔法”",
      subtitle: "少一块，它就可能会说、不会做，或者做完马上忘。",
      theme: "ai",
      content: `
        <div class="ai-orbit">
          <div class="ai-core">AI<br><small>基础模型</small></div>
          <article><b>提示词</b><span>任务与边界</span></article>
          <article><b>工具</b><span>搜索、文件、计算</span></article>
          <article><b>记忆／数据</b><span>持续需要的信息</span></article>
          <article><b>编排／验收</b><span>顺序与检查</span></article>
        </div>
        <div class="mission-question"><b>AI 侦探</b><span>“它搜到答案却马上忘了”——最可能缺哪一块？</span></div>
        <div class="reveal-card" data-reveal><b>别把 AI 当英雄</b><span>先看任务需要哪些模块，再决定 AI 在哪一块帮忙。</span></div>`,
    },
    {
      id: "module-s12",
      source: "S12",
      section: "团队实战",
      title: "把“校园订餐”拆成能工作的模块",
      subtitle: "七分钟，三道关卡。不是比谁拆得多。",
      theme: "mission",
      content: `
        <div class="checkpoint-grid">
          <article><b>01</b><h3>画路径</h3><p>从想吃，到收到餐</p><em>先画用户动作</em></article>
          <article><b>02</b><h3>归模块</h3><p>拆成 4—7 个责任单元</p><em>说清为谁解决什么</em></article>
          <article><b>03</b><h3>找异常</h3><p>售罄、迟到、地址错……</p><em>至少找到一个断点</em></article>
        </div>
        <div class="candidate-chips"><span>菜单</span><span>下单</span><span>商家接单</span><span>配送</span><span>通知</span><span>结算</span><span>反馈</span></div>
        <div class="reveal-card" data-reveal><b>通关口令</b><span>每个模块都能说：“我只负责……”</span></div>`,
    },
    {
      id: "module-s13",
      source: "S13",
      section: "接口卡",
      title: "让每个模块拿到一张“工作证”",
      subtitle: "别人不用猜，就知道怎样和它合作。",
      theme: "paper",
      content: `
        <div class="interface-card-demo">
          <header><span>MODULE CARD</span><b>模块接口卡</b></header>
          <div class="card-field"><small>模块名称</small><strong>________________</strong></div>
          <div class="card-field"><small>唯一责任</small><strong>我只负责 __________________</strong></div>
          <div class="card-pair"><div><small>输入</small><p>谁把什么交进来？</p></div><div><small>输出</small><p>成功／失败返回什么？</p></div></div>
          <div class="card-pair"><div><small>依赖</small><p>必须调用谁？</p></div><div><small>负责人</small><p>谁主导、谁支援？</p></div></div>
        </div>
        <div class="mission-question"><b>模块相亲</b><span>拿着你的输出，去找能接住它的下一个模块。</span></div>
        <div class="reveal-card" data-reveal><b>只准问三句</b><span>给你什么？你还我什么？失败怎么办？</span></div>`,
    },
    {
      id: "module-s14",
      source: "S14",
      section: "拼装测试",
      title: "拆得开，还要接得回",
      subtitle: "真正的模块化，要经得起拔掉和替换。",
      theme: "lab",
      content: `
        <div class="test-rig">
          <article><span>菜单</span></article><i>→</i>
          <article><span>下单</span></article><i>→</i>
          <article class="removed"><span>配送</span><b>已拔掉</b></article><i>→</i>
          <article><span>通知</span></article>
        </div>
        <div class="test-question-grid">
          <article><b>拔掉测试</b><span>整条路径中断，还是可以降级？</span></article>
          <article><b>替换测试</b><span>人工配送换机器人，接口不变时谁要改？</span></article>
        </div>
        <div class="reveal-card conclusion" data-reveal><b>验收标准</b><span>前一块的输出，能成为后一块的输入。</span></div>`,
    },
    {
      id: "module-s15",
      source: "S15",
      section: "本课验收",
      title: "用四句话，发布你们的模块地图",
      subtitle: "六十秒，让另一组听懂你们怎样拆、怎样接。",
      theme: "showcase",
      content: `
        <div class="sentence-grid">
          <article><b>1</b><span>我们服务的用户是……</span></article>
          <article><b>2</b><span>用户要走的关键路径是……</span></article>
          <article><b>3</b><span>我们拆成了……模块，因为……</span></article>
          <article><b>4</b><span>模块通过……输入／输出连接</span></article>
        </div>
        <div class="delivery-box"><small>本课交付</small><b>一张项目模块地图</b><b>至少一张模块接口卡</b></div>
        <div class="reveal-card" data-reveal><b>听众任务</b><span>交一张票：“最清楚的接口”或“我还想追问”。</span></div>`,
    },
    {
      id: "module-s16",
      source: "S16",
      section: "下一关",
      title: "模块有了，怎样防止 AI 做偏？",
      subtitle: "同一句“帮我做登录模块”，每个人和 AI 都可能理解不同。",
      theme: "finale",
      content: `
        <div class="forking-paths">
          <div class="prompt-chip">帮我做登录模块</div>
          <i>↙</i><i>↓</i><i>↘</i>
          <article><b>目标不同</b><span>给谁使用？解决什么？</span></article>
          <article><b>边界不同</b><span>做什么？不做什么？</span></article>
          <article><b>完成不同</b><span>怎样才算真的可用？</span></article>
        </div>
        <div class="mission-question"><b>最后一问</b><span>不说清哪件事，AI 最容易做偏？</span></div>
        <div class="reveal-card conclusion" data-reveal><b>下一课：立棍</b><span>给每个模块插上目标、边界和完成标准。</span></div>`,
    },
  ];

  window.MSV_MODULE_DECK = Object.freeze({
    id: "module-thinking-p1",
    version: "2026.09.19-r5",
    title: "模块思维：把大问题拆成能工作的模块",
    sourceHash: "a31489645adcfaf6b7afd3be734349175740c520120cda65552cfa0f3e833793",
    slides: Object.freeze(slides.map(Object.freeze)),
  });
})();
