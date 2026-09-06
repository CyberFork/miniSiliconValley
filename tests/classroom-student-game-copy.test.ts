import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classroomCampaigns } from "../app/data/classroom-campaigns";
import {
  assertStudentGameCopyComplete,
  toStudentChallenge,
  toStudentIdentity,
  toStudentPressure,
} from "../app/data/student-classroom-game-copy";
import {
  STUDENT_HISTORY_COPY,
  toStudentHistoryReveal,
} from "../app/data/student-classroom-copy";
import type { CaseIdentity, ClassroomChallenge } from "../app/lib/classroom-model";

const identities: CaseIdentity[] = [];
const challenges: ClassroomChallenge[] = [];
const chapters = classroomCampaigns.flatMap((campaign) => campaign.chapters);
for (const chapter of chapters) {
  identities.push(...chapter.identities);
  challenges.push(...chapter.challenges);
}

test("all identities, challenges, pressure events and history reveals have a student projection", () => {
  assertStudentGameCopyComplete(chapters);
  assert.equal(identities.length, 40);
  assert.equal(challenges.length, 30);
  assert.equal(chapters.reduce((count, chapter) => count + chapter.pressureEvents.length, 0), 60);
  assert.equal(Object.keys(STUDENT_HISTORY_COPY).length, 10);
});

test("learner identity copy names concrete work while preserving the authored identity metadata", () => {
  const forbidden = /系统性风险|显性约束|角色推断|可证伪|SLO|认知闭环|价值假设|商业交换/;
  for (const identity of identities) {
    const student = toStudentIdentity(identity);
    assert.equal(student.id, identity.id);
    assert.equal(student.nature, identity.nature);
    assert.notEqual(student.name, identity.name);
    assert.notEqual(student.publicGoal, identity.publicGoal);
    assert.notEqual(student.privateConcern, identity.privateConcern);
    assert.notEqual(student.ability, identity.ability);
    assert.doesNotMatch(`${student.name} ${student.publicGoal} ${student.privateConcern} ${student.ability}`, forbidden);
    assert.match(student.privateConcern, /你担心/);
    assert.match(student.ability, /你可以/);
  }
});

test("learner challenge copy asks for visible artifacts without facilitator routing metadata", () => {
  const forbidden = /可证伪|证据链|指标隔离|可逆运行|系统性反例|容量预算|风险登记|治理节奏/;
  for (const challenge of challenges) {
    const student = toStudentChallenge(challenge);
    assert.equal(student.id, challenge.id);
    assert.equal(student.level, challenge.level);
    assert.equal(Object.hasOwn(student, "recommendedLead"), false);
    assert.equal(Object.hasOwn(student, "requiredSupport"), false);
    assert.equal(student.baseIncomeTenths, challenge.baseIncomeTenths);
    assert.notEqual(student.title, challenge.title);
    assert.notEqual(student.prompt, challenge.prompt);
    assert.notEqual(student.requiredArtifact, challenge.requiredArtifact);
    assert.doesNotMatch(`${student.title} ${student.prompt} ${student.requiredArtifact}`, forbidden);
    assert.ok(student.prompt.length >= 45 && student.prompt.length <= 180, `${challenge.id} prompt length`);
  }
});

test("learner pressure and history copy tells students what happened and what to do next", () => {
  const pressureForbidden = /可证伪|归因|保护线|触发第二轮|系统性反例|指标互相冲突/;
  for (const chapter of chapters) {
    const history = toStudentHistoryReveal(chapter.id, chapter.historyReveal);
    assert.notEqual(history.happened, chapter.historyReveal.happened);
    assert.equal(history.sourceIds, chapter.historyReveal.sourceIds);
    assert.ok(history.comparisonPrompts.length >= 3);
    for (const prompt of history.comparisonPrompts) assert.match(prompt, /？$/);

    for (const pressure of chapter.pressureEvents) {
      const student = toStudentPressure(chapter.id, pressure);
      assert.equal(student.die, pressure.die);
      assert.notEqual(student.title, pressure.title);
      assert.notEqual(student.effect, pressure.effect);
      assert.notEqual(student.mitigation, pressure.mitigation);
      assert.doesNotMatch(`${student.title} ${student.effect} ${student.mitigation}`, pressureForbidden);
      assert.ok(student.mitigation.length >= 18, `${chapter.id}:${pressure.die} mitigation must be actionable`);
    }
  }
});

test("server projects simple game copy to learners and retains original content for DM", async () => {
  const source = await readFile(new URL("../app/lib/classroom-store.ts", import.meta.url), "utf8");
  assert.match(source, /viewer\.role === "learner" \? toStudentIdentity\(originalIdentity\) : originalIdentity/);
  assert.match(source, /selectedChallenge \? \[toStudentChallenge\(selectedChallenge\)\] : \[\]/);
  assert.match(source, /selectedPressure \? \[toStudentPressure\(chapter\.id, selectedPressure\)\] : \[\]/);
  assert.match(source, /viewer\.role === "learner" \? toStudentHistoryReveal\(chapter\.id, chapter\.historyReveal\) : chapter\.historyReveal/);
  assert.match(source, /identities: chapter\.identities/);
  assert.match(source, /allCards: chapter\.infoCards/);
});
