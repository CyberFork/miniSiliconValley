import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrations = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort();
const beforeT087 = migrations
  .filter((name) => name < "0006_")
  .map((name) => readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"))
  .join("\n");
const t087 = readFileSync(new URL("../drizzle/0006_account_switching_and_admin_dm_delegation.sql", import.meta.url), "utf8");
const replayableBackfill = t087
  .split(/-->\s*statement-breakpoint/)
  .filter((statement) => statement.includes("INSERT OR IGNORE INTO `classroom_admin_dm_grants`"))
  .join("\n");

test("T-087 backfill creates one Primary, converts legacy peers and never resurrects a revoked grant", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(beforeT087);
    db.exec(`
      INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES
        ('owner-a', 'Owner A', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
        ('delegate-a', 'Delegate A', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
        ('owner-b', 'Owner B', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z');
      INSERT INTO course_versions
        (course_id, revision, schema_version, digest, package_json, created_at, created_by)
      VALUES ('course', 0, 1, 'course-digest', '{}', '2026-09-01T00:00:00Z', 'owner-a');
      INSERT INTO rooms
        (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version,
         paused, player_timeline_frozen, history_revealed, created_at, updated_at)
      VALUES
        ('room-a', 'ROOM-A', 'Room A', 'course', 'B01', 'lobby', 'open', 'owner-a', 1, 0, 0, 0, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
        ('room-b', 'ROOM-B', 'Room B', 'course', 'B01', 'lobby', 'open', 'owner-b', 1, 0, 0, 0, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z');
      INSERT INTO classroom_instances
        (room_id, environment, learner_count, lifecycle, state_machine_version, course_id,
         course_revision, course_digest, factory_key, reset_generation, created_at, updated_at)
      VALUES
        ('room-a', 'test', 4, 'ready', 1, 'course', 0, 'digest-a', 'factory-a', 0, '2026-09-02T00:00:00Z', '2026-09-02T00:00:00Z'),
        ('room-b', 'production', 4, 'ready', 1, 'course', 0, 'digest-b', 'factory-b', 0, '2026-09-03T00:00:00Z', '2026-09-03T00:00:00Z');
      INSERT INTO classroom_permissions
        (id, room_id, profile_id, permission, granted_by_profile_id, created_at)
      VALUES
        ('legacy-owner-a', 'room-a', 'owner-a', 'admin-dm', 'owner-a', '2026-09-02T00:00:00Z'),
        ('legacy-delegate-a', 'room-a', 'delegate-a', 'admin-dm', 'owner-a', '2026-09-02T01:00:00Z');
    `);

    db.exec(t087);
    const rows = db.prepare(`
      SELECT room_id AS roomId, profile_id AS profileId, delegation_mode AS mode,
             can_delegate AS canDelegate, revoked_at AS revokedAt
      FROM classroom_admin_dm_grants ORDER BY room_id, delegation_mode DESC, profile_id
    `).all() as Array<{ roomId: string; profileId: string; mode: string; canDelegate: number; revokedAt: string | null }>;
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { roomId: "room-a", profileId: "owner-a", mode: "primary", canDelegate: 1, revokedAt: null },
      { roomId: "room-a", profileId: "delegate-a", mode: "delegated", canDelegate: 0, revokedAt: null },
      { roomId: "room-b", profileId: "owner-b", mode: "primary", canDelegate: 1, revokedAt: null },
    ]);
    assert.throws(() => db.exec(`
      INSERT INTO classroom_admin_dm_grants
        (id, room_id, profile_id, delegation_mode, can_delegate, granted_by_profile_id,
         granted_at, revoked_by_profile_id, revoked_at, version)
      VALUES ('second-primary', 'room-a', 'delegate-a', 'primary', 1, 'owner-a',
              '2026-09-03T00:00:00Z', NULL, NULL, 1)
    `), /UNIQUE constraint failed/, "the database must reject a second active Primary for one Classroom");

    db.exec(`UPDATE classroom_admin_dm_grants SET revoked_at = '2026-09-04T00:00:00Z' WHERE room_id = 'room-a' AND profile_id = 'delegate-a'`);
    db.exec(replayableBackfill);
    const afterReplay = db.prepare(`
      SELECT COUNT(*) AS count,
             MAX(CASE WHEN profile_id = 'delegate-a' THEN revoked_at END) AS delegatedRevokedAt,
             SUM(CASE WHEN delegation_mode = 'primary' AND can_delegate = 1 AND revoked_at IS NULL THEN 1 ELSE 0 END) AS activePrimaries
      FROM classroom_admin_dm_grants
    `).get() as { count: number; delegatedRevokedAt: string; activePrimaries: number };
    assert.deepEqual({ ...afterReplay }, {
      count: 3,
      delegatedRevokedAt: "2026-09-04T00:00:00Z",
      activePrimaries: 2,
    });
  } finally {
    db.close();
  }
});
