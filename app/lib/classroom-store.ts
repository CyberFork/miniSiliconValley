import {
  classroomCampaigns,
  DEFAULT_CLASSROOM_CAMPAIGN_ID,
  toClassroomCampaignSummary,
  toLearnerCampaignSummary,
  toLearnerRoomTitle,
} from "../data/classroom-campaigns";
import {
  bindRoomCourseStatement,
  listReleasedCourseCampaigns,
  loadExactCourseCampaign,
  loadReleasedCourseCampaign,
  loadRoomCourseCampaign,
} from "./course-registry";
import type { CoursePackageRef } from "./course-package";
import {
  assertStudentAssetCopyComplete,
  assertStudentCopyComplete,
  getStudentChapterCopy,
  getStudentDemoDayCopy,
  toStudentAsset,
  toStudentHistoryReveal,
  toStudentInfoCard,
} from "../data/student-classroom-copy";
import {
  assertStudentGameCopyComplete,
  toStudentChallenge,
  toStudentIdentity,
  toStudentPressure,
} from "../data/student-classroom-game-copy";
import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser, ClassroomAction, ClassroomDashboardDto, ClassroomRoomDto } from "./classroom-api";
import { buildIndependentRandomDealPlan } from "./classroom-deal";
import { expandEvidenceBoundaryShorthand, expandEvidenceBoundaryValue } from "./evidence-boundary";
import { assertClassroom, ClassroomError } from "./classroom-errors";
import {
  CLASSROOM_PHASES,
  type ChallengeRubric,
  type ClassroomChapter,
  type ClassroomCampaign,
  type ClassroomMemberRole,
  type ClassroomPhase,
  type LedgerCategory,
  type PDMORole,
  type ReputationDimension,
} from "./classroom-model";
import {
  calculateProfitDistribution,
  calculateReputation,
  getAdjacentPhase,
  PERSONAL_SHOP,
  REPUTATION_UNLOCKS,
  resolveChallenge,
} from "./classroom-rules";

const PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEAM_PUBLIC_ID_LENGTH = 8;
const MAX_LEARNERS_PER_ROOM = 24;
const MAX_FACILITATORS_PER_ROOM = 8;
const MAX_PENDING_REQUESTS_PER_LEARNER = 10;
const DEFAULT_TEAM_SIZE = 4;

const ALL_CLASSROOM_CHAPTERS = classroomCampaigns.flatMap((campaign) => campaign.chapters);
assertStudentCopyComplete(
  ALL_CLASSROOM_CHAPTERS.map((chapter) => chapter.id),
  ALL_CLASSROOM_CHAPTERS.flatMap((chapter) => chapter.infoCards.map((card) => card.id)),
);
assertStudentAssetCopyComplete(classroomCampaigns.flatMap((campaign) => campaign.assets.map((asset) => asset.id)));
assertStudentGameCopyComplete(ALL_CLASSROOM_CHAPTERS);

type RoomRow = {
  id: string;
  code: string;
  title: string;
  campaign_id: string;
  chapter_id: string;
  phase: string;
  status: string;
  dm_profile_id: string;
  version: number;
  paused: number;
  paused_at: string | null;
  phase_deadline_at: string | null;
  player_timeline_frozen: number;
  history_revealed: number;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  id: string;
  room_id: string;
  profile_id: string;
  team_id: string | null;
  role: ClassroomMemberRole;
  seat: number | null;
  case_identity_id: string | null;
  pdmo_role: PDMORole | null;
  support_commitment: string | null;
  status: string;
  last_seen_at: string;
  nickname: string;
  username?: string | null;
};

type TeamRow = { id: string; room_id: string; name: string; seat_limit: number };

export async function getClassroomDashboard(db: ClassroomD1, user: AuthenticatedClassroomUser): Promise<ClassroomDashboardDto> {
  const profile = await ensureProfile(db, user);
  const releasedCampaigns = await listReleasedCourseCampaigns(db);
  await ensureDashboardTeamAccessIds(db, user.userId);
  const rooms = await allRows<{
    id: string;
    team_public_id: string | null;
    title: string;
    campaign_id: string;
    role: ClassroomMemberRole;
    chapter_id: string;
    phase: ClassroomPhase;
    status: "active" | "archived";
    history_revealed: number;
    updated_at: string;
  }>(
    db
      .prepare(
        `SELECT r.id, r.title, r.campaign_id, m.role, r.chapter_id, r.phase, r.status, r.history_revealed, r.updated_at,
                (SELECT tai.public_id
                 FROM teams t JOIN team_access_ids tai ON tai.team_id = t.id
                 WHERE t.room_id = r.id AND (m.team_id IS NULL OR t.id = m.team_id)
                 ORDER BY t.created_at LIMIT 1) AS team_public_id
         FROM memberships m
         JOIN rooms r ON r.id = m.room_id
         WHERE m.profile_id = ? AND m.status = 'active'
         ORDER BY CASE r.status WHEN 'active' THEN 0 ELSE 1 END, r.updated_at DESC`,
      )
      .bind(user.userId),
  );
  const reputation = await getProfileReputation(db, user.userId);
  const walletTenths = await getPersonalWalletBalance(db, user.userId);
  const requests = await allRows<{
    id: string;
    room_id: string;
    public_id: string;
    team_name: string;
    room_title: string;
    campaign_id: string;
    history_revealed: number;
    status: "pending" | "approved" | "rejected";
    updated_at: string;
  }>(
    db.prepare(
      `SELECT jr.id, r.id AS room_id, tai.public_id, t.name AS team_name, r.title AS room_title,
              r.campaign_id, r.history_revealed, jr.status, jr.updated_at
       FROM team_join_requests jr
       JOIN teams t ON t.id = jr.team_id
       JOIN team_access_ids tai ON tai.team_id = t.id
       JOIN rooms r ON r.id = t.room_id
       WHERE jr.profile_id = ?
       ORDER BY CASE jr.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, jr.updated_at DESC
       LIMIT 20`,
    ).bind(user.userId),
  );

  const canCreateRoom = !user.platformRole || user.platformRole === "admin" || user.platformRole === "mentor";
  const canViewAuthoredCampaigns = user.platformRole === "admin"
    || user.platformRole === "mentor"
    || rooms.some((room) => room.role === "dm");
  return {
    campaigns: canViewAuthoredCampaigns
      ? releasedCampaigns.map(toClassroomCampaignSummary)
      : releasedCampaigns.map((campaign) => toLearnerCampaignSummary(campaign, false)),
    // The platform user identifier is an authentication key, not UI data.
    profile: {
      username: user.username ?? user.userId,
      nickname: profile.nickname,
      platformRole: user.platformRole ?? null,
      reputation,
      walletTenths,
      canCreateRoom,
      canRequestTeamSeat: !user.platformRole || user.platformRole === "learner",
    },
    rooms: await Promise.all(rooms.map(async (room) => {
      const { campaign } = await loadRoomCourseCampaign(db, { id: room.id, campaign_id: room.campaign_id });
      return {
        id: room.id,
        teamPublicId: room.team_public_id,
        title: room.role === "learner"
          ? toLearnerRoomTitle(campaign, room.title, Boolean(room.history_revealed))
          : room.title,
        campaignId: campaign.id,
        courseRef: campaign.courseRef,
        role: room.role,
        chapterId: room.chapter_id,
        phase: room.phase,
        status: room.status,
        updatedAt: room.updated_at,
      };
    })),
    joinRequests: await Promise.all(requests.map(async (request) => {
      const campaign = (await loadRoomCourseCampaign(db, { id: request.room_id, campaign_id: request.campaign_id })).campaign;
      return {
        id: request.id,
        teamPublicId: request.public_id,
        teamName: request.team_name,
        roomTitle: toLearnerRoomTitle(campaign, request.room_title, Boolean(request.history_revealed)),
        status: request.status,
        updatedAt: request.updated_at,
      };
    })),
  };
}

