import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import { isCoursewareLibraryVisible, listCourseware } from "./courseware-store";
import { listClassroomInstances } from "./classroom-platform-store";
import { TERMINAL_SHOP_ITEMS, terminalItem, type TerminalItemSlot } from "./terminal-catalog";

export type TerminalEnvironment = "test" | "production";

export type TerminalWalletSummary = {
  environment: TerminalEnvironment;
  initialized: boolean;
  balanceCoins: number | null;
  transactions: Array<{
    id: string;
    kind: "grant" | "purchase" | "reversal";
    amountCoins: number;
    reason: string;
    itemId: string | null;
    roomId: string | null;
    actorDisplayName: string;
    reversalOf: string | null;
    reversed: boolean;
    createdAt: string;
  }>;
};

export type TerminalPublicSpace = {
  studentId: string;
  displayName: string;
  avatarSeed: string;
  intro: string;
  projectTitle: string;
  projectSummary: string;
  projectUrl: string;
  teamName: string;
  contribution: string;
  equipment: Partial<Record<TerminalItemSlot, string>>;
  updatedAt: string | null;
};

export async function getTerminalBootstrap(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  await ensureActiveProfile(db, user.userId);
  const [identity, productionWallet, testWallet, inventoryRows, equipmentRows, space, classrooms, courseware] = await Promise.all([
    terminalIdentity(db, user.userId),
    getTerminalWallet(db, user.userId, "production"),
    getTerminalWallet(db, user.userId, "test"),
    db.prepare("SELECT item_id, acquired_at FROM learner_terminal_inventory WHERE profile_id = ? ORDER BY acquired_at").bind(user.userId).all<{ item_id: string; acquired_at: string }>(),
    db.prepare("SELECT slot, item_id FROM learner_terminal_equipment WHERE profile_id = ?").bind(user.userId).all<{ slot: TerminalItemSlot; item_id: string }>(),
    getPublicSpaceByProfileId(db, user.userId, true),
    listClassroomInstances(db, user),
    listCourseware(db),
  ]);
  return {
    identity,
    wallets: { production: productionWallet, test: testWallet },
    catalog: TERMINAL_SHOP_ITEMS,
    inventory: (inventoryRows.results ?? []).map((row) => ({ itemId: row.item_id, acquiredAt: row.acquired_at })),
    equipment: Object.fromEntries((equipmentRows.results ?? []).map((row) => [row.slot, row.item_id])),
    space,
    classrooms: classrooms.filter((room) => !room.archive).map((room) => ({
      id: room.id,
      title: room.title,
      environment: room.environment,
      lifecycle: room.lifecycle,
      progress: room.script.unlockedThroughBlockId,
      href: `/classroom/${encodeURIComponent(room.id)}/`,
    })),
    courseware: courseware.filter(isCoursewareLibraryVisible).map((item) => ({
      packageId: item.packageId,
      title: item.title,
      mentorRole: item.mentorRole,
      href: `/course/${encodeURIComponent(item.slug)}/?revision=${item.releasedRevision}&digest=${encodeURIComponent(item.releasedDigest ?? "")}`,
    })),
  };
}

export async function initializeTerminalWallet(db: ClassroomD1, user: AuthenticatedClassroomUser, environment: TerminalEnvironment) {
  requireLearnerAccount(user);
  await ensureActiveProfile(db, user.userId);
  await ensureWallet(db, user.userId, environment);
  return getTerminalWallet(db, user.userId, environment);
}

