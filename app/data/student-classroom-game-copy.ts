import { elemeClassroomCampaign } from "./eleme-classroom-campaign";
import { expandEvidenceBoundaryShorthand } from "../lib/evidence-boundary";

type StudentIdentityCopy = {
  name: string;
  publicGoal: string;
  privateConcern: string;
  ability: string;
};

type StudentChallengeCopy = {
  title: string;
  prompt: string;
  requiredArtifact: string;
};

type StudentPressureCopy = {
  title: string;
  effect: string;
  mitigation: string;
};

export const STUDENT_IDENTITY_COPY: Record<string, StudentIdentityCopy> = {
  "g95-p": {
    name: "同学找资料观察员",
    publicGoal: "找到一个最值得先解决的找资料麻烦。",
    privateConcern: "你担心团队只凭自己的习惯猜，没有看其他同学实际怎么做。",
    ability: "你可以把一句抱怨改写成：谁、在做什么、卡在哪一步、造成什么麻烦。",
  },
  "g95-d": {
    name: "网页链接试验员",
    publicGoal: "试试看，网页之间的链接能不能帮人更快找到有用资料。",
    privateConcern: "你担心办法听起来很酷，但电脑空间、更新速度和失败情况根本撑不住。",
    ability: "你可以画出“收集网页→记下链接→排序→返回结果”，并圈出最可能失败的一步。",
  },
  "g95-m": {
    name: "找同学来试的人",
    publicGoal: "听懂同学怎样说找资料的麻烦，并找到愿意来试的人。",
    privateConcern: "你担心只找懂技术的人；合作网站虽然能带来用户，也可能改变结果。",
    ability: "你可以把“好不好用”换成一个真实任务，再写清去哪里找试用者和合作前不能答应什么。",
  },
  "g95-o": {
    name: "时间和设备管理员",
    publicGoal: "让这次调查在现有时间和设备里真的做完。",
    privateConcern: "你担心每个人都说自己的事重要，最后没人说清做多少、花多久和什么时候停。",
    ability: "你可以列出设备、人数和时间，然后帮团队定一个最小数量和停止时间。",
  },
  "g97-p": {
    name: "搜索任务记录员",
    publicGoal: "用真实任务看清：同学是没找对、等太久，还是不敢相信结果。",
    privateConcern: "你担心团队只数点击和结果数量，却没看同学最后有没有完成任务。",
    ability: "你可以写一张测试纸：任务、用了多久、改了几次、最后是否完成、为什么相信。",
  },
  "g97-d": {
    name: "链接排序试验员",
    publicGoal: "比较两种排法，看网页链接是否真的能帮人找对资料。",
    privateConcern: "你担心小测试里有用的排法，页面一多或遇到作假链接就失效。",
    ability: "你可以做一组A/B对比，特意放入一个“链接多但没用”的反例，并记下处理时间。",
  },
  "g97-m": {
    name: "早期试用招募员",
    publicGoal: "找到会真正反复使用和愿意介绍给别人的场景。",
    privateConcern: "你担心合作网站带来很多人，却遮住了结果不够好的问题。",
    ability: "你可以分开记录：人从哪里来、有没完成任务、愿不愿意再用，以及合作方要求了什么。",
  },
  "g97-o": {
    name: "原型运行记录员",
    publicGoal: "让测试在现有电脑上稳定跑完，并留下等待和失败记录。",
    privateConcern: "你担心团队只报最好的结果，没记页面多久打开、失败几次和更新多麻烦。",
    ability: "你可以先记一次正常时间，再定“慢到几秒就算失败”，并写一个出错时的备用办法。",
  },
  "g98-p": {
    name: "结果说明设计员",
    publicGoal: "让第一次使用的人看懂为什么某条结果排在前面。",
    privateConcern: "你担心团队只看内部分数，用户却不知道结果能不能信。",
    ability: "你可以给每条结果写一句排序理由，让同学复述，再记下他误解的地方。",
  },
  "g98-d": {
    name: "排序办法试验员",
    publicGoal: "做出一个不只数链接多少的排序办法。",
    privateConcern: "你担心规则越加越多，最后没人能说清、更新或在有限电脑上跑完。",
    ability: "你可以把排序办法写成3步，加一个会失败的例子，并保留一个可以换回旧版的方案。",
  },
  "g98-m": {
    name: "试用入口设计员",
    publicGoal: "让目标同学找到这个小样，用完后愿意再来。",
    privateConcern: "你担心合作方要求把自己的内容放在前面，让用户不再相信排序。",
    ability: "你可以画出人从哪里来、怎样进入、完成什么，并写清合作方不能改动哪些结果。",
  },
  "g98-o": {
    name: "系统运行守门员",
    publicGoal: "让这个方案真的能更新、回答和从错误中恢复。",
    privateConcern: "你担心团队只画一张漂亮图，没人负责页面过时、速度变慢和系统出错。",
    ability: "你可以写清最多处理多少页、多久更新一次、几秒算太慢，以及出错时先做什么。",
  },
  "g00-p": {
    name: "第一次使用测试员",
    publicGoal: "证明一个陌生同学能用最小作品完成一件真任务。",
    privateConcern: "你担心团队只请熟人演示，没看第一次使用的人在哪里看不懂或无法继续。",
    ability: "你可以给陌生同学一张任务卡，只观察不提示，记下他卡住、求助和完成的每一步。",
  },
  "g00-d": {
    name: "搜索小样搭建员",
    publicGoal: "把收集资料、排序、输入和结果真正连起来。",
    privateConcern: "你担心为了显示资料多，作品变慢、容易错，而且不知道哪一步坏了。",
    ability: "你可以先把资料范围缩到能跑完，给每一步留错误记录，并指出可以先删掉的功能。",
  },
  "g00-m": {
    name: "试用与赚钱方式测试员",
    publicGoal: "分开测试人从哪里来、为什么再用，以及怎样赚钱才不会弄乱搜索结果。",
    privateConcern: "你担心广告或合作内容和普通结果混在一起，换来短期收入却丢了信任。",
    ability: "你可以把普通结果和商业内容分开标出，同时记录“任务完成”和“赚到多少”，不混成一个数。",
  },
  "g00-o": {
    name: "发布和值班负责人",
    publicGoal: "让作品在有人真正使用时仍能打开、回答和恢复。",
    privateConcern: "你担心作品只在演示时成功，人一多就变慢，出错后也没人知道谁来处理。",
    ability: "你可以定出最多同时几人、几秒算失败、出错先怎样恢复，并指定记录人。",
  },
  "g03-p": {
    name: "用户信任守门员",
    publicGoal: "让用户看得懂结果、商业内容和出错后怎样处理。",
    privateConcern: "你担心人数增长后，团队只看大数字，忽略少数人遇到的错误和不清楚说明。",
    ability: "你可以把一句品牌口号改成用户能看到的动作、出错后的说明和一个意见入口。",
  },
  "g03-d": {
    name: "搜索质量守门员",
    publicGoal: "用户变多时，仍要守住结果有用、速度和出错恢复。",
    privateConcern: "你担心合作和销售先答应了很多，但电脑和团队还没准备好。",
    ability: "你可以写出发布前必须通过的3项检查，加上变慢或出错时换回旧版的办法。",
  },
  "g03-m": {
    name: "渠道与赚钱方式负责人",
    publicGoal: "找到能长期带来用户和收入的办法，但不破坏普通搜索结果。",
    privateConcern: "你担心合作方或广告主花钱就能影响排序，让短期收入变成唯一目标。",
    ability: "你可以把用户完成任务和商业收入分开记录，给合作写一条不能跨过的红线和退出条件。",
  },
  "g03-o": {
    name: "团队运营总管",
    publicGoal: "把人、时间、设备、花费、出错处理和公开说明排成能执行的计划。",
    privateConcern: "你担心团队为了融资或公开宣传答应太多，最后没有足够的人和钱持续做到。",
    ability: "你可以做一张三个月日历，标出谁值班、什么时候检查、花多少、出现什么必须暂停。",
  },
  "eleme-role-taskkeeper": {
    name: "把讨论拉回任务的人",
    publicGoal: "让大家按时交出四张具体问题卡和一张候选卡。",
    privateConcern: "你担心队友很快跳到“做 App”，忘了先查谁在哪一步卡住。",
    ability: "你可以每轮一次，把一句产品答案改问成“谁、在哪里、做什么、卡在哪一步？”",
  },
  "eleme-role-question-writer": {
    name: "把问题写具体的人",
    publicGoal: "把队友说的话填进谁、在哪、做什么、卡在哪、有什么影响五个格。",
    privateConcern: "你担心“点餐不方便”太宽，根本没法继续调查。",
    ability: "你可以每轮一次，请大家把一张宽泛卡重写成五格完整卡。",
  },
  "eleme-role-evidence-detective": {
    name: "线索查证员",
    publicGoal: "给重要说法贴上：F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道，并写下线索编号。",
    privateConcern: "你担心队友把“也许每天发生”说成“所有人每天都这样”。",
    ability: "你可以每轮一次喊停：说出证据编号，或者把这句话改贴为“G 我们猜的”或“U 还不知道”。",
  },
  "eleme-role-ai-auditor": {
    name: "AI 守门员",
    publicGoal: "让 AI 只检查表达和缺少的证据，不替团队给答案。",
    privateConcern: "你担心 AI 说得很像真的，却编出人物、数字或历史。",
    ability: "你可以每轮一次删掉 AI 的产品建议，只留下能用卡片或真人检查的问题。",
  },
};