export async function createClassroomRoom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  title: string,
  campaignId: string = DEFAULT_CLASSROOM_CAMPAIGN_ID,
  exact?: { courseRef: Pick<CoursePackageRef, "courseId" | "revision" | "digest">; alphaRunId: string },
): Promise<{ roomId: string; teamPublicId: string }> {
  assertClassroom(
    !user.platformRole || user.platformRole === "admin" || user.platformRole === "mentor",
    "MENTOR_ACCOUNT_REQUIRED",
    "只有导师或管理员账号可以创建课堂；学员请使用队伍ID申请加入。",
    403,
  );
  await ensureProfile(db, user);
  const roomId = crypto.randomUUID();
  const teamId = crypto.randomUUID();
  const dmMemberId = crypto.randomUUID();
  const treasuryAccountId = `treasury:${teamId}`;
  const now = nowIso();
  // `rooms.code` is retained only for backward-compatible schema reads. New
  // rooms receive a non-public internal key; all membership entry goes through
  // TEAM-XXXXXXXX requests and explicit DM approval.
  const internalRoomKey = `internal:${roomId}`;
  const teamPublicId = await uniqueTeamPublicId(db);
  const campaign = exact
    ? await loadExactCourseCampaign(db, exact.courseRef)
    : await loadReleasedCourseCampaign(db, campaignId);
  assertClassroom(campaign.id === campaignId, "COURSE_REF_MISMATCH", "创建课堂的课程 ID 与 exact 版本不一致。", 409);
  const firstChapter = campaign.chapters[0];

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO rooms
         (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version,
          player_timeline_frozen, history_revealed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'lobby', 'active', ?, 1, 0, 0, ?, ?)`,
      )
      .bind(roomId, internalRoomKey, title, campaign.id, firstChapter.id, user.userId, now, now),
    bindRoomCourseStatement(db, roomId, campaign, now),
    db
      .prepare(`INSERT INTO teams (id, room_id, name, seat_limit, created_at, updated_at) VALUES (?, ?, 'Alpha Team', ?, ?, ?)`)
      .bind(teamId, roomId, DEFAULT_TEAM_SIZE, now, now),
    db.prepare(`INSERT INTO team_access_ids (team_id, public_id, created_at) VALUES (?, ?, ?)`)
      .bind(teamId, teamPublicId, now),
    db
      .prepare(
        `INSERT INTO memberships
         (id, room_id, profile_id, team_id, role, seat, case_identity_id, pdmo_role,
          support_commitment, status, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'dm', NULL, NULL, NULL, NULL, 'active', ?, ?, ?)`,
      )
      .bind(dmMemberId, roomId, user.userId, now, now, now),
    db
      .prepare(
        `INSERT INTO ledger_accounts (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
         VALUES (?, 'team-treasury', ?, ?, NULL, 100, ?)`,
      )
      .bind(treasuryAccountId, roomId, teamId, now),
    db
      .prepare(
        `INSERT INTO ledger_transactions
         (id, room_id, chapter_id, from_account_id, to_account_id, amount_tenths, category, source_object_id,
          created_by_member_id, idempotency_key, reason, reversal_of, created_at)
         VALUES (?, ?, ?, NULL, ?, 100, 'financing', ?, ?, ?, '战役初始项目资金10 C', NULL, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        roomId,
        firstChapter.id,
        treasuryAccountId,
        `initial:${roomId}:${teamId}`,
        dmMemberId,
        `initial:${roomId}:${teamId}`,
        now,
      ),
    auditStatement(db, roomId, user.userId, "room.create", "room", roomId, {
      title,
      teamId,
      campaignId: campaign.id,
      courseRef: campaign.courseRef,
      alphaRunId: exact?.alphaRunId ?? null,
    }, now),
  ];
  if (exact) {
    statements.push(
      db.prepare(
        `INSERT INTO alpha_run_rooms (run_id, room_id, course_id, revision, digest, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(exact.alphaRunId, roomId, exact.courseRef.courseId, exact.courseRef.revision, exact.courseRef.digest, now),
    );
  }
  await db.batch(statements);

  return { roomId, teamPublicId };
}

export async function requestTeamMembership(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  teamPublicId: string,
): Promise<{ requestId: string; status: "pending"; alreadyPending: boolean; teamName: string; roomTitle: string }> {
  await ensureProfile(db, user);
  assertClassroom(
    !user.platformRole || user.platformRole === "learner",
    "LEARNER_ACCOUNT_REQUIRED",
    "只有学员账号可以申请课堂席位。",
    403,
  );
  const target = await db.prepare(
    `SELECT t.id AS team_id, t.name AS team_name, t.seat_limit,
            r.id AS room_id, r.title AS room_title, r.campaign_id, r.history_revealed,
            r.phase AS room_phase, r.status AS room_status
     FROM team_access_ids access
     JOIN teams t ON t.id = access.team_id
     JOIN rooms r ON r.id = t.room_id
     WHERE access.public_id = ?
     LIMIT 1`,
  ).bind(teamPublicId).first<{
    team_id: string;
    team_name: string;
    seat_limit: number;
    room_id: string;
    room_title: string;
    campaign_id: string;
    history_revealed: number;
    room_phase: string;
    room_status: string;
  }>();
  assertClassroom(target, "TEAM_NOT_FOUND", "没有找到这个队伍，请检查队伍ID。", 404);
  assertClassroom(target.room_status === "active", "ROOM_ARCHIVED", "这个课堂已经归档。", 409);
  assertClassroom(target.room_phase === "lobby", "TEAM_FORMATION_CLOSED", "这场课堂已经开始，请直接联系DM处理成员变更。", 409);

  const membership = await getMembership(db, target.room_id, user.userId);
  assertClassroom(!membership, "ALREADY_A_MEMBER", "你已经是这个课堂的成员，可以直接从课堂列表进入。", 409);
  const memberCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE team_id = ? AND role = 'learner' AND status = 'active'`).bind(target.team_id),
  );
  assertClassroom(memberCount < target.seat_limit, "TEAM_FULL", "这个队伍已经满员，请向DM索取其他队伍ID。", 409);

  const existing = await db.prepare(
    `SELECT id, status FROM team_join_requests WHERE team_id = ? AND profile_id = ? LIMIT 1`,
  ).bind(target.team_id, user.userId).first<{ id: string; status: string }>();
  const learnerRoomTitle = toLearnerRoomTitle(
    (await loadRoomCourseCampaign(db, { id: target.room_id, campaign_id: target.campaign_id })).campaign,
    target.room_title,
    Boolean(target.history_revealed),
  );
  if (existing?.status === "pending") {
    return { requestId: existing.id, status: "pending", alreadyPending: true, teamName: target.team_name, roomTitle: learnerRoomTitle };
  }
  const pendingCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM team_join_requests WHERE profile_id = ? AND status = 'pending'`).bind(user.userId),
  );
  assertClassroom(
    pendingCount < MAX_PENDING_REQUESTS_PER_LEARNER,
    "TOO_MANY_JOIN_REQUESTS",
    "你已有较多待审批申请，请先联系对应DM处理。",
    409,
  );

  // Concurrent retries must address the same logical request. A random ID can
  // race before the unique (team, profile) upsert and make two callers receive
  // different IDs even though only one row survives.
  const requestId = existing?.id ?? await stableJoinRequestId(target.team_id, user.userId);
  const now = nowIso();
  await db.batch([
    db.prepare(
      `INSERT INTO team_join_requests
       (id, team_id, profile_id, status, decided_by_profile_id, decided_at, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', NULL, NULL, ?, ?)
       ON CONFLICT(team_id, profile_id) DO UPDATE SET
         status = 'pending', decided_by_profile_id = NULL, decided_at = NULL, updated_at = excluded.updated_at`,
    ).bind(requestId, target.team_id, user.userId, now, now),
    bumpRoomStatement(db, target.room_id, now),
    auditStatement(db, target.room_id, user.userId, "membership.request", "join-request", requestId, { teamId: target.team_id }, now),
  ]);
  return { requestId, status: "pending", alreadyPending: false, teamName: target.team_name, roomTitle: learnerRoomTitle };
}

export async function searchLearnersForRoom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  query: string,
): Promise<import("./classroom-api").ClassroomLearnerSearchResult[]> {
  const dm = await requireMembership(db, roomId, user.userId);
  requireDm(dm);
  const normalized = query.trim().toLowerCase();
  assertClassroom(normalized.length >= 2, "SEARCH_QUERY_TOO_SHORT", "请至少输入2个字符。", 400);
  const pattern = `%${escapeLike(normalized.slice(0, 80))}%`;
  return allRows<import("./classroom-api").ClassroomLearnerSearchResult>(
    db.prepare(
      `SELECT u.id AS profileId, u.username, u.display_name AS displayName,
              CASE WHEN m.status IN ('active', 'removed') THEN m.status ELSE NULL END AS membershipStatus,
              m.team_id AS teamId
       FROM auth_users u
       LEFT JOIN memberships m ON m.profile_id = u.id AND m.room_id = ?
       WHERE u.role = 'learner' AND u.status = 'active'
         AND (LOWER(u.username) LIKE ? ESCAPE '\\' OR LOWER(u.display_name) LIKE ? ESCAPE '\\')
       ORDER BY CASE WHEN LOWER(u.username) = ? THEN 0 WHEN m.status = 'active' THEN 1 ELSE 2 END, u.created_at DESC
       LIMIT 20`,
    ).bind(roomId, pattern, pattern, normalized),
  );
}

export async function getClassroomRoom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  focusTeamId?: string | null,
): Promise<ClassroomRoomDto> {
  const viewer = await requireMembership(db, roomId, user.userId);
  await db.prepare(`UPDATE memberships SET last_seen_at = ? WHERE id = ?`).bind(nowIso(), viewer.id).run();
  const room = await db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first<RoomRow>();
  assertClassroom(room, "ROOM_NOT_FOUND", "课堂不存在。", 404);
  await ensureRoomTeamAccessIds(db, roomId);
  const { campaign } = await loadRoomCourseCampaign(db, room);
  const chapter = getChapter(campaign, room.chapter_id);
  const learnerHistorySealed = viewer.role === "learner" && room.history_revealed === 0;
  const memberRows = await allRows<
    MembershipRow & { reputation: number; wallet_tenths: number }
  >(
    db
      .prepare(
        `SELECT m.*, p.nickname, u.username,
           COALESCE((SELECT SUM(r.points) FROM reputation_entries r WHERE r.profile_id = p.id), 0) AS reputation,
           COALESCE((SELECT a.balance_tenths FROM ledger_accounts a WHERE a.kind = 'personal-wallet' AND a.owner_profile_id = p.id), 0) AS wallet_tenths
         FROM memberships m
         JOIN profiles p ON p.id = m.profile_id
         LEFT JOIN auth_users u ON u.id = m.profile_id
         WHERE m.room_id = ? AND m.status = 'active'
         ORDER BY CASE m.role WHEN 'dm' THEN 0 ELSE 1 END, m.team_id, m.seat`,
      )
      .bind(roomId),
  );
  const viewerMember = memberRows.find((member) => member.id === viewer.id)!;
  const reputation = viewerMember.reputation;
  const unlockIds = REPUTATION_UNLOCKS.filter((unlock) => reputation >= unlock.threshold).map((unlock) => unlock.id);

  const grants = await allRows<{ card_id: string; member_id: string; team_id: string; state: "unread" | "read" | "published" }>(
    db.prepare(`SELECT card_id, member_id, team_id, state FROM card_grants WHERE room_id = ? AND chapter_id = ?`).bind(roomId, chapter.id),
  );
  const infoById = new Map(chapter.infoCards.map((card) => [card.id, card]));
  const myCards = grants
    .filter((grant) => grant.member_id === viewer.id)
    .map((grant) => {
      const card = infoById.get(grant.card_id);
      if (!card) return null;
      return { ...(viewer.role === "learner" ? toStudentInfoCard(card) : card), state: grant.state };
    })
    .filter((card) => card !== null);
  const nodes = await allRows<{
    id: string;
    team_id: string;
    kind: string;
    title: string;
    explanation: string;
    source_card_ids_json: string;
    published_by_member_id: string;
  }>(
    db
      .prepare(
        `SELECT id, team_id, kind, title, explanation, source_card_ids_json, published_by_member_id
         FROM intelligence_nodes WHERE room_id = ? AND chapter_id = ? AND (? = 'dm' OR team_id = ?) ORDER BY created_at`,
      )
      .bind(roomId, chapter.id, viewer.role, viewer.team_id),
  );
  const edges = await allRows<{
    id: string;
    team_id: string;
    from_node_id: string;
    to_node_id: string;
    kind: ClassroomRoomDto["intelligence"]["edges"][number]["kind"];
    explanation: string;
    created_by_member_id: string;
  }>(
    db
      .prepare(
        `SELECT id, team_id, from_node_id, to_node_id, kind, explanation, created_by_member_id
         FROM intelligence_edges WHERE room_id = ? AND chapter_id = ? AND (? = 'dm' OR team_id = ?) ORDER BY created_at`,
      )
      .bind(roomId, chapter.id, viewer.role, viewer.team_id),
  );
  const teams = await allRows<{ id: string; name: string; seat_limit: number; public_id: string; member_count: number }>(
    db
      .prepare(
        `SELECT t.id, t.name, t.seat_limit, access.public_id, COUNT(m.id) AS member_count
         FROM teams t
         JOIN team_access_ids access ON access.team_id = t.id
         LEFT JOIN memberships m ON m.team_id = t.id AND m.role = 'learner' AND m.status = 'active'
         WHERE t.room_id = ? GROUP BY t.id ORDER BY t.created_at`,
      )
      .bind(roomId),
  );
  const requestedTeamId = viewer.role === "dm" && teams.some((team) => team.id === focusTeamId) ? focusTeamId ?? null : null;
  const selectedTeamId = viewer.team_id ?? requestedTeamId ?? teams[0]?.id ?? null;
  const joinRequests = viewer.role === "dm"
    ? await allRows<{
        id: string;
        profile_id: string;
        username: string;
        display_name: string;
        team_id: string;
        team_name: string;
        public_id: string;
        status: "pending" | "approved" | "rejected";
        created_at: string;
        updated_at: string;
      }>(
        db.prepare(
          `SELECT jr.id, jr.profile_id, COALESCE(u.username, '托管平台学员') AS username,
                  COALESCE(u.display_name, p.nickname) AS display_name, jr.team_id,
                  t.name AS team_name, access.public_id, jr.status, jr.created_at, jr.updated_at
           FROM team_join_requests jr
           JOIN teams t ON t.id = jr.team_id
           JOIN team_access_ids access ON access.team_id = t.id
           JOIN profiles p ON p.id = jr.profile_id
           LEFT JOIN auth_users u ON u.id = jr.profile_id
           WHERE t.room_id = ?
           ORDER BY CASE jr.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, jr.updated_at DESC
           LIMIT 100`,
        ).bind(roomId),
      )
    : [];
  const rawChallenge = selectedTeamId
    ? await getChallengeDto(db, roomId, chapter.id, selectedTeamId)
    : null;
  const challenge = viewer.role === "learner" ? expandEvidenceBoundaryValue(rawChallenge) : rawChallenge;
  const teamTreasuryTenths = selectedTeamId ? await getTeamTreasuryBalance(db, selectedTeamId) : 0;
  const acquiredAssets = selectedTeamId
    ? await allRows<{ asset_id: string; active: number; acquired_at: string }>(
        db.prepare(`SELECT asset_id, active, acquired_at FROM team_assets WHERE room_id = ? AND team_id = ?`).bind(roomId, selectedTeamId),
      )
    : [];
  const assetById = new Map(campaign.assets.map((asset) => [asset.id, asset]));
  const proposals = selectedTeamId ? await getPurchaseProposals(db, selectedTeamId) : [];
  const chapterEconomics = selectedTeamId
    ? await getChapterEconomics(db, room.id, chapter.id, selectedTeamId)
    : { revenueTenths: 0, costTenths: 0, priorDistributionTenths: 0, profitRemainingTenths: 0 };
  const treasuryAccountId = selectedTeamId ? `treasury:${selectedTeamId}` : null;
  const ledgerRows = treasuryAccountId
    ? await allRows<{
        id: string;
        from_account_id: string | null;
        to_account_id: string | null;
        amount_tenths: number;
        category: string;
        reason: string;
        created_at: string;
      }>(
        db
          .prepare(
            `SELECT id, from_account_id, to_account_id, amount_tenths, category, reason, created_at
             FROM ledger_transactions
             WHERE room_id = ? AND chapter_id = ? AND (from_account_id = ? OR to_account_id = ?)
             ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(roomId, chapter.id, treasuryAccountId, treasuryAccountId),
      )
    : [];
  const reputationEvidence = await allRows<{
    id: string;
    member_id: string;
    nickname: string;
    dimension: string;
    points: number;
    evidence_object_id: string;
    reason: string;
    created_at: string;
  }>(
    viewer.role === "dm" && selectedTeamId
      ? db
          .prepare(
            `SELECT r.id, m.id AS member_id, p.nickname, r.dimension, r.points, r.evidence_object_id, r.reason, r.created_at
             FROM reputation_entries r JOIN memberships m ON m.profile_id = r.profile_id AND m.room_id = r.room_id
             JOIN profiles p ON p.id = r.profile_id
             WHERE r.room_id = ? AND r.chapter_id = ? AND m.team_id = ? ORDER BY r.created_at DESC`,
          )
          .bind(roomId, chapter.id, selectedTeamId)
      : db
          .prepare(
            `SELECT r.id, m.id AS member_id, p.nickname, r.dimension, r.points, r.evidence_object_id, r.reason, r.created_at
             FROM reputation_entries r JOIN memberships m ON m.profile_id = r.profile_id AND m.room_id = r.room_id
             JOIN profiles p ON p.id = r.profile_id
             WHERE r.room_id = ? AND r.chapter_id = ? AND r.profile_id = ? ORDER BY r.created_at DESC`,
          )
          .bind(roomId, chapter.id, viewer.profile_id),
  );
  const worldline = await allRows<{
    id: string;
    kind: string;
    member_id: string | null;
    team_id: string | null;
    content_json: string;
    frozen_at: string | null;
  }>(
    db
      .prepare(
        `SELECT id, kind, member_id, team_id, content_json, frozen_at
         FROM worldline_entries
         WHERE room_id = ? AND chapter_id = ?
           AND (? = 'dm' OR (kind IN ('problem-statement','team-decision','demo-day') AND team_id = ?) OR member_id = ?)
         ORDER BY created_at`,
      )
      .bind(roomId, chapter.id, viewer.role, viewer.team_id, viewer.id),
  );
  const audit =
    viewer.role === "dm"
      ? await allRows<{ id: string; action: string; target_type: string; target_id: string; detail_json: string; created_at: string }>(
          db
            .prepare(
              `SELECT id, action, target_type, target_id, detail_json, created_at
               FROM audit_events WHERE room_id = ? ORDER BY created_at DESC LIMIT 100`,
            )
            .bind(roomId),
        )
      : [];
  const originalIdentity = viewer.case_identity_id ? chapter.identities.find((identity) => identity.id === viewer.case_identity_id) ?? null : null;
  const myIdentity = originalIdentity && viewer.role === "learner" ? toStudentIdentity(originalIdentity) : originalIdentity;
  const studentChapter = campaign.courseRef
    ? {
        id: chapter.id,
        title: chapter.title,
        location: chapter.location,
        briefing: chapter.briefing,
        learningGoal: chapter.learningGoal,
        historicalBoundary: chapter.historicalBoundary,
        realityMission: chapter.realityMission,
        scene: chapter.briefing.split("\n")[0] || chapter.location,
        steps: [
          chapter.realityMission.acceptance[0] ?? "先看清当前任务。",
          chapter.realityMission.acceptance[1] ?? "和队友一起留下证据。",
          chapter.realityMission.acceptance[2] ?? "完成后请导师验收。",
        ] as const,
        doneWhen: chapter.realityMission.acceptance.join("；") || chapter.realityMission.deliverable,
      }
    : getStudentChapterCopy(chapter.id);
  const selectedChallenge = challenge
    ? chapter.challenges.find((candidate) => candidate.id === challenge.challengeId) ?? null
    : null;
  const selectedPressure = challenge?.pressureDie
    ? chapter.pressureEvents.find((candidate) => candidate.die === challenge.pressureDie) ?? null
    : null;
  const publicChapter: Omit<ClassroomChapter, "identities" | "infoCards" | "historyReveal" | "dm" | "challenges"> & {
    challenges: ClassroomRoomDto["chapter"]["challenges"];
    dm: ClassroomChapter["dm"] | null;
  } = {
    id: chapter.id,
    order: chapter.order,
    stage: chapter.stage,
    title: viewer.role === "learner" ? studentChapter.title : chapter.title,
    timeRange: chapter.timeRange,
    location: viewer.role === "learner" ? studentChapter.location ?? chapter.location : chapter.location,
    briefing: viewer.role === "learner" ? studentChapter.briefing : chapter.briefing,
    learningGoal: viewer.role === "learner" ? studentChapter.learningGoal : chapter.learningGoal,
    historicalBoundary: viewer.role === "learner" ? studentChapter.historicalBoundary : chapter.historicalBoundary,
    intelGate: chapter.intelGate,
    challenges: viewer.role === "dm" ? chapter.challenges : selectedChallenge ? [toStudentChallenge(selectedChallenge)] : [],
    pressureEvents: viewer.role === "dm" ? chapter.pressureEvents : selectedPressure ? [toStudentPressure(chapter.id, selectedPressure)] : [],
    realityMission: viewer.role === "learner" ? studentChapter.realityMission : chapter.realityMission,
    dm: viewer.role === "dm" ? chapter.dm : null,
  };

  return {
    serverTime: nowIso(),
    version: room.version,
    viewer: {
      memberId: viewer.id,
      nickname: viewer.nickname,
      role: viewer.role,
      teamId: viewer.team_id,
      canManageFacilitators: viewer.role === "dm" && (user.platformRole === "admin" || room.dm_profile_id === user.userId),
      reputation,
      walletTenths: viewerMember.wallet_tenths,
      unlockIds,
    },
    room: {
      id: room.id,
      title: viewer.role === "learner"
        ? toLearnerRoomTitle(campaign, room.title, Boolean(room.history_revealed))
        : room.title,
      phase: parsePhase(room.phase),
      status: room.status === "archived" ? "archived" : "active",
      chapterId: room.chapter_id,
      playerTimelineFrozen: Boolean(room.player_timeline_frozen),
      historyRevealed: Boolean(room.history_revealed),
      paused: Boolean(room.paused),
      phaseDeadlineAt: room.phase_deadline_at,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: Number(team.member_count),
        seatLimit: team.seat_limit,
        publicId: team.public_id,
      })),
      focusTeamId: selectedTeamId,
    },
    campaign: viewer.role === "learner"
      ? toLearnerCampaignSummary(campaign, Boolean(room.history_revealed))
      : toClassroomCampaignSummary(campaign),
    chapter: {
      ...publicChapter,
      identities: chapter.identities.map((identity) => {
        const projected = viewer.role === "learner" ? toStudentIdentity(identity) : identity;
        return { id: projected.id, name: projected.name, nature: projected.nature, publicGoal: projected.publicGoal };
      }),
      infoCardCount: chapter.infoCards.length,
      historyReveal: room.history_revealed || viewer.role === "dm"
        ? viewer.role === "learner" ? toStudentHistoryReveal(chapter.id, chapter.historyReveal) : chapter.historyReveal
        : null,
      studentGuide: viewer.role === "learner"
        ? { scene: studentChapter.scene, steps: studentChapter.steps, doneWhen: studentChapter.doneWhen }
        : null,
    },
    myIdentity,
    dmSecrets:
      viewer.role === "dm"
        ? {
            identities: chapter.identities,
            allCards: chapter.infoCards,
            cardGrants: grants
              .map((grant) => ({ ...infoById.get(grant.card_id)!, memberId: grant.member_id, state: grant.state }))
              .filter((card) => Boolean(card.id)),
            historyReveal: chapter.historyReveal,
            joinRequests: joinRequests.map((request) => ({
              id: request.id,
              profileId: request.profile_id,
              username: request.username,
              displayName: request.display_name,
              teamId: request.team_id,
              teamName: request.team_name,
              teamPublicId: request.public_id,
              status: request.status,
              createdAt: request.created_at,
              updatedAt: request.updated_at,
            })),
          }
        : null,
    members: memberRows.map((member) => ({
      id: member.id,
      username: viewer.role === "dm" ? member.username ?? null : null,
      nickname: member.nickname,
      role: member.role,
      teamId: member.team_id,
      seat: member.seat,
      caseIdentityId: member.case_identity_id,
      lastSeenAt: member.last_seen_at,
      reputation: member.reputation,
      walletTenths: viewer.role === "dm" || member.id === viewer.id ? member.wallet_tenths : null,
      isRoomOwner: member.profile_id === room.dm_profile_id,
    })),
    myCards,
    intelligence: {
      publishedCards: grants
        .filter((grant) => grant.state === "published" && (viewer.role === "dm" ? grant.team_id === selectedTeamId : grant.team_id === viewer.team_id))
        .map((grant) => {
          const card = infoById.get(grant.card_id);
          if (!card) return null;
          return {
            ...(viewer.role === "learner" ? toStudentInfoCard(card) : card),
            publishedByMemberId: grant.member_id,
            publishedByNickname: memberRows.find((candidate) => candidate.id === grant.member_id)?.nickname ?? "队友",
          };
        })
        .filter((card) => card !== null),
      nodes: nodes.map((node) => ({
        id: node.id,
        teamId: node.team_id,
        kind: node.kind,
        title: viewer.role === "learner" ? expandEvidenceBoundaryShorthand(node.title) : node.title,
        explanation: viewer.role === "learner" ? expandEvidenceBoundaryShorthand(node.explanation) : node.explanation,
        sourceCardIds: parseJson<string[]>(node.source_card_ids_json, []),
        publishedByMemberId: node.published_by_member_id,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        teamId: edge.team_id,
        fromNodeId: edge.from_node_id,
        toNodeId: edge.to_node_id,
        kind: edge.kind,
        explanation: viewer.role === "learner" ? expandEvidenceBoundaryShorthand(edge.explanation) : edge.explanation,
        createdByMemberId: edge.created_by_member_id,
      })),
    },
    challenge,
    economy: {
      teamTreasuryTenths,
      chapterRevenueTenths: chapterEconomics.revenueTenths,
      chapterCostTenths: chapterEconomics.costTenths,
      chapterDistributedTenths: chapterEconomics.priorDistributionTenths,
      ledger: ledgerRows.map((transaction) => ({
        id: transaction.id,
        amountTenths: transaction.amount_tenths,
        category: transaction.category,
        fromLabel: accountLabel(transaction.from_account_id, treasuryAccountId, viewer, memberRows),
        toLabel: accountLabel(transaction.to_account_id, treasuryAccountId, viewer, memberRows),
        reason: viewer.role === "learner" ? expandEvidenceBoundaryShorthand(transaction.reason) : transaction.reason,
        createdAt: transaction.created_at,
      })),
      assets: acquiredAssets
        .map((row) => {
          const asset = assetById.get(row.asset_id)!;
          const projected = viewer.role === "learner" ? toStudentAsset(asset) : asset;
          return { ...projected, active: Boolean(row.active), acquiredAt: row.acquired_at };
        })
        .filter((asset) => Boolean(asset.id)),
      proposals,
    },
    reputationEvidence: reputationEvidence.map((entry) => ({
      id: entry.id,
      memberId: entry.member_id,
      nickname: entry.nickname,
      dimension: entry.dimension,
      points: entry.points,
      evidenceObjectId: entry.evidence_object_id,
      reason: viewer.role === "learner" ? expandEvidenceBoundaryShorthand(entry.reason) : entry.reason,
      createdAt: entry.created_at,
    })),
    worldline: worldline.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      memberId: entry.member_id,
      teamId: entry.team_id,
      content: viewer.role === "learner"
        ? expandEvidenceBoundaryValue(parseJson<Record<string, unknown>>(entry.content_json, {}))
        : parseJson<Record<string, unknown>>(entry.content_json, {}),
      frozenAt: entry.frozen_at,
    })),
    audit: audit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      targetType: entry.target_type,
      targetId: entry.target_id,
      detail: learnerHistorySealed ? {} : parseJson<Record<string, unknown>>(entry.detail_json, {}),
      createdAt: entry.created_at,
    })),
    catalog: {
      assets: viewer.role === "learner"
        ? campaign.assets.map((asset) => toStudentAsset(asset))
        : campaign.assets,
      // Source titles can reveal the historical answer. Learners receive them
      // only after the team's decision is frozen and the DM opens history.
      sources: viewer.role === "dm" || Boolean(room.history_revealed) ? campaign.sources : [],
      personalItems: [...PERSONAL_SHOP],
      reputationUnlocks: REPUTATION_UNLOCKS,
      demoDay: viewer.role === "learner" && !campaign.courseRef ? getStudentDemoDayCopy(campaign.id) : campaign.demoDay,
    },
  };
}