export async function updateOwnPublicSpace(db: ClassroomD1, user: AuthenticatedClassroomUser, input: unknown): Promise<TerminalPublicSpace> {
  requireLearnerAccount(user);
  const value = record(input);
  const next = {
    intro: shortText(value.intro, "空间介绍", 160),
    projectTitle: shortText(value.projectTitle, "作品名称", 80),
    projectSummary: shortText(value.projectSummary, "作品说明", 500),
    projectUrl: publicProjectUrl(value.projectUrl),
    teamName: shortText(value.teamName, "团队名称", 80),
    contribution: shortText(value.contribution, "我的贡献", 240),
  };
  const now = new Date().toISOString();
  await ensureActiveProfile(db, user.userId);
  await db.prepare(
    `INSERT INTO learner_public_spaces
     (profile_id, intro, project_title, project_summary, project_url, team_name, contribution, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET intro = excluded.intro, project_title = excluded.project_title,
       project_summary = excluded.project_summary, project_url = excluded.project_url, team_name = excluded.team_name,
       contribution = excluded.contribution, published_at = COALESCE(learner_public_spaces.published_at, excluded.published_at),
       updated_at = excluded.updated_at`,
  ).bind(user.userId, next.intro, next.projectTitle, next.projectSummary, next.projectUrl, next.teamName, next.contribution, now, now, now).run();
  return getPublicSpaceByProfileId(db, user.userId, true);
}

export async function getPublicTerminalSpace(db: ClassroomD1, studentId: string): Promise<TerminalPublicSpace> {
  const normalized = studentId.trim().replace(/^@+/, "").toLowerCase();
  if (!normalized || normalized.length > 80) throw new ClassroomError("PUBLIC_SPACE_NOT_FOUND", "没有找到这个 Young Builder 空间。", 404);
  const row = await db.prepare(
    `SELECT id FROM auth_users WHERE role = 'learner' AND status = 'active' AND (lower(username) = ? OR id = ?) LIMIT 1`,
  ).bind(normalized, studentId.trim()).first<{ id: string }>();
  if (!row) throw new ClassroomError("PUBLIC_SPACE_NOT_FOUND", "没有找到这个 Young Builder 空间。", 404);
  return getPublicSpaceByProfileId(db, row.id, false);
}

export async function purchaseTerminalItem(db: ClassroomD1, user: AuthenticatedClassroomUser, input: unknown) {
  requireLearnerAccount(user);
  const value = record(input);
  const itemId = requiredId(value.itemId, "商品");
  const item = terminalItem(itemId);
  if (!item) throw new ClassroomError("TERMINAL_ITEM_NOT_FOUND", "商店里没有这个装饰。", 404);
  const idempotencyKey = mutationKey(value.idempotencyKey);
  await ensureActiveProfile(db, user.userId);
  const replay = await findTransactionByRequest(db, user.userId, idempotencyKey);
  const purchaseReplay = {
    kind: "purchase" as const, profileId: user.userId, environment: "production" as const,
    amountCoins: -item.priceCoins, roomId: null, itemId: item.id, reversalOf: null, reason: `兑换：${item.name}`,
  };
  if (replay) {
    requireMatchingReplay(replay, purchaseReplay);
    return purchaseResult(db, user.userId, itemId, replay.id, true);
  }
  const wallet = await walletRow(db, user.userId, "production");
  if (!wallet) throw new ClassroomError("TERMINAL_WALLET_UNINITIALIZED", "请先启用正式钱包，再兑换装饰。", 409);
  const owned = await db.prepare("SELECT 1 AS owned FROM learner_terminal_inventory WHERE profile_id = ? AND item_id = ?").bind(user.userId, itemId).first<{ owned: number }>();
  if (owned) throw new ClassroomError("TERMINAL_ITEM_ALREADY_OWNED", "这个装饰已经在“已拥有”中，不会重复扣币。", 409);
  const transactionId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO learner_terminal_transactions
         (id, profile_id, environment, kind, amount_coins, actor_profile_id, room_id, item_id, reason, idempotency_key, reversal_of, created_at)
         VALUES (?, ?, 'production', 'purchase', ?, ?, NULL, ?, ?, ?, NULL, ?)`,
      ).bind(transactionId, user.userId, -item.priceCoins, user.userId, item.id, `兑换：${item.name}`, idempotencyKey, now),
      db.prepare(
        `INSERT INTO learner_terminal_inventory (profile_id, item_id, acquired_transaction_id, acquired_at) VALUES (?, ?, ?, ?)`,
      ).bind(user.userId, item.id, transactionId, now),
    ]);
  } catch (error) {
    const retry = await findTransactionByRequest(db, user.userId, idempotencyKey);
    if (retry) {
      requireMatchingReplay(retry, purchaseReplay);
      return purchaseResult(db, user.userId, itemId, retry.id, true);
    }
    throw terminalWriteError(error);
  }
  return purchaseResult(db, user.userId, itemId, transactionId, false);
}

export async function equipTerminalItem(db: ClassroomD1, user: AuthenticatedClassroomUser, input: unknown) {
  requireLearnerAccount(user);
  const value = record(input);
  const itemId = requiredId(value.itemId, "装饰");
  const item = terminalItem(itemId);
  if (!item) throw new ClassroomError("TERMINAL_ITEM_NOT_FOUND", "没有找到这个装饰。", 404);
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO learner_terminal_equipment (profile_id, slot, item_id, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(profile_id, slot) DO UPDATE SET item_id = excluded.item_id, updated_at = excluded.updated_at`,
    ).bind(user.userId, item.slot, item.id, now).run();
  } catch (error) {
    throw terminalWriteError(error);
  }
  return { slot: item.slot, itemId: item.id, updatedAt: now };
}

