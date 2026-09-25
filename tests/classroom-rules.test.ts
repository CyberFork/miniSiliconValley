import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateProfitDistribution,
  calculateReputation,
  evaluateIntelGate,
  formatMoney,
  getAdjacentPhase,
  resolveChallenge,
} from "../app/lib/classroom-rules";

test("classroom phase machine advances and never escapes its bounds", () => {
  assert.equal(getAdjacentPhase("lobby", "previous"), "lobby");
  assert.equal(getAdjacentPhase("lobby", "next"), "identity");
  assert.equal(getAdjacentPhase("challenge-one", "next"), "challenge-two");
  assert.equal(getAdjacentPhase("completed", "next"), "completed");
  assert.equal(getAdjacentPhase("completed", "previous"), "debrief");
});

test("intel gate names every missing learning artifact and passes only with sourced evidence", () => {
  const definition = {
    requiredSourceBackedEvidence: 2,
    requireUserOrPerson: true,
    requireSceneLoss: true,
    requireConstraint: true,
    requireContradictionOrGap: true,
    requireLeadSupportLink: true,
  } as const;

  const incomplete = evaluateIntelGate(definition, {
    nodes: [
      {
        id: "node-1",
        kind: "user",
        title: "网页查找者",
        explanation: "需要在大量页面中找到答案",
        sourceCardIds: ["card-1"],
        publishedByMemberId: "member-a",
      },
    ],
    edges: [],
    hasSceneLoss: false,
    hasExplicitConstraint: false,
    hasContradictionOrGap: false,
    hasLeadSupportLink: false,
  });

  assert.equal(incomplete.passed, false);
  assert.equal(incomplete.sourceBackedEvidenceCount, 1);
  assert.deepEqual(incomplete.missing, ["至少2条有来源证据", "场景中的具体损失", "一项明确约束", "一个矛盾或证据缺口", "一条主导—支撑关系"]);

  const complete = evaluateIntelGate(definition, {
    nodes: [
      {
        id: "node-1",
        kind: "user",
        title: "网页查找者",
        explanation: "需要在大量页面中找到答案",
        sourceCardIds: ["card-1"],
        publishedByMemberId: "member-a",
      },
      {
        id: "node-2",
        kind: "evidence",
        title: "网页规模",
        explanation: "索引规模正在快速增长",
        sourceCardIds: ["card-2"],
        publishedByMemberId: "member-b",
      },
    ],
    edges: [
      {
        id: "edge-1",
        fromNodeId: "node-2",
        toNodeId: "node-1",
        kind: "limits",
        explanation: "规模让人工目录无法跟上",
        createdByMemberId: "member-c",
      },
    ],
    hasSceneLoss: true,
    hasExplicitConstraint: true,
    hasContradictionOrGap: true,
    hasLeadSupportLink: true,
  });

  assert.deepEqual(complete, { passed: true, missing: [], sourceBackedEvidenceCount: 2 });
});

test("challenge resolution uses public rubric and never lets failure stop the story", () => {
  assert.deepEqual(resolveChallenge(40, { evidence: 1, logic: 1, execution: 1, collaboration: 1 }), {
    score: 4,
    outcome: "full-success",
    incomeTenths: 60,
    insight: 0,
    requiresConsequence: false,
  });
  assert.equal(resolveChallenge(40, { evidence: 1, logic: 1, execution: 1, collaboration: 0 }).incomeTenths, 40);
  assert.deepEqual(resolveChallenge(20, { evidence: 1, logic: 1, execution: 0, collaboration: 0 }), {
    score: 2,
    outcome: "costly-success",
    incomeTenths: 10,
    insight: 0,
    requiresConsequence: true,
  });
  assert.deepEqual(resolveChallenge(20, { evidence: 1, logic: 0, execution: 0, collaboration: 0 }), {
    score: 1,
    outcome: "learning-failure",
    incomeTenths: 0,
    insight: 1,
    requiresConsequence: true,
  });
});

test("reputation clamps every dimension, caps at 12 and unlocks without spending", () => {
  const result = calculateReputation(
    { evidence: 9, modeling: 2, delivery: 3, support: 9, iteration: 2, responsibility: 4 },
    8,
  );
  assert.deepEqual(result.normalized, {
    evidence: 2,
    modeling: 2,
    delivery: 3,
    support: 2,
    iteration: 2,
    responsibility: 1,
  });
  assert.equal(result.total, 12);
  assert.equal(result.cumulative, 20);
  assert.deepEqual(result.unlockIds, ["source-inquiry", "cross-team-exchange", "role-specialist"]);
});

test("profit distribution conserves money and combines equal, delivery and collaboration shares", () => {
  const result = calculateProfitDistribution({
    availableProfitTenths: 100,
    distributionPercent: 40,
    members: [
      { memberId: "a", eligible: true, roleDeliveryScore: 3 },
      { memberId: "b", eligible: true, roleDeliveryScore: 2 },
      { memberId: "c", eligible: true, roleDeliveryScore: 1 },
      { memberId: "d", eligible: true, roleDeliveryScore: 0 },
    ],
    gratitudeVotes: [
      { fromMemberId: "a", toMemberId: "b", reason: "补充了用户证据" },
      { fromMemberId: "b", toMemberId: "a", reason: "把指标变成可测试条件" },
      { fromMemberId: "c", toMemberId: "b", reason: "协助完成原型" },
      { fromMemberId: "d", toMemberId: "b", reason: "发现了停止条件" },
      { fromMemberId: "a", toMemberId: "a", reason: "给自己" },
    ],
  });

  assert.equal(result.poolTenths, 40);
  assert.equal(result.retainedTenths, 60);
  assert.deepEqual(result.payoutsTenths, { a: 13, b: 15, c: 7, d: 5 });
  assert.equal(Object.values(result.payoutsTenths).reduce((sum, value) => sum + value, 0), result.poolTenths);
  assert.equal(result.invalidVotes.length, 1);
});

test("no eligible member means no distribution and no negative or non-finite money", () => {
  assert.deepEqual(
    calculateProfitDistribution({
      availableProfitTenths: 30,
      distributionPercent: 40,
      members: [{ memberId: "a", eligible: false, roleDeliveryScore: 3 }],
      gratitudeVotes: [],
    }),
    { poolTenths: 0, retainedTenths: 30, payoutsTenths: {}, invalidVotes: [] },
  );
  assert.throws(
    () =>
      calculateProfitDistribution({
        availableProfitTenths: -1,
        distributionPercent: 20,
        members: [],
        gratitudeVotes: [],
      }),
    /non-negative integer/,
  );
  assert.equal(formatMoney(84), "8.4 C");
  assert.equal(formatMoney(80), "8 C");
});