export async function exportClassroomArchive(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<Record<string, unknown>> {
  const viewer = await requireMembership(db, roomId, user.userId);
  requireDm(viewer);
  const room = await db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first<RoomRow>();
  assertClassroom(room, "ROOM_NOT_FOUND", "课堂不存在。", 404);
  const { campaign } = await loadRoomCourseCampaign(db, room);

  const teams = await allRows<{ id: string; name: string; seat_limit: number; created_at: string }>(
    db.prepare(`SELECT id, name, seat_limit, created_at FROM teams WHERE room_id = ? ORDER BY created_at`).bind(roomId),
  );
  const members = await allRows<{
    id: string;
    profile_id: string;
    nickname: string;
    team_id: string | null;
    role: ClassroomMemberRole;
    seat: number | null;
    case_identity_id: string | null;
    pdmo_role: PDMORole | null;
    support_commitment: string | null;
    status: string;
    created_at: string;
  }>(
    db
      .prepare(
        `SELECT m.id, m.profile_id, p.nickname, m.team_id, m.role, m.seat, m.case_identity_id,
                m.pdmo_role, m.support_commitment, m.status, m.created_at
         FROM memberships m JOIN profiles p ON p.id = m.profile_id
         WHERE m.room_id = ? ORDER BY m.created_at`,
      )
      .bind(roomId),
  );
  const profileToMember = new Map(members.map((member) => [member.profile_id, member]));
  const memberNicknames = new Map(members.map((member) => [member.id, member.nickname]));
  const accountRows = await allRows<{
    id: string;
    kind: string;
    team_id: string | null;
    owner_profile_id: string | null;
    balance_tenths: number;
    created_at: string;
  }>(
    db
      .prepare(
        `SELECT id, kind, team_id, owner_profile_id, balance_tenths, created_at
         FROM ledger_accounts
         WHERE room_id = ? OR owner_profile_id IN (SELECT profile_id FROM memberships WHERE room_id = ?)`,
      )
      .bind(roomId, roomId),
  );
  const accountAliases = new Map(
    accountRows.map((account) => [
      account.id,
      account.kind === "team-treasury"
        ? `team:${account.team_id}:treasury`
        : `member:${profileToMember.get(account.owner_profile_id ?? "")?.id ?? "unknown"}:wallet`,
    ]),
  );
  const transactions = await allRows<{
    id: string;
    chapter_id: string;
    from_account_id: string | null;
    to_account_id: string | null;
    amount_tenths: number;
    category: string;
    source_object_id: string;
    created_by_member_id: string;
    idempotency_key: string;
    reason: string;
    reversal_of: string | null;
    created_at: string;
  }>(db.prepare(`SELECT * FROM ledger_transactions WHERE room_id = ? ORDER BY created_at`).bind(roomId));
  const audits = await allRows<{
    id: string;
    actor_profile_id: string;
    action: string;
    target_type: string;
    target_id: string;
    detail_json: string;
    created_at: string;
  }>(db.prepare(`SELECT * FROM audit_events WHERE room_id = ? ORDER BY created_at`).bind(roomId));

  const table = async <T>(name: string): Promise<T[]> => {
    // Keep both identifiers on an explicit allowlist. D1 cannot bind table or
    // column identifiers, and not every classroom table uses `created_at`.
    const chronologicalColumn: Record<string, string> = {
      card_grants: "granted_at",
      intelligence_nodes: "created_at",
      intelligence_edges: "created_at",
      challenge_runs: "created_at",
      challenge_actions: "created_at",
      reputation_entries: "created_at",
      team_assets: "acquired_at",
      purchase_proposals: "created_at",
      purchase_votes: "created_at",
      gratitude_votes: "created_at",
      worldline_entries: "created_at",
    };
    const orderColumn = chronologicalColumn[name];
    assertClassroom(orderColumn, "EXPORT_TABLE_FORBIDDEN", "导出表不在许可清单中。", 500);
    if (name === "challenge_actions") {
      return allRows<T>(
        db
          .prepare(
            `SELECT a.* FROM challenge_actions a JOIN challenge_runs r ON r.id = a.run_id WHERE r.room_id = ? ORDER BY a.created_at`,
          )
          .bind(roomId),
      );
    }
    if (name === "purchase_votes") {
      return allRows<T>(
        db
          .prepare(
            `SELECT v.* FROM purchase_votes v JOIN purchase_proposals p ON p.id = v.proposal_id WHERE p.room_id = ? ORDER BY v.created_at`,
          )
          .bind(roomId),
      );
    }
    return allRows<T>(db.prepare(`SELECT * FROM ${name} WHERE room_id = ? ORDER BY ${orderColumn}`).bind(roomId));
  };

  const reputation = await allRows<{
    id: string;
    profile_id: string;
    chapter_id: string;
    dimension: string;
    points: number;
    evidence_object_id: string;
    awarded_by_member_id: string;
    reason: string;
    reversal_of: string | null;
    created_at: string;
  }>(db.prepare(`SELECT * FROM reputation_entries WHERE room_id = ? ORDER BY created_at`).bind(roomId));

  return {
    format: "mini-silicon-valley-classroom-archive",
    schemaVersion: 1,
    exportedAt: nowIso(),
    campaign,
    room: {
      id: room.id,
      title: room.title,
      campaignId: room.campaign_id,
      chapterId: room.chapter_id,
      phase: room.phase,
      status: room.status,
      version: room.version,
      paused: Boolean(room.paused),
      pausedAt: room.paused_at,
      phaseDeadlineAt: room.phase_deadline_at,
      playerTimelineFrozen: Boolean(room.player_timeline_frozen),
      historyRevealed: Boolean(room.history_revealed),
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    },
    teams: teams.map((team) => ({ id: team.id, name: team.name, seatLimit: team.seat_limit, createdAt: team.created_at })),
    members: members.map((member) => ({
      id: member.id,
      nickname: member.nickname,
      team_id: member.team_id,
      role: member.role,
      seat: member.seat,
      case_identity_id: member.case_identity_id,
      // Retained only so pre-T073 archives remain readable. New learner APIs
      // never expose or write these legacy columns.
      legacy_pdmo_role: member.pdmo_role,
      legacy_support_commitment: member.support_commitment,
      status: member.status,
      created_at: member.created_at,
    })),
    cardGrants: await table("card_grants"),
    intelligenceNodes: await table("intelligence_nodes"),
    intelligenceEdges: await table("intelligence_edges"),
    challengeRuns: await table("challenge_runs"),
    challengeActions: await table("challenge_actions"),
    reputation: reputation.map(({ profile_id, ...entry }) => ({
      ...entry,
      memberId: profileToMember.get(profile_id)?.id ?? null,
      nickname: profileToMember.get(profile_id)?.nickname ?? "已离开成员",
    })),
    accounts: accountRows.map((account) => ({
      id: accountAliases.get(account.id),
      kind: account.kind,
      teamId: account.team_id,
      ownerMemberId: account.owner_profile_id ? profileToMember.get(account.owner_profile_id)?.id ?? null : null,
      balanceTenths: account.balance_tenths,
      createdAt: account.created_at,
    })),
    transactions: transactions.map((transaction) => ({
      ...transaction,
      from_account_id: transaction.from_account_id ? accountAliases.get(transaction.from_account_id) ?? "external" : null,
      to_account_id: transaction.to_account_id ? accountAliases.get(transaction.to_account_id) ?? "external" : null,
      createdByNickname: memberNicknames.get(transaction.created_by_member_id) ?? "DM",
    })),
    teamAssets: await table("team_assets"),
    purchaseProposals: await table("purchase_proposals"),
    purchaseVotes: await table("purchase_votes"),
    gratitudeVotes: await table("gratitude_votes"),
    worldlineEntries: await table("worldline_entries"),
    audit: audits.map(({ actor_profile_id, detail_json, target_id, target_type, ...event }) => ({
      ...event,
      target_type,
      target_id:
        target_type === "profile"
          ? profileToMember.get(target_id)?.id ?? "profile:redacted"
          : target_id,
      actorNickname: profileToMember.get(actor_profile_id)?.nickname ?? "已离开成员",
      detail: redactProfileIdentifiers(parseJson<Record<string, unknown>>(detail_json, {}), profileToMember),
    })),
    privacy: "本档案不包含邮箱、真实姓名或平台用户ID；只包含课堂昵称与课堂内成员ID。",
  };
}

function redactProfileIdentifiers(
  value: unknown,
  profileToMember: Map<string, { id: string }>,
): unknown {
  if (typeof value === "string") return profileToMember.get(value)?.id ?? value;
  if (Array.isArray(value)) return value.map((entry) => redactProfileIdentifiers(entry, profileToMember));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, redactProfileIdentifiers(entry, profileToMember)]),
    );
  }
  return value;
}

export async function applyClassroomAction(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  action: ClassroomAction,
): Promise<{ version: number; replayed?: boolean }> {
  const member = await requireMembership(db, roomId, user.userId);
  const room = await db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first<RoomRow>();
  assertClassroom(room, "ROOM_NOT_FOUND", "课堂不存在。", 404);
  assertClassroom(room.status === "active" || action.type === "set-nickname", "ROOM_ARCHIVED", "课堂已归档，不能继续修改。", 409);
  const { campaign } = await loadRoomCourseCampaign(db, room);
  const chapter = getChapter(campaign, room.chapter_id);
  if (room.paused && member.role === "learner") {
    throw new ClassroomError("ROOM_PAUSED", "DM已暂停课堂。你可以继续讨论，但暂时不能提交新操作。", 409);
  }

  switch (action.type) {
    case "set-nickname":
      await setNickname(db, member, room, action.nickname);
      break;
    case "assign-and-deal":
      await assignAndDeal(db, member, room, chapter);
      break;
    case "move-phase":
      await movePhase(db, member, room, action.direction);
      break;
    case "set-timer":
      await setTimer(db, member, room, action.minutes);
      break;
    case "toggle-pause":
      await togglePause(db, member, room, action.paused);
      break;
    case "create-team":
      await createTeam(db, member, room, action.name);
      break;
    case "decide-join-request":
      await decideJoinRequest(db, member, room, action.requestId, action.decision);
      break;
    case "add-learner":
      await addLearnerToTeam(db, member, room, action.teamId, action.profileId);
      break;
    case "remove-member":
      await removeLearnerFromRoom(db, member, room, action.memberId);
      break;
    case "assign-facilitator":
      await assignFacilitator(db, user, member, room, action.username);
      break;
    case "remove-facilitator":
      await removeFacilitator(db, user, member, room, action.memberId);
      break;
    case "withdraw-card":
      await withdrawCard(db, member, room, chapter, action.cardId, action.memberId);
      break;
    case "grant-card":
      await grantCard(db, member, room, chapter, action.cardId, action.memberId);
      break;
    case "set-card-state":
      await setCardState(db, member, room, chapter, action.cardId, action.state);
      break;
    case "create-intelligence-node":
      await createIntelligenceNode(db, member, room, chapter, action);
      break;
    case "create-intelligence-edge":
      await createIntelligenceEdge(db, member, room, chapter, action);
      break;
    case "submit-problem-statement":
      await submitProblemStatement(db, member, room, chapter, action);
      break;
    case "select-challenge":
      await selectChallenge(db, member, room, chapter, action.teamId, action.challengeId);
      break;
    case "roll-pressure":
      await rollPressure(db, member, room, chapter, action.teamId);
      break;
    case "submit-challenge-action":
      await submitChallengeAction(db, member, room, chapter, action);
      break;
    case "score-challenge": {
      const replayed = await scoreChallenge(db, member, room, chapter, action.teamId, action.rubric, action.consequence, action.idempotencyKey);
      const latest = await getRoomVersion(db, roomId);
      return { version: latest, replayed };
    }
    case "award-reputation":
      await awardReputation(db, member, room, chapter, action.memberId, action.scores, action.evidenceObjectId, action.reason);
      break;
    case "gratitude-vote":
      await saveGratitudeVote(db, member, room, chapter, action.toMemberId, action.reason);
      break;
    case "distribute-profit": {
      const replayed = await distributeProfit(db, member, room, chapter, action.teamId, action.percent, action.idempotencyKey);
      const latest = await getRoomVersion(db, roomId);
      return { version: latest, replayed };
    }
    case "propose-purchase":
      await proposePurchase(db, member, room, chapter, campaign, action.assetId, action.idempotencyKey);
      break;
    case "vote-purchase": {
      const replayed = await votePurchase(db, member, room, chapter, campaign, action.proposalId, action.approve, action.idempotencyKey);
      const latest = await getRoomVersion(db, roomId);
      return { version: latest, replayed };
    }
    case "personal-purchase": {
      const replayed = await personalPurchase(db, member, room, action.itemId, action.idempotencyKey);
      const latest = await getRoomVersion(db, roomId);
      return { version: latest, replayed };
    }
    case "reinvest": {
      const replayed = await reinvest(db, member, room, action.teamId, action.amountTenths, action.idempotencyKey);
      const latest = await getRoomVersion(db, roomId);
      return { version: latest, replayed };
    }
    case "record-financing": {
      const replayed = await recordFinancing(db, member, room, action.teamId, action.amountTenths, action.reason, action.idempotencyKey);
      return { version: await getRoomVersion(db, roomId), replayed };
    }
    case "record-paper-ledger": {
      const replayed = await recordPaperLedger(
        db,
        member,
        room,
        action.teamId,
        action.flow,
        action.category,
        action.amountTenths,
        action.reason,
        action.idempotencyKey,
      );
      return { version: await getRoomVersion(db, roomId), replayed };
    }
    case "reverse-transaction": {
      const replayed = await reverseTransaction(db, member, room, action.transactionId, action.reason, action.idempotencyKey);
      return { version: await getRoomVersion(db, roomId), replayed };
    }
    case "freeze-worldline":
      await freezeWorldline(db, member, room, chapter, action.teamId, action.decision, action.rationale);
      break;
    case "reveal-history":
      await revealHistory(db, member, room);
      break;
    case "submit-reflection":
      await submitReflection(db, member, room, chapter, action.answers, action.realityAction);
      break;
    case "submit-demo-day":
      await submitDemoDay(db, member, room, chapter, campaign, action.title, action.segmentNotes);
      break;
    case "next-chapter":
      await nextChapter(db, member, room, chapter, campaign);
      break;
    case "archive-room":
      await archiveRoom(db, member, room);
      break;
  }

  return { version: await getRoomVersion(db, roomId) };
}

async function ensureProfile(db: ClassroomD1, user: AuthenticatedClassroomUser): Promise<{ id: string; nickname: string }> {
  const existing = await db.prepare(`SELECT id, nickname FROM profiles WHERE id = ?`).bind(user.userId).first<{ id: string; nickname: string }>();
  if (existing) {
    await ensurePersonalWallet(db, user.userId);
    return existing;
  }
  const now = nowIso();
  const nickname = normalizeNickname(user.displayName);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`).bind(user.userId, nickname, now, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO ledger_accounts
         (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
         VALUES (?, 'personal-wallet', NULL, NULL, ?, 0, ?)`,
      )
      .bind(`wallet:${user.userId}`, user.userId, now),
  ]);
  return (await db.prepare(`SELECT id, nickname FROM profiles WHERE id = ?`).bind(user.userId).first<{ id: string; nickname: string }>())!;
}