export async function grantTerminalCoins(db: ClassroomD1, user: AuthenticatedClassroomUser, input: unknown) {
  requireGrantActor(user);
  const value = record(input);
  const targetProfileId = requiredId(value.targetProfileId, "学员");
  const roomId = requiredId(value.roomId, "课堂");
  const environment = terminalEnvironment(value.environment);
  const amountCoins = positiveInteger(value.amountCoins, "硅谷币数量", 1_000);
  const reason = requiredText(value.reason, "发放原因", 2, 200);
  const idempotencyKey = mutationKey(value.idempotencyKey);
  const room = await requireGrantScope(db, user, roomId, targetProfileId, environment);
  const replay = await findTransactionByRequest(db, user.userId, idempotencyKey);
  const grantReplay = {
    kind: "grant" as const, profileId: targetProfileId, environment, amountCoins,
    roomId, itemId: null, reversalOf: null, reason,
  };
  if (replay) {
    requireMatchingReplay(replay, grantReplay);
    return grantResult(db, replay.id, true);
  }
  const now = new Date().toISOString();
  const transactionId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO learner_terminal_wallets
         (profile_id, environment, balance_coins, initialized_at, updated_at) VALUES (?, ?, 0, ?, ?)`,
      ).bind(targetProfileId, environment, now, now),
      db.prepare(
        `INSERT INTO learner_terminal_transactions
         (id, profile_id, environment, kind, amount_coins, actor_profile_id, room_id, item_id, reason, idempotency_key, reversal_of, created_at)
         VALUES (?, ?, ?, 'grant', ?, ?, ?, NULL, ?, ?, NULL, ?)`,
      ).bind(transactionId, targetProfileId, environment, amountCoins, user.userId, roomId, reason, idempotencyKey, now),
    ]);
  } catch (error) {
    const retry = await findTransactionByRequest(db, user.userId, idempotencyKey);
    if (retry) {
      requireMatchingReplay(retry, grantReplay);
      return grantResult(db, retry.id, true);
    }
    throw terminalWriteError(error);
  }
  return { ...(await grantResult(db, transactionId, false)), classroomTitle: room.title };
}

export async function reverseTerminalGrant(db: ClassroomD1, user: AuthenticatedClassroomUser, transactionId: string, input: unknown) {
  requireGrantActor(user);
  const value = record(input);
  const idempotencyKey = mutationKey(value.idempotencyKey);
  const reason = requiredText(value.reason, "纠错原因", 2, 200);
  const original = await db.prepare(
    `SELECT t.id, t.profile_id, t.environment, t.amount_coins, t.actor_profile_id, t.room_id
     FROM learner_terminal_transactions t WHERE t.id = ? AND t.kind = 'grant'`,
  ).bind(transactionId).first<{ id: string; profile_id: string; environment: TerminalEnvironment; amount_coins: number; actor_profile_id: string; room_id: string | null }>();
  if (!original || !original.room_id) throw new ClassroomError("TERMINAL_GRANT_NOT_FOUND", "没有找到可纠正的发币记录。", 404);
  await requireGrantScope(db, user, original.room_id, original.profile_id, original.environment);
  if (user.platformRole !== "admin" && original.actor_profile_id !== user.userId) {
    throw new ClassroomError("TERMINAL_GRANT_REVERSAL_FORBIDDEN", "导师只能纠正自己发放的硅谷币。", 403);
  }
  const replay = await findTransactionByRequest(db, user.userId, idempotencyKey);
  const reversalReplay = {
    kind: "reversal" as const, profileId: original.profile_id, environment: original.environment,
    amountCoins: -original.amount_coins, roomId: original.room_id, itemId: null, reversalOf: original.id, reason,
  };
  if (replay) {
    requireMatchingReplay(replay, reversalReplay);
    return grantResult(db, replay.id, true);
  }
  const alreadyReversed = await db.prepare(
    "SELECT id FROM learner_terminal_transactions WHERE reversal_of = ?",
  ).bind(original.id).first<{ id: string }>();
  if (alreadyReversed) throw new ClassroomError("TERMINAL_GRANT_ALREADY_REVERSED", "这笔发放已经纠正，不能重复撤回。", 409);
  const reversalId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO learner_terminal_transactions
       (id, profile_id, environment, kind, amount_coins, actor_profile_id, room_id, item_id, reason, idempotency_key, reversal_of, created_at)
       VALUES (?, ?, ?, 'reversal', ?, ?, ?, NULL, ?, ?, ?, ?)`,
    ).bind(reversalId, original.profile_id, original.environment, -original.amount_coins, user.userId, original.room_id, reason, idempotencyKey, original.id, now).run();
  } catch (error) {
    const retry = await findTransactionByRequest(db, user.userId, idempotencyKey);
    if (retry) {
      requireMatchingReplay(retry, reversalReplay);
      return grantResult(db, retry.id, true);
    }
    throw terminalWriteError(error);
  }
  return grantResult(db, reversalId, false);
}

