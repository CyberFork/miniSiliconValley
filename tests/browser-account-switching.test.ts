import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import { createPasswordDigest } from "../app/lib/auth-crypto";
import { AuthError } from "../app/lib/auth-errors";
import {
  authenticateSession,
  getBrowserAccountSetState,
  loginWithPassword,
  mutateBrowserAccounts,
  switchBrowserAccount,
  updateOwnProfile,
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
  const now = "2026-09-11T00:00:00.000Z";
  db.raw.prepare(
    `INSERT INTO auth_users
     (id, username, display_name, role, status, password_hash, password_salt,
      password_iterations, password_changed_at, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, username, displayName, role, digest.hash, digest.salt, digest.iterations, now, now, now);
  db.raw.prepare(`INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(id, displayName, now, now);
}

function cookies(sessionToken: string, setToken: string): string {
  return `__Secure-msv_session=${encodeURIComponent(sessionToken)}; __Secure-msv_accounts=${encodeURIComponent(setToken)}`;
}

function setCookie(setToken: string): string {
  return `__Secure-msv_accounts=${encodeURIComponent(setToken)}`;
}

async function fixture() {
  const db = database();
  await seedUser(db, "user-a", "alpha", "Alpha", "Alpha secure passphrase 2026!", "admin");
  await seedUser(db, "user-b", "bravo", "Bravo", "Bravo secure passphrase 2026!", "learner");
  return db;
}

test("T-106 keeps two verified accounts server-side and switches without either password", async () => {
  const db = await fixture();
  try {
    const alpha = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha", userAgent: "T106 Browser", cookieHeader: null,
    });
    assert.ok(alpha.browserSet);
    assert.equal(alpha.browserSet.state.currentUserId, "user-a");
    assert.equal(alpha.browserSet.state.accounts.length, 1);

    const bravo = await loginWithPassword(db, {
      username: "bravo", password: "Bravo secure passphrase 2026!", remember: false,
      fingerprint: "test-bravo", userAgent: "T106 Browser",
      cookieHeader: cookies(alpha.token, alpha.browserSet.token),
    });
    assert.ok(bravo.browserSet);
    assert.equal(bravo.browserSet.state.currentUserId, "user-b");
    assert.deepEqual(bravo.browserSet.state.accounts.map((item) => item.userId).sort(), ["user-a", "user-b"]);
    assert.equal(await authenticateSession(db, `__Secure-msv_session=${encodeURIComponent(alpha.token)}`), null, "the superseded token must be revoked");

    const switched = await switchBrowserAccount(db, cookies(bravo.token, bravo.browserSet.token), {
      targetUserId: "user-a",
      expectedVersion: bravo.browserSet.state.version,
      idempotencyKey: "switch-alpha-0001",
      userAgent: "T106 Browser",
    });
    assert.equal(switched.user.userId, "user-a");
    assert.equal(switched.browserSet.state.currentUserId, "user-a");
    assert.equal(switched.sessionToken === alpha.token, false, "switching must rotate instead of recovering a stored raw token");
    assert.equal((await authenticateSession(db, setCookie(bravo.browserSet.token)))?.userId, "user-a");

    const replay = await switchBrowserAccount(db, setCookie(bravo.browserSet.token), {
      targetUserId: "user-a",
      expectedVersion: bravo.browserSet.state.version,
      idempotencyKey: "switch-alpha-0001",
      userAgent: "T106 Browser",
    });
    assert.equal(replay.idempotent, true);
    assert.equal(replay.user.userId, "user-a");

    const stored = db.raw.prepare(`SELECT token_hash FROM auth_browser_sets`).get() as { token_hash: string };
    assert.notEqual(stored.token_hash, bravo.browserSet.token, "D1 must never store the clear browser-set bearer");
  } finally {
    db.raw.close();
  }
});

test("T-106 rejects stale, expired and password-invalidated switches without losing the current account", async () => {
  const db = await fixture();
  try {
    const alpha = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha-2", userAgent: "T106 Browser", cookieHeader: null,
    });
    const bravo = await loginWithPassword(db, {
      username: "bravo", password: "Bravo secure passphrase 2026!", remember: true,
      fingerprint: "test-bravo-2", userAgent: "T106 Browser", cookieHeader: cookies(alpha.token, alpha.browserSet!.token),
    });
    const setHeader = setCookie(bravo.browserSet!.token);
    db.raw.prepare(`UPDATE auth_browser_accounts SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = 'user-a'`).run();
    await assert.rejects(
      switchBrowserAccount(db, setHeader, {
        targetUserId: "user-a", expectedVersion: bravo.browserSet!.state.version,
        idempotencyKey: "expired-alpha-01", userAgent: "T106 Browser",
      }),
      (error: unknown) => error instanceof AuthError && error.code === "ACCOUNT_REAUTHENTICATION_REQUIRED",
    );
    assert.equal((await authenticateSession(db, setHeader))?.userId, "user-b");

    db.raw.prepare(`UPDATE auth_browser_accounts SET expires_at = '2099-01-01T00:00:00.000Z' WHERE user_id = 'user-a'`).run();
    db.raw.prepare(`UPDATE auth_users SET password_changed_at = '2026-09-11T01:00:00.000Z' WHERE id = 'user-a'`).run();
    await assert.rejects(
      switchBrowserAccount(db, setHeader, {
        targetUserId: "user-a", expectedVersion: bravo.browserSet!.state.version,
        idempotencyKey: "changed-alpha-01", userAgent: "T106 Browser",
      }),
      (error: unknown) => error instanceof AuthError && error.code === "ACCOUNT_REAUTHENTICATION_REQUIRED",
    );
    const state = await getBrowserAccountSetState(db, setHeader);
    assert.equal(state?.accounts.find((item) => item.userId === "user-a")?.status, "reauthenticate");
    assert.equal(state?.currentUserId, "user-b");
  } finally {
    db.raw.close();
  }
});

