import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classroomCampaigns } from "../app/data/classroom-campaigns";
import {
  assertStudentAssetCopyComplete,
  assertStudentCopyComplete,
  getStudentChapterCopy,
  getStudentDemoDayCopy,
  STUDENT_DEMO_DAY_COPY,
  toStudentAsset,
  toStudentInfoCard,
} from "../app/data/student-classroom-copy";
import { learnerCardTitle } from "../app/lib/evidence-boundary";

const chapters = classroomCampaigns.flatMap((campaign) => campaign.chapters);
const chapterIds = chapters.map((chapter) => chapter.id);
const cards = chapters.flatMap((chapter) => chapter.infoCards);
const assets = classroomCampaigns.flatMap((campaign) => campaign.assets);

test("all registered campaign chapters and cards have a concrete student layer", () => {
  assertStudentCopyComplete(chapterIds, cards.map((card) => card.id));
  assertStudentAssetCopyComplete(assets.map((asset) => asset.id));
  assert.equal(chapterIds.length, 10);
  assert.equal(cards.length, 120);
  assert.deepEqual(
    classroomCampaigns.map((campaign) => [
      campaign.id,
      campaign.chapters.length,
      campaign.chapters.reduce((count, chapter) => count + chapter.infoCards.length, 0),
    ]),
    [
      ["google-1995-2004", 5, 60],
      ["eleme-2008-find-problem", 5, 60],
    ],
  );

  for (const chapter of chapters) {
    const copy = getStudentChapterCopy(chapter.id);
    assert.equal(copy.steps.length, 3);
    assert.equal(copy.historicalBoundary.length, 3);
    assert.ok(copy.scene.length >= 20);
    assert.ok(copy.doneWhen.length >= 15);
    assert.notEqual(copy.briefing, chapter.briefing);
    assert.notEqual(copy.learningGoal, chapter.learningGoal);
  }
});

test("learner cards are simpler while preserving every identity, source and truth-boundary field", () => {
  const forbiddenJargon = /角色推断|超文本集合|显性约束|触发指标|系统性风险|可证伪|因果链|认知网络|量规/;

  for (const card of cards) {
    const student = toStudentInfoCard(card);
    assert.equal(student.id, card.id);
    assert.equal(student.title, learnerCardTitle(card.title));
    assert.equal(student.holderIdentityId, card.holderIdentityId);
    assert.equal(student.kind, card.kind);
    assert.equal(student.credibility, card.credibility);
    assert.deepEqual(student.sourceIds, card.sourceIds);
    assert.notEqual(student.body, card.body);
    assert.notEqual(student.sharePrompt, card.sharePrompt);
    assert.doesNotMatch(`${student.body} ${student.sharePrompt}`, forbiddenJargon);
    assert.ok(student.body.length >= 25 && student.body.length <= 150, `${card.id} body length`);
    assert.ok(student.sharePrompt.length >= 12 && student.sharePrompt.length <= 70, `${card.id} prompt length`);

    if (card.kind === "rumor") assert.match(student.body, /未确认消息/);
    if (card.kind === "inference") assert.match(student.body, /猜测/);
    if (card.kind === "viewpoint") assert.match(student.body, /一种看法/);
  }

  const elemeCampaign = classroomCampaigns.find((campaign) => campaign.id === "eleme-2008-find-problem");
  assert.ok(elemeCampaign);
  const sealedCaseCards = elemeCampaign.chapters.flatMap((chapter) => chapter.infoCards);
  assert.equal(sealedCaseCards.length, 60);
  for (const card of sealedCaseCards) {
    const student = toStudentInfoCard(card);
    assert.doesNotMatch(`${student.title} ${student.body} ${student.sharePrompt}`, /饿了么|张旭豪|上海交通大学/);
  }
});

test("student asset and Demo Day copy name visible actions instead of hidden theory", () => {
  for (const asset of assets) {
    const student = toStudentAsset(asset);
    assert.equal(student.id, asset.id);
    assert.notEqual(student.ability, asset.ability);
    assert.notEqual(student.risk, asset.risk);
    assert.notEqual(student.unlocks, asset.unlocks);
  }

  assert.equal(STUDENT_DEMO_DAY_COPY.durationSeconds, 360);
  assert.equal(STUDENT_DEMO_DAY_COPY.segments.length, 7);
  assert.equal(STUDENT_DEMO_DAY_COPY.segments[0].startSecond, 0);
  assert.equal(STUDENT_DEMO_DAY_COPY.segments.at(-1)?.endSecond, 360);
  assert.match(STUDENT_DEMO_DAY_COPY.segments[5].title, /第一次.*第二次/);
  assert.ok(STUDENT_DEMO_DAY_COPY.rubric.every((item) => /能/.test(item)));
  const elemeDemo = getStudentDemoDayCopy("eleme-2008-find-problem");
  assert.equal(elemeDemo.durationSeconds, 360);
  assert.equal(elemeDemo.segments.length, 7);
  assert.equal(elemeDemo.segments.at(-1)?.endSecond, 360);
  assert.ok(elemeDemo.rubric.every((item) => /能/.test(item)));
});

test("server keeps facilitator theory and unopened challenges out of learner projections", async () => {
  const source = await readFile(new URL("../app/lib/classroom-store.ts", import.meta.url), "utf8");
  assert.match(source, /dm:\s*viewer\.role === "dm" \? chapter\.dm : null/);
  assert.match(source, /challenges:\s*viewer\.role === "dm" \? chapter\.challenges : selectedChallenge \? \[toStudentChallenge\(selectedChallenge\)\] : \[\]/);
  assert.match(source, /pressureEvents:\s*viewer\.role === "dm" \? chapter\.pressureEvents : selectedPressure \? \[toStudentPressure\(chapter\.id, selectedPressure\)\] : \[\]/);
  assert.match(source, /viewer\.role === "learner" \? toStudentInfoCard\(card\) : card/);
  assert.match(source, /viewer\.role === "learner" && !campaign\.courseRef \? getStudentDemoDayCopy\(campaign\.id\) : campaign\.demoDay/);
  assert.match(source, /toLearnerCampaignSummary\(campaign, Boolean\(room\.history_revealed\)\)/);
  assert.match(source, /toLearnerRoomTitle\(campaign, room\.title, Boolean\(room\.history_revealed\)\)/);
  assert.match(source, /detail: learnerHistorySealed \? \{\} : parseJson/);
});

test("every classroom phase keeps the middle-school rhythm concrete and leaves theory to the mentor", async () => {
  const source = await readFile(new URL("../app/classroom/ClassroomApp.tsx", import.meta.url), "utf8");
  const concretePhaseLabels = [
    "四人到齐", "拿到角色任务", "打开三张线索", "讲给队友听", "把线索连起来",
    "用五句话说清问题", "商量团队计划", "第一次试做", "根据反馈改一次", "算账和选工具",
    "我们的选择 vs 历史", "说清学到和下一步", "完成六分钟发布",
  ];
  for (const label of concretePhaseLabels) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /STUDENT_PHASE_STEPS: Record<ClassroomPhase, readonly \[string, string, string\]>/);
  assert.match(source, /YOUNG BUILDER · 先做，再由老师解释/);
  assert.match(source, /不用先记术语。完成具体动作后，老师会带大家说出背后的方法。/);
  assert.match(source, /你不是某一个字母角色/);
  assert.match(source, /四类导师支援 · 不是学员角色/);
  assert.doesNotMatch(source, /studentPdmoDescription/);
  assert.doesNotMatch(source, /pdmoRole/);
  assert.match(source, /room\.viewer\.role === "learner" \? "团队钱箱" : "团队金库"/);
});
