import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertClassroomCampaignRegistry,
  classroomCampaignCatalog,
  classroomCampaigns,
  DEFAULT_CLASSROOM_CAMPAIGN_ID,
  getClassroomCampaign,
  toLearnerCampaignSummary,
  toLearnerRoomTitle,
} from "../app/data/classroom-campaigns";
import { elemeClassroomCampaign } from "../app/data/eleme-classroom-campaign";
import {
  getStudentChapterCopy,
  getStudentDemoDayCopy,
  toStudentAsset,
  toStudentHistoryReveal,
  toStudentInfoCard,
} from "../app/data/student-classroom-copy";
import { toStudentChallenge, toStudentIdentity, toStudentPressure } from "../app/data/student-classroom-game-copy";

test("campaign registry exposes Google by default and Eleme as a selectable five-chapter course", () => {
  assert.doesNotThrow(() => assertClassroomCampaignRegistry());
  assert.equal(DEFAULT_CLASSROOM_CAMPAIGN_ID, "google-1995-2004");
  assert.deepEqual(classroomCampaigns.map((campaign) => campaign.id), ["google-1995-2004", "eleme-2008-find-problem"]);
  assert.equal(classroomCampaignCatalog.length, 2);
  assert.equal(getClassroomCampaign("eleme-2008-find-problem"), elemeClassroomCampaign);
  assert.equal(getClassroomCampaign("missing"), undefined);
  assert.equal(elemeClassroomCampaign.chapters.length, 5);
  assert.deepEqual(
    elemeClassroomCampaign.chapters.map((chapter) => chapter.stage),
    ["find-problem", "validate-problem", "design-solution", "build-mvp", "operate-brand"],
  );
  assert.deepEqual(
    elemeClassroomCampaign.chapters.map((chapter) => chapter.order),
    [1, 2, 3, 4, 5],
  );
  assert.equal(classroomCampaignCatalog[1].chapterCount, 5);
});

test("every Eleme chapter maps four identities, twelve random cards, three challenges and six pressure faces", () => {
  assert.equal(elemeClassroomCampaign.assets.length, 10);

  const sourceIds = new Set(elemeClassroomCampaign.sources.map((source) => source.id));
  for (const chapter of elemeClassroomCampaign.chapters) {
    assert.equal(chapter.identities.length, 4, chapter.id);
    assert.equal(chapter.infoCards.length, 12, chapter.id);
    assert.deepEqual(chapter.challenges.map((challenge) => challenge.level), [1, 2, 3], chapter.id);
    assert.deepEqual(chapter.pressureEvents.map((pressure) => pressure.die), [1, 2, 3, 4, 5, 6], chapter.id);
    const identityIds = new Set(chapter.identities.map((identity) => identity.id));
    for (const card of chapter.infoCards) {
      assert.ok(identityIds.has(card.holderIdentityId), `${card.id} holder exists`);
      for (const sourceId of card.sourceIds) assert.ok(sourceIds.has(sourceId), `${card.id} source exists`);
    }
  }
});

test("Eleme later chapters are explicit player simulations with only source-backed boundary cards", () => {
  for (const chapter of elemeClassroomCampaign.chapters.slice(1)) {
    const historical = chapter.infoCards.filter((card) => card.title.startsWith("F-"));
    const simulations = chapter.infoCards.filter((card) => card.title.startsWith("R-"));
    assert.equal(historical.length, 2, chapter.id);
    assert.equal(simulations.length, 10, chapter.id);
    assert.ok(historical.every((card) => card.sourceIds.length > 0 && card.body.startsWith("历史边界事实：")), chapter.id);
    assert.ok(
      simulations.every((card) => card.sourceIds.length === 0 && card.body.startsWith("课堂模拟（玩家平行世界，不是饿了么史实）：")),
      chapter.id,
    );
    assert.match(chapter.historyReveal.happened, /不|没有|玩家/, chapter.id);
  }
});