test("T-106 removes one account independently and logout-all revokes the whole browser set", async () => {
  const db = await fixture();
  try {
    const alpha = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha-3", userAgent: "T106 Browser", cookieHeader: null,
    });
    const bravo = await loginWithPassword(db, {
      username: "bravo", password: "Bravo secure passphrase 2026!", remember: true,
      fingerprint: "test-bravo-3", userAgent: "T106 Browser", cookieHeader: cookies(alpha.token, alpha.browserSet!.token),
    });
    const header = cookies(bravo.token, bravo.browserSet!.token);
    const removed = await mutateBrowserAccounts(db, header, {
      action: "remove", targetUserId: "user-a", expectedVersion: bravo.browserSet!.state.version,
      idempotencyKey: "remove-alpha-0001",
    });
    assert.equal(removed.clearSession, false);
    assert.equal(removed.browserSet?.state.currentUserId, "user-b");
    assert.deepEqual(removed.browserSet?.state.accounts.map((item) => item.userId), ["user-b"]);

    const all = await mutateBrowserAccounts(db, setCookie(bravo.browserSet!.token), {
      action: "logout-all", expectedVersion: removed.browserSet!.state.version,
      idempotencyKey: "logout-all-0001",
    });
    assert.equal(all.clearSession, true);
    assert.equal(all.clearBrowserSet, true);
    assert.equal(await authenticateSession(db, setCookie(bravo.browserSet!.token)), null);
  } finally {
    db.raw.close();
  }
});

test("T-106 password change keeps the current set credential and invalidates other browser sets", async () => {
  const db = await fixture();
  try {
    const first = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha-4", userAgent: "Browser One", cookieHeader: null,
    });
    const second = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha-5", userAgent: "Browser Two", cookieHeader: null,
    });
    const current = await authenticateSession(db, cookies(first.token, first.browserSet!.token));
    assert.ok(current);
    await updateOwnProfile(db, current, {
      currentPassword: "Alpha secure passphrase 2026!",
      newPassword: "Alpha replacement passphrase 2026!",
    });
    assert.equal((await getBrowserAccountSetState(db, setCookie(first.browserSet!.token)))?.accounts[0]?.status, "available");
    assert.equal((await getBrowserAccountSetState(db, setCookie(second.browserSet!.token)))?.accounts[0]?.status, "reauthenticate");
    assert.equal(await authenticateSession(db, setCookie(second.browserSet!.token)), null);
  } finally {
    db.raw.close();
  }
});

test("T-106 retains expired account metadata for targeted reauthentication", async () => {
  const db = await fixture();
  try {
    const alpha = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha-expired", userAgent: "T106 Browser", cookieHeader: null,
    });
    const bravo = await loginWithPassword(db, {
      username: "bravo", password: "Bravo secure passphrase 2026!", remember: true,
      fingerprint: "test-bravo-expired", userAgent: "T106 Browser",
      cookieHeader: cookies(alpha.token, alpha.browserSet!.token),
    });
    db.raw.prepare(`UPDATE auth_browser_accounts SET expires_at = '2000-01-01T00:00:00.000Z' WHERE set_id = (SELECT id FROM auth_browser_sets LIMIT 1) AND user_id = 'user-a'`).run();
    const state = await getBrowserAccountSetState(db, setCookie(bravo.browserSet!.token));
    const expired = state?.accounts.find((account) => account.userId === "user-a");
    assert.equal(expired?.username, "alpha");
    assert.equal(expired?.status, "expired");
    assert.equal(state?.currentUserId, "user-b");
  } finally {
    db.raw.close();
  }
});

test("T-106 revokes an empty browser set inside the final-account mutation", async () => {
  const db = await fixture();
  try {
    const alpha = await loginWithPassword(db, {
      username: "alpha", password: "Alpha secure passphrase 2026!", remember: true,
      fingerprint: "test-alpha-last", userAgent: "T106 Browser", cookieHeader: null,
    });
    const result = await mutateBrowserAccounts(db, cookies(alpha.token, alpha.browserSet!.token), {
      action: "logout-current",
      expectedVersion: alpha.browserSet!.state.version,
      idempotencyKey: "logout-final-0001",
    });
    assert.equal(result.browserSet, null);
    assert.equal(result.clearBrowserSet, true);
    const stored = db.raw.prepare(`SELECT active_user_id, active_session_id, revoked_at FROM auth_browser_sets`).get() as {
      active_user_id: string | null; active_session_id: string | null; revoked_at: string | null;
    };
    assert.equal(stored.active_user_id, null);
    assert.equal(stored.active_session_id, null);
    assert.ok(stored.revoked_at, "the set must already be revoked when the mutation returns");
  } finally {
    db.raw.close();
  }
});
