import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

/**
 * First-party accounts for the self-hosted Work deployment.  Classroom
 * profiles intentionally keep the same identifier as the auth user so the
 * existing classroom history survives the Basic-Auth → app-session migration.
 */
export const authUsers = sqliteTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("learner"),
    status: text("status").notNull().default("active"),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    passwordChangedAt: text("password_changed_at").notNull(),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_auth_users_username").on(table.username),
    index("idx_auth_users_status_role").on(table.status, table.role),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    remember: integer("remember", { mode: "boolean" }).notNull().default(false),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_auth_sessions_token_hash").on(table.tokenHash),
    index("idx_auth_sessions_user_active").on(table.userId, table.revokedAt, table.expiresAt),
  ],
);

/**
 * Short-lived password reset links issued by an administrator or by the DM of
 * a classroom that contains the learner. Only the SHA-256 digest is stored;
 * the clear token exists only in the one-time URL shown to the DM.
 */
export const authResetTokens = sqliteTable(
  "auth_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdByUserId: text("created_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_auth_reset_tokens_hash").on(table.tokenHash),
    index("idx_auth_reset_tokens_user_active").on(table.userId, table.consumedAt, table.expiresAt),
  ],
);

export const authCodes = sqliteTable(
  "auth_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attemptsRemaining: integer("attempts_remaining").notNull().default(5),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdByUserId: text("created_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_auth_codes_user_purpose").on(table.userId, table.purpose, table.createdAt)],
);

export const authInvitations = sqliteTable(
  "auth_invitations",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    label: text("label").notNull(),
    role: text("role").notNull().default("learner"),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    createdByUserId: text("created_by_user_id").notNull().references(() => authUsers.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_auth_invitations_code_hash").on(table.codeHash),
    index("idx_auth_invitations_creator").on(table.createdByUserId, table.createdAt),
  ],
);

export const authRecoveryCodes = sqliteTable(
  "auth_recovery_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_auth_recovery_codes_user_hash").on(table.userId, table.codeHash),
    index("idx_auth_recovery_codes_user_active").on(table.userId, table.consumedAt),
  ],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    scope: text("scope").notNull(),
    attempts: integer("attempts").notNull().default(0),
    windowStartedAt: text("window_started_at").notNull(),
    blockedUntil: text("blocked_until"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_auth_rate_limits_updated").on(table.updatedAt)],
);

export const authSecurityEvents = sqliteTable(
  "auth_security_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detailJson: text("detail_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_auth_security_events_user_time").on(table.userId, table.createdAt),
    index("idx_auth_security_events_action_time").on(table.action, table.createdAt),
  ],
);

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull(),
  ...timestamps,
});

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    campaignId: text("campaign_id").notNull(),
    chapterId: text("chapter_id").notNull(),
    phase: text("phase").notNull(),
    status: text("status").notNull(),
    dmProfileId: text("dm_profile_id").notNull().references(() => profiles.id),
    version: integer("version").notNull().default(1),
    paused: integer("paused", { mode: "boolean" }).notNull().default(false),
    pausedAt: text("paused_at"),
    phaseDeadlineAt: text("phase_deadline_at"),
    playerTimelineFrozen: integer("player_timeline_frozen", { mode: "boolean" }).notNull().default(false),
    historyRevealed: integer("history_revealed", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("uidx_rooms_code").on(table.code), index("idx_rooms_dm_status").on(table.dmProfileId, table.status)],
);

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    seatLimit: integer("seat_limit").notNull().default(4),
    ...timestamps,
  },
  (table) => [index("idx_teams_room").on(table.roomId)],
);

