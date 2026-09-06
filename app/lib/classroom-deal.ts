export type ClassroomDealAssignment = {
  memberId: string;
  identityId: string;
  cardIds: string[];
};

export type ClassroomShuffle = <T>(values: readonly T[]) => T[];

const UINT32_RANGE = 0x1_0000_0000;

/**
 * Fisher-Yates shuffle backed by Web Crypto.
 *
 * Rejection sampling avoids modulo bias, so every remaining position has the
 * same chance of being selected. Cloudflare Workers and supported Node
 * runtimes both provide `crypto.getRandomValues`.
 */
export const secureShuffle: ClassroomShuffle = <T>(values: readonly T[]): T[] => {
  const shuffled = [...values];
  const sample = new Uint32Array(1);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const choices = index + 1;
    const unbiasedCeiling = Math.floor(UINT32_RANGE / choices) * choices;
    let randomValue = 0;
    do {
      crypto.getRandomValues(sample);
      randomValue = sample[0];
    } while (randomValue >= unbiasedCeiling);

    const swapIndex = randomValue % choices;
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

/**
 * Build one team's deal plan.
 *
 * Identities and information cards are shuffled in separate calls. Cards are
 * then dealt around the table from the complete chapter deck; a card's
 * authoring `holderIdentityId` is deliberately irrelevant to runtime dealing.
 */
export function buildIndependentRandomDealPlan(
  memberIds: readonly string[],
  identityIds: readonly string[],
  cardIds: readonly string[],
  shuffle: ClassroomShuffle = secureShuffle,
): ClassroomDealAssignment[] {
  assertDistinctNonEmpty(memberIds, "memberIds");
  assertDistinctNonEmpty(identityIds, "identityIds");
  assertDistinctNonEmpty(cardIds, "cardIds");

  if (identityIds.length !== memberIds.length) {
    throw new Error("每支队伍的案例身份数量必须与学员人数相同。");
  }
  if (cardIds.length % memberIds.length !== 0) {
    throw new Error("本章手牌总数必须能平均分给所有学员。");
  }

  const randomizedIdentities = shuffle(identityIds);
  const randomizedCards = shuffle(cardIds);
  assertPermutation(randomizedIdentities, identityIds, "身份随机结果");
  assertPermutation(randomizedCards, cardIds, "手牌随机结果");

  const plan = memberIds.map((memberId, index) => ({
    memberId,
    identityId: randomizedIdentities[index],
    cardIds: [] as string[],
  }));

  randomizedCards.forEach((cardId, index) => {
    plan[index % plan.length].cardIds.push(cardId);
  });

  const expectedCardsPerLearner = cardIds.length / memberIds.length;
  if (plan.some((assignment) => assignment.cardIds.length !== expectedCardsPerLearner)) {
    throw new Error("随机发牌没有平均覆盖所有学员。");
  }

  return plan;
}

function assertDistinctNonEmpty(values: readonly string[], label: string): void {
  if (values.length === 0) throw new Error(`${label}不能为空。`);
  if (values.some((value) => value.trim().length === 0)) throw new Error(`${label}不能包含空ID。`);
  if (new Set(values).size !== values.length) throw new Error(`${label}不能包含重复ID。`);
}

function assertPermutation(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length) throw new Error(`${label}丢失了项目。`);
  const expectedSet = new Set(expected);
  if (new Set(actual).size !== actual.length || actual.some((value) => !expectedSet.has(value))) {
    throw new Error(`${label}不是原集合的完整排列。`);
  }
}
