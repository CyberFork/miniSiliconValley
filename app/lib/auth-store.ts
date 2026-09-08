import type { ClassroomD1 } from "../../db";
import {
  createPasswordDigest,
  hashSecret,
  PASSWORD_ITERATIONS,
  randomSecret,
  verifyPasswordDigest,
} from "./auth-crypto";
import { assertAuth, AuthError } from "./auth-errors";
import type {
  AuthRole,
  IssuedManagedCredential,
  AuthSessionSummary,
  AuthSessionUser,
  ManagedAuthUser,
} from "./auth-model";
import { parseDisplayName, parseRole, parseUsername } from "./auth-validation";

const SESSION_COOKIE = "__Secure-msv_session";
const DEFAULT_SESSION_MS = 12 * 60 * 60 * 1_000;
const REMEMBERED_SESSION_MS = 30 * 24 * 60 * 60 * 1_000;
const SESSION_TOUCH_MS = 5 * 60 * 1_000;
const RESET_LINK_MS = 30 * 60 * 1_000;
const RATE_WINDOW_MS = 15 * 60 * 1_000;
const RATE_BLOCK_MS = 15 * 60 * 1_000;
const DUMMY_SALT = "AAAAAAAAAAAAAAAAAAAAAA";
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: AuthRole;
  status: "active" | "disabled";
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  must_change_password: number;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  username: string;
  display_name: string;
  role: AuthRole;
  status: "active" | "disabled";
  must_change_password: number;
};

type ResetTokenRow = UserRow & {
  reset_token_id: string;
  reset_expires_at: string;
};

export type IssuedSession = {
  user: AuthSessionUser;
  token: string;
  remember: boolean;
};

export async function authenticateSession(db: ClassroomD1, cookieHeader: string | null): Promise<AuthSessionUser | null> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = await hashSecret(token);
  const row = await db
    .prepare(
      `SELECT s.id, s.user_id, s.expires_at, s.last_seen_at, s.revoked_at,
              u.username, u.display_name, u.role, u.status, u.must_change_password
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.token_hash = ?
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
  if (!row || row.revoked_at || row.status !== "active" || Date.parse(row.expires_at) <= Date.now()) return null;

  if (Date.now() - Date.parse(row.last_seen_at) >= SESSION_TOUCH_MS) {
    await db.prepare(`UPDATE auth_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL`).bind(nowIso(), row.id).run();
  }
  return sessionUser(row);
}

export async function loginWithPassword(
  db: ClassroomD1,
  input: { username: string; password: string; remember: boolean; fingerprint: string; userAgent: string },
): Promise<IssuedSession> {
  const rateKey = await consumeRateLimit(db, "password-login", `${input.fingerprint}|${input.username}`, 8);
  const user = await getUserByUsername(db, input.username);
  const verified = await verifyPasswordDigest(
    input.password,
    user?.password_hash ?? DUMMY_HASH,
    user?.password_salt ?? DUMMY_SALT,
    user?.password_iterations ?? PASSWORD_ITERATIONS,
  );
  if (!user || !verified || user.status !== "active") {
    await securityEvent(db, user?.id ?? null, null, "auth.login.password.failed", { username: input.username });
    throw new AuthError("LOGIN_INVALID", "用户名或密码不正确。", 401);
  }
  await clearRateLimit(db, rateKey);
  const issued = await issueSession(db, user, input.remember, input.userAgent);
  await securityEvent(db, user.id, user.id, "auth.login.password.succeeded", { sessionId: issued.user.sessionId });
  return issued;
}

/** Public registration always creates an ordinary learner account. */
export async function registerUser(
  db: ClassroomD1,
  input: {
    username: string;
    displayName: string;
    password: string;
    remember: boolean;
    fingerprint: string;
    userAgent: string;
  },
): Promise<IssuedSession> {
  await consumeRateLimit(db, "registration", input.fingerprint, 5);
  assertAuth(!(await getUserByUsername(db, input.username)), "USERNAME_TAKEN", "这个用户名已经有人使用。", 409);

  const password = await createPasswordDigest(input.password);
  const userId = `usr_${crypto.randomUUID()}`;
  const now = nowIso();
  const session = await newSession(userId, input.remember, input.userAgent, now);
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO auth_users
         (id, username, display_name, role, status, password_hash, password_salt, password_iterations,
          password_changed_at, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, 'learner', 'active', ?, ?, ?, ?, 0, ?, ?)`,
      ).bind(userId, input.username, input.displayName, password.hash, password.salt, password.iterations, now, now, now),
      db.prepare(`INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`)
        .bind(userId, input.displayName, now, now),
      db.prepare(
        `INSERT INTO ledger_accounts
         (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
         VALUES (?, 'personal-wallet', NULL, NULL, ?, 0, ?)`,
      ).bind(`wallet:${userId}`, userId, now),
      sessionInsert(db, session),
      securityEventStatement(db, userId, userId, "auth.registration.succeeded", { role: "learner" }, now),
    ]);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      throw new AuthError("USERNAME_TAKEN", "这个用户名已经有人使用。", 409);
    }
    throw error;
  }
  const row = (await getUserByUsername(db, input.username))!;
  return { user: sessionUserFrom(row, session), token: session.token, remember: input.remember };
}

