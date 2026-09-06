import {
  CLASSROOM_PHASES,
  type ChallengeResolution,
  type ChallengeRubric,
  type ClassroomPhase,
  type GratitudeVote,
  type IntelGateDefinition,
  type IntelGateResult,
  type IntelGateState,
  type ProfitDistributionInput,
  type ProfitDistributionResult,
  type ReputationResult,
  type ReputationScores,
  type ReputationUnlock,
} from "./classroom-model";

export const PERSONAL_SHOP = [
  { id: "support-ticket", name: "支援券", priceTenths: 10, description: "送给队友一次额外准备行动；不直接转现金。", prerequisiteRp: 0 },
  { id: "mentor-inquiry", name: "导师问询券", priceTenths: 20, description: "向DM提出一个方向型问题，不能询问答案。", prerequisiteRp: 5 },
  { id: "research-pass", name: "调研通行证", priceTenths: 30, description: "解锁一条可选深度信息支线。", prerequisiteRp: 12 },
  { id: "role-tool-license", name: "角色工具许可", priceTenths: 20, description: "本章一次，增强已解锁的角色技能。", prerequisiteRp: 20 },
  { id: "personal-training", name: "个人训练卡", priceTenths: 30, description: "完成课后训练后，为下章增加一个行动选项。", prerequisiteRp: 20 },
] as const;

export const REPUTATION_UNLOCKS: ReputationUnlock[] = [
  { id: "source-inquiry", threshold: 5, name: "可信讲述者", ability: "每章一次，请DM补充某张卡的来源说明。" },
  { id: "cross-team-exchange", threshold: 12, name: "连接者", ability: "每章一次，发起跨队公开证据交换。" },
  { id: "role-specialist", threshold: 20, name: "角色专家", ability: "装备一张P／D／M／O角色技能卡。" },
  { id: "peer-coach", threshold: 32, name: "同行教练", ability: "每章一次，为队友提供有依据的重投支持。" },
  { id: "worldline-curator", threshold: 48, name: "世界线策展人", ability: "解锁进阶史料支线或主持一次复盘。" },
];

const REPUTATION_LIMITS: ReputationScores = {
  evidence: 2,
  modeling: 2,
  delivery: 3,
  support: 2,
  iteration: 2,
  responsibility: 1,
};

export function getAdjacentPhase(phase: ClassroomPhase, direction: "next" | "previous"): ClassroomPhase {
  const index = CLASSROOM_PHASES.indexOf(phase);
  const offset = direction === "next" ? 1 : -1;
  const nextIndex = Math.min(CLASSROOM_PHASES.length - 1, Math.max(0, index + offset));
  return CLASSROOM_PHASES[nextIndex];
}

export function evaluateIntelGate(definition: IntelGateDefinition, state: IntelGateState): IntelGateResult {
  const sourceBackedEvidenceCount = state.nodes.filter((node) => node.sourceCardIds.length > 0).length;
  const hasUserOrPerson = state.nodes.some((node) => node.kind === "user" || node.kind === "person");
  const hasConstraint = state.hasExplicitConstraint || state.nodes.some((node) => node.kind === "constraint");
  const hasContradiction = state.hasContradictionOrGap || state.edges.some((edge) => edge.kind === "contradicts");
  const missing: string[] = [];

  if (sourceBackedEvidenceCount < definition.requiredSourceBackedEvidence) {
    missing.push(`至少${definition.requiredSourceBackedEvidence}条有来源证据`);
  }
  if (definition.requireUserOrPerson && !hasUserOrPerson) missing.push("一个明确用户或人物");
  if (definition.requireSceneLoss && !state.hasSceneLoss) missing.push("场景中的具体损失");
  if (definition.requireConstraint && !hasConstraint) missing.push("一项明确约束");
  if (definition.requireContradictionOrGap && !hasContradiction) missing.push("一个矛盾或证据缺口");
  if (definition.requireLeadSupportLink && !state.hasLeadSupportLink) missing.push("一条主导—支撑关系");

  return { passed: missing.length === 0, missing, sourceBackedEvidenceCount };
}

export function resolveChallenge(baseIncomeTenths: number, rubric: ChallengeRubric): ChallengeResolution {
  assertNonNegativeInteger(baseIncomeTenths, "baseIncomeTenths");
  const score = rubric.evidence + rubric.logic + rubric.execution + rubric.collaboration;

  if (score === 4) {
    return {
      score,
      outcome: "full-success",
      incomeTenths: baseIncomeTenths + 20,
      insight: 0,
      requiresConsequence: false,
    };
  }
  if (score === 3) {
    return {
      score,
      outcome: "success",
      incomeTenths: baseIncomeTenths,
      insight: 0,
      requiresConsequence: false,
    };
  }
  if (score === 2) {
    return {
      score,
      outcome: "costly-success",
      incomeTenths: Math.max(0, baseIncomeTenths - 10),
      insight: 0,
      requiresConsequence: true,
    };
  }
  return {
    score,
    outcome: "learning-failure",
    incomeTenths: 0,
    insight: 1,
    requiresConsequence: true,
  };
}