async function ensurePersonalWallet(db: ClassroomD1, profileId: string): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_accounts
       (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
       VALUES (?, 'personal-wallet', NULL, NULL, ?, 0, ?)`,
    )
    .bind(`wallet:${profileId}`, profileId, nowIso())
    .run();
}

async function getMembership(db: ClassroomD1, roomId: string, profileId: string): Promise<MembershipRow | null> {
  return db
    .prepare(
      `SELECT m.*, p.nickname FROM memberships m JOIN profiles p ON p.id = m.profile_id
       WHERE m.room_id = ? AND m.profile_id = ? AND m.status = 'active'`,
    )
    .bind(roomId, profileId)
    .first<MembershipRow>();
}

async function getAnyMembership(db: ClassroomD1, roomId: string, profileId: string): Promise<MembershipRow | null> {
  return db.prepare(
    `SELECT m.*, p.nickname FROM memberships m JOIN profiles p ON p.id = m.profile_id
     WHERE m.room_id = ? AND m.profile_id = ? LIMIT 1`,
  ).bind(roomId, profileId).first<MembershipRow>();
}

async function requireMembership(db: ClassroomD1, roomId: string, profileId: string): Promise<MembershipRow> {
  const member = await getMembership(db, roomId, profileId);
  assertClassroom(member, "NOT_A_MEMBER", "你不是这个课堂的成员。", 403);
  return member;
}

function requireDm(member: MembershipRow): void {
  assertClassroom(member.role === "dm", "DM_REQUIRED", "只有DM可以执行这个操作。", 403);
}

function requireFacilitatorManager(
  user: AuthenticatedClassroomUser,
  member: MembershipRow,
  room: RoomRow,
): void {
  requireDm(member);
  assertClassroom(
    user.platformRole === "admin" || room.dm_profile_id === member.profile_id,
    "FACILITATOR_MANAGER_REQUIRED",
    "只有课堂创建者或系统管理员可以管理授课导师。",
    403,
  );
}

function requireLearner(member: MembershipRow): asserts member is MembershipRow & { team_id: string } {
  assertClassroom(member.role === "learner" && member.team_id, "LEARNER_REQUIRED", "这个操作需要学员团队身份。", 403);
}

function requireTeamAccess(member: MembershipRow, teamId: string): void {
  assertClassroom(member.role === "dm" || member.team_id === teamId, "TEAM_FORBIDDEN", "你没有权限操作这个团队。", 403);
}

function getChapter(campaign: ClassroomCampaign, chapterId: string): ClassroomChapter {
  const chapter = campaign.chapters.find((candidate) => candidate.id === chapterId);
  if (!chapter) throw new ClassroomError("CHAPTER_NOT_FOUND", "课程章节不存在。", 500);
  return chapter;
}

function parsePhase(value: string): ClassroomPhase {
  return CLASSROOM_PHASES.includes(value as ClassroomPhase) ? (value as ClassroomPhase) : "lobby";
}

async function getProfileReputation(db: ClassroomD1, profileId: string): Promise<number> {
  return scalarNumber(db.prepare(`SELECT COALESCE(SUM(points), 0) AS value FROM reputation_entries WHERE profile_id = ?`).bind(profileId));
}

async function getPersonalWalletBalance(db: ClassroomD1, profileId: string): Promise<number> {
  return scalarNumber(
    db.prepare(`SELECT COALESCE(balance_tenths, 0) AS value FROM ledger_accounts WHERE kind = 'personal-wallet' AND owner_profile_id = ?`).bind(profileId),
  );
}

async function getTeamTreasuryBalance(db: ClassroomD1, teamId: string): Promise<number> {
  return scalarNumber(
    db.prepare(`SELECT COALESCE(balance_tenths, 0) AS value FROM ledger_accounts WHERE kind = 'team-treasury' AND team_id = ?`).bind(teamId),
  );
}

async function getRoomVersion(db: ClassroomD1, roomId: string): Promise<number> {
  return scalarNumber(db.prepare(`SELECT version AS value FROM rooms WHERE id = ?`).bind(roomId));
}

async function uniqueTeamPublicId(db: ClassroomD1): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const bytes = new Uint8Array(TEAM_PUBLIC_ID_LENGTH);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (byte) => PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length]).join("");
    const publicId = `TEAM-${suffix}`;
    const exists = await db.prepare(`SELECT 1 AS found FROM team_access_ids WHERE public_id = ?`).bind(publicId).first<{ found: number }>();
    if (!exists) return publicId;
  }
  throw new ClassroomError("TEAM_ID_EXHAUSTED", "暂时无法生成队伍ID，请重试。", 503);
}

async function stableJoinRequestId(teamId: string, profileId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${teamId}\u0000${profileId}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `join-${Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function ensureTeamAccessId(db: ClassroomD1, teamId: string): Promise<string> {
  const existing = await db.prepare(`SELECT public_id FROM team_access_ids WHERE team_id = ?`).bind(teamId).first<{ public_id: string }>();
  if (existing) return existing.public_id;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const publicId = await uniqueTeamPublicId(db);
    await db.prepare(`INSERT OR IGNORE INTO team_access_ids (team_id, public_id, created_at) VALUES (?, ?, ?)`)
      .bind(teamId, publicId, nowIso())
      .run();
    const created = await db.prepare(`SELECT public_id FROM team_access_ids WHERE team_id = ?`).bind(teamId).first<{ public_id: string }>();
    if (created) return created.public_id;
  }
  throw new ClassroomError("TEAM_ID_EXHAUSTED", "暂时无法生成队伍ID，请重试。", 503);
}

async function ensureRoomTeamAccessIds(db: ClassroomD1, roomId: string): Promise<void> {
  const teams = await allRows<{ id: string }>(db.prepare(`SELECT id FROM teams WHERE room_id = ? ORDER BY created_at`).bind(roomId));
  for (const team of teams) await ensureTeamAccessId(db, team.id);
}

async function ensureDashboardTeamAccessIds(db: ClassroomD1, profileId: string): Promise<void> {
  const teams = await allRows<{ id: string }>(
    db.prepare(
      `SELECT DISTINCT t.id
       FROM teams t
       JOIN memberships m ON m.room_id = t.room_id
       WHERE m.profile_id = ? AND m.status = 'active'
       UNION
       SELECT DISTINCT t.id
       FROM teams t
       JOIN team_join_requests jr ON jr.team_id = t.id
       WHERE jr.profile_id = ?`,
    ).bind(profileId, profileId),
  );
  for (const team of teams) await ensureTeamAccessId(db, team.id);
}

function auditStatement(
  db: ClassroomD1,
  roomId: string,
  actorProfileId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown>,
  createdAt = nowIso(),
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_events
       (id, room_id, actor_profile_id, action, target_type, target_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), roomId, actorProfileId, action, targetType, targetId, JSON.stringify(detail), createdAt);
}

async function allRows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results;
}

async function scalarNumber(statement: D1PreparedStatement): Promise<number> {
  const row = await statement.first<{ value: number | string | null }>();
  return Number(row?.value ?? 0);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeNickname(value: string): string {
  const beforeAt = value.includes("@") ? value.slice(0, value.indexOf("@")) : value;
  const cleaned = Array.from(beforeAt).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("").trim();
  return (cleaned || "Young Builder").slice(0, 32);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function accountLabel(
  accountId: string | null,
  treasuryAccountId: string | null,
  viewer: MembershipRow,
  members: MembershipRow[],
): string {
  if (!accountId) return "系统／外部";
  if (accountId === treasuryAccountId) return "团队金库";
  if (accountId === `wallet:${viewer.profile_id}`) return "我的钱包";
  if (viewer.role === "dm" && accountId.startsWith("wallet:")) {
    const profileId = accountId.slice("wallet:".length);
    return `${members.find((member) => member.profile_id === profileId)?.nickname ?? "学员"}个人钱包`;
  }
  return "个人钱包（受保护）";
}

// Action implementations are kept below so every mutation shares the same authorization and audit layer.
async function setNickname(db: ClassroomD1, member: MembershipRow, room: RoomRow, nickname: string): Promise<void> {
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE profiles SET nickname = ?, updated_at = ? WHERE id = ?`).bind(nickname, now, member.profile_id),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "profile.nickname", "profile", member.profile_id, { nickname }, now),
  ]);
}

async function setTimer(db: ClassroomD1, member: MembershipRow, room: RoomRow, minutes: number): Promise<void> {
  requireDm(member);
  const now = nowIso();
  const deadline = new Date(Date.now() + minutes * 60_000).toISOString();
  await db.batch([
    db
      .prepare(`UPDATE rooms SET phase_deadline_at = ?, paused = 0, paused_at = NULL, version = version + 1, updated_at = ? WHERE id = ?`)
      .bind(deadline, now, room.id),
    auditStatement(db, room.id, member.profile_id, "timer.set", "room", room.id, { minutes, deadline }, now),
  ]);
}

async function togglePause(db: ClassroomD1, member: MembershipRow, room: RoomRow, paused: boolean): Promise<void> {
  requireDm(member);
  if (Boolean(room.paused) === paused) return;
  const now = nowIso();
  let deadline = room.phase_deadline_at;
  if (!paused && deadline && room.paused_at) {
    const pauseDuration = Math.max(0, Date.now() - new Date(room.paused_at).getTime());
    deadline = new Date(new Date(deadline).getTime() + pauseDuration).toISOString();
  }
  await db.batch([
    db
      .prepare(
        `UPDATE rooms SET paused = ?, paused_at = ?, phase_deadline_at = ?, version = version + 1, updated_at = ? WHERE id = ?`,
      )
      .bind(paused ? 1 : 0, paused ? now : null, deadline, now, room.id),
    auditStatement(db, room.id, member.profile_id, paused ? "room.pause" : "room.resume", "room", room.id, { deadline }, now),
  ]);
}

async function createTeam(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  name: string,
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "lobby", "TEAM_FORMATION_CLOSED", "只能在集结大厅创建队伍。", 409);
  const count = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM teams WHERE room_id = ?`).bind(room.id));
  assertClassroom(count < Math.ceil(MAX_LEARNERS_PER_ROOM / DEFAULT_TEAM_SIZE), "TEAM_LIMIT_REACHED", "这个课堂已经达到队伍上限。", 409);
  const duplicate = await db.prepare(`SELECT 1 AS found FROM teams WHERE room_id = ? AND LOWER(name) = LOWER(?)`).bind(room.id, name).first<{ found: number }>();
  assertClassroom(!duplicate, "TEAM_NAME_TAKEN", "这个课堂已经有同名队伍。", 409);

  const teamId = crypto.randomUUID();
  const publicId = await uniqueTeamPublicId(db);
  const treasuryId = `treasury:${teamId}`;
  const now = nowIso();
  await db.batch([
    db.prepare(`INSERT INTO teams (id, room_id, name, seat_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(teamId, room.id, name, DEFAULT_TEAM_SIZE, now, now),
    db.prepare(`INSERT INTO team_access_ids (team_id, public_id, created_at) VALUES (?, ?, ?)`)
      .bind(teamId, publicId, now),
    db.prepare(
      `INSERT INTO ledger_accounts (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
       VALUES (?, 'team-treasury', ?, ?, NULL, 100, ?)`,
    ).bind(treasuryId, room.id, teamId, now),
    db.prepare(
      `INSERT INTO ledger_transactions
       (id, room_id, chapter_id, from_account_id, to_account_id, amount_tenths, category, source_object_id,
        created_by_member_id, idempotency_key, reason, reversal_of, created_at)
       VALUES (?, ?, ?, NULL, ?, 100, 'financing', ?, ?, ?, '新团队初始项目资金10 C', NULL, ?)`,
    ).bind(
      crypto.randomUUID(), room.id, room.chapter_id, treasuryId, `initial:${room.id}:${teamId}`,
      member.id, `initial:${room.id}:${teamId}`, now,
    ),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "team.create", "team", teamId, { name, publicId }, now),
  ]);
}

async function decideJoinRequest(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  requestId: string,
  decision: "approve" | "reject",
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "lobby", "TEAM_FORMATION_CLOSED", "课堂开始后不能审批新席位；如需紧急调整，请先回到集结阶段。", 409);
  const request = await db.prepare(
    `SELECT jr.id, jr.profile_id, jr.team_id, jr.status
     FROM team_join_requests jr JOIN teams t ON t.id = jr.team_id
     WHERE jr.id = ? AND t.room_id = ? LIMIT 1`,
  ).bind(requestId, room.id).first<{ id: string; profile_id: string; team_id: string; status: string }>();
  assertClassroom(request, "JOIN_REQUEST_NOT_FOUND", "没有找到这条入队申请。", 404);
  if (request.status === decisionToStatus(decision)) return;
  assertClassroom(request.status === "pending", "JOIN_REQUEST_DECIDED", "这条申请已经处理。", 409);
  if (decision === "approve") {
    await addLearnerToTeam(db, member, room, request.team_id, request.profile_id, request.id);
    return;
  }
  const now = nowIso();
  await db.batch([
    db.prepare(
      `UPDATE team_join_requests SET status = 'rejected', decided_by_profile_id = ?, decided_at = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
    ).bind(member.profile_id, now, now, request.id),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "membership.request.reject", "join-request", request.id, { teamId: request.team_id }, now),
  ]);
}

function decisionToStatus(decision: "approve" | "reject"): string {
  return decision === "approve" ? "approved" : "rejected";
}

async function addLearnerToTeam(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  teamId: string,
  profileId: string,
  requestId?: string,
  retryCount = 0,
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "lobby", "TEAM_FORMATION_CLOSED", "只能在集结大厅添加学员。", 409);
  const team = await db.prepare(
    `SELECT id, room_id, name, seat_limit FROM teams WHERE id = ? AND room_id = ? LIMIT 1`,
  ).bind(teamId, room.id).first<TeamRow>();
  assertClassroom(team, "TEAM_NOT_FOUND", "没有找到这个课堂中的目标队伍。", 404);
  const target = await db.prepare(
    `SELECT p.id, p.nickname, u.username, u.display_name, u.role, u.status
     FROM profiles p LEFT JOIN auth_users u ON u.id = p.id
     WHERE p.id = ? LIMIT 1`,
  ).bind(profileId).first<{
    id: string;
    nickname: string;
    username: string | null;
    display_name: string | null;
    role: string | null;
    status: string | null;
  }>();
  // Direct add is intentionally restricted to local self-service learner
  // accounts.  An approved request may also originate from the hosting
  // platform identity bridge, which has a profile but no auth_users row.
  assertClassroom(
    target && (
      (target.role === "learner" && target.status === "active")
      || (Boolean(requestId) && target.role === null)
    ),
    "LEARNER_NOT_FOUND",
    "没有找到可加入的学员账号。",
    404,
  );

  const existing = await getAnyMembership(db, room.id, profileId);
  if (existing?.status === "active") {
    assertClassroom(existing.role === "learner" && existing.team_id === team.id, "ALREADY_IN_ANOTHER_TEAM", "该学员已经在本课堂的另一个队伍中。", 409);
    if (requestId) {
      const now = nowIso();
      await db.batch([
        db.prepare(
          `UPDATE team_join_requests SET status = 'approved', decided_by_profile_id = ?, decided_at = ?, updated_at = ?
           WHERE id = ? AND status = 'pending'`,
        ).bind(member.profile_id, now, now, requestId),
        bumpRoomStatement(db, room.id, now),
        auditStatement(db, room.id, member.profile_id, "membership.request.approve", "membership", existing.id, {
          teamId: team.id, profileId, requestId, alreadyActive: true,
        }, now),
      ]);
    }
    return;
  }
  if (existing) {
    const priorCards = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM card_grants WHERE member_id = ?`).bind(existing.id));
    assertClassroom(priorCards === 0, "MEMBER_HISTORY_LOCKED", "该学员在本课堂已有私密历史，不能重新分配席位；请新建课堂保留信息边界。", 409);
  }
  const learnerCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE room_id = ? AND role = 'learner' AND status = 'active'`).bind(room.id),
  );
  assertClassroom(learnerCount < MAX_LEARNERS_PER_ROOM, "ROOM_FULL", "这个课堂已达到人数上限。", 409);
  const usedSeats = new Set((await allRows<{ seat: number }>(
    db.prepare(`SELECT seat FROM memberships WHERE team_id = ? AND role = 'learner' AND status = 'active' AND seat IS NOT NULL`).bind(team.id),
  )).map((row) => Number(row.seat)));
  const seat = Array.from({ length: team.seat_limit }, (_, index) => index + 1).find((candidate) => !usedSeats.has(candidate));
  assertClassroom(seat, "TEAM_FULL", "这个队伍已经满员。", 409);

  const now = nowIso();
  const memberId = existing?.id ?? crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    existing
      ? db.prepare(
          `UPDATE memberships SET team_id = ?, role = 'learner', seat = ?, case_identity_id = NULL,
           pdmo_role = NULL, support_commitment = NULL, status = 'active', last_seen_at = ?, updated_at = ?
           WHERE id = ? AND status <> 'active'`,
        ).bind(team.id, seat, now, now, memberId)
      : db.prepare(
          `INSERT INTO memberships
           (id, room_id, profile_id, team_id, role, seat, case_identity_id, pdmo_role,
            support_commitment, status, last_seen_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'learner', ?, NULL, NULL, NULL, 'active', ?, ?, ?)`,
        ).bind(memberId, room.id, profileId, team.id, seat, now, now, now),
    db.prepare(
      `UPDATE team_join_requests SET status = 'rejected', decided_by_profile_id = ?, decided_at = ?, updated_at = ?
       WHERE profile_id = ? AND status = 'pending'
         AND team_id IN (SELECT id FROM teams WHERE room_id = ?)`,
    ).bind(member.profile_id, now, now, profileId, room.id),
  ];
  if (requestId) {
    statements.push(
      db.prepare(
        `UPDATE team_join_requests SET status = 'approved', decided_by_profile_id = ?, decided_at = ?, updated_at = ?
         WHERE id = ?`,
      ).bind(member.profile_id, now, now, requestId),
    );
  }
  statements.push(
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, requestId ? "membership.request.approve" : "membership.add", "membership", memberId, {
      teamId: team.id, seat, profileId, requestId: requestId ?? null,
    }, now),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    const concurrent = await getMembership(db, room.id, profileId);
    if (concurrent?.team_id === team.id) return;
    const message = error instanceof Error ? error.message : String(error);
    if (/unique constraint|uidx_memberships_team_seat/i.test(message) && retryCount < 4) {
      await addLearnerToTeam(db, member, room, teamId, profileId, requestId, retryCount + 1);
      return;
    }
    if (/unique constraint|uidx_memberships_team_seat/i.test(message)) {
      throw new ClassroomError("MEMBERSHIP_BUSY", "多名成员正在同时入队，请立即重试。", 409);
    }
    throw error;
  }
}

