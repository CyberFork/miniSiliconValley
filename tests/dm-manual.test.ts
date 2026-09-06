import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const DOCS = new URL("../docs/", import.meta.url);

async function readDoc(name: string) {
  return readFile(new URL(name, DOCS), "utf8");
}

test("DM manual: a first-time mentor can follow the complete 90-minute loop", async () => {
  const manual = await readDoc("DM_MENTOR_MANUAL.md");

  for (const required of [
    "情报网（探索）",
    "攻坚局（情境）",
    "成长盘（决策与建设）",
    "阶段一：入场与身份建立",
    "身份卡模板",
    "信息卡模板",
    "挑战卡模板",
    "资产卡模板",
    "Google 1998示例章节",
    "一页式DM速查",
    "个人声望 RP",
    "团队资金 C",
    "个人钱包 C",
    "历史相似度：0%",
  ]) {
    assert.ok(manual.includes(required), `DM手册缺少关键操作内容：${required}`);
  }

  const expectedSchedule = [
    [0, 8],
    [8, 15],
    [15, 32],
    [32, 42],
    [42, 47],
    [47, 52],
    [52, 68],
    [68, 76],
    [76, 82],
    [82, 86],
    [86, 90],
  ] as const;
  const scheduleBlock = manual.match(/## 6\. 90分钟标准课堂流程\s+```text\n([\s\S]*?)```/)?.[1];
  assert.ok(scheduleBlock, "DM手册缺少可解析的90分钟流程块");
  const actualSchedule = Array.from(scheduleBlock.matchAll(/^(\d{2})–(\d{2})/gm), (match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
  assert.deepEqual(actualSchedule, expectedSchedule, "90分钟流程必须从0连续覆盖到90分钟");
});

test("economy and product spec: rules, props, apps and ledger invariants are explicit", async () => {
  const spec = await readDoc("GAME_ECONOMY_AND_PRODUCT_SPEC.md");

  for (const required of [
    "个人声望 RP",
    "团队资金 C",
    "个人钱包 C",
    "它们不能互相兑换",
    "50% 平等劳动份额",
    "30% 角色交付份额",
    "20% 协作贡献份额",
    "每个4人团队的实体包",
    "学员端九个核心页面",
    "DM控制台",
    "内容后台与知识库连接",
    "idempotency_key",
    "首个可开发垂直切片",
    "同一个购买请求重复提交只成交一次",
  ]) {
    assert.ok(spec.includes(required), `经济与产品规格缺少验收内容：${required}`);
  }

  assert.match(spec, /每节90分钟任务课最多获得12 RP/);
  assert.match(spec, /声望不能购买，不能转让，不能被骰子扣除/);
  assert.match(spec, /融资款不是收入，不直接进入可分配利润/);
  assert.match(spec, /禁止玩家间直接转账/);
  assert.doesNotMatch(spec, /\b(?:TODO|TBD|FIXME)\b/, "规格中不能遗留占位任务");
});

test("production admin and DM manual matches the actual classroom controls", async () => {
  const manual = await readDoc("ADMIN_DM_UI_OPERATION_MANUAL.md");

  for (const required of [
    "终极管理员／DM 导师主持人操作手册",
    "去导师控制台完成当前阶段：四人到齐 →",
    "进入导师控制台 →",
    "指派为授课导师 →",
    "批准加入",
    "随机分配身份与发牌",
    "身份与完整12张牌池分别随机",
    "初中生不先学术语",
    "导师命名",
    "打开这张线索",
    "贴到团队线索墙",
    "保存这5句话",
    "负责人、至少一名支援者、完成时间和可检查结果",
    "交出第1版做法",
    "交出第2版做法",
    "通过门槛并推进 →",
    "顶部13阶段圆点只用于切换查看工作区",
    "按四项量规公开结算",
    "所有团队已冻结，揭晓真实历史",
    "全部复盘完成，进入下一章",
    "完成本次课件",
    "完成5章战役",
    "↓ 导出完整课堂档案",
    "TEAM-MHKNJEAG",
  ]) {
    assert.ok(manual.includes(required), `管理员／DM逐点击手册缺少生产操作：${required}`);
  }

  for (const phaseLabel of [
    "四人到齐", "拿到角色任务", "打开三张线索", "讲给队友听", "把线索连起来",
    "用五句话说清问题", "商量怎么一起做", "第一次试做", "根据反馈改一次", "算账和选工具",
    "我们的选择 vs 历史", "说清学到和下一步", "完成六分钟发布",
  ]) assert.ok(manual.includes(phaseLabel), `操作手册缺少当前阶段名：${phaseLabel}`);

  assert.doesNotMatch(manual, /DM 建房|计时开始|归档房间|集结大厅|身份入戏|随机随机|提交第1轮行动|提交第2轮行动/, "手册不得继续使用生产界面不存在的旧按钮或旧阶段名");
  await assert.doesNotReject(access(new URL("assets/admin-dm-lobby-current-action.png", DOCS)));
  await assert.doesNotReject(access(new URL("assets/admin-dm-lobby-dm-console.png", DOCS)));
});

test("mentor documentation: every local Markdown link resolves", async () => {
  for (const fileName of [
    "DM_MENTOR_MANUAL.md",
    "ADMIN_DM_UI_OPERATION_MANUAL.md",
    "FACILITATOR_GUIDE.md",
    "GAME_ECONOMY_AND_PRODUCT_SPEC.md",
  ]) {
    const markdown = await readDoc(fileName);
    const targets = Array.from(markdown.matchAll(/\]\(([^)]+\.md(?:#[^)]+)?)\)/g), (match) => match[1]);
    assert.ok(targets.length > 0, `${fileName} 至少应链接一份配套文档`);

    for (const target of targets) {
      const [relativePath] = target.split("#", 1);
      await assert.doesNotReject(access(new URL(relativePath, DOCS)), `${fileName} 的链接不存在：${target}`);
    }
  }
});
