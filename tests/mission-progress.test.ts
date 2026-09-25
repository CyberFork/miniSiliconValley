import assert from "node:assert/strict";
import test from "node:test";

import { missions } from "../app/data/missions";
import {
  countUnlockedChoices,
  evidenceTitles,
  missingEvidenceIds,
} from "../app/lib/mission-progress";

test("decision guidance names missing evidence and unlocks choices deterministically", () => {
  const mission = missions.find(({ id }) => id === "m4-web-browser");
  assert.ok(mission);

  const selected = ["m4-e1", "m4-e3"];
  assert.equal(countUnlockedChoices(mission.choices, selected), 0);
  assert.deepEqual(missingEvidenceIds(mission.choices[0], selected), ["m4-e4"]);
  assert.deepEqual(evidenceTitles(mission.evidence, ["m4-e4"]), ["快发版本有利于窗口"]);

  assert.equal(countUnlockedChoices(mission.choices, [...selected, "m4-e4"]), 1);
  assert.equal(countUnlockedChoices(mission.choices, mission.evidence.map(({ id }) => id)), 3);
  assert.deepEqual(
    evidenceTitles(mission.evidence, ["m4-e1", "legacy-unknown-id"]),
    ["新界面打开了新用户"],
    "界面不应把内部或旧版证据 ID 暴露给学员",
  );
});
