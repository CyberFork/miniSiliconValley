import assert from "node:assert/strict";
import test from "node:test";
import { googleClassroomCampaign } from "../app/data/google-classroom-campaign";

const stages = ["find-problem", "validate-problem", "design-solution", "build-mvp", "operate-brand"] as const;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

test("Google classroom campaign has the complete five-chapter content contract", () => {
  const campaign = googleClassroomCampaign;
  assert.equal(campaign.chapters.length, 5);
  assert.deepEqual(campaign.chapters.map((chapter) => chapter.stage), stages);
  assert.deepEqual(campaign.chapters.map((chapter) => chapter.order), [1, 2, 3, 4, 5]);

  const sourceIds = new Set(campaign.sources.map((source) => source.id));
  assert.equal(sourceIds.size, campaign.sources.length, "source IDs must be unique");
  for (const chapter of campaign.chapters) {
    assert.equal(chapter.identities.length, 4);
    assert.equal(chapter.infoCards.length, 12);
    assert.deepEqual(
      Object.values(Object.groupBy(chapter.infoCards, (card) => card.holderIdentityId)).map((cards) => cards?.length ?? 0).sort(),
      [3, 3, 3, 3],
    );
    assert.deepEqual(chapter.challenges.map((challenge) => challenge.level).sort(), [1, 2, 3]);
    assert.deepEqual(chapter.pressureEvents.map((event) => event.die).sort(), [1, 2, 3, 4, 5, 6]);
    for (const card of chapter.infoCards) {
      assert.equal(new Set(card.sourceIds).size, card.sourceIds.length);
      card.sourceIds.forEach((id) => assert.ok(sourceIds.has(id), `unknown card source ${id}`));
    }
    for (const id of chapter.historyReveal.sourceIds) assert.ok(sourceIds.has(id), `unknown reveal source ${id}`);
    chapter.identities.forEach((identity) => assert.equal(identity.nature, "composite"));
  }
  assert.equal(campaign.assets.length, 10);
  assert.equal(campaign.demoDay.durationSeconds, 360);
  assert.equal(campaign.demoDay.segments.at(-1)?.endSecond, 360);
  assert.equal(campaign.demoDay.segments[0]?.startSecond, 0);
  assert.ok(!strings(campaign).some((value) => /\b(?:TODO|TBD|FIXME)\b|占位/.test(value)), "content contains placeholder text");
});

test("Google classroom campaign key IDs are globally unique", () => {
  const campaign = googleClassroomCampaign;
  const ids = [
    ...campaign.sources.map((x) => x.id), ...campaign.assets.map((x) => x.id),
    ...campaign.chapters.flatMap((chapter) => [chapter.id, ...chapter.identities.map((x) => x.id), ...chapter.infoCards.map((x) => x.id), ...chapter.challenges.map((x) => x.id)]),
    ...campaign.demoDay.segments.map((x) => x.id),
  ];
  assert.equal(new Set(ids).size, ids.length, "duplicate key ID found");
});