export async function listGrantClassrooms(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  requireGrantActor(user);
  const rooms = user.platformRole === "admin"
    ? await db.prepare(
      `SELECT r.id, r.title, ci.environment FROM rooms r JOIN classroom_instances ci ON ci.room_id = r.id
       WHERE ci.lifecycle != 'deleted' ORDER BY ci.updated_at DESC LIMIT 100`,
    ).all<{ id: string; title: string; environment: TerminalEnvironment }>()
    : await db.prepare(
      `SELECT DISTINCT r.id, r.title, ci.environment FROM rooms r
       JOIN classroom_instances ci ON ci.room_id = r.id
       LEFT JOIN memberships m ON m.room_id = r.id AND m.profile_id = ? AND m.status = 'active'
       LEFT JOIN classroom_admin_dm_grants g ON g.room_id = r.id AND g.profile_id = ? AND g.revoked_at IS NULL
       WHERE (m.role = 'dm' OR g.id IS NOT NULL) ORDER BY ci.updated_at DESC LIMIT 100`,
    ).bind(user.userId, user.userId).all<{ id: string; title: string; environment: TerminalEnvironment }>();
  const output = [];
  for (const room of rooms.results ?? []) {
    const learners = await db.prepare(
      `SELECT u.id AS profile_id, u.username, u.display_name FROM memberships m JOIN auth_users u ON u.id = m.profile_id
       WHERE m.room_id = ? AND m.role = 'learner' AND m.status = 'active' AND u.status = 'active' ORDER BY m.seat, u.display_name`,
    ).bind(room.id).all<{ profile_id: string; username: string; display_name: string }>();
    output.push({
      id: room.id,
      title: room.title,
      environment: room.environment,
      learners: (learners.results ?? []).map((item) => ({ profileId: item.profile_id, username: item.username, displayName: item.display_name })),
    });
  }
  return output;
}

