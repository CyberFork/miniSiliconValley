import { elemeClassroomCampaign } from "./eleme-classroom-campaign";
import { learnerCardTitle } from "../lib/evidence-boundary";

export interface StudentRealityMission {
  title: string;
  deliverable: string;
  acceptance: string[];
  timeboxMinutes: number;
}

export interface StudentChapterCopy {
  id: string;
  title: string;
  location?: string;
  briefing: string;
  learningGoal: string;
  historicalBoundary: string[];
  realityMission: StudentRealityMission;
  scene: string;
  steps: readonly [string, string, string];
  doneWhen: string;
}

type StudentHistoryCopy = {
  happened: string;
  comparisonPrompts: string[];
};

export const STUDENT_CHAPTER_COPY = {
  "google-1995-find-problem": {
    "id": "google-1995-find-problem",
    "title": "先找到：同学到底卡在哪一步",
    "briefing": "现在是1995—1996年。校园里能找到的网页越来越多，但同学常常来回翻找。先别设计搜索引擎；先找出谁在做什么任务、卡在哪一步、浪费了什么。",
    "learningGoal": "能用一句具体的话说清问题：哪个人，在什么场景，为了完成什么任务，遇到了什么看得见的困难。",
    "historicalBoundary": [
      "现在只知道Page与Brin在Stanford合作，项目后来被称为BackRub。",
      "现在还不知道1998年的论文、公司成立、广告或上市结果，不能拿后来成功证明今天的选择。",
      "卡片上若写着“一种看法”“一种猜测”或“未确认消息”，就不能说成已经发生的事实。"
    ],
    "realityMission": {
      "title": "观察两个人怎样找资料",
      "deliverable": "选一个真实学习任务，请两位同学当场找资料；记录他们输入了什么、在哪里来回、何时放弃或去问别人。",
      "acceptance": [
        "两个人做的任务或背景不同。",
        "每个困难都写出发生的步骤和看得见的结果。",
        "最后写一句不带产品名字的问题，并写下一次准备怎么确认。"
      ],
      "timeboxMinutes": 30
    },
    "scene": "你在1995年的校园机房。队友只有零散目录、一些链接和同学的抱怨。你们要先找到真正值得解决的困难。",
    "steps": [
      "请两位同学各完成一次真实找资料任务。",
      "按顺序记下输入、点击、来回、求助和放弃。",
      "圈出最常发生的一处困难，写成一句问题。"
    ],
    "doneWhen": "团队能指出一个具体人、一个具体任务、一处具体困难和至少两条观察记录。"
  },
  "google-1997-validate-problem": {
    "id": "google-1997-validate-problem",
    "title": "用小测试分清：没找对、太慢，还是不敢信",
    "briefing": "现在是1997—1998年。团队怀疑搜索结果“不够有用”，但还不知道主要是排得不对、等得太久，还是用户不敢相信。用同一批任务做小测试。",
    "learningGoal": "把“搜索不好用”拆成三个能观察的结果：有没有找到对的资料、花了多久、用户敢不敢拿它继续完成任务。",
    "historicalBoundary": [
      "可以使用1997—1998年的公开资料，知道早期Google原型在研究网页链接。",
      "论文中的大规模结果要到历史揭晓后再看，不能先把答案拿来证明自己的实验。",
      "测试失败和反例也要留下；不能只报最好看的数字。"
    ],
    "realityMission": {
      "title": "用10个任务比较“对、快、敢用”",
      "deliverable": "准备10个带具体目标的查询，让两位同学完成；分别记录结果是否有用、用了多久、是否愿意相信，以及为什么改写。",
      "acceptance": [
        "每个查询都写明要完成的任务。",
        "至少保留一个“结果很多但没用”或“很快但不敢信”的例子。",
        "第二轮至少改一处，并指出是哪条记录让你改。"
      ],
      "timeboxMinutes": 35
    },
    "scene": "两位同学做同样的找资料任务。你们拿秒表和记录纸，比较“找对、够快、敢用”哪一个最影响完成任务。",
    "steps": [
      "准备10个写明任务目标的查询。",
      "记录完成、改写、翻页、求助和放弃。",
      "找一个反例，改一次测试办法。"
    ],
    "doneWhen": "团队能拿出一个“看起来成功但实际没完成任务”的例子，并说明下一轮改了什么。"
  },
  "google-1998-design-solution": {
    "id": "google-1998-design-solution",
    "title": "画出：从输入到结果为什么这样排",
    "briefing": "现在是1998—1999年。网页之间的链接也许能帮助排序，但用户还要看得懂为什么这个结果值得点。画出一个最小方案，并写清它会在哪些情况失灵。",
    "learningGoal": "把方案画成一条完整路径：用户输入什么、系统怎样排、页面怎样解释、用户怎样指出错误。",
    "historicalBoundary": [
      "可以知道1998年公开论文讨论了网页链接，项目改名并走向公司化。",
      "不能使用后来广告系统、巨大规模或上市后的做法替今天的设计背书。",
      "你们画出的界面和规则是玩家方案，不是历史上已经发生的事实。"
    ],
    "realityMission": {
      "title": "做一张看得懂排序理由的原型",
      "deliverable": "用12份资料做纸面或代码原型：每个查询给出结果顺序、一句排序理由和一个可能出错的例子，再让同学完成任务。",
      "acceptance": [
        "至少包含3种不同任务。",
        "每句排序理由都能指出用了哪条资料或规则。",
        "第二轮改一处，并保留一个还没解决的问题。"
      ],
      "timeboxMinutes": 40
    },
    "scene": "桌上有12份资料。团队要决定怎样排序，并让第一次使用的人能看懂“为什么它在前面”。",
    "steps": [
      "为3种任务各排一次资料顺序。",
      "给每个结果写一句可检查的理由。",
      "请同学试用，按一次误解或错误改第二版。"
    ],
    "doneWhen": "团队能演示一次从输入到结果的完整过程，并指出一个方案会失败的场景。"
  },
  "google-2000-build-mvp": {
    "id": "google-2000-build-mvp",
    "title": "做出：一个陌生同学能用的搜索小样",
    "briefing": "现在是2000—2002年。把方案做成能测试的最小闭环：输入、收集资料、返回结果、完成任务、记录失败。资源有限，只留下非做不可的部分。",
    "learningGoal": "能决定第一版必须做什么、暂时不做什么，并让真实用户独立完成一次任务。",
    "historicalBoundary": [
      "可以使用2000年前后的早期搜索工程资料，也知道广告服务在这一时期开始出现。",
      "不能把后来的云服务、现代广告系统或机器学习当作现成工具。",
      "课堂里的钱、工具和挑战是模拟规则，不是Google真实账本。"
    ],
    "realityMission": {
      "title": "用不超过20页资料做搜索小样",
      "deliverable": "做一个纸面、表格或代码小样，让两位同学独立完成3个任务；记录结果、等待、失败、改写和第二版变化。",
      "acceptance": [
        "至少一位用户能从输入开始独立完成任务。",
        "写清资料范围、排序办法、需要多久和什么情况算失败。",
        "第二版至少改范围、排序、提示或判断标准中的一项。"
      ],
      "timeboxMinutes": 45
    },
    "scene": "你们只有少量资料和有限服务器。第一版不求大，只求一个陌生同学能独立从输入走到可用结果。",
    "steps": [
      "圈出第一版非做不可的3个动作。",
      "让两位同学独立使用并记录卡住处。",
      "根据一次真实失败改出第二版。"
    ],
    "doneWhen": "用户能独立完成至少一个任务，团队能说清删掉了什么、为什么删、第二版改了什么。"
  },
  "google-2003-operate-brand": {
    "id": "google-2003-operate-brand",
    "title": "守住：用户变多后仍然清楚、可靠、能维护",
    "briefing": "现在是2003—2004年。产品用户变多后，速度、错误、商业内容和合作渠道都会影响信任。团队要做一份“怎样继续增长但不骗用户”的计划。",
    "learningGoal": "把核心体验、赚钱方式、维护工作和停止条件分别写清，让用户能看见团队承诺有没有做到。",
    "historicalBoundary": [
      "可以使用2003—2004年的公开资料，并知道Google在2004年进入首次公开发行的披露流程。",
      "不能把后来全球产品、现代广告平台或公司文化当成当时已经完成的事。",
      "品牌口号和你们的经营方案不是事实证据；要用用户行为和公开记录检查。"
    ],
    "realityMission": {
      "title": "一页“增长但不透支信任”计划",
      "deliverable": "写一页计划：用户能得到什么、怎样赚钱、从哪里找到用户、要维护什么、什么情况必须暂停，以及怎样向用户说明。",
      "acceptance": [
        "体验数字和商业数字分开记录。",
        "至少写一个渠道依赖、一项维护支出和一个必须暂停的情况。",
        "收到反馈后改一处，并说明公开承诺怎样变化。"
      ],
      "timeboxMinutes": 40
    },
    "scene": "用户和合作方都在增加。团队必须决定哪些增长值得要、哪些承诺必须守、发生什么就暂停。",
    "steps": [
      "分开写体验、收入和维护三张清单。",
      "标出一项会伤害用户信任的风险。",
      "写出继续、降低承诺或暂停的明确条件。"
    ],
    "doneWhen": "团队能拿出一项可检查的用户承诺、一个维护安排和一个明确暂停条件。"
  },
  "eleme-2008-investigate-ordering": {
    "id": "eleme-2008-investigate-ordering",
    "title": "先查清：2008 年宿舍订餐卡在哪一步",
    "location": "上海某所大学宿舍与周边餐厅",
    "briefing": "你在 2008 年上海某所大学的宿舍。桌上有旧菜单、电话和几条不同人的线索。不要猜公司，也不要设计 App；先找出谁在订餐的哪一步反复受阻。",
    "learningGoal": "能写出一句具体问题，并把有来源的事、课堂模拟、自己的猜测和还不知道的事分开。",
    "historicalBoundary": [
      "现在不知道这支团队后来叫什么，猜中名称也不算通关。",
      "标着“F 有来源”的卡有公开资料支持；标着“R 课堂模拟”的卡不能当成真实采访。",
      "先完成问题卡和验证任务，老师才会打开 2009 年网站上线等历史行动。"
    ],
    "realityMission": {
      "title": "跟着两位同学走一遍真实订餐",
      "deliverable": "请两位不同同学各回忆或完成一次订餐，按顺序记下找信息、确认、下单、等待、改动和放弃。",
      "acceptance": [
        "每个人都写清当时要完成什么任务。",
        "每个困难都标明是本人动作、本人说法、我们的猜测还是未知。",
        "写出看到什么结果就会承认候选问题不成立。"
      ],
      "timeboxMinutes": 30
    },
    "scene": "宿舍里的同学饿了，手边只有几张菜单和电话。学生、餐厅、送餐人各自忙着不同的事。",
    "steps": [
      "从随机抽到的三张线索里找出一个具体动作。",
      "和队友拼出至少四张“谁、在哪、做什么、卡在哪、有什么影响”的问题卡。",
      "选一张最有证据的卡，写出下一位找谁、看到什么就推翻它。"
    ],
    "doneWhen": "团队交出四张具体问题卡、一张候选卡、F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道标签和一个可推翻的真人验证任务。"
  },
  "eleme-2008-choose-solution": {
    id: "eleme-2008-choose-solution",
    title: "三条路，先选一条能跑的",
    location: "宿舍作战桌与周边餐厅",
    briefing: "现在进入玩家的平行世界。把第一章找到的问题放进三条小路线：菜单表、统一电话、接单加配送。用同一个订餐任务比较，不凭喜好投票。",
    learningGoal: "能说清每条路线帮了谁、增加了什么麻烦，最后留一条主路线和一条备用路线。",
    historicalBoundary: [
      "公开资料只支持早期走访餐厅、整理信息、电话接单和人工配送等行动。",
      "三条路线、资源币、评分和取舍结果都是课堂模拟，不是历史会议记录。",
      "和历史做法相似不代表选对了；玩家仍要用自己的任务结果判断。",
    ],
    realityMission: {
      title: "让三条路线接受同一个订餐任务",
      deliverable: "用同一个人、同一份菜、同一个宿舍地址，分别走完菜单表、统一电话和接单配送三条路。",
      acceptance: ["学生、餐厅和执行团队的收益分开写。", "每条路都留一个失败信号。", "写出主路线、备用路线和至少五项这轮不做。"],
      timeboxMinutes: 35,
    },
    scene: "同一位同学要在宿舍订到一顿饭。桌上只有菜单、电话、订单纸和有限的资源币。",
    steps: ["用同一张订餐卡走完三条路。", "逐条记录少了什么、多了什么、会在哪失败。", "冻结主路、备用路和不做清单。"],
    doneWhen: "团队能演示三条路的完整动作，并说清主路线失败到什么程度就换备用路。",
  },
  "eleme-2008-build-product": {
    id: "eleme-2008-build-product",
    title: "做出别人真的能用的第一版",
    location: "宿舍原型台",
    briefing: "把上一章选定的路线做成纸面、电话或网页小样。这是玩家平行世界：先让陌生同学独立走完 V0，再根据一次真失败改成 V1。",
    learningGoal: "能做出从输入到结果的小作品，保留失败记录，并说出 V1 的每项改动来自哪一次失败。",
    historicalBoundary: [
      "历史资料支持早期曾有人工电话接单和配送。",
      "V0、V1、页面、表格字段、六个状态和测试结果全部是玩家方案。",
      "2009 年网站启动只是历史节点，不能证明玩家的小样就是当时产品。",
    ],
    realityMission: {
      title: "让两位没参与设计的同学试用",
      deliverable: "第一位操作 V0，第二位操作 V1；团队安静观察并记下卡住、求助、失败和恢复。",
      acceptance: ["陌生同学能亲手操作，不是团队代为演示。", "至少保留一条失败和一条仍未解决的问题。", "V1 只因可指出的失败证据而改，并能退回 V0。"],
      timeboxMinutes: 40,
    },
    scene: "桌上只有纸、电话、状态牌和少量工具。你们要让一张订单从“新建”真正走到“完成”或“失败”。",
    steps: ["做出可操作的 V0，连起输入、确认、处理、状态和结果。", "掷骰子让错菜、改地址、并发或售罄真的发生。", "只选影响最大的两处改成 V1，再用同一任务复测。"],
    doneWhen: "团队有可操作的 V0、至少三条失败记录、V0／V1 差异单和一次复测。",
  },
  "eleme-2008-enter-market": {
    id: "eleme-2008-enter-market",
    title: "找到第一小群愿意试的人",
    location: "一栋宿舍与附近少量餐厅",
    briefing: "这是玩家的平行世界。不要说“所有学生”；先找到一群在特定时间、特定地点遇到这个问题的人，用十秒说清你们能帮他少做哪一步。",
    learningGoal: "能说清第一小群人是谁、排除谁，写一句不夸大的十秒承诺，再跑一个真实渠道，或明确标为“R 课堂模拟”。",
    historicalBoundary: [
      "历史资料支持团队曾走访餐厅并开展校园外送实践。",
      "玩家选的人群、十秒承诺、渠道和漏斗数字都不是历史数据。",
      "没有真实发布或授权时，只能标为“R 课堂模拟”，不能声称已经合作或拉到用户。",
    ],
    realityMission: {
      title: "邀请三位真实同学试用",
      deliverable: "记录他们从哪里看到、是否愿意尝试、是否真的完成、是否再用，以及拒绝的原话。",
      acceptance: ["写清人群、时刻、地点和排除条件。", "触达、尝试、完成和再用分开记录。", "保留至少三条拒绝或失败，并做出继续、修改或停止的决定。"],
      timeboxMinutes: 35,
    },
    scene: "你们只有一张海报、一条群消息和几个可以真实联系的人。先找对第一小群，不追求看起来人多。",
    steps: ["写出谁、何时、在哪里遇到什么问题，以及这轮不找谁。", "把 V1 的真实能力改成十秒承诺，让三人复述。", "跑一个获授权的渠道，或诚实地做一次全程标为“R 课堂模拟”的角色演练。"],
    doneWhen: "团队有窄人群卡、承诺 V0／V1、真实渠道记录或标为“R 课堂模拟”的演练记录，以及下一轮决定。",
  },
  "eleme-2008-operate-loop": {
    id: "eleme-2008-operate-loop",
    title: "让每一单都有人接、有人记、有人收尾",
    location: "模拟接单桌与配送路线",
    briefing: "这是玩家的运营模拟。让三张订单从接单、确认、转交、配送、通知到收尾都能被找到；钱也要分清收入、成本、个人垫付和团队余额。",
    learningGoal: "能写出四人轮换也能照做的流程，对上每一单和每一笔钱，再因一条真实反馈改一处。",
    historicalBoundary: [
      "公开资料支持早期存在人工接单、组织配送和创始成员亲自送餐等行动。",
      "七步流程、订单号、收入、成本、垫付、积分和利润都是课堂模拟。",
      "钱包里还有钱不等于赚钱；先补齐未付成本和个人垫付，才能计算这轮结果。",
    ],
    realityMission: {
      title: "跑三单，并把一单失败改成第二版",
      deliverable: "记录每单状态、收入、成本、退款或补救、个人垫付和最后结果，然后用一条反馈改流程并复测。",
      acceptance: ["每一步都有负责人、输入、输出和交接物。", "收入、变动成本、固定投入和个人垫付分开记。", "第二轮只改一处，并用相同的失败场景再试。"],
      timeboxMinutes: 45,
    },
    scene: "三张订单同时来到桌上：一张地址不清，一张餐品售罄，一张需要成员先垫钱。所有人都要能查到当前状态。",
    steps: ["画出七步流程，中途轮换岗位后继续跑。", "逐单记收入、成本、垫付、退款、状态和补救。", "选一条用户、餐厅或执行者反馈，只改流程一处再跑。"],
    doneWhen: "团队交出七步流程、三单订单簿、对平的团队与个人账本，以及一次可复测的改动。",
  },
} satisfies Record<string, StudentChapterCopy>;