async function removeLearnerFromRoom(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  memberId: string,
): Promise<void> {
  requireDm(member);
  const target = await db.prepare(
    `SELECT m.*, p.nickname FROM memberships m JOIN profiles p ON p.id = m.profile_id
     WHERE m.id = ? AND m.room_id = ? AND m.status = 'active' LIMIT 1`,
  ).bind(memberId, room.id).first<MembershipRow>();
  assertClassroom(target && target.role === "learner", "MEMBER_NOT_FOUND", "没有找到可移除的学员成员。", 404);
  const now = nowIso();
  await db.batch([
    db.prepare(
      `UPDATE memberships SET team_id = NULL, seat = NULL, case_identity_id = NULL, pdmo_role = NULL,
       support_commitment = NULL, status = 'removed', updated_at = ? WHERE id = ? AND status = 'active'`,
    ).bind(now, target.id),
    db.prepare(
      `UPDATE team_join_requests SET status = 'rejected', decided_by_profile_id = ?, decided_at = ?, updated_at = ?
       WHERE profile_id = ? AND status = 'pending'
         AND team_id IN (SELECT id FROM teams WHERE room_id = ?)`,
    ).bind(member.profile_id, now, now, target.profile_id, room.id),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "membership.remove", "membership", target.id, {
      profileId: target.profile_id, previousTeamId: target.team_id, previousSeat: target.seat,
    }, now),
  ]);
}

async function assignFacilitator(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  member: MembershipRow,
  room: RoomRow,
  username: string,
): Promise<void> {
  requireFacilitatorManager(user, member, room);
  const target = await db.prepare(
    `SELECT id, username, display_name, role, status
     FROM auth_users WHERE username = ? LIMIT 1`,
  ).bind(username).first<{
    id: string;
    username: string;
    display_name: string;
    role: string;
    status: string;
  }>();
  assertClassroom(
    target && (target.role === "mentor" || target.role === "admin") && target.status === "active",
    "FACILITATOR_NOT_FOUND",
    `没有找到可指派的导师账号“${username}”。请确认用户名准确，且该账号已由后台标记为mentor。`,
    404,
  );

  const existing = await getAnyMembership(db, room.id, target.id);
  if (existing?.status === "active") {
    assertClassroom(existing.role === "dm", "FACILITATOR_HAS_LEARNER_SEAT", "这个账号已占用本课堂的学员席位，不能同时成为导师。", 409);
    return;
  }
  assertClassroom(
    !existing || existing.role === "dm",
    "FACILITATOR_HAS_LEARNER_HISTORY",
    "这个账号在本课堂已有学员历史，不能改成导师；请使用另一个导师账号。",
    409,
  );
  const facilitatorCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE room_id = ? AND role = 'dm' AND status = 'active'`).bind(room.id),
  );
  assertClassroom(facilitatorCount < MAX_FACILITATORS_PER_ROOM, "FACILITATOR_LIMIT_REACHED", "这场课堂已达到导师人数上限。", 409);

  const now = nowIso();
  const membershipId = existing?.id ?? crypto.randomUUID();
  const nickname = normalizeNickname(target.display_name);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .bind(target.id, nickname, now, now),
    existing
      ? db.prepare(
          `UPDATE memberships SET team_id = NULL, role = 'dm', seat = NULL, case_identity_id = NULL,
           pdmo_role = NULL, support_commitment = NULL, status = 'active', last_seen_at = ?, updated_at = ?
           WHERE id = ? AND status <> 'active'`,
        ).bind(now, now, membershipId)
      : db.prepare(
          `INSERT INTO memberships
           (id, room_id, profile_id, team_id, role, seat, case_identity_id, pdmo_role,
            support_commitment, status, last_seen_at, created_at, updated_at)
           VALUES (?, ?, ?, NULL, 'dm', NULL, NULL, NULL, NULL, 'active', ?, ?, ?)`,
        ).bind(membershipId, room.id, target.id, now, now, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "facilitator.assign", "membership", membershipId, {
      accountRole: target.role,
    }, now),
  ]);
}

async function removeFacilitator(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  member: MembershipRow,
  room: RoomRow,
  memberId: string,
): Promise<void> {
  requireFacilitatorManager(user, member, room);
  const target = await db.prepare(
    `SELECT m.*, p.nickname FROM memberships m JOIN profiles p ON p.id = m.profile_id
     WHERE m.id = ? AND m.room_id = ? AND m.role = 'dm' AND m.status = 'active' LIMIT 1`,
  ).bind(memberId, room.id).first<MembershipRow>();
  assertClassroom(target, "FACILITATOR_NOT_FOUND", "没有找到可移除的授课导师。", 404);
  assertClassroom(target.profile_id !== room.dm_profile_id, "ROOM_OWNER_REQUIRED", "课堂创建者是最终负责人，不能从自己的课堂移除。", 409);
  assertClassroom(target.id !== member.id, "CANNOT_REMOVE_SELF", "不能在主持中移除自己；请由课堂创建者或系统管理员处理。", 409);
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE memberships SET status = 'removed', updated_at = ? WHERE id = ? AND status = 'active'`).bind(now, target.id),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "facilitator.remove", "membership", target.id, {}, now),
  ]);
}

async function withdrawCard(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  cardId: string,
  memberId: string,
): Promise<void> {
  requireDm(member);
  assertClassroom(["identity", "private-read"].includes(room.phase), "PHASE_MISMATCH", "只能在讲解开始前撤回误发卡。", 409);
  const grant = await db
    .prepare(`SELECT id, state FROM card_grants WHERE room_id = ? AND chapter_id = ? AND card_id = ? AND member_id = ?`)
    .bind(room.id, chapter.id, cardId, memberId)
    .first<{ id: string; state: string }>();
  assertClassroom(grant, "CARD_GRANT_NOT_FOUND", "没有找到这张发牌记录。", 404);
  assertClassroom(grant.state !== "published", "CARD_ALREADY_PUBLISHED", "已经公开的信息不能无痕撤回；请在情报网中公开纠错。", 409);
  const now = nowIso();
  await db.batch([
    db.prepare(`DELETE FROM card_grants WHERE id = ?`).bind(grant.id),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "card.withdraw", "card", cardId, { memberId, previousState: grant.state }, now),
  ]);
}

async function grantCard(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  cardId: string,
  memberId: string,
): Promise<void> {
  requireDm(member);
  assertClassroom(["identity", "private-read"].includes(room.phase), "PHASE_MISMATCH", "只能在讲解开始前补发信息卡。", 409);
  const card = chapter.infoCards.find((candidate) => candidate.id === cardId);
  assertClassroom(card, "CARD_NOT_FOUND", "课程中不存在这张信息卡。", 404);
  const target = await db
    .prepare(`SELECT id, team_id FROM memberships WHERE id = ? AND room_id = ? AND role = 'learner' AND status = 'active'`)
    .bind(memberId, room.id)
    .first<{ id: string; team_id: string | null }>();
  assertClassroom(target, "MEMBER_NOT_FOUND", "目标学员不存在。", 404);
  assertClassroom(target.team_id, "TEAM_REQUIRED", "目标学员尚未进入队伍。", 409);
  const existing = await db
    .prepare(`SELECT member_id FROM card_grants WHERE room_id = ? AND chapter_id = ? AND team_id = ? AND card_id = ?`)
    .bind(room.id, chapter.id, target.team_id, cardId)
    .first<{ member_id: string }>();
  assertClassroom(
    !existing,
    "CARD_ALREADY_GRANTED",
    existing?.member_id === memberId ? "这张卡已经发给该学员。" : "这张卡已经发给本队另一位学员；请先撤回，再补发。",
    409,
  );
  const now = nowIso();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO card_grants (id, room_id, chapter_id, team_id, card_id, member_id, state, granted_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, 'unread', ?, NULL)`,
        )
        .bind(crypto.randomUUID(), room.id, chapter.id, target.team_id, cardId, memberId, now),
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "card.grant", "card", cardId, { memberId }, now),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique constraint/i.test(message)) throw new ClassroomError("CARD_ALREADY_GRANTED", "这张卡已经在团队中发放。", 409);
    throw error;
  }
}

async function assignAndDeal(db: ClassroomD1, member: MembershipRow, room: RoomRow, chapter: ClassroomChapter): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "lobby" || room.phase === "identity", "PHASE_MISMATCH", "只能在入场阶段分配身份和手牌。", 409);
  const existingGrantCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM card_grants WHERE room_id = ? AND chapter_id = ?`).bind(room.id, chapter.id),
  );
  if (existingGrantCount > 0) {
    throw new ClassroomError("CARDS_ALREADY_DEALT", "本章身份和信息卡已经发放，不能重复发牌。", 409);
  }
  const teams = await allRows<TeamRow>(db.prepare(`SELECT id, room_id, name, seat_limit FROM teams WHERE room_id = ? ORDER BY created_at`).bind(room.id));
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];

  for (const team of teams) {
    const learners = await allRows<MembershipRow>(
      db
        .prepare(
          `SELECT m.*, p.nickname FROM memberships m JOIN profiles p ON p.id = m.profile_id
           WHERE m.team_id = ? AND m.role = 'learner' AND m.status = 'active' ORDER BY m.seat`,
        )
        .bind(team.id),
    );
    assertClassroom(
      learners.length === team.seat_limit,
      "TEAM_NOT_READY",
      `${team.name}需要${team.seat_limit}名学员才能发牌，目前为${learners.length}名。`,
      409,
    );
    const cardsPerLearner = chapter.cardsPerLearner ?? Math.floor(chapter.infoCards.length / team.seat_limit);
    const dealPlan = buildIndependentRandomDealPlan(
      learners.map((learner) => learner.id),
      chapter.identities.map((identity) => identity.id),
      chapter.infoCards.map((card) => card.id),
      undefined,
      cardsPerLearner,
    );
    const cardById = new Map(chapter.infoCards.map((card) => [card.id, card]));
    dealPlan.forEach((assignment) => {
      statements.push(
        db.prepare(`UPDATE memberships SET case_identity_id = ?, pdmo_role = NULL, support_commitment = NULL, updated_at = ? WHERE id = ?`).bind(
          assignment.identityId,
          now,
          assignment.memberId,
        ),
      );
      for (const cardId of assignment.cardIds) {
        const card = cardById.get(cardId);
        assertClassroom(card, "CARD_NOT_FOUND", "随机牌组中出现课程未定义的手牌。", 500);
        statements.push(
          db
            .prepare(
              `INSERT INTO card_grants (id, room_id, chapter_id, team_id, card_id, member_id, state, granted_at, published_at)
               VALUES (?, ?, ?, ?, ?, ?, 'unread', ?, NULL)`,
            )
            .bind(crypto.randomUUID(), room.id, chapter.id, team.id, card.id, assignment.memberId, now),
        );
      }
    });
  }
  const cardsPerLearner = chapter.cardsPerLearner ?? (teams[0] ? Math.floor(chapter.infoCards.length / teams[0].seat_limit) : 0);
  statements.push(
    db.prepare(`UPDATE rooms SET phase = 'identity', version = version + 1, updated_at = ? WHERE id = ?`).bind(now, room.id),
    auditStatement(db, room.id, member.profile_id, "cards.deal", "chapter", chapter.id, {
      teams: teams.length,
      cardsPerTeam: chapter.infoCards.length,
      cardsPerLearner,
      dealMode: "identity-and-cards-independent-random",
    }, now),
  );
  await db.batch(statements);
}

async function movePhase(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  direction: "next" | "previous",
): Promise<void> {
  requireDm(member);
  const current = parsePhase(room.phase);
  assertClassroom(
    !(current === "debrief" && direction === "next"),
    "USE_CHAPTER_COMPLETION",
    "请使用“全部复盘完成，进入下一步／完成五步骤课件”；该操作会检查每名学员复盘并结算维护。",
    409,
  );
  const target = getAdjacentPhase(current, direction);
  if (target === current) return;
  if (direction === "next") await assertPhaseGate(db, room, current);
  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE rooms SET phase = ?, paused = 0, paused_at = NULL, phase_deadline_at = NULL,
         version = version + 1, updated_at = ? WHERE id = ?`,
      )
      .bind(target, now, room.id),
  ];
  if (current === "challenge-one" && target === "challenge-two") {
    statements.push(db.prepare(`UPDATE challenge_runs SET round = 2, updated_at = ? WHERE room_id = ? AND chapter_id = ?`).bind(now, room.id, room.chapter_id));
  }
  statements.push(auditStatement(db, room.id, member.profile_id, "phase.move", "room", room.id, { from: current, to: target }, now));
  await db.batch(statements);
}

async function assertPhaseGate(db: ClassroomD1, room: RoomRow, phase: ClassroomPhase): Promise<void> {
  if (phase === "lobby") {
    const learners = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE room_id = ? AND role = 'learner'`).bind(room.id));
    const seats = await scalarNumber(db.prepare(`SELECT COALESCE(SUM(seat_limit), 0) AS value FROM teams WHERE room_id = ?`).bind(room.id));
    assertClassroom(learners >= seats && seats > 0, "ROOM_NOT_READY", `需要${seats}名学员到齐后才能开局，目前为${learners}名。`, 409);
    const grants = await scalarNumber(
      db.prepare(`SELECT COUNT(*) AS value FROM card_grants WHERE room_id = ? AND chapter_id = ?`).bind(room.id, room.chapter_id),
    );
    assertClassroom(grants === learners * 3, "CARDS_NOT_DEALT", "请先在导师控制台随机分配身份，并让每人从完整12张牌池中随机抽取3张线索卡。", 409);
  }
  if (phase === "identity") {
    const unassigned = await scalarNumber(
      db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE room_id = ? AND role = 'learner' AND case_identity_id IS NULL`).bind(room.id),
    );
    assertClassroom(unassigned === 0, "IDENTITY_INCOMPLETE", "每个人都要先在页面看到自己的角色任务。", 409);
  }
  if (phase === "private-read") {
    const unread = await scalarNumber(
      db.prepare(`SELECT COUNT(*) AS value FROM card_grants WHERE room_id = ? AND chapter_id = ? AND state = 'unread'`).bind(room.id, room.chapter_id),
    );
    assertClassroom(unread === 0, "PRIVATE_READING_INCOMPLETE", `仍有${unread}张私密卡没有被持有人阅读。`, 409);
  }
  if (phase === "intel-brief") {
    const learners = await scalarNumber(
      db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE room_id = ? AND role = 'learner' AND status = 'active'`).bind(room.id),
    );
    const publishers = await scalarNumber(
      db.prepare(`SELECT COUNT(DISTINCT member_id) AS value FROM card_grants WHERE room_id = ? AND chapter_id = ? AND state = 'published'`).bind(room.id, room.chapter_id),
    );
    assertClassroom(publishers === learners, "INTEL_BRIEF_INCOMPLETE", "每个人都要先当面讲完至少1张线索，再点击发布到团队。", 409);
  }
  if (phase === "intel-network") {
    const teams = await allRows<{ id: string }>(db.prepare(`SELECT id FROM teams WHERE room_id = ?`).bind(room.id));
    const missing: string[] = [];
    for (const team of teams) {
      const sourceNodes = await scalarNumber(
        db
          .prepare(
            `SELECT COUNT(*) AS value FROM intelligence_nodes
             WHERE team_id = ? AND chapter_id = ? AND source_card_ids_json != '[]'`,
          )
          .bind(team.id, room.chapter_id),
      );
      const hasPerson = await scalarNumber(
        db
          .prepare(`SELECT COUNT(*) AS value FROM intelligence_nodes WHERE team_id = ? AND chapter_id = ? AND kind IN ('person','user')`)
          .bind(team.id, room.chapter_id),
      );
      const hasConstraint = await scalarNumber(
        db.prepare(`SELECT COUNT(*) AS value FROM intelligence_nodes WHERE team_id = ? AND chapter_id = ? AND kind = 'constraint'`).bind(team.id, room.chapter_id),
      );
      const hasContradiction = await scalarNumber(
        db.prepare(`SELECT COUNT(*) AS value FROM intelligence_edges WHERE team_id = ? AND chapter_id = ? AND kind IN ('contradicts','limits')`).bind(team.id, room.chapter_id),
      );
      if (sourceNodes < 2 || !hasPerson || !hasConstraint || !hasContradiction) missing.push(team.id);
    }
    assertClassroom(missing.length === 0, "INTEL_GATE_FAILED", "仍有团队没有完成情报网门槛：2条来源证据、用户/人物、约束和矛盾/限制关系。", 409);
  }
  if (phase === "dm-gate") {
    const teamCount = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM teams WHERE room_id = ?`).bind(room.id));
    const statementCount = await scalarNumber(
      db
        .prepare(
          `SELECT COUNT(DISTINCT team_id) AS value FROM worldline_entries
           WHERE room_id = ? AND chapter_id = ? AND kind = 'problem-statement'`,
        )
        .bind(room.id, room.chapter_id),
    );
    assertClassroom(statementCount === teamCount, "PROBLEM_STATEMENT_REQUIRED", "每队都要保存5句话：谁在做、哪里卡住、哪两张线索支持、还不知道什么、下一步试什么。", 409);
  }
  // PDMO is an optional advanced collaboration scaffold, not a learner seat
  // gate. Beginner groups may stay as one team after exchanging their random
  // information cards and enter the challenge without fixed P/D/M/O labels.
  if (phase === "challenge-one") {
    const teams = await allRows<{ id: string }>(db.prepare(`SELECT id FROM teams WHERE room_id = ?`).bind(room.id));
    for (const team of teams) {
      const active = await scalarNumber(
        db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE team_id = ? AND role = 'learner' AND status = 'active'`).bind(team.id),
      );
      const actions = await scalarNumber(
        db
          .prepare(
            `SELECT COUNT(*) AS value FROM challenge_actions a JOIN challenge_runs r ON r.id = a.run_id
             WHERE r.team_id = ? AND r.chapter_id = ? AND a.round = 1`,
          )
          .bind(team.id, room.chapter_id),
      );
      assertClassroom(actions === active, "ROUND_ONE_INCOMPLETE", "每个人都要先交出第1版做法。", 409);
    }
  }
  if (phase === "challenge-two") {
    const unresolved = await scalarNumber(
      db.prepare(`SELECT COUNT(*) AS value FROM challenge_runs WHERE room_id = ? AND chapter_id = ? AND resolution_json IS NULL`).bind(room.id, room.chapter_id),
    );
    const teamCount = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM teams WHERE room_id = ?`).bind(room.id));
    const runCount = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM challenge_runs WHERE room_id = ? AND chapter_id = ?`).bind(room.id, room.chapter_id));
    assertClassroom(runCount === teamCount && unresolved === 0, "CHALLENGE_UNRESOLVED", "每队4人都要交出第2版做法，再由导师按4项公开规则给出结果。", 409);
  }
  if (phase === "history") {
    assertClassroom(Boolean(room.history_revealed), "HISTORY_NOT_REVEALED", "请先让每队锁定“我们会怎么做”，再由导师打开有来源的真实历史。", 409);
  }
}

