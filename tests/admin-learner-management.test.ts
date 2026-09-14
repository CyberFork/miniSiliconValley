import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import { createPasswordDigest } from "../app/lib/auth-crypto";
import { AuthError } from "../app/lib/auth-errors";
import type { AuthRole, AuthSessionUser } from "../app/lib/auth-model";
import {
  createAdminManagedLearner,
  deleteAdminManagedLearner,
  listAdminManagedLearners,
  listStudioAssignableAccounts,
  loginWithPassword,
  previewAdminManagedLearnerDeletion,
  resetAdminManagedLearnerPassword,
  updateAdminManagedLearner,
} from "../app/lib/auth-store";

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

async function seedUser(db: LocalDatabase, id: string, username: string, displayName: string, password: string, role: "admin" | "mentor" | "learner") {
  const digest = await createPasswordDigest(password);
  const now = "2026-09-14T00:00:00.000Z";
  db.raw.prepare(
    `INSERT INTO auth_users
     (id, username, display_name, role, status, password_hash, password_salt,
      password_iterations, password_changed_at, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, username, displayName, role, digest.hash, digest.salt, digest.iterations, now, now, now);
  db.raw.prepare("INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, displayName, now, now);
  if (role === "learner") {
    db.raw.prepare(
      `INSERT INTO auth_learner_admin_profiles
       (user_id, admin_notes, avatar_seed, avatar_version, created_at, updated_at)
       VALUES (?, '', ?, 1, ?, ?)`,
    ).run(id, `legacy:${id}`, now, now);
    db.raw.prepare(
      `INSERT INTO auth_learner_username_allocations (username, user_id, allocated_at)
       VALUES (?, ?, ?)`,
    ).run(username, id, now);
  }
}

function actor(id: string, role: AuthRole): AuthSessionUser {
  return {
    userId: id,
    username: id,
    displayName: id,
    role,
    mustChangePassword: false,
    sessionId: `session:${id}`,
    sessionExpiresAt: "2099-01-01T00:00:00.000Z",
    impersonation: null,
  };
}

async function fixture() {
  const db = database();
  await seedUser(db, "admin-root", "admin-root", "平台管理员", "Admin fixture password 2026!", "admin");
  await seedUser(db, "mentor-one", "mentor-one", "普通导师", "Mentor fixture password 2026!", "mentor");
  for (let index = 1; index <= 4; index += 1) {
    await seedUser(db, `learner-${index}`, `msv-student-0${index}`, `学员 0${index}`, `Learner fixture password ${index} 2026!`, "learner");
  }
  return db;
}

test("T-114 Admin creates, searches and safely edits one stable learner identity", async () => {
  const db = await fixture();
  const admin = actor("admin-root", "admin");
  try {
    const created = await createAdminManagedLearner(db, admin, {
      displayName: "林桐",
      initialPassword: "Linton initial passphrase 2026!",
      adminNotes: "家长已确认测试账号",
      idempotencyKey: "t114-create-learner-05",
    });
    assert.equal(created.created, true);
    assert.equal(created.learner.username, "msv-student-05");
    assert.equal(created.learner.adminNotes, "家长已确认测试账号");
    assert.match(created.learner.avatarSeed, /^px_/);

    const replay = await createAdminManagedLearner(db, admin, {
      displayName: "不应创建第二个账号",
      initialPassword: "Different passphrase should not be used 2026!",
      adminNotes: "不应覆盖",
      idempotencyKey: "t114-create-learner-05",
    });
    assert.equal(replay.created, false);
    assert.equal(replay.learner.id, created.learner.id);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS count FROM auth_users WHERE username = 'msv-student-05'").get() as { count: number }).count, 1);

    for (const query of ["student-05", "@msv-student-05", "林桐", created.learner.id.slice(0, 12)]) {
      const page = await listAdminManagedLearners(db, admin, { query });
      assert.deepEqual(page.items.map((item) => item.id), [created.learner.id]);
    }
    const picker = await listStudioAssignableAccounts(db, { userId: admin.userId, role: "admin" }, "林桐");
    assert.deepEqual(picker.map((item) => item.userId), [created.learner.id]);
    assert.equal("adminNotes" in picker[0], false, "private notes must never enter the classroom picker");

    const firstLogin = await loginWithPassword(db, {
      username: created.learner.username,
      password: "Linton initial passphrase 2026!",
      remember: false,
      fingerprint: "t114-first-login",
      userAgent: "T114 isolated browser",
      cookieHeader: null,
    });
    assert.equal(firstLogin.user.mustChangePassword, true);

    const edited = await updateAdminManagedLearner(db, admin, created.learner.id, {
      displayName: "林桐同学",
      adminNotes: "仅 Admin 可见的新备注",
      regenerateAvatar: true,
    });
    assert.equal(edited.id, created.learner.id);
    assert.equal(edited.username, created.learner.username);
    assert.equal(edited.displayName, "林桐同学");
    assert.notEqual(edited.avatarSeed, created.learner.avatarSeed);
    assert.equal(edited.avatarVersion, created.learner.avatarVersion + 1);
    assert.equal((db.raw.prepare("SELECT nickname FROM profiles WHERE id = ?").get(created.learner.id) as { nickname: string }).nickname, "林桐同学");

    const stillLoggedIn = db.raw.prepare("SELECT revoked_at FROM auth_sessions WHERE id = ?").get(firstLogin.user.sessionId) as { revoked_at: string | null };
    assert.equal(stillLoggedIn.revoked_at, null, "renaming and notes must not reset the password or session");
    const events = db.raw.prepare("SELECT detail_json FROM auth_security_events WHERE actor_user_id = 'admin-root'").all() as Array<{ detail_json: string }>;
    assert.equal(events.some((event) => /Linton initial passphrase|家长已确认|新备注/.test(event.detail_json)), false, "passwords and private notes must not enter audit details");
  } finally {
    db.raw.close();
  }
});

test("T-114 password reset revokes sessions and old credentials", async () => {
  const db = await fixture();
  const admin = actor("admin-root", "admin");
  try {
    const created = await createAdminManagedLearner(db, admin, {
      displayName: "密码隔离学员",
      initialPassword: "Original isolated learner password 2026!",
      idempotencyKey: "t114-password-account",
    });
    const login = await loginWithPassword(db, {
      username: created.learner.username,
      password: "Original isolated learner password 2026!",
      remember: true,
      fingerprint: "t114-before-reset",
      userAgent: "T114 reset browser",
      cookieHeader: null,
    });
    await resetAdminManagedLearnerPassword(db, admin, created.learner.id, "Replacement isolated password 2026!");
    assert.notEqual((db.raw.prepare("SELECT revoked_at FROM auth_sessions WHERE id = ?").get(login.user.sessionId) as { revoked_at: string | null }).revoked_at, null);
    await assert.rejects(
      loginWithPassword(db, {
        username: created.learner.username,
        password: "Original isolated learner password 2026!",
        remember: false,
        fingerprint: "t114-old-password",
        userAgent: "T114 reset browser",
        cookieHeader: null,
      }),
      (error: unknown) => error instanceof AuthError && error.code === "LOGIN_INVALID",
    );
    const next = await loginWithPassword(db, {
      username: created.learner.username,
      password: "Replacement isolated password 2026!",
      remember: false,
      fingerprint: "t114-new-password",
      userAgent: "T114 reset browser",
      cookieHeader: null,
    });
    assert.equal(next.user.mustChangePassword, true);
  } finally {
    db.raw.close();
  }
});

test("T-114 deletion is real only without history and numbered usernames are never recycled", async () => {
  const db = await fixture();
  const admin = actor("admin-root", "admin");
  try {
    const disposable = await createAdminManagedLearner(db, admin, {
      displayName: "可删除隔离学员",
      initialPassword: "Disposable isolated password 2026!",
      idempotencyKey: "t114-disposable-account",
    });
    assert.equal((await previewAdminManagedLearnerDeletion(db, admin, disposable.learner.id)).deletable, true);
    await deleteAdminManagedLearner(db, admin, disposable.learner.id);
    assert.equal(db.raw.prepare("SELECT id FROM auth_users WHERE id = ?").get(disposable.learner.id), undefined);
    assert.equal(db.raw.prepare("SELECT id FROM profiles WHERE id = ?").get(disposable.learner.id), undefined);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS count FROM ledger_accounts WHERE owner_profile_id = ?").get(disposable.learner.id) as { count: number }).count, 0);

    const next = await createAdminManagedLearner(db, admin, {
      displayName: "后续隔离学员",
      initialPassword: "Subsequent isolated password 2026!",
      idempotencyKey: "t114-after-delete-account",
    });
    assert.equal(next.learner.username, "msv-student-06", "deleted usernames must never be recycled");

    const now = "2026-09-14T01:00:00.000Z";
    db.raw.prepare(
      `INSERT INTO rooms
       (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version,
        paused, player_timeline_frozen, history_revealed, created_at, updated_at)
       VALUES ('t114-room', 'TEAM-T114', 'T114 隔离课堂', 'fixture', 'B01', 'lobby', 'active',
               'admin-root', 1, 0, 0, 0, ?, ?)`,
    ).run(now, now);
    db.raw.prepare(
      `INSERT INTO memberships
       (id, room_id, profile_id, team_id, role, seat, status, last_seen_at, created_at, updated_at)
       VALUES ('t114-member', 't114-room', ?, NULL, 'learner', 1, 'active', ?, ?, ?)`,
    ).run(next.learner.id, now, now, now);
    const blocked = await previewAdminManagedLearnerDeletion(db, admin, next.learner.id);
    assert.equal(blocked.deletable, false);
    assert.ok(blocked.blockers.some((item) => item.code === "classrooms" && item.count > 0));
    await assert.rejects(
      deleteAdminManagedLearner(db, admin, next.learner.id),
      (error: unknown) => error instanceof AuthError && error.code === "LEARNER_DELETE_BLOCKED",
    );
    assert.ok(db.raw.prepare("SELECT id FROM auth_users WHERE id = ?").get(next.learner.id));
  } finally {
    db.raw.close();
  }
});

test("T-114 learner CRUD is platform-Admin only, never inherited from mentor or classroom DM identity", async () => {
  const db = await fixture();
  const mentor = actor("mentor-one", "mentor");
  try {
    await assert.rejects(listAdminManagedLearners(db, mentor), (error: unknown) => error instanceof AuthError && error.code === "ADMIN_REQUIRED");
    await assert.rejects(
      createAdminManagedLearner(db, mentor, {
        displayName: "越权账号",
        initialPassword: "Unauthorized password attempt 2026!",
        idempotencyKey: "t114-unauthorized-create",
      }),
      (error: unknown) => error instanceof AuthError && error.code === "ADMIN_REQUIRED",
    );
    await assert.rejects(
      updateAdminManagedLearner(db, mentor, "learner-1", { displayName: "越权改名" }),
      (error: unknown) => error instanceof AuthError && error.code === "ADMIN_REQUIRED",
    );
    await assert.rejects(
      resetAdminManagedLearnerPassword(db, mentor, "learner-1", "Unauthorized password reset 2026!"),
      (error: unknown) => error instanceof AuthError && error.code === "ADMIN_REQUIRED",
    );
    await assert.rejects(
      previewAdminManagedLearnerDeletion(db, mentor, "learner-1"),
      (error: unknown) => error instanceof AuthError && error.code === "ADMIN_REQUIRED",
    );
  } finally {
    db.raw.close();
  }
});