export const STUDENT_HISTORY_COPY: Record<string, StudentHistoryCopy> = {
  "google-1995-find-problem": {
    happened: "有来源的资料显示：Page和Brin在1995年在Stanford相识，1996年一起做了BackRub项目。他们后来确实研究过“看网页之间如何互相链接”来帮助搜索；但站在1995年的人并不知道它以后会做多大、是否成功。",
    comparisonPrompts: ["我们写的是“同学遇到的麻烦”，还是只写“网页太多”？", "哪张卡是有来源的事，哪张还只是看法或猜测？", "如果我们在当时不知道1998年的结果，有哪一步仍然必须自己试？"],
  },
  "google-1997-validate-problem": {
    happened: "1998年公开论文介绍了早期Google搜索小样：它使用网页之间的链接，也必须处理收集页面、存资料、回答查询和任何人都能发布内容带来的麻烦。公开资料也把1998年记为项目走向公司化的重要时间点。",
    comparisonPrompts: ["我们测到的是“真的找到并用上”，还是只是点击多、页面快？", "哪个失败例子让我们不再把“链接多”当成答案？", "就算后来论文成功发表，在当时还有哪个结果必须由用户自己测？"],
  },
  "google-1998-design-solution": {
    happened: "公开资料把BackRub“跟踪网页互相链接”的思路与PageRank方向连在一起。1998年论文写到利用网页的文字和链接关系，Google官方资料则记录了项目改名、公司成立和早期办公地点变化。",
    comparisonPrompts: ["我们有没有把“看链接”说成永远不会错的办法？", "第一次使用的人能不能说出排序理由，又知道什么时候不该相信？", "哪一处和历史资料相似，哪一处是我们自己设计的不同路线？"],
  },
  "google-2000-build-mvp": {
    happened: "早期Google资料显示，搜索不只是一个结果页：还要收集页面、存文字和链接、处理越来越多的资料，并让用户拿到有用结果。Google官方广告资料把2000年前后记为广告业务的早期时间点。课堂里的具体范围、数字和规则是我们的方案，不是Google当时的逐步记录。",
    comparisonPrompts: ["我们的作品是只有演示页，还是有输入、处理、结果、用户任务和失败记录？", "加入商业内容后，哪个数字可以变，哪个用户结果绝对不能变差？", "知道当时设备有限后，我们会删掉哪个承诺，而不是只讲创业传奇？"],
  },
  "google-2003-operate-brand": {
    happened: "Google官方资料记录了1998年公司化、早期办公地点和后续扩张；官方广告资料记录了2000年前后的商业化时间点；SEC的2004年S-1文件显示Google进入首次公开发行的注册披露流程。这些只能说明公开发生过什么，不能替团队回答每次增长压力下应该怎样选。",
    comparisonPrompts: ["我们的承诺能不能让用户看见，又写清什么情况必须暂停？", "商业内容和普通结果有没分清，每章维护要花的钱有没记？", "一家公司开始向公众披露文件后，要多记哪些风险和责任，为什么这不等于自动成功？"],
  },
  "eleme-2008-investigate-ordering": {
    happened: "上海交通大学公开资料记载：张旭豪等人在 2008 年从校园餐饮外送实践起步，走访餐厅、整理订餐信息、用电话人工接单，并亲自参与送餐；网站在 2009 年正式启动。这些行动说明团队进入了真实流程，却不能证明所有学生都需要、所有餐厅都愿意合作，或当时已经能盈利和扩大。",
    comparisonPrompts: [
      "我们的候选问题说清了哪一类人和哪一步吗？",
      "哪一条标为“F 有来源”，哪一条标为“R 课堂模拟”？",
      "哪项历史行动帮助看见流程？它仍然不能证明什么？",
      "如果猜中公司却没有验证任务，为什么还没通关？",
    ],
  },
  "eleme-2008-choose-solution": {
    happened: "公开资料能证明早期团队走访餐厅、整理信息、用电话接单并组织配送。课堂中的三条路线、资源币、评分和选择是玩家平行世界，不是历史会议记录。",
    comparisonPrompts: ["我们的主路线先帮了谁，又给谁增加了动作？", "哪张“F 有来源”卡只说明历史上有这个行动，却不能证明我们的路线有效？", "如果主路线失败，我们看到什么就切换到备用路？", "哪一项不做让下一章真的能做出小样？"],
  },
  "eleme-2008-build-product": {
    happened: "公开资料支持早期人工电话接单、组织配送，也把网站启动记在 2009 年。它没有公开本课堂的表单、状态、页面、V0／V1 或测试结果；这些全是玩家推演。",
    comparisonPrompts: ["陌生同学不听讲解时，真的能从输入走到结果吗？", "哪一次失败让我们改出 V1，如果没有这条记录还会改吗？", "2009 年有网站这件事，为什么不能证明我们的页面就是对的？", "V1 让原来能完成的任务变差时，我们怎样退回 V0？"],
  },
  "eleme-2008-enter-market": {
    happened: "公开资料支持早期团队曾走访餐厅并开展校园餐饮外送实践。这不能证明玩家选的第一小群人、十秒承诺、渠道或漏斗数字就是历史做法；这些结果要由玩家自己验证。",
    comparisonPrompts: ["我们的第一小群人是谁，这轮明确不包括谁？", "三位同学能否用自己的话复述十秒承诺？", "我们记录的是看到消息、愿意试、完成还是再用？", "哪项渠道行动有真实授权，哪项只能标为 R 课堂模拟？"],
  },
  "eleme-2008-operate-loop": {
    happened: "公开资料支持早期人工接单、组织配送和创始成员亲自送餐。它不提供本课堂的七步流程、订单数、收入、成本、垫付或利润数字；这些账本和规则都是玩家模拟。",
    comparisonPrompts: ["任意两位同学换岗后，订单仍能继续吗？", "钱包余额、收入、成本、个人垫付和利润有没有分开？", "哪条失败或反馈使流程只改了一处？", "历史上创始成员亲自送餐，为什么仍不能证明每单赚钱或可以扩大？"],
  },
};

