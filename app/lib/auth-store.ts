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
  AuthImpersonationContext,
  AuthBrowserAccountSetSummary,
  AuthBrowserAccountStatus,
  AuthRole,
  IssuedManagedCredential,
  AuthSessionSummary,
  AuthSessionUser,
  ManagedAuthUser,
} from "./auth-model";
import { parseDisplayName, parseRole, parseUsername } from "./auth-validation";

const SESSION_COOKIE = "__Secure-msv_session";
const BROWSER_ACCOUNT_COOKIE = "__Secure-msv_accounts";
const DEFAULT_SESSION_MS = 12 * 60 * 60 * 1_000;
const REMEMBERED_SESSION_MS = 30 * 24 * 60 * 60 * 1_000;
// Preserve only the minimal account-picker metadata after an individual login
// expires. This lets the browser show "需要重新验证" instead of silently
// forgetting the account. The cookie remains session-only unless the user
// explicitly selected "保持登录" for at least one account.
const BROWSER_SET_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
const SESSION_TOUCH_MS = 5 * 60 * 1_000;
const RESET_LINK_MS = 30 * 60 * 1_000;
const RATE_WINDOW_MS = 15 * 60 * 1_000;
const RATE_BLOCK_MS = 15 * 60 * 1_000;
const IMPERSONATION_MS = 30 * 60 * 1_000;
const DUMMY_SALT = "AAAAAAAAAAAAAAAAAAAAAA";
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const MAX_BROWSER_ACCOUNTS = 8;

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: AuthRole;
  status: "active" | "disabled";
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  password_changed_at: string;
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

type ImpersonationRow = {
  id: string;
  classroom_id: string;
  expires_at: string;
  last_seen_at: string;
  actor_user_id: string;
  effective_user_id: string;
  username: string;
  display_name: string;
  role: AuthRole;
  status: "active" | "disabled";
  environment: "test" | "production" | null;
  has_scope: number;
  actor_has_scope: number;
};

export type IssuedSession = {
  user: AuthSessionUser;
  token: string;
  remember: boolean;
  browserSet?: IssuedBrowserSet;
};

export type IssuedBrowserSet = {
  token: string;
  persistent: boolean;
  expiresAt: string;
  state: AuthBrowserAccountSetSummary;
};

type BrowserSetRow = {
  id: string;
  token_hash: string;
  active_user_id: string | null;
  active_session_id: string | null;
  version: number;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

type BrowserAccountMutationAction = "login" | "ensure" | "switch" | "logout-current" | "remove" | "logout-all";

export async function authenticateSession(db: ClassroomD1, cookieHeader: string | null): Promise<AuthSessionUser | null> {
  const browserIdentity = await authenticateBrowserSetIdentity(db, cookieHeader);
  if (browserIdentity.recognized) return browserIdentity.user;
  return authenticateLegacySession(db, cookieHeader);
}

async function authenticateLegacySession(db: ClassroomD1, cookieHeader: string | null): Promise<AuthSessionUser | null> {
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
  return resolveSessionIdentity(db, sessionUser(row));
}

async function authenticateBrowserSetIdentity(
  db: ClassroomD1,
  cookieHeader: string | null,
): Promise<{ recognized: boolean; user: AuthSessionUser | null }> {
  const token = readCookie(cookieHeader, BROWSER_ACCOUNT_COOKIE);
  if (!token || token.length < 32 || token.length > 128) return { recognized: false, user: null };
  const tokenHash = await hashSecret(token);
  const row = await db.prepare(
    `SELECT bs.id AS set_id, bs.expires_at AS set_expires_at, bs.last_seen_at AS set_last_seen_at,
            bs.revoked_at AS set_revoked_at, bs.active_user_id, bs.active_session_id,
            a.credential_version, a.expires_at AS account_expires_at,
            a.reauth_required_at, a.removed_at,
            s.id, s.user_id, s.expires_at, s.last_seen_at, s.revoked_at,
            u.username, u.display_name, u.role, u.status, u.must_change_password,
            u.password_changed_at
     FROM auth_browser_sets bs
     LEFT JOIN auth_browser_accounts a
       ON a.set_id = bs.id AND a.user_id = bs.active_user_id
     LEFT JOIN auth_browser_session_links l
       ON l.set_id = bs.id AND l.user_id = bs.active_user_id AND l.session_id = bs.active_session_id
     LEFT JOIN auth_sessions s ON s.id = l.session_id
     LEFT JOIN auth_users u ON u.id = bs.active_user_id
     WHERE bs.token_hash = ? LIMIT 1`,
  ).bind(tokenHash).first<SessionRow & {
    set_id: string;
    set_expires_at: string;
    set_last_seen_at: string;
    set_revoked_at: string | null;
    active_user_id: string | null;
    active_session_id: string | null;
    credential_version: string | null;
    account_expires_at: string | null;
    reauth_required_at: string | null;
    removed_at: string | null;
    password_changed_at: string | null;
  }>();
  if (!row) return { recognized: false, user: null };
  const now = Date.now();
  const valid = !row.set_revoked_at
    && Date.parse(row.set_expires_at) > now
    && Boolean(row.active_user_id && row.active_session_id)
    && !row.removed_at
    && !row.reauth_required_at
    && row.status === "active"
    && row.credential_version === row.password_changed_at
    && Boolean(row.account_expires_at && Date.parse(row.account_expires_at) > now)
    && !row.revoked_at
    && Date.parse(row.expires_at) > now;
  if (!valid) return { recognized: true, user: null };

  if (now - Date.parse(row.set_last_seen_at) >= SESSION_TOUCH_MS) {
    const touched = nowIso();
    await db.batch([
      db.prepare(`UPDATE auth_browser_sets SET last_seen_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL`).bind(touched, touched, row.set_id),
      db.prepare(`UPDATE auth_browser_accounts SET last_used_at = ? WHERE set_id = ? AND user_id = ? AND removed_at IS NULL`).bind(touched, row.set_id, row.user_id),
      db.prepare(`UPDATE auth_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL`).bind(touched, row.id),
    ]);
  }
  return { recognized: true, user: await resolveSessionIdentity(db, sessionUser(row)) };
}

/**
 * Replace the effective identity of one real platform-admin session for a
 * single Test Classroom.  The cookie and actor never change, and every later
 * request revalidates the target, environment and Membership/DM grant.
 */
export async function startTestImpersonation(
  db: ClassroomD1,
  current: AuthSessionUser,
  input: { classroomId: string; effectiveProfileId: string },
): Promise<AuthImpersonationContext> {
  if (current.impersonation || current.role !== "admin") {
    await auditImpersonationDenied(db, current, input, "PLATFORM_ADMIN_REQUIRED");
    throw new AuthError("PLATFORM_ADMIN_REQUIRED", "只有真实登录的平台管理员可以开始测试身份切换。", 403);
  }
  const classroomId = input.classroomId.trim();
  const effectiveProfileId = input.effectiveProfileId.trim();
  if (!classroomId || classroomId.length > 128 || !effectiveProfileId || effectiveProfileId.length > 128) {
    await auditImpersonationDenied(db, current, input, "IMPERSONATION_INPUT_INVALID");
    throw new AuthError("IMPERSONATION_INPUT_INVALID", "测试课堂或目标账号无效。", 400);
  }
  const target = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, ci.environment,
            CASE WHEN EXISTS (
              SELECT 1 FROM memberships m
              WHERE m.room_id = ci.room_id AND m.profile_id = u.id AND m.status = 'active'
            ) OR EXISTS (
              SELECT 1 FROM classroom_admin_dm_grants g
              WHERE g.room_id = ci.room_id AND g.profile_id = u.id AND g.revoked_at IS NULL
            ) THEN 1 ELSE 0 END AS has_scope
     FROM classroom_instances ci
     JOIN auth_users u ON u.id = ?
     WHERE ci.room_id = ?
       AND EXISTS (
         SELECT 1 FROM classroom_admin_dm_grants actor_grant
         WHERE actor_grant.room_id = ci.room_id AND actor_grant.profile_id = ?
           AND actor_grant.revoked_at IS NULL
       )`,
  ).bind(effectiveProfileId, classroomId, current.userId).first<{
    id: string;
    username: string;
    display_name: string;
    role: AuthRole;
    status: "active" | "disabled";
    environment: "test" | "production";
    has_scope: number;
  }>();
  if (!target) {
    await auditImpersonationDenied(db, current, input, "CLASSROOM_OR_ACCOUNT_NOT_FOUND");
    throw new AuthError("CLASSROOM_OR_ACCOUNT_NOT_FOUND", "没有找到这个测试课堂或目标账号。", 404);
  }
  if (target.environment !== "test") {
    await auditImpersonationDenied(db, current, input, "IMPERSONATION_PRODUCTION_FORBIDDEN");
    throw new AuthError("IMPERSONATION_PRODUCTION_FORBIDDEN", "测试身份不能进入 Production Classroom。", 403);
  }
  if (target.role === "admin") {
    await auditImpersonationDenied(db, current, input, "IMPERSONATION_ADMIN_FORBIDDEN");
    throw new AuthError("IMPERSONATION_ADMIN_FORBIDDEN", "不能模拟其他平台管理员。", 403);
  }
  if (target.status !== "active" || !target.has_scope) {
    await auditImpersonationDenied(db, current, input, "IMPERSONATION_MEMBERSHIP_REQUIRED");
    throw new AuthError("IMPERSONATION_MEMBERSHIP_REQUIRED", "目标账号不是这个 Test Classroom 的有效成员或 Admin DM。", 403);
  }

  const now = nowIso();
  const expiresAt = new Date(Date.parse(now) + IMPERSONATION_MS).toISOString();
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare(
      `UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'replaced'
       WHERE session_id = ? AND revoked_at IS NULL`,
    ).bind(now, current.sessionId),
    db.prepare(
      `INSERT INTO auth_impersonations
       (id, session_id, actor_user_id, effective_user_id, classroom_id, expires_at,
        last_seen_at, revoked_at, end_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    ).bind(id, current.sessionId, current.userId, target.id, classroomId, expiresAt, now, now),
    securityEventStatement(db, target.id, current.userId, "auth.impersonation.started", {
      impersonationId: id,
      classroomId,
      actorProfileId: current.userId,
      effectiveProfileId: target.id,
      expiresAt,
    }, now),
  ]);
  return {
    id,
    classroomId,
    expiresAt,
    actor: identitySummary(current) as AuthImpersonationContext["actor"],
    effective: {
      userId: target.id,
      username: target.username,
      displayName: target.display_name,
      role: target.role,
    } as AuthImpersonationContext["effective"],
  };
}