export async function listTerminalGrantHistory(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  requireGrantActor(user);
  const scope = user.platformRole === "admin" ? "" : `AND t.actor_profile_id = ?
     AND (EXISTS(SELECT 1 FROM memberships actor_membership
                   WHERE actor_membership.room_id = t.room_id AND actor_membership.profile_id = ?
                     AND actor_membership.status = 'active' AND actor_membership.role = 'dm')
          OR EXISTS(SELECT 1 FROM classroom_admin_dm_grants actor_grant
                    WHERE actor_grant.room_id = t.room_id AND actor_grant.profile_id = ? AND actor_grant.revoked_at IS NULL))`;
  const statement = db.prepare(
    `SELECT t.id, t.profile_id, t.environment, t.amount_coins, t.reason, t.room_id, t.created_at,
            target.username, target.display_name, room.title AS room_title,
            EXISTS(SELECT 1 FROM learner_terminal_transactions r WHERE r.reversal_of = t.id) AS reversed
     FROM learner_terminal_transactions t
     JOIN auth_users target ON target.id = t.profile_id
     JOIN rooms room ON room.id = t.room_id
     WHERE t.kind = 'grant' ${scope}
     ORDER BY t.created_at DESC LIMIT 60`,
  );
  const rows = user.platformRole === "admin"
    ? await statement.all<{ id: string; profile_id: string; environment: TerminalEnvironment; amount_coins: number; reason: string; room_id: string; created_at: string; username: string; display_name: string; room_title: string; reversed: number }>()
    : await statement.bind(user.userId, user.userId, user.userId).all<{ id: string; profile_id: string; environment: TerminalEnvironment; amount_coins: number; reason: string; room_id: string; created_at: string; username: string; display_name: string; room_title: string; reversed: number }>();
  return (rows.results ?? []).map((row) => ({
    transactionId: row.id,
    targetProfileId: row.profile_id,
    username: row.username,
    displayName: row.display_name,
    environment: row.environment,
    amountCoins: row.amount_coins,
    reason: row.reason,
    roomId: row.room_id,
    classroomTitle: row.room_title,
    createdAt: row.created_at,
    reversed: Boolean(row.reversed),
  }));
}