/**
 * Pre-create classroom accounts and reveal each generated password exactly in
 * this return value. Only password hashes reach D1. A classroom-scoped Admin
 * DM may create mentor/learner accounts for that classroom. Trusted platform
 * mentors may also pre-create a roster before the ClassroomFactory transaction
 * so they can become the initial Admin DM without help from a system admin.
 */
export async function createManagedUsers(
  db: ClassroomD1,
  actor: Pick<AuthSessionUser, "userId" | "role">,
  inputs: Array<{ username: unknown; displayName: unknown; role: unknown }>,
  roomId?: string,
): Promise<IssuedManagedCredential[]> {
  assertAuth(inputs.length >= 1 && inputs.length <= 24, "ACCOUNT_BATCH_SIZE_INVALID", "一次可以创建 1—24 个账号。", 400);
  if (roomId) {
    const permission = await db.prepare(
      `SELECT id FROM classroom_permissions WHERE room_id = ? AND profile_id = ? AND permission = 'admin-dm'`,
    ).bind(roomId, actor.userId).first<{ id: string }>();
    assertAuth(permission, "CLASSROOM_ADMIN_REQUIRED", "此操作需要本课堂 Admin DM 权限。", 403);
  } else {
    assertAuth(actor.role === "admin" || actor.role === "mentor", "MENTOR_REQUIRED", "只有导师或平台管理员可以预创建课堂账号。", 403);
  }
  const parsed = inputs.map((input) => {
    const role = parseRole(input.role);
    assertAuth(role !== "admin" && role !== "observer", "MANAGED_ROLE_INVALID", "课堂批量账号只能是导师或学员。", 400);
    return { username: parseUsername(input.username), displayName: parseDisplayName(input.displayName), role };
  });
  assertAuth(new Set(parsed.map((item) => item.username)).size === parsed.length, "USERNAME_DUPLICATE", "批量账号中有重复用户名。", 400);
  const placeholders = parsed.map(() => "?").join(",");
  const existing = await db.prepare(`SELECT username FROM auth_users WHERE username IN (${placeholders})`).bind(...parsed.map((item) => item.username)).all<{ username: string }>();
  assertAuth(!(existing.results ?? []).length, "USERNAME_TAKEN", `用户名已存在：${(existing.results ?? []).map((item) => item.username).join("、")}`, 409);

  const now = nowIso();
  const credentials = await Promise.all(parsed.map(async (item): Promise<IssuedManagedCredential & { hash: string; salt: string; iterations: number }> => {
    const userId = `usr_${crypto.randomUUID()}`;
    const initialPassword = `Msv!${randomSecret(18)}`;
    const password = await createPasswordDigest(initialPassword);
    return {
      userId,
      username: item.username,
      displayName: item.displayName,
      role: item.role,
      initialPassword,
      mustChangePassword: true,
      hash: password.hash,
      salt: password.salt,
      iterations: password.iterations,
    };
  }));
  const statements: D1PreparedStatement[] = [];
  for (const credential of credentials) {
    statements.push(
      db.prepare(
        `INSERT INTO auth_users
         (id, username, display_name, role, status, password_hash, password_salt, password_iterations,
          password_changed_at, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 1, ?, ?)`,
      ).bind(credential.userId, credential.username, credential.displayName, credential.role, credential.hash, credential.salt, credential.iterations, now, now, now),
      db.prepare(`INSERT INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`).bind(credential.userId, credential.displayName, now, now),
      db.prepare(
        `INSERT INTO ledger_accounts (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
         VALUES (?, 'personal-wallet', NULL, NULL, ?, 0, ?)`,
      ).bind(`wallet:${credential.userId}`, credential.userId, now),
      securityEventStatement(db, credential.userId, actor.userId, "auth.managed-account.created", { role: credential.role, roomId: roomId ?? null }, now),
    );
  }
  await db.batch(statements);
  return credentials.map((credential) => ({
    userId: credential.userId,
    username: credential.username,
    displayName: credential.displayName,
    role: credential.role,
    initialPassword: credential.initialPassword,
    mustChangePassword: credential.mustChangePassword,
  }));
}