export const STUDENT_CHALLENGE_COPY: Record<string, StudentChallengeCopy> = {
  "g95-c1-l1": { title: "用一页纸写清一个真麻烦", prompt: "从已讲出的卡中选至少2张，填5格：谁、在做什么、卡在哪里、有什么麻烦、还不知道什么。不要先写产品名。", requiredArtifact: "一页5格问题卡＋2张来源卡" },
  "g95-c1-l2": { title: "在两个真麻烦中选一个", prompt: "把两个候选麻烦并排写下，每个都标出卡片依据、一个可能证明它不重要的例子、下一步怎样问。收到新线索后改一次排序。", requiredArtifact: "两张候选问题卡＋选择理由＋修改痕迹" },
  "g95-c1-l3": { title: "排出未来30天的调查", prompt: "用日历排出要问哪些人、让他们做什么任务、记哪些动作、用多少时间和设备。写清看到什么继续，看到什么就停。", requiredArtifact: "30天调查日历＋人数＋记录表＋停止条件" },
  "g97-c2-l1": { title: "用一次小测试判断问题在哪", prompt: "选一个真实找资料任务，准备两种结果或两种排法。记录用户有没找到、用了多久、敢不敢使用，再写出什么结果说明我们猜错了。", requiredArtifact: "一张A/B小测试记录表" },
  "g97-c2-l2": { title: "同时看好不好用、跑不跑得动", prompt: "让同学试两种搜索办法：一边记任务是否完成，一边用秒表记等待和出错。必须加入一个“链接多但没用”的例子，第二次改一项。", requiredArtifact: "用户任务记录＋速度/出错记录＋第二版" },
  "g97-c2-l3": { title: "在合作方要求下做两周小测试", prompt: "合作方能带来试用者，但想用“停留更久”当成成功。排出两周试用，保留一小组原办法，同时记任务完成、相信理由、花费和暂停条件。", requiredArtifact: "两周日历＋两组对比记录＋合作红线" },
  "g98-c3-l1": { title: "画出从输入到结果的4步图", prompt: "选一个用户麻烦、一张链接线索和一个现实限制，画出输入→怎样排→用户看到什么→怎样报错。加一个会失败的例子。", requiredArtifact: "4步方案图＋一个失败例子" },
  "g98-c3-l2": { title: "比较两种排序和说明", prompt: "给同一个任务做两套结果，让用户复述“为什么这条在前面”。加入作假链接、过时页面和合作方要求的内容，第二版改一项。", requiredArtifact: "两套结果＋用户复述＋错误例子＋第二版" },
  "g98-c3-l3": { title: "做一个可以撤回的两周入口试用", prompt: "画出用户从合作入口到完成任务的路，写清合作方能看什么、不能改什么、系统怎样记录速度和错误，以及何时关闭试用。", requiredArtifact: "入口路线图＋合作说明＋关闭条件＋第二版" },
  "g00-c4-l1": { title: "让一个陌生同学走完搜索小样", prompt: "用有限资料做出输入、排序和结果。让陌生同学自己完成一个任务，记下卡住和失败，写清哪些功能本次不做，再改出第二版。", requiredArtifact: "可现场使用的小样＋失败记录＋第二版" },
  "g00-c4-l2": { title: "同时试陌生用户和多人打开", prompt: "先定作品只做多大，再让真实用户做任务，并模拟多人同时打开。记录多久、错几次、出错时怎样退回能用的版本，再改一次。", requiredArtifact: "用户任务表＋多人打开记录＋恢复办法＋第二版" },
  "g00-c4-l3": { title: "一边测搜索，一边测商业内容", prompt: "让搜索小样正常跑，同时放一小组清楚标记的商业内容。用户任务和收入分开记，写清系统变慢、用户看不懂或结果被影响时立刻暂停。", requiredArtifact: "搜索小样＋标记的商业内容＋两份数字记录＋暂停条件" },
  "g03-c5-l1": { title: "把一句品牌承诺变成每天能检查的动作", prompt: "选一句给用户的承诺，写出用户能看到什么、每天记哪个数、变成什么样必须处理、由谁负责。看到一次失败后改一版。", requiredArtifact: "一张承诺检查卡＋负责人＋第二版" },
  "g03-c5-l2": { title: "同时试一个新渠道和一个赚钱办法", prompt: "设计一次可以停止的小试用。分开记普通结果、商业内容、用户有没完成任务、赚了多少、花了多少和哪些错误，然后改一次。", requiredArtifact: "新渠道试用卡＋商业试用卡＋分开的收支和用户记录" },
  "g03-c5-l3": { title: "排出未来三个月怎样值班、增长和停止", prompt: "用三个月日历写出什么时候检查结果质量和速度、谁值班、商业内容怎样标记、依赖哪个合作方、花多少、哪种风险要公开，以及什么情况叫停。", requiredArtifact: "三个月日历＋值班表＋支出表＋公开风险＋叫停条件" },
  "eleme-challenge-problem-pool": { title: "把“点餐不方便”拆成四张卡", prompt: "学生、餐厅、送餐人分别在做什么？每张只写一个人，用五格说清他在哪里、做什么、卡在哪一步、有什么影响。不能写 App 或平台。", requiredArtifact: "四张五格问题卡＋每句话的 F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道 标签" },
  "eleme-challenge-five-checks": { title: "用五项检查淘汰一张空问题", prompt: "逐张看：具体吗、会反复吗、有损失吗、有人已经行动吗、能找真人确认吗？AI 只能找缺口，不能选答案。", requiredArtifact: "带实心星、空心星、问号的候选表＋一张淘汰卡" },
  "eleme-challenge-falsify-plan": { title: "设计一次可能证明我们错了的调查", prompt: "写清下一位找谁、让他回忆或完成什么订餐任务、记哪些动作；最重要的是写出看到什么就放弃当前判断。", requiredArtifact: "对象＋任务＋记录表＋推翻条件＋48小时负责人" },

  "eleme-challenge-three-paths": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-value-tradeoff": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-mvp-cut": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-v0-loop": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-pressure-test": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-v1-change": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-narrow-segment": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-ten-second-promise": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-channel-experiment": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-sop-run": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-order-ledger": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },
  "eleme-challenge-feedback-iteration": { title: "完成本轮团队任务", prompt: "按当前任务卡一步一步操作；说清谁受益、哪里会失败，并把课堂模拟标为 R 课堂模拟。", requiredArtifact: "一张可检查的任务记录＋一次失败或未知" },};

