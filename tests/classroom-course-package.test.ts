import assert from "node:assert/strict";
import test from "node:test";

import {
  bundledCoursePackages,
  coursePackageDigest,
  projectCoursePackageToCampaign,
  validateCoursePackage,
} from "../app/lib/course-package";
import { reconcileCourseCardGrantIds } from "../app/lib/course-registry";

const expectedDigests: Record<string, string> = {
  "google-1995-2004": "59e0ef603d97d72578913ec1ab20d055210190137bfb8f437a417e0102ed77cd",
  "eleme-2008-find-problem": "407a24b43ead68ddccf0871fe7910ae21f1ca64ec4b7232a2bc0afeb2cfecb6c",
};

test("Classroom consumes the exact two Course Package JSON files with Python-compatible digests", async () => {
  const courses = bundledCoursePackages();
  assert.deepEqual(courses.map((course) => course.course.id).sort(), Object.keys(expectedDigests).sort());
  for (const course of courses) {
    assert.equal(await coursePackageDigest(course), expectedDigests[course.course.id]);
    assert.equal(course.macroSteps.length, 5);
    assert.equal(course.blocks.length, 13);
    assert.equal(course.decks.length, 5);
    assert.ok(course.decks.every((deck) => deck.cards.length >= 12));
  }
});

test("one exact ref projects five chapters, role-independent learners and six Demo minutes", async () => {
  for (const course of bundledCoursePackages()) {
    const digest = await coursePackageDigest(course);
    const campaign = projectCoursePackageToCampaign(course, {
      courseId: course.course.id,
      schemaVersion: course.schemaVersion,
      revision: 7,
      digest,
      status: "candidate",
    });
    assert.deepEqual(campaign.chapters.map((chapter) => chapter.stage), ["find", "decide", "build", "market", "operate"]);
    assert.ok(campaign.chapters.every((chapter) => chapter.identities.length === 4));
    assert.ok(campaign.chapters.every((chapter) => chapter.infoCards.length >= 12));
    assert.equal(campaign.demoDay.durationSeconds, 360);
    assert.equal(campaign.demoDay.segments.length, 6);
    assert.deepEqual(campaign.courseRef, {
      courseId: course.course.id,
      schemaVersion: 1,
      revision: 7,
      digest,
      status: "candidate",
    });
  }
});

test("invalid and incomplete packages fail closed", () => {
  const missingDeck = structuredClone(bundledCoursePackages()[0]) as unknown as Record<string, unknown>;
  missingDeck.decks = [];
  assert.throws(() => validateCoursePackage(missingDeck), /5 步 \/ 13 块 \/ 5 卡组/);

  const badSource = structuredClone(bundledCoursePackages()[0]);
  badSource.decks[0].cards[0].sourceIds = ["missing-source"];
  assert.throws(() => validateCoursePackage(badSource), /未知来源/);
});

test("Alpha hot refresh keeps stable card grants and replaces only removed ids", async () => {
  const course = bundledCoursePackages()[0];
  const digest = await coursePackageDigest(course);
  const campaign = projectCoursePackageToCampaign(course, {
    courseId: course.course.id,
    schemaVersion: 1,
    revision: 2,
    digest,
    status: "candidate",
  });
  const chapter = campaign.chapters[0];
  const first = chapter.infoCards[0].id;
  const second = chapter.infoCards[1].id;
  const updates = reconcileCourseCardGrantIds(campaign, [
    { id: "grant-1", chapter_id: chapter.id, team_id: "team-1", card_id: first },
    { id: "grant-2", chapter_id: chapter.id, team_id: "team-1", card_id: "deleted-card" },
    { id: "grant-3", chapter_id: chapter.id, team_id: "team-1", card_id: second },
  ]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, "grant-2");
  assert.ok(chapter.infoCards.some((card) => card.id === updates[0].cardId));
  assert.notEqual(updates[0].cardId, first);
  assert.notEqual(updates[0].cardId, second);
});