export const STUDENT_CARD_COPY = {
  "g95-p-01": {
    "body": "想象一名同学为完成作业，在多个页面和目录之间来回找资料。先数他花了多久、在哪一步放弃；别急着说原因只是“网页太多”。",
    "sharePrompt": "说出这个人的任务、一次来回动作和一个损失；再问队友：哪一点还只是我们的猜测？"
  },
  "g95-p-02": {
    "body": "一种看法：用户可能只想要几条真正能用的结果，而不是一张更长的清单。这还不是事实，要看任务时间和复查次数。",
    "sharePrompt": "先声明这是一种看法，再问队友：我们要观察什么，才能知道它对不对？"
  },
  "g95-p-03": {
    "body": "一种猜测：如果用户反复改写同一个查询，问题可能是结果不相关，或他不知道怎样表达。要收集失败查询并问本人原因。",
    "sharePrompt": "举出一次可能的改写，再让队友提出一个能证明这项猜测错了的结果。"
  },
  "g95-d-01": {
    "body": "Stanford公开资料把Page、Brin的早期合作和BackRub项目连在一起。这只能说明研究从哪里开始，不能证明后来一定成功。",
    "sharePrompt": "告诉队友这条事实能证明什么、不能证明什么。"
  },
  "g95-d-02": {
    "body": "后来公开的论文写到：网页之间的链接可以成为搜索排序的一种线索。但在1995—1996年的场景里，它还只是准备测试的办法。",
    "sharePrompt": "把“看链接”翻成一个用户能感觉到的变化，再说怎样测试。"
  },
  "g95-d-03": {
    "body": "一种风险猜测：如果链接越多就排得越前，有人可能故意制造很多链接。现在还没有结论，需要同时找成功例子和反例。",
    "sharePrompt": "说明这是风险猜测，再问队友：看到什么反例会让我们改变做法？"
  },
  "g95-m-01": {
    "body": "人工整理的网站目录和熟人推荐能帮助用户找到入口，但可能漏内容、更新慢或让人不放心。先观察用户到底卡在哪一步。",
    "sharePrompt": "分别说一个“找不到入口”“内容没用”“不敢相信”的动作。"
  },
  "g95-m-02": {
    "body": "一种看法：当时的网站入口站可能愿意带来用户，也可能要求固定展示位置、速度或内容。合作前要把交换条件写清。",
    "sharePrompt": "说出一个合作条件，再问队友：它会不会改变用户看到的结果？"
  },
  "g95-m-03": {
    "body": "一条未确认消息：有人说现有目录很快会收齐所有重要网页。现在不能当事实，必须查是谁说的、指哪些网页、什么时候做到。",
    "sharePrompt": "先标明这是未确认消息，再说你准备核对哪三件事。"
  },
  "g95-o-01": {
    "body": "收集网页、存资料、访谈同学和人工整理都要花时间和设备。先决定最少要看多少资料、什么情况就停止。",
    "sharePrompt": "列出一项一次性花费和一项会不断增加的花费。"
  },
  "g95-o-02": {
    "body": "Stanford公开资料记录了早期原型使用有限的磁盘和服务器。这能证明资源不多，但不能单独证明哪种产品选择一定对。",
    "sharePrompt": "把“服务器有限”连到一个用户会遇到的具体结果。"
  },
  "g95-o-03": {
    "body": "一种猜测：设备有限时，先用一个小场景和少量资料测试，可能更快学到东西。团队还要写清什么时候扩大范围。",
    "sharePrompt": "说出第一轮最小样本，再问队友：达到什么结果才扩大？"
  },
  "g97-p-01": {
    "body": "公开论文提醒我们：搜索不仅要处理很多网页，还要够快，并让用户拿到更满意的结果。只数返回了多少条不够。",
    "sharePrompt": "把“更满意”换成两个看得见的用户动作。"
  },
  "g97-p-02": {
    "body": "当第一批结果没用或不可信，用户可能改写、翻页、换到目录，或去问熟人。这些动作能告诉我们失败发生在哪里。",
    "sharePrompt": "选两个替代动作，分别判断更像“没找对”还是“不敢信”。"
  },
  "g97-p-03": {
    "body": "一种猜测：用户找到能用的资料后不再改写，可能比“点过一次”更能说明任务完成。要用同一批小任务比较。",
    "sharePrompt": "如果点击很多但任务没完成，你会保留哪个数字？说出理由。"
  },
  "g97-d-01": {
    "body": "1998年公开论文写到：可以使用网页之间的链接来帮助搜索，也指出任何人都能发布网页会带来麻烦。它给出研究方向，不保证结果一定好。",
    "sharePrompt": "说出这条事实给了什么方向，又没有保证什么。"
  },
  "g97-d-02": {
    "body": "做测试时要故意放进两类反例：链接很多但和任务无关的页面，以及链接少却真正有用的页面。",
    "sharePrompt": "设计最少两个对照例子，别把“链接多”直接当“更相关”。"
  },
  "g97-d-03": {
    "body": "一种看法：只测试正常页面会漏掉有人故意操纵链接的风险。即使现在没看到普遍操纵，也要先写出怎样发现。",
    "sharePrompt": "先区分看法与事实，再说哪个结果会让你降低链接的作用。"
  },
  "g97-m-01": {
    "body": "一次偶然访问不能证明产品有用。更强的信号是：用户下次还回来、愿意推荐，或能说清为什么结果帮到了他。",
    "sharePrompt": "把重来、推荐和入口流量分开，选一个最接近用户任务的信号。"
  },
  "g97-m-02": {
    "body": "一种看法：合作方若要求一周内上线，团队可能来不及保留公平比较和失败记录。快上线不等于验证有效。",
    "sharePrompt": "说出一条再赶时间也不能删掉的测试步骤。"
  },
  "g97-m-03": {
    "body": "一条未确认消息：有人说当时的入口网站只在乎用户停留更久。找不到原始来源前，不能拿它代表用户价值。",
    "sharePrompt": "先说怎样核对这条消息；若核对不了，要在决定里怎样标记？"
  },
  "g97-o-01": {
    "body": "公开论文把机器收集网页、整理网页目录和处理大量查询都列为工程难题。测试要同时记结果质量、等待、失败和更新花费。",
    "sharePrompt": "选一个运行数字，并说它到什么程度会让用户任务失败。"
  },
  "g97-o-02": {
    "body": "如果第一轮因服务器中断少返回结果，就不能把差异全怪到排序办法上。先固定运行条件并记录中断。",
    "sharePrompt": "说出一种应该重做的失败，以及一种本身就说明产品有问题的失败。"
  },
  "g97-o-03": {
    "body": "一种猜测：如果新办法只能处理很小的网页目录，第一轮可能要先服务一个最重要的任务。还要用容量测试决定何时扩大。",
    "sharePrompt": "设计一个最小容量测试，再说达到什么结果才增加资料。"
  },
  "g98-p-01": {
    "body": "当两个结果看起来都相关，用户可能先看来源、上下文或其他可核对线索。方案要帮助他检查，而不是要求他盲信顺序。",
    "sharePrompt": "选一种要展示的检查线索，再问队友：它会帮忙还是让页面更乱？"
  },
  "g98-p-02": {
    "body": "一种看法：只保留一个清楚任务的入口，可能比堆很多功能更容易学会。要用第一次完成任务和出错后能否恢复来检查。",
    "sharePrompt": "说清这个简洁入口服务谁，并指出少了什么会让他不敢用。"
  },
  "g98-p-03": {
    "body": "一种猜测：让用户标记“不相关”或“过时”，也许能找到排序盲点。但单个反馈也可能带偏，需要抽样复查。",
    "sharePrompt": "说出一条反馈怎样进入第二版，而不是直接被当成真相。"
  },
  "g98-d-01": {
    "body": "Google与Stanford公开材料把BackRub分析网页链接和后来称为PageRank的方向连在一起。这说明办法从哪里来，不保证每次查询都适用。",
    "sharePrompt": "用自己的话解释“看网页之间的链接”怎样帮助排序，再说一种不适用的情况。"
  },
  "g98-d-02": {
    "body": "公开论文指出：网上任何人都可以发内容。方案不能只算一个分数，还要处理低质量、故意操纵、网页更新和资料范围。",
    "sharePrompt": "给方案加一条防止被操纵或使用过期资料的保护办法。"
  },
  "g98-d-03": {
    "body": "一种猜测：把链接、查询词、链接文字或用户反馈组合起来，可能比只数链接更稳。但组合后仍要能解释、能撤回。",
    "sharePrompt": "若平均结果变好却伤到一类用户，你准备怎样发现？"
  },
  "g98-m-01": {
    "body": "用户不会因为技术存在就自动来。入口、第一次任务、再次使用和分享，都要和“是否拿到可用结果”连起来。",
    "sharePrompt": "选一个能带来真实测试用户的入口，并说怎样判断它没有改变实验。"
  },
  "g98-m-02": {
    "body": "一种看法：合作渠道能带来更多测试用户，也可能要求优先展示或替它背书。要把这些条件写进方案。",
    "sharePrompt": "把合作条件分成“能撤回”和“难撤回”两类。"
  },
  "g98-m-03": {
    "body": "一条未确认消息：有人说某个入口网站会把自己的结果排在前面。没有原始证据前，只能把它当成待调查问题。",
    "sharePrompt": "说出这条消息最容易让团队做出的过度反应，再给一个低成本核对办法。"
  },
  "g98-o-01": {
    "body": "公开论文把机器收网页、建立网页目录和回答查询都列为搜索系统的关键工作。设计图要写清更新多快、等多久、失败后用户怎么办。",
    "sharePrompt": "指出一个服务器或资料数量假设，并说它错了时怎样缩小服务。"
  },
  "g98-o-02": {
    "body": "网页会变化，机器收网页也会失败，保存的网页目录可能落后。相同查询在不同时间出现不同结果时，要让用户有办法核对。",
    "sharePrompt": "说出哪种变化必须告诉用户，哪种可以等下一版处理。"
  },
  "g98-o-03": {
    "body": "一种猜测：先只服务几种清楚任务，团队更容易解释排序、看清更新花费和发现错误。扩大前要定条件。",
    "sharePrompt": "说出缩小范围会让谁暂时得不到帮助，并判断是否值得。"
  },
  "g00-p-01": {
    "body": "演示者若早就知道资料在哪里，原型看起来总会成功。真正的测试要让目标用户自己从输入开始，并记录完成、改写、放弃和求助。",
    "sharePrompt": "把“我演示成功”改成一条用户独立完成任务的证据。"
  },
  "g00-p-02": {
    "body": "公开论文同时谈到大规模搜索的工程困难和让用户拿到更满意结果。MVP既不能只证明机器能跑，也不能只问“喜不喜欢”。",
    "sharePrompt": "说出一个用户任务结果和一个运行结果，两者都要记录。"
  },
  "g00-p-03": {
    "body": "一种猜测：如果用户失败后不知道怎样改写，系统即使返回了结果也没走完最小闭环。要用失败任务来检查。",
    "sharePrompt": "资源只够做一个提示时，你会帮助哪一种失败？说出依据。"
  },
  "g00-d-01": {
    "body": "公开论文把收网页、整理文字与链接、处理查询和扩大规模看成一条完整链。课堂MVP可以做小，但不能少掉用户从输入到结果的关键一步。",
    "sharePrompt": "指出你们缩小了哪一段，并证明用户仍能完成任务。"
  },
  "g00-d-02": {
    "body": "每多收一批资料，收集、保存、更新和查询都可能更贵。先测一个能解释的小资料库，再写清什么时候增加。",
    "sharePrompt": "说出扩容后最可能变坏的一个数字，以及变坏时怎样降级。"
  },
  "g00-d-03": {
    "body": "一种看法：MVP要能撤回某个排序办法、资料来源或界面改动。这样第二版才知道是哪项变化造成结果不同。",
    "sharePrompt": "选一项必须能撤回的决定，并指定谁记录第一版和第二版差异。"
  },
  "g00-m-01": {
    "body": "Google官方广告历史把广告服务的早期节点放在2000年前后。这只说明商业试验开始出现，不说明广告具体怎样影响排序。",
    "sharePrompt": "说出这条事实支持什么，又有哪些排序问题仍不知道。"
  },
  "g00-m-02": {
    "body": "一种看法：即使广告能付服务器费用，用户也要看得出哪些是普通结果、哪些是商业内容。清楚标记应该从第一版就考虑。",
    "sharePrompt": "设计一个简单标记，再说不标时用户可能误会什么。"
  },
  "g00-m-03": {
    "body": "一条未确认消息：有人说只要放广告，收入就能付掉所有增长花费。没有价格、使用人数、成本和信任测试前不能相信。",
    "sharePrompt": "列出至少三个必须拿到的数字，才能把这句话变成可测试的猜测。"
  },
  "g00-o-01": {
    "body": "演示时人少、机器压力小，不代表每天都能稳定使用。MVP要记录等待时间、失败次数、恢复多久和谁负责维护。",
    "sharePrompt": "选最少三个运行数字，并说每个数字变坏时要做什么。"
  },
  "g00-o-02": {
    "body": "Stanford公开资料记录了早期Google服务器使用有限磁盘和简陋外壳。这说明资源紧张，不能把简陋浪漫化成“所以一定可靠”。",
    "sharePrompt": "说出资源紧张怎样改变第一版范围，以及哪项风险不能靠热情解决。"
  },
  "g00-o-03": {
    "body": "一种猜测：若资料更新和回答速度有上限，提前告诉用户服务范围，可能比假装什么都能搜更值得信任。仍要问用户能否接受。",
    "sharePrompt": "写一句缩小范围的用户承诺，再问队友：它有没有伤到核心任务？"
  },
  "g03-p-01": {
    "body": "Google官方故事写下了“组织信息并让人们更容易使用”等公开承诺。它是可以检查的承诺，不代表每个时期都没有冲突。",
    "sharePrompt": "把一句大承诺改成一个用户能看到的动作和一个失败信号。"
  },
  "g03-p-02": {
    "body": "如果用户分不清普通结果、商业内容和过时资料，一次错误就可能被理解成故意隐瞒。先让不同内容能被看出来。",
    "sharePrompt": "说出页面必须公开哪一项信息，才能让用户分清错误、限制和商业内容。"
  },
  "g03-p-03": {
    "body": "一种猜测：把商业内容和服务限制标得更清楚，短期点击可能下降，但长期再次使用和信任可能上升。要分开测。",
    "sharePrompt": "若短期点击下降，看到什么长期行为会让你仍坚持清楚标记？"
  },
  "g03-d-01": {
    "body": "用户、网页、查询和更新都变多后，小测试里不明显的等待、过时和操纵问题可能频繁出现。运行数字要重新检查。",
    "sharePrompt": "选一个早期看起来正常、用户变多后可能失灵的数字。"
  },
  "g03-d-02": {
    "body": "公开论文指出网上内容不受一个团队控制，质量会不断变化。运营不能只做一次清理，要持续发现新问题。",
    "sharePrompt": "设计一个每周都能发现内容变坏的简单动作，而不是只写“人工检查”。"
  },
  "g03-d-03": {
    "body": "一种看法：新渠道或赚钱试验开始前，要先达到质量、服务器和可撤回的最低条件，否则增长会把风险藏起来。",
    "sharePrompt": "写出一条发布前必须通过的检查；若队友不同意，谁能暂停？"
  },
  "g03-m-01": {
    "body": "Google官方广告历史证明2000年前后已有广告服务线索，但不能证明广告和普通搜索结果具体怎样排列。这个边界仍要由团队设计和验证。",
    "sharePrompt": "说出“广告开始出现”与“排序怎样做”之间还缺哪条证据。"
  },
  "g03-m-02": {
    "body": "合作渠道能带来用户和收入，也会带来对伙伴目标、联合品牌和退出花费的依赖。经营计划要把依赖写出来。",
    "sharePrompt": "说出一项值得承担的渠道好处，再给一个能退出的条件。"
  },
  "g03-m-03": {
    "body": "一条未确认消息：有人把2004年公开发行想成“从此有无限资源”。公开文件只能证明披露和发行流程，不能保证经营结果。",
    "sharePrompt": "列出这条消息忽略的两项花费或执行风险。"
  },
  "g03-o-01": {
    "body": "美国证券交易委员会保存的2004年Google S-1文件证明公司进入首次公开发行的注册披露流程。它不能让玩家提前知道后来的市场表现。",
    "sharePrompt": "说出公开披露会要求团队把哪项口头风险写成可检查记录。"
  },
  "g03-o-02": {
    "body": "每增加一个渠道、页面或赚钱试验，都要增加监控、客服、服务器和规则检查。经营计划要先留维护费用，再谈能分多少钱。",
    "sharePrompt": "给增长计划补上一项维护工作和所需资源。"
  },
  "g03-o-03": {
    "body": "一种猜测：当质量、赚钱和渠道目标打架时，固定检查清单、风险记录和定期回看，比每次临时救火更可靠。",
    "sharePrompt": "设计一个最小循环：谁检查、何时检查、出现什么就暂停。"
  },
  "e08-f-01": {
    "body": "有来源的事实：上海一所大学的几名研究生在 2008 年开始尝试校园餐饮外送。它只说明有人开始行动，不代表所有学生都有同样需要。姓名和公司答案要等导师揭晓。",
    "sharePrompt": "说出它能证明什么、不能证明什么；再问队友还要找哪位真实同学。"
  },
  "e08-f-02": {
    "body": "有来源的事实：早期团队走访餐厅、整理订餐信息，并用电话处理订单。不同餐厅的具体做法仍要分别确认。",
    "sharePrompt": "把电话订餐拆成三个动作，指出哪一步还没有用户记录。"
  },
  "e08-r-01": {
    "body": "课堂模拟：一名学生晚上想订餐，手里只有几张旧菜单，不知道信息是否还有效。这不是一段真实采访。",
    "sharePrompt": "先说“这是模拟”，再说找谁、看什么才能确认它在现实中发生。"
  },
  "e08-r-02": {
    "body": "课堂模拟：学生不知道餐厅今晚是否营业、能不能送到这栋宿舍，只能逐个确认。",
    "sharePrompt": "演一遍逐个确认，指出时间浪费发生在哪个动作。"
  },
  "e08-r-03": {
    "body": "课堂模拟：餐厅工作人员一边照顾堂食，一边接电话、听菜名、记宿舍地址。可能出错，但现在还没有真实记录。",
    "sharePrompt": "说一个可能出错的地方，并把“可能”保留在句子里。"
  },
  "e08-r-04": {
    "body": "课堂模拟：送餐人同时拿到几个地址和时间要求，要决定先送哪一单。",
    "sharePrompt": "说清送餐人的任务和学生的任务哪里不同。"
  },
  "e08-c-01": {
    "body": "有来源的历史行动：2008 年的早期实践发生在网站正式启动之前。团队先进入真实订餐和配送流程。",
    "sharePrompt": "说出它说明先做了什么，也说出它不能证明哪种产品一定正确。"
  },
  "e08-c-02": {
    "body": "有来源的历史行动：团队先走访餐厅、整理订餐信息并印发材料。有人在认真整理，不等于所有信息一直准确。",
    "sharePrompt": "分别说一句“能证明”和“不能证明”。"
  },
  "e08-c-03": {
    "body": "有来源的历史行动：团队设置统一电话，由人接单和安排。统一入口减少一些来回，也会增加人工压力。",
    "sharePrompt": "指出减少的一步和新增加的一步。"
  },
  "e08-c-04": {
    "body": "有来源的历史行动：早期需要人工接听、记录并安排配送。它展示完整任务链，不证明已经能大规模运行。",
    "sharePrompt": "画出从电话到送达的动作链，圈出最容易漏信息的一步。"
  },
  "e08-c-05": {
    "body": "有来源的历史行动：创始团队早期亲自参与送餐。他们能直接看见流程，但这种做法不一定能一直扩大。",
    "sharePrompt": "说一条能观察到的证据，再说一项仍不知道的规模问题。"
  },
  "e08-c-06": {
    "body": "有来源的事实：上海交大资料把网站正式启动放在 2009 年。这个后来结果不能替我们回答 2008 年先该调查什么。",
    "sharePrompt": "解释为什么知道后来有网站，也不能跳过现在的问题卡。"
  }
} satisfies Record<string, { body: string; sharePrompt: string }>;