export const STUDENT_PRESSURE_COPY: Record<string, StudentPressureCopy> = {
  "google-1995-find-problem:1": { title: "校园目录突然变好用了", effect: "你们刚找到的麻烦看起来变小了，但还不知道是真解决了，还是麻烦换了个地方。", mitigation: "保留同一组找资料任务，重做一次，比较花了多久和回头检查几次。" },
  "google-1995-find-problem:2": { title: "一半网页没有收集到", effect: "你们手里的记录少了，不能因为没看见就说“用户没问题”。", mitigation: "缩小范围，写下缺了哪些页，再用一次现场观察或询问补一条记录。" },
  "google-1995-find-problem:3": { title: "两类同学的意见正好相反", effect: "熟悉技术的同学和普通同学觉得“好结果”完全不一样，不能再把他们统称为“用户”。", mitigation: "分开写两类人的任务，先选一类做第一轮，并写明另一类暂时没被服务。" },
  "google-1995-find-problem:4": { title: "合作网站要求把自己内容放前面", effect: "合作能带来试用者，但会改变他们看到的结果。", mitigation: "写一条不能答应的条件，只做一次能撤回的小试用，不把“人来得多”当成问题已被证明。" },
  "google-1995-find-problem:5": { title: "电脑空间快满了", effect: "原计划收集的资料放不下，团队必须先决定保留什么。", mitigation: "定一个最小页数，只保留能支持或否定当前问题的记录，并写清什么时候停。" },
  "google-1995-find-problem:6": { title: "老师问：看到什么说明你们猜错了？", effect: "“让信息更容易找”太大，无法用这一轮结果判断。", mitigation: "换成一个限时任务，写清用户做成什么算支持，出现什么算团队猜错。" },
  "google-1997-validate-problem:1": { title: "试用者只说“速度很快”", effect: "你们只知道页面快，还不知道资料对不对、他敢不敢用。", mitigation: "补一个有明确答案或可以复查的任务，追问他为什么接受这条结果。" },
  "google-1997-validate-problem:2": { title: "链接很多的页面排得靠前，却没用", effect: "你们的排法在这个例子上失败了，不能把这个例子删掉。", mitigation: "把它放进以后每次都要测的固定任务，并写清什么时候不能只信链接数。" },
  "google-1997-validate-problem:3": { title: "原型突然变慢", effect: "两种办法不再能公平比较：你们必须选缩小资料、改一步或接受等待。", mitigation: "先用秒表记下正常时间和“太慢”的线，再只改一处，不行就换回去。" },
  "google-1997-validate-problem:4": { title: "合作方不想留“用旧办法”的小组", effect: "人可能变多，但你们将不知道变化是新办法造成的，还是别的原因。", mitigation: "保留一小组做同样任务但仍用旧办法；如果做不到，就缩小或暂停这次合作。" },
  "google-1997-validate-problem:5": { title: "同一组搜索词，两个人想找的不一样", effect: "两个人的点击和完成结果不能直接混在一起算。", mitigation: "先写清每个人当时要完成什么，然后按任务分开记录。" },
  "google-1997-validate-problem:6": { title: "结果更快了，但用户更不敢相信", effect: "两个目标打架，团队必须说清哪一个绝对不能变差。", mitigation: "为“找对、足够快、敢用”各写一条可接受范围，一旦跨过就进入第二版。" },
  "google-1998-design-solution:1": { title: "用户说不出这条结果为什么在前面", effect: "内部分数变好了，但用户仍不敢相信。", mitigation: "让一名同学用自己的话复述排序理由，保留他说错或说不出的地方，再决定改文字还是改排法。" },
  "google-1998-design-solution:2": { title: "新页面让原来的排序变了", effect: "昨天和今天的结果不一样，团队要分清是资料真的变了，还是系统没来得及更新。", mitigation: "给资料写上收集时间，定一个重新收集的频率，并比较更新前后的同一个任务。" },
  "google-1998-design-solution:3": { title: "合作方要求把自己内容放在最上面", effect: "合作入口和公平排序直接冲突。", mitigation: "把付费内容和普通结果分成两个清楚区域，写清什么情况拒绝或立刻停止合作。" },
  "google-1998-design-solution:4": { title: "一组页面故意互相添很多链接", effect: "不是一个页面出错，而是一整组页面在骗过排法。", mitigation: "把这组页面放进固定错误测试，记下它们的共同做法，暂时降低这项还没验证的规则。" },
  "google-1998-design-solution:5": { title: "用户想要很多新的筛选按钮", effect: "新功能可能把最小作品拖得太大。", mitigation: "先用一个真任务试“没有这个按钮是否真的做不完”；不影响完成的请求记下但本轮不做。" },
  "google-1998-design-solution:6": { title: "没有足够设备更新所有页面", effect: "页面范围和更新速度只能保一个。", mitigation: "只保留一个高价值任务的资料，显示最后更新时间，并给用户一个报告过时结果的入口。" },
  "google-2000-build-mvp:1": { title: "新收集的页面迟迟没出现在结果里", effect: "用户看到的是过时结果，团队必须决定显示时间、缩小范围或花更多更新。", mitigation: "在结果旁显示最后更新时间，加一个“这条过时了”的反馈按钮，并写清多久必须更新。" },
  "google-2000-build-mvp:2": { title: "同时使用的人一多，页面就变慢", effect: "演示时能用，真有人来用时却失败了。", mitigation: "先限制资料范围或让请求排队，记录同时几人时开始变慢，不在没记录时盲目增加设备。" },
  "google-2000-build-mvp:3": { title: "合作方要求把商业内容混在普通结果里", effect: "用户将不知道哪些是按任务排的，哪些是花钱出现的。", mitigation: "分区并清楚标记，写明无法标记时就暂停这次试验。" },
  "google-2000-build-mvp:4": { title: "用户把“排在第一”理解成“一定正确”", effect: "一条错误结果会因为过度信任造成更大麻烦。", mitigation: "改一句排序说明，加一个错误例子让同学测，删掉“一定、权威”等过度承诺。" },
  "google-2000-build-mvp:5": { title: "服务器硬盘坏了一块", effect: "部分资料不能用，团队必须先决定哪些任务先恢复。", mitigation: "从备份恢复最重要的小范围，在页面告诉用户哪些资料暂时缺失，并记下花了多久。" },
  "google-2000-build-mvp:6": { title: "用户改写一次搜索词后才成功", effect: "团队不知道是作品帮了他，还是他自己绕过了问题。", mitigation: "记录改了几次、看到过什么提示、最后任务是否完成，然后在第二版重写成功标准。" },
  "google-2003-operate-brand:1": { title: "一条错误结果被很多人转发", effect: "用户开始怀疑你们的承诺，必须先减少影响，不能只讲技术原因。", mitigation: "公开说清影响了哪些人、什么时候修好，保留这个错误例子，并安排一次修好后的重测。" },
  "google-2003-operate-brand:2": { title: "广告主想要更显眼的位置", effect: "短期收入和用户能否看清普通结果发生冲突。", mitigation: "保持清楚标记，把收入和用户任务分开记录；无法分清时就缩小或暂停。" },
  "google-2003-operate-brand:3": { title: "一个重要合作方突然退出", effect: "试用者、收入和反馈同时变少，团队发现自己太依赖一个入口。", mitigation: "启用第二个入口或直接入口，记录恢复人数需要花多少时间和钱，并更新合作依赖清单。" },
  "google-2003-operate-brand:4": { title: "同时使用的人太多，系统报警", effect: "对外答应的服务和现在的电脑能力不匹配。", mitigation: "按事先写的条件选限制人数、简化页面或延后新功能，并告诉用户会受到什么影响。" },
  "google-2003-operate-brand:5": { title: "公开文件要求补充“什么可能出问题”", effect: "团队发现有些承诺只是口头说法，没有记录支持。", mitigation: "把还不知道的事、需要花的钱、依赖的人和合作方写进风险清单，再为每项写负责人和何时暂停。" },
  "google-2003-operate-brand:6": { title: "短期点击变多，但回来再用的人变少", effect: "一个好看的数字可能遮住了用户正在失去信任。", mitigation: "分开记任务完成、是否再来、是否相信和收入；守不住“再来”或“信任”时，立即改第二版。" },
  "eleme-2008-investigate-ordering:1": { title: "AI 一开口就叫大家做 App", effect: "听起来完整，但团队还没说清真正卡住的步骤。", mitigation: "删掉产品建议，只让 AI 检查五格问题和缺少的证据。" },
  "eleme-2008-investigate-ordering:2": { title: "一句“人人每天都点”传遍全组", effect: "没有样本和记录的猜测被说成事实。", mitigation: "贴成“G 我们猜的”或“U 还不知道”，写下要问哪几类学生、看什么动作才能确认。" },
  "eleme-2008-investigate-ordering:3": { title: "三个人的麻烦揉成一句话", effect: "学生、餐厅和送餐人的任务混在一起，没人知道先查谁。", mitigation: "每张卡只留一个主要人物和一个任务，再用线把三张卡连起来。" },
  "eleme-2008-investigate-ordering:4": { title: "有人高喊：我知道公司名字", effect: "公司名字不能替代四张问题卡和证据。", mitigation: "猜中不加分；继续完成 F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道标签和可推翻的真人验证。" },
  "eleme-2008-investigate-ordering:5": { title: "倒计时突然只剩八分钟", effect: "来不及把每张卡都做得一样完整。", mitigation: "保留最有证据的一张候选卡，其他明确写“待查”，不能用想象补齐。" },
  "eleme-2008-investigate-ordering:6": { title: "看到历史行动就想宣布成功", effect: "有人下单和餐厅合作，不等于人人需要、一定赚钱。", mitigation: "每项行动各写一句能证明和不能证明，再决定下一位真人要查什么。" },

  "eleme-2008-choose-solution:1": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-choose-solution:2": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-choose-solution:3": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-choose-solution:4": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-choose-solution:5": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-choose-solution:6": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-build-product:1": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-build-product:2": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-build-product:3": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-build-product:4": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-build-product:5": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-build-product:6": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-enter-market:1": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-enter-market:2": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-enter-market:3": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-enter-market:4": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-enter-market:5": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-enter-market:6": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-operate-loop:1": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-operate-loop:2": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-operate-loop:3": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-operate-loop:4": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-operate-loop:5": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
  "eleme-2008-operate-loop:6": { title: "本轮出现一个意外", effect: "原计划遇到阻力，团队必须看见并记录。", mitigation: "按规则暂停、记录影响，再只改一件事重试。" },
};

