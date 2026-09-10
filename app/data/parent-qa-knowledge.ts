export type ParentQaKnowledgeEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: readonly string[];
  source: {
    label: string;
    path: string;
    section: string;
    publicUrl?: string;
  };
};

export const parentQaKnowledge = [
  {
    id: "course-positioning",
    category: "课程定位",
    title: "这不是历史背诵课，而是史实驱动的创业学习 RPG",
    content:
      "Mini Silicon Valley 把全球科技创新史组织成有边界的开放世界。学员会在当时的信息、资源和时间约束中调查、协商、决策和制作，然后对照可追溯史实进行复盘。课程不要求孩子复制“历史正确答案”，核心是练习可迁移的证据意识、判断、协作和行动。",
    keywords: ["这是什么课", "课程定位", "科技史", "创业课", "RPG", "游戏化", "背历史", "学什么"],
    source: {
      label: "游戏化课程开发决策记录 v3.1",
      path: "docs/GAMEIFIED_COURSE_BUILD_V3.md",
      section: "目标与总纲",
      publicUrl: "/framework/",
    },
  },
  {
    id: "dual-learning-tracks",
    category: "课程定位",
    title: "双轨学习：历史认知与现实项目",
    content:
      "课程有两条互相配合的学习轨道：历史认知轨追踪真实人物、事件、产品与约束；现实创业轨把历史中看到的问题结构迁移到学员自己的 0→1 项目。历史关卡中的反事实分支会明确标记，不会伪装成真实历史。",
    keywords: ["双轨", "历史认知", "现实项目", "0到1", "反事实", "平行世界", "真实创业"],
    source: {
      label: "课程大纲与内容归集指南",
      path: "docs/CURRICULUM_OUTLINE.md",
      section: "两条互相正交的学习轴",
      publicUrl: "/framework/",
    },
  },
  {
    id: "age-and-audience",
    category: "适龄与班型",
    title: "适合初高中到高校阶段",
    content:
      "当前课程设计文档标注的年龄层为初高中到高校，也可用于创业训练营和 AI 创业营。具体班级会如何按年龄、经验或能力分组，应以当期招生说明为准。",
    keywords: ["适合多大", "适龄", "年龄", "几岁", "初中", "高中", "大学", "高校", "孩子"],
    source: {
      label: "游戏设计说明",
      path: "docs/GAME_DESIGN.md",
      section: "实施边界",
      publicUrl: "/framework/",
    },
  },
  {
    id: "class-size-and-format",
    category: "适龄与班型",
    title: "默认 4 位导师协作 4 名学员，课程可声明 2—6 人",
    content:
      "默认完整班型由 4 位导师和 4 名学员组成；具体 CourseDefinition 可以在 2—6 名学员范围内声明最小、默认和最大人数。P／D／M／O 分别是产品、开发、市场、运营导师专业线，学员统一是 Young Builder，不被固定成 P／D／M／O。Admin DM 是可单独委派、也可与导师重合的课堂权限，不是第五位导师；当期由谁担任以课堂配置为准。课堂可结合 WebApp、实体卡牌、地图和毛线建网；每名学员拿到不同线索，必须互讲和协作完成拼图。",
    keywords: ["多少人", "几个人", "小班", "班型", "DM", "导师", "四人", "线上", "线下", "WebApp", "卡牌"],
    source: {
      label: "Mini Silicon Valley DM／导师操作手册",
      path: "docs/DM_MENTOR_MANUAL.md",
      section: "使用边界与课堂组件",
    },
  },
  {
    id: "duration-and-program",
    category: "时长与流程",
    title: "标准课程为 5 次任务课 + 1 次 Demo Day",
    content:
      "标准课程结构是 5 次任务课加 1 次 Demo Day。单次完整课堂的标准流程为 90 分钟，还有 15 分钟的快速演示版。Demo Day 中每队的终局展示严格为 6 分钟。当期开课日期、每周频次和总周期属于运营信息，需另行确认。",
    keywords: ["几节课", "多久", "时长", "课时", "90分钟", "15分钟", "五次", "Demo Day", "六分钟", "总周期"],
    source: {
      label: "Mini Silicon Valley DM／导师操作手册",
      path: "docs/DM_MENTOR_MANUAL.md",
      section: "一场战役与一节课的关系",
    },
  },
  {
    id: "five-steps",
    category: "课程内容",
    title: "五个步骤构成完整的 0→1 实践链",
    content:
      "五个步骤依次是：找真问题、定真方案、做真产品、进真市场、跑真运营。每一步都有核心问题、学习目标、学员行动、可保存交付物和完成门槛；市场负责让第一批用户到来，运营负责稳定交付、账本、反馈与留存。Demo Day 是五步之后的六分钟终局，不是第六步。",
    keywords: ["五步骤", "课程内容", "找真问题", "定真方案", "做真产品", "进真市场", "跑真运营", "Demo Day", "学什么"],
    source: {
      label: "课程大纲与内容归集指南",
      path: "docs/CURRICULUM_OUTLINE.md",
      section: "五步创业闭环与六分钟终局",
      publicUrl: "/framework/",
    },
  },
  {
    id: "pdmo-roles",
    category: "团队协作",
    title: "PDMO 是四类导师分工，不是孩子的角色标签",
    content:
      "PDMO 只表示四类导师专业分工：P 产品导师守住用户、问题与价值，D 开发导师帮助实现和验证，M 市场导师帮助触达与交换，O 运营导师帮助交付、账本、质量与节奏。四名孩子全部是 Young Builder，会一起抽卡、互讲、决策并完整经历五步；系统不会让孩子认领 P／D／M／O。",
    keywords: ["PDMO", "四导师", "产品导师", "开发导师", "市场导师", "运营导师", "分工", "协作", "贴标签"],
    source: {
      label: "游戏化课程开发决策记录 v3.1",
      path: "docs/GAMEIFIED_COURSE_BUILD_V3.md",
      section: "一世界、两轨线、三引擎、四导师、五步骤、六分钟",
      publicUrl: "/framework/",
    },
  },
  {
    id: "ninety-minute-loop",
    category: "时长与流程",
    title: "90 分钟课堂从信息调查走到现实迁移",
    content:
      "三层学习引擎分别是探索、决策、建造：探索通过毛线信息网络连接私密线索与证据，决策通过美式攻坚推动压力下取舍，建造通过德式经营衡量资源投入、交付与反馈。标准课堂依次经历：进入情境与领取身份、随机抽取私密信息、毛线式互讲与证据连线、在导师带领下进行情境攻坚、共同完成两轮试做、用德式资源机制衡量投入与收益、先锁定玩家世界线再揭示史实，最后复盘并迁移到现实任务。四位导师按 P／D／M／O 专业线配合，学员始终是共同完成任务的 Young Builder。",
    keywords: ["怎么上课", "一节课", "课堂流程", "90分钟", "情报", "毛线", "攻坚", "复盘", "史实揭示"],
    source: {
      label: "Mini Silicon Valley DM／导师操作手册",
      path: "docs/DM_MENTOR_MANUAL.md",
      section: "90 分钟标准课堂流程",
    },
  },
  {
    id: "learning-outcomes",
    category: "学习成果",
    title: "每个阶段都留下可检查的学习证据",
    content:
      "学员会逐步留下问题信号清单、真实场景记录、访谈纪要、证据矩阵、目标用户画像、方案对比卡、价值主张、用户旅程、可运行原型、测试记录、发布页、渠道实验、用户反馈、品牌承诺和下一步计划。课程强调真实用户、可被反证的判断和完成一次端到端核心任务。",
    keywords: ["学到什么", "学习成果", "交付物", "作品", "能力", "原型", "用户访谈", "证据", "收获"],
    source: {
      label: "课程大纲与内容归集指南",
      path: "docs/CURRICULUM_OUTLINE.md",
      section: "五步骤与独立终局",
      publicUrl: "/framework/",
    },
  },
  {
    id: "assessment",
    category: "学习成果",
    title: "评价看证据与迭代，不看是否复制历史答案",
    content:
      "课程评价的参考权重是：证据质量 30%，决策逻辑 20%，MVP 与执行 20%，测试和迭代 20%，协作与表达 10%。历史相似度明确不计分；骰子只用来添加情境压力，不决定学员能力或成绩，也不因骰子结果扣个人声望。",
    keywords: ["怎么评价", "评分", "成绩", "评估", "证据质量", "历史答案", "骰子", "失败", "胜负"],
    source: {
      label: "游戏化课程开发决策记录 v3.1",
      path: "docs/GAMEIFIED_COURSE_BUILD_V3.md",
      section: "评分与结算",
      publicUrl: "/framework/",
    },
  },
  {
    id: "demo-day",
    category: "学习成果",
    title: "Demo Day 展示真实产品与完整证据链",
    content:
      "Demo Day 不是背诵考试或只讲 PPT。每队用 6 分钟呈现真问题、证据、方案、MVP、测试结果、失败与迭代、下一步及资源请求。完成门槛包括演示可使用产品、解释关键取舍与用户反馈，并说清项目继续、转向或停止的判断标准。",
    keywords: ["Demo Day", "路演", "展示", "终局", "六分钟", "PPT", "最终作品", "产品演示"],
    source: {
      label: "课程大纲与内容归集指南",
      path: "docs/CURRICULUM_OUTLINE.md",
      section: "Demo Day",
      publicUrl: "/framework/",
    },
  },
  {
    id: "ai-boundary",
    category: "AI 使用",
    title: "AI 是受监督的创作工具，不是不可质疑的裁判者",
    content:
      "当前安全与合规规则明确要求：AI 输出必须经团队复核后才能用于对外公开。课程的证据、取舍和作品责任仍然由学员团队承担；现行公开规则没有把 AI 裁决设为课程的核心机制。",
    keywords: ["AI", "人工智能", "DeepSeek", "代写", "裁判", "复核", "对外公开", "安全使用"],
    source: {
      label: "导师现场指南",
      path: "docs/FACILITATOR_GUIDE.md",
      section: "安全与合规",
    },
  },
  {
    id: "course-ai-models",
    category: "AI 使用",
    title: "课程使用多种国产大模型",
    content:
      "课程使用的国产大模型包括 GLM、DeepSeek、Xiaomi Mimo、Qwen、Kimi 和 Minimax。当前确认信息只覆盖模型名称；具体版本、任务中的选用方式和当期安排由 DM／导师说明。",
    keywords: [
      "使用什么模型",
      "哪些模型",
      "国产模型",
      "大模型",
      "GLM",
      "DeepSeek",
      "Xiaomi Mimo",
      "MiMo",
      "小米模型",
      "Qwen",
      "通义千问",
      "Kimi",
      "Minimax",
    ],
    source: {
      label: "家长问答人工确认事实",
      path: "docs/PARENT_QA_CURATED_FACTS.md",
      section: "课程使用的国产大模型",
    },
  },
  {
    id: "parent-qa-runtime-model",
    category: "AI 使用",
    title: "家长问答助手与课程使用模型需要区分",
    content:
      "本站家长问答助手当前由 DeepSeek 生成回答；这不等同于课程教学中只使用 DeepSeek。课程使用的国产大模型清单应以“课程使用多种国产大模型”资料为准。",
    keywords: ["你是什么模型", "问答模型", "家长问答模型", "QA模型", "谁生成回答", "DeepSeek生成"],
    source: {
      label: "Mini Silicon Valley 家长问答知识库",
      path: "docs/PARENT_QA.md",
      section: "产品入口",
    },
  },
  {
    id: "minor-privacy",
    category: "隐私与安全",
    title: "对未成年人采用最少必要信息原则",
    content:
      "课程规则要求不采集不必要的个人信息；未成年学员使用昵称或课堂代号，不在游戏档案和复盘中写入不必要的真实身份。录播或访谈需要提前授权，未成年人不承担付款或合同义务。学员默认只能看到自己的私密卡，主动发布后才成为团队信息。",
    keywords: ["隐私", "未成年人", "真实姓名", "昵称", "个人信息", "录像", "采集信息", "私密卡", "安全"],
    source: {
      label: "Mini Silicon Valley DM／导师操作手册",
      path: "docs/DM_MENTOR_MANUAL.md",
      section: "教学边界与在线权限隐私",
    },
  },
  {
    id: "account-security",
    category: "隐私与安全",
    title: "账号、会话和课堂权限分层保护",
    content:
      "WebApp 使用独立账号与不透明安全会话，DM 与 learner 权限分离，保护接口会在服务端再次检查角色和成员资格。会话 Cookie 使用 HttpOnly、Secure 和 SameSite 保护；密码以每账号独立 salt 的 PBKDF2 摘要保存。密码重置链接由 DM 按权限生成，30 分钟有效且只能使用一次。",
    keywords: ["账号安全", "密码", "登录", "会话", "Cookie", "重置密码", "权限", "越权", "安全"],
    source: {
      label: "账户、登录与恢复设计",
      path: "docs/AUTHENTICATION.md",
      section: "密码登录、会话与安全属性",
    },
  },
  {
    id: "history-provenance",
    category: "内容可信度",
    title: "历史事实、教学类比与玩家分支明确分开",
    content:
      "课程要求历史人物、时间、产品和真实结果可追溯，史实数据为只读。课程重新组织史实时会标明“直接案例”或“课程映射”，而角色观点、虚构 NPC 和反事实结果也必须显式标记。玩家做出决策前不会提前公布真实历史结局。",
    keywords: ["史实", "真实历史", "可靠", "来源", "核验", "虚构", "课程映射", "成功学", "历史准确"],
    source: {
      label: "Mini Silicon Valley DM／导师操作手册",
      path: "docs/DM_MENTOR_MANUAL.md",
      section: "历史边界",
      publicUrl: "/msv/demo.html",
    },
  },
  {
    id: "learning-safety",
    category: "教学边界",
    title: "不淘汰学员，不用人格羞辱或单一财务指标驱动学习",
    content:
      "课程明确不设置卧底、玩家淘汰或人格羞辱，不让最会说话的人包办全部决策，也不把融资额、规模或历史相似度当成唯一胜利标准。失败不会中止剧情，而是产生可复盘的后果和下一轮调整机会。",
    keywords: ["压力", "淘汰", "羞辱", "失败", "挫折", "胜利", "竞争", "抢话", "教学安全"],
    source: {
      label: "Mini Silicon Valley DM／导师操作手册",
      path: "docs/DM_MENTOR_MANUAL.md",
      section: "教学边界",
    },
  },
  {
    id: "google-campaign",
    category: "课程内容",
    title: "当前完整样例是 Google 1995—2004 战役",
    content:
      "当前 WebApp 提供 Google 1995—2004 与饿了么 2008 起步两个完整案例。两门课都按找真问题、定真方案、做真产品、进真市场、跑真运营五章运行，最后以 6 分钟 Demo Day 收束；课堂会明确区分有来源史实、课堂模拟、团队推测与当前未知。",
    keywords: ["Google", "谷歌", "案例", "战役", "1995", "2004", "学哪家公司", "课程案例"],
    source: {
      label: "Mini Silicon Valley v2 项目说明",
      path: "README.md",
      section: "v2 课堂能力",
      publicUrl: "/msv/demo.html",
    },
  },
  {
    id: "enrollment-boundary",
    category: "招生信息",
    title: "价格、排期、地点与名额需要人工确认",
    content:
      "当前已发布的课程知识资料没有给出有效的价格、付款或退费规则、当期开课日期、每周频次、线下地点、报名截止日期或剩余名额。问答助手不会猜测这些会变动的运营信息；请向课程团队确认当期安排。",
    keywords: ["多少钱", "价格", "费用", "学费", "付款", "退费", "排期", "开课", "日期", "地点", "地址", "报名", "名额"],
    source: {
      label: "当前知识库范围说明",
      path: "docs/PARENT_QA.md",
      section: "不可推断的运营信息",
    },
  },
] as const satisfies readonly ParentQaKnowledgeEntry[];