async function setCardState(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  cardId: string,
  state: "read" | "published",
): Promise<void> {
  requireLearner(member);
  assertClassroom(["identity", "private-read", "intel-brief", "intel-network", "dm-gate"].includes(room.phase), "PHASE_MISMATCH", "当前阶段不能更改手牌发布状态。", 409);
  const grant = await db
    .prepare(`SELECT id, state FROM card_grants WHERE room_id = ? AND chapter_id = ? AND card_id = ? AND member_id = ?`)
    .bind(room.id, chapter.id, cardId, member.id)
    .first<{ id: string; state: string }>();
  assertClassroom(grant, "CARD_FORBIDDEN", "这张信息卡不属于你。", 403);
  if (state === "published") assertClassroom(grant.state === "read" || grant.state === "published", "CARD_NOT_READ", "请先阅读，再决定是否发布。", 409);
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE card_grants SET state = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END WHERE id = ?`).bind(
      state,
      state,
      now,
      grant.id,
    ),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, `card.${state}`, "card", cardId, { memberId: member.id }, now),
  ]);
}

async function createIntelligenceNode(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  action: Extract<ClassroomAction, { type: "create-intelligence-node" }>,
): Promise<void> {
  requireLearner(member);
  assertClassroom(["intel-brief", "intel-network", "dm-gate"].includes(room.phase), "PHASE_MISMATCH", "当前阶段不能新增情报节点。", 409);
  if (action.sourceCardIds.length > 0) {
    const placeholders = action.sourceCardIds.map(() => "?").join(",");
    const count = await scalarNumber(
      db
        .prepare(
          `SELECT COUNT(DISTINCT card_id) AS value FROM card_grants
           WHERE room_id = ? AND chapter_id = ? AND team_id = ? AND state = 'published' AND card_id IN (${placeholders})`,
        )
        .bind(room.id, chapter.id, member.team_id, ...action.sourceCardIds),
    );
    assertClassroom(count === action.sourceCardIds.length, "CARD_NOT_PUBLISHED", "节点只能引用团队已经公开的信息卡。", 403);
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO intelligence_nodes
         (id, room_id, chapter_id, team_id, kind, title, explanation, source_card_ids_json, published_by_member_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, room.id, chapter.id, member.team_id, action.kind, action.title, action.explanation, JSON.stringify(action.sourceCardIds), member.id, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "intelligence.node.create", "intelligence-node", id, { kind: action.kind }, now),
  ]);
}

async function createIntelligenceEdge(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  action: Extract<ClassroomAction, { type: "create-intelligence-edge" }>,
): Promise<void> {
  requireLearner(member);
  assertClassroom(["intel-brief", "intel-network", "dm-gate"].includes(room.phase), "PHASE_MISMATCH", "当前阶段不能新增情报关系。", 409);
  assertClassroom(action.fromNodeId !== action.toNodeId, "INVALID_EDGE", "关系线不能连接同一个节点。", 400);
  const nodes = await allRows<{ id: string; team_id: string }>(
    db
      .prepare(`SELECT id, team_id FROM intelligence_nodes WHERE room_id = ? AND chapter_id = ? AND id IN (?, ?)`)
      .bind(room.id, chapter.id, action.fromNodeId, action.toNodeId),
  );
  assertClassroom(nodes.length === 2 && nodes.every((node) => node.team_id === member.team_id), "NODE_FORBIDDEN", "只能连接自己团队的情报节点。", 403);
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO intelligence_edges
         (id, room_id, chapter_id, team_id, from_node_id, to_node_id, kind, explanation, created_by_member_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, room.id, chapter.id, member.team_id, action.fromNodeId, action.toNodeId, action.kind, action.explanation, member.id, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "intelligence.edge.create", "intelligence-edge", id, { kind: action.kind }, now),
  ]);
}

async function submitProblemStatement(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  action: Extract<ClassroomAction, { type: "submit-problem-statement" }>,
): Promise<void> {
  requireLearner(member);
  assertClassroom(room.phase === "dm-gate", "PHASE_MISMATCH", "团队问题陈述应在DM认知门阶段提交。", 409);
  assertClassroom(member.team_id, "TEAM_REQUIRED", "你尚未加入团队。", 409);
  const existing = await db
    .prepare(
      `SELECT id FROM worldline_entries
       WHERE room_id = ? AND chapter_id = ? AND team_id = ? AND kind = 'problem-statement'`,
    )
    .bind(room.id, chapter.id, member.team_id)
    .first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const now = nowIso();
  const content = {
    user: action.user,
    sceneLoss: action.sceneLoss,
    evidenceSummary: action.evidenceSummary,
    unknown: action.unknown,
    decisionQuestion: action.decisionQuestion,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO worldline_entries
         (id, room_id, chapter_id, team_id, member_id, kind, content_json, frozen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'problem-statement', ?, NULL, ?, ?)
         ON CONFLICT(id) DO UPDATE SET member_id = excluded.member_id, content_json = excluded.content_json, updated_at = excluded.updated_at`,
      )
      .bind(id, room.id, chapter.id, member.team_id, member.id, JSON.stringify(content), now, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "problem-statement.submit", "team", member.team_id, content, now),
  ]);
}

async function selectChallenge(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  teamId: string,
  challengeId: string,
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "challenge-one", "PHASE_MISMATCH", "只有进入攻坚第一轮后才能锁定挑战。", 409);
  const challenge = chapter.challenges.find((candidate) => candidate.id === challengeId);
  assertClassroom(challenge, "CHALLENGE_NOT_FOUND", "挑战不存在。", 404);
  const team = await db.prepare(`SELECT id FROM teams WHERE room_id = ? AND id = ?`).bind(room.id, teamId).first<{ id: string }>();
  assertClassroom(team, "TEAM_NOT_FOUND", "团队不存在。", 404);
  const existing = await db.prepare(`SELECT id FROM challenge_runs WHERE team_id = ? AND chapter_id = ?`).bind(teamId, chapter.id).first<{ id: string }>();
  assertClassroom(!existing, "CHALLENGE_ALREADY_SELECTED", "这个团队已经锁定挑战。", 409);
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO challenge_runs
         (id, room_id, chapter_id, team_id, challenge_id, level, pressure_die, round, status,
          consequence, rubric_json, resolution_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 'active', NULL, NULL, NULL, ?, ?)`,
      )
      .bind(id, room.id, chapter.id, teamId, challenge.id, challenge.level, now, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "challenge.select", "challenge-run", id, { teamId, challengeId, level: challenge.level }, now),
  ]);
}

async function rollPressure(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  teamId: string,
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "challenge-one", "PHASE_MISMATCH", "压力骰只能在攻坚第一轮投放。", 409);
  const run = await db
    .prepare(`SELECT id, pressure_die FROM challenge_runs WHERE room_id = ? AND chapter_id = ? AND team_id = ?`)
    .bind(room.id, chapter.id, teamId)
    .first<{ id: string; pressure_die: number | null }>();
  assertClassroom(run, "CHALLENGE_NOT_SELECTED", "请先锁定挑战。", 409);
  assertClassroom(run.pressure_die == null, "PRESSURE_ALREADY_ROLLED", "压力事件已经生成；如需重投，必须通过解锁能力并记录为新的事件。", 409);
  const random = new Uint8Array(1);
  crypto.getRandomValues(random);
  const die = (random[0] % 6) + 1;
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE challenge_runs SET pressure_die = ?, updated_at = ? WHERE id = ?`).bind(die, now, run.id),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "pressure.roll", "challenge-run", run.id, { die }, now),
  ]);
}

async function submitChallengeAction(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  action: Extract<ClassroomAction, { type: "submit-challenge-action" }>,
): Promise<void> {
  requireLearner(member);
  assertClassroom(room.phase === "challenge-one" || room.phase === "challenge-two", "PHASE_MISMATCH", "当前不在攻坚行动阶段。", 409);
  // The database column remains for legacy archives, but every new action is
  // an unlabeled Young Builder contribution. P/D/M/O belong to mentor seats.
  const contributionRole = "TEAM";
  const run = await db
    .prepare(`SELECT id, round FROM challenge_runs WHERE team_id = ? AND chapter_id = ?`)
    .bind(member.team_id, chapter.id)
    .first<{ id: string; round: number }>();
  assertClassroom(run, "CHALLENGE_NOT_SELECTED", "DM尚未为团队锁定挑战。", 409);
  const round = room.phase === "challenge-two" ? 2 : 1;
  if (round === 2) {
    const prior = await db
      .prepare(
        `SELECT goal, method, evidence, resource, success_signal, stop_condition
         FROM challenge_actions WHERE run_id = ? AND member_id = ? AND round = 1`,
      )
      .bind(run.id, member.id)
      .first<Record<string, string>>();
    assertClassroom(prior, "ROUND_ONE_REQUIRED", "请先提交第一轮行动。", 409);
    const changed =
      prior.goal !== action.goal ||
      prior.method !== action.method ||
      prior.evidence !== action.evidence ||
      prior.resource !== action.resource ||
      prior.success_signal !== action.successSignal ||
      prior.stop_condition !== action.stopCondition;
    assertClassroom(changed, "ITERATION_REQUIRED", "第二轮不能原样重复，至少修改证据、方法、资源、指标或停止条件。", 409);
  }
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO challenge_actions
         (id, run_id, round, member_id, pdmo_role, goal, method, evidence, resource, success_signal, stop_condition, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id, round, member_id) DO UPDATE SET
           pdmo_role = excluded.pdmo_role, goal = excluded.goal, method = excluded.method,
           evidence = excluded.evidence, resource = excluded.resource,
           success_signal = excluded.success_signal, stop_condition = excluded.stop_condition`,
      )
      .bind(
        crypto.randomUUID(),
        run.id,
        round,
        member.id,
        contributionRole,
        action.goal,
        action.method,
        action.evidence,
        action.resource,
        action.successSignal,
        action.stopCondition,
        now,
      ),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "challenge.action.submit", "challenge-run", run.id, {
      round,
      contributionMode: "young-builder-team",
    }, now),
  ]);
}
async function scoreChallenge(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  teamId: string,
  rubric: ChallengeRubric,
  consequence: string,
  idempotencyKey: string,
): Promise<boolean> {
  requireDm(member);
  assertClassroom(room.phase === "challenge-two", "PHASE_MISMATCH", "最终结算只能在第二轮攻坚阶段进行。", 409);
  const replay = await findTransactionByIdempotency(db, idempotencyKey);
  if (replay) return true;
  const run = await db
    .prepare(`SELECT id, challenge_id, resolution_json FROM challenge_runs WHERE room_id = ? AND chapter_id = ? AND team_id = ?`)
    .bind(room.id, chapter.id, teamId)
    .first<{ id: string; challenge_id: string; resolution_json: string | null }>();
  assertClassroom(run, "CHALLENGE_NOT_SELECTED", "团队尚未锁定挑战。", 409);
  assertClassroom(!run.resolution_json, "CHALLENGE_ALREADY_RESOLVED", "这项挑战已经结算。", 409);
  const active = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE team_id = ? AND role = 'learner' AND status = 'active'`).bind(teamId),
  );
  const roundTwoActions = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM challenge_actions WHERE run_id = ? AND round = 2`).bind(run.id),
  );
  assertClassroom(roundTwoActions === active, "ROUND_TWO_INCOMPLETE", "每名学员都必须提交第二轮行动后才能结算。", 409);
  const challenge = chapter.challenges.find((candidate) => candidate.id === run.challenge_id);
  assertClassroom(challenge, "CHALLENGE_NOT_FOUND", "课程挑战内容不存在。", 500);
  const resolution = resolveChallenge(challenge.baseIncomeTenths, rubric);
  if (resolution.requiresConsequence) {
    assertClassroom(consequence.trim().length >= 4, "CONSEQUENCE_REQUIRED", "有代价成功或学习性失败必须记录世界线后果。", 400);
  }
  const treasury = `treasury:${teamId}`;
  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE challenge_runs SET status = 'resolved', consequence = ?, rubric_json = ?, resolution_json = ?, updated_at = ? WHERE id = ? AND resolution_json IS NULL`)
      .bind(consequence || null, JSON.stringify(rubric), JSON.stringify(resolution), now, run.id),
  ];
  if (resolution.incomeTenths > 0) {
    statements.push(
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths + ? WHERE id = ?`).bind(resolution.incomeTenths, treasury),
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: chapter.id,
        fromAccountId: null,
        toAccountId: treasury,
        amountTenths: resolution.incomeTenths,
        category: "mission-contract",
        sourceObjectId: run.id,
        createdByMemberId: member.id,
        idempotencyKey,
        reason: `${challenge.title}公开量规结算`,
        createdAt: now,
      }),
    );
  } else {
    // A zero-income learning failure is still audited, but zero-value ledger rows are intentionally forbidden.
    assertClassroom(!(await findTransactionBySource(db, room.id, "mission-contract", run.id)), "CHALLENGE_ALREADY_RESOLVED", "这项挑战已经结算。", 409);
  }
  statements.push(
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "challenge.resolve", "challenge-run", run.id, { rubric, resolution, consequence }, now),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function awardReputation(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  targetMemberId: string,
  scores: Extract<ClassroomAction, { type: "award-reputation" }>["scores"],
  evidenceObjectId: string,
  reason: string,
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "growth" || room.phase === "debrief", "PHASE_MISMATCH", "个人声望应在成长盘或复盘阶段依据作品结算。", 409);
  const target = await db
    .prepare(`SELECT id, profile_id FROM memberships WHERE id = ? AND room_id = ? AND role = 'learner'`)
    .bind(targetMemberId, room.id)
    .first<{ id: string; profile_id: string }>();
  assertClassroom(target, "MEMBER_NOT_FOUND", "学员不存在。", 404);
  const already = await scalarNumber(
    db
      .prepare(
        `SELECT COUNT(*) AS value FROM reputation_entries
         WHERE room_id = ? AND chapter_id = ? AND profile_id = ? AND evidence_object_id = ?`,
      )
      .bind(room.id, chapter.id, target.profile_id, evidenceObjectId),
  );
  assertClassroom(already === 0, "REPUTATION_ALREADY_AWARDED", "这份作品已经结算过声望。", 409);
  const existingRows = await allRows<{ dimension: ReputationDimension; points: number }>(
    db
      .prepare(
        `SELECT dimension, COALESCE(SUM(points), 0) AS points FROM reputation_entries
         WHERE room_id = ? AND chapter_id = ? AND profile_id = ? GROUP BY dimension`,
      )
      .bind(room.id, chapter.id, target.profile_id),
  );
  const existing = { evidence: 0, modeling: 0, delivery: 0, support: 0, iteration: 0, responsibility: 0 };
  for (const row of existingRows) existing[row.dimension] = row.points;
  const combined = Object.fromEntries(
    (Object.keys(existing) as ReputationDimension[]).map((dimension) => [dimension, existing[dimension] + scores[dimension]]),
  ) as typeof existing;
  const normalized = calculateReputation(combined, 0).normalized;
  assertClassroom(
    (Object.keys(existing) as ReputationDimension[]).every((dimension) => normalized[dimension] === combined[dimension]),
    "REPUTATION_CAP_EXCEEDED",
    "本章声望超过维度上限或总上限12 RP。",
    409,
  );
  const awardTotal = Object.values(scores).reduce((sum, value) => sum + value, 0);
  assertClassroom(awardTotal > 0, "EMPTY_REPUTATION_AWARD", "声望结算至少要有1 RP。", 400);
  const now = nowIso();
  const statements = (Object.keys(scores) as ReputationDimension[])
    .filter((dimension) => scores[dimension] > 0)
    .map((dimension) =>
      db
        .prepare(
          `INSERT INTO reputation_entries
           (id, profile_id, room_id, chapter_id, dimension, points, evidence_object_id,
            awarded_by_member_id, reason, reversal_of, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          target.profile_id,
          room.id,
          chapter.id,
          dimension,
          scores[dimension],
          evidenceObjectId,
          member.id,
          reason,
          now,
        ),
    );
  statements.push(
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "reputation.award", "membership", target.id, { scores, evidenceObjectId, reason }, now),
  );
  await db.batch(statements);
}