test("Eleme truth boundary explicitly separates source-backed F/C cards from classroom R simulations", () => {
  const cards = elemeClassroomCampaign.chapters[0].infoCards;
  const simulations = cards.filter((card) => card.id.startsWith("e08-r-"));
  const historical = cards.filter((card) => card.id.startsWith("e08-f-") || card.id.startsWith("e08-c-"));
  assert.equal(simulations.length, 4);
  assert.equal(historical.length, 8);
  assert.ok(simulations.every((card) => card.sourceIds.length === 0 && /课堂模拟/.test(card.body)));
  assert.ok(historical.every((card) => card.sourceIds.length > 0 && /历史事实|历史行动/.test(card.body)));
  assert.match(elemeClassroomCampaign.chapters[0].historicalBoundary.join(" "), /R 课堂模拟卡是课堂模拟/);
  assert.match(elemeClassroomCampaign.chapters[0].dm.watchFor.join(" "), /R 课堂模拟卡当成真实个体证词/);
});

test("Eleme learner labels keep the company answer sealed until history reveal", () => {
  const sealed = toLearnerCampaignSummary(elemeClassroomCampaign, false);
  assert.equal(sealed.title, "2008 宿舍订餐创业五步战役");
  assert.equal(sealed.organization, "上海某高校宿舍调查组");
  assert.doesNotMatch(JSON.stringify(sealed), /饿了么|张旭豪/);
  assert.equal(
    toLearnerRoomTitle(elemeClassroomCampaign, "饿了么内部课件", false),
    "2008 宿舍订餐创业五步课",
  );

  const revealed = toLearnerCampaignSummary(elemeClassroomCampaign, true);
  assert.equal(revealed.title, elemeClassroomCampaign.title);
  assert.equal(revealed.organization, elemeClassroomCampaign.organization);
  assert.equal(toLearnerRoomTitle(elemeClassroomCampaign, "饿了么内部课件", true), "饿了么内部课件");
});

test("Eleme lesson has an independent concrete middle-school projection for every visible object", () => {
  const chapter = elemeClassroomCampaign.chapters[0];
  const chapterCopy = getStudentChapterCopy(chapter.id);
  assert.equal(chapterCopy.steps.length, 3);
  assert.notEqual(chapterCopy.briefing, chapter.briefing);
  assert.match(chapterCopy.doneWhen, /四张具体问题卡/);

  for (const identity of chapter.identities) assert.notEqual(toStudentIdentity(identity).name, identity.name);
  for (const card of chapter.infoCards) assert.notEqual(toStudentInfoCard(card).body, card.body);
  for (const challenge of chapter.challenges) assert.notEqual(toStudentChallenge(challenge).prompt, challenge.prompt);
  for (const pressure of chapter.pressureEvents) assert.notEqual(toStudentPressure(chapter.id, pressure).title, pressure.title);
  for (const asset of elemeClassroomCampaign.assets) assert.notEqual(toStudentAsset(asset).ability, asset.ability);
  assert.notEqual(toStudentHistoryReveal(chapter.id, chapter.historyReveal).happened, chapter.historyReveal.happened);
});

test("both campaigns have a continuous seven-part six-minute ending", () => {
  for (const campaign of classroomCampaigns) {
    let cursor = 0;
    for (const segment of campaign.demoDay.segments) {
      assert.equal(segment.startSecond, cursor);
      cursor = segment.endSecond;
    }
    assert.equal(cursor, 360);
    assert.equal(campaign.demoDay.segments.length, 7);

    const student = getStudentDemoDayCopy(campaign.id);
    assert.equal(student.durationSeconds, 360);
    assert.equal(student.segments.length, 7);
    assert.equal(student.segments.at(-1)?.endSecond, 360);
  }
});

test("campaign selection is carried from dashboard UI through API validation into persisted rooms", async () => {
  const [ui, route, validation, store] = await Promise.all([
    readFile(new URL("../app/classroom/ClassroomApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/classroom/rooms/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/classroom-validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/classroom-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /选择课件/);
  assert.match(ui, /campaignId/);
  assert.match(route, /createClassroomRoom\(db, user, title, campaignId\)/);
  assert.match(validation, /CAMPAIGN_NOT_FOUND/);
  assert.match(store, /campaign\.id, firstChapter\.id/);
  assert.match(store, /loadRoomCourseCampaign\(db, \{ id: room\.id, campaign_id: room\.campaign_id \}\)/);
  assert.match(store, /loadReleasedCourseCampaign\(db, campaignId\)/);
  assert.match(store, /bindRoomCourseStatement\(db, roomId, campaign, now\)/);
});