export async function stopTestImpersonation(
  db: ClassroomD1,
  current: AuthSessionUser,
  reason: "returned" | "logout" = "returned",
): Promise<boolean> {
  const context = current.impersonation;
  if (!context) return false;
  const now = nowIso();
  const result = await db.prepare(
    `UPDATE auth_impersonations SET revoked_at = ?, end_reason = ?
     WHERE id = ? AND session_id = ? AND actor_user_id = ? AND revoked_at IS NULL`,
  ).bind(now, reason, context.id, current.sessionId, context.actor.userId).run();
  const stopped = Number(result.meta?.changes ?? 0) === 1;
  if (stopped) {
    await securityEvent(db, context.effective.userId, context.actor.userId, "auth.impersonation.stopped", {
      impersonationId: context.id,
      classroomId: context.classroomId,
      actorProfileId: context.actor.userId,
      effectiveProfileId: context.effective.userId,
      expiresAt: context.expiresAt,
      reason,
    });
  }
  return stopped;
}

async function resolveSessionIdentity(db: ClassroomD1, actor: AuthSessionUser): Promise<AuthSessionUser> {
  const row = await db.prepare(
    `SELECT i.id, i.classroom_id, i.expires_at, i.last_seen_at, i.actor_user_id, i.effective_user_id,
            u.username, u.display_name, u.role, u.status, ci.environment,
            CASE WHEN EXISTS (
              SELECT 1 FROM memberships m
              WHERE m.room_id = i.classroom_id AND m.profile_id = i.effective_user_id AND m.status = 'active'
            ) OR EXISTS (
              SELECT 1 FROM classroom_admin_dm_grants g
              WHERE g.room_id = i.classroom_id AND g.profile_id = i.effective_user_id AND g.revoked_at IS NULL
            ) THEN 1 ELSE 0 END AS has_scope,
            CASE WHEN EXISTS (
              SELECT 1 FROM classroom_admin_dm_grants actor_grant
              WHERE actor_grant.room_id = i.classroom_id
                AND actor_grant.profile_id = i.actor_user_id
                AND actor_grant.revoked_at IS NULL
                AND actor_grant.delegation_mode = 'primary'
                AND actor_grant.can_delegate = 1
            ) THEN 1 ELSE 0 END AS actor_has_scope
     FROM auth_impersonations i
     JOIN auth_users u ON u.id = i.effective_user_id
     LEFT JOIN classroom_instances ci ON ci.room_id = i.classroom_id
     WHERE i.session_id = ? AND i.revoked_at IS NULL
     ORDER BY i.created_at DESC LIMIT 1`,
  ).bind(actor.sessionId).first<ImpersonationRow>();
  if (!row) return actor;

  const reason = actor.role !== "admin" || row.actor_user_id !== actor.userId
    ? "actor-invalid"
    : !row.actor_has_scope
      ? "actor-grant-revoked"
      : row.role === "admin"
        ? "admin-target-invalid"
        : row.status !== "active"
          ? "target-disabled"
          : row.environment !== "test"
            ? "test-scope-invalid"
            : !row.has_scope
              ? "membership-revoked"
              : Date.parse(row.expires_at) <= Date.now()
                ? "expired"
                : null;
  if (reason) {
    await closeInvalidImpersonation(db, actor, row, reason);
    return actor;
  }
  if (Date.now() - Date.parse(row.last_seen_at) >= SESSION_TOUCH_MS) {
    await db.prepare(
      `UPDATE auth_impersonations SET last_seen_at = ?
       WHERE id = ? AND revoked_at IS NULL AND expires_at > ?`,
    ).bind(nowIso(), row.id, nowIso()).run();
  }
  const context: AuthImpersonationContext = {
    id: row.id,
    classroomId: row.classroom_id,
    expiresAt: row.expires_at,
    actor: identitySummary(actor) as AuthImpersonationContext["actor"],
    effective: {
      userId: row.effective_user_id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    } as AuthImpersonationContext["effective"],
  };
  return {
    ...actor,
    userId: row.effective_user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    // An administrator may inspect an account that still has a one-time
    // credential without learning or replacing that credential.
    mustChangePassword: false,
    impersonation: context,
  };
}

async function closeInvalidImpersonation(
  db: ClassroomD1,
  actor: AuthSessionUser,
  row: ImpersonationRow,
  reason: string,
): Promise<void> {
  const now = nowIso();
  const result = await db.prepare(
    `UPDATE auth_impersonations SET revoked_at = ?, end_reason = ? WHERE id = ? AND revoked_at IS NULL`,
  ).bind(now, reason, row.id).run();
  if (Number(result.meta?.changes ?? 0) === 1) {
    await securityEvent(db, row.effective_user_id, actor.userId, "auth.impersonation.ended", {
      impersonationId: row.id,
      classroomId: row.classroom_id,
      actorProfileId: actor.userId,
      effectiveProfileId: row.effective_user_id,
      expiresAt: row.expires_at,
      reason,
    });
  }
}

async function auditImpersonationDenied(
  db: ClassroomD1,
  current: AuthSessionUser,
  input: { classroomId: string; effectiveProfileId: string },
  reason: string,
): Promise<void> {
  const actor = current.impersonation?.actor ?? identitySummary(current);
  await securityEvent(db, null, actor.userId, "auth.impersonation.denied", {
    classroomId: input.classroomId.slice(0, 128),
    requestedEffectiveProfileId: input.effectiveProfileId.slice(0, 128),
    actorProfileId: actor.userId,
    currentEffectiveProfileId: current.userId,
    impersonationId: current.impersonation?.id ?? null,
    expiresAt: current.impersonation?.expiresAt ?? null,
    reason,
  });
}

function identitySummary(user: Pick<AuthSessionUser, "userId" | "username" | "displayName" | "role">) {
  return { userId: user.userId, username: user.username, displayName: user.displayName, role: user.role };
}

