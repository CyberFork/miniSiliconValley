import assert from "node:assert/strict";
import test from "node:test";

import { historyCatalog } from "../app/data/history";
import { missions } from "../app/data/missions";
import { validateCatalog, validateMissions } from "../app/lib/validate";

test("validateCatalog: no errors/warnings with expected exact/minimum counts", () => {
  const report = validateCatalog(historyCatalog);

  assert.equal(report.errors.length, 0, `catalog errors: ${report.errors.join("; ")}`);
  assert.equal(report.warnings.length, 0, `catalog warnings: ${report.warnings.join("; ")}`);

  assert.deepEqual(report.counts, {
    era: 8,
    place: 34,
    organization: 74,
    person: 51,
    technology: 75,
    source: 66,
    event: 203,
  });

  assert.ok(historyCatalog.eras.length >= 8);
  assert.ok(historyCatalog.places.length >= 15);
  assert.ok(historyCatalog.organizations.length >= 45);
  assert.ok(historyCatalog.people.length >= 30);
  assert.ok(historyCatalog.technologies.length >= 35);
  assert.ok(historyCatalog.events.length >= 120);

  assert.ok(historyCatalog.sources.every((source) => source.url.startsWith("https://")), "所有来源均为 HTTPS");
  assert.ok(historyCatalog.events.every((event) => event.sourceIds.length > 0), "每个事件至少有一条来源");
});

test("validateMissions: no errors/warnings with exact mission count", () => {
  const report = validateMissions(historyCatalog, missions);

  assert.equal(report.counts.mission, 8);
  assert.equal(report.errors.length, 0, `mission errors: ${report.errors.join("; ")}`);
  assert.equal(report.warnings.length, 0, `mission warnings: ${report.warnings.join("; ")}`);
});

test("validateMissions / historyCatalog: exact 8 mission↔event mappings", () => {
  const missionEvents = missions.map((mission) => ({ missionId: mission.id, eventId: mission.eventId }));
  const eventByMission = new Map(missionEvents.map(({ missionId, eventId }) => [missionId, eventId]));
  const eventByEvent = new Map(missionEvents.map(({ missionId, eventId }) => [eventId, missionId]));

  assert.equal(missions.length, 8);
  assert.equal(eventByMission.size, 8);
  assert.equal(eventByEvent.size, 8);

  for (const { missionId, eventId } of missionEvents) {
    const event = historyCatalog.events.find((item) => item.id === eventId);
    assert.ok(event, `${missionId} -> ${eventId} must exist`);
    assert.equal(event?.missionId, missionId, `${eventId} should map back to ${missionId}`);
  }

  const reverse = historyCatalog.events
    .filter((event) => event.missionId)
    .map((event) => ({ missionId: event.missionId!, eventId: event.id }));

  assert.equal(reverse.length, 8);
  for (const { missionId, eventId } of reverse) {
    assert.equal(eventByMission.get(missionId), eventId);
  }
});