async function terminalIdentity(db: ClassroomD1, profileId: string) {
  const row = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, COALESCE(a.avatar_seed, 'public:' || u.id) AS avatar_seed,
            COALESCE(a.avatar_version, 1) AS avatar_version
     FROM auth_users u LEFT JOIN auth_learner_admin_profiles a ON a.user_id = u.id WHERE u.id = ? AND u.status = 'active'`,
  ).bind(profileId).first<{ id: string; username: string; display_name: string; role: string; avatar_seed: string; avatar_version: number }>();
  if (!row) throw new ClassroomError("ACCOUNT_DISABLED", "这个账号当前不可用。", 403);
  return { userId: row.id, username: row.username, displayName: row.display_name, role: row.role, avatarSeed: row.avatar_seed, avatarVersion: row.avatar_version };
}

async function getTerminalWallet(db: ClassroomD1, profileId: string, environment: TerminalEnvironment): Promise<TerminalWalletSummary> {
  const wallet = await walletRow(db, profileId, environment);
  const transactions = await db.prepare(
    `SELECT t.id, t.kind, t.amount_coins, t.reason, t.item_id, t.room_id, t.reversal_of, t.created_at,
            p.nickname AS actor_name, EXISTS(SELECT 1 FROM learner_terminal_transactions r WHERE r.reversal_of = t.id) AS reversed
     FROM learner_terminal_transactions t JOIN profiles p ON p.id = t.actor_profile_id
     WHERE t.profile_id = ? AND t.environment = ? ORDER BY t.created_at DESC LIMIT 30`,
  ).bind(profileId, environment).all<{
    id: string; kind: "grant" | "purchase" | "reversal"; amount_coins: number; reason: string; item_id: string | null;
    room_id: string | null; reversal_of: string | null; created_at: string; actor_name: string; reversed: number;
  }>();
  return {
    environment,
    initialized: Boolean(wallet),
    balanceCoins: wallet?.balance_coins ?? null,
    transactions: (transactions.results ?? []).map((row) => ({
      id: row.id, kind: row.kind, amountCoins: row.amount_coins, reason: row.reason, itemId: row.item_id,
      roomId: row.room_id, actorDisplayName: row.actor_name, reversalOf: row.reversal_of, reversed: Boolean(row.reversed), createdAt: row.created_at,
    })),
  };
}

async function getPublicSpaceByProfileId(db: ClassroomD1, profileId: string, allowDraft: boolean): Promise<TerminalPublicSpace> {
  const row = await db.prepare(
    `SELECT u.username, u.display_name, COALESCE(a.avatar_seed, 'public:' || u.id) AS avatar_seed,
            s.intro, s.project_title, s.project_summary, s.project_url, s.team_name, s.contribution, s.updated_at, s.published_at
     FROM auth_users u LEFT JOIN auth_learner_admin_profiles a ON a.user_id = u.id
     LEFT JOIN learner_public_spaces s ON s.profile_id = u.id
     WHERE u.id = ? AND u.status = 'active'`,
  ).bind(profileId).first<{
    username: string; display_name: string; avatar_seed: string; intro: string | null; project_title: string | null;
    project_summary: string | null; project_url: string | null; team_name: string | null; contribution: string | null;
    updated_at: string | null; published_at: string | null;
  }>();
  if (!row || (!allowDraft && row.published_at === null)) throw new ClassroomError("PUBLIC_SPACE_NOT_FOUND", "这个空间还没有公开内容。", 404);
  const equipmentRows = await db.prepare(
    "SELECT slot, item_id FROM learner_terminal_equipment WHERE profile_id = ?",
  ).bind(profileId).all<{ slot: TerminalItemSlot; item_id: string }>();
  return {
    studentId: row.username,
    displayName: row.display_name,
    avatarSeed: row.avatar_seed,
    intro: row.intro ?? "",
    projectTitle: row.project_title ?? "",
    projectSummary: row.project_summary ?? "",
    projectUrl: row.project_url ?? "",
    teamName: row.team_name ?? "",
    contribution: row.contribution ?? "",
    equipment: Object.fromEntries((equipmentRows.results ?? []).map((item) => [item.slot, item.item_id])),
    updatedAt: row.updated_at,
  };
}

async function requireGrantScope(db: ClassroomD1, user: AuthenticatedClassroomUser, roomId: string, targetProfileId: string, environment: TerminalEnvironment) {
  const room = await db.prepare(
    `SELECT r.title, ci.environment,
            EXISTS(SELECT 1 FROM memberships m WHERE m.room_id = r.id AND m.profile_id = ? AND m.status = 'active' AND m.role = 'dm') AS actor_dm,
            EXISTS(SELECT 1 FROM classroom_admin_dm_grants g WHERE g.room_id = r.id AND g.profile_id = ? AND g.revoked_at IS NULL) AS actor_admin_dm,
            EXISTS(SELECT 1 FROM memberships m WHERE m.room_id = r.id AND m.profile_id = ? AND m.status = 'active' AND m.role = 'learner') AS target_learner
     FROM rooms r JOIN classroom_instances ci ON ci.room_id = r.id WHERE r.id = ?`,
  ).bind(user.userId, user.userId, targetProfileId, roomId).first<{ title: string; environment: TerminalEnvironment; actor_dm: number; actor_admin_dm: number; target_learner: number }>();
  if (!room) throw new ClassroomError("TERMINAL_GRANT_CLASSROOM_NOT_FOUND", "没有找到这场课堂。", 404);
  if (room.environment !== environment) throw new ClassroomError("TERMINAL_GRANT_ENVIRONMENT_MISMATCH", "发币环境必须与课堂环境一致。", 409);
  if (!room.target_learner) throw new ClassroomError("TERMINAL_GRANT_TARGET_FORBIDDEN", "只能给这场课堂里的学员发放硅谷币。", 403);
  if (user.platformRole !== "admin" && !room.actor_dm && !room.actor_admin_dm) throw new ClassroomError("TERMINAL_GRANT_SCOPE_FORBIDDEN", "你不是这场课堂的导师或 Admin DM。", 403);
  return room;
}

async function purchaseResult(db: ClassroomD1, profileId: string, itemId: string, transactionId: string, replayed: boolean) {
  const wallet = await walletRow(db, profileId, "production");
  return { transactionId, itemId, balanceCoins: wallet?.balance_coins ?? 0, replayed };
}

async function grantResult(db: ClassroomD1, transactionId: string, replayed: boolean) {
  const row = await db.prepare(
    `SELECT t.id, t.profile_id, t.environment, t.amount_coins, t.reason, t.room_id, t.created_at, u.username, u.display_name,
            w.balance_coins
     FROM learner_terminal_transactions t JOIN auth_users u ON u.id = t.profile_id
     JOIN learner_terminal_wallets w ON w.profile_id = t.profile_id AND w.environment = t.environment WHERE t.id = ?`,
  ).bind(transactionId).first<{
    id: string; profile_id: string; environment: TerminalEnvironment; amount_coins: number; reason: string;
    room_id: string | null; created_at: string; username: string; display_name: string; balance_coins: number;
  }>();
  if (!row) throw new ClassroomError("TERMINAL_TRANSACTION_MISSING", "交易已提交但暂时无法读取，请刷新。", 500);
  return {
    transactionId: row.id, targetProfileId: row.profile_id, username: row.username, displayName: row.display_name,
    environment: row.environment, amountCoins: row.amount_coins, reason: row.reason, roomId: row.room_id,
    balanceCoins: row.balance_coins, createdAt: row.created_at, replayed,
  };
}

type TransactionReplay = {
  id: string;
  kind: "grant" | "purchase" | "reversal";
  profile_id: string;
  environment: TerminalEnvironment;
  amount_coins: number;
  room_id: string | null;
  item_id: string | null;
  reversal_of: string | null;
  reason: string;
};

type ExpectedReplay = {
  kind: TransactionReplay["kind"];
  profileId: string;
  environment: TerminalEnvironment;
  amountCoins: number;
  roomId: string | null;
  itemId: string | null;
  reversalOf: string | null;
  reason: string;
};

async function findTransactionByRequest(db: ClassroomD1, actorProfileId: string, idempotencyKey: string) {
  return db.prepare(
    `SELECT id, kind, profile_id, environment, amount_coins, room_id, item_id, reversal_of, reason
     FROM learner_terminal_transactions WHERE actor_profile_id = ? AND idempotency_key = ?`,
  ).bind(actorProfileId, idempotencyKey).first<TransactionReplay>();
}

function requireMatchingReplay(replay: TransactionReplay, expected: ExpectedReplay): void {
  const matches = replay.kind === expected.kind
    && replay.profile_id === expected.profileId
    && replay.environment === expected.environment
    && replay.amount_coins === expected.amountCoins
    && replay.room_id === expected.roomId
    && replay.item_id === expected.itemId
    && replay.reversal_of === expected.reversalOf
    && replay.reason === expected.reason;
  if (!matches) {
    throw new ClassroomError("TERMINAL_IDEMPOTENCY_CONFLICT", "这个操作编号已经用于另一笔交易，请刷新页面后重试。", 409);
  }
}

async function walletRow(db: ClassroomD1, profileId: string, environment: TerminalEnvironment) {
  return db.prepare("SELECT balance_coins FROM learner_terminal_wallets WHERE profile_id = ? AND environment = ?").bind(profileId, environment).first<{ balance_coins: number }>();
}

async function ensureWallet(db: ClassroomD1, profileId: string, environment: TerminalEnvironment) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR IGNORE INTO learner_terminal_wallets
     (profile_id, environment, balance_coins, initialized_at, updated_at) VALUES (?, ?, 0, ?, ?)`,
  ).bind(profileId, environment, now, now).run();
}