// Keep one authored source of truth for the four player-world chapters. The
// learner layer is generated from those concrete actions, with difficult
// facilitator language replaced, so adding or editing a chapter cannot leave
// an unprojected identity, challenge or pressure event behind.
const elemePlayerWorldChapters = elemeClassroomCampaign.chapters.slice(1);

for (const chapter of elemePlayerWorldChapters) {
  for (const identity of chapter.identities) {
    STUDENT_IDENTITY_COPY[identity.id] = {
      name: `${plainStudentText(identity.name)}（你本轮的任务）`,
      publicGoal: `这一轮先做到：${plainStudentText(identity.publicGoal)}`,
      privateConcern: `你担心：${plainStudentText(identity.privateConcern)}`,
      ability: `你可以这样帮队友：${plainStudentText(identity.ability)}`,
    };
  }

  for (const challenge of chapter.challenges) {
    STUDENT_CHALLENGE_COPY[challenge.id] = {
      title: `动手做：${plainStudentText(challenge.title)}`,
      prompt: fitStudentText(`现在和队友一起完成：${plainStudentText(challenge.prompt)}完成后，指着记录说出一次失败或还不知道的地方。`, 180),
      requiredArtifact: `交给老师检查：${plainStudentText(challenge.requiredArtifact)}`,
    };
  }

  for (const pressure of chapter.pressureEvents) {
    STUDENT_PRESSURE_COPY[`${chapter.id}:${pressure.die}`] = {
      title: `突发情况：${plainStudentText(pressure.title)}`,
      effect: `你们马上会看到：${plainStudentText(pressure.effect)}`,
      mitigation: `下一步这样做：${plainStudentText(pressure.mitigation)}`,
    };
  }
}

