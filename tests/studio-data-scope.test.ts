import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import { AuthError } from "../app/lib/auth-errors";
import { listStudioAssignableAccounts, registerUser } from "../app/lib/auth-store";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };

function database(): LocalDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item)).sort()) {
    raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  const api = {
    raw,
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; },
        async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; },
        async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; },
        async run() { return statement.execute(); },
        execute() {
          const result = raw.prepare(sql).run(...values);
          return { success: true, meta: { changes: result.changes } } as unknown as D1Result;
        },
      };
      return statement;
    },
    async batch(statements: LocalStatement[]) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return api as unknown as LocalDatabase;
}

function seedUser(db: LocalDatabase, id: string, role: "admin" | "mentor" | "learner", displayName = id): void {
  const now = "2026-09-11T00:00:00.000Z";
  db.raw.prepare(
    `INSERT INTO auth_users
     (id, username, display_name, role, status, password_hash, password_salt,
      password_iterations, password_changed_at, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', 'fixture-hash', 'fixture-salt', 1, ?, 0, ?, ?)`,
  ).run(id, id, displayName, role, now, now, now);
  db.raw.prepare("INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, displayName, now, now);
}

function seedRoom(db: LocalDatabase, id: string, ownerId: string): void {
  const now = "2026-09-11T00:00:00.000Z";
  db.raw.prepare(
    `INSERT INTO rooms
     (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version,
      paused, player_timeline_frozen, history_revealed, created_at, updated_at)
     VALUES (?, ?, ?, 'scope-fixture', 'B01', 'lobby', 'active', ?, 1, 0, 0, 0, ?, ?)`,
  ).run(id, `TEAM-${id.toUpperCase()}`, `Room ${id}`, ownerId, now, now);
}

function seedMembership(db: LocalDatabase, roomId: string, profileId: string, role: "dm" | "learner", status = "active"): void {
  const now = "2026-09-11T00:00:00.000Z";
  db.raw.prepare(
    `INSERT INTO memberships
     (id, room_id, profile_id, team_id, role, seat, status, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?)`,
  ).run(`membership:${roomId}:${profileId}`, roomId, profileId, role, status, now, now, now);
}

test("T-105 mentor account directory is scoped, while exact lookup supports explicit classroom admission", async () => {
  const db = database();
  try {
    seedUser(db, "admin-one", "admin", "Platform Admin");
    seedUser(db, "mentor-a", "mentor", "Mentor A");
    seedUser(db, "mentor-b", "mentor", "Mentor B");
    seedUser(db, "learner-created", "learner", "Created Learner");
    seedUser(db, "learner-shared", "learner", "Shared Learner");
    seedUser(db, "learner-private", "learner", "Private Learner");
    seedUser(db, "learner-removed", "learner", "Removed Learner");
    seedRoom(db, "scope-a", "mentor-a");
    seedRoom(db, "scope-b", "mentor-b");
    seedMembership(db, "scope-a", "mentor-a", "dm");
    seedMembership(db, "scope-a", "learner-shared", "learner");
    seedMembership(db, "scope-a", "learner-removed", "learner", "removed");
    seedMembership(db, "scope-b", "mentor-b", "dm");
    seedMembership(db, "scope-b", "learner-private", "learner");
    db.raw.prepare(
      `INSERT INTO auth_security_events (id, user_id, actor_user_id, action, detail_json, created_at)
       VALUES ('managed-event', 'learner-created', 'mentor-a', 'auth.managed-account.created', '{}', '2026-09-11T00:00:00.000Z')`,
    ).run();

    const scoped = await listStudioAssignableAccounts(db, { userId: "mentor-a", role: "mentor" });
    assert.deepEqual(scoped.map((account) => account.userId).sort(), ["learner-created", "learner-shared", "mentor-a"]);
    assert.equal(scoped.some((account) => account.userId === "learner-private"), false);
    assert.equal(scoped.some((account) => account.userId === "learner-removed"), false);

    assert.deepEqual(
      (await listStudioAssignableAccounts(db, { userId: "mentor-a", role: "mentor" }, "learner-private")).map((account) => account.userId),
      ["learner-private"],
    );
    assert.deepEqual(
      (await listStudioAssignableAccounts(db, { userId: "mentor-a", role: "mentor" }, "Private Learner")).map((account) => account.userId),
      ["learner-private"],
    );
    assert.deepEqual(await listStudioAssignableAccounts(db, { userId: "mentor-a", role: "mentor" }, "private"), []);
    await assert.rejects(
      listStudioAssignableAccounts(db, { userId: "mentor-a", role: "mentor" }, "x"),
      (error: unknown) => error instanceof AuthError && error.code === "ACCOUNT_LOOKUP_QUERY_INVALID",
    );

    const global = await listStudioAssignableAccounts(db, { userId: "admin-one", role: "admin" });
    assert.equal(global.length, 7);
    await assert.rejects(
      listStudioAssignableAccounts(db, { userId: "learner-private", role: "learner" }),
      (error: unknown) => error instanceof AuthError && error.code === "MENTOR_REQUIRED",
    );
  } finally {
    db.raw.close();
  }
});

test("T-105 open registration creates only an active learner and no classroom membership", async () => {
  const db = database();
  try {
    const issued = await registerUser(db, {
      username: "open-builder",
      displayName: "Open Builder",
      password: "Open registration test passphrase 2026!",
      remember: false,
      fingerprint: "t105-local-only",
      userAgent: "T105 node:test",
      cookieHeader: null,
    });
    assert.equal(issued.user.role, "learner");
    const stored = db.raw.prepare("SELECT role, status FROM auth_users WHERE id = ?").get(issued.user.userId) as { role: string; status: string };
    assert.equal(stored.role, "learner");
    assert.equal(stored.status, "active");
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS count FROM memberships WHERE profile_id = ?").get(issued.user.userId) as { count: number }).count, 0);
  } finally {
    db.raw.close();
  }
});