export function calculateReputation(scores: ReputationScores, existingReputation: number): ReputationResult {
  assertNonNegativeInteger(existingReputation, "existingReputation");
  const normalized = Object.fromEntries(
    (Object.keys(REPUTATION_LIMITS) as Array<keyof ReputationScores>).map((dimension) => [
      dimension,
      clampInteger(scores[dimension], 0, REPUTATION_LIMITS[dimension]),
    ]),
  ) as unknown as ReputationScores;
  const total = Object.values(normalized).reduce((sum, points) => sum + points, 0);
  const cumulative = existingReputation + total;

  return {
    total,
    cumulative,
    normalized,
    unlockIds: REPUTATION_UNLOCKS.filter((unlock) => cumulative >= unlock.threshold).map((unlock) => unlock.id),
  };
}

export function calculateProfitDistribution(input: ProfitDistributionInput): ProfitDistributionResult {
  assertNonNegativeInteger(input.availableProfitTenths, "availableProfitTenths");
  const eligibleMembers = input.members.filter((member) => member.eligible);
  const payoutsTenths: Record<string, number> = {};
  for (const member of eligibleMembers) payoutsTenths[member.memberId] = 0;

  const { validVotes, invalidVotes } = validateGratitudeVotes(input.gratitudeVotes, eligibleMembers.map(({ memberId }) => memberId));
  if (eligibleMembers.length === 0 || input.distributionPercent === 0) {
    return {
      poolTenths: 0,
      retainedTenths: input.availableProfitTenths,
      payoutsTenths,
      invalidVotes,
    };
  }

  const poolTenths = Math.floor((input.availableProfitTenths * input.distributionPercent) / 100);
  const equalBucket = Math.floor(poolTenths * 0.5);
  const deliveryBucket = Math.floor(poolTenths * 0.3);
  const collaborationBucket = poolTenths - equalBucket - deliveryBucket;
  const ids = eligibleMembers.map(({ memberId }) => memberId);

  addAllocations(payoutsTenths, allocateByWeights(equalBucket, ids.map(() => 1), ids));
  addAllocations(
    payoutsTenths,
    allocateByWeights(
      deliveryBucket,
      eligibleMembers.map(({ roleDeliveryScore }) => clampInteger(roleDeliveryScore, 0, 3)),
      ids,
    ),
  );
  const voteCounts = new Map(ids.map((id) => [id, 0]));
  for (const vote of validVotes) voteCounts.set(vote.toMemberId, (voteCounts.get(vote.toMemberId) ?? 0) + 1);
  addAllocations(
    payoutsTenths,
    allocateByWeights(
      collaborationBucket,
      ids.map((id) => voteCounts.get(id) ?? 0),
      ids,
    ),
  );

  const distributed = Object.values(payoutsTenths).reduce((sum, value) => sum + value, 0);
  if (distributed !== poolTenths) throw new Error("distribution invariant violated");

  return {
    poolTenths,
    retainedTenths: input.availableProfitTenths - poolTenths,
    payoutsTenths,
    invalidVotes,
  };
}

export function formatMoney(amountTenths: number): string {
  assertNonNegativeInteger(amountTenths, "amountTenths");
  const whole = Math.floor(amountTenths / 10);
  const decimal = amountTenths % 10;
  return decimal === 0 ? `${whole} C` : `${whole}.${decimal} C`;
}

function validateGratitudeVotes(votes: GratitudeVote[], eligibleIds: string[]) {
  const eligible = new Set(eligibleIds);
  const usedSenders = new Set<string>();
  const validVotes: GratitudeVote[] = [];
  const invalidVotes: GratitudeVote[] = [];

  for (const vote of votes) {
    const valid =
      eligible.has(vote.fromMemberId) &&
      eligible.has(vote.toMemberId) &&
      vote.fromMemberId !== vote.toMemberId &&
      vote.reason.trim().length > 0 &&
      !usedSenders.has(vote.fromMemberId);
    if (!valid) {
      invalidVotes.push(vote);
      continue;
    }
    usedSenders.add(vote.fromMemberId);
    validVotes.push(vote);
  }
  return { validVotes, invalidVotes };
}

function allocateByWeights(total: number, rawWeights: number[], ids: string[]): Record<string, number> {
  const allocation = Object.fromEntries(ids.map((id) => [id, 0])) as Record<string, number>;
  if (total === 0 || ids.length === 0) return allocation;

  const weights = rawWeights.map((weight) => Math.max(0, Number.isFinite(weight) ? weight : 0));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const effectiveWeights = weightTotal === 0 ? ids.map(() => 1) : weights;
  const effectiveTotal = effectiveWeights.reduce((sum, weight) => sum + weight, 0);
  const rows = ids.map((id, index) => {
    const exact = (total * effectiveWeights[index]) / effectiveTotal;
    const base = Math.floor(exact);
    return { id, base, remainder: exact - base, index };
  });
  let remaining = total - rows.reduce((sum, row) => sum + row.base, 0);
  rows.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const row of rows) {
    allocation[row.id] = row.base + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining -= 1;
  }
  return allocation;
}

function addAllocations(target: Record<string, number>, addition: Record<string, number>) {
  for (const [id, amount] of Object.entries(addition)) target[id] = (target[id] ?? 0) + amount;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer`);
}