async function saveGratitudeVote(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  toMemberId: string,
  reason: string,
): Promise<void> {
  requireLearner(member);
  assertClassroom(room.phase === "growth", "PHASE_MISMATCH", "协作感谢只能在成长盘阶段记录。", 409);
  assertClassroom(member.id !== toMemberId, "SELF_VOTE_FORBIDDEN", "感谢标记不能投给自己。", 400);
  const target = await db.prepare(`SELECT id, team_id FROM memberships WHERE id = ? AND status = 'active'`).bind(toMemberId).first<{ id: string; team_id: string | null }>();
  assertClassroom(target?.team_id === member.team_id, "TEAM_FORBIDDEN", "只能感谢同队成员。", 403);
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO gratitude_votes (id, room_id, chapter_id, from_member_id, to_member_id, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(room_id, chapter_id, from_member_id) DO UPDATE SET to_member_id = excluded.to_member_id, reason = excluded.reason, created_at = excluded.created_at`,
      )
      .bind(crypto.randomUUID(), room.id, chapter.id, member.id, toMemberId, reason, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "gratitude.vote", "membership", toMemberId, { reason }, now),
  ]);
}

async function distributeProfit(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  teamId: string,
  percent: 0 | 20 | 40,
  idempotencyKey: string,
): Promise<boolean> {
  requireDm(member);
  assertClassroom(room.phase === "growth", "PHASE_MISMATCH", "个人收益只能在成长盘阶段分配。", 409);
  if (await findTransactionByIdempotency(db, `${idempotencyKey}:0`)) return true;
  const team = await db.prepare(`SELECT id FROM teams WHERE id = ? AND room_id = ?`).bind(teamId, room.id).first<{ id: string }>();
  assertClassroom(team, "TEAM_NOT_FOUND", "团队不存在。", 404);
  const learners = await allRows<{ id: string; profile_id: string }>(
    db.prepare(`SELECT id, profile_id FROM memberships WHERE team_id = ? AND role = 'learner' AND status = 'active' ORDER BY seat`).bind(teamId),
  );
  const economics = await getChapterEconomics(db, room.id, chapter.id, teamId);
  const treasuryBalance = await getTeamTreasuryBalance(db, teamId);
  const reserveTenths = 20;
  const availableProfitTenths = Math.max(0, Math.min(economics.profitRemainingTenths, treasuryBalance - reserveTenths));
  const deliveryRows = await allRows<{ member_id: string; points: number }>(
    db
      .prepare(
        `SELECT m.id AS member_id, COALESCE(SUM(r.points), 0) AS points
         FROM memberships m
         LEFT JOIN reputation_entries r ON r.profile_id = m.profile_id AND r.room_id = ? AND r.chapter_id = ? AND r.dimension = 'delivery'
         WHERE m.team_id = ? AND m.role = 'learner' AND m.status = 'active'
         GROUP BY m.id`,
      )
      .bind(room.id, chapter.id, teamId),
  );
  const votes = await allRows<{ from_member_id: string; to_member_id: string; reason: string }>(
    db.prepare(`SELECT from_member_id, to_member_id, reason FROM gratitude_votes WHERE room_id = ? AND chapter_id = ?`).bind(room.id, chapter.id),
  );
  const distribution = calculateProfitDistribution({
    availableProfitTenths,
    distributionPercent: percent,
    members: learners.map((learner) => ({
      memberId: learner.id,
      eligible: true,
      roleDeliveryScore: deliveryRows.find((row) => row.member_id === learner.id)?.points ?? 0,
    })),
    gratitudeVotes: votes.map((vote) => ({ fromMemberId: vote.from_member_id, toMemberId: vote.to_member_id, reason: vote.reason })),
  });
  if (percent > 0) {
    assertClassroom(distribution.poolTenths > 0, "NO_DISTRIBUTABLE_PROFIT", "扣除成本、维护和2 C储备后没有可分配利润。", 409);
  }
  const treasury = `treasury:${teamId}`;
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  let transactionIndex = 0;
  for (const learner of learners) {
    const payout = distribution.payoutsTenths[learner.id] ?? 0;
    if (payout <= 0) continue;
    const wallet = `wallet:${learner.profile_id}`;
    statements.push(
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(payout, treasury),
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths + ? WHERE id = ?`).bind(payout, wallet),
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: chapter.id,
        fromAccountId: treasury,
        toAccountId: wallet,
        amountTenths: payout,
        category: "distribution",
        sourceObjectId: `distribution:${chapter.id}:${teamId}:${learner.id}`,
        createdByMemberId: member.id,
        idempotencyKey: `${idempotencyKey}:${transactionIndex}`,
        reason: `${chapter.title}个人收益：50%平等劳动＋30%角色交付＋20%协作贡献`,
        createdAt: now,
      }),
    );
    transactionIndex += 1;
  }
  if (statements.length === 0) {
    // A deliberate 0% retention is recorded as an audit event without fabricating a zero-value transaction.
    statements.push(
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "profit.retain", "team", teamId, { percent, availableProfitTenths }, now),
    );
    await db.batch(statements);
    return false;
  }
  statements.push(
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "profit.distribute", "team", teamId, { percent, ...distribution }, now),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (await findTransactionByIdempotency(db, `${idempotencyKey}:0`)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function proposePurchase(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  campaign: ClassroomCampaign,
  assetId: string,
  idempotencyKey: string,
): Promise<void> {
  requireLearner(member);
  assertClassroom(room.phase === "growth", "PHASE_MISMATCH", "只能在成长盘提出资产购买。", 409);
  const asset = campaign.assets.find((candidate) => candidate.id === assetId);
  assertClassroom(asset, "ASSET_NOT_FOUND", "资产不存在。", 404);
  const reputation = await getProfileReputation(db, member.profile_id);
  assertClassroom(reputation >= asset.prerequisiteRp, "REPUTATION_REQUIRED", `需要${asset.prerequisiteRp} RP才能发起这项购买。`, 409);
  const owned = await db.prepare(`SELECT id FROM team_assets WHERE team_id = ? AND asset_id = ?`).bind(member.team_id, assetId).first<{ id: string }>();
  assertClassroom(!owned, "ASSET_ALREADY_OWNED", "团队已经拥有这项资产。", 409);
  const pending = await db
    .prepare(`SELECT id FROM purchase_proposals WHERE team_id = ? AND asset_id = ? AND status = 'pending'`)
    .bind(member.team_id, assetId)
    .first<{ id: string }>();
  assertClassroom(!pending, "PROPOSAL_EXISTS", "这项资产已经在表决。", 409);
  const proposalId = crypto.randomUUID();
  const now = nowIso();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO purchase_proposals
           (id, room_id, team_id, asset_id, proposed_by_member_id, status, idempotency_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        )
        .bind(proposalId, room.id, member.team_id, assetId, member.id, idempotencyKey, now, now),
      db.prepare(`INSERT INTO purchase_votes (id, proposal_id, member_id, approve, created_at) VALUES (?, ?, ?, 1, ?)`).bind(
        crypto.randomUUID(),
        proposalId,
        member.id,
        now,
      ),
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "asset.propose", "purchase-proposal", proposalId, { assetId }, now),
    ]);
  } catch (error) {
    const replay = await db.prepare(`SELECT id FROM purchase_proposals WHERE idempotency_key = ?`).bind(idempotencyKey).first<{ id: string }>();
    if (replay) return;
    throw error;
  }
}

async function votePurchase(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  campaign: ClassroomCampaign,
  proposalId: string,
  approve: boolean,
  idempotencyKey: string,
): Promise<boolean> {
  requireLearner(member);
  assertClassroom(room.phase === "growth", "PHASE_MISMATCH", "资产表决只能在成长盘阶段进行。", 409);
  const proposal = await db
    .prepare(`SELECT id, team_id, asset_id, status FROM purchase_proposals WHERE id = ? AND room_id = ?`)
    .bind(proposalId, room.id)
    .first<{ id: string; team_id: string; asset_id: string; status: string }>();
  assertClassroom(proposal, "PROPOSAL_NOT_FOUND", "购买提案不存在。", 404);
  assertClassroom(proposal.team_id === member.team_id, "TEAM_FORBIDDEN", "不能参与其他团队的表决。", 403);
  if (proposal.status === "accepted") return true;
  assertClassroom(proposal.status === "pending", "PROPOSAL_CLOSED", "这项表决已经结束。", 409);
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO purchase_votes (id, proposal_id, member_id, approve, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(proposal_id, member_id) DO UPDATE SET approve = excluded.approve, created_at = excluded.created_at`,
      )
      .bind(crypto.randomUUID(), proposalId, member.id, approve ? 1 : 0, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "asset.vote", "purchase-proposal", proposalId, { approve }, now),
  ]);
  const learnerCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE team_id = ? AND role = 'learner' AND status = 'active'`).bind(member.team_id),
  );
  const voteCounts = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN approve = 1 THEN 1 ELSE 0 END), 0) AS approvals,
              COALESCE(SUM(CASE WHEN approve = 0 THEN 1 ELSE 0 END), 0) AS rejections
       FROM purchase_votes WHERE proposal_id = ?`,
    )
    .bind(proposalId)
    .first<{ approvals: number; rejections: number }>();
  if ((voteCounts?.rejections ?? 0) > learnerCount / 2) {
    await db.prepare(`UPDATE purchase_proposals SET status = 'rejected', updated_at = ? WHERE id = ? AND status = 'pending'`).bind(nowIso(), proposalId).run();
    return false;
  }
  if ((voteCounts?.approvals ?? 0) <= learnerCount / 2) return false;
  const asset = campaign.assets.find((candidate) => candidate.id === proposal.asset_id);
  assertClassroom(asset, "ASSET_NOT_FOUND", "资产内容不存在。", 500);
  const treasury = `treasury:${member.team_id}`;
  const transactionKey = `${idempotencyKey}:purchase`;
  if (await findTransactionByIdempotency(db, transactionKey)) return true;
  const acquiredAt = nowIso();
  try {
    await db.batch([
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(asset.priceTenths, treasury),
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: chapter.id,
        fromAccountId: treasury,
        toAccountId: null,
        amountTenths: asset.priceTenths,
        category: asset.type === "research" ? "research" : asset.type === "product" || asset.type === "infrastructure" ? "product" : asset.type === "market" || asset.type === "brand" || asset.type === "channel" ? "market" : "operations",
        sourceObjectId: proposalId,
        createdByMemberId: member.id,
        idempotencyKey: transactionKey,
        reason: `团队购买资产：${asset.name}`,
        createdAt: acquiredAt,
      }),
      db
        .prepare(
          `INSERT INTO team_assets
           (id, room_id, team_id, asset_id, active, acquired_price_tenths, acquired_at, last_maintained_chapter_id)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), room.id, member.team_id, asset.id, asset.priceTenths, acquiredAt, chapter.id),
      db.prepare(`UPDATE purchase_proposals SET status = 'accepted', updated_at = ? WHERE id = ? AND status = 'pending'`).bind(acquiredAt, proposalId),
      bumpRoomStatement(db, room.id, acquiredAt),
      auditStatement(db, room.id, member.profile_id, "asset.purchase", "asset", asset.id, { proposalId, priceTenths: asset.priceTenths }, acquiredAt),
    ]);
  } catch (error) {
    if (await findTransactionByIdempotency(db, transactionKey)) return true;
    const acquired = await db.prepare(`SELECT id FROM team_assets WHERE team_id = ? AND asset_id = ?`).bind(member.team_id, asset.id).first<{ id: string }>();
    if (acquired) return true;
    throw mapLedgerError(error);
  }
  return false;
}
async function personalPurchase(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  itemId: string,
  idempotencyKey: string,
): Promise<boolean> {
  requireLearner(member);
  assertClassroom(room.phase === "growth", "PHASE_MISMATCH", "个人工具只能在成长盘阶段购买。", 409);
  if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
  const item = PERSONAL_SHOP.find((candidate) => candidate.id === itemId);
  assertClassroom(item, "ITEM_NOT_FOUND", "个人工具不存在。", 404);
  const reputation = await getProfileReputation(db, member.profile_id);
  assertClassroom(reputation >= ("prerequisiteRp" in item ? item.prerequisiteRp : 0), "REPUTATION_REQUIRED", "声望尚未达到这项工具的解锁门槛。", 409);
  const wallet = `wallet:${member.profile_id}`;
  const entryId = crypto.randomUUID();
  const now = nowIso();
  try {
    await db.batch([
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(item.priceTenths, wallet),
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: room.chapter_id,
        fromAccountId: wallet,
        toAccountId: null,
        amountTenths: item.priceTenths,
        category: "personal-purchase",
        sourceObjectId: entryId,
        createdByMemberId: member.id,
        idempotencyKey,
        reason: `个人购买：${item.name}`,
        createdAt: now,
      }),
      db
        .prepare(
          `INSERT INTO worldline_entries
           (id, room_id, chapter_id, team_id, member_id, kind, content_json, frozen_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'personal-item', ?, NULL, ?, ?)`,
        )
        .bind(entryId, room.id, room.chapter_id, member.team_id, member.id, JSON.stringify({ itemId, name: item.name, description: item.description }), now, now),
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "personal-item.purchase", "personal-item", entryId, { itemId, priceTenths: item.priceTenths }, now),
    ]);
  } catch (error) {
    if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function reinvest(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  teamId: string,
  amountTenths: number,
  idempotencyKey: string,
): Promise<boolean> {
  requireLearner(member);
  assertClassroom(member.team_id === teamId, "TEAM_FORBIDDEN", "只能返投自己的团队。", 403);
  assertClassroom(room.phase === "growth", "PHASE_MISMATCH", "个人返投只能在成长盘阶段进行。", 409);
  if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
  const wallet = `wallet:${member.profile_id}`;
  const treasury = `treasury:${teamId}`;
  const now = nowIso();
  try {
    await db.batch([
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(amountTenths, wallet),
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths + ? WHERE id = ?`).bind(amountTenths, treasury),
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: room.chapter_id,
        fromAccountId: wallet,
        toAccountId: treasury,
        amountTenths,
        category: "reinvestment",
        sourceObjectId: `reinvestment:${member.id}:${idempotencyKey}`,
        createdByMemberId: member.id,
        idempotencyKey,
        reason: "Young Builder个人返投团队",
        createdAt: now,
      }),
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "wallet.reinvest", "team", teamId, { amountTenths }, now),
    ]);
  } catch (error) {
    if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function recordFinancing(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  teamId: string,
  amountTenths: number,
  reason: string,
  idempotencyKey: string,
): Promise<boolean> {
  requireDm(member);
    assertClassroom(["challenge-one", "challenge-two", "growth"].includes(room.phase), "PHASE_MISMATCH", "带条件的外部资源只能在两次试做或“算账和选工具”阶段由导师记录。", 409);
  if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
  const team = await db.prepare(`SELECT id FROM teams WHERE id = ? AND room_id = ?`).bind(teamId, room.id).first<{ id: string }>();
  assertClassroom(team, "TEAM_NOT_FOUND", "团队不存在。", 404);
  const now = nowIso();
  try {
    await db.batch([
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths + ? WHERE id = ?`).bind(amountTenths, `treasury:${teamId}`),
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: room.chapter_id,
        fromAccountId: null,
        toAccountId: `treasury:${teamId}`,
        amountTenths,
        category: "financing",
        sourceObjectId: `financing:${idempotencyKey}`,
        createdByMemberId: member.id,
        idempotencyKey,
        reason,
        createdAt: now,
      }),
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "financing.record", "team", teamId, { amountTenths, reason }, now),
    ]);
  } catch (error) {
    if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function recordPaperLedger(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  teamId: string,
  flow: "inflow" | "outflow",
  category: Extract<ClassroomAction, { type: "record-paper-ledger" }>["category"],
  amountTenths: number,
  reason: string,
  idempotencyKey: string,
): Promise<boolean> {
  requireDm(member);
  if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
  const inflowCategories = new Set(["user-validation", "asset-revenue"]);
  const outflowCategories = new Set(["research", "product", "market", "operations", "maintenance"]);
  assertClassroom(
    flow === "inflow" ? inflowCategories.has(category) : outflowCategories.has(category),
    "LEDGER_CATEGORY_DIRECTION_MISMATCH",
    "补录类别与收入／支出方向不一致。",
    400,
  );
  const team = await db.prepare(`SELECT id FROM teams WHERE id = ? AND room_id = ?`).bind(teamId, room.id).first<{ id: string }>();
  assertClassroom(team, "TEAM_NOT_FOUND", "团队不存在。", 404);
  const treasury = `treasury:${teamId}`;
  const now = nowIso();
  const sourceObjectId = `paper-recovery:${idempotencyKey}`;
  const balanceStatement =
    flow === "inflow"
      ? db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths + ? WHERE id = ?`).bind(amountTenths, treasury)
      : db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(amountTenths, treasury);
  try {
    await db.batch([
      balanceStatement,
      ledgerInsertStatement(db, {
        roomId: room.id,
        chapterId: room.chapter_id,
        fromAccountId: flow === "outflow" ? treasury : null,
        toAccountId: flow === "inflow" ? treasury : null,
        amountTenths,
        category,
        sourceObjectId,
        createdByMemberId: member.id,
        idempotencyKey,
        reason: `实体账本补录：${reason}`,
        createdAt: now,
      }),
      bumpRoomStatement(db, room.id, now),
      auditStatement(db, room.id, member.profile_id, "ledger.paper-recovery", "team", teamId, {
        flow,
        category,
        amountTenths,
        reason,
      }, now),
    ]);
  } catch (error) {
    if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function reverseTransaction(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  transactionId: string,
  reason: string,
  idempotencyKey: string,
): Promise<boolean> {
  requireDm(member);
  if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
  const original = await db
    .prepare(
      `SELECT id, chapter_id, from_account_id, to_account_id, amount_tenths, category, reversal_of
       FROM ledger_transactions WHERE id = ? AND room_id = ?`,
    )
    .bind(transactionId, room.id)
    .first<{
      id: string;
      chapter_id: string;
      from_account_id: string | null;
      to_account_id: string | null;
      amount_tenths: number;
      category: LedgerCategory;
      reversal_of: string | null;
    }>();
  assertClassroom(original, "TRANSACTION_NOT_FOUND", "原交易不存在。", 404);
  assertClassroom(!original.reversal_of && original.category !== "correction", "REVERSAL_OF_REVERSAL_FORBIDDEN", "不能再次冲正一笔冲正记录。", 409);
  const existing = await db.prepare(`SELECT id FROM ledger_transactions WHERE reversal_of = ?`).bind(original.id).first<{ id: string }>();
  assertClassroom(!existing, "TRANSACTION_ALREADY_REVERSED", "这笔交易已经有冲正记录。", 409);
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  if (original.to_account_id) {
    statements.push(
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(original.amount_tenths, original.to_account_id),
    );
  }
  if (original.from_account_id) {
    statements.push(
      db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths + ? WHERE id = ?`).bind(original.amount_tenths, original.from_account_id),
    );
  }
  statements.push(
    ledgerInsertStatement(db, {
      roomId: room.id,
      chapterId: original.chapter_id,
      fromAccountId: original.to_account_id,
      toAccountId: original.from_account_id,
      amountTenths: original.amount_tenths,
      category: "correction",
      sourceObjectId: original.id,
      createdByMemberId: member.id,
      idempotencyKey,
      reason: `冲正：${reason}`,
      reversalOf: original.id,
      createdAt: now,
    }),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "ledger.reverse", "ledger-transaction", original.id, { reason }, now),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (await findTransactionByIdempotency(db, idempotencyKey)) return true;
    throw mapLedgerError(error);
  }
  return false;
}