/** Public, non-secret identifier used to request access to one concrete team. */
export const teamAccessIds = sqliteTable(
  "team_access_ids",
  {
    teamId: text("team_id").primaryKey().references(() => teams.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("uidx_team_access_ids_public_id").on(table.publicId)],
);

/** A learner asks to join a team; a room DM must explicitly decide. */
export const teamJoinRequests = sqliteTable(
  "team_join_requests",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    decidedByProfileId: text("decided_by_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: text("decided_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_team_join_requests_team_profile").on(table.teamId, table.profileId),
    index("idx_team_join_requests_team_status").on(table.teamId, table.status, table.createdAt),
    index("idx_team_join_requests_profile_status").on(table.profileId, table.status, table.updatedAt),
  ],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    seat: integer("seat"),
    caseIdentityId: text("case_identity_id"),
    pdmoRole: text("pdmo_role"),
    supportCommitment: text("support_commitment"),
    status: text("status").notNull().default("active"),
    lastSeenAt: text("last_seen_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_memberships_room_profile").on(table.roomId, table.profileId),
    uniqueIndex("uidx_memberships_team_seat").on(table.teamId, table.seat),
    uniqueIndex("uidx_memberships_team_pdmo").on(table.teamId, table.pdmoRole),
    index("idx_memberships_room_team").on(table.roomId, table.teamId),
  ],
);

export const cardGrants = sqliteTable(
  "card_grants",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    memberId: text("member_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("unread"),
    grantedAt: text("granted_at").notNull(),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("uidx_card_grants_team_chapter_card").on(table.roomId, table.teamId, table.chapterId, table.cardId),
    index("idx_card_grants_member").on(table.memberId, table.chapterId),
  ],
);

export const intelligenceNodes = sqliteTable(
  "intelligence_nodes",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    sourceCardIdsJson: text("source_card_ids_json").notNull(),
    publishedByMemberId: text("published_by_member_id").notNull().references(() => memberships.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_intelligence_nodes_team_chapter").on(table.teamId, table.chapterId)],
);

export const intelligenceEdges = sqliteTable(
  "intelligence_edges",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    fromNodeId: text("from_node_id").notNull().references(() => intelligenceNodes.id, { onDelete: "cascade" }),
    toNodeId: text("to_node_id").notNull().references(() => intelligenceNodes.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    explanation: text("explanation").notNull(),
    createdByMemberId: text("created_by_member_id").notNull().references(() => memberships.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_intelligence_edges_team_chapter").on(table.teamId, table.chapterId)],
);

export const challengeRuns = sqliteTable(
  "challenge_runs",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id").notNull(),
    level: integer("level").notNull(),
    pressureDie: integer("pressure_die"),
    round: integer("round").notNull().default(1),
    status: text("status").notNull().default("active"),
    consequence: text("consequence"),
    rubricJson: text("rubric_json"),
    resolutionJson: text("resolution_json"),
    ...timestamps,
  },
  (table) => [uniqueIndex("uidx_challenge_runs_team_chapter").on(table.teamId, table.chapterId)],
);

export const challengeActions = sqliteTable(
  "challenge_actions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull().references(() => challengeRuns.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    memberId: text("member_id").notNull().references(() => memberships.id),
    pdmoRole: text("pdmo_role").notNull(),
    goal: text("goal").notNull(),
    method: text("method").notNull(),
    evidence: text("evidence").notNull(),
    resource: text("resource").notNull(),
    successSignal: text("success_signal").notNull(),
    stopCondition: text("stop_condition").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("uidx_challenge_actions_run_round_member").on(table.runId, table.round, table.memberId)],
);

export const reputationEntries = sqliteTable(
  "reputation_entries",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    dimension: text("dimension").notNull(),
    points: integer("points").notNull(),
    evidenceObjectId: text("evidence_object_id").notNull(),
    awardedByMemberId: text("awarded_by_member_id").notNull().references(() => memberships.id),
    reason: text("reason").notNull(),
    reversalOf: text("reversal_of"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_reputation_evidence_dimension").on(
      table.roomId,
      table.chapterId,
      table.profileId,
      table.dimension,
      table.evidenceObjectId,
    ),
    index("idx_reputation_profile").on(table.profileId),
    index("idx_reputation_room_chapter").on(table.roomId, table.chapterId),
  ],
);

export const ledgerAccounts = sqliteTable(
  "ledger_accounts",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    ownerProfileId: text("owner_profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    balanceTenths: integer("balance_tenths").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_ledger_accounts_team").on(table.kind, table.roomId, table.teamId),
    uniqueIndex("uidx_ledger_accounts_profile").on(table.kind, table.ownerProfileId),
    check("chk_ledger_accounts_non_negative", sql`${table.balanceTenths} >= 0`),
  ],
);