export async function loginWithPassword(
  db: ClassroomD1,
  input: { username: string; password: string; remember: boolean; fingerprint: string; userAgent: string; cookieHeader?: string | null },
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
  try {
    issued.browserSet = await attachIssuedSessionWithRetry(db, issued, input.cookieHeader ?? null, "login");
  } catch (error) {
    // The account-list transaction is all-or-nothing.  If it loses a CAS race,
    // the newly minted but undisclosed session is revoked and the previously
    // active browser identity remains authoritative.
    await db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`).bind(nowIso(), issued.user.sessionId).run();
    throw normalizeBrowserMutationError(error);
  }
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
    cookieHeader?: string | null;
  },
): Promise<IssuedSession> {
  await consumeRateLimit(db, "registration", input.fingerprint, 5);
  assertAuth(!(await getUserByUsername(db, input.username)), "USERNAME_TAKEN", "这个用户名已经有人使用。", 409);
  await assertBrowserAccountCapacity(db, input.cookieHeader ?? null, null);

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
  const issued: IssuedSession = { user: sessionUserFrom(row, session), token: session.token, remember: input.remember };
  issued.browserSet = await attachIssuedSessionWithRetry(db, issued, input.cookieHeader ?? null, "login");
  return issued;
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
      `SELECT g.id, ca.archived_at
       FROM classroom_admin_dm_grants g
       LEFT JOIN classroom_archives ca ON ca.room_id = g.room_id
       WHERE g.room_id = ? AND g.profile_id = ? AND g.revoked_at IS NULL`,
    ).bind(roomId, actor.userId).first<{ id: string; archived_at: string | null }>();
    assertAuth(permission, "CLASSROOM_ADMIN_REQUIRED", "此操作需要本课堂 Admin DM 权限。", 403);
    assertAuth(!permission.archived_at, "CLASSROOM_ARCHIVED", "这场 Test Classroom 已归档并永久只读，不能再创建课堂账号。", 409);
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

export type TestIdentityAccountAction = "disable" | "activate" | "reset-credential";

/**
 * Audited platform-admin recovery for an explicitly administered Test
 * Classroom. It never accepts an administrator target and never writes a
 * clear credential to storage or audit logs.
 */
export async function manageTestClassroomIdentity(
  db: ClassroomD1,
  actor: { userId: string; platformRole?: AuthRole | null; impersonationId?: string | null },
  input: { classroomId: string; targetProfileId: string; action: TestIdentityAccountAction },
): Promise<{
  action: TestIdentityAccountAction;
  status: "active" | "disabled";
  credential?: IssuedManagedCredential;
}> {
  assertAuth(!actor.impersonationId && actor.platformRole === "admin", "PLATFORM_ADMIN_REQUIRED", "只有真实登录的平台管理员可以管理测试账号。", 403);
  const classroomId = input.classroomId.trim();
  const targetProfileId = input.targetProfileId.trim();
  assertAuth(classroomId && classroomId.length <= 128 && targetProfileId && targetProfileId.length <= 128, "TEST_IDENTITY_INPUT_INVALID", "测试课堂或目标账号无效。", 400);
  const target = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, ci.environment, ca.archived_at,
            target_grant.delegation_mode AS admin_dm_mode,
            CASE WHEN actor_grant.id IS NULL THEN 0 ELSE 1 END AS actor_is_admin_dm,
            CASE WHEN m.id IS NOT NULL OR target_grant.id IS NOT NULL THEN 1 ELSE 0 END AS target_has_scope
     FROM classroom_instances ci
     JOIN auth_users u ON u.id = ?
     LEFT JOIN memberships m
       ON m.room_id = ci.room_id AND m.profile_id = u.id AND m.status = 'active'
     LEFT JOIN classroom_admin_dm_grants target_grant
       ON target_grant.room_id = ci.room_id AND target_grant.profile_id = u.id AND target_grant.revoked_at IS NULL
     LEFT JOIN classroom_admin_dm_grants actor_grant
       ON actor_grant.room_id = ci.room_id AND actor_grant.profile_id = ? AND actor_grant.revoked_at IS NULL
     LEFT JOIN classroom_archives ca ON ca.room_id = ci.room_id
     WHERE ci.room_id = ?`,
  ).bind(targetProfileId, actor.userId, classroomId).first<{
    id: string;
    username: string;
    display_name: string;
    role: AuthRole;
    status: "active" | "disabled";
    environment: "test" | "production";
    archived_at: string | null;
    admin_dm_mode: "primary" | "delegated" | null;
    actor_is_admin_dm: number;
    target_has_scope: number;
  }>();
  assertAuth(target, "TEST_IDENTITY_NOT_FOUND", "没有找到这个课堂测试账号。", 404);
  assertAuth(target.environment === "test", "TEST_CLASSROOM_REQUIRED", "账号恢复只能用于 Test Classroom。", 403);
  assertAuth(target.actor_is_admin_dm, "CLASSROOM_ADMIN_REQUIRED", "平台管理员必须显式拥有本课堂 Admin DM 权限。", 403);
  assertAuth(!target.archived_at, "CLASSROOM_ARCHIVED", "这场 Test Classroom 已归档并永久只读，不能再管理测试账号。", 409);
  assertAuth(target.role !== "admin" && target.target_has_scope, "TEST_IDENTITY_TARGET_FORBIDDEN", "目标必须是本 Test Classroom 的非管理员成员。", 403);
  if (input.action === "disable") {
    assertAuth(target.admin_dm_mode !== "primary", "PRIMARY_ADMIN_DM_DISABLE_FORBIDDEN", "不能停用本课堂 Primary Admin DM。", 403);
    const now = nowIso();
    await db.batch([
      db.prepare(`UPDATE auth_users SET status = 'disabled', updated_at = ? WHERE id = ?`).bind(now, target.id),
      db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(now, target.id),
      db.prepare(
        `UPDATE auth_browser_accounts SET reauth_required_at = COALESCE(reauth_required_at, ?)
         WHERE user_id = ? AND removed_at IS NULL`,
      ).bind(now, target.id),
      db.prepare(
        `UPDATE auth_browser_sets SET active_user_id = NULL, active_session_id = NULL,
             version = version + 1, last_seen_at = ?, updated_at = ?
         WHERE active_user_id = ?`,
      ).bind(now, now, target.id),
      db.prepare(`UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'target-disabled' WHERE effective_user_id = ? AND revoked_at IS NULL`).bind(now, target.id),
      securityEventStatement(db, target.id, actor.userId, "auth.test-identity.disabled", { classroomId }, now),
    ]);
    return { action: input.action, status: "disabled" };
  }
  if (input.action === "activate") {
    const now = nowIso();
    await db.batch([
      db.prepare(`UPDATE auth_users SET status = 'active', updated_at = ? WHERE id = ?`).bind(now, target.id),
      securityEventStatement(db, target.id, actor.userId, "auth.test-identity.activated", { classroomId }, now),
    ]);
    return { action: input.action, status: "active" };
  }
  assertAuth(input.action === "reset-credential", "TEST_IDENTITY_ACTION_INVALID", "未知测试账号操作。", 400);
  assertAuth(target.status === "active", "TEST_IDENTITY_DISABLED", "请先启用账号，再生成一次性凭据。", 409);
  const initialPassword = `Msv!${randomSecret(18)}`;
  const password = await createPasswordDigest(initialPassword);
  const now = nowIso();
  await db.batch([
    db.prepare(
      `UPDATE auth_users SET password_hash = ?, password_salt = ?, password_iterations = ?,
       password_changed_at = ?, must_change_password = 1, updated_at = ? WHERE id = ?`,
    ).bind(password.hash, password.salt, password.iterations, now, now, target.id),
    db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(now, target.id),
    db.prepare(
      `UPDATE auth_browser_accounts SET reauth_required_at = COALESCE(reauth_required_at, ?)
       WHERE user_id = ? AND removed_at IS NULL`,
    ).bind(now, target.id),
    db.prepare(
      `UPDATE auth_browser_sets SET active_user_id = NULL, active_session_id = NULL,
           version = version + 1, last_seen_at = ?, updated_at = ?
       WHERE active_user_id = ?`,
    ).bind(now, now, target.id),
    db.prepare(`UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'credential-reset' WHERE effective_user_id = ? AND revoked_at IS NULL`).bind(now, target.id),
    db.prepare(`UPDATE auth_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`).bind(now, target.id),
    securityEventStatement(db, target.id, actor.userId, "auth.test-credential.regenerated", { classroomId }, now),
  ]);
  return {
    action: input.action,
    status: "active",
    credential: {
      userId: target.id,
      username: target.username,
      displayName: target.display_name,
      role: target.role as Exclude<AuthRole, "admin">,
      initialPassword,
      mustChangePassword: true,
    },
  };
}