/** Returns the clear token exactly once; D1 stores only its SHA-256 digest. */
export async function issuePasswordResetToken(
  db: ClassroomD1,
  actor: AuthSessionUser,
  username: string,
): Promise<{ username: string; displayName: string; token: string; expiresAt: string }> {
  requireManager(actor);
  const target = await getUserByUsername(db, username);
  assertAuth(target && target.status === "active", "USER_NOT_FOUND", "没有找到可用的学员账号。", 404);
  assertAuth(
    target.role === "learner" || target.role === "observer",
    "PRIVILEGED_RESET_FORBIDDEN",
    "导师与管理员账号由后台维护，不能签发网页重置链接。",
    403,
  );
  if (actor.role === "mentor") {
    assertAuth(
      await mentorCanManageLearner(db, actor.userId, target.id),
      "MANAGE_FORBIDDEN",
      "你只能协助自己课堂中的学员或待审批学员。",
      403,
    );
  }

  const token = randomSecret(32);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + RESET_LINK_MS).toISOString();
  const resetId = crypto.randomUUID();
  await db.batch([
    db.prepare(`UPDATE auth_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`).bind(now, target.id),
    db.prepare(
      `INSERT INTO auth_reset_tokens
       (id, user_id, token_hash, expires_at, consumed_at, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    ).bind(resetId, target.id, await hashSecret(token), expiresAt, actor.userId, now),
    securityEventStatement(db, target.id, actor.userId, "auth.password-reset-link.issued", { resetId, expiresAt }, now),
  ]);
  return { username: target.username, displayName: target.display_name, token, expiresAt };
}

export async function resetPasswordWithToken(
  db: ClassroomD1,
  input: { token: string; newPassword: string; fingerprint: string; userAgent: string },
): Promise<IssuedSession> {
  const tokenHash = await hashSecret(input.token);
  const rateKey = await consumeRateLimit(db, "password-reset-link", `${input.fingerprint}|${tokenHash.slice(0, 16)}`, 6);
  // Pay the derivation cost before lookup to reduce token-validity timing differences.
  const password = await createPasswordDigest(input.newPassword);
  const now = nowIso();
  const row = await db.prepare(
    `SELECT rt.id AS reset_token_id, rt.expires_at AS reset_expires_at,
            u.id, u.username, u.display_name, u.role, u.status, u.password_hash,
            u.password_salt, u.password_iterations, u.must_change_password,
            u.created_at, u.updated_at
     FROM auth_reset_tokens rt
     JOIN auth_users u ON u.id = rt.user_id
     WHERE rt.token_hash = ? AND rt.consumed_at IS NULL AND rt.expires_at > ?
       AND u.status = 'active' AND u.role IN ('learner', 'observer')
     LIMIT 1`,
  ).bind(tokenHash, now).first<ResetTokenRow>();
  if (!row) throw new AuthError("RESET_LINK_INVALID", "重置链接无效、已使用或已经过期。", 401);

  // A unique claim marker makes every dependent statement a no-op for a
  // concurrent replay, even if two requests were read in the same millisecond.
  const claim = `${now}#${crypto.randomUUID()}`;
  const session = await newSession(row.id, false, input.userAgent, now);
  const results = await db.batch([
    db.prepare(
      `UPDATE auth_reset_tokens SET consumed_at = ?
       WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`,
    ).bind(claim, row.reset_token_id, now),
    db.prepare(
      `UPDATE auth_users SET password_hash = ?, password_salt = ?, password_iterations = ?,
       password_changed_at = ?, must_change_password = 0, updated_at = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM auth_reset_tokens WHERE id = ? AND consumed_at = ?
       )`,
    ).bind(password.hash, password.salt, password.iterations, now, now, row.id, row.reset_token_id, claim),
    db.prepare(
      `UPDATE auth_sessions SET revoked_at = ?
       WHERE user_id = ? AND revoked_at IS NULL AND EXISTS (
         SELECT 1 FROM auth_reset_tokens WHERE id = ? AND consumed_at = ?
       )`,
    ).bind(now, row.id, row.reset_token_id, claim),
    db.prepare(
      `INSERT INTO auth_sessions
       (id, user_id, token_hash, user_agent, remember, expires_at, last_seen_at, revoked_at, created_at)
       SELECT ?, ?, ?, ?, 0, ?, ?, NULL, ?
       WHERE EXISTS (SELECT 1 FROM auth_reset_tokens WHERE id = ? AND consumed_at = ?)`,
    ).bind(
      session.id, session.userId, session.tokenHash, session.userAgent, session.expiresAt,
      session.now, session.now, row.reset_token_id, claim,
    ),
    db.prepare(
      `INSERT INTO auth_security_events (id, user_id, actor_user_id, action, detail_json, created_at)
       SELECT ?, ?, ?, 'auth.password.reset-with-link', ?, ?
       WHERE EXISTS (SELECT 1 FROM auth_reset_tokens WHERE id = ? AND consumed_at = ?)`,
    ).bind(
      crypto.randomUUID(), row.id, row.id, JSON.stringify({ resetId: row.reset_token_id }), now,
      row.reset_token_id, claim,
    ),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new AuthError("RESET_LINK_INVALID", "重置链接无效、已使用或已经过期。", 401);
  }
  await clearRateLimit(db, rateKey);
  return { user: sessionUserFrom(row, session), token: session.token, remember: false };
}

export async function updateOwnProfile(
  db: ClassroomD1,
  current: AuthSessionUser,
  input: { displayName?: string; currentPassword?: string; newPassword?: string },
): Promise<void> {
  const user = await getUserById(db, current.userId);
  assertAuth(user && user.status === "active", "AUTH_REQUIRED", "当前账号不可用，请重新登录。", 401);
  const now = nowIso();
  if (input.newPassword) {
    assertAuth(input.currentPassword, "CURRENT_PASSWORD_REQUIRED", "修改密码前请填写当前密码。", 400);
    const verified = await verifyPasswordDigest(input.currentPassword, user.password_hash, user.password_salt, user.password_iterations);
    assertAuth(verified, "CURRENT_PASSWORD_INVALID", "当前密码不正确。", 401);
    const password = await createPasswordDigest(input.newPassword);
    await db.batch([
      db.prepare(
        `UPDATE auth_users SET password_hash = ?, password_salt = ?, password_iterations = ?,
         password_changed_at = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
      ).bind(password.hash, password.salt, password.iterations, now, now, user.id),
      db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL`)
        .bind(now, user.id, current.sessionId),
      db.prepare(`UPDATE auth_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`).bind(now, user.id),
      securityEventStatement(db, user.id, user.id, "auth.password.changed", {}, now),
    ]);
  }
  if (input.displayName && input.displayName !== user.display_name) {
    await db.batch([
      db.prepare(`UPDATE auth_users SET display_name = ?, updated_at = ? WHERE id = ?`).bind(input.displayName, now, user.id),
      db.prepare(`UPDATE profiles SET nickname = ?, updated_at = ? WHERE id = ?`).bind(input.displayName, now, user.id),
      securityEventStatement(db, user.id, user.id, "auth.profile.renamed", {}, now),
    ]);
  }
}

export async function listOwnSessions(db: ClassroomD1, current: AuthSessionUser): Promise<AuthSessionSummary[]> {
  const result = await db.prepare(
    `SELECT id, user_agent, remember, expires_at, last_seen_at, created_at
     FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
     ORDER BY last_seen_at DESC`,
  ).bind(current.userId, nowIso()).all<{
    id: string; user_agent: string; remember: number; expires_at: string; last_seen_at: string; created_at: string;
  }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    current: row.id === current.sessionId,
    userAgent: friendlyUserAgent(row.user_agent),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  }));
}