/**
 * The four player-world chapters are already authored as concrete props and
 * actions.  Build their learner projection from that source instead of keeping
 * a second 48-card transcript that can silently drift.  The projection keeps
 * the complete information while making the truth boundary the first sentence
 * a learner reads.
 */
const elemePlayerWorldChapters = elemeClassroomCampaign.chapters.slice(1);
const studentCardCopyRecord = STUDENT_CARD_COPY as Record<string, { body: string; sharePrompt: string }>;

for (const chapter of elemePlayerWorldChapters) {
  for (const card of chapter.infoCards) {
    if (studentCardCopyRecord[card.id]) throw new Error(`Duplicate generated student card copy: ${card.id}`);
    const title = card.title.replace(/^[FR]-\d+\s*·\s*/, "");
    const rawBody = sealElemeAnswer(card.body
      .replace(/^历史边界事实：/, "")
      .replace(/^课堂模拟（玩家平行世界，不是饿了么史实）：/, ""));
    const boundary = card.sourceIds.length > 0 ? "有来源的历史边界" : "玩家模拟，不是史实";
    studentCardCopyRecord[card.id] = {
      body: fitStudentText(`${boundary}「${title}」：${rawBody}`, 150),
      sharePrompt: fitStudentText(`轮到你时，先说「${title}」的边界，再${sealElemeAnswer(card.sharePrompt)}`, 70),
    };
  }
}