async function ensureActiveProfile(db: ClassroomD1, profileId: string) {
  const user = await db.prepare("SELECT display_name FROM auth_users WHERE id = ? AND status = 'active'").bind(profileId).first<{ display_name: string }>();
  if (!user) throw new ClassroomError("ACCOUNT_DISABLED", "这个账号当前不可用。", 403);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR IGNORE INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`,
  ).bind(profileId, user.display_name, now, now).run();
}

function requireLearnerAccount(user: AuthenticatedClassroomUser): void {
  if (user.impersonationId) throw new ClassroomError("TERMINAL_IMPERSONATION_WRITE_FORBIDDEN", "测试身份只能预览终端，不能改变真实个人资产。", 403);
  if (user.platformRole !== "learner") throw new ClassroomError("TERMINAL_LEARNER_REQUIRED", "钱包、商店和公开空间编辑只对 Young Builder 账号开放。", 403);
}

function requireGrantActor(user: AuthenticatedClassroomUser): void {
  if (user.impersonationId || (user.platformRole !== "admin" && user.platformRole !== "mentor")) {
    throw new ClassroomError("TERMINAL_GRANT_ROLE_REQUIRED", "只有真实登录的导师或管理员可以手动发放硅谷币。", 403);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("TERMINAL_INPUT_INVALID", "提交内容格式不正确。", 400);
  return value as Record<string, unknown>;
}

export function terminalEnvironment(value: unknown): TerminalEnvironment {
  if (value === "test" || value === "production") return value;
  throw new ClassroomError("TERMINAL_ENVIRONMENT_INVALID", "环境必须是 TEST 或 PRODUCTION。", 400);
}

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 128) throw new ClassroomError("TERMINAL_ID_INVALID", `${label}标识无效。`, 400);
  return value.trim();
}

function mutationKey(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw new ClassroomError("TERMINAL_IDEMPOTENCY_INVALID", "操作编号无效，请刷新后重试。", 400);
  return value;
}

function requiredText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new ClassroomError("TERMINAL_TEXT_INVALID", `${label}不能为空。`, 400);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new ClassroomError("TERMINAL_TEXT_INVALID", `${label}需为 ${min}—${max} 个字符。`, 400);
  return text;
}

function shortText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ClassroomError("TERMINAL_TEXT_INVALID", `${label}格式无效。`, 400);
  const text = value.trim();
  if (text.length > max) throw new ClassroomError("TERMINAL_TEXT_INVALID", `${label}不能超过 ${max} 个字符。`, 400);
  return text;
}

function positiveInteger(value: unknown, label: string, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max) throw new ClassroomError("TERMINAL_AMOUNT_INVALID", `${label}需为 1—${max} 的整数。`, 400);
  return Number(value);
}

function publicProjectUrl(value: unknown): string {
  const text = shortText(value, "作品链接", 512);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") throw new Error("protocol");
    return url.toString();
  } catch {
    throw new ClassroomError("TERMINAL_PROJECT_URL_INVALID", "作品链接必须是完整的 https:// 地址。", 400);
  }
}

function terminalWriteError(error: unknown): ClassroomError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("TERMINAL_WALLET_INSUFFICIENT")) return new ClassroomError("TERMINAL_WALLET_INSUFFICIENT", "硅谷币不足，这次兑换或纠错没有执行。", 409);
  if (message.includes("TERMINAL_ITEM_NOT_OWNED")) return new ClassroomError("TERMINAL_ITEM_NOT_OWNED", "只能装备已经拥有的装饰。", 409);
  if (message.includes("learner_terminal_inventory.profile_id") || message.includes("UNIQUE constraint failed: learner_terminal_inventory")) return new ClassroomError("TERMINAL_ITEM_ALREADY_OWNED", "这个装饰已经拥有，不会重复扣币。", 409);
  if (message.includes("learner_terminal_transactions.reversal_of")) return new ClassroomError("TERMINAL_GRANT_ALREADY_REVERSED", "这笔发放已经纠正，不能重复撤回。", 409);
  return new ClassroomError("TERMINAL_WRITE_FAILED", "终端没有完成这次操作，请刷新余额后重试。", 409);
}
