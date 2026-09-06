import type { ClassroomCampaign } from "../lib/classroom-model";

export const googleClassroomCampaign = {
  "schemaVersion": 1,
  "id": "google-1995-2004",
  "title": "Google：从 BackRub 到可用的搜索组织",
  "organization": "Google / Stanford",
  "period": "1995–2004",
  "summary": "一场五章协作战役：团队以当时可获得的证据，追踪网页发现、链接信号、搜索原型、基础设施与品牌经营之间的连续取舍。角色卡中的观察、观点、推断和传闻不是历史人物引语；历史揭晓只在团队冻结决定后开放。",
  "sources": [
    {
      "id": "src-google-anatomy",
      "title": "The Anatomy of a Large-Scale Hypertextual Web Search Engine",
      "organization": "Google Research",
      "url": "https://research.google/pubs/the-anatomy-of-a-large-scale-hypertextual-web-search-engine/",
      "kind": "research-paper",
      "accessed": "2026-08-28"
    },
    {
      "id": "src-stanford-backrub",
      "title": "The Stanford Web Search Project: BackRub / Google",
      "organization": "Stanford InfoLab",
      "url": "https://infolab.stanford.edu/~backrub/google.html",
      "kind": "university",
      "accessed": "2026-08-28"
    },
    {
      "id": "src-stanford-history",
      "title": "Stanford University History",
      "organization": "Stanford University",
      "url": "https://www.stanford.edu/about/history",
      "kind": "university",
      "accessed": "2026-08-28"
    },
    {
      "id": "src-stanford-engineering",
      "title": "The future firmly in sight: 1995–2004",
      "organization": "Stanford Engineering",
      "url": "https://engineering100.stanford.edu/stories/the-future-firmly-in-sight",
      "kind": "university",
      "accessed": "2026-08-28"
    },
    {
      "id": "src-google-story",
      "title": "Our story: From the garage to the Googleplex",
      "organization": "Google",
      "url": "https://about.google/company-info/our-story/",
      "kind": "company-history",
      "accessed": "2026-08-28"
    },
    {
      "id": "src-google-ads",
      "title": "Celebrating 25 years of Google Ads",
      "organization": "Google Ads",
      "url": "https://blog.google/products/ads-commerce/google-ads-turns-25/",
      "kind": "official",
      "accessed": "2026-08-28"
    },
    {
      "id": "src-sec-google-2004",
      "title": "Google Inc. Form S-1 Registration Statement, 2004",
      "organization": "U.S. Securities and Exchange Commission",
      "url": "https://www.sec.gov/Archives/edgar/data/1288776/000119312504073639/ds1.htm",
      "kind": "official",
      "accessed": "2026-08-28"
    }
  ],
  "assets": [
    {
      "id": "asset-user-interview",
      "name": "用户访谈时段",
      "type": "research",
      "priceTenths": 20,
      "valueTenths": 10,
      "maintenanceTenths": 0,
      "ability": "每章一次，把一个模糊抱怨追问成用户、任务、损失和可观察信号；不能替团队选择结论。",
      "prerequisiteRp": 0,
      "risk": "访谈样本过窄时会放大单一用户的偏好，必须记录未覆盖的人群。",
      "unlocks": "用户证据节点；后续现实任务的访谈提纲"
    },
    {
      "id": "asset-query-log",
      "name": "查询记录本",
      "type": "research",
      "priceTenths": 30,
      "valueTenths": 15,
      "maintenanceTenths": 0,
      "ability": "保存查询、失败原因和下一次尝试；每轮可将一个争论改写为可复核的观察。",
      "prerequisiteRp": 0,
      "risk": "记录不含上下文时，频次容易被误当成需求强度。",
      "unlocks": "问题验证挑战；失败查询的第二轮复盘"
    },
    {
      "id": "asset-relevance-workbench",
      "name": "相关性工作台",
      "type": "product",
      "priceTenths": 40,
      "valueTenths": 25,
      "maintenanceTenths": 5,
      "ability": "允许团队对一小组结果建立可解释的排序假设并留下反例；不提供标准答案。",
      "prerequisiteRp": 4,
      "risk": "评分标准未经用户确认时，会把团队偏好固化成指标。",
      "unlocks": "排序信号挑战；证据—反例关系"
    },
    {
      "id": "asset-prototype-toolkit",
      "name": "原型工具箱",
      "type": "product",
      "priceTenths": 30,
      "valueTenths": 20,
      "maintenanceTenths": 0,
      "ability": "在MVP挑战中减少一次制作准备，但仍要求真实输入、输出和测试记录。",
      "prerequisiteRp": 0,
      "risk": "原型过于顺滑会掩盖容量、错误处理和用户理解成本。",
      "unlocks": "最小搜索闭环；第二轮可修改原型"
    },
    {
      "id": "asset-campus-beta",
      "name": "校园 Beta 社区",
      "type": "channel",
      "priceTenths": 40,
      "valueTenths": 30,
      "maintenanceTenths": 10,
      "ability": "每章提供一组匿名反馈；团队必须说明样本边界，不能把反馈当作普遍事实。",
      "prerequisiteRp": 2,
      "risk": "校园样本可能无法代表更广泛的网页使用者，且维护需要持续回应。",
      "unlocks": "用户验证与口碑反馈节点"
    },
    {
      "id": "asset-server-rack",
      "name": "额外服务器架",
      "type": "infrastructure",
      "priceTenths": 60,
      "valueTenths": 50,
      "maintenanceTenths": 10,
      "ability": "提高一轮可处理的测试规模；团队仍须声明容量上限、降级方案和停止条件。",
      "prerequisiteRp": 4,
      "risk": "维护不足时触发容量或稳定性压力，购买本身不等于可靠性。",
      "unlocks": "容量验证；索引更新取舍"
    },
    {
      "id": "asset-reliability-watch",
      "name": "运维监控与故障手册",
      "type": "operations",
      "priceTenths": 40,
      "valueTenths": 30,
      "maintenanceTenths": 10,
      "ability": "每章抵消一次可预见的交付压力，但必须先写出指标、报警阈值和人工响应。",
      "prerequisiteRp": 5,
      "risk": "指标过多会拖慢迭代；没有值班责任人时手册不会自动执行。",
      "unlocks": "稳定性事件的预案讨论"
    },
    {
      "id": "asset-partner-network",
      "name": "校园与门户合作网络",
      "type": "market",
      "priceTenths": 60,
      "valueTenths": 50,
      "maintenanceTenths": 20,
      "ability": "提供分发试点和反馈入口；合同条件必须被公开记录并可在下一轮复审。",
      "prerequisiteRp": 5,
      "risk": "合作方可能要求速度、展示或排序条件，造成独立性与信任冲突。",
      "unlocks": "分发渠道挑战；条件合作谈判"
    },
    {
      "id": "asset-trust-review",
      "name": "用户信任评审",
      "type": "brand",
      "priceTenths": 50,
      "valueTenths": 35,
      "maintenanceTenths": 10,
      "ability": "让一名非核心成员审查结果说明、商业标识和失败反馈；不替代用户测试。",
      "prerequisiteRp": 6,
      "risk": "评审若只看文案而不看结果质量，会制造虚假的安心感。",
      "unlocks": "品牌承诺与商业透明度复盘"
    },
    {
      "id": "asset-sponsor-pilot",
      "name": "小额赞助试验",
      "type": "market",
      "priceTenths": 50,
      "valueTenths": 40,
      "maintenanceTenths": 10,
      "ability": "允许团队测试一个收入假设并把商业结果与用户结果分开记账；不能购买答案或RP。",
      "prerequisiteRp": 6,
      "risk": "短期收入会诱使团队牺牲相关性或透明度，须预先写保护线。",
      "unlocks": "广告/用户价值取舍节点；经营复盘"
    }
  ],
  "chapters": [
    {
      "id": "google-1995-find-problem",
      "order": 1,
      "stage": "find-problem",
      "title": "问题不是网页少，而是找到有用信息太贵",
      "timeRange": "1995–1996",
      "location": "Stanford University，Palo Alto；宿舍与实验室之间",
      "briefing": "万维网正在扩张，但团队手里只有零散的目录、链接和校园用户抱怨。不要从建一个搜索引擎开始；先找出哪一类人，在什么任务里，因为网页发现而损失了时间、信任或机会。",
      "learningGoal": "把信息爆炸的宏大叙事拆成可观察的用户场景，区分网页数量、发现成本和结果可信度，并用四个角色的不同证据形成一个可验证的问题陈述。",
      "historicalBoundary": [
        "史实窗口只到1996年：Google官方和Stanford材料记载Larry Page与Sergey Brin在1995年Stanford相识并合作，项目随后被称为BackRub。",
        "本章不提前使用1998年的公开论文、公司成立、广告或上市信息；角色卡中的校园观察、观点、推断和传闻不等于历史事实。"
      ],
      "identities": [
        {
          "id": "g95-p",
          "name": "校园搜索者（用户研究复合角色）",
          "nature": "composite",
          "publicGoal": "找出最值得优先解决的搜索失败场景。",
          "privateConcern": "担心团队把自己的研究习惯误当成所有人的需求，想要看到不同用户的实际损失。",
          "ability": "把抱怨拆成用户、任务、当前替代方案、损失和可观察信号。"
        },
        {
          "id": "g95-d",
          "name": "网页链接工程协作者（技术复合角色）",
          "nature": "composite",
          "publicGoal": "判断网页之间的结构是否能支持更好的发现。",
          "privateConcern": "担心技术线索很迷人却无法在有限设备上持续抓取、存储和更新。",
          "ability": "画出抓取、链接、索引和查询之间的约束，并指出未经验证的技术跳跃。"
        },
        {
          "id": "g95-m",
          "name": "校园传播与目录合作者（市场复合角色）",
          "nature": "composite",
          "publicGoal": "理解用户如何描述找资料的任务，以及现有入口能否触达他们。",
          "privateConcern": "担心团队只服务技术圈；目录或门户伙伴可能带来用户，也可能改变问题定义。",
          "ability": "把校园和门户语言转成可测试的用户任务、分发假设与合作条件。"
        },
        {
          "id": "g95-o",
          "name": "实验室资源协调者（运营复合角色）",
          "nature": "composite",
          "publicGoal": "让问题调查在设备、时间和维护约束内可执行。",
          "privateConcern": "担心每个人都说重要，最后没有明确的规模、预算和停止条件。",
          "ability": "估算设备、时间、维护与样本成本，并把资源限制写成决策边界。"
        }
      ],
      "infoCards": [
        {
          "id": "g95-p-01",
          "holderIdentityId": "g95-p",
          "kind": "observation",
          "title": "重复翻找是用户损失",
          "body": "校园观察（非引语）：同一项资料任务常要在多个页面和目录之间来回尝试；先记录用户花费的时间、放弃点和替代行为，不把它直接归因于网页数量。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "请说明你观察到的具体任务和损失；哪个细节还只是猜测？"
        },
        {
          "id": "g95-p-02",
          "holderIdentityId": "g95-p",
          "kind": "viewpoint",
          "title": "更多结果不等于更快完成任务",
          "body": "角色观点（非史实引语）：用户真正需要的可能是少量可用结果，而不是一张更长的网页清单。要用任务完成时间和复核动作验证这个判断。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "这张观点卡改变了哪个问题表述？你会怎样反驳它？"
        },
        {
          "id": "g95-p-03",
          "holderIdentityId": "g95-p",
          "kind": "inference",
          "title": "失败查询暴露真实问题",
          "body": "角色推断（待验证）：如果用户反复改写同一查询，损失可能来自相关性或表达困难，而不只是入口缺失；需要一组失败查询和用户解释。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "指出推断的前提，并提出一条能在本章内验证或推翻它的观察。"
        },
        {
          "id": "g95-d-01",
          "holderIdentityId": "g95-d",
          "kind": "fact",
          "title": "BackRub从Stanford研究环境起步",
          "body": "史实事实：Stanford材料把Page和Brin的早期合作与BackRub项目联系起来；本章可把它视为研究探索的起点，但不能倒推后来公司的规模或成功。",
          "sourceIds": [
            "src-stanford-engineering",
            "src-stanford-backrub"
          ],
          "credibility": "high",
          "sharePrompt": "这条事实能证明什么，不能证明什么？请把研究项目与用户问题分开。"
        },
        {
          "id": "g95-d-02",
          "holderIdentityId": "g95-d",
          "kind": "fact",
          "title": "链接结构可能成为额外信号",
          "body": "史实事实：后来的原论文描述了利用超文本结构改善搜索结果的研究方向；在1995–1996的角色讨论中，它只能作为待验证技术线索，不能当作已经有效的排名系统。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "把技术线索翻译成一个用户可感知的假设，不要直接跳到实现方案。"
        },
        {
          "id": "g95-d-03",
          "holderIdentityId": "g95-d",
          "kind": "inference",
          "title": "链接也可能被操纵",
          "body": "角色推断（待验证）：若把链接当作重要性信号，发布者可能有动机制造链接；调查应同时寻找质量提升的证据和操纵的反例。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "这是一项风险推断而非历史结论；需要什么反例才会让你改变判断？"
        },
        {
          "id": "g95-m-01",
          "holderIdentityId": "g95-m",
          "kind": "observation",
          "title": "目录解决的是入口，不一定是相关性",
          "body": "校园传播观察（非引语）：人工目录和熟人推荐能给出入口，但覆盖范围、更新速度和用户信任可能各不相同；先问用户在哪一步卡住。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "你看到的是发现成本、内容质量还是信任成本？请为三者分别举一个可观察信号。"
        },
        {
          "id": "g95-m-02",
          "holderIdentityId": "g95-m",
          "kind": "viewpoint",
          "title": "合作入口会带来条件",
          "body": "角色观点（非史实引语）：目录或门户可能愿意导流，却会要求展示位置、速度或内容边界；合作要先写出交换条件，不能只算用户数量。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "哪一项合作条件会改变问题定义？谁有权发现这个变化？"
        },
        {
          "id": "g95-m-03",
          "holderIdentityId": "g95-m",
          "kind": "rumor",
          "title": "校园里已经有人在做更好的目录",
          "body": "传闻（未经核实，不可当作事实）：有人声称现有目录很快会覆盖所有重要网页；请追问来源、范围和时间，不要把传闻当作竞争结论。",
          "sourceIds": [
            "src-stanford-history"
          ],
          "credibility": "low",
          "sharePrompt": "如果这条传闻为真或为假，分别会改变哪一个调查动作？"
        },
        {
          "id": "g95-o-01",
          "holderIdentityId": "g95-o",
          "kind": "observation",
          "title": "调查也消耗资源",
          "body": "运营记录（非引语）：每一次抓取、存储、访谈和人工整理都会消耗设备时间；先列出最小可用样本和停止条件，避免把规模当成价值。",
          "sourceIds": [
            "src-stanford-engineering",
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "哪个成本是一次性的，哪个会持续增长？这会怎样改变问题优先级？"
        },
        {
          "id": "g95-o-02",
          "holderIdentityId": "g95-o",
          "kind": "fact",
          "title": "早期服务器能力是边界",
          "body": "史实事实：Stanford Engineering对早期原型服务器和有限磁盘资源有记录；它支持资源约束的讨论，但不能单独证明某个产品选择一定正确。",
          "sourceIds": [
            "src-stanford-engineering"
          ],
          "credibility": "high",
          "sharePrompt": "请把这条资源事实连到一个用户损失，而不是只连到技术方案。"
        },
        {
          "id": "g95-o-03",
          "holderIdentityId": "g95-o",
          "kind": "inference",
          "title": "小样本更适合首轮学习",
          "body": "角色推断（待验证）：在设备有限时，用窄场景和小样本先验证损失，可能比立即覆盖整个网页更快得到可行动的证据；必须写出何时扩大范围。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "谁能提供反对小样本的理由？扩大范围的触发指标是什么？"
        }
      ],
      "intelGate": {
        "requiredSourceBackedEvidence": 2,
        "requireUserOrPerson": true,
        "requireSceneLoss": true,
        "requireConstraint": true,
        "requireContradictionOrGap": true,
        "requireLeadSupportLink": true
      },
      "challenges": [
        {
          "id": "g95-c1-l1",
          "level": 1,
          "title": "把抱怨写成问题陈述",
          "prompt": "团队必须从至少两条有来源卡片中选出同一类用户与任务，写出用户、触发场景、现有替代方案、可观察损失和一个尚未知道的关键缺口；不要写产品名或解决方案。",
          "requiredArtifact": "一页问题陈述：用户—任务—损失—证据—缺口",
          "recommendedLead": "P",
          "requiredSupport": [
            "D",
            "M",
            "O"
          ],
          "baseIncomeTenths": 20
        },
        {
          "id": "g95-c1-l2",
          "level": 2,
          "title": "在规模与具体损失之间取舍",
          "prompt": "比较网页规模叙事、用户失败场景和设备边界三条线，提出两个互相竞争的问题假设；说明各自的证据、反例、调查动作和停止条件。第二轮必须因新证据修改至少一项。",
          "requiredArtifact": "问题假设对照单：两项假设、证据链、反例、验证动作、停止条件",
          "recommendedLead": "M",
          "requiredSupport": [
            "P",
            "D",
            "O"
          ],
          "baseIncomeTenths": 40
        },
        {
          "id": "g95-c1-l3",
          "level": 3,
          "title": "设计30天问题发现计划",
          "prompt": "在有限设备与时间内，设计一个30天调查：明确目标用户和场景、最小样本、查询/访谈记录、资源投入、成功信号、停止条件及合作风险。第一轮结束后，团队必须根据一个反例重排优先级。",
          "requiredArtifact": "30天发现计划：样本、方法、资源、指标、反例与第二轮改动",
          "recommendedLead": "O",
          "requiredSupport": [
            "P",
            "D",
            "M"
          ],
          "baseIncomeTenths": 70
        }
      ],
      "pressureEvents": [
        {
          "die": 1,
          "title": "校园目录突然更新",
          "effect": "原本依赖目录的场景看起来暂时变好；团队必须说明这是问题消失、延后还是换了损失位置。",
          "mitigation": "保留一组跨目录的失败任务，并比较完成时间与复核次数。"
        },
        {
          "die": 2,
          "title": "抓取样本中断",
          "effect": "技术样本减少，团队不能用缺失数据证明用户没有问题。",
          "mitigation": "缩小问题范围，记录缺失原因，并用访谈或人工样本补一条独立证据。"
        },
        {
          "die": 3,
          "title": "两类用户给出相反反馈",
          "effect": "专业用户和普通用户对最好结果的判断冲突，原问题陈述不能继续使用模糊的用户一词。",
          "mitigation": "分层写出两个用户任务，选择一个首轮目标并记录放弃另一类的代价。"
        },
        {
          "die": 4,
          "title": "门户提出展示交换",
          "effect": "潜在入口要求优先展示合作内容，合作价值与用户价值发生冲突。",
          "mitigation": "写出不可接受条件和可逆的小试验，不把流量承诺当成需求证据。"
        },
        {
          "die": 5,
          "title": "实验室磁盘告急",
          "effect": "原计划的样本规模不可行；团队必须先决定保存什么证据，而不是直接申请更多资源。",
          "mitigation": "定义最小样本、压缩字段和停止阈值，由O记录取舍。"
        },
        {
          "die": 6,
          "title": "导师要求一条可证伪预测",
          "effect": "宏大的信息组织愿景不能作为本轮完成标准，团队必须暴露假设。",
          "mitigation": "将问题改成一个用户能在限定时间内完成或失败的任务，并写反例。"
        }
      ],
      "historyReveal": {
        "happened": "历史材料把1995年Stanford相识、1996年合作和BackRub项目作为Google故事的早期起点；后来的研究方向确实关注利用网页超文本结构改善搜索，但本章玩家当时并不知道后来规模与结果。",
        "comparisonPrompts": [
          "你们的问题陈述是否把用户损失与网页规模分开？",
          "哪些卡片被当成事实，哪些其实只是观察、观点或推断？",
          "若把1998年论文的知识带回1995年，你会改变哪一步；那是否属于后见信息？"
        ],
        "sourceIds": [
          "src-google-story",
          "src-stanford-engineering",
          "src-stanford-backrub",
          "src-google-anatomy"
        ]
      },
      "realityMission": {
        "title": "一小时问题访谈与失败查询日志",
        "deliverable": "选择一个身边的信息发现任务，访谈至少两位不同用户，记录原始任务、替代方案、失败查询、时间/信任损失和一个待验证问题。",
        "timeboxMinutes": 30,
        "acceptance": [
          "两位用户的任务与背景不同，不能只记录抽象评价。",
          "每个损失都绑定一个观察或原话摘要，并标记尚未验证的推断。",
          "提交一个不含产品名的问题陈述和下一次验证动作。"
        ]
      },
      "dm": {
        "opening": "把年份和可知范围写在桌上：你们在1995–1996，不知道后来Google会怎样。每人先讲一张卡，再共同定义一个真实损失。",
        "prompts": [
          "这条卡片描述的是谁的任务？损失发生在哪里？",
          "如果网页数量不再增长，问题还存在吗？如果存在，说明什么？",
          "哪一位角色掌握了你们还没有的约束或反例？",
          "把一个漂亮愿景改成明天可以观察的行为。"
        ],
        "watchFor": [
          "团队把BackRub技术线索当成已证明的用户答案。",
          "团队让门户流量替代用户损失证据。",
          "有人没有发言；要求P、D、M、O各自说明独占信息及其不确定性。"
        ],
        "debrief": [
          "标出问题陈述中仍然是推断的词，并安排下一次验证。",
          "强调历史相似度不是得分；比较的是证据边界与当时取舍。",
          "让每名学员说出一条自己没有的卡片如何改变了判断。"
        ]
      }
    },
    {
      "id": "google-1997-validate-problem",
      "order": 2,
      "stage": "validate-problem",
      "title": "验证：相关性、速度与可信度谁才是核心损失",
      "timeRange": "1997–1998",
      "location": "Stanford，BackRub原型与早期网页测试环境",
      "briefing": "问题已经从网页太多收窄到搜索结果是否有用，但团队仍没有统一的验证标准。你们要在原型证据、用户任务、链接信号、算力边界和潜在分发之间建立可反驳的因果链。",
      "learningGoal": "将问题假设转成可观察指标，区分相关性、速度和可信度；练习把技术信号与用户结果相连，并在证据不足时保留不确定性。",
      "historicalBoundary": [
        "史实窗口为1997–1998：公开论文描述Google原型使用超文本结构，Stanford材料记载BackRub在1998年展示/更名与公司化节点。",
        "24百万页面等论文中的规模描述只能在历史揭晓阶段使用；本章挑战要求团队先依据卡片和当时限制作验证计划，不把结果倒灌成前提。"
      ],
      "identities": [
        {
          "id": "g97-p",
          "name": "搜索任务观察员（用户研究复合角色）",
          "nature": "composite",
          "publicGoal": "证明用户是否因结果相关性或可信度不足而失败。",
          "privateConcern": "担心团队用点击或结果数量这种方便指标掩盖用户是否完成任务。",
          "ability": "设计任务样本、失败分类和用户复述，指出指标与真实损失的断裂。"
        },
        {
          "id": "g97-d",
          "name": "链接分析工程协作者（技术复合角色）",
          "nature": "composite",
          "publicGoal": "验证链接结构能否作为搜索质量的一个信号。",
          "privateConcern": "担心信号在小样本上有效，却在规模增长或被操纵时失效。",
          "ability": "提出最小技术对照、信号反例和抓取/索引成本估算。"
        },
        {
          "id": "g97-m",
          "name": "早期入口观察员（市场复合角色）",
          "nature": "composite",
          "publicGoal": "找到愿意反复使用并传播搜索结果的早期用户场景。",
          "privateConcern": "担心门户合作用流量掩盖低质量结果，或合作条件限制实验。",
          "ability": "把入口、复用、推荐和合作条件拆成可测量的市场假设。"
        },
        {
          "id": "g97-o",
          "name": "原型运行协调者（运营复合角色）",
          "nature": "composite",
          "publicGoal": "让验证在有限抓取频率、存储和响应时间内稳定运行。",
          "privateConcern": "担心团队只报告质量提升，却不记录延迟、失败率和更新成本。",
          "ability": "建立运行基线、容量预算、降级方案与第二轮反馈记录。"
        }
      ],
      "infoCards": [
        {
          "id": "g97-p-01",
          "holderIdentityId": "g97-p",
          "kind": "fact",
          "title": "搜索质量不只由结果数量组成",
          "body": "史实事实：原论文把搜索引擎的挑战同时放在大规模页面、查询响应和更满意结果上；验证时不能只用返回条数作为成功指标。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "请把更满意拆成至少两个可观察行为，并说明它们与损失的关系。"
        },
        {
          "id": "g97-p-02",
          "holderIdentityId": "g97-p",
          "kind": "observation",
          "title": "用户会用替代动作检验结果",
          "body": "用户观察（非引语）：当第一批结果不可信或不相关时，用户会改写查询、翻页、转向目录或询问熟人；这些动作应成为失败分类，而不是简单算作流失。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "哪一种替代动作代表相关性问题，哪一种代表信任问题？证据是什么？"
        },
        {
          "id": "g97-p-03",
          "holderIdentityId": "g97-p",
          "kind": "inference",
          "title": "完成任务比点击更接近价值",
          "body": "角色推断（待验证）：若用户找到可用资料并停止改写查询，任务完成率可能比单次点击更能说明搜索价值；必须用小样本比较两种指标。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "若点击率与任务完成率冲突，你会保留哪项，为什么？"
        },
        {
          "id": "g97-d-01",
          "holderIdentityId": "g97-d",
          "kind": "fact",
          "title": "原论文公开描述超文本信号",
          "body": "史实事实：1998年原论文将网页超文本结构作为改善搜索结果的额外信息来源，并讨论了无控制发布集合带来的挑战。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "这条事实给了什么研究方向？它没有保证什么结果？"
        },
        {
          "id": "g97-d-02",
          "holderIdentityId": "g97-d",
          "kind": "observation",
          "title": "信号质量需要反例",
          "body": "工程观察（非引语）：一个链接多不代表页面一定适合当前查询；验证样本应包含链接很多但不相关，以及链接少但有用的页面。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "请提出一组最小对照，避免把链接数量直接当作相关性。"
        },
        {
          "id": "g97-d-03",
          "holderIdentityId": "g97-d",
          "kind": "viewpoint",
          "title": "操纵风险必须进入验证",
          "body": "角色观点（非史实引语）：只测正常页面会高估链接信号；即使没有证据表明操纵已普遍发生，也应预先写出被操纵时如何发现。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "观点与事实的边界在哪里？哪个测试结果会迫使你降低信号权重？"
        },
        {
          "id": "g97-m-01",
          "holderIdentityId": "g97-m",
          "kind": "observation",
          "title": "早期用户重用才是入口信号",
          "body": "市场观察（非引语）：一次偶然访问不能证明产品价值；更有用的信号是用户在类似任务中再次返回、主动推荐或愿意解释为什么结果有用。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "把重用、推荐和门户流量分成三个指标，哪一个最接近你的问题假设？"
        },
        {
          "id": "g97-m-02",
          "holderIdentityId": "g97-m",
          "kind": "viewpoint",
          "title": "合作速度会扭曲实验",
          "body": "角色观点（非史实引语）：若合作方要求一周上线，团队可能牺牲对照组和失败记录；快并不自动等于有效验证。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "哪一项实验保护线不可因合作而放弃？请由O给出成本。"
        },
        {
          "id": "g97-m-03",
          "holderIdentityId": "g97-m",
          "kind": "rumor",
          "title": "门户会偏好更长的停留",
          "body": "传闻（未经核实，不可当作事实）：有人声称门户只关心用户在页面上停留更久；团队必须找到原始来源，并避免用传闻推断用户价值。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "low",
          "sharePrompt": "你会怎样验证这条传闻？如果无法验证，决策中应如何标记它？"
        },
        {
          "id": "g97-o-01",
          "holderIdentityId": "g97-o",
          "kind": "fact",
          "title": "规模与更新是工程约束",
          "body": "史实事实：原论文把抓取、索引和大规模查询的工程挑战作为核心议题；验证报告必须同时记录质量、延迟、失败和更新成本。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "哪个运行指标会让用户价值假设失效？请给出阈值而不是形容词。"
        },
        {
          "id": "g97-o-02",
          "holderIdentityId": "g97-o",
          "kind": "observation",
          "title": "原型稳定才有可比性",
          "body": "运行观察（非引语）：若第一轮因为服务器中断而少返回结果，第二轮不能把质量下降归咎于信号；先固定运行基线并记录中断。",
          "sourceIds": [
            "src-stanford-engineering",
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "哪些失败应该重跑，哪些失败本身就是产品风险？"
        },
        {
          "id": "g97-o-03",
          "holderIdentityId": "g97-o",
          "kind": "inference",
          "title": "容量边界会改变问题优先级",
          "body": "角色推断（待验证）：如果信号提升只能在极小索引上运行，首轮问题可能必须限定到一个高价值场景；需用容量实验验证。",
          "sourceIds": [
            "src-stanford-engineering",
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "这条推断的最小测试是什么？扩大索引的触发条件是什么？"
        }
      ],
      "intelGate": {
        "requiredSourceBackedEvidence": 2,
        "requireUserOrPerson": true,
        "requireSceneLoss": true,
        "requireConstraint": true,
        "requireContradictionOrGap": true,
        "requireLeadSupportLink": true
      },
      "challenges": [
        {
          "id": "g97-c2-l1",
          "level": 1,
          "title": "把问题假设变成验证指标",
          "prompt": "从用户失败分类、技术信号和运行约束中选择一条假设，写出用户任务、对照、观察指标、失败阈值和下一步；必须指出一张低可信度卡不能单独承担结论。",
          "requiredArtifact": "最小验证卡：任务、对照、指标、阈值、证据等级",
          "recommendedLead": "P",
          "requiredSupport": [
            "D",
            "O"
          ],
          "baseIncomeTenths": 20
        },
        {
          "id": "g97-c2-l2",
          "level": 2,
          "title": "相关性与运行代价的双重验证",
          "prompt": "比较至少两种搜索信号或结果呈现方式，既测用户任务完成，也测延迟、失败率和更新成本；列出链接多但不相关的反例。第二轮必须改动指标、样本或信号权重之一。",
          "requiredArtifact": "双重验证方案：用户对照、技术基线、反例、阈值与第二轮改动",
          "recommendedLead": "D",
          "requiredSupport": [
            "P",
            "O",
            "M"
          ],
          "baseIncomeTenths": 40
        },
        {
          "id": "g97-c2-l3",
          "level": 3,
          "title": "面对门户条件仍保持可证伪",
          "prompt": "门户愿意带来用户，但要求快速上线并偏好停留时长。设计一个可逆的两周试验：保留用户任务完成与结果可信度指标，声明合作边界、资源预算、停止条件和第二轮迭代动作。",
          "requiredArtifact": "两周验证协议：合作条款、实验组/对照组、指标、预算、停止条件、迭代记录",
          "recommendedLead": "M",
          "requiredSupport": [
            "P",
            "D",
            "O"
          ],
          "baseIncomeTenths": 70
        }
      ],
      "pressureEvents": [
        {
          "die": 1,
          "title": "测试者只反馈速度",
          "effect": "团队收到的表面信号变成页面快慢，相关性与可信度证据变薄。",
          "mitigation": "增加一个有明确正确性或可复核性的任务，并追问用户为什么接受结果。"
        },
        {
          "die": 2,
          "title": "链接密集页误导排序",
          "effect": "链接信号在一个反例上失效，团队必须修正假设而不是删除反例。",
          "mitigation": "把反例加入固定测试集，记录信号的适用范围和降权条件。"
        },
        {
          "die": 3,
          "title": "原型响应变慢",
          "effect": "质量对照不再公平；团队须选择缩小样本、优化路径或接受延迟代价。",
          "mitigation": "O先公布基线和阈值，再由D提出一个可回滚的改动。"
        },
        {
          "die": 4,
          "title": "合作方要求移除对照组",
          "effect": "流量变大但实验无法归因；团队必须拒绝或改成有保护线的试点。",
          "mitigation": "保留一小组对照，公开记录合作方要求与放弃对照的代价。"
        },
        {
          "die": 5,
          "title": "查询样本发生歧义",
          "effect": "同一查询被不同用户理解成不同任务，点击和完成数据不能直接合并。",
          "mitigation": "补写任务上下文并分层分析，不把歧义样本强行平均。"
        },
        {
          "die": 6,
          "title": "团队发现指标互相冲突",
          "effect": "速度提升但可信度下降，或完成率提升但运行成本超预算；必须明确保护线。",
          "mitigation": "给每个指标写优先级、容忍区间和触发第二轮的条件。"
        }
      ],
      "historyReveal": {
        "happened": "1998年论文公开了Google原型如何利用超文本结构，并把高规模抓取、索引、查询与无控制内容列为工程与质量挑战；Stanford/Google历史材料同时把1998年视为项目走向Google与公司化的关键节点。",
        "comparisonPrompts": [
          "你们验证的是结果更相关，还是只是点击更多/页面更快？",
          "哪个反例迫使你们把链接信号从答案降级为假设？",
          "若已知道论文的后见结果，哪些指标仍应在1998年由团队自己验证？"
        ],
        "sourceIds": [
          "src-google-anatomy",
          "src-stanford-engineering",
          "src-google-story",
          "src-stanford-backrub"
        ]
      },
      "realityMission": {
        "title": "十条查询的相关性与信任对照",
        "deliverable": "制作一个小型查询集，邀请两位用户分别判断结果是否能完成任务，并记录相关性、速度、可信度与改写查询的原因。",
        "timeboxMinutes": 35,
        "acceptance": [
          "至少十条查询，明确每条查询对应的用户任务而非只有关键词。",
          "至少包含一个链接多但不相关或结果快但不可信的反例。",
          "提交一项第二轮改动，并说明它由哪条证据或缺口触发。"
        ]
      },
      "dm": {
        "opening": "现在不是找一个漂亮的答案，而是让问题经得起反例。请每位角色先讲自己的指标，再让团队找出指标之间的冲突。",
        "prompts": [
          "如果用户点击了结果却没有完成任务，你们会怎样解释？",
          "这条技术卡支持的是相关性、速度还是可信度？不要混在一起。",
          "谁持有反例或运行约束？如果他不发言，实验会怎样偏？",
          "第二轮到底改了什么，为什么这不是事后修饰？"
        ],
        "watchFor": [
          "团队把论文摘要的结论当作自己已经完成的验证。",
          "团队只报好看的平均值，隐藏歧义查询和中断。",
          "合作方压力让M替代P决定用户价值；提醒角色支持关系。"
        ],
        "debrief": [
          "把事实、观察、观点、推断和传闻在证据板上重新标色。",
          "讨论技术信号为什么必须和用户任务、运行边界同时验证。",
          "记录一次因反例而改变的第二轮决定，作为迭代证据。"
        ]
      }
    },
    {
      "id": "google-1998-design-solution",
      "order": 3,
      "stage": "design-solution",
      "title": "设计：把链接关系变成可解释的搜索方案",
      "timeRange": "1998–1999",
      "location": "Stanford与Menlo Park早期办公室之间",
      "briefing": "验证支持一个方向：网页之间的关系可能帮助用户更快找到有用结果，但信号、呈现、入口和资源仍未形成完整方案。团队要设计最小解决方案，明确它如何工作、何时失效以及用户如何理解。",
      "learningGoal": "把分散证据组织成问题—机制—界面—运营的方案链，处理相关性与操纵风险、解释性与速度、分发与独立性之间的张力。",
      "historicalBoundary": [
        "史实窗口为1998–1999：原论文已公开Google原型与超文本结构；Google官方和Stanford材料记载项目改名、公司成立及从宿舍走向早期办公室的节点。",
        "本章不把后来的产品规模、广告机制或上市治理倒灌进1998–1999；玩家方案可反事实，但必须清楚标记为玩家选择。"
      ],
      "identities": [
        {
          "id": "g98-p",
          "name": "结果解释设计者（用户体验复合角色）",
          "nature": "composite",
          "publicGoal": "让用户理解为什么一个结果值得尝试，并能发现错误。",
          "privateConcern": "担心团队只优化内部排序分数，用户却无法判断结果是否可信。",
          "ability": "把结果、证据线索、用户任务和错误反馈组织成可测试的体验。"
        },
        {
          "id": "g98-d",
          "name": "PageRank方案工程师（技术复合角色）",
          "nature": "composite",
          "publicGoal": "设计使用链接关系而不依赖单一计数的排序信号。",
          "privateConcern": "担心方案被过早复杂化，无法解释、更新或在有限计算中运行。",
          "ability": "把信号、权重、反例、计算成本和可回滚版本写成方案假设。"
        },
        {
          "id": "g98-m",
          "name": "分发与伙伴设计者（市场复合角色）",
          "nature": "composite",
          "publicGoal": "设计一个能让早期用户找到并复用产品的入口。",
          "privateConcern": "担心伙伴把排序和展示条件变成隐形税，破坏用户信任。",
          "ability": "拆解入口渠道、合作承诺、激励和独立性保护线。"
        },
        {
          "id": "g98-o",
          "name": "系统边界设计者（运营复合角色）",
          "nature": "composite",
          "publicGoal": "让方案在索引更新、响应时间和故障条件下可运行。",
          "privateConcern": "担心团队把一张漂亮的架构图当成可交付系统，忽略值班和降级。",
          "ability": "设计容量预算、更新策略、指标面板、故障预案和最小范围。"
        }
      ],
      "infoCards": [
        {
          "id": "g98-p-01",
          "holderIdentityId": "g98-p",
          "kind": "observation",
          "title": "用户需要理由，不只是顺序",
          "body": "体验观察（非引语）：当两个结果都看似相关，用户会寻找来源、上下文或可复核线索；方案应让用户知道如何检查，而不是要求盲信排序。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "你想展示哪一种理由？它会增加理解，还是增加页面负担？"
        },
        {
          "id": "g98-p-02",
          "holderIdentityId": "g98-p",
          "kind": "viewpoint",
          "title": "极简入口可能降低学习成本",
          "body": "角色观点（非史实引语）：一个聚焦任务的入口可能比堆叠功能更容易测试；这不是审美结论，要用首次完成任务和错误恢复验证。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "极简为谁服务？缺少什么信息会让用户不敢使用结果？"
        },
        {
          "id": "g98-p-03",
          "holderIdentityId": "g98-p",
          "kind": "inference",
          "title": "错误反馈是排序资产",
          "body": "角色推断（待验证）：如果用户能标记结果不相关或过时，反馈可能帮助团队发现排序盲点；反馈本身也可能带偏，需设计抽样检查。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "一条反馈如何进入第二轮，而不是直接变成真相？"
        },
        {
          "id": "g98-d-01",
          "holderIdentityId": "g98-d",
          "kind": "fact",
          "title": "PageRank由链接关系启发",
          "body": "史实事实：Google官方和Stanford材料把BackRub对网页链接的分析与后来称为PageRank的方向联系起来；这说明研究线索，不保证任何页面在所有查询中都应更靠前。",
          "sourceIds": [
            "src-google-story",
            "src-stanford-engineering",
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "把链接关系写成一个可解释机制，并指出它不覆盖的情况。"
        },
        {
          "id": "g98-d-02",
          "holderIdentityId": "g98-d",
          "kind": "fact",
          "title": "超文本集合不受单方控制",
          "body": "史实事实：原论文明确讨论了任何人都可以发布内容的无控制超文本集合；方案必须考虑质量、操纵、更新和边界，而不是只追求一个分数。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "请给方案加一条针对操纵或过时内容的保护线。"
        },
        {
          "id": "g98-d-03",
          "holderIdentityId": "g98-d",
          "kind": "inference",
          "title": "多信号比单一链接计数稳健",
          "body": "角色推断（待验证）：把链接关系与查询词、锚文本或用户反馈等信号组合，可能比单一链接计数更能处理歧义；要说明组合如何保持可解释和可回滚。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "如果组合信号提升平均分却伤害一个用户群，你会怎样发现？"
        },
        {
          "id": "g98-m-01",
          "holderIdentityId": "g98-m",
          "kind": "observation",
          "title": "入口是方案的一部分",
          "body": "市场观察（非引语）：用户不会因为技术存在就自然来到产品；入口、首次任务、复用和分享都要与核心结果体验连起来。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "哪个入口能带来学习样本而不改变排序？怎样测量？"
        },
        {
          "id": "g98-m-02",
          "holderIdentityId": "g98-m",
          "kind": "viewpoint",
          "title": "伙伴可以是渠道也可以是约束",
          "body": "角色观点（非史实引语）：渠道合作能扩大实验样本，却可能要求优先展示或品牌背书；方案必须将合作条款作为显性约束。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "哪些条款可逆，哪些会永久改变用户对结果的理解？"
        },
        {
          "id": "g98-m-03",
          "holderIdentityId": "g98-m",
          "kind": "rumor",
          "title": "竞争者已经拥有分发优势",
          "body": "传闻（未经核实，不可当作事实）：市场上流传某门户会把自有结果排在前面；在没有原始证据前，只能把它列为调查问题。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "low",
          "sharePrompt": "这条传闻会诱发哪一种过度反应？请提出低成本核查方式。"
        },
        {
          "id": "g98-o-01",
          "holderIdentityId": "g98-o",
          "kind": "fact",
          "title": "方案要面对抓取与索引",
          "body": "史实事实：原论文把高规模抓取、索引和查询视为实用搜索引擎的工程挑战；设计稿必须写更新频率、延迟和失败时的用户行为。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "指出方案中的一个容量假设，以及如果它错了如何降级。"
        },
        {
          "id": "g98-o-02",
          "holderIdentityId": "g98-o",
          "kind": "observation",
          "title": "更新会改变结果稳定性",
          "body": "运营观察（非引语）：网页变化、抓取失败和索引滞后会让同一查询在不同时间出现差异；应同时设计更新指示与用户复核路径。",
          "sourceIds": [
            "src-google-anatomy",
            "src-stanford-engineering"
          ],
          "credibility": "medium",
          "sharePrompt": "用户需要知道哪种变化？哪些变化可以等到下一轮修复？"
        },
        {
          "id": "g98-o-03",
          "holderIdentityId": "g98-o",
          "kind": "inference",
          "title": "先缩小范围能保留可解释性",
          "body": "角色推断（待验证）：先服务一组清楚的查询任务，可能让团队同时观察排序理由、更新成本和错误；扩大范围必须等待明确触发条件。",
          "sourceIds": [
            "src-google-anatomy",
            "src-stanford-engineering"
          ],
          "credibility": "low",
          "sharePrompt": "谁会因范围缩小而失去价值？这项代价值得吗？"
        }
      ],
      "intelGate": {
        "requiredSourceBackedEvidence": 2,
        "requireUserOrPerson": true,
        "requireSceneLoss": true,
        "requireConstraint": true,
        "requireContradictionOrGap": true,
        "requireLeadSupportLink": true
      },
      "challenges": [
        {
          "id": "g98-c3-l1",
          "level": 1,
          "title": "画出可解释的搜索方案",
          "prompt": "用一条用户损失、一条链接关系事实和一项运行约束，画出输入—信号—结果—反馈链；标注一处反例与一处仍需验证的假设。",
          "requiredArtifact": "一页方案图：用户任务、信号、结果、反馈、反例与约束",
          "recommendedLead": "D",
          "requiredSupport": [
            "P",
            "O"
          ],
          "baseIncomeTenths": 20
        },
        {
          "id": "g98-c3-l2",
          "level": 2,
          "title": "排序信号与信任保护线",
          "prompt": "为一个限定查询场景比较两套排序/解释方案，说明链接关系、查询语境、错误反馈和更新成本如何组合；写出操纵、过时和合作展示三种风险。第二轮必须改变一个信号、界面或保护线。",
          "requiredArtifact": "排序方案对照：信号权重、解释方式、反例、风险、第二轮改动",
          "recommendedLead": "P",
          "requiredSupport": [
            "D",
            "M",
            "O"
          ],
          "baseIncomeTenths": 40
        },
        {
          "id": "g98-c3-l3",
          "level": 3,
          "title": "在伙伴入口下保持独立",
          "prompt": "设计一个可在两周内实现的最小搜索入口与合作试点：定义用户任务、结果解释、伙伴可见范围、排序独立性、运行指标和撤回条件。第一轮后必须以一个反例或伙伴要求修订方案。",
          "requiredArtifact": "最小方案包：用户流、排序/解释、合作条款、运行指标、撤回条件与迭代记录",
          "recommendedLead": "M",
          "requiredSupport": [
            "P",
            "D",
            "O"
          ],
          "baseIncomeTenths": 70
        }
      ],
      "pressureEvents": [
        {
          "die": 1,
          "title": "排名理由无法被用户理解",
          "effect": "技术分数提升却没有带来信任；团队必须决定简化解释还是改信号。",
          "mitigation": "让P用一个任务测试用户能否复述结果理由，并保留不理解的反馈。"
        },
        {
          "die": 2,
          "title": "新页面改变链接结构",
          "effect": "测试集排序发生变化，更新成本与稳定性成为公开问题。",
          "mitigation": "给页面加时间戳和更新策略，区分真实质量变化与索引滞后。"
        },
        {
          "die": 3,
          "title": "伙伴要求置顶自有内容",
          "effect": "入口试点与排序独立性直接冲突；团队需选择拒绝、条件合作或隔离展示。",
          "mitigation": "将商业展示与自然结果清楚分层，并写撤回条件。"
        },
        {
          "die": 4,
          "title": "排序被一组页面操纵",
          "effect": "链接信号出现系统性反例，团队不能只调整单个页面。",
          "mitigation": "扩大反例集、记录操纵模式并降低未经验证信号的承诺。"
        },
        {
          "die": 5,
          "title": "用户要求更多过滤选项",
          "effect": "功能请求挤压最小方案边界，团队需判断是否直接影响核心损失。",
          "mitigation": "用一项任务测试需求，暂存不影响核心验证的请求。"
        },
        {
          "die": 6,
          "title": "索引更新预算被削减",
          "effect": "实时性和范围不能同时保持；团队需公开选择并说明用户代价。",
          "mitigation": "限定高价值场景，显示更新时间并设计过时结果的反馈入口。"
        }
      ],
      "historyReveal": {
        "happened": "公开史料将BackRub的链接追踪思路与PageRank方向联系起来；1998年原论文描述利用超文本结构和处理无控制内容，Google官方故事则记录了项目更名、公司成立以及从宿舍到早期办公地点的迁移。",
        "comparisonPrompts": [
          "你们的方案是否把链接信号误写成万能答案？",
          "用户能否理解结果理由，并知道何时不应信任它？",
          "与历史材料对照时，哪些是相似机制，哪些只是你们的反事实设计？"
        ],
        "sourceIds": [
          "src-google-anatomy",
          "src-google-story",
          "src-stanford-engineering",
          "src-stanford-backrub"
        ]
      },
      "realityMission": {
        "title": "可解释排序原型",
        "deliverable": "用12条公开或自制资料做一个纸面/代码原型：为每条查询给出结果顺序、一个可解释理由和一个可能反例，再请用户完成任务。",
        "timeboxMinutes": 40,
        "acceptance": [
          "至少三类查询任务，每类都有成功信号与失败阈值。",
          "每个结果理由都能追溯到输入证据，不能只写相关。",
          "提交一次第二轮改动，并记录一个没有被方案解决的边界。"
        ]
      },
      "dm": {
        "opening": "设计不是把卡片都塞进产品，而是选择少数机制并承认它们会失效。先让D画链路，再由P、M、O逐段施加用户、渠道与运行约束。",
        "prompts": [
          "链接关系在哪个环节改变用户结果？中间缺了什么证据？",
          "用户如何知道排名理由，如何报告错误？",
          "伙伴能获得什么，不能改变什么？撤回条件是什么？",
          "第二轮修订是由哪个反例触发的？"
        ],
        "watchFor": [
          "团队把PageRank名称当作历史答案而非机制假设。",
          "商业入口悄悄改变自然结果，未被标为约束。",
          "设计稿没有更新、过时和操纵的失败路径。"
        ],
        "debrief": [
          "区分历史材料中的技术方向与玩家自行补足的界面/运营选择。",
          "让团队指出一个他们主动放弃的功能，以及放弃理由。",
          "把可解释性、独立性和可运行性作为同一方案的共同责任。"
        ]
      }
    },
    {
      "id": "google-2000-build-mvp",
      "order": 4,
      "stage": "build-mvp",
      "title": "MVP：让最小搜索闭环在真实约束下工作",
      "timeRange": "2000–2002",
      "location": "Mountain View早期办公室与分布式服务器环境",
      "briefing": "方案必须变成一个可测试的最小闭环：输入查询、抓取/索引一组资料、返回结果、让用户完成任务，并记录失败。资源有限，商业试验开始出现，团队要同时保护核心体验和可持续运行。",
      "learningGoal": "练习MVP切片、容量与可靠性预算、最小用户测试和商业试验隔离；把失败当作下一轮的洞察，而不是用收入或规模替代产品证据。",
      "historicalBoundary": [
        "史实窗口为2000–2002：原论文提供早期大规模搜索的工程背景，Google官方广告历史将AdWords/Google Ads的早期商业化节点放在2000年前后；本章只使用来源明确支持的产品与时间。",
        "本章不把后来的广告系统、云基础设施或现代机器学习倒灌进MVP；资产和挑战是课堂模拟工具，不是历史档案。"
      ],
      "identities": [
        {
          "id": "g00-p",
          "name": "MVP用户测试负责人（用户研究复合角色）",
          "nature": "composite",
          "publicGoal": "证明最小闭环能让目标用户完成一个真实任务。",
          "privateConcern": "担心团队为了展示技术而测试熟悉用户，忽略首次使用、失败恢复和不理解。",
          "ability": "定义最小任务、测试脚本、成功信号、用户反馈和第二轮改动。"
        },
        {
          "id": "g00-d",
          "name": "索引与检索构建者（工程复合角色）",
          "nature": "composite",
          "publicGoal": "让抓取、索引、查询和返回在有限样本上连成闭环。",
          "privateConcern": "担心为了扩张页面数牺牲延迟、稳定性或可调试性。",
          "ability": "切分技术范围、估算容量、记录错误并提出可回滚的实现顺序。"
        },
        {
          "id": "g00-m",
          "name": "商业与分发试验者（市场复合角色）",
          "nature": "composite",
          "publicGoal": "验证用户从哪里来、为什么复用，以及收入假设是否不伤害核心结果。",
          "privateConcern": "担心广告或伙伴要求把商业内容混进自然排序，失去用户信任。",
          "ability": "设计分发/收入试验、标记商业内容、区分流量指标与用户价值。"
        },
        {
          "id": "g00-o",
          "name": "容量与发布值班者（运营复合角色）",
          "nature": "composite",
          "publicGoal": "让MVP在可预期负载下可用、可监控、可恢复。",
          "privateConcern": "担心团队只在演示时成功，真实使用一多就无法响应或修复。",
          "ability": "定义SLO式阈值、容量预算、发布回滚、故障响应和维护责任。"
        }
      ],
      "infoCards": [
        {
          "id": "g00-p-01",
          "holderIdentityId": "g00-p",
          "kind": "observation",
          "title": "MVP必须有真实任务",
          "body": "测试观察（非引语）：演示者知道资料在哪里时，界面看起来总会成功；MVP测试要让目标用户从查询开始，并记录完成、改写、放弃和求助。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "请把演示成功改成用户独立完成任务的证据。"
        },
        {
          "id": "g00-p-02",
          "holderIdentityId": "g00-p",
          "kind": "fact",
          "title": "大规模搜索需要用户与系统同时验证",
          "body": "史实事实：原论文把大规模搜索的工程挑战与更满意结果放在同一问题中；MVP不能只证明算法能跑，也不能只收集主观喜欢。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "你们的测试如何同时覆盖任务结果和运行体验？"
        },
        {
          "id": "g00-p-03",
          "holderIdentityId": "g00-p",
          "kind": "inference",
          "title": "失败恢复是首轮范围",
          "body": "角色推断（待验证）：若用户不知道下一步怎么改写查询，系统即使返回结果也未完成最小闭环；需用失败任务验证是否应纳入MVP。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "若资源只够一个反馈功能，你会优先帮助哪种失败？为什么？"
        },
        {
          "id": "g00-d-01",
          "holderIdentityId": "g00-d",
          "kind": "fact",
          "title": "原论文强调抓取、索引与查询的整体工程",
          "body": "史实事实：论文将抓取网页、建立全文与超链接数据库、处理查询和规模扩展作为相互关联的工程问题；课堂MVP可缩小范围，但不能遗漏闭环中的一个环节。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "你们缩小了哪一段，如何证明仍保留用户价值？"
        },
        {
          "id": "g00-d-02",
          "holderIdentityId": "g00-d",
          "kind": "observation",
          "title": "容量预算先于页面数量",
          "body": "工程观察（非引语）：每增加资料，抓取、存储、更新和查询都可能增加成本；先测一个可解释的小集合，再声明扩容条件。",
          "sourceIds": [
            "src-stanford-engineering",
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "请指出一个扩容会破坏的指标，以及你们的降级方案。"
        },
        {
          "id": "g00-d-03",
          "holderIdentityId": "g00-d",
          "kind": "viewpoint",
          "title": "可回滚比一次做全更重要",
          "body": "角色观点（非史实引语）：MVP应允许团队把一个信号、数据源或界面改回上一版本；这样第二轮才能解释改动带来的因果。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "medium",
          "sharePrompt": "哪一项技术决策必须可回滚？谁负责记录版本差异？"
        },
        {
          "id": "g00-m-01",
          "holderIdentityId": "g00-m",
          "kind": "fact",
          "title": "2000年前后出现广告商业化节点",
          "body": "史实事实：Google官方广告历史把Google Ads/AdWords的25年历程追溯到2000年前后；课堂只据此讨论商业试验的时间边界，不把现代广告机制投射到早期。",
          "sourceIds": [
            "src-google-ads"
          ],
          "credibility": "high",
          "sharePrompt": "这条事实支持商业化发生，不支持什么排序细节？请列出未知。"
        },
        {
          "id": "g00-m-02",
          "holderIdentityId": "g00-m",
          "kind": "viewpoint",
          "title": "商业内容必须可识别",
          "body": "角色观点（非史实引语）：即便收入能支撑服务器，用户也需要知道什么是自然结果、什么是商业试验；透明度是产品约束，不是发布后的补丁。",
          "sourceIds": [
            "src-google-ads",
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "团队要展示什么标签或分层？如果不展示，用户会怎样误解？"
        },
        {
          "id": "g00-m-03",
          "holderIdentityId": "g00-m",
          "kind": "rumor",
          "title": "广告收入会自动解决容量",
          "body": "传闻（未经核实，不可当作事实）：有人声称只要展示广告，收入就足以覆盖所有增长；这条传闻不能替代价格、转化、成本和信任测试。",
          "sourceIds": [
            "src-google-ads"
          ],
          "credibility": "low",
          "sharePrompt": "需要哪些数字才能把传闻变成可验证假设？谁持有缺口？"
        },
        {
          "id": "g00-o-01",
          "holderIdentityId": "g00-o",
          "kind": "observation",
          "title": "演示可用不等于持续可用",
          "body": "运行观察（非引语）：演示时的低负载不能代表日常使用；MVP必须记录响应、失败、恢复时间和维护责任。",
          "sourceIds": [
            "src-google-anatomy",
            "src-stanford-engineering"
          ],
          "credibility": "medium",
          "sharePrompt": "你们要监控的最少三个指标是什么？每个指标触发什么动作？"
        },
        {
          "id": "g00-o-02",
          "holderIdentityId": "g00-o",
          "kind": "fact",
          "title": "早期硬件形态反映资源取舍",
          "body": "史实事实：Stanford Engineering记录了早期Google算法服务器由有限磁盘与简陋外壳组成；它可作为资源约束的史料，不应被浪漫化为可靠性证明。",
          "sourceIds": [
            "src-stanford-engineering"
          ],
          "credibility": "high",
          "sharePrompt": "资源简陋怎样影响MVP边界？哪项风险不能靠热情抵消？"
        },
        {
          "id": "g00-o-03",
          "holderIdentityId": "g00-o",
          "kind": "inference",
          "title": "容量限制应进入用户承诺",
          "body": "角色推断（待验证）：若索引更新和响应时间有明确上限，提前向用户说明范围可能比假装覆盖全部网页更能保住信任；需测试用户是否接受。",
          "sourceIds": [
            "src-google-anatomy",
            "src-stanford-engineering"
          ],
          "credibility": "low",
          "sharePrompt": "什么承诺可以缩小而不让核心任务失去价值？"
        }
      ],
      "intelGate": {
        "requiredSourceBackedEvidence": 2,
        "requireUserOrPerson": true,
        "requireSceneLoss": true,
        "requireConstraint": true,
        "requireContradictionOrGap": true,
        "requireLeadSupportLink": true
      },
      "challenges": [
        {
          "id": "g00-c4-l1",
          "level": 1,
          "title": "搭出最小搜索闭环",
          "prompt": "在限定资料集内写出查询输入、抓取/索引、排序、结果解释、用户任务和失败记录；明确哪些环节暂不覆盖，以及第二轮如何根据一次失败改动。",
          "requiredArtifact": "MVP闭环单：输入、索引、输出、用户任务、失败与第二轮变更",
          "recommendedLead": "D",
          "requiredSupport": [
            "P",
            "O"
          ],
          "baseIncomeTenths": 20
        },
        {
          "id": "g00-c4-l2",
          "level": 2,
          "title": "容量、可靠性与任务完成",
          "prompt": "选择一个可交付范围，设计小规模压测与用户任务测试；同时给出容量预算、响应/失败阈值、回滚动作、降级文案和下一轮改变的证据。",
          "requiredArtifact": "MVP验收表：范围、压测、用户测试、阈值、回滚、第二轮改动",
          "recommendedLead": "O",
          "requiredSupport": [
            "D",
            "P"
          ],
          "baseIncomeTenths": 40
        },
        {
          "id": "g00-c4-l3",
          "level": 3,
          "title": "在商业试验下保护核心闭环",
          "prompt": "设计一个小额商业/分发试验，同时运行搜索MVP：自然结果与商业内容必须可识别，写出用户价值指标、收入指标、容量预算、保护线、停止条件和两轮迭代。",
          "requiredArtifact": "双轨MVP包：产品闭环、商业试验、指标隔离、保护线、停止条件与迭代记录",
          "recommendedLead": "M",
          "requiredSupport": [
            "P",
            "D",
            "O"
          ],
          "baseIncomeTenths": 70
        }
      ],
      "pressureEvents": [
        {
          "die": 1,
          "title": "索引更新延迟",
          "effect": "用户看到过时结果；团队要选择显示更新时间、缩小范围或投入更新成本。",
          "mitigation": "增加过时标记与反馈入口，并把更新阈值写入验收。"
        },
        {
          "die": 2,
          "title": "高峰查询拖慢响应",
          "effect": "演示成功但真实负载失败，用户任务完成率与容量预算冲突。",
          "mitigation": "先限制范围/排队，再由O记录负载数据，禁止无证据扩容承诺。"
        },
        {
          "die": 3,
          "title": "商业伙伴要求混排",
          "effect": "收入试验会污染自然结果，用户无法判断排序依据。",
          "mitigation": "分层展示、写明标识与撤回条件；若做不到则暂停试验。"
        },
        {
          "die": 4,
          "title": "用户误解结果理由",
          "effect": "用户把链接信号当作权威背书，错误结果造成信任损失。",
          "mitigation": "让P测试一条解释与一个反例，并降低过度承诺。"
        },
        {
          "die": 5,
          "title": "服务器磁盘出现故障",
          "effect": "部分索引不可用，团队必须决定恢复优先级并公开缺失范围。",
          "mitigation": "使用备份/缩小索引/降级路径，记录恢复时间与用户影响。"
        },
        {
          "die": 6,
          "title": "测试者改写查询后成功",
          "effect": "团队争论这是产品帮助还是用户自行修复，闭环指标需要更精细。",
          "mitigation": "记录改写次数、帮助提示和最终任务结果，第二轮调整成功定义。"
        }
      ],
      "historyReveal": {
        "happened": "历史材料显示，Google的早期搜索研究同时面对链接结构、全文与超链接数据库、抓取/索引规模和用户结果质量；Google官方广告材料把2000年前后视为广告业务早期节点。课堂挑战中的分层、阈值和MVP范围是玩家设计，不是对历史流程的逐项断言。",
        "comparisonPrompts": [
          "你们的MVP是否真的包含输入—索引—输出—任务—失败，而不是只有演示页面？",
          "商业试验改变了什么指标，哪些核心指标必须保持独立？",
          "早期硬件史料如何改变你们的承诺，而不是只变成创业传奇？"
        ],
        "sourceIds": [
          "src-google-anatomy",
          "src-stanford-engineering",
          "src-google-ads",
          "src-google-story"
        ]
      },
      "realityMission": {
        "title": "十页资料的离线搜索MVP",
        "deliverable": "用一组不超过20页的公开资料搭建纸面、表格或代码搜索原型，让两位用户完成三项任务；记录结果、延迟、失败、改写和第二轮改动。",
        "timeboxMinutes": 45,
        "acceptance": [
          "用户能从输入开始独立完成至少一项任务，提交可复核的结果记录。",
          "明确数据范围、排序/解释规则、响应或人工处理时间及失败阈值。",
          "第二轮至少改变范围、排序、反馈、指标或停止条件中的一项，并说明原因。"
        ]
      },
      "dm": {
        "opening": "MVP不是缩小版愿景，而是可被用户和运行数据共同打脸的闭环。先让P写任务，再让D和O承诺范围，最后由M提出不污染核心体验的试验。",
        "prompts": [
          "删掉一个功能后，用户仍能完成什么任务？",
          "容量、延迟和结果质量哪个是保护线，为什么？",
          "商业内容如何被用户识别？如果识别失败，谁能叫停？",
          "第二轮修改是针对哪个真实失败，而不是为了看起来更完整？"
        ],
        "watchFor": [
          "团队将服务器数量等同于产品能力。",
          "团队用收入或流量替代用户任务证据。",
          "有人把失败归因给用户而没有记录改写、求助和恢复。"
        ],
        "debrief": [
          "冻结MVP世界线后，再展示来源支持的历史边界。",
          "让团队列出一个主动不做的功能和一个仍需验证的风险。",
          "强调商业收入、团队资金和用户价值在课堂账本中分开。"
        ]
      }
    },
    {
      "id": "google-2003-operate-brand",
      "order": 5,
      "stage": "operate-brand",
      "title": "运营与品牌：增长不能透支信任",
      "timeRange": "2003–2004",
      "location": "Mountain View；搜索产品、销售与基础设施团队",
      "briefing": "产品已经不再只是一个实验室原型。团队要在增长、可靠性、分发、商业内容和长期品牌承诺之间做经营决策，并把2004年的公开资本市场节点当作治理与透明度压力，而不是一个自动成功的结局。",
      "learningGoal": "把产品价值转成可持续运营与品牌承诺，练习收入与自然结果隔离、可靠性治理、渠道选择、公开风险和下一轮迭代。",
      "historicalBoundary": [
        "史实窗口为2003–2004：Google官方故事记录公司由早期办公室持续扩张；SEC的2004年S-1文件可核验Google在2004年准备首次公开发行。",
        "本章不把后来的全球产品、现代广告平台或公司文化倒灌进2003–2004；品牌观点与经营方案是玩家反事实，不能伪装成历史人物引语。"
      ],
      "identities": [
        {
          "id": "g03-p",
          "name": "长期用户信任负责人（品牌复合角色）",
          "nature": "composite",
          "publicGoal": "让用户在结果质量、商业标识和失败反馈上继续相信产品。",
          "privateConcern": "担心快速增长会让团队只看总量，忽略少数用户遭遇的错误和不透明。",
          "ability": "把品牌承诺写成可观察体验、风险披露和用户反馈闭环。"
        },
        {
          "id": "g03-d",
          "name": "搜索质量与可靠性负责人（工程复合角色）",
          "nature": "composite",
          "publicGoal": "在增长中维持可接受的相关性、延迟、更新与故障恢复。",
          "privateConcern": "担心销售承诺和新入口先于容量与质量准备，技术团队被迫隐瞒风险。",
          "ability": "建立质量/可靠性指标、发布门槛、回滚与技术债清单。"
        },
        {
          "id": "g03-m",
          "name": "渠道与商业运营负责人（市场复合角色）",
          "nature": "composite",
          "publicGoal": "扩大可持续分发并验证商业收入，不牺牲自然结果的可理解性。",
          "privateConcern": "担心伙伴和广告主用付费影响排序，短期收入反过来定义产品价值。",
          "ability": "设计分层商业试验、渠道协议、用户价值指标与退出条件。"
        },
        {
          "id": "g03-o",
          "name": "规模化运营与治理负责人（运营复合角色）",
          "nature": "composite",
          "publicGoal": "建立能承受增长、公开风险、记录责任和持续维护的运营系统。",
          "privateConcern": "担心上市或融资叙事让团队承诺无法验证的增长，造成审计、服务和人员压力。",
          "ability": "做容量/人员/成本预算，写事故响应、风险登记和治理节奏。"
        }
      ],
      "infoCards": [
        {
          "id": "g03-p-01",
          "holderIdentityId": "g03-p",
          "kind": "fact",
          "title": "品牌承诺要能被用户体验",
          "body": "史实事实：Google官方故事将组织信息、可访问性和搜索体验的使命表述放在公司叙事中；本章只能把它作为公开承诺材料，不能把它解释成每个时期都没有冲突。",
          "sourceIds": [
            "src-google-story"
          ],
          "credibility": "high",
          "sharePrompt": "请把一句宏大承诺翻译成一个用户能观察的行为和一个失败信号。"
        },
        {
          "id": "g03-p-02",
          "holderIdentityId": "g03-p",
          "kind": "observation",
          "title": "不透明会放大一次错误",
          "body": "用户观察（非引语）：当用户分不清自然结果、商业内容和索引过时，单次错误会被理解成系统隐瞒；品牌修复要从可识别的证据开始。",
          "sourceIds": [
            "src-google-ads",
            "src-google-story"
          ],
          "credibility": "medium",
          "sharePrompt": "你们要公开什么，才能让用户区分错误、限制和商业内容？"
        },
        {
          "id": "g03-p-03",
          "holderIdentityId": "g03-p",
          "kind": "inference",
          "title": "透明度可能降低短期转化",
          "body": "角色推断（待验证）：更清楚的商业标识和限制说明可能让一部分短期点击下降，却提高长期复用与信任；需要把两者分开测量。",
          "sourceIds": [
            "src-google-ads",
            "src-google-story"
          ],
          "credibility": "low",
          "sharePrompt": "若短期点击下降，哪些证据会让你仍坚持透明度？"
        },
        {
          "id": "g03-d-01",
          "holderIdentityId": "g03-d",
          "kind": "observation",
          "title": "规模会放大边界条件",
          "body": "工程观察（非引语）：用户、页面、查询和更新增长后，小样本中不显眼的延迟、过时和操纵问题会变成系统性风险；运营指标必须随规模重测。",
          "sourceIds": [
            "src-google-anatomy",
            "src-stanford-engineering"
          ],
          "credibility": "medium",
          "sharePrompt": "哪一个早期指标最可能在规模下失效？你会怎样提前监控？"
        },
        {
          "id": "g03-d-02",
          "holderIdentityId": "g03-d",
          "kind": "fact",
          "title": "搜索工程包含无控制内容风险",
          "body": "史实事实：原论文明确讨论了任何人都可发布内容的超文本集合及其质量处理问题；规模化运营不能把不受控内容当成一次性数据清理。",
          "sourceIds": [
            "src-google-anatomy"
          ],
          "credibility": "high",
          "sharePrompt": "写出一个持续发现质量变化的机制，而不是只写人工审核。"
        },
        {
          "id": "g03-d-03",
          "holderIdentityId": "g03-d",
          "kind": "viewpoint",
          "title": "发布门槛高于销售承诺",
          "body": "角色观点（非史实引语）：任何新渠道或商业试验都应先满足质量、容量和回滚门槛；否则增长数据会把不可逆风险藏到下一季。",
          "sourceIds": [
            "src-google-anatomy",
            "src-google-ads"
          ],
          "credibility": "medium",
          "sharePrompt": "哪项承诺必须先经过O的容量检查？如果M不同意怎么办？"
        },
        {
          "id": "g03-m-01",
          "holderIdentityId": "g03-m",
          "kind": "fact",
          "title": "商业服务进入Google发展叙事",
          "body": "史实事实：Google官方广告历史将2000年前后的广告服务作为持续演进的商业线索；来源不自动证明任何具体排序政策，团队必须把广告与自然结果的关系作为本轮设计问题。",
          "sourceIds": [
            "src-google-ads"
          ],
          "credibility": "high",
          "sharePrompt": "商业化事实和产品排序推断之间缺了哪条证据？"
        },
        {
          "id": "g03-m-02",
          "holderIdentityId": "g03-m",
          "kind": "observation",
          "title": "渠道带来反馈也带来依赖",
          "body": "市场观察（非引语）：合作渠道能扩大样本和收入，却让团队暴露在伙伴目标、品牌联名和退出成本之下；经营计划要把依赖写出来。",
          "sourceIds": [
            "src-google-story",
            "src-google-ads"
          ],
          "credibility": "medium",
          "sharePrompt": "哪一项渠道收益值得承担依赖？可逆退出条件是什么？"
        },
        {
          "id": "g03-m-03",
          "holderIdentityId": "g03-m",
          "kind": "rumor",
          "title": "公开发行会带来无限资源",
          "body": "传闻（未经核实，不可当作事实）：市场上有人把2004年公开发行想象成可以解决所有基础设施与人才问题；公开文件只能证明披露/发行程序，不能保证经营结果。",
          "sourceIds": [
            "src-sec-google-2004"
          ],
          "credibility": "low",
          "sharePrompt": "这条传闻隐藏了哪些成本、治理和执行风险？"
        },
        {
          "id": "g03-o-01",
          "holderIdentityId": "g03-o",
          "kind": "fact",
          "title": "2004年进入公开披露语境",
          "body": "史实事实：SEC归档的2004年Google S-1文件显示公司进入首次公开发行的注册披露流程；它提供治理与风险讨论的边界，不等于玩家可以预知后续市场表现。",
          "sourceIds": [
            "src-sec-google-2004"
          ],
          "credibility": "high",
          "sharePrompt": "公开披露会要求团队把哪些风险从口头承诺变成可检查记录？"
        },
        {
          "id": "g03-o-02",
          "holderIdentityId": "g03-o",
          "kind": "observation",
          "title": "维护是增长预算的一部分",
          "body": "运营观察（非引语）：每新增渠道、页面和商业试验都会增加监控、客服、容量和合规工作；经营计划要先扣维护再谈可分配收益。",
          "sourceIds": [
            "src-google-anatomy",
            "src-sec-google-2004"
          ],
          "credibility": "medium",
          "sharePrompt": "你们的增长计划给维护留了多少资源？缺口会在哪里显现？"
        },
        {
          "id": "g03-o-03",
          "holderIdentityId": "g03-o",
          "kind": "inference",
          "title": "治理机制也是产品能力",
          "body": "角色推断（待验证）：当质量、商业和渠道目标冲突时，固定的发布门槛、风险登记和复盘节奏可能比一次性英雄式救火更可持续；团队要设计最小治理循环。",
          "sourceIds": [
            "src-sec-google-2004",
            "src-google-anatomy"
          ],
          "credibility": "low",
          "sharePrompt": "一项治理动作如何改变下一轮产品决定？谁拥有叫停权？"
        }
      ],
      "intelGate": {
        "requiredSourceBackedEvidence": 2,
        "requireUserOrPerson": true,
        "requireSceneLoss": true,
        "requireConstraint": true,
        "requireContradictionOrGap": true,
        "requireLeadSupportLink": true
      },
      "challenges": [
        {
          "id": "g03-c5-l1",
          "level": 1,
          "title": "把品牌承诺变成运营指标",
          "prompt": "从用户信任、自然结果/商业内容、质量或维护卡片中选出一项承诺，写出用户可观察行为、指标、失败阈值、责任人和一项第二轮修正。",
          "requiredArtifact": "品牌—运营单：承诺、用户行为、指标、阈值、责任人、迭代",
          "recommendedLead": "P",
          "requiredSupport": [
            "D",
            "O"
          ],
          "baseIncomeTenths": 20
        },
        {
          "id": "g03-c5-l2",
          "level": 2,
          "title": "增长、收入与自然结果隔离",
          "prompt": "比较一个渠道扩张和一个商业试验，设计可逆运行方案：区分自然结果、商业内容、用户价值和收入指标，给出容量/维护预算、风险登记和第二轮调整。",
          "requiredArtifact": "双轨经营方案：渠道、商业试验、指标隔离、预算、风险、迭代",
          "recommendedLead": "M",
          "requiredSupport": [
            "P",
            "D",
            "O"
          ],
          "baseIncomeTenths": 40
        },
        {
          "id": "g03-c5-l3",
          "level": 3,
          "title": "在公开披露压力下运营品牌",
          "prompt": "以2004年公开披露为边界，提出一季度运营计划：质量与容量门槛、商业透明度、渠道依赖、维护、人力、公开风险和叫停机制。第一轮后必须根据一项压力事件改写优先级或承诺。",
          "requiredArtifact": "季度经营与风险包：承诺、指标、预算、依赖、公开风险、叫停机制与第二轮变更",
          "recommendedLead": "O",
          "requiredSupport": [
            "P",
            "D",
            "M"
          ],
          "baseIncomeTenths": 70
        }
      ],
      "pressureEvents": [
        {
          "die": 1,
          "title": "一次错误结果被公开传播",
          "effect": "品牌承诺受到质疑，团队必须先修复用户影响，再解释技术原因。",
          "mitigation": "公开影响范围与修复时间，保留错误样本并安排质量复盘。"
        },
        {
          "die": 2,
          "title": "广告主要求更高可见度",
          "effect": "收入机会诱使商业内容混入自然结果，透明度和短期转化冲突。",
          "mitigation": "保持清楚标识和独立指标；无法满足则缩小或暂停试验。"
        },
        {
          "die": 3,
          "title": "渠道伙伴临时退出",
          "effect": "流量、收入和反馈同时下降，暴露依赖与恢复能力。",
          "mitigation": "启用第二渠道或直接入口，比较恢复成本并更新依赖登记。"
        },
        {
          "die": 4,
          "title": "高峰期容量告警",
          "effect": "销售承诺与服务能力冲突，必须选择限流、降级或延迟发布。",
          "mitigation": "按预先写好的阈值执行，公开用户影响，不靠临时英雄救火。"
        },
        {
          "die": 5,
          "title": "公开文件要求补充风险",
          "effect": "团队发现口头承诺没有证据，必须把不确定性、成本和依赖写进记录。",
          "mitigation": "由O建立风险登记，P补用户影响，D/M各自提供缓解与停止条件。"
        },
        {
          "die": 6,
          "title": "长期复用下降但短期点击上升",
          "effect": "单一增长指标掩盖信任损失；团队必须决定是否牺牲短期数据保护长期价值。",
          "mitigation": "分离用户任务完成、复用、信任和收入指标，按保护线触发第二轮。"
        }
      ],
      "historyReveal": {
        "happened": "Google官方故事把1998年公司化、早期办公室和持续扩张串成组织叙事；Google官方广告历史提供2000年前后商业化时间线；SEC归档的2004年S-1显示Google进入首次公开发行的注册披露流程。它们能界定公开史实节点，却不能替团队回答如何在每次增长压力下取舍。",
        "comparisonPrompts": [
          "你们的品牌承诺是否有用户可观察的证据和叫停阈值？",
          "商业内容与自然结果是否被清楚区分，维护成本是否被计入？",
          "公开披露节点带来了哪些治理问题，而不是一个自动成功结局？"
        ],
        "sourceIds": [
          "src-google-story",
          "src-google-ads",
          "src-sec-google-2004",
          "src-google-anatomy"
        ]
      },
      "realityMission": {
        "title": "一页透明增长与信任计划",
        "deliverable": "为一个真实项目设计一页运营计划：用户价值、商业试验、渠道、维护、风险、公开说明、指标和叫停条件，并安排一次第二轮复盘。",
        "timeboxMinutes": 40,
        "acceptance": [
          "自然结果/核心体验指标与商业指标分开，且各自有数据来源。",
          "至少列出一个渠道依赖、一个维护成本和一个会触发停止的风险阈值。",
          "提交一次由反馈或压力事件触发的迭代，说明承诺如何变化。"
        ]
      },
      "dm": {
        "opening": "最后一章不问你们能否讲出成功故事，而问增长压力下谁会受损、谁能叫停、证据如何公开。先让O公布边界，再让P、D、M分别挑战它。",
        "prompts": [
          "品牌承诺在用户界面和运营流程中具体是什么？",
          "哪个指标会上升但仍代表产品变差？",
          "公开披露让哪一项未知变成必须管理的风险？",
          "渠道退出或高峰故障时，第二轮改动是什么？"
        ],
        "watchFor": [
          "把2004年公开发行叙述成必然成功或无限资源。",
          "把官方使命文案当作没有矛盾的事实证据。",
          "经营计划只有收入和增长，没有维护、失败、用户影响与叫停机制。"
        ],
        "debrief": [
          "历史相似度不计分；复盘团队如何在证据边界内管理不确定性。",
          "让每位学员指出一次自己承担的主导或支撑责任及其证据。",
          "将玩家世界线与公开历史节点分开展示，再进入六分钟Demo Day。"
        ]
      }
    }
  ],
  "demoDay": {
    "durationSeconds": 360,
    "segments": [
      {
        "id": "demo-hook",
        "startSecond": 0,
        "endSecond": 30,
        "title": "一句话开场",
        "requirement": "说清目标用户、关键场景和不超过一句的问题损失；不先讲公司传奇。"
      },
      {
        "id": "demo-problem",
        "startSecond": 30,
        "endSecond": 75,
        "title": "问题与边界",
        "requirement": "展示一条用户任务、一个场景损失、一个约束和一个仍未解决的缺口。"
      },
      {
        "id": "demo-evidence",
        "startSecond": 75,
        "endSecond": 130,
        "title": "证据与矛盾",
        "requirement": "展示至少两条有来源证据、一条反例或矛盾，并区分事实、观察、观点和推断。"
      },
      {
        "id": "demo-solution",
        "startSecond": 130,
        "endSecond": 190,
        "title": "方案机制",
        "requirement": "说明输入、信号/方法、输出、用户理解方式、资源边界和不适用条件。"
      },
      {
        "id": "demo-mvp",
        "startSecond": 190,
        "endSecond": 255,
        "title": "MVP与测试",
        "requirement": "展示最小闭环、一次用户测试、一个运行指标和一个失败阈值；资产不能替代证据。"
      },
      {
        "id": "demo-iteration",
        "startSecond": 255,
        "endSecond": 315,
        "title": "失败与第二轮",
        "requirement": "明确第一轮哪里失败、哪张卡或哪项压力事件改变了判断，以及第二轮具体改了什么。"
      },
      {
        "id": "demo-next",
        "startSecond": 315,
        "endSecond": 360,
        "title": "下一步与承诺",
        "requirement": "给出下一项现实验证、停止条件、维护责任和不超过一个季度的可检查承诺。"
      }
    ],
    "rubric": [
      "证据：事实来源可追溯，并明确观点、推断、传闻与未知。",
      "逻辑：用户损失、方案机制、指标和风险之间有因果链，而不是并列口号。",
      "执行：MVP范围、资源、维护、阈值和现实下一步可在限定时间内执行。",
      "协作：四个案例身份各贡献独占信息，主导与支撑责任有可见交付。",
      "迭代：第二轮因反例、反馈或压力事件而发生实质改动，不把失败抹掉。",
      "边界：能把玩家世界线与1995–2004公开史实分开，不以历史相似度计分。"
    ]
  }
} satisfies ClassroomCampaign;