async function freezeWorldline(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  teamId: string,
  decision: string,
  rationale: string,
): Promise<void> {
  requireTeamAccess(member, teamId);
  assertClassroom(room.phase === "history" || room.phase === "growth", "PHASE_MISMATCH", "只能在成长盘完成后冻结玩家世界线。", 409);
  const existing = await db
    .prepare(`SELECT id, frozen_at FROM worldline_entries WHERE room_id = ? AND chapter_id = ? AND team_id = ? AND kind = 'team-decision'`)
    .bind(room.id, chapter.id, teamId)
    .first<{ id: string; frozen_at: string | null }>();
  assertClassroom(!existing?.frozen_at, "WORLDLINE_ALREADY_FROZEN", "团队世界线已经冻结，不能覆盖。", 409);
  const now = nowIso();
  const id = existing?.id ?? crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO worldline_entries
         (id, room_id, chapter_id, team_id, member_id, kind, content_json, frozen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'team-decision', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, frozen_at = excluded.frozen_at, updated_at = excluded.updated_at`,
      )
      .bind(id, room.id, chapter.id, teamId, member.id, JSON.stringify({ decision, rationale }), now, now, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "worldline.freeze", "team", teamId, { decision, rationale }, now),
  ]);
}

async function revealHistory(db: ClassroomD1, member: MembershipRow, room: RoomRow): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "history", "PHASE_MISMATCH", "只有进入史实对照阶段后才能揭晓。", 409);
  const teamCount = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM teams WHERE room_id = ?`).bind(room.id));
  const frozenCount = await scalarNumber(
    db
      .prepare(
        `SELECT COUNT(DISTINCT team_id) AS value FROM worldline_entries
         WHERE room_id = ? AND chapter_id = ? AND kind = 'team-decision' AND frozen_at IS NOT NULL`,
      )
      .bind(room.id, room.chapter_id),
  );
  assertClassroom(teamCount > 0 && frozenCount === teamCount, "WORLDLINE_NOT_FROZEN", "所有团队必须先冻结自己的决定，才能打开史实。", 409);
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE rooms SET player_timeline_frozen = 1, history_revealed = 1, version = version + 1, updated_at = ? WHERE id = ?`).bind(now, room.id),
    auditStatement(db, room.id, member.profile_id, "history.reveal", "chapter", room.chapter_id, { frozenTeams: frozenCount }, now),
  ]);
}

async function submitReflection(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  answers: string[],
  realityAction: string,
): Promise<void> {
  requireLearner(member);
  assertClassroom(Boolean(room.history_revealed), "HISTORY_REQUIRED", "请先完成史实对照，再提交复盘。", 409);
  const existing = await db
    .prepare(`SELECT id FROM worldline_entries WHERE room_id = ? AND chapter_id = ? AND member_id = ? AND kind = 'reflection'`)
    .bind(room.id, chapter.id, member.id)
    .first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const now = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO worldline_entries
         (id, room_id, chapter_id, team_id, member_id, kind, content_json, frozen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'reflection', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, frozen_at = excluded.frozen_at, updated_at = excluded.updated_at`,
      )
      .bind(id, room.id, chapter.id, member.team_id, member.id, JSON.stringify({ answers, realityAction }), now, now, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "reflection.submit", "reflection", id, { realityAction }, now),
  ]);
}

async function submitDemoDay(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  campaign: ClassroomCampaign,
  title: string,
  segmentNotes: string[],
): Promise<void> {
  requireLearner(member);
  assertClassroom(chapter.order === campaign.chapters.length, "DEMO_DAY_NOT_UNLOCKED", "完成当前战役全部任务后才进入六分钟发布。", 409);
  assertClassroom(room.phase === "debrief", "PHASE_MISMATCH", "Demo Day作品应在最终复盘阶段提交。", 409);
  assertClassroom(member.team_id, "TEAM_REQUIRED", "你尚未加入团队。", 409);
  assertClassroom(
    segmentNotes.length === campaign.demoDay.segments.length,
    "INVALID_INPUT",
    `本课程的六分钟发布需要填写 ${campaign.demoDay.segments.length} 个段落。`,
    400,
  );
  const existing = await db
    .prepare(
      `SELECT id FROM worldline_entries
       WHERE room_id = ? AND chapter_id = ? AND team_id = ? AND kind = 'demo-day'`,
    )
    .bind(room.id, chapter.id, member.team_id)
    .first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const now = nowIso();
  const content = { title, segmentNotes, durationSeconds: campaign.demoDay.durationSeconds };
  await db.batch([
    db
      .prepare(
        `INSERT INTO worldline_entries
         (id, room_id, chapter_id, team_id, member_id, kind, content_json, frozen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'demo-day', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET member_id = excluded.member_id, content_json = excluded.content_json, frozen_at = excluded.frozen_at, updated_at = excluded.updated_at`,
      )
      .bind(id, room.id, chapter.id, member.team_id, member.id, JSON.stringify(content), now, now, now),
    bumpRoomStatement(db, room.id, now),
    auditStatement(db, room.id, member.profile_id, "demo-day.submit", "team", member.team_id, { title, durationSeconds: campaign.demoDay.durationSeconds }, now),
  ]);
}

async function nextChapter(
  db: ClassroomD1,
  member: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  campaign: ClassroomCampaign,
): Promise<void> {
  requireDm(member);
  assertClassroom(room.phase === "debrief" || room.phase === "completed", "PHASE_MISMATCH", "完成复盘后才能进入下一章。", 409);
  const learnerCount = await scalarNumber(
    db.prepare(`SELECT COUNT(*) AS value FROM memberships WHERE room_id = ? AND role = 'learner' AND status = 'active'`).bind(room.id),
  );
  const reflectionCount = await scalarNumber(
    db
      .prepare(
        `SELECT COUNT(DISTINCT member_id) AS value FROM worldline_entries
         WHERE room_id = ? AND chapter_id = ? AND kind = 'reflection'`,
      )
      .bind(room.id, chapter.id),
  );
  assertClassroom(reflectionCount === learnerCount, "REFLECTION_INCOMPLETE", "每名学员都必须完成六问复盘与现实行动。", 409);
  const teams = await allRows<{ id: string }>(db.prepare(`SELECT id FROM teams WHERE room_id = ?`).bind(room.id));
  for (const team of teams) await settleTeamMaintenance(db, member, room, chapter, campaign, team.id);
  const next = campaign.chapters.find((candidate) => candidate.order === chapter.order + 1);
  const now = nowIso();
  if (!next) {
    const teamCount = await scalarNumber(db.prepare(`SELECT COUNT(*) AS value FROM teams WHERE room_id = ?`).bind(room.id));
    const demoCount = await scalarNumber(
      db
        .prepare(
          `SELECT COUNT(DISTINCT team_id) AS value FROM worldline_entries
           WHERE room_id = ? AND chapter_id = ? AND kind = 'demo-day'`,
        )
        .bind(room.id, chapter.id),
    );
    assertClassroom(demoCount === teamCount, "DEMO_DAY_REQUIRED", "每个团队都必须提交七段式六分钟Demo Day作品后才能完成战役。", 409);
    await db.batch([
      db.prepare(`UPDATE rooms SET phase = 'completed', version = version + 1, updated_at = ? WHERE id = ?`).bind(now, room.id),
      auditStatement(db, room.id, member.profile_id, "campaign.complete", "room", room.id, { chapterId: chapter.id }, now),
    ]);
    return;
  }
  await db.batch([
    db
      .prepare(
        `UPDATE rooms SET chapter_id = ?, phase = 'lobby', paused = 0, paused_at = NULL, phase_deadline_at = NULL,
         player_timeline_frozen = 0, history_revealed = 0,
         version = version + 1, updated_at = ? WHERE id = ?`,
      )
      .bind(next.id, now, room.id),
    db.prepare(`UPDATE memberships SET case_identity_id = NULL, pdmo_role = NULL, support_commitment = NULL, updated_at = ? WHERE room_id = ? AND role = 'learner'`).bind(
      now,
      room.id,
    ),
    auditStatement(db, room.id, member.profile_id, "chapter.advance", "chapter", next.id, { from: chapter.id }, now),
  ]);
}

async function settleTeamMaintenance(
  db: ClassroomD1,
  dm: MembershipRow,
  room: RoomRow,
  chapter: ClassroomChapter,
  campaign: ClassroomCampaign,
  teamId: string,
): Promise<void> {
  const acquired = await allRows<{ row_id: string; asset_id: string }>(
    db
      .prepare(
        `SELECT id AS row_id, asset_id FROM team_assets
         WHERE team_id = ? AND active = 1 AND (last_maintained_chapter_id IS NULL OR last_maintained_chapter_id != ?)`,
      )
      .bind(teamId, chapter.id),
  );
  for (const row of acquired) {
    const asset = campaign.assets.find((candidate) => candidate.id === row.asset_id);
    if (!asset || asset.maintenanceTenths <= 0) {
      await db.prepare(`UPDATE team_assets SET last_maintained_chapter_id = ? WHERE id = ?`).bind(chapter.id, row.row_id).run();
      continue;
    }
    const idempotencyKey = `maintenance:${room.id}:${chapter.id}:${teamId}:${asset.id}`;
    if (await findTransactionByIdempotency(db, idempotencyKey)) continue;
    const now = nowIso();
    try {
      await db.batch([
        db.prepare(`UPDATE ledger_accounts SET balance_tenths = balance_tenths - ? WHERE id = ?`).bind(asset.maintenanceTenths, `treasury:${teamId}`),
        ledgerInsertStatement(db, {
          roomId: room.id,
          chapterId: chapter.id,
          fromAccountId: `treasury:${teamId}`,
          toAccountId: null,
          amountTenths: asset.maintenanceTenths,
          category: "maintenance",
          sourceObjectId: `${chapter.id}:${asset.id}:${teamId}`,
          createdByMemberId: dm.id,
          idempotencyKey,
          reason: `${asset.name}章节维护`,
          createdAt: now,
        }),
        db.prepare(`UPDATE team_assets SET last_maintained_chapter_id = ?, active = 1 WHERE id = ?`).bind(chapter.id, row.row_id),
      ]);
    } catch (error) {
      const mapped = mapLedgerError(error);
      if (mapped.code !== "INSUFFICIENT_FUNDS") throw mapped;
      await db.batch([
        db.prepare(`UPDATE team_assets SET active = 0, last_maintained_chapter_id = ? WHERE id = ?`).bind(chapter.id, row.row_id),
        auditStatement(db, room.id, dm.profile_id, "asset.deactivate", "asset", asset.id, { teamId, reason: "维护资金不足" }, now),
      ]);
    }
  }
}

async function archiveRoom(db: ClassroomD1, member: MembershipRow, room: RoomRow): Promise<void> {
  requireDm(member);
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE rooms SET status = 'archived', version = version + 1, updated_at = ? WHERE id = ?`).bind(now, room.id),
    auditStatement(db, room.id, member.profile_id, "room.archive", "room", room.id, {}, now),
  ]);
}

async function getChallengeDto(
  db: ClassroomD1,
  roomId: string,
  chapterId: string,
  teamId: string,
): Promise<ClassroomRoomDto["challenge"]> {
  const run = await db
    .prepare(
      `SELECT id, team_id, challenge_id, level, pressure_die, round, status, consequence, rubric_json, resolution_json
       FROM challenge_runs WHERE room_id = ? AND chapter_id = ? AND team_id = ?`,
    )
    .bind(roomId, chapterId, teamId)
    .first<{
      id: string;
      team_id: string;
      challenge_id: string;
      level: 1 | 2 | 3;
      pressure_die: number | null;
      round: number;
      status: string;
      consequence: string | null;
      rubric_json: string | null;
      resolution_json: string | null;
    }>();
  if (!run) return null;
  const actions = await allRows<Record<string, string | number>>(
    db.prepare(`SELECT round, member_id, goal, method, evidence, resource, success_signal, stop_condition FROM challenge_actions WHERE run_id = ? ORDER BY round, created_at`).bind(run.id),
  );
  return {
    id: run.id,
    teamId: run.team_id,
    challengeId: run.challenge_id,
    level: run.level,
    pressureDie: run.pressure_die,
    round: run.round,
    status: run.status,
    consequence: run.consequence,
    rubric: parseJson<ChallengeRubric | null>(run.rubric_json, null),
    resolution: parseJson<Record<string, unknown> | null>(run.resolution_json, null),
    actions,
  };
}

async function getPurchaseProposals(db: ClassroomD1, teamId: string): Promise<ClassroomRoomDto["economy"]["proposals"]> {
  const rows = await allRows<{
    id: string;
    asset_id: string;
    status: string;
    proposed_by_member_id: string;
    approvals: number;
    rejections: number;
  }>(
    db
      .prepare(
        `SELECT p.id, p.asset_id, p.status, p.proposed_by_member_id,
          COALESCE(SUM(CASE WHEN v.approve = 1 THEN 1 ELSE 0 END), 0) AS approvals,
          COALESCE(SUM(CASE WHEN v.approve = 0 THEN 1 ELSE 0 END), 0) AS rejections
         FROM purchase_proposals p LEFT JOIN purchase_votes v ON v.proposal_id = p.id
         WHERE p.team_id = ? GROUP BY p.id ORDER BY p.created_at DESC`,
      )
      .bind(teamId),
  );
  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    status: row.status,
    proposedByMemberId: row.proposed_by_member_id,
    approvals: Number(row.approvals),
    rejections: Number(row.rejections),
  }));
}

async function getChapterEconomics(
  db: ClassroomD1,
  roomId: string,
  chapterId: string,
  teamId: string,
): Promise<{ revenueTenths: number; costTenths: number; priorDistributionTenths: number; profitRemainingTenths: number }> {
  const accountId = `treasury:${teamId}`;
  const row = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN to_account_id = ? AND category IN ('mission-contract','user-validation','asset-revenue') THEN amount_tenths ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN from_account_id = ? AND category IN ('research','product','market','operations','maintenance') THEN amount_tenths ELSE 0 END), 0) AS costs,
        COALESCE(SUM(CASE WHEN from_account_id = ? AND category = 'distribution' THEN amount_tenths ELSE 0 END), 0) AS distributions
       FROM ledger_transactions t
       WHERE room_id = ? AND chapter_id = ? AND category != 'correction'
         AND NOT EXISTS (SELECT 1 FROM ledger_transactions reversal WHERE reversal.reversal_of = t.id)`,
    )
    .bind(accountId, accountId, accountId, roomId, chapterId)
    .first<{ revenue: number; costs: number; distributions: number }>();
  const revenueTenths = Number(row?.revenue ?? 0);
  const costTenths = Number(row?.costs ?? 0);
  const priorDistributionTenths = Number(row?.distributions ?? 0);
  return {
    revenueTenths,
    costTenths,
    priorDistributionTenths,
    profitRemainingTenths: Math.max(0, revenueTenths - costTenths - priorDistributionTenths),
  };
}

function ledgerInsertStatement(
  db: ClassroomD1,
  input: {
    roomId: string;
    chapterId: string;
    fromAccountId: string | null;
    toAccountId: string | null;
    amountTenths: number;
    category: LedgerCategory;
    sourceObjectId: string;
    createdByMemberId: string;
    idempotencyKey: string;
    reason: string;
    createdAt: string;
    reversalOf?: string | null;
  },
): D1PreparedStatement {
  assertClassroom(Number.isInteger(input.amountTenths) && input.amountTenths > 0, "INVALID_AMOUNT", "账本金额必须是正整数。", 400);
  assertClassroom(input.fromAccountId !== input.toAccountId, "INVALID_TRANSFER", "资金来源与去向不能相同。", 400);
  return db
    .prepare(
      `INSERT INTO ledger_transactions
       (id, room_id, chapter_id, from_account_id, to_account_id, amount_tenths, category, source_object_id,
        created_by_member_id, idempotency_key, reason, reversal_of, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.roomId,
      input.chapterId,
      input.fromAccountId,
      input.toAccountId,
      input.amountTenths,
      input.category,
      input.sourceObjectId,
      input.createdByMemberId,
      input.idempotencyKey,
      input.reason,
      input.reversalOf ?? null,
      input.createdAt,
    );
}

async function findTransactionByIdempotency(db: ClassroomD1, key: string): Promise<{ id: string } | null> {
  return db.prepare(`SELECT id FROM ledger_transactions WHERE idempotency_key = ?`).bind(key).first<{ id: string }>();
}

async function findTransactionBySource(
  db: ClassroomD1,
  roomId: string,
  category: LedgerCategory,
  sourceObjectId: string,
): Promise<{ id: string } | null> {
  return db
    .prepare(`SELECT id FROM ledger_transactions WHERE room_id = ? AND category = ? AND source_object_id = ?`)
    .bind(roomId, category, sourceObjectId)
    .first<{ id: string }>();
}

function bumpRoomStatement(db: ClassroomD1, roomId: string, now = nowIso()): D1PreparedStatement {
  return db.prepare(`UPDATE rooms SET version = version + 1, updated_at = ? WHERE id = ?`).bind(now, roomId);
}

function mapLedgerError(error: unknown): ClassroomError {
  const message = error instanceof Error ? error.message : String(error);
  if (/check constraint|non_negative|constraint failed/i.test(message)) {
    return new ClassroomError("INSUFFICIENT_FUNDS", "余额不足，交易没有发生。", 409);
  }
  if (/unique constraint|idempotency|source_category/i.test(message)) {
    return new ClassroomError("TRANSACTION_REPLAY", "这笔交易已经处理。", 409);
  }
  return error instanceof ClassroomError ? error : new ClassroomError("LEDGER_FAILED", "账本交易失败，所有变更已回滚。", 500);
}
