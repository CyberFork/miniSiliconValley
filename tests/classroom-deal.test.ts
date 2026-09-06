import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildIndependentRandomDealPlan,
  secureShuffle,
  type ClassroomShuffle,
} from "../app/lib/classroom-deal";

test("identities and the complete card deck are shuffled independently before an even deal", () => {
  let shuffleCalls = 0;
  const deterministicShuffle: ClassroomShuffle = <T>(values: readonly T[]): T[] => {
    shuffleCalls += 1;
    if (shuffleCalls === 1) return [...values.slice(1), values[0]];
    return [...values].reverse();
  };

  const members = ["member-1", "member-2", "member-3", "member-4"];
  const identities = ["identity-1", "identity-2", "identity-3", "identity-4"];
  const cards = Array.from({ length: 12 }, (_, index) => `card-${index + 1}`);
  const plan = buildIndependentRandomDealPlan(members, identities, cards, deterministicShuffle);

  assert.equal(shuffleCalls, 2);
  assert.deepEqual(plan.map(({ identityId }) => identityId), ["identity-2", "identity-3", "identity-4", "identity-1"]);
  assert.deepEqual(plan.map(({ cardIds }) => cardIds), [
    ["card-12", "card-8", "card-4"],
    ["card-11", "card-7", "card-3"],
    ["card-10", "card-6", "card-2"],
    ["card-9", "card-5", "card-1"],
  ]);
  assert.deepEqual(plan.flatMap(({ cardIds }) => cardIds).sort(), [...cards].sort());
  assert.equal(new Set(plan.flatMap(({ cardIds }) => cardIds)).size, 12);
});

test("deal planning rejects duplicate IDs, uneven decks and invalid shuffle output", () => {
  assert.throws(
    () => buildIndependentRandomDealPlan(["m1", "m1"], ["i1", "i2"], ["c1", "c2"]),
    /重复ID/,
  );
  assert.throws(
    () => buildIndependentRandomDealPlan(["m1", "m2"], ["i1", "i2"], ["c1", "c2", "c3"]),
    /平均分/,
  );
  const brokenShuffle: ClassroomShuffle = <T>(values: readonly T[]): T[] => values.map(() => values[0]);
  assert.throws(
    () => buildIndependentRandomDealPlan(["m1", "m2"], ["i1", "i2"], ["c1", "c2"], brokenShuffle),
    /完整排列/,
  );
});

test("secure shuffle always returns a complete copy without mutating the source deck", () => {
  const source = Array.from({ length: 60 }, (_, index) => `card-${index}`);
  for (let run = 0; run < 20; run += 1) {
    const shuffled = secureShuffle(source);
    assert.notStrictEqual(shuffled, source);
    assert.deepEqual([...shuffled].sort(), [...source].sort());
  }
  assert.deepEqual(source, Array.from({ length: 60 }, (_, index) => `card-${index}`));
});

test("classroom store never binds runtime card ownership to the authored identity", async () => {
  const source = await readFile(new URL("../app/lib/classroom-store.ts", import.meta.url), "utf8");
  assert.match(source, /buildIndependentRandomDealPlan/);
  assert.match(source, /identity-and-cards-independent-random/);
  assert.doesNotMatch(source, /IDENTITY_CARD_MISMATCH/);
  assert.doesNotMatch(source, /holderIdentityId\s*===/);
});