export const ledgerTransactions = sqliteTable(
  "ledger_transactions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    fromAccountId: text("from_account_id").references(() => ledgerAccounts.id),
    toAccountId: text("to_account_id").references(() => ledgerAccounts.id),
    amountTenths: integer("amount_tenths").notNull(),
    category: text("category").notNull(),
    sourceObjectId: text("source_object_id").notNull(),
    createdByMemberId: text("created_by_member_id").notNull().references(() => memberships.id),
    idempotencyKey: text("idempotency_key").notNull(),
    reason: text("reason").notNull(),
    reversalOf: text("reversal_of"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_ledger_transactions_idempotency").on(table.idempotencyKey),
    uniqueIndex("uidx_ledger_transactions_source_category").on(table.roomId, table.category, table.sourceObjectId),
    uniqueIndex("uidx_ledger_transactions_reversal").on(table.reversalOf),
    index("idx_ledger_transactions_room_time").on(table.roomId, table.createdAt),
  ],
);

export const teamAssets = sqliteTable(
  "team_assets",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    assetId: text("asset_id").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    acquiredPriceTenths: integer("acquired_price_tenths").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    lastMaintainedChapterId: text("last_maintained_chapter_id"),
  },
  (table) => [uniqueIndex("uidx_team_assets_team_asset").on(table.teamId, table.assetId)],
);

export const purchaseProposals = sqliteTable(
  "purchase_proposals",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    assetId: text("asset_id").notNull(),
    proposedByMemberId: text("proposed_by_member_id").notNull().references(() => memberships.id),
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("uidx_purchase_proposals_idempotency").on(table.idempotencyKey), index("idx_purchase_proposals_team").on(table.teamId, table.status)],
);

export const purchaseVotes = sqliteTable(
  "purchase_votes",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id").notNull().references(() => purchaseProposals.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    approve: integer("approve", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("uidx_purchase_votes_proposal_member").on(table.proposalId, table.memberId)],
);

export const gratitudeVotes = sqliteTable(
  "gratitude_votes",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    fromMemberId: text("from_member_id").notNull().references(() => memberships.id),
    toMemberId: text("to_member_id").notNull().references(() => memberships.id),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("uidx_gratitude_room_chapter_sender").on(table.roomId, table.chapterId, table.fromMemberId)],
);

export const worldlineEntries = sqliteTable(
  "worldline_entries",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => memberships.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    contentJson: text("content_json").notNull(),
    frozenAt: text("frozen_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_worldline_room_chapter").on(table.roomId, table.chapterId, table.kind)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    actorProfileId: text("actor_profile_id").notNull().references(() => profiles.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    detailJson: text("detail_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_audit_events_room_time").on(table.roomId, table.createdAt)],
);

export const courseCandidatePointers = sqliteTable("course_candidate_pointers", {
  courseId: text("course_id").primaryKey().notNull(),
  revision: integer("revision").notNull(),
  digest: text("digest").notNull(),
  stagedAt: text("staged_at").notNull(),
  stagedBy: text("staged_by").notNull(),
});

export const courseTestReceipts = sqliteTable(
  "course_test_receipts",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    revision: integer("revision").notNull(),
    digest: text("digest").notNull(),
    coursewareBundleDigest: text("courseware_bundle_digest").notNull(),
    status: text("status").notNull(),
    checksJson: text("checks_json").notNull(),
    acceptedAt: text("accepted_at"),
    acceptedByProfileId: text("accepted_by_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_course_test_receipts_exact").on(table.courseId, table.revision, table.digest, table.coursewareBundleDigest, table.roomId),
    index("idx_course_test_receipts_status_time").on(table.status, table.createdAt),
  ],
);

/**
 * Human approval of the side-effect-free 4 + N + 1 projection. Validity is
 * derived from the current exact Candidate/Released pointer plus the current
 * projector/build versions; immutable rows are never rewritten as "valid".
 */
