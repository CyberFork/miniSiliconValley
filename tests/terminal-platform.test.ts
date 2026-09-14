import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import type { AuthenticatedClassroomUser } from "../app/lib/classroom-api";
import { ClassroomError } from "../app/lib/classroom-errors";
import {
  equipTerminalItem,
  getPublicTerminalSpace,
  getTerminalBootstrap,
  grantTerminalCoins,
  initializeTerminalWallet,
  listTerminalGrantHistory,
  purchaseTerminalItem,
  reverseTerminalGrant,
  updateOwnPublicSpace,
} from "../app/lib/terminal-store";

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
        execute() { const result = raw.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } } as unknown as D1Result; },
      };
      return statement;
    },
    async batch(statements: LocalStatement[]) {
      raw.exec("BEGIN IMMEDIATE");
      try { const results = statements.map((statement) => statement.execute()); raw.exec("COMMIT"); return results; }
      catch (error) { raw.exec("ROLLBACK"); throw error; }
    },
  };
  return api as unknown as LocalDatabase;
}

function actor(userId: string, role: "admin" | "mentor" | "learner"): AuthenticatedClassroomUser {
  return { userId, username: userId, displayName: userId, platformRole: role, actorProfileId: userId, effectiveProfileId: userId, impersonationId: null };
}

