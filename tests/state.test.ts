import assert from "node:assert/strict";
import test from "node:test";

import type { MissionChoice, MissionRecord, ResourceKey } from "../app/lib/model";
import { createInitialState, applyChoice, parseState, recordEventVisit, serializeState } from "../app/lib/state";
import { historyCatalog } from "../app/data/history";
import { missions } from "../app/data/missions";
import { validateMissions } from "../app/lib/validate";

function readOnlyStringMap() {
  return {
    evidence: 2,
    trust: 2,
    runway: 2,
    craft: 2,
  } satisfies Record<ResourceKey, number>;
}

test("opening a historical event records the visit without moving the timeline", () => {
  const state = { ...createInitialState(), currentYear: 2026 };

  const visited = recordEventVisit(state, "evt-1939-hp-founded");
  const revisited = recordEventVisit(visited, "evt-1939-hp-founded");

  assert.equal(visited.currentYear, 2026, "打开旧事件详情不应把时间轴跳回事件年份");
  assert.deepEqual(visited.visitedEventIds, ["evt-1939-hp-founded"]);
  assert.deepEqual(revisited.visitedEventIds, ["evt-1939-hp-founded"], "重复打开不应重复记录节点");
  assert.equal(state.visitedEventIds.length, 0, "访问事件不应修改原状态");
});


test("original data set should not be mutated by player-state operations", () => {
  const missionCatalog = structuredClone(historyCatalog);
  const mission = structuredClone(missions[0]);
  const base = createInitialState();

  const played = applyChoice(
    base,
    mission,
    mission.choices[0],
    mission.evidence.map((item) => item.id),
  );

  assert.deepEqual(historyCatalog, missionCatalog);
  assert.deepEqual(missions, [mission, ...missions.slice(1)]);
  assert.ok(played.results.length === 1);
  assert.equal(played.currentYear, mission.year);
});

test("applyChoice replay should replace previous result for same mission", () => {
  const mission = missions[0];
  const firstChoice = mission.choices[0];
  const secondChoice = mission.choices[1];
  let state = createInitialState();

  state = applyChoice(state, mission, firstChoice, [mission.evidence[0].id]);
  assert.equal(state.results.length, 1);
  assert.equal(state.results[0].choiceId, firstChoice.id);
  assert.deepEqual(state.results[0].delta, firstChoice.delta);

  state = applyChoice(state, mission, secondChoice, [mission.evidence[1].id]);
  assert.equal(state.results.length, 1, "重玩同一关卡时结果数量应保持 1，覆盖旧结果");
  assert.equal(state.results[0].missionId, mission.id);
  assert.equal(state.results[0].choiceId, secondChoice.id);
  assert.deepEqual(state.results[0].delta, secondChoice.delta);
  assert.deepEqual(state.results[0].evidenceIds, [mission.evidence[1].id]);

  const expected = readOnlyStringMap();
  (Object.keys(expected) as ResourceKey[]).forEach((key) => {
    expected[key] = Math.max(0, Math.min(9, (expected[key] + (secondChoice.delta[key] ?? 0))));
  });
  assert.deepEqual(state.resources, expected);
});

test("resource clamp limits to [0, 9] with applyChoice replay", () => {
  const mission = {
    id: "test-replay-mission",
    eventId: "evt-1939-hp-founded",
    year: 1939,
  } as MissionRecord;

  const hugeChoice = {
    id: "huge",
    delta: { trust: 50, runway: -50, evidence: 40, craft: 30 },
  } as MissionChoice;

  const state = applyChoice(createInitialState(), mission, hugeChoice, []);
  assert.deepEqual(state.resources, {
    evidence: 9,
    trust: 9,
    runway: 0,
    craft: 9,
  });
});

test("serializeState + parseState should round-trip and sanitize invalid data", () => {
  const validated = validateMissions(historyCatalog, missions);
  assert.equal(validated.errors.length, 0);

  const mission = missions[1];
  const choice = mission.choices[0];
  const baseline = applyChoice(createInitialState(), mission, choice, [mission.evidence[0].id]);

  const raw = serializeState(baseline);
  const reparsed = parseState(raw);
  assert.deepEqual(reparsed.currentYear, baseline.currentYear);
  assert.equal(reparsed.results.length, 1);
  assert.equal(reparsed.results[0].missionId, mission.id);
  assert.equal(reparsed.results[0].choiceId, choice.id);
});

test("parseState rejects invalid schema and dangerous keys", () => {
  const badSchema = JSON.stringify({ schemaVersion: 999, currentYear: 1939, results: [] });
  assert.throws(() => parseState(badSchema), /不支持的存档版本/);

  const dangerous = JSON.stringify({
    schemaVersion: 1,
    currentYear: 1939,
    results: [],
    prototype: { polluted: true },
  });
  assert.throws(() => parseState(dangerous), /存档包含不允许的字段/);

  const nestedDangerous = '{"schemaVersion":1,"results":[{"missionId":"m1","choiceId":"c1","delta":{},"__proto__":{"polluted":true}}]}';
  assert.throws(() => parseState(nestedDangerous), /存档包含不允许的字段/);
});

test("parseState sanitizes invalid category and trims untrusted arrays/lengths", () => {
  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    currentYear: 3000,
    query: "x".repeat(220),
    selectedCategory: "invalid",
    visitedEventIds: Array.from({ length: 505 }, (_, index) => `ev-${index}-` + "a".repeat(120)),
    activeMissionId: "m-active-" + "a".repeat(90),
    results: [
      {
        missionId: missions[0].id,
        choiceId: missions[0].choices[0].id,
        evidenceIds: Array.from({ length: 20 }, (_, index) => `evidence-${index}`),
        delta: { trust: 4, runway: -4, extra: 99, evidence: 2, craft: -12, foo: "bar" },
        completedAt: "2026-01-01T00:00:00.000Z",
      } as Record<string, unknown>,
      {
        missionId: missions[0].id,
        choiceId: missions[0].choices[1].id,
        evidenceIds: [1, 2, 3],
        delta: { trust: 8, runway: 8 },
      },
    ],
  };

  const parsed = parseState(JSON.stringify(payload));

  assert.equal(parsed.currentYear, 2026);
  assert.equal(parsed.selectedCategory, "all");
  assert.equal(parsed.query.length, 120);
  assert.equal(parsed.activeMissionId, "m-active-" + "a".repeat(71));
  assert.equal(parsed.visitedEventIds.length, 500);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].missionId, missions[0].id);
  assert.equal(parsed.results[0].choiceId, missions[0].choices[1].id);
  assert.equal(parsed.results[0].evidenceIds.length, 0);
  assert.deepEqual(parsed.results[0].delta, {
    trust: 8,
    runway: 8,
  });
  assert.deepEqual(parsed.resources, {
    evidence: 2,
    trust: Math.max(0, Math.min(9, 2 + 8)),
    runway: Math.min(9, 2 + 8),
    craft: 2,
  });
});