export const courseViewAcceptanceReceipts = sqliteTable(
  "course_view_acceptance_receipts",
  {
    id: text("id").primaryKey(),
    receiptSchemaVersion: integer("receipt_schema_version").notNull(),
    courseId: text("course_id").notNull(),
    revision: integer("revision").notNull(),
    digest: text("digest").notNull(),
    status: text("status").notNull(),
    scenariosJson: text("scenarios_json").notNull(),
    checksJson: text("checks_json").notNull(),
    projectorVersion: text("projector_version").notNull(),
    appBuildId: text("app_build_id").notNull(),
    reviewerProfileId: text("reviewer_profile_id").notNull().references(() => profiles.id),
    acceptedAt: text("accepted_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_course_view_acceptance_exact").on(table.courseId, table.revision, table.digest, table.projectorVersion, table.appBuildId),
    index("idx_course_view_acceptance_status_time").on(table.status, table.createdAt),
  ],
);

/** Exact receipt from a completed real Test Classroom UI run. */
export const courseUiAcceptanceReceipts = sqliteTable(
  "course_ui_acceptance_receipts",
  {
    id: text("id").primaryKey(),
    receiptSchemaVersion: integer("receipt_schema_version").notNull(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    viewReceiptId: text("view_receipt_id").notNull().references(() => courseViewAcceptanceReceipts.id),
    courseId: text("course_id").notNull(),
    revision: integer("revision").notNull(),
    digest: text("digest").notNull(),
    learnerCount: integer("learner_count").notNull(),
    dealSeed: text("deal_seed").notNull(),
    resetGeneration: integer("reset_generation").notNull(),
    stateMachineVersion: integer("state_machine_version").notNull(),
    coursewareBundleDigest: text("courseware_bundle_digest").notNull(),
    coursewareRefsJson: text("courseware_refs_json").notNull(),
    mentorMembershipsJson: text("mentor_memberships_json").notNull(),
    learnerMembershipsJson: text("learner_memberships_json").notNull(),
    adminDmJson: text("admin_dm_json").notNull(),
    checksJson: text("checks_json").notNull(),
    clientMatrixJson: text("client_matrix_json").notNull(),
    appBuildId: text("app_build_id").notNull(),
    auditSummaryJson: text("audit_summary_json").notNull(),
    status: text("status").notNull(),
    acceptedAt: text("accepted_at").notNull(),
    acceptedByProfileId: text("accepted_by_profile_id").notNull().references(() => profiles.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_course_ui_acceptance_run").on(table.roomId, table.resetGeneration, table.courseId, table.revision, table.digest, table.coursewareBundleDigest, table.appBuildId),
    index("idx_course_ui_acceptance_exact").on(table.courseId, table.revision, table.digest, table.status, table.acceptedAt),
  ],
);

/** Binds every Test/Production instance to the receipts that admitted it. */
export const classroomAcceptanceBindings = sqliteTable(
  "classroom_acceptance_bindings",
  {
    roomId: text("room_id").primaryKey().references(() => rooms.id, { onDelete: "cascade" }),
    viewReceiptId: text("view_receipt_id").notNull().references(() => courseViewAcceptanceReceipts.id),
    uiReceiptId: text("ui_receipt_id").references(() => courseUiAcceptanceReceipts.id),
    boundAt: text("bound_at").notNull(),
    boundByProfileId: text("bound_by_profile_id").notNull().references(() => profiles.id),
  },
  (table) => [
    index("idx_classroom_acceptance_view").on(table.viewReceiptId),
    index("idx_classroom_acceptance_ui").on(table.uiReceiptId),
  ],
);

export const coursewarePackages = sqliteTable(
  "courseware_packages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    mentorRole: text("mentor_role").notNull(),
    ownerProfileId: text("owner_profile_id").notNull().references(() => profiles.id),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_courseware_packages_slug").on(table.slug),
    index("idx_courseware_packages_owner_role").on(table.ownerProfileId, table.mentorRole, table.status),
  ],
);

export const coursewareVersions = sqliteTable(
  "courseware_versions",
  {
    packageId: text("package_id").notNull().references(() => coursewarePackages.id),
    revision: integer("revision").notNull(),
    digest: text("digest").notNull(),
    contentKind: text("content_kind").notNull().default("inline-html"),
    htmlContent: text("html_content"),
    entryPath: text("entry_path"),
    byteLength: integer("byte_length").notNull(),
    createdAt: text("created_at").notNull(),
    createdByProfileId: text("created_by_profile_id").notNull().references(() => profiles.id),
  },
  (table) => [
    primaryKey({ columns: [table.packageId, table.revision] }),
    uniqueIndex("uidx_courseware_versions_digest").on(table.packageId, table.digest),
  ],
);

export const coursewareReleasePointers = sqliteTable("courseware_release_pointers", {
  packageId: text("package_id").primaryKey().references(() => coursewarePackages.id),
  revision: integer("revision").notNull(),
  digest: text("digest").notNull(),
  releasedAt: text("released_at").notNull(),
  releasedByProfileId: text("released_by_profile_id").notNull().references(() => profiles.id),
});

export const roomCoursewareBindings = sqliteTable(
  "room_courseware_bindings",
  {
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    mentorRole: text("mentor_role").notNull(),
    packageId: text("package_id").notNull().references(() => coursewarePackages.id),
    revision: integer("revision").notNull(),
    digest: text("digest").notNull(),
    boundAt: text("bound_at").notNull(),
    boundByProfileId: text("bound_by_profile_id").notNull().references(() => profiles.id),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.mentorRole] }),
    uniqueIndex("uidx_room_courseware_role").on(table.roomId, table.mentorRole),
    index("idx_room_courseware_exact").on(table.packageId, table.revision, table.digest),
  ],
);