function fitStudentText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).replace(/[，；：\s]+$/u, "")}。`;
}

function sealElemeAnswer(value: string): string {
  return value
    .replaceAll("上海交通大学", "上海一所大学")
    .replaceAll("上海交大", "上海一所大学")
    .replaceAll("交大", "这所大学")
    .replaceAll("张旭豪", "一名创始成员")
    .replaceAll("饿了么", "这支历史团队");
}

export const STUDENT_ASSET_COPY: Record<string, { ability: string; risk: string; unlocks: string }> = {
  "asset-user-interview": {
    ability: "请一位真实同学回答：他在做什么、卡在哪里、损失了什么。老师只追问，不替团队下结论。",
    risk: "如果只问一种同学，答案可能只代表他。记录还有哪些人没问。",
    unlocks: "一张用户困难便签和一份访谈提问单",
  },
  "asset-query-log": {
    ability: "把每次输入、失败原因和下一次尝试写下来；争论时直接回看记录。",
    risk: "只记次数、不记当时在做什么，会误判问题大小。",
    unlocks: "失败查询清单和第二版修改依据",
  },
  "asset-relevance-workbench": {
    ability: "挑少量结果排一次顺序，并为每个结果写一句理由和一个反例。",
    risk: "如果没请用户试，团队喜欢的顺序不一定真的有用。",
    unlocks: "排序小实验和反例便签",
  },
  "asset-prototype-toolkit": {
    ability: "少做一次准备工作，更快做出能输入、能看到结果、能让用户试的小样。",
    risk: "画面很顺不代表真实使用顺；仍要记录等待、错误和不理解。",
    unlocks: "最小可用小样和第二版修改",
  },
  "asset-campus-beta": {
    ability: "每章得到一组匿名同学反馈；先说清问了哪些人，不能把几个人代表所有人。",
    risk: "校园里的同学可能和其他用户不同，还要记录没覆盖谁。",
    unlocks: "用户试用记录和口碑便签",
  },
  "asset-server-rack": {
    ability: "下一轮可以测试更多资料或更多查询，但仍要写明最多能处理多少。",
    risk: "买服务器不等于系统稳定；没有维护仍会出故障。",
    unlocks: "更大一轮测试和容量记录",
  },
  "asset-reliability-watch": {
    ability: "先写出要观察的数字、警报线和处理人，可挡住一次已经预想到的故障。",
    risk: "记录太多会拖慢行动；没有负责人，手册不会自己解决问题。",
    unlocks: "故障检查单和处理步骤",
  },
  "asset-partner-network": {
    ability: "从校园或网站入口获得一批测试用户；合作条件必须写在公开记录里。",
    risk: "伙伴可能要求更快上线或改变展示顺序，伤害团队原来的承诺。",
    unlocks: "渠道测试和一次合作谈判",
  },
  "asset-trust-review": {
    ability: "请一名没参与制作的人检查结果说明、商业标记和失败提示。",
    risk: "只改文字、不看结果是否真的有用，会让团队产生假安心。",
    unlocks: "一份信任检查清单",
  },
  "asset-sponsor-pilot": {
    ability: "测试一种小额收入办法，并把赚到的钱和用户是否完成任务分开记录。",
    risk: "短期收入可能诱使团队牺牲有用程度或清楚标记；先写不可越过的线。",
    unlocks: "一次收入小实验和用户影响记录",
  },
  "eleme-asset-problem-cards": {
    ability: "得到一组五格卡，照着写清谁、在哪、做什么、卡在哪、有什么影响。",
    risk: "出现“做平台／做 App”就说明写成了答案，要重写。",
    unlocks: "四张具体问题卡",
  },
  "eleme-asset-frgu-labels": {
    ability: "用四种贴纸分开：有来源的事、课堂模拟、我们的猜测、还不知道。",
    risk: "贴错标签会让团队把猜测当真。",
    unlocks: "一张四色证据检查单",
  },
  "eleme-asset-observation-sheet": {
    ability: "照顺序记录一次订餐，不漏掉找菜单、确认、打电话、等待和改动。",
    risk: "只写“很麻烦”没有用，要写动作和结果。",
    unlocks: "订餐动作路径",
  },
  "eleme-asset-ai-review-prompt": {
    ability: "让 AI 只检查问题有没有写具体、哪句没证据、下一步还要查什么。",
    risk: "AI 一旦推荐产品或编数字，这次审查作废。",
    unlocks: "争议卡复核",
  },
  "eleme-asset-student-interview": {
    ability: "请一名真实同学讲最近一次订餐，在具体动作上追问。",
    risk: "问“要不要外卖 App”是在塞答案。",
    unlocks: "学生一手记录",
  },
  "eleme-asset-restaurant-interview": {
    ability: "问一家餐厅怎样接电话、记地址、备餐，留下一次真实例子。",
    risk: "一家餐厅不能代表所有商家。",
    unlocks: "餐厅一手记录",
  },
  "eleme-asset-phone-log": {
    ability: "把每通电话的时间、地址、状态和改动写在同一本流水簿。",
    risk: "四个人写法不同，记录仍会打架。",
    unlocks: "可复查订单记录",
  },
  "eleme-asset-route-board": {
    ability: "把几个地址和送达时间放在一张白板上，现场找冲突。",
    risk: "路线更快不代表学生和餐厅的问题都解决。",
    unlocks: "一次配送模拟",
  },
  "eleme-asset-falsification-card": {
    ability: "写下看到什么结果就停止当前判断，不给自己找借口。",
    risk: "“情况不好再看”不算停止条件。",
    unlocks: "可推翻的验证计划",
  },
  "eleme-asset-history-envelope": {
    ability: "先锁定我们的判断，再打开有来源的历史行动做对照。",
    risk: "提前打开会把后来答案冒充成当时判断。",
    unlocks: "我们的选择 vs 历史",
  },
};

export const STUDENT_DEMO_DAY_COPY = {
  durationSeconds: 360 as const,
  segments: [
    { id: "demo-hook", startSecond: 0, endSecond: 30, title: "谁遇到什么麻烦", requirement: "用一句话说：哪个人、在什么场景、卡在哪里。" },
    { id: "demo-problem", startSecond: 30, endSecond: 75, title: "我们看到了什么", requirement: "展示一次真实任务、一处困难、一项限制和一个还不知道的问题。" },
    { id: "demo-evidence", startSecond: 75, endSecond: 130, title: "哪张线索支持", requirement: "拿出至少两张有来源线索和一个反例；说清哪些仍只是看法或猜测。" },
    { id: "demo-solution", startSecond: 130, endSecond: 190, title: "我们怎样解决", requirement: "现场说明输入什么、做哪几步、得到什么，以及什么情况不适用。" },
    { id: "demo-mvp", startSecond: 190, endSecond: 255, title: "让别人现场试", requirement: "演示最小作品和一次用户测试；指出一个成功结果和一个失败条件。" },
    { id: "demo-iteration", startSecond: 255, endSecond: 315, title: "第一次没成，第二次改了什么", requirement: "展示第一版问题、让你们改变想法的线索，以及第二版看得见的变化。" },
    { id: "demo-next", startSecond: 315, endSecond: 360, title: "未来两天做什么", requirement: "说出下一件小任务、负责人、完成时间和出现什么就停止或换办法。" },
  ],
  rubric: [
    "能指着卡片、记录或作品说出从哪里知道。",
    "能说清为什么这样做，不只喊口号。",
    "作品能现场使用，并写明范围和失败情况。",
    "四个人都能说出自己交了什么、怎样帮助队友。",
    "能指出第一版哪里没成功，第二版具体改了什么。",
    "能分清“我们的选择”和“历史上有来源的事实”。",
  ],
};

const ELEME_STUDENT_DEMO_DAY_COPY = {
  durationSeconds: 360 as const,
  segments: [
    { id: "eleme-demo-scene", startSecond: 0, endSecond: 35, title: "1 · 找真问题", requirement: "用人物、地点、任务、卡点和影响说清宿舍订餐问题，并标出 F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道。" },
    { id: "eleme-demo-choice", startSecond: 35, endSecond: 85, title: "2 · 定真方案", requirement: "展示三条玩家路线，说出主路、备用路、取舍理由和这轮不做什么。" },
    { id: "eleme-demo-product", startSecond: 85, endSecond: 145, title: "3 · 做真产品", requirement: "让一名队员现场操作 V1，指出 V0 的一次失败和因此发生的一处修改。" },
    { id: "eleme-demo-market", startSecond: 145, endSecond: 200, title: "4 · 进真市场", requirement: "说清第一小群人、十秒承诺和渠道结果，分开触达、尝试、完成和再用。" },
    { id: "eleme-demo-operation", startSecond: 200, endSecond: 260, title: "5 · 跑真运营", requirement: "展示七步流程、一张订单的状态和收支，再复盘一次失败怎样被补救。" },
    { id: "eleme-demo-history", startSecond: 260, endSecond: 315, title: "我们的世界线 vs 有来源的历史", requirement: "只用来源支持历史行动，主动说出哪些方案、产品、市场和账本是玩家平行世界。" },
    { id: "eleme-demo-next", startSecond: 315, endSecond: 360, title: "四人贡献与下一轮", requirement: "四人各说一项有证据的贡献，再说下一件事的负责人、时限、产物和停止条件。" },
  ],
  rubric: [
    "能用一条不带产品名的句子说清真问题。",
    "能说清主路线为什么胜出，以及失败后怎样切换。",
    "能现场让作品从输入走到结果，并展示一次失败促成的改版。",
    "能用真实数据，或明确标为“R 课堂模拟”的数据，说清第一小群人和渠道结果。",
    "能对上订单状态、团队收支和个人垫付，不把钱包余额叫利润。",
    "能把玩家平行世界与有来源的历史分开，并说出四人各自的证据贡献。",
  ],
};

export function getStudentDemoDayCopy(campaignId: string) {
  if (campaignId === "google-1995-2004") return STUDENT_DEMO_DAY_COPY;
  if (campaignId === "eleme-2008-find-problem") return ELEME_STUDENT_DEMO_DAY_COPY;
  throw new Error(`Unknown student Demo Day campaign id: ${campaignId}`);
}

export function getStudentChapterCopy(id: string): StudentChapterCopy {
  const chapter = (STUDENT_CHAPTER_COPY as Record<string, StudentChapterCopy>)[id];
  if (!chapter) throw new Error(`Unknown student chapter id: ${id}`);
  return chapter;
}

export function toStudentInfoCard<T extends { id: string; title: string; body: string; sharePrompt: string }>(card: T): T {
  const copy = (STUDENT_CARD_COPY as Record<string, { body: string; sharePrompt: string }>)[card.id];
  return {
    ...card,
    title: learnerCardTitle(card.title),
    body: copy?.body ?? card.body,
    sharePrompt: copy?.sharePrompt ?? card.sharePrompt,
  };
}

export function toStudentAsset<T extends { id: string; ability: string; risk: string; unlocks: string }>(asset: T): T {
  const copy = STUDENT_ASSET_COPY[asset.id];
  return copy ? { ...asset, ...copy } : asset;
}

export function toStudentHistoryReveal<T extends { happened: string; comparisonPrompts: string[]; sourceIds: string[] }>(chapterId: string, history: T): T {
  const copy = STUDENT_HISTORY_COPY[chapterId];
  return copy ? { ...history, ...copy } : history;
}

export function assertStudentCopyComplete(chapterIds: readonly string[], cardIds: readonly string[]): void {
  assertExactKeys("chapter", chapterIds, Object.keys(STUDENT_CHAPTER_COPY));
  assertExactKeys("history", chapterIds, Object.keys(STUDENT_HISTORY_COPY));
  assertExactKeys("card", cardIds, Object.keys(STUDENT_CARD_COPY));

  const bodies = new Set<string>();
  const prompts = new Set<string>();
  const cardCopy = STUDENT_CARD_COPY as Record<string, { body: string; sharePrompt: string }>;
  for (const cardId of cardIds) {
    const copy = cardCopy[cardId];
    if (!copy) throw new Error(`Missing student card copy for card id: ${cardId}`);
    if (bodies.has(copy.body)) throw new Error(`Duplicate student card body found: ${cardId}`);
    if (prompts.has(copy.sharePrompt)) throw new Error(`Duplicate student share prompt found: ${cardId}`);
    bodies.add(copy.body);
    prompts.add(copy.sharePrompt);
  }
}

export function assertStudentAssetCopyComplete(assetIds: readonly string[]): void {
  assertExactKeys("asset", assetIds, Object.keys(STUDENT_ASSET_COPY));
}

function assertExactKeys(label: string, expected: readonly string[], actual: readonly string[]): void {
  if (new Set(expected).size !== expected.length) throw new Error(`Duplicate ${label} ids found in input.`);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((id) => !actualSet.has(id));
  const extra = actual.filter((id) => !expectedSet.has(id));
  if (missing.length || extra.length) {
    throw new Error(`${label} copy mismatch; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
  }
}