export async function revokeSession(db: ClassroomD1, current: AuthSessionUser, sessionId: string): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  ).bind(nowIso(), sessionId, current.userId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function revokeCurrentSession(db: ClassroomD1, cookieHeader: string | null): Promise<void> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await hashSecret(token);
  await db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`).bind(nowIso(), tokenHash).run();
}

/** Learner lookup for the deliberately small DM password-assistance console. */
export async function listManagedUsers(
  db: ClassroomD1,
  actor: AuthSessionUser,
  query = "",
): Promise<ManagedAuthUser[]> {
  requireManager(actor);
  const normalized = query.trim().toLowerCase().slice(0, 80);
  const values: unknown[] = [nowIso()];
  let scope = `u.role IN ('learner', 'observer')`;
  if (actor.role === "mentor") {
    scope += ` AND (
      EXISTS (
        SELECT 1 FROM memberships dm
        JOIN memberships target ON target.room_id = dm.room_id
        WHERE dm.profile_id = ? AND dm.role = 'dm' AND dm.status = 'active'
          AND target.profile_id = u.id AND target.status = 'active'
      ) OR EXISTS (
        SELECT 1 FROM memberships dm
        JOIN teams t ON t.room_id = dm.room_id
        JOIN team_join_requests jr ON jr.team_id = t.id
        WHERE dm.profile_id = ? AND dm.role = 'dm' AND dm.status = 'active'
          AND jr.profile_id = u.id AND jr.status = 'pending'
      )
    )`;
    values.push(actor.userId, actor.userId);
  }
  if (normalized) {
    const pattern = `%${escapeLike(normalized)}%`;
    scope += ` AND (LOWER(u.username) LIKE ? ESCAPE '\\' OR LOWER(u.display_name) LIKE ? ESCAPE '\\')`;
    values.push(pattern, pattern);
  }
  const result = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, u.created_at,
            COUNT(CASE WHEN s.revoked_at IS NULL AND s.expires_at > ? THEN 1 END) AS active_sessions,
            MAX(CASE WHEN s.revoked_at IS NULL THEN s.last_seen_at END) AS last_seen_at
     FROM auth_users u
     LEFT JOIN auth_sessions s ON s.user_id = u.id
     WHERE ${scope}
     GROUP BY u.id
     ORDER BY CASE u.status WHEN 'active' THEN 0 ELSE 1 END, u.created_at DESC
     LIMIT 50`,
  ).bind(...values).all<{
    id: string; username: string; display_name: string; role: AuthRole; status: "active" | "disabled";
    active_sessions: number; created_at: string; last_seen_at: string | null;
  }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    activeSessions: Number(row.active_sessions),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export async function setManagedUserStatus(
  db: ClassroomD1,
  actor: AuthSessionUser,
  targetId: string,
  status: "active" | "disabled",
): Promise<void> {
  assertAuth(actor.role === "admin", "ADMIN_REQUIRED", "只有管理员可以停用或恢复账号。", 403);
  assertAuth(targetId !== actor.userId, "SELF_DISABLE_FORBIDDEN", "不能停用当前登录的管理员账号。", 400);
  const target = await getUserById(db, targetId);
  assertAuth(target, "USER_NOT_FOUND", "没有找到目标账号。", 404);
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, targetId),
    ...(status === "disabled"
      ? [db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(now, targetId)]
      : []),
    securityEventStatement(db, targetId, actor.userId, `auth.user.${status}`, {}, now),
  ]);
}