/** Returns the clear token exactly once; D1 stores only its SHA-256 digest. */
export async function issuePasswordResetToken(
  db: ClassroomD1,
  actor: AuthSessionUser,
  username: string,
): Promise<{ username: string; displayName: string; token: string; expiresAt: string }> {
  requireDirectSession(actor);
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
  input: { token: string; newPassword: string; fingerprint: string; userAgent: string; cookieHeader?: string | null },
): Promise<IssuedSession> {
  const tokenHash = await hashSecret(input.token);
  const rateKey = await consumeRateLimit(db, "password-reset-link", `${input.fingerprint}|${tokenHash.slice(0, 16)}`, 6);
  // Pay the derivation cost before lookup to reduce token-validity timing differences.
  const password = await createPasswordDigest(input.newPassword);
  const now = nowIso();
  const row = await db.prepare(
    `SELECT rt.id AS reset_token_id, rt.expires_at AS reset_expires_at,
            u.id, u.username, u.display_name, u.role, u.status, u.password_hash,
            u.password_salt, u.password_iterations, u.password_changed_at, u.must_change_password,
            u.created_at, u.updated_at
     FROM auth_reset_tokens rt
     JOIN auth_users u ON u.id = rt.user_id
     WHERE rt.token_hash = ? AND rt.consumed_at IS NULL AND rt.expires_at > ?
       AND u.status = 'active' AND u.role IN ('learner', 'observer')
     LIMIT 1`,
  ).bind(tokenHash, now).first<ResetTokenRow>();
  if (!row) throw new AuthError("RESET_LINK_INVALID", "重置链接无效、已使用或已经过期。", 401);
  await assertBrowserAccountCapacity(db, input.cookieHeader ?? null, row.id);

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
  const issued: IssuedSession = { user: sessionUserFrom({ ...row, password_changed_at: now }, session), token: session.token, remember: false };
  issued.browserSet = await attachIssuedSessionWithRetry(db, issued, input.cookieHeader ?? null, "login");
  return issued;
}