export const classroomInstances = sqliteTable(
  "classroom_instances",
  {
    roomId: text("room_id").primaryKey().references(() => rooms.id, { onDelete: "cascade" }),
    environment: text("environment").notNull(),
    learnerCount: integer("learner_count").notNull(),
    lifecycle: text("lifecycle").notNull().default("ready"),
    stateMachineVersion: integer("state_machine_version").notNull(),
    courseId: text("course_id").notNull(),
    courseRevision: integer("course_revision").notNull(),
    courseDigest: text("course_digest").notNull(),
    factoryKey: text("factory_key").notNull(),
    resetGeneration: integer("reset_generation").notNull().default(0),
    lockedAt: text("locked_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_classroom_instances_factory_key").on(table.factoryKey),
    index("idx_classroom_instances_environment_lifecycle").on(table.environment, table.lifecycle, table.updatedAt),
  ],
);

export const classroomMentorSeats = sqliteTable(
  "classroom_mentor_seats",
  {
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    mentorRole: text("mentor_role").notNull(),
    profileId: text("profile_id").notNull().references(() => profiles.id),
    membershipId: text("membership_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.mentorRole] }),
    uniqueIndex("uidx_classroom_mentor_profile").on(table.roomId, table.profileId),
    uniqueIndex("uidx_classroom_mentor_membership").on(table.membershipId),
  ],
);

export const classroomPermissions = sqliteTable(
  "classroom_permissions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    grantedByProfileId: text("granted_by_profile_id").notNull().references(() => profiles.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_classroom_permissions_grant").on(table.roomId, table.profileId, table.permission),
    index("idx_classroom_permissions_profile").on(table.profileId, table.permission),
  ],
);

export const classroomControllerStates = sqliteTable(
  "classroom_controller_states",
  {
    roomId: text("room_id").primaryKey().references(() => rooms.id, { onDelete: "cascade" }),
    stateMachineVersion: integer("state_machine_version").notNull(),
    blockId: text("block_id").notNull(),
    blockIndex: integer("block_index").notNull(),
    state: text("state").notNull(),
    attempt: integer("attempt").notNull().default(1),
    errorMessage: text("error_message"),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [index("idx_classroom_controller_states_state").on(table.state, table.updatedAt)],
);

export const classroomFactoryEvents = sqliteTable(
  "classroom_factory_events",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorProfileId: text("actor_profile_id").notNull().references(() => profiles.id),
    detailJson: text("detail_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_classroom_factory_events_room_time").on(table.roomId, table.createdAt)],
);

export const classroomBlockSubmissions = sqliteTable(
  "classroom_block_submissions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    blockId: text("block_id").notNull(),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull().default("submitted"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uidx_classroom_block_submission_actor").on(table.roomId, table.blockId, table.profileId, table.kind),
    index("idx_classroom_block_submissions_room_block").on(table.roomId, table.blockId, table.status),
  ],
);

export const classroomWalletBalances = sqliteTable(
  "classroom_wallet_balances",
  {
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    balanceTenths: integer("balance_tenths").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.profileId] }),
    index("idx_classroom_wallet_profile").on(table.profileId, table.updatedAt),
  ],
);
