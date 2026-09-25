import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classroomCampaigns } from "../app/data/classroom-campaigns";
import {
  getStudentChapterCopy,
  getStudentDemoDayCopy,
  toStudentAsset,
  toStudentHistoryReveal,
  toStudentInfoCard,
} from "../app/data/student-classroom-copy";
import {
  toStudentChallenge,
  toStudentIdentity,
  toStudentPressure,
} from "../app/data/student-classroom-game-copy";
import {
  EVIDENCE_BOUNDARY_GUIDE,
  EVIDENCE_BOUNDARY_LABELS,
  evidenceBoundaryForCard,
  expandEvidenceBoundaryShorthand,
  learnerCardTitle,
} from "../app/lib/evidence-boundary";

const BOUNDARY_TOKEN = /(?<![A-Za-z0-9.&-])([FRGU])(?![A-Za-z0-9.&-])/gu;
const REQUIRED_SUFFIX = { F: "有来源", R: "课堂模拟", G: "我们猜的", U: "还不知道" } as const;

test("evidence boundary always carries a concrete Chinese meaning", () => {
  assert.deepEqual(EVIDENCE_BOUNDARY_LABELS, {
    F: "F 有来源",
    R: "R 课堂模拟",
    G: "G 我们猜的",
    U: "U 还不知道",
  });
  assert.equal(EVIDENCE_BOUNDARY_GUIDE, "F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道");
  assert.equal(expandEvidenceBoundaryShorthand("请标 F／R／G／U"), `请标 ${EVIDENCE_BOUNDARY_GUIDE}`);
  assert.equal(expandEvidenceBoundaryShorthand("F"), "F 有来源");
  assert.equal(expandEvidenceBoundaryShorthand("这是 R？"), "这是 R 课堂模拟？");
  assert.equal(expandEvidenceBoundaryShorthand("F 还是 R？"), "F 有来源 还是 R 课堂模拟？");
  assert.equal(expandEvidenceBoundaryShorthand("改贴 G／U"), "改贴 G 我们猜的／U 还不知道");
  assert.equal(expandEvidenceBoundaryShorthand("U.S. source"), "U.S. source");
  assert.equal(expandEvidenceBoundaryShorthand("R&D"), "R&D");
  assert.equal(expandEvidenceBoundaryShorthand("G1 手机"), "G1 手机");
  assert.equal(expandEvidenceBoundaryShorthand("F-01 · 内部编码"), "F-01 · 内部编码");
  assert.equal(learnerCardTitle("F-01 · 一条历史线索"), "一条历史线索");

  assert.equal(evidenceBoundaryForCard({ title: "F-01 · 历史", kind: "fact", sourceIds: ["source"] }), "F");
  assert.equal(evidenceBoundaryForCard({ title: "测试任务", body: "课堂模拟：学生抽卡", kind: "observation", sourceIds: [] }), "R");
  assert.equal(evidenceBoundaryForCard({ title: "可能的解释", kind: "inference", sourceIds: ["context-only"] }), "G");
  assert.equal(evidenceBoundaryForCard({ title: "当前未知", kind: "observation", sourceIds: [] }), "U");
});

test("all registered learner projections contain no unexplained F/R/G/U code", () => {
  const projections: unknown[] = [];
  for (const campaign of classroomCampaigns) {
    projections.push(getStudentDemoDayCopy(campaign.id));
    projections.push(...campaign.assets.map(toStudentAsset));
    for (const chapter of campaign.chapters) {
      projections.push(getStudentChapterCopy(chapter.id));
      projections.push(toStudentHistoryReveal(chapter.id, chapter.historyReveal));
      projections.push(...chapter.identities.map(toStudentIdentity));
      projections.push(...chapter.infoCards.map(toStudentInfoCard));
      for (const card of chapter.infoCards.map(toStudentInfoCard)) assert.doesNotMatch(card.title, /^[FRGU]-\d+/u);
      projections.push(...chapter.challenges.map(toStudentChallenge));
      projections.push(...chapter.pressureEvents.map((pressure) => toStudentPressure(chapter.id, pressure)));
    }
  }
  assertNoOpaqueBoundaryCode(projections, "learner projections");
});

test("formal classroom and eight-seat LIVE RUN render the expanded boundary labels", async () => {
  const [classroom, store, seat] = await Promise.all([
    readFile(new URL("../app/classroom/ClassroomApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/classroom-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../tools/live-run/static/seat.js", import.meta.url), "utf8"),
  ]);
  assert.match(classroom, /<EvidenceBoundaryLegend \/>/);
  assert.match(classroom, /evidenceBoundaryLabel\(card\)/);
  assert.match(classroom, /learnerCardTitle\(card\.title\)/);
  assert.match(store, /viewer\.role === "learner" \? toStudentAsset\(asset\) : asset/);
  for (const label of Object.values(EVIDENCE_BOUNDARY_LABELS)) assert.match(seat, new RegExp(label));
  assert.match(seat, /cleanCardTitle\(card\.title\)/);
});

function assertNoOpaqueBoundaryCode(value: unknown, path: string): void {
  if (typeof value === "string") {
    BOUNDARY_TOKEN.lastIndex = 0;
    for (const match of value.matchAll(BOUNDARY_TOKEN)) {
      const code = match[1] as keyof typeof REQUIRED_SUFFIX;
      const suffix = value.slice((match.index ?? 0) + code.length);
      assert.match(suffix, new RegExp(`^\\s*${REQUIRED_SUFFIX[code]}`), `${path} contains unexplained ${code}: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOpaqueBoundaryCode(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertNoOpaqueBoundaryCode(item, `${path}.${key}`);
  }
}