function seed(db: LocalDatabase) {
  const now = "2026-09-14T00:00:00.000Z";
  for (const [id, username, name, role] of [
    ["admin-1", "admin-1", "平台管理员", "admin"],
    ["mentor-1", "mentor-1", "产品导师", "mentor"],
    ["mentor-2", "mentor-2", "其他导师", "mentor"],
    ["learner-1", "young-01", "林桐", "learner"],
    ["learner-2", "young-02", "苏禾", "learner"],
  ] as const) {
    db.raw.prepare(
      `INSERT INTO auth_users (id, username, display_name, role, status, password_hash, password_salt, password_iterations,
       password_changed_at, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 'hash', 'salt', 1, ?, 0, ?, ?)`,
    ).run(id, username, name, role, now, now, now);
    db.raw.prepare("INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, name, now, now);
    if (role === "learner") db.raw.prepare(
      "INSERT INTO auth_learner_admin_profiles (user_id, admin_notes, avatar_seed, avatar_version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    ).run(id, `PRIVATE:${id}`, `px_${id}_avatar`, now, now);
  }
  db.raw.prepare(
    `INSERT INTO course_versions (course_id, revision, schema_version, digest, package_json, created_at, created_by)
     VALUES ('course-1', 1, 1, 'digest-course-1', '{}', ?, 'admin-1')`,
  ).run(now);
  db.raw.prepare(
    `INSERT INTO rooms (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version, paused,
     player_timeline_frozen, history_revealed, created_at, updated_at)
     VALUES ('room-prod', 'ROOM-PROD', '正式互动课堂', 'campaign', 'B01', 'lobby', 'active', 'mentor-1', 1, 0, 0, 0, ?, ?)`,
  ).run(now, now);
  db.raw.prepare(
    `INSERT INTO classroom_instances (room_id, environment, learner_count, lifecycle, state_machine_version,
     course_id, course_revision, course_digest, factory_key, reset_generation, created_at, updated_at)
     VALUES ('room-prod', 'production', 2, 'running', 1, 'course-1', 1, 'digest-course-1', 'fixture-prod', 0, ?, ?)`,
  ).run(now, now);
  for (const [id, profile, role, seat] of [
    ["m-mentor", "mentor-1", "dm", null],
    ["m-learner-1", "learner-1", "learner", 1],
    ["m-learner-2", "learner-2", "learner", 2],
  ] as const) db.raw.prepare(
    `INSERT INTO memberships (id, room_id, profile_id, role, seat, status, last_seen_at, created_at, updated_at)
     VALUES (?, 'room-prod', ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(id, profile, role, seat, now, now, now);
}

test("T-124 distinguishes uninitialized and zero wallets, isolates TEST assets", async () => {
  const db = database(); seed(db);
  try {
    const learner = actor("learner-1", "learner");
    let bootstrap = await getTerminalBootstrap(db, learner);
    assert.equal(bootstrap.wallets.production.initialized, false);
    assert.equal(bootstrap.wallets.production.balanceCoins, null);
    await initializeTerminalWallet(db, learner, "production");
    bootstrap = await getTerminalBootstrap(db, learner);
    assert.equal(bootstrap.wallets.production.initialized, true);
    assert.equal(bootstrap.wallets.production.balanceCoins, 0);
    await grantTerminalCoins(db, actor("mentor-1", "mentor"), {
      roomId: "room-prod", targetProfileId: "learner-1", environment: "production", amountCoins: 20,
      reason: "说明理由并帮助队友", idempotencyKey: "grant.production.001",
    });
    db.raw.prepare("INSERT INTO learner_terminal_wallets VALUES ('learner-1', 'test', 9, ?, ?)").run("2026-09-14", "2026-09-14");
    bootstrap = await getTerminalBootstrap(db, learner);
    assert.equal(bootstrap.wallets.production.balanceCoins, 20);
    assert.equal(bootstrap.wallets.test.balanceCoins, 9);
    assert.equal(bootstrap.inventory.length, 0);
  } finally { db.raw.close(); }
});

test("T-124 purchase is atomic, retry-safe and cannot double-own one decoration", async () => {
  const db = database(); seed(db);
  try {
    const learner = actor("learner-1", "learner");
    await grantTerminalCoins(db, actor("mentor-1", "mentor"), {
      roomId: "room-prod", targetProfileId: "learner-1", environment: "production", amountCoins: 20,
      reason: "完成证据助攻", idempotencyKey: "grant.for.purchase",
    });
    const first = await purchaseTerminalItem(db, learner, { itemId: "identity-signal-teal", idempotencyKey: "purchase.item.001" });
    assert.equal(first.balanceCoins, 8);
    assert.equal(first.replayed, false);
    const replay = await purchaseTerminalItem(db, learner, { itemId: "identity-signal-teal", idempotencyKey: "purchase.item.001" });
    assert.equal(replay.balanceCoins, 8);
    assert.equal(replay.replayed, true);
    await assert.rejects(
      purchaseTerminalItem(db, learner, { itemId: "identity-signal-teal", idempotencyKey: "purchase.item.002" }),
      (error: unknown) => error instanceof ClassroomError && error.code === "TERMINAL_ITEM_ALREADY_OWNED",
    );
    assert.equal((db.raw.prepare("SELECT balance_coins FROM learner_terminal_wallets WHERE profile_id = 'learner-1' AND environment = 'production'").get() as { balance_coins: number }).balance_coins, 8);
    await equipTerminalItem(db, learner, { itemId: "identity-signal-teal" });
    const equipped = db.raw.prepare("SELECT slot, item_id FROM learner_terminal_equipment WHERE profile_id = 'learner-1'").get() as { slot: string; item_id: string };
    assert.equal(equipped.slot, "identity");
    assert.equal(equipped.item_id, "identity-signal-teal");
    await assert.rejects(
      equipTerminalItem(db, learner, { itemId: "space-moon-rocket" }),
      (error: unknown) => error instanceof ClassroomError && error.code === "TERMINAL_ITEM_NOT_OWNED",
    );
  } finally { db.raw.close(); }
});

test("T-124 grants enforce classroom scope, idempotency and append-only reversal", async () => {
  const db = database(); seed(db);
  try {
    const mentor = actor("mentor-1", "mentor");
    const first = await grantTerminalCoins(db, mentor, {
      roomId: "room-prod", targetProfileId: "learner-2", environment: "production", amountCoins: 10,
      reason: "主动解释自己的证据", idempotencyKey: "grant.safe.001",
    });
    const replay = await grantTerminalCoins(db, mentor, {
      roomId: "room-prod", targetProfileId: "learner-2", environment: "production", amountCoins: 10,
      reason: "主动解释自己的证据", idempotencyKey: "grant.safe.001",
    });
    assert.equal(first.balanceCoins, 10);
    assert.equal(replay.balanceCoins, 10);
    assert.equal(replay.replayed, true);
    await assert.rejects(
      grantTerminalCoins(db, mentor, {
        roomId: "room-prod", targetProfileId: "learner-2", environment: "production", amountCoins: 999,
        reason: "同一个操作号不能换一笔交易", idempotencyKey: "grant.safe.001",
      }),
      (error: unknown) => error instanceof ClassroomError && error.code === "TERMINAL_IDEMPOTENCY_CONFLICT",
    );
    const reversed = await reverseTerminalGrant(db, mentor, first.transactionId, { reason: "课堂记录数量写错", idempotencyKey: "reverse.safe.001" });
    assert.equal(reversed.balanceCoins, 0);
    assert.equal(reversed.amountCoins, -10);
    const reversalReplay = await reverseTerminalGrant(db, mentor, first.transactionId, { reason: "课堂记录数量写错", idempotencyKey: "reverse.safe.001" });
    assert.equal(reversalReplay.replayed, true);
    assert.equal(reversalReplay.balanceCoins, 0);
    await assert.rejects(
      reverseTerminalGrant(db, mentor, first.transactionId, { reason: "不能再次纠正", idempotencyKey: "reverse.safe.002" }),
      (error: unknown) => error instanceof ClassroomError && error.code === "TERMINAL_GRANT_ALREADY_REVERSED",
    );
    const history = await listTerminalGrantHistory(db, mentor);
    assert.equal(history.length, 1);
    assert.equal(history[0].transactionId, first.transactionId);
    assert.equal(history[0].reversed, true);
    assert.equal((await listTerminalGrantHistory(db, actor("mentor-2", "mentor"))).length, 0);
    assert.equal((await listTerminalGrantHistory(db, actor("admin-1", "admin"))).length, 1);
    await assert.rejects(
      grantTerminalCoins(db, actor("mentor-2", "mentor"), {
        roomId: "room-prod", targetProfileId: "learner-1", environment: "production", amountCoins: 2,
        reason: "越权尝试", idempotencyKey: "grant.forbidden.001",
      }),
      (error: unknown) => error instanceof ClassroomError && error.status === 403,
    );
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS count FROM learner_terminal_transactions WHERE profile_id = 'learner-2'").get() as { count: number }).count, 2);
  } finally { db.raw.close(); }
});

test("T-124 public space contains only explicit public copy", async () => {
  const db = database(); seed(db);
  try {
    await assert.rejects(getPublicTerminalSpace(db, "young-01"), (error: unknown) => error instanceof ClassroomError && error.status === 404);
    await updateOwnPublicSpace(db, actor("learner-1", "learner"), {
      intro: "我把校园里的真实问题做成小工具。", projectTitle: "找回它", projectSummary: "让失物登记和认领更清楚。",
      projectUrl: "https://example.com/project", teamName: "北极星队", contribution: "我负责访谈和原型验证。",
    });
    const publicSpace = await getPublicTerminalSpace(db, "@young-01");
    assert.equal(publicSpace.projectTitle, "找回它");
    assert.equal(publicSpace.teamName, "北极星队");
    assert.equal("adminNotes" in publicSpace, false);
    assert.equal(JSON.stringify(publicSpace).includes("PRIVATE:learner-1"), false);
    assert.equal(JSON.stringify(publicSpace).includes("password"), false);
    await assert.rejects(
      updateOwnPublicSpace(db, actor("learner-1", "learner"), { projectUrl: "javascript:alert(1)" }),
      (error: unknown) => error instanceof ClassroomError && error.code === "TERMINAL_PROJECT_URL_INVALID",
    );
  } finally { db.raw.close(); }
});