export function sessionCookie(token: string, remember: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${cookiePath()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (remember) parts.push(`Max-Age=${Math.floor(REMEMBERED_SESSION_MS / 1_000)}`);
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=${cookiePath()}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function requireManager(user: AuthSessionUser): void {
  assertAuth(user.role === "admin" || user.role === "mentor", "MANAGER_REQUIRED", "此操作需要导师或管理员权限。", 403);
}

async function mentorCanManageLearner(db: ClassroomD1, mentorId: string, learnerId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS allowed
     FROM memberships dm
     WHERE dm.profile_id = ? AND dm.role = 'dm' AND dm.status = 'active'
       AND (
         EXISTS (
           SELECT 1 FROM memberships target
           WHERE target.room_id = dm.room_id AND target.profile_id = ? AND target.status = 'active'
         ) OR EXISTS (
           SELECT 1 FROM teams t
           JOIN team_join_requests jr ON jr.team_id = t.id
           WHERE t.room_id = dm.room_id AND jr.profile_id = ? AND jr.status = 'pending'
         )
       )
     LIMIT 1`,
  ).bind(mentorId, learnerId, learnerId).first<{ allowed: number }>();
  return Boolean(row);
}

function cookiePath(): string {
  return process.env.MSV_APP_BASE_PATH || "/";
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function issueSession(db: ClassroomD1, user: UserRow, remember: boolean, userAgent: string): Promise<IssuedSession> {
  const session = await newSession(user.id, remember, userAgent, nowIso());
  await sessionInsert(db, session).run();
  return { user: sessionUserFrom(user, session), token: session.token, remember };
}

type NewSession = {
  id: string;
  userId: string;
  token: string;
  tokenHash: string;
  userAgent: string;
  remember: boolean;
  expiresAt: string;
  now: string;
};

async function newSession(userId: string, remember: boolean, userAgent: string, now: string): Promise<NewSession> {
  const token = randomSecret(32);
  return {
    id: crypto.randomUUID(), userId, token, tokenHash: await hashSecret(token),
    userAgent: userAgent.slice(0, 240), remember,
    expiresAt: new Date(Date.parse(now) + (remember ? REMEMBERED_SESSION_MS : DEFAULT_SESSION_MS)).toISOString(), now,
  };
}

function sessionInsert(db: ClassroomD1, session: NewSession): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_sessions
     (id, user_id, token_hash, user_agent, remember, expires_at, last_seen_at, revoked_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).bind(
    session.id, session.userId, session.tokenHash, session.userAgent,
    session.remember ? 1 : 0, session.expiresAt, session.now, session.now,
  );
}

function sessionUser(row: SessionRow): AuthSessionUser {
  return {
    userId: row.user_id, username: row.username, displayName: row.display_name, role: row.role,
    mustChangePassword: Boolean(row.must_change_password), sessionId: row.id, sessionExpiresAt: row.expires_at,
  };
}

function sessionUserFrom(user: UserRow, session: NewSession): AuthSessionUser {
  return {
    userId: user.id, username: user.username, displayName: user.display_name, role: user.role,
    mustChangePassword: Boolean(user.must_change_password), sessionId: session.id, sessionExpiresAt: session.expiresAt,
  };
}

async function getUserByUsername(db: ClassroomD1, username: string): Promise<UserRow | null> {
  return db.prepare(`SELECT * FROM auth_users WHERE username = ? LIMIT 1`).bind(username).first<UserRow>();
}

async function getUserById(db: ClassroomD1, id: string): Promise<UserRow | null> {
  return db.prepare(`SELECT * FROM auth_users WHERE id = ? LIMIT 1`).bind(id).first<UserRow>();
}

async function consumeRateLimit(db: ClassroomD1, scope: string, subject: string, limit: number): Promise<string> {
  const keyHash = await hashSecret(`${scope}|${subject}`);
  const now = Date.now();
  const row = await db.prepare(
    `SELECT attempts, window_started_at, blocked_until FROM auth_rate_limits WHERE key_hash = ?`,
  ).bind(keyHash).first<{ attempts: number; window_started_at: string; blocked_until: string | null }>();
  if (row?.blocked_until && Date.parse(row.blocked_until) > now) {
    throw new AuthError(
      "RATE_LIMITED", "尝试次数过多，请15分钟后再试。", 429,
      { retryAfterSeconds: Math.ceil((Date.parse(row.blocked_until) - now) / 1_000) },
    );
  }
  const sameWindow = row && now - Date.parse(row.window_started_at) < RATE_WINDOW_MS;
  const attempts = sameWindow ? row.attempts + 1 : 1;
  const blockedUntil = attempts > limit ? new Date(now + RATE_BLOCK_MS).toISOString() : null;
  const timestamp = new Date(now).toISOString();
  await db.prepare(
    `INSERT INTO auth_rate_limits (key_hash, scope, attempts, window_started_at, blocked_until, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(key_hash) DO UPDATE SET scope = excluded.scope, attempts = excluded.attempts,
       window_started_at = excluded.window_started_at, blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`,
  ).bind(keyHash, scope, attempts, sameWindow ? row!.window_started_at : timestamp, blockedUntil, timestamp).run();
  if (blockedUntil) throw new AuthError("RATE_LIMITED", "尝试次数过多，请15分钟后再试。", 429, { retryAfterSeconds: 900 });
  return keyHash;
}

async function clearRateLimit(db: ClassroomD1, keyHash: string): Promise<void> {
  await db.prepare(`DELETE FROM auth_rate_limits WHERE key_hash = ?`).bind(keyHash).run();
}

async function securityEvent(
  db: ClassroomD1,
  userId: string | null,
  actorUserId: string | null,
  action: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await securityEventStatement(db, userId, actorUserId, action, detail, nowIso()).run();
}

function securityEventStatement(
  db: ClassroomD1,
  userId: string | null,
  actorUserId: string | null,
  action: string,
  detail: Record<string, unknown>,
  now: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_security_events (id, user_id, actor_user_id, action, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), userId, actorUserId, action, JSON.stringify(detail), now);
}

function friendlyUserAgent(value: string): string {
  if (/iPhone|iPad/i.test(value)) return "Safari · iPhone/iPad";
  if (/Android/i.test(value)) return /Chrome/i.test(value) ? "Chrome · Android" : "Android 浏览器";
  if (/Edg\//i.test(value)) return "Microsoft Edge · 电脑";
  if (/Chrome\//i.test(value)) return "Chrome · 电脑";
  if (/Safari\//i.test(value)) return "Safari · Mac";
  if (/Firefox\//i.test(value)) return "Firefox · 电脑";
  return value === "未知设备" ? value : "网页浏览器";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function nowIso(): string {
  return new Date().toISOString();
}
