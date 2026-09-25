import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrations = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort();
const beforeT086Script = migrations
  .filter((name) => name < "0007_")
  .map((name) => readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"))
  .join("\n");
const t086Script = readFileSync(new URL("../drizzle/0007_decoupled_script_progress.sql", import.meta.url), "utf8");
const replayableBackfill = t086Script
  .split(/-->\s*statement-breakpoint/)
  .find((statement) => statement.includes("INSERT OR IGNORE INTO `classroom_script_progress`"))!;

test("T-086 backfills the unlock frontier without touching activity or economy records", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(beforeT086Script);
    // The fixture intentionally records only the rows whose byte-for-byte
    // preservation matters here; its unrelated parent graph is out of scope.
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(`
      INSERT INTO profiles (id, nickname, created_at, updated_at)
      VALUES ('owner', 'Owner', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
             ('learner', 'Learner', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z');
      INSERT INTO rooms
        (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version,
         paused, player_timeline_frozen, history_revealed, created_at, updated_at)
      VALUES ('room', 'ROOM', 'Room', 'course', 'chapter', 'identity', 'active', 'owner', 1,
              0, 0, 0, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z');
      INSERT INTO classroom_instances
        (room_id, environment, learner_count, lifecycle, state_machine_version, course_id,
         course_revision, course_digest, factory_key, reset_generation, created_at, updated_at)
      VALUES ('room', 'test', 4, 'running', 1, 'course', 3, 'digest', 'factory', 0,
              '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z');
      INSERT INTO classroom_controller_states
        (room_id, state_machine_version, block_id, block_index, state, attempt, error_message,
         version, created_at, updated_at)
      VALUES ('room', 1, 'B05', 4, 'awaiting-acceptance', 2, NULL, 17,
              '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z');
      INSERT INTO classroom_block_submissions
        (id, room_id, block_id, profile_id, kind, payload_json, status, created_at, updated_at)
      VALUES ('submission', 'room', 'B03', 'learner', 'learner-work', '{"text":"saved"}',
              'submitted', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z');
      INSERT INTO classroom_wallet_balances
        (room_id, profile_id, balance_tenths, created_at, updated_at)
      VALUES ('room', 'learner', 37, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z');
      INSERT INTO reputation_entries
        (id, profile_id, room_id, chapter_id, dimension, points, evidence_object_id,
         awarded_by_member_id, reason, reversal_of, created_at)
      VALUES ('rp', 'learner', 'room', 'chapter', 'evidence', 9, 'evidence-1',
              'mentor-membership', 'kept', NULL, '2026-09-02T00:00:00Z');
      INSERT INTO ledger_accounts
        (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
      VALUES ('treasury', 'team-treasury', 'room', 'team', NULL, 123, '2026-09-01T00:00:00Z');
    `);
    db.exec("PRAGMA foreign_keys = ON");

    const before = businessSnapshot(db);
    db.exec(t086Script);

    const progress = db.prepare(`
      SELECT state_machine_version AS stateMachineVersion,
             unlocked_through_block_id AS blockId,
             unlocked_through_index AS blockIndex,
             version, created_at AS createdAt, updated_at AS updatedAt
      FROM classroom_script_progress WHERE room_id = 'room'
    `).get() as Record<string, unknown>;
    assert.deepEqual({ ...progress }, {
      stateMachineVersion: 2,
      blockId: "B05",
      blockIndex: 4,
      version: 17,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-02T00:00:00Z",
    });
    assert.equal((db.prepare("SELECT state_machine_version AS version FROM classroom_instances WHERE room_id = 'room'").get() as { version: number }).version, 2);
    assert.deepEqual(businessSnapshot(db), before, "schema migration must not rewrite submissions, RP, wallets or team funds");

    db.exec("UPDATE classroom_script_progress SET unlocked_through_block_id = 'B06', unlocked_through_index = 5, version = 18 WHERE room_id = 'room'");
    db.exec(replayableBackfill);
    const afterReplay = db.prepare("SELECT unlocked_through_block_id AS blockId, unlocked_through_index AS blockIndex, version FROM classroom_script_progress WHERE room_id = 'room'").get() as Record<string, unknown>;
    assert.deepEqual({ ...afterReplay }, { blockId: "B06", blockIndex: 5, version: 18 }, "replayed backfill must never move an existing frontier backwards");
  } finally {
    db.close();
  }
});

test("T-086 migration is additive and contains no destructive data statement", () => {
  assert.doesNotMatch(t086Script, /^\s*(?:DROP|DELETE|REPLACE)\b/im);
  assert.match(t086Script, /INSERT OR IGNORE INTO `classroom_script_progress`/);
  assert.match(t086Script, /WHERE `state_machine_version` < 2/);
});

function businessSnapshot(db: DatabaseSync) {
  return {
    submissions: db.prepare("SELECT room_id, block_id, profile_id, kind, payload_json, status FROM classroom_block_submissions ORDER BY id").all().map((row) => ({ ...row })),
    wallets: db.prepare("SELECT room_id, profile_id, balance_tenths FROM classroom_wallet_balances ORDER BY profile_id").all().map((row) => ({ ...row })),
    reputation: db.prepare("SELECT profile_id, room_id, chapter_id, dimension, points, evidence_object_id FROM reputation_entries ORDER BY id").all().map((row) => ({ ...row })),
    ledger: db.prepare("SELECT id, kind, room_id, balance_tenths FROM ledger_accounts ORDER BY id").all().map((row) => ({ ...row })),
  };
}