export async function updateOwnProfile(
  db: ClassroomD1,
  current: AuthSessionUser,
  input: { displayName?: string; currentPassword?: string; newPassword?: string },
): Promise<void> {
  requireDirectSession(current);
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
      db.prepare(
        `UPDATE auth_browser_accounts SET reauth_required_at = COALESCE(reauth_required_at, ?)
         WHERE user_id = ? AND removed_at IS NULL`,
      ).bind(now, user.id),
      db.prepare(
        `UPDATE auth_browser_accounts
         SET credential_version = ?, reauth_required_at = NULL, last_used_at = ?
         WHERE user_id = ? AND removed_at IS NULL AND set_id IN (
           SELECT set_id FROM auth_browser_session_links WHERE session_id = ?
         )`,
      ).bind(now, now, user.id, current.sessionId),
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
  if (current.impersonation) return [];
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

export async function getBrowserAccountSetState(
  db: ClassroomD1,
  cookieHeader: string | null,
): Promise<AuthBrowserAccountSetSummary | null> {
  const resolved = await resolveBrowserSet(db, cookieHeader);
  if (!resolved) return null;
  return (await browserSetProjection(db, resolved.row)).state;
}

/** Upgrade one pre-T-106 session into a server-side browser account set. */
export async function ensureBrowserAccountSet(
  db: ClassroomD1,
  current: AuthSessionUser,
  cookieHeader: string | null,
): Promise<IssuedBrowserSet> {
  requireDirectSession(current);
  const existing = await resolveBrowserSet(db, cookieHeader);
  if (existing) {
    const projection = await browserSetProjection(db, existing.row);
    assertAuth(
      projection.state.currentUserId === current.userId,
      "ACCOUNT_SET_IDENTITY_CHANGED",
      "这个页面的账号已经在其他标签页切换，请刷新后再操作。",
      409,
    );
    return { token: existing.token, ...projection };
  }

  const credential = await db.prepare(
    `SELECT s.remember, s.expires_at, s.revoked_at, u.password_changed_at, u.status
     FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.id = ? AND s.user_id = ?`,
  ).bind(current.sessionId, current.userId).first<{
    remember: number; expires_at: string; revoked_at: string | null;
    password_changed_at: string; status: "active" | "disabled";
  }>();
  assertAuth(
    credential && !credential.revoked_at && credential.status === "active" && Date.parse(credential.expires_at) > Date.now(),
    "AUTH_REQUIRED",
    "当前登录已经失效，请重新登录。",
    401,
  );
  const token = randomSecret(32);
  const tokenHash = await hashSecret(token);
  const setId = `browser_${crypto.randomUUID()}`;
  const now = nowIso();
  await db.batch([
    db.prepare(
      `INSERT INTO auth_browser_sets
       (id, token_hash, active_user_id, active_session_id, version, expires_at,
        last_seen_at, revoked_at, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, 1, ?, ?, NULL, ?, ?)`,
    ).bind(setId, tokenHash, browserSetRetentionUntil(now), now, now, now),
    browserAccountUpsert(db, setId, current.userId, credential.password_changed_at, Boolean(credential.remember), credential.expires_at, now),
    db.prepare(
      `INSERT INTO auth_browser_session_links (session_id, set_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(current.sessionId, setId, current.userId, now),
    db.prepare(
      `UPDATE auth_browser_sets SET active_user_id = ?, active_session_id = ?, updated_at = ?
       WHERE id = ? AND version = 1`,
    ).bind(current.userId, current.sessionId, now, setId),
    securityEventStatement(db, current.userId, current.userId, "auth.browser-set.created", { setId, source: "legacy-session" }, now),
  ]);
  const row = await browserSetById(db, setId);
  if (!row) throw new AuthError("ACCOUNT_SET_CREATE_FAILED", "账号列表没有完成初始化，请重试。", 500);
  return { token, ...(await browserSetProjection(db, row)) };
}

export type SwitchBrowserAccountResult = {
  user: AuthSessionUser;
  sessionToken: string | null;
  remember: boolean;
  browserSet: IssuedBrowserSet;
  idempotent: boolean;
};

export async function switchBrowserAccount(
  db: ClassroomD1,
  cookieHeader: string | null,
  input: { targetUserId: string; expectedVersion: number; idempotencyKey: string; userAgent: string },
): Promise<SwitchBrowserAccountResult> {
  const resolved = await requireBrowserSet(db, cookieHeader);
  assertBrowserMutationInput(input.expectedVersion, input.idempotencyKey);
  const replay = await browserSwitchReplay(db, resolved, input);
  if (replay) return replay;
  if (resolved.row.version !== input.expectedVersion) throw browserSetConflict();
  await assertNoBrowserSetImpersonation(db, resolved.row);

  const target = await browserAccountCredential(db, resolved.row.id, input.targetUserId);
  assertAuth(target && !target.removed_at, "ACCOUNT_NOT_IN_BROWSER", "这个账号不在当前浏览器的已登录列表中。", 404);
  const status = browserAccountStatus(target);
  assertAuth(status === "available", "ACCOUNT_REAUTHENTICATION_REQUIRED", accountStatusMessage(status), 409);
  const session = await newSessionUntil(
    target.id,
    Boolean(target.remember),
    input.userAgent,
    target.expires_at,
    nowIso(),
  );
  const mutationId = crypto.randomUUID();
  const now = session.now;
  try {
    await db.batch([
      browserMutationClaim(db, mutationId, resolved.row.id, "switch", target.id, input.expectedVersion, input.idempotencyKey, now),
      browserMutationAssertion(db, mutationId, now),
      db.prepare(
        `UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'account-switch'
         WHERE session_id IN (SELECT session_id FROM auth_browser_session_links WHERE set_id = ?)
           AND revoked_at IS NULL`,
      ).bind(now, resolved.row.id),
      db.prepare(
        `UPDATE auth_sessions SET revoked_at = ?
         WHERE id IN (SELECT session_id FROM auth_browser_session_links WHERE set_id = ?)
           AND revoked_at IS NULL`,
      ).bind(now, resolved.row.id),
      sessionInsert(db, session),
      db.prepare(
        `INSERT INTO auth_browser_session_links (session_id, set_id, user_id, created_at)
         VALUES (?, ?, ?, ?)`,
      ).bind(session.id, resolved.row.id, target.id, now),
      db.prepare(
        `UPDATE auth_browser_accounts SET last_used_at = ?
         WHERE set_id = ? AND user_id = ? AND removed_at IS NULL`,
      ).bind(now, resolved.row.id, target.id),
      db.prepare(
        `UPDATE auth_browser_sets
         SET active_user_id = ?, active_session_id = ?, version = version + 1,
             last_seen_at = ?, updated_at = ?
         WHERE id = ? AND version = ? AND revoked_at IS NULL`,
      ).bind(target.id, session.id, now, now, resolved.row.id, input.expectedVersion),
      securityEventStatement(db, target.id, target.id, "auth.browser-account.switched", {
        setId: resolved.row.id,
        fromUserId: resolved.row.active_user_id,
        expectedVersion: input.expectedVersion,
        resultVersion: input.expectedVersion + 1,
      }, now),
    ]);
  } catch (error) {
    const won = await browserSwitchReplay(db, resolved, input);
    if (won) return won;
    throw normalizeBrowserMutationError(error);
  }
  const nextRow = await browserSetById(db, resolved.row.id);
  if (!nextRow) throw browserSetConflict();
  const browserSet = { token: resolved.token, ...(await browserSetProjection(db, nextRow)) };
  return {
    user: sessionUserFrom(target, session),
    sessionToken: session.token,
    remember: Boolean(target.remember),
    browserSet,
    idempotent: false,
  };
}

export type MutateBrowserAccountsResult = {
  browserSet: IssuedBrowserSet | null;
  clearSession: boolean;
  clearBrowserSet: boolean;
  idempotent: boolean;
};

export async function mutateBrowserAccounts(
  db: ClassroomD1,
  cookieHeader: string | null,
  input: {
    action: "logout-current" | "remove" | "logout-all";
    targetUserId?: string;
    expectedVersion: number;
    idempotencyKey: string;
  },
): Promise<MutateBrowserAccountsResult> {
  const resolved = await requireBrowserSet(db, cookieHeader);
  assertBrowserMutationInput(input.expectedVersion, input.idempotencyKey);
  const targetUserId = input.action === "logout-current" ? resolved.row.active_user_id : input.targetUserId ?? null;
  if (input.action === "remove") {
    assertAuth(targetUserId, "ACCOUNT_TARGET_REQUIRED", "请选择要从本设备移除的账号。", 400);
  }
  const replay = await browserAccountMutationReplay(db, resolved, input.action, targetUserId, input.expectedVersion, input.idempotencyKey);
  if (replay) return replay;
  if (resolved.row.version !== input.expectedVersion) throw browserSetConflict();
  await assertNoBrowserSetImpersonation(db, resolved.row);
  if (input.action === "remove") {
    const target = await browserAccountCredential(db, resolved.row.id, targetUserId!);
    assertAuth(target && !target.removed_at, "ACCOUNT_NOT_IN_BROWSER", "这个账号不在当前浏览器的已登录列表中。", 404);
  }

  const now = nowIso();
  const mutationId = crypto.randomUUID();
  const removesActive = input.action !== "remove" || targetUserId === resolved.row.active_user_id;
  try {
    const statements: D1PreparedStatement[] = [
      browserMutationClaim(db, mutationId, resolved.row.id, input.action, targetUserId, input.expectedVersion, input.idempotencyKey, now),
      browserMutationAssertion(db, mutationId, now),
    ];
    if (input.action === "logout-all" || removesActive) {
      statements.push(
        db.prepare(
          `UPDATE auth_impersonations SET revoked_at = ?, end_reason = ?
           WHERE session_id IN (SELECT session_id FROM auth_browser_session_links WHERE set_id = ?)
             AND revoked_at IS NULL`,
        ).bind(now, input.action, resolved.row.id),
        db.prepare(
          `UPDATE auth_sessions SET revoked_at = ?
           WHERE id IN (SELECT session_id FROM auth_browser_session_links WHERE set_id = ?)
             AND revoked_at IS NULL`,
        ).bind(now, resolved.row.id),
      );
    }
    if (input.action === "logout-all") {
      statements.push(
        db.prepare(
          `UPDATE auth_browser_accounts SET removed_at = COALESCE(removed_at, ?)
           WHERE set_id = ?`,
        ).bind(now, resolved.row.id),
        db.prepare(
          `UPDATE auth_browser_sets
           SET active_user_id = NULL, active_session_id = NULL, version = version + 1,
               revoked_at = ?, last_seen_at = ?, updated_at = ?
           WHERE id = ? AND version = ? AND revoked_at IS NULL`,
        ).bind(now, now, now, resolved.row.id, input.expectedVersion),
      );
    } else {
      statements.push(
        db.prepare(
          `UPDATE auth_browser_accounts SET removed_at = COALESCE(removed_at, ?)
           WHERE set_id = ? AND user_id = ? AND removed_at IS NULL`,
        ).bind(now, resolved.row.id, targetUserId),
        removesActive
          ? db.prepare(
            `UPDATE auth_browser_sets
             SET active_user_id = NULL, active_session_id = NULL, version = version + 1,
                 expires_at = COALESCE((SELECT MAX(expires_at) FROM auth_browser_accounts
                   WHERE set_id = ? AND removed_at IS NULL), expires_at),
                 revoked_at = CASE WHEN NOT EXISTS (
                   SELECT 1 FROM auth_browser_accounts WHERE set_id = ? AND removed_at IS NULL
                 ) THEN ? ELSE revoked_at END,
                 last_seen_at = ?, updated_at = ?
             WHERE id = ? AND version = ? AND revoked_at IS NULL`,
          ).bind(resolved.row.id, resolved.row.id, now, now, now, resolved.row.id, input.expectedVersion)
          : db.prepare(
            `UPDATE auth_browser_sets
             SET version = version + 1,
                 expires_at = COALESCE((SELECT MAX(expires_at) FROM auth_browser_accounts
                   WHERE set_id = ? AND removed_at IS NULL), expires_at),
                 last_seen_at = ?, updated_at = ?
             WHERE id = ? AND version = ? AND revoked_at IS NULL`,
          ).bind(resolved.row.id, now, now, resolved.row.id, input.expectedVersion),
      );
    }
    statements.push(securityEventStatement(db, targetUserId, resolved.row.active_user_id, `auth.browser-account.${input.action}`, {
      setId: resolved.row.id,
      expectedVersion: input.expectedVersion,
      resultVersion: input.expectedVersion + 1,
    }, now));
    await db.batch(statements);
  } catch (error) {
    const won = await browserAccountMutationReplay(db, resolved, input.action, targetUserId, input.expectedVersion, input.idempotencyKey);
    if (won) return won;
    throw normalizeBrowserMutationError(error);
  }
  if (input.action === "logout-all") {
    return { browserSet: null, clearSession: true, clearBrowserSet: true, idempotent: false };
  }
  const nextRow = await browserSetById(db, resolved.row.id);
  if (!nextRow) throw browserSetConflict();
  const browserSet = { token: resolved.token, ...(await browserSetProjection(db, nextRow)) };
  const noAccounts = browserSet.state.accounts.length === 0;
  return {
    browserSet: noAccounts ? null : browserSet,
    clearSession: removesActive,
    clearBrowserSet: noAccounts,
    idempotent: false,
  };
}

export async function revokeSession(db: ClassroomD1, current: AuthSessionUser, sessionId: string): Promise<boolean> {
  requireDirectSession(current);
  const linked = await db.prepare(
    `SELECT l.set_id, bs.active_session_id
     FROM auth_browser_session_links l JOIN auth_browser_sets bs ON bs.id = l.set_id
     WHERE l.session_id = ? AND l.user_id = ? LIMIT 1`,
  ).bind(sessionId, current.userId).first<{ set_id: string; active_session_id: string | null }>();
  const now = nowIso();
  const results = await db.batch([
    db.prepare(
      `UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    ).bind(now, sessionId, current.userId),
    ...(linked ? [
      db.prepare(
        `UPDATE auth_browser_accounts SET reauth_required_at = COALESCE(reauth_required_at, ?)
         WHERE set_id = ? AND user_id = ? AND removed_at IS NULL`,
      ).bind(now, linked.set_id, current.userId),
      ...(linked.active_session_id === sessionId ? [db.prepare(
        `UPDATE auth_browser_sets
         SET active_user_id = NULL, active_session_id = NULL, version = version + 1,
             updated_at = ?, last_seen_at = ?
         WHERE id = ? AND active_session_id = ?`,
      ).bind(now, now, linked.set_id, sessionId)] : []),
    ] : []),
  ]);
  return Number(results[0]?.meta?.changes ?? 0) === 1;
}

export async function revokeCurrentSession(db: ClassroomD1, cookieHeader: string | null): Promise<void> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await hashSecret(token);
  const now = nowIso();
  await db.batch([
    db.prepare(
      `UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'logout'
       WHERE session_id IN (SELECT id FROM auth_sessions WHERE token_hash = ?) AND revoked_at IS NULL`,
    ).bind(now, tokenHash),
    db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`).bind(now, tokenHash),
  ]);
}

/** Learner lookup for the deliberately small DM password-assistance console. */
export async function listManagedUsers(
  db: ClassroomD1,
  actor: AuthSessionUser,
  query = "",
): Promise<ManagedAuthUser[]> {
  requireDirectSession(actor);
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
  requireDirectSession(actor);
  assertAuth(actor.role === "admin", "ADMIN_REQUIRED", "只有管理员可以停用或恢复账号。", 403);
  assertAuth(targetId !== actor.userId, "SELF_DISABLE_FORBIDDEN", "不能停用当前登录的管理员账号。", 400);
  const target = await getUserById(db, targetId);
  assertAuth(target, "USER_NOT_FOUND", "没有找到目标账号。", 404);
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, targetId),
    ...(status === "disabled"
      ? [
        db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(now, targetId),
        db.prepare(
          `UPDATE auth_browser_accounts SET reauth_required_at = COALESCE(reauth_required_at, ?)
           WHERE user_id = ? AND removed_at IS NULL`,
        ).bind(now, targetId),
        db.prepare(
          `UPDATE auth_browser_sets
           SET active_user_id = NULL, active_session_id = NULL, version = version + 1,
               updated_at = ?, last_seen_at = ?
           WHERE active_user_id = ?`,
        ).bind(now, now, targetId),
      ]
      : []),
    securityEventStatement(db, targetId, actor.userId, `auth.user.${status}`, {}, now),
  ]);
}

export function sessionCookie(token: string, remember: boolean, expiresAt?: string): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${cookiePath()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (remember) {
    const remaining = expiresAt ? Math.max(0, Date.parse(expiresAt) - Date.now()) : REMEMBERED_SESSION_MS;
    parts.push(`Max-Age=${Math.floor(Math.min(REMEMBERED_SESSION_MS, remaining) / 1_000)}`);
  }
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=${cookiePath()}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function browserAccountSetCookie(value: Pick<IssuedBrowserSet, "token" | "persistent" | "expiresAt">): string {
  const parts = [
    `${BROWSER_ACCOUNT_COOKIE}=${encodeURIComponent(value.token)}`,
    `Path=${cookiePath()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (value.persistent) {
    parts.push(`Max-Age=${Math.floor(Math.max(0, Date.parse(value.expiresAt) - Date.now()) / 1_000)}`);
  }
  return parts.join("; ");
}

export function clearBrowserAccountSetCookie(): string {
  return `${BROWSER_ACCOUNT_COOKIE}=; Path=${cookiePath()}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function issuedSessionHeaders(issued: IssuedSession): Headers {
  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookie(issued.token, issued.remember, issued.user.sessionExpiresAt));
  if (issued.browserSet) headers.append("Set-Cookie", browserAccountSetCookie(issued.browserSet));
  return headers;
}

export function requireManager(user: AuthSessionUser): void {
  assertAuth(user.role === "admin" || user.role === "mentor", "MANAGER_REQUIRED", "此操作需要导师或管理员权限。", 403);
}

function requireDirectSession(user: AuthSessionUser): void {
  assertAuth(
    !user.impersonation,
    "IMPERSONATION_ACCOUNT_OPERATION_FORBIDDEN",
    "测试身份不能修改账号、安全设置或其他账号；请先返回真实管理员身份。",
    403,
  );
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

type BrowserAccountCredentialRow = UserRow & {
  credential_version: string;
  remember: number;
  account_expires_at?: string;
  expires_at: string;
  authenticated_at: string;
  last_used_at: string;
  reauth_required_at: string | null;
  removed_at: string | null;
};

async function resolveBrowserSet(
  db: ClassroomD1,
  cookieHeader: string | null,
): Promise<{ token: string; row: BrowserSetRow } | null> {
  const token = readCookie(cookieHeader, BROWSER_ACCOUNT_COOKIE);
  if (!token || token.length < 32 || token.length > 128) return null;
  const row = await db.prepare(
    `SELECT id, token_hash, active_user_id, active_session_id, version, expires_at,
            last_seen_at, revoked_at
     FROM auth_browser_sets WHERE token_hash = ? LIMIT 1`,
  ).bind(await hashSecret(token)).first<BrowserSetRow>();
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) return null;
  return { token, row };
}

async function requireBrowserSet(
  db: ClassroomD1,
  cookieHeader: string | null,
): Promise<{ token: string; row: BrowserSetRow }> {
  const resolved = await resolveBrowserSet(db, cookieHeader);
  if (!resolved) throw new AuthError("ACCOUNT_SET_REQUIRED", "此浏览器还没有可切换的已登录账号，请先登录。", 401);
  return resolved;
}

async function browserSetById(db: ClassroomD1, setId: string): Promise<BrowserSetRow | null> {
  return db.prepare(
    `SELECT id, token_hash, active_user_id, active_session_id, version, expires_at,
            last_seen_at, revoked_at
     FROM auth_browser_sets WHERE id = ? LIMIT 1`,
  ).bind(setId).first<BrowserSetRow>();
}

async function browserSetProjection(
  db: ClassroomD1,
  set: BrowserSetRow,
): Promise<{ persistent: boolean; expiresAt: string; state: AuthBrowserAccountSetSummary }> {
  const rows = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, u.must_change_password,
            u.password_changed_at, a.credential_version, a.remember, a.expires_at,
            a.authenticated_at, a.last_used_at, a.reauth_required_at, a.removed_at,
            CASE WHEN bs.active_user_id = u.id
              AND bs.active_session_id IS NOT NULL
              AND s.id = bs.active_session_id
              AND s.revoked_at IS NULL AND s.expires_at > ?
              AND l.session_id IS NOT NULL THEN 1 ELSE 0 END AS active_session_valid
     FROM auth_browser_accounts a
     JOIN auth_browser_sets bs ON bs.id = a.set_id
     JOIN auth_users u ON u.id = a.user_id
     LEFT JOIN auth_browser_session_links l
       ON l.set_id = bs.id AND l.user_id = u.id AND l.session_id = bs.active_session_id
     LEFT JOIN auth_sessions s ON s.id = l.session_id
     WHERE a.set_id = ? AND a.removed_at IS NULL
     ORDER BY CASE WHEN bs.active_user_id = u.id THEN 0 ELSE 1 END, a.last_used_at DESC`,
  ).bind(nowIso(), set.id).all<BrowserAccountCredentialRow & { active_session_valid: number }>();
  const accounts = (rows.results ?? []).map((row) => {
    const status = browserAccountStatus(row);
    return {
      userId: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      current: status === "available" && Boolean(row.active_session_valid) && set.active_user_id === row.id,
      status,
      mustChangePassword: Boolean(row.must_change_password),
      remember: Boolean(row.remember),
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    };
  });
  const current = accounts.find((account) => account.current) ?? null;
  const retained = (rows.results ?? []).filter((row) => Date.parse(row.expires_at) > Date.now());
  const expiresAt = retained.reduce((latest, row) => Date.parse(row.expires_at) > Date.parse(latest) ? row.expires_at : latest, set.expires_at);
  return {
    persistent: retained.some((row) => Boolean(row.remember)),
    expiresAt,
    state: { version: set.version, currentUserId: current?.userId ?? null, accounts },
  };
}

async function browserAccountCredential(
  db: ClassroomD1,
  setId: string,
  userId: string,
): Promise<BrowserAccountCredentialRow | null> {
  return db.prepare(
    `SELECT u.*, a.credential_version, a.remember, a.expires_at, a.authenticated_at,
            a.last_used_at, a.reauth_required_at, a.removed_at
     FROM auth_browser_accounts a JOIN auth_users u ON u.id = a.user_id
     WHERE a.set_id = ? AND a.user_id = ? LIMIT 1`,
  ).bind(setId, userId).first<BrowserAccountCredentialRow>();
}

function browserAccountStatus(row: Pick<BrowserAccountCredentialRow,
  "status" | "expires_at" | "reauth_required_at" | "credential_version" | "password_changed_at"
>): AuthBrowserAccountStatus {
  if (row.status !== "active") return "disabled";
  if (Date.parse(row.expires_at) <= Date.now()) return "expired";
  if (row.reauth_required_at || row.credential_version !== row.password_changed_at) return "reauthenticate";
  return "available";
}

function accountStatusMessage(status: AuthBrowserAccountStatus): string {
  if (status === "disabled") return "这个账号已经停用，不能切换。";
  if (status === "expired") return "这个账号的本设备授权已到期，请只重新登录这个账号。";
  return "这个账号的密码或安全状态已经变化，请只重新登录这个账号。";
}

function browserAccountUpsert(
  db: ClassroomD1,
  setId: string,
  userId: string,
  credentialVersion: string,
  remember: boolean,
  expiresAt: string,
  now: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_browser_accounts
     (set_id, user_id, credential_version, remember, expires_at, authenticated_at,
      last_used_at, reauth_required_at, removed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
     ON CONFLICT(set_id, user_id) DO UPDATE SET
       credential_version = excluded.credential_version,
       remember = excluded.remember,
       expires_at = excluded.expires_at,
       authenticated_at = excluded.authenticated_at,
       last_used_at = excluded.last_used_at,
       reauth_required_at = NULL,
       removed_at = NULL`,
  ).bind(setId, userId, credentialVersion, remember ? 1 : 0, expiresAt, now, now);
}

async function attachIssuedSessionToBrowserSet(
  db: ClassroomD1,
  issued: IssuedSession,
  cookieHeader: string | null,
  action: "login",
): Promise<IssuedBrowserSet> {
  const target = await getUserById(db, issued.user.userId);
  if (!target || target.status !== "active") throw new AuthError("AUTH_REQUIRED", "当前账号不可用，请重新登录。", 401);
  const existing = await resolveBrowserSet(db, cookieHeader);
  const legacyCurrent = existing ? null : await authenticateLegacySession(db, cookieHeader);
  if (legacyCurrent?.impersonation) {
    throw new AuthError("IMPERSONATION_ACCOUNT_OPERATION_FORBIDDEN", "请先返回真实管理员身份，再添加或切换账号。", 403);
  }
  const setId = existing?.row.id ?? `browser_${crypto.randomUUID()}`;
  const token = existing?.token ?? randomSecret(32);
  const expectedVersion = existing?.row.version ?? 1;
  const now = nowIso();
  const existingCount = existing ? await db.prepare(
    `SELECT COUNT(*) AS count FROM auth_browser_accounts WHERE set_id = ? AND removed_at IS NULL`,
  ).bind(setId).first<{ count: number }>() : { count: legacyCurrent && legacyCurrent.userId !== target.id ? 1 : 0 };
  const alreadyPresent = existing ? await browserAccountCredential(db, setId, target.id) : null;
  assertAuth(
    Boolean(alreadyPresent && !alreadyPresent.removed_at) || Number(existingCount?.count ?? 0) < MAX_BROWSER_ACCOUNTS,
    "ACCOUNT_SET_FULL",
    `一个浏览器最多保留 ${MAX_BROWSER_ACCOUNTS} 个已验证账号；请先移除不用的账号。`,
    409,
  );
  const mutationId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  if (!existing) {
    statements.push(db.prepare(
      `INSERT INTO auth_browser_sets
       (id, token_hash, active_user_id, active_session_id, version, expires_at,
        last_seen_at, revoked_at, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, 1, ?, ?, NULL, ?, ?)`,
    ).bind(setId, await hashSecret(token), browserSetRetentionUntil(now), now, now, now));
  }
  statements.push(
    browserMutationClaim(db, mutationId, setId, action, target.id, expectedVersion, `login.${mutationId}`, now),
    browserMutationAssertion(db, mutationId, now),
  );
  if (legacyCurrent && legacyCurrent.userId !== target.id) {
    const legacy = await db.prepare(
      `SELECT s.remember, s.expires_at, u.password_changed_at, u.status
       FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
       WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL`,
    ).bind(legacyCurrent.sessionId, legacyCurrent.userId).first<{
      remember: number; expires_at: string; password_changed_at: string; status: "active" | "disabled";
    }>();
    if (legacy && legacy.status === "active" && Date.parse(legacy.expires_at) > Date.now()) {
      statements.push(browserAccountUpsert(db, setId, legacyCurrent.userId, legacy.password_changed_at, Boolean(legacy.remember), legacy.expires_at, now));
    }
  }
  statements.push(
    browserAccountUpsert(db, setId, target.id, target.password_changed_at, issued.remember, issued.user.sessionExpiresAt, now),
    db.prepare(
      `UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'account-login'
       WHERE session_id IN (SELECT session_id FROM auth_browser_session_links WHERE set_id = ?)
         AND revoked_at IS NULL`,
    ).bind(now, setId),
    db.prepare(
      `UPDATE auth_sessions SET revoked_at = ?
       WHERE id IN (SELECT session_id FROM auth_browser_session_links WHERE set_id = ?)
         AND id <> ? AND revoked_at IS NULL`,
    ).bind(now, setId, issued.user.sessionId),
  );
  if (legacyCurrent && legacyCurrent.sessionId !== issued.user.sessionId) {
    statements.push(db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`).bind(now, legacyCurrent.sessionId));
  }
  statements.push(
    db.prepare(
      `INSERT INTO auth_browser_session_links (session_id, set_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(issued.user.sessionId, setId, target.id, now),
    db.prepare(
      `UPDATE auth_browser_sets
       SET active_user_id = ?, active_session_id = ?, version = version + 1,
           expires_at = MAX(expires_at, ?),
           last_seen_at = ?, updated_at = ?
       WHERE id = ? AND version = ? AND revoked_at IS NULL`,
    ).bind(target.id, issued.user.sessionId, browserSetRetentionUntil(now), now, now, setId, expectedVersion),
    securityEventStatement(db, target.id, target.id, "auth.browser-account.added", {
      setId,
      replacedUserId: existing?.row.active_user_id ?? legacyCurrent?.userId ?? null,
      resultVersion: expectedVersion + 1,
    }, now),
  );
  await db.batch(statements);
  const row = await browserSetById(db, setId);
  if (!row) throw browserSetConflict();
  return { token, ...(await browserSetProjection(db, row)) };
}

async function attachIssuedSessionWithRetry(
  db: ClassroomD1,
  issued: IssuedSession,
  cookieHeader: string | null,
  action: "login",
): Promise<IssuedBrowserSet> {
  let lastError: unknown = browserSetConflict();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await attachIssuedSessionToBrowserSet(db, issued, cookieHeader, action);
    } catch (error) {
      lastError = error;
      if (!isBrowserMutationConflict(error)) {
        await revokeUndisclosedSession(db, issued.user.sessionId);
        throw error;
      }
    }
  }
  // Never replace a still-valid browser account collection just because
  // several tabs raced. The caller can retry against the newest version; the
  // newly created but undisclosed session must not remain usable.
  await revokeUndisclosedSession(db, issued.user.sessionId);
  throw normalizeBrowserMutationError(lastError);
}

async function revokeUndisclosedSession(db: ClassroomD1, sessionId: string): Promise<void> {
  await db.prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
    .bind(nowIso(), sessionId).run();
}

async function assertBrowserAccountCapacity(
  db: ClassroomD1,
  cookieHeader: string | null,
  targetUserId: string | null,
): Promise<void> {
  const resolved = await resolveBrowserSet(db, cookieHeader);
  if (!resolved) return;
  const existing = targetUserId ? await browserAccountCredential(db, resolved.row.id, targetUserId) : null;
  if (existing && !existing.removed_at) return;
  const count = await db.prepare(
    `SELECT COUNT(*) AS count FROM auth_browser_accounts WHERE set_id = ? AND removed_at IS NULL`,
  ).bind(resolved.row.id).first<{ count: number }>();
  assertAuth(
    Number(count?.count ?? 0) < MAX_BROWSER_ACCOUNTS,
    "ACCOUNT_SET_FULL",
    `一个浏览器最多保留 ${MAX_BROWSER_ACCOUNTS} 个已验证账号；请先移除不用的账号。`,
    409,
  );
}

function browserMutationClaim(
  db: ClassroomD1,
  mutationId: string,
  setId: string,
  action: BrowserAccountMutationAction,
  targetUserId: string | null,
  expectedVersion: number,
  idempotencyKey: string,
  now: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_browser_mutations
     (id, set_id, action, target_user_id, expected_version, result_version,
      idempotency_key, created_at)
     SELECT ?, id, ?, ?, ?, ?, ?, ?
     FROM auth_browser_sets
     WHERE id = ? AND version = ? AND revoked_at IS NULL`,
  ).bind(
    mutationId, action, targetUserId, expectedVersion, expectedVersion + 1,
    idempotencyKey, now, setId, expectedVersion,
  );
}

function browserMutationAssertion(db: ClassroomD1, mutationId: string, now: string): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_browser_atomic_assertions (id, verified_at)
     SELECT CASE WHEN EXISTS (SELECT 1 FROM auth_browser_mutations WHERE id = ?) THEN 1 ELSE 0 END, ?
     ON CONFLICT(id) DO NOTHING`,
  ).bind(mutationId, now);
}

function assertBrowserMutationInput(expectedVersion: number, idempotencyKey: string): void {
  assertAuth(Number.isInteger(expectedVersion) && expectedVersion >= 1, "ACCOUNT_SET_VERSION_INVALID", "账号列表版本无效，请刷新后重试。", 400);
  assertAuth(/^[A-Za-z0-9._:-]{12,128}$/.test(idempotencyKey), "IDEMPOTENCY_KEY_INVALID", "账号操作标识无效。", 400);
}

async function assertNoBrowserSetImpersonation(db: ClassroomD1, set: BrowserSetRow): Promise<void> {
  if (!set.active_session_id) return;
  const row = await db.prepare(
    `SELECT id FROM auth_impersonations
     WHERE session_id = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1`,
  ).bind(set.active_session_id, nowIso()).first<{ id: string }>();
  assertAuth(!row, "IMPERSONATION_ACCOUNT_OPERATION_FORBIDDEN", "请先返回真实管理员身份，再添加、切换或退出账号。", 403);
}

async function browserSwitchReplay(
  db: ClassroomD1,
  resolved: { token: string; row: BrowserSetRow },
  input: { targetUserId: string; expectedVersion: number; idempotencyKey: string },
): Promise<SwitchBrowserAccountResult | null> {
  const replay = await db.prepare(
    `SELECT action, target_user_id, expected_version FROM auth_browser_mutations
     WHERE set_id = ? AND idempotency_key = ? LIMIT 1`,
  ).bind(resolved.row.id, input.idempotencyKey).first<{
    action: string; target_user_id: string | null; expected_version: number;
  }>();
  if (!replay) return null;
  if (replay.action !== "switch" || replay.target_user_id !== input.targetUserId || replay.expected_version !== input.expectedVersion) {
    throw new AuthError("IDEMPOTENCY_KEY_REUSED", "同一个账号操作标识不能用于不同请求。", 409);
  }
  const row = await browserSetById(db, resolved.row.id);
  if (!row || row.revoked_at || row.active_user_id !== input.targetUserId) throw browserSetConflict();
  const user = await activeBrowserSessionUser(db, row);
  if (!user) throw browserSetConflict();
  const target = await browserAccountCredential(db, row.id, input.targetUserId);
  if (!target || browserAccountStatus(target) !== "available") throw browserSetConflict();
  return {
    user,
    sessionToken: null,
    remember: Boolean(target.remember),
    browserSet: { token: resolved.token, ...(await browserSetProjection(db, row)) },
    idempotent: true,
  };
}

async function browserAccountMutationReplay(
  db: ClassroomD1,
  resolved: { token: string; row: BrowserSetRow },
  action: "logout-current" | "remove" | "logout-all",
  targetUserId: string | null,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<MutateBrowserAccountsResult | null> {
  const replay = await db.prepare(
    `SELECT action, target_user_id, expected_version FROM auth_browser_mutations
     WHERE set_id = ? AND idempotency_key = ? LIMIT 1`,
  ).bind(resolved.row.id, idempotencyKey).first<{
    action: string; target_user_id: string | null; expected_version: number;
  }>();
  if (!replay) return null;
  if (replay.action !== action || replay.target_user_id !== targetUserId || replay.expected_version !== expectedVersion) {
    throw new AuthError("IDEMPOTENCY_KEY_REUSED", "同一个账号操作标识不能用于不同请求。", 409);
  }
  if (action === "logout-all") return { browserSet: null, clearSession: true, clearBrowserSet: true, idempotent: true };
  const row = await browserSetById(db, resolved.row.id);
  if (!row || row.revoked_at) return { browserSet: null, clearSession: true, clearBrowserSet: true, idempotent: true };
  const browserSet = { token: resolved.token, ...(await browserSetProjection(db, row)) };
  const noAccounts = browserSet.state.accounts.length === 0;
  return {
    browserSet: noAccounts ? null : browserSet,
    clearSession: action === "logout-current" || targetUserId === resolved.row.active_user_id,
    clearBrowserSet: noAccounts,
    idempotent: true,
  };
}

async function activeBrowserSessionUser(db: ClassroomD1, set: BrowserSetRow): Promise<AuthSessionUser | null> {
  if (!set.active_session_id || !set.active_user_id) return null;
  const row = await db.prepare(
    `SELECT s.id, s.user_id, s.expires_at, s.last_seen_at, s.revoked_at,
            u.username, u.display_name, u.role, u.status, u.must_change_password
     FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       AND u.status = 'active'`,
  ).bind(set.active_session_id, set.active_user_id, nowIso()).first<SessionRow>();
  return row ? resolveSessionIdentity(db, sessionUser(row)) : null;
}

function browserSetConflict(): AuthError {
  return new AuthError("ACCOUNT_SET_CONFLICT", "账号列表已在其他标签页变化，请刷新列表后重试。", 409);
}

function isBrowserMutationConflict(error: unknown): boolean {
  const message = String(error);
  return (error instanceof AuthError && error.code === "ACCOUNT_SET_CONFLICT")
    || message.includes("chk_auth_browser_atomic_assertion")
    || message.includes("AUTH_BROWSER_ACTIVE_INTEGRITY")
    || message.includes("auth_browser_mutations.set_id, auth_browser_mutations.idempotency_key");
}

function browserSetRetentionUntil(now: string): string {
  return new Date(Date.parse(now) + BROWSER_SET_RETENTION_MS).toISOString();
}

function normalizeBrowserMutationError(error: unknown): Error {
  return isBrowserMutationConflict(error) ? browserSetConflict() : error instanceof Error ? error : new Error(String(error));
}

async function newSessionUntil(
  userId: string,
  remember: boolean,
  userAgent: string,
  authorizedUntil: string,
  now: string,
): Promise<NewSession> {
  const session = await newSession(userId, remember, userAgent, now);
  if (Date.parse(authorizedUntil) < Date.parse(session.expiresAt)) session.expiresAt = authorizedUntil;
  return session;
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
    impersonation: null,
  };
}

function sessionUserFrom(user: UserRow, session: NewSession): AuthSessionUser {
  return {
    userId: user.id, username: user.username, displayName: user.display_name, role: user.role,
    mustChangePassword: Boolean(user.must_change_password), sessionId: session.id, sessionExpiresAt: session.expiresAt,
    impersonation: null,
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