function plainStudentText(value: string): string {
  return expandEvidenceBoundaryShorthand(value
    .replaceAll("保护线", "必须守住的条件")
    .replaceAll("可证伪", "能被结果推翻")
    .replaceAll("可逆", "能退回")
    .replaceAll("归因", "找到原因")
    .replaceAll("触发第二轮", "开始第二次测试")
    .replaceAll("系统性反例", "一个会让整套办法失败的例子")
    .replaceAll("指标互相冲突", "两个数字指向不同选择")
    .trim());
}

function fitStudentText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).replace(/[，；：\s]+$/u, "")}。`;
}

export function toStudentIdentity<T extends { id: string; name: string; publicGoal: string; privateConcern: string; ability: string }>(identity: T): T {
  const copy = STUDENT_IDENTITY_COPY[identity.id];
  const projected = copy ? { ...identity, ...copy } : identity;
  return {
    ...projected,
    name: expandEvidenceBoundaryShorthand(projected.name),
    publicGoal: expandEvidenceBoundaryShorthand(projected.publicGoal),
    privateConcern: expandEvidenceBoundaryShorthand(projected.privateConcern),
    ability: expandEvidenceBoundaryShorthand(projected.ability),
  };
}

export function toStudentChallenge<T extends { id: string; title: string; prompt: string; requiredArtifact: string }>(
  challenge: T,
): Omit<T, "recommendedLead" | "requiredSupport"> {
  const learnerSafeChallenge = { ...challenge } as T & { recommendedLead?: unknown; requiredSupport?: unknown };
  delete learnerSafeChallenge.recommendedLead;
  delete learnerSafeChallenge.requiredSupport;
  const copy = STUDENT_CHALLENGE_COPY[challenge.id];
  const projected = copy ? { ...learnerSafeChallenge, ...copy } : learnerSafeChallenge;
  return {
    ...projected,
    title: expandEvidenceBoundaryShorthand(projected.title),
    prompt: expandEvidenceBoundaryShorthand(projected.prompt),
    requiredArtifact: expandEvidenceBoundaryShorthand(projected.requiredArtifact),
  } as Omit<T, "recommendedLead" | "requiredSupport">;
}

export function toStudentPressure<T extends { die: number; title: string; effect: string; mitigation: string }>(chapterId: string, pressure: T): T {
  const copy = STUDENT_PRESSURE_COPY[`${chapterId}:${pressure.die}`];
  const projected = copy ? { ...pressure, ...copy } : pressure;
  return {
    ...projected,
    title: expandEvidenceBoundaryShorthand(projected.title),
    effect: expandEvidenceBoundaryShorthand(projected.effect),
    mitigation: expandEvidenceBoundaryShorthand(projected.mitigation),
  };
}

export function assertStudentGameCopyComplete(chapters: ReadonlyArray<{
  id: string;
  identities: ReadonlyArray<{ id: string }>;
  challenges: ReadonlyArray<{ id: string }>;
  pressureEvents: ReadonlyArray<{ die: number }>;
}>): void {
  assertExactKeys("identity", chapters.flatMap((chapter) => chapter.identities.map((identity) => identity.id)), Object.keys(STUDENT_IDENTITY_COPY));
  assertExactKeys("challenge", chapters.flatMap((chapter) => chapter.challenges.map((challenge) => challenge.id)), Object.keys(STUDENT_CHALLENGE_COPY));
  assertExactKeys("pressure", chapters.flatMap((chapter) => chapter.pressureEvents.map((pressure) => `${chapter.id}:${pressure.die}`)), Object.keys(STUDENT_PRESSURE_COPY));
}

function assertExactKeys(label: string, expected: readonly string[], actual: readonly string[]): void {
  if (new Set(expected).size !== expected.length) throw new Error(`Duplicate ${label} ids found in campaign.`);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((id) => !actualSet.has(id));
  const extra = actual.filter((id) => !expectedSet.has(id));
  if (missing.length || extra.length) {
    throw new Error(`${label} student copy mismatch; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
  }
}
