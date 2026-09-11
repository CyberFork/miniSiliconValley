import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import {
  CLASSROOM_MENTOR_ROLES,
  CLASSROOM_STATE_MACHINE_VERSION,
  LEGACY_CLASSROOM_STATE_MACHINE_VERSION,
  assertClassroomFactoryRequest,
  buildClassroomFactoryPlan,
  unlockNextScriptPage,
  type ClassroomEnvironment,
  type ClassroomFactoryRequest,
  type ClassroomMentorRole,
  type ClassroomScriptAction,
  type ClassroomScriptProgress,
  type ExactCoursewareRef,
} from "./classroom-factory";
import {
  assertCourseCanInstantiate,
  buildStudioProjection,
  declaredCoursewareBindingIssues,
  privateDeckForBlock,
  resolveLearnerPolicy,
} from "./course-platform";
import {
  loadExactCoursePackage,
  type StudioCourseVersion,
} from "./course-registry";
import {
  courseDataIdForRef,
  projectCoursePackageToCampaign,
  resolveCourseCompletionPolicy,
  type CoursePackageRef,
} from "./course-package";
import {
  loadCoursewareExact,
  isCoursewareLibraryVisible,
  type CoursewareContent,
} from "./courseware-store";
import {
  findSubmissionSchema,
  parseStoredSubmissionPayload,
  projectLearnerSubmissionSchema,
  projectMentorSubmissionSchema,
  submissionPlainText,
  submissionSchemaForBlock,
  validateStructuredSubmissionValues,
  type ClassroomSubmissionSchemaView,
  type StructuredSubmissionValues,
} from "./course-submission";
import {
  COURSE_ACCEPTANCE_APP_BUILD_ID,
  COURSE_ACCEPTANCE_SOURCE_COMMIT,
  COURSE_PROJECTOR_CONTRACT_VERSION,
  CLASSROOM_RUNTIME_CONTRACT_VERSION,
  recordUiAcceptanceReceipt,
  requireValidUiAcceptanceReceipt,
  requireValidViewAcceptanceReceipt,
  type UiAcceptanceClient,
} from "./course-acceptance";

const TEAM_PUBLIC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export type AdminDmDelegationMode = "primary" | "delegated";

export type ClassroomInstanceSummary = {
  id: string;
  title: string;
  environment: ClassroomEnvironment;
  lifecycle: string;
  learnerCount: number;
  courseRef: CoursePackageRef;
  script: ClassroomScriptProgress;
  mentorRole: ClassroomMentorRole | null;
  learnerSeat: number | null;
  isAdminDm: boolean;
  adminDmMode: AdminDmDelegationMode | null;
  canDelegateAdminDm: boolean;
  acceptance: { viewReceiptId: string | null; uiReceiptId: string | null };
  /** One-way retention marker. The last real lifecycle remains in `lifecycle`. */
  archive: {
    archivedAt: string;
    archivedByProfileId: string;
    previousLifecycle: string;
    reason: string;
  } | null;
  resetGeneration: number;
  updatedAt: string;
};

export type ClassroomInstanceDetail = ClassroomInstanceSummary & {
  viewer: {
    profileId: string;
    displayName: string;
    platformRole: string | null;
    actorProfileId: string;
    impersonationId: string | null;
    impersonationExpiresAt: string | null;
    /** Test-only selected role surface; equals profileId in Production. */
    viewProfileId: string;
    viewDisplayName: string;
    viewMentorRole: ClassroomMentorRole | null;
    viewLearnerSeat: number | null;
  };
  course: { id: string; title: string; period: string; stepNames: string[]; blockCount: number };
  page: {
    id: string;
    title: string;
    macroStepId: string;
    macroStepOrder: number;
    order: number;
    leadMentorId: string;
    studentPrompt: string;
    learnerLens: { world: string; say: string; ask: string; done: string };
    gameModes: string[];
  };
  scriptNavigation: {
    /** Complete immutable script index. Locked rows expose only their title, never private page content. */
    blocks: Array<{ id: string; title: string; index: number; macroStepOrder: number }>;
    unlockedBlocks: Array<{ id: string; title: string; index: number; macroStepOrder: number }>;
    viewedIndex: number;
    latestUnlocked: { id: string; title: string; index: number };
    nextLocked: { id: string; title: string; index: number } | null;
    canUnlockNext: boolean;
  };
  myView: ReturnType<typeof buildStudioProjection>["views"][number] | null;
  /** Admin-DM-only projection. Learner responses never receive scripts or gates. */
  controlView: ReturnType<typeof buildStudioProjection>["controllerView"] | null;
  team: { id: string; name: string; publicId: string; seatLimit: number };
  mentors: Array<{ mentorRole: ClassroomMentorRole; profileId: string; displayName: string; courseware: ExactCoursewareRef }>;
  learners: Array<{ profileId: string; displayName: string; seat: number }>;
  admins: Array<{ profileId: string; displayName: string; mode: AdminDmDelegationMode; canDelegate: boolean }>;
  courseware: ExactCoursewareRef[];
  activitySchema: ClassroomSubmissionSchemaView | null;
  submissions: ClassroomSubmissionDetail[];
  handoffs: ClassroomHandoffDetail[];
  economy: { personalRp: number; personalWalletTenths: number; teamTreasuryTenths: number };
  /** Test diagnostics for proving all runtime surfaces read one exact snapshot. */
  runtimeIdentity: {
    courseDataId: string;
    classroomId: string;
    runId: string;
    blockId: string;
    seatId: string;
    membershipId: string | null;
    dealSeed: string;
    deckId: string;
    deckRevision: number;
    stateMachineVersion: number;
    scriptStateVersion: number;
    controllerStateVersion: number;
    resetGeneration: number;
    cacheEpoch: string;
    /** Concrete deployed artifact; separate from compatibility contracts. */
    sourceCommit: string;
    appBuildId: string;
    projectorContractVersion: string;
    runtimeContractVersion: string;
    cardAssignments: Array<{ cardAssignmentId: string; cardId: string }>;
    candidateComparison: {
      exactMatch: boolean;
      currentCandidate: Pick<CoursePackageRef, "courseId" | "revision" | "digest"> | null;
    };
  };
};

export type ClassroomSubmissionDetail = {
  id: string;
  profileId: string;
  displayName: string;
  blockId: string;
  kind: string;
  text: string;
  schemaId: string | null;
  values: StructuredSubmissionValues | null;
  status: string;
  reviewFeedback: string | null;
  reviewedAt: string | null;
  /** Monotonic only inside resetGeneration. Used for submission/review CAS. */
  version: number;
  resetGeneration: number;
  updatedAt: string;
};

export type ClassroomRunExpectation = {
  expectedRunId: string;
  expectedResetGeneration: number;
};

export type ArchiveTestClassroomInput = ClassroomRunExpectation & {
  expectedScriptVersion: number;
  idempotencyKey: string;
  reason?: string;
};

export type ArchiveTestClassroomResult = {
  archived: true;
  archivedAt: string;
  classroomId: string;
  idempotent: boolean;
  restorePolicy: "create-new-test";
};

export type TestClassroomDeletionBlocker = {
  code: "UI_ACCEPTANCE_RECEIPT" | "LEGACY_TEST_RECEIPT" | "COURSE_RELEASE" | "PRODUCTION_CLASSROOM";
  label: string;
  detail: string;
  referenceIds: string[];
};

export type TestClassroomDeletionPreview = {
  classroom: {
    id: string;
    title: string;
    environment: "test";
    lifecycle: string;
    courseRef: CoursePackageRef;
    resetGeneration: number;
    scriptVersion: number;
    updatedAt: string;
    archivedAt: string | null;
  };
  impact: {
    memberships: number;
    submissions: number;
    privateCards: number;
    economyRecords: number;
    runAndAuditRecords: number;
  };
  /**
   * Non-content CAS witnesses. They let the DELETE transaction reject a
   * classroom that changed after the impact preview without serialising any
   * learner answer into the confirmation request or tombstone.
   */
  mutationGuard: {
    roomVersion: number;
    factoryEventCount: number;
    latestFactoryEventAt: string;
    submissionVersionSum: number;
    latestSubmissionMutationAt: string;
  };
  preserved: string[];
  blockers: TestClassroomDeletionBlocker[];
  canDelete: boolean;
  stateToken: string;
};

export type DeleteTestClassroomInput = ClassroomRunExpectation & {
  expectedScriptVersion: number;
  expectedStateToken: string;
  confirmClassroomId: string;
  idempotencyKey: string;
  reason?: string;
};

export type DeleteTestClassroomResult = {
  deleted: true;
  deletedAt: string;
  classroomId: string;
  idempotent: boolean;
  tombstoneDigest: string;
};

export type ClassroomHandoffDetail = {
  scriptPackageId: string;
  artifactName: string;
  fieldLabels: Record<string, string>;
  fromMentorRole: ClassroomMentorRole;
  toMentorRole: ClassroomMentorRole;
  fromBlockId: string;
  availableAtBlockId: string;
  summary: string;
  submission: ClassroomSubmissionDetail;
};

/**
 * Deliberately tiny projection for a shared classroom display.  The screen
 * endpoint must never serialize a viewer's private cards, mentor script,
 * submissions, account identifiers, wallets, or Admin-DM controls—even when
 * the person who opened the screen also owns one of those private views.
 */
export type ClassroomSharedScreenDetail = {
  id: string;
  title: string;
  environment: ClassroomEnvironment;
  lifecycle: string;
  learnerCount: number;
  course: { title: string; blockCount: number };
  page: {
    id: string;
    title: string;
    macroStepOrder: number;
    studentPrompt: string;
  };
  script: ClassroomScriptProgress;
  scriptNavigation: ClassroomInstanceDetail["scriptNavigation"];
};

export type ClassroomViewRequest = {
  blockId?: string;
  /** Test-only role projection. Production rejects this even for admins. */
  viewAsProfileId?: string;
  /** Test-only controller surface; separate from the actor's real seat. */
  surface?: "control";
};

type ResolvedCourseRef = CoursePackageRef & { status: "candidate" | "released" };

/**
 * One deterministic deal seed per explicit Classroom run. The immutable
 * CourseDefinition never contains hands; resetGeneration is the only switch
 * that intentionally produces a new deal while refresh/re-login remain
 * perfectly stable.
 */
export function classroomDealSeed(roomId: string, resetGeneration: number): string {
  if (!roomId.trim()) throw new Error("roomId 不能为空。");
  if (!Number.isInteger(resetGeneration) || resetGeneration < 0) throw new Error("resetGeneration 必须为非负整数。");
  return `classroom:${roomId}:run:${resetGeneration}`;
}

export function classroomRunId(roomId: string, resetGeneration: number): string {
  return `${roomId}:run:${resetGeneration}`;
}

export async function createClassroomInstance(
  db: ClassroomD1,
  actor: AuthenticatedClassroomUser,
  request: ClassroomFactoryRequest,
): Promise<{ classroomId: string; teamPublicId: string }> {
  requireFactoryCreator(actor);
  assertClassroomFactoryRequest(request);
  if (!request.adminDmProfileIds.includes(actor.userId) && actor.platformRole !== "admin") {
    throw new ClassroomError("ADMIN_DM_SELF_GRANT_REQUIRED", "创建课堂的导师必须同时列入本课堂 Admin DM。", 403);
  }
  const courseRef = await resolveTrustedCourseRef(db, request.courseRef);
  if (request.environment === "production" && courseRef.status !== "released") {
    throw new ClassroomError("PRODUCTION_RELEASE_REQUIRED", "正式课堂只能绑定 Released 课程版本。", 409);
  }
  const viewReceipt = await requireValidViewAcceptanceReceipt(
    db,
    courseRef,
    request.viewAcceptanceReceiptId,
  );
  const course = await loadExactCoursePackage(db, courseRef);
  assertCourseCanInstantiate(course, request.learnerCount);
  await validateAccountAssignments(db, request);
  const trustedCourseware: ExactCoursewareRef[] = [];
  for (const role of CLASSROOM_MENTOR_ROLES) {
    const requested = request.coursewareRefs.find((ref) => ref.mentorRole === role)!;
    const content = await loadCoursewareExact(db, requested.packageId, requested.revision, requested.digest);
    if (content.mentorRole !== role) throw new ClassroomError("COURSEWARE_ROLE_MISMATCH", `${role} 导师课件角色不匹配。`, 409);
    if (request.environment === "production" && !content.released) throw new ClassroomError("COURSEWARE_RELEASE_REQUIRED", `正式课堂的 ${role} 课件必须已发布。`, 409);
    if (request.environment === "production" && !isCoursewareLibraryVisible(content)) {
      throw new ClassroomError("COURSEWARE_PLACEHOLDER_FORBIDDEN", `正式课堂的 ${role} 导师仍是内部占位课件，请先上传、验收并发布真实课件。`, 409);
    }
    trustedCourseware.push(toExactCoursewareRef(content));
  }
  const declaredBindingIssues = declaredCoursewareBindingIssues(course, trustedCourseware);
  if (declaredBindingIssues.length) {
    throw new ClassroomError(
      "COURSE_CONTENT_COURSEWARE_MISMATCH",
      "课程声明的案例剧本与导师课件版本不一致，不能创建会悄悄错页的课堂。",
      409,
      declaredBindingIssues,
    );
  }
  const uiReceipt = request.environment === "production"
    ? await requireValidUiAcceptanceReceipt(
        db,
        courseRef,
        request.uiAcceptanceReceiptId ?? "",
        viewReceipt.receiptId,
        trustedCourseware,
      )
    : null;

  const factorySeed = crypto.randomUUID();
  const plan = buildClassroomFactoryPlan({ ...request, courseRef, coursewareRefs: trustedCourseware }, factorySeed);
  const roomId = crypto.randomUUID();
  const teamId = crypto.randomUUID();
  const teamPublicId = await uniqueTeamPublicId(db);
  const now = new Date().toISOString();
  const campaign = projectCoursePackageToCampaign(course, courseRef);
  const firstChapter = campaign.chapters[0];
  const mentorMemberships = plan.mentorSeats.map((seat) => ({ ...seat, id: crypto.randomUUID() }));
  const learnerMemberships = plan.learnerMemberships.map((seat) => ({ ...seat, id: crypto.randomUUID() }));
  const ledgerActorMembershipId = mentorMemberships.find((seat) => seat.mentorRole === "P")!.id;
  const script = { ...plan.initialScriptProgress, updatedAt: now };
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO rooms
       (id, code, title, campaign_id, chapter_id, phase, status, dm_profile_id, version, paused,
        player_timeline_frozen, history_revealed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'identity', 'active', ?, 1, 0, 0, 0, ?, ?)`,
    ).bind(roomId, `factory:${roomId}`, request.title.trim(), course.course.id, firstChapter.id, request.adminDmProfileIds[0], now, now),
    db.prepare(`INSERT INTO room_course_bindings (room_id, course_id, revision, digest, legacy_campaign_id, bound_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(roomId, courseRef.courseId, courseRef.revision, courseRef.digest, campaign.id, now),
    db.prepare(`INSERT INTO teams (id, room_id, name, seat_limit, created_at, updated_at) VALUES (?, ?, 'Young Builder Team', ?, ?, ?)`).bind(teamId, roomId, request.learnerCount, now, now),
    db.prepare(`INSERT INTO team_access_ids (team_id, public_id, created_at) VALUES (?, ?, ?)`).bind(teamId, teamPublicId, now),
    db.prepare(
      `INSERT INTO classroom_instances
       (room_id, environment, learner_count, lifecycle, state_machine_version, course_id, course_revision,
        course_digest, factory_key, reset_generation, locked_at, started_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'ready', ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?)`,
    ).bind(roomId, request.environment, request.learnerCount, CLASSROOM_STATE_MACHINE_VERSION, courseRef.courseId, courseRef.revision, courseRef.digest, plan.factoryKey, now, now),
    db.prepare(
      `INSERT INTO classroom_controller_states
       (room_id, state_machine_version, block_id, block_index, state, attempt, error_message, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
    // Compatibility mirror only. Runtime navigation reads
    // classroom_script_progress and never this retired workflow state.
    ).bind(roomId, CLASSROOM_STATE_MACHINE_VERSION, script.unlockedThroughBlockId, script.unlockedThroughIndex, "ready", 1, now, now),
    db.prepare(
      `INSERT INTO classroom_script_progress
       (room_id, state_machine_version, unlocked_through_block_id, unlocked_through_index,
        version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(roomId, script.stateMachineVersion, script.unlockedThroughBlockId, script.unlockedThroughIndex, script.version, now, now),
    db.prepare(
      `INSERT INTO classroom_acceptance_bindings
       (room_id, view_receipt_id, ui_receipt_id, bound_at, bound_by_profile_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(roomId, viewReceipt.receiptId, uiReceipt?.receiptId ?? null, now, actor.userId),
  ];
  for (const seat of mentorMemberships) {
    statements.push(
      db.prepare(
        `INSERT INTO memberships
         (id, room_id, profile_id, team_id, role, seat, case_identity_id, pdmo_role, support_commitment,
          status, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'dm', NULL, NULL, NULL, NULL, 'active', ?, ?, ?)`,
      ).bind(seat.id, roomId, seat.profileId, now, now, now),
      db.prepare(
        `INSERT INTO classroom_mentor_seats (room_id, mentor_role, profile_id, membership_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(roomId, seat.mentorRole, seat.profileId, seat.id, now, now),
    );
  }
  for (const learner of learnerMemberships) {
    const identityId = campaign.chapters[0].identities[learner.seat - 1]?.id ?? null;
    statements.push(
      db.prepare(
        `INSERT INTO memberships
         (id, room_id, profile_id, team_id, role, seat, case_identity_id, pdmo_role, support_commitment,
          status, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'learner', ?, ?, NULL, NULL, 'active', ?, ?, ?)`,
      ).bind(learner.id, roomId, learner.profileId, teamId, learner.seat, identityId, now, now, now),
    );
  }
  // Hands are instance data, not a preview illusion. Persist every step's
  // exact seeded deal at factory creation so refreshes and new devices see the
  // same private cards while another Classroom remains completely isolated.
  for (const [stepIndex, step] of course.macroSteps.entries()) {
    const projection = buildStudioProjection(course, {
      learnerCount: request.learnerCount,
      blockId: step.blocks[0],
      seed: classroomDealSeed(roomId, 0),
    });
    const chapterId = campaign.chapters[stepIndex].id;
    projection.learnerViews.forEach((view, learnerIndex) => {
      for (const card of view.privateCards) {
        statements.push(db.prepare(
          `INSERT INTO card_grants (id, room_id, chapter_id, team_id, card_id, member_id, state, granted_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, 'unread', ?, NULL)`,
        ).bind(crypto.randomUUID(), roomId, chapterId, teamId, card.id, learnerMemberships[learnerIndex].id, now));
      }
    });
  }
  const primaryAdminDmProfileId = request.adminDmProfileIds[0];
  for (const permission of plan.adminPermissions) {
    const grantId = crypto.randomUUID();
    const mode: AdminDmDelegationMode = permission.profileId === primaryAdminDmProfileId ? "primary" : "delegated";
    statements.push(
      db.prepare(
        `INSERT INTO classroom_permissions (id, room_id, profile_id, permission, granted_by_profile_id, created_at)
         VALUES (?, ?, ?, 'admin-dm', ?, ?)`,
      ).bind(grantId, roomId, permission.profileId, actor.userId, now),
      db.prepare(
        `INSERT INTO classroom_admin_dm_grants
         (id, room_id, profile_id, delegation_mode, can_delegate, granted_by_profile_id,
          granted_at, revoked_by_profile_id, revoked_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)`,
      ).bind(grantId, roomId, permission.profileId, mode, mode === "primary" ? 1 : 0, actor.userId, now),
    );
  }
  for (const ref of trustedCourseware) {
    statements.push(db.prepare(
      `INSERT INTO room_courseware_bindings
       (room_id, mentor_role, package_id, revision, digest, bound_at, bound_by_profile_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(roomId, ref.mentorRole, ref.packageId, ref.revision, ref.digest, now, actor.userId));
  }
  for (const profileId of new Set([
    ...plan.mentorSeats.map((seat) => seat.profileId),
    ...plan.learnerMemberships.map((member) => member.profileId),
    ...plan.adminPermissions.map((permission) => permission.profileId),
  ])) {
    statements.push(db.prepare(
      `INSERT INTO classroom_wallet_balances (room_id, profile_id, balance_tenths, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?)`,
    ).bind(roomId, profileId, now, now));
  }
  statements.push(
    db.prepare(
      `INSERT INTO ledger_accounts (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
       VALUES (?, 'team-treasury', ?, ?, NULL, 100, ?)`,
    ).bind(`treasury:${teamId}`, roomId, teamId, now),
    db.prepare(
      `INSERT INTO ledger_transactions
       (id, room_id, chapter_id, from_account_id, to_account_id, amount_tenths, category, source_object_id,
        created_by_member_id, idempotency_key, reason, reversal_of, created_at)
       VALUES (?, ?, ?, NULL, ?, 100, 'financing', ?, ?, ?, '课程工厂初始团队资金 10 C', NULL, ?)`,
    ).bind(crypto.randomUUID(), roomId, firstChapter.id, `treasury:${teamId}`, `factory-initial:${roomId}`, ledgerActorMembershipId, `factory-initial:${roomId}`, now),
    factoryEvent(db, roomId, auditActor(actor), "classroom.created", withIdentityAudit(actor, {
      environment: request.environment,
      learnerCount: request.learnerCount,
      courseRef,
      coursewareRefs: trustedCourseware,
      viewAcceptanceReceiptId: viewReceipt.receiptId,
      uiAcceptanceReceiptId: uiReceipt?.receiptId ?? null,
      adminDmProfileIds: request.adminDmProfileIds,
    }), now),
    factoryEvent(db, roomId, auditActor(actor), "script.page-unlocked", withIdentityAudit(actor, {
      blockId: script.unlockedThroughBlockId,
      blockIndex: script.unlockedThroughIndex,
      initial: true,
    }), now),
  );
  await db.batch(statements);
  return { classroomId: roomId, teamPublicId };
}

export async function listClassroomInstances(db: ClassroomD1, user: AuthenticatedClassroomUser): Promise<ClassroomInstanceSummary[]> {
  const result = await db.prepare(
    `SELECT r.id, r.title, ci.environment, ci.lifecycle, ci.learner_count, ci.course_id, ci.course_revision,
            ci.course_digest, ci.reset_generation, ci.updated_at, cv.schema_version,
            CASE WHEN rp.course_id IS NULL THEN 0 ELSE 1 END AS course_released,
            sp.state_machine_version, sp.unlocked_through_block_id, sp.unlocked_through_index,
            sp.version AS script_version, sp.updated_at AS script_updated_at,
            ms.mentor_role, lm.seat AS learner_seat,
            CASE WHEN g.id IS NULL THEN 0 ELSE 1 END AS is_admin_dm,
            g.delegation_mode AS admin_dm_mode, COALESCE(g.can_delegate, 0) AS can_delegate_admin_dm,
            ab.view_receipt_id, ab.ui_receipt_id,
            ca.archived_at, ca.archived_by_profile_id, ca.previous_lifecycle, ca.reason AS archive_reason
     FROM rooms r
     JOIN classroom_instances ci ON ci.room_id = r.id
     JOIN course_versions cv ON cv.course_id = ci.course_id AND cv.revision = ci.course_revision AND cv.digest = ci.course_digest
     LEFT JOIN course_release_pointers rp ON rp.course_id = ci.course_id AND rp.revision = ci.course_revision AND rp.digest = ci.course_digest
     JOIN classroom_script_progress sp ON sp.room_id = r.id
     LEFT JOIN classroom_acceptance_bindings ab ON ab.room_id = r.id
     LEFT JOIN classroom_mentor_seats ms ON ms.room_id = r.id AND ms.profile_id = ?
     LEFT JOIN memberships lm ON lm.room_id = r.id AND lm.profile_id = ? AND lm.role = 'learner' AND lm.status = 'active'
     LEFT JOIN classroom_admin_dm_grants g
       ON g.room_id = r.id AND g.profile_id = ? AND g.revoked_at IS NULL
     LEFT JOIN classroom_archives ca ON ca.room_id = r.id
     WHERE (ms.profile_id IS NOT NULL OR lm.profile_id IS NOT NULL OR g.id IS NOT NULL)
       AND (? IS NULL OR (r.id = ? AND ci.environment = 'test'))
     ORDER BY CASE WHEN ca.room_id IS NULL THEN 0 ELSE 1 END,
              CASE ci.lifecycle WHEN 'running' THEN 0 WHEN 'ready' THEN 1 ELSE 2 END,
              ci.updated_at DESC`,
  ).bind(
    user.userId,
    user.userId,
    user.userId,
    user.impersonationClassroomId ?? null,
    user.impersonationClassroomId ?? null,
  ).all<{
    id: string; title: string; environment: ClassroomEnvironment; lifecycle: string; learner_count: number;
    course_id: string; course_revision: number; course_digest: string; schema_version: number; updated_at: string;
    state_machine_version: typeof CLASSROOM_STATE_MACHINE_VERSION | typeof LEGACY_CLASSROOM_STATE_MACHINE_VERSION;
    unlocked_through_block_id: string; unlocked_through_index: number;
    script_version: number; script_updated_at: string; mentor_role: ClassroomMentorRole | null;
    learner_seat: number | null; is_admin_dm: number; admin_dm_mode: AdminDmDelegationMode | null;
    can_delegate_admin_dm: number; course_released: number;
    view_receipt_id: string | null; ui_receipt_id: string | null;
    reset_generation: number;
    archived_at: string | null; archived_by_profile_id: string | null;
    previous_lifecycle: string | null; archive_reason: string | null;
  }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    environment: row.environment,
    lifecycle: row.lifecycle,
    learnerCount: row.learner_count,
    courseRef: {
      courseId: row.course_id,
      schemaVersion: row.schema_version,
      revision: row.course_revision,
      digest: row.course_digest,
      status: row.course_released ? "released" : "candidate",
    },
    script: {
      stateMachineVersion: row.state_machine_version,
      unlockedThroughBlockId: row.unlocked_through_block_id,
      unlockedThroughIndex: row.unlocked_through_index,
      updatedAt: row.script_updated_at,
      version: row.script_version,
    },
    mentorRole: row.mentor_role,
    learnerSeat: row.learner_seat,
    isAdminDm: Boolean(row.is_admin_dm),
    adminDmMode: row.admin_dm_mode,
    canDelegateAdminDm: Boolean(row.can_delegate_admin_dm),
    acceptance: { viewReceiptId: row.view_receipt_id, uiReceiptId: row.ui_receipt_id },
    archive: row.archived_at && row.archived_by_profile_id && row.previous_lifecycle ? {
      archivedAt: row.archived_at,
      archivedByProfileId: row.archived_by_profile_id,
      previousLifecycle: row.previous_lifecycle,
      reason: row.archive_reason ?? "",
    } : null,
    resetGeneration: row.reset_generation,
    updatedAt: row.updated_at,
  }));
}

export async function getClassroomInstance(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  request: ClassroomViewRequest = {},
): Promise<ClassroomInstanceDetail> {
  const deleted = await db.prepare(
    `SELECT deleted_at FROM classroom_deletions WHERE room_id = ?`,
  ).bind(roomId).first<{ deleted_at: string }>();
  if (deleted) {
    throw new ClassroomError("CLASSROOM_DELETED", "这场 Test Classroom 已删除，旧链接不能继续运行。", 410, [
      `deletedAt ${deleted.deleted_at}`,
    ]);
  }
  const summaries = await listClassroomInstances(db, user);
  const summary = summaries.find((item) => item.id === roomId);
  if (!summary) throw new ClassroomError("CLASSROOM_ACCESS_FORBIDDEN", "你不是这个课堂的成员或 Admin DM。", 403);
  if (request.viewAsProfileId && summary.environment !== "test") {
    throw new ClassroomError("TEST_VIEW_PRODUCTION_FORBIDDEN", "角色视角切换只存在于 Test Classroom。", 403);
  }
  if (request.surface === "control" && summary.environment !== "test") {
    throw new ClassroomError("TEST_VIEW_PRODUCTION_FORBIDDEN", "中控视角模拟只存在于 Test Classroom。", 403);
  }
  if (request.surface === "control" && request.viewAsProfileId) {
    throw new ClassroomError("TEST_VIEW_INVALID", "中控视角与角色席位不能同时选择。", 400);
  }

  const course = await loadExactCoursePackage(db, summary.courseRef);
  const latestUnlocked = course.blocks[summary.script.unlockedThroughIndex];
  if (!latestUnlocked || latestUnlocked.id !== summary.script.unlockedThroughBlockId) {
    throw new ClassroomError("SCRIPT_PROGRESS_CORRUPT", "课堂剧本解锁边界与课程版本不一致。", 500);
  }
  const requestedBlockId = request.blockId?.trim() || latestUnlocked.id;
  const viewedIndex = course.blocks.findIndex((block) => block.id === requestedBlockId);
  if (viewedIndex < 0) throw new ClassroomError("SCRIPT_PAGE_NOT_FOUND", "课程中没有这一页剧本。", 404);
  if (viewedIndex > summary.script.unlockedThroughIndex) {
    throw new ClassroomError("SCRIPT_PAGE_LOCKED", "这一页尚未由导师解锁。", 409, [
      `当前已解锁至 ${summary.script.unlockedThroughBlockId}`,
    ]);
  }
  const runtimeRow = await db.prepare(
    `SELECT ci.reset_generation, ci.state_machine_version, cs.version AS controller_state_version,
            cp.revision AS candidate_revision, cp.digest AS candidate_digest
     FROM classroom_instances ci
     JOIN classroom_controller_states cs ON cs.room_id = ci.room_id
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = ci.course_id
     WHERE ci.room_id = ?`,
  ).bind(roomId).first<{
    reset_generation: number;
    state_machine_version: number;
    controller_state_version: number;
    candidate_revision: number | null;
    candidate_digest: string | null;
  }>();
  if (!runtimeRow) throw new ClassroomError("CLASSROOM_DIAGNOSTICS_MISSING", "课堂缺少一致性诊断状态。", 500);
  const page = course.blocks[viewedIndex];
  const dealSeed = classroomDealSeed(roomId, runtimeRow.reset_generation);
  const projection = buildStudioProjection(course, {
    learnerCount: summary.learnerCount,
    blockId: page.id,
    seed: dealSeed,
  });

  const team = await db.prepare(
    `SELECT t.id, t.name, t.seat_limit, a.public_id FROM teams t JOIN team_access_ids a ON a.team_id = t.id WHERE t.room_id = ? ORDER BY t.created_at LIMIT 1`,
  ).bind(roomId).first<{ id: string; name: string; seat_limit: number; public_id: string }>();
  if (!team) throw new ClassroomError("CLASSROOM_TEAM_MISSING", "课堂缺少团队。", 500);
  const mentorRows = await db.prepare(
    `SELECT s.mentor_role, s.profile_id, s.membership_id, p.nickname FROM classroom_mentor_seats s JOIN profiles p ON p.id = s.profile_id WHERE s.room_id = ? ORDER BY CASE s.mentor_role WHEN 'P' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END`,
  ).bind(roomId).all<{ mentor_role: ClassroomMentorRole; profile_id: string; membership_id: string; nickname: string }>();
  const learnerRows = await db.prepare(
    `SELECT m.id AS membership_id, m.profile_id, p.nickname, m.seat FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE m.room_id = ? AND m.role = 'learner' AND m.status = 'active' ORDER BY m.seat`,
  ).bind(roomId).all<{ membership_id: string; profile_id: string; nickname: string; seat: number }>();
  const coursewareRows = await db.prepare(
    `SELECT b.mentor_role, b.package_id, b.revision, b.digest, p.slug
     FROM room_courseware_bindings b JOIN courseware_packages p ON p.id = b.package_id
     WHERE b.room_id = ? ORDER BY CASE b.mentor_role WHEN 'P' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END`,
  ).bind(roomId).all<{ mentor_role: ClassroomMentorRole; package_id: string; revision: number; digest: string; slug: string }>();
  const courseware = (coursewareRows.results ?? []).map((row) => ({ mentorRole: row.mentor_role, packageId: row.package_id, revision: row.revision, digest: row.digest, slug: row.slug }));
  const adminRows = await db.prepare(
    `SELECT g.profile_id, p.nickname, g.delegation_mode, g.can_delegate
     FROM classroom_admin_dm_grants g JOIN profiles p ON p.id = g.profile_id
     WHERE g.room_id = ? AND g.revoked_at IS NULL
     ORDER BY CASE g.delegation_mode WHEN 'primary' THEN 0 ELSE 1 END, p.nickname`,
  ).bind(roomId).all<{
    profile_id: string;
    nickname: string;
    delegation_mode: AdminDmDelegationMode;
    can_delegate: number;
  }>();
  const mentors = mentorRows.results ?? [];
  const learners = learnerRows.results ?? [];
  const admins = adminRows.results ?? [];
  if (mentors.length !== 4 || courseware.length !== 4) {
    throw new ClassroomError("CLASSROOM_MENTOR_BINDING_CORRUPT", "课堂必须保持 P／D／M／O 四个导师席与四套 exact 课件绑定。", 500);
  }
  if (learners.length !== summary.learnerCount) {
    throw new ClassroomError("CLASSROOM_LEARNER_BINDING_CORRUPT", "课堂学员 Membership 与工厂锁定人数不一致。", 500);
  }
  if (!admins.length) {
    throw new ClassroomError("CLASSROOM_ADMIN_BINDING_CORRUPT", "课堂缺少 Admin DM 权限账号。", 500);
  }

  const viewAs = request.viewAsProfileId?.trim() || user.userId;
  const selectedMentor = mentors.find((row) => row.profile_id === viewAs) ?? null;
  const selectedLearner = learners.find((row) => row.profile_id === viewAs) ?? null;
  if (request.viewAsProfileId && !selectedMentor && !selectedLearner) {
    throw new ClassroomError("TEST_VIEW_MEMBERSHIP_REQUIRED", "测试视角必须是本课堂有效的导师席或学员席。", 403);
  }
  const viewProfileId = selectedMentor?.profile_id ?? selectedLearner?.profile_id ?? user.userId;
  const viewDisplayName = selectedMentor?.nickname ?? selectedLearner?.nickname ?? user.displayName;
  let myView: ClassroomInstanceDetail["myView"] = request.surface === "control"
    ? projection.controllerView
    : selectedMentor
      ? projection.mentorViews.find((view) => view.mentorRole === selectedMentor.mentor_role) ?? null
      : selectedLearner
        ? projection.learnerViews[selectedLearner.seat - 1] ?? null
        : projection.controllerView;
  let privateAssignments: Array<{ cardAssignmentId: string; cardId: string }> = [];
  if (selectedLearner && myView?.kind === "learner") {
    const privateDeck = privateDeckForBlock(course, page);
    const grants = await db.prepare(
      `SELECT id, card_id FROM card_grants WHERE room_id = ? AND chapter_id = ? AND member_id = ? ORDER BY granted_at, id`,
    ).bind(roomId, `${course.course.id}:${privateDeck.macroStepId}`, selectedLearner.membership_id).all<{ id: string; card_id: string }>();
    const grantQueues = new Map<string, Array<{ id: string; card_id: string }>>();
    for (const grant of grants.results ?? []) {
      const queue = grantQueues.get(grant.card_id) ?? [];
      queue.push(grant);
      grantQueues.set(grant.card_id, queue);
    }
    // D1 assignment IDs are deliberately random; card display order is the
    // deterministic projector order, never UUID lexical order. This makes the
    // Editor/Test/Seat comparison exact without storing a second card list.
    privateAssignments = myView.privateCards.map((card) => {
      const grant = grantQueues.get(card.id)?.shift();
      if (!grant) throw new ClassroomError("CLASSROOM_CARD_BINDING_CORRUPT", `学员席缺少 ${card.id} 的运行时发牌关系。`, 500);
      return { cardAssignmentId: grant.id, cardId: grant.card_id };
    });
    if ([...grantQueues.values()].some((queue) => queue.length > 0)) {
      throw new ClassroomError("CLASSROOM_CARD_BINDING_CORRUPT", "学员席存在不属于当前 exact 投影的发牌关系。", 500);
    }
    const cards = new Map(privateDeck.cards.map((card) => [card.id, card]));
    myView = {
      ...myView,
      privateCards: privateAssignments
        .map((assignment) => cards.get(assignment.cardId))
        .filter((card): card is NonNullable<typeof card> => Boolean(card))
        .map((card) => structuredClone(card)),
    };
  }

  const canSeeAllSubmissions = Boolean(selectedMentor) || !selectedLearner;
  const submissionResult = await db.prepare(
    `SELECT s.id, s.block_id, s.profile_id, p.nickname, s.kind, s.payload_json, s.status, s.updated_at,
            sr.version AS submission_version, sr.reset_generation AS submission_reset_generation
     FROM classroom_block_submissions s
     JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
     JOIN profiles p ON p.id = s.profile_id
     WHERE s.room_id = ? AND s.block_id = ? AND (? = 1 OR s.profile_id = ?)
     ORDER BY s.updated_at`,
  ).bind(roomId, page.id, canSeeAllSubmissions ? 1 : 0, viewProfileId).all<{
    id: string; block_id: string; profile_id: string; nickname: string; kind: string; payload_json: string; status: string; updated_at: string;
    submission_version: number; submission_reset_generation: number;
  }>();
  const currentSchema = submissionSchemaForBlock(course, page.id);
  const activitySchema = !currentSchema
    ? null
    : selectedLearner
      ? projectLearnerSubmissionSchema(currentSchema)
      : selectedMentor?.mentor_role === currentSchema.ownerMentorRole
        ? projectMentorSubmissionSchema(currentSchema)
        : null;
  const submissions = (submissionResult.results ?? []).flatMap((row): ClassroomSubmissionDetail[] => {
    const payload = parseStoredSubmissionPayload(row.payload_json);
    const schema = payload.schemaId ? findSubmissionSchema(course, payload.schemaId) : null;
    // A structured artifact stays private to its author, its owning mentor and
    // the Admin-DM control surface. A downstream mentor receives only the
    // accepted hand-off on its declared later page.
    if (payload.schemaId && !schema && selectedMentor) return [];
    if (schema && selectedMentor && selectedMentor.mentor_role !== schema.ownerMentorRole) return [];
    return [{
      id: row.id,
      profileId: row.profile_id,
      displayName: row.nickname,
      blockId: row.block_id,
      kind: row.kind,
      text: submissionPlainText(payload, schema),
      schemaId: payload.schemaId ?? null,
      values: payload.values ?? null,
      status: row.status,
      reviewFeedback: payload.review?.feedback ?? null,
      reviewedAt: payload.review?.reviewedAt ?? null,
      version: row.submission_version,
      resetGeneration: row.submission_reset_generation,
      updatedAt: row.updated_at,
    }];
  });
  const handoffs: ClassroomHandoffDetail[] = [];
  if (selectedMentor) {
    for (const scriptPackage of course.contentPackages?.scriptPackages ?? []) {
      const handoff = scriptPackage.handoff;
      if (!handoff || handoff.toMentorRole !== selectedMentor.mentor_role) continue;
      const availableIndex = course.blocks.findIndex((item) => item.id === handoff.availableAtBlockId);
      if (availableIndex < 0 || viewedIndex < availableIndex) continue;
      const schema = findSubmissionSchema(course, handoff.submissionSchemaId);
      if (!schema) continue;
      const rows = await db.prepare(
        `SELECT s.id, s.block_id, s.profile_id, p.nickname, s.kind, s.payload_json, s.status, s.updated_at,
                sr.version AS submission_version, sr.reset_generation AS submission_reset_generation
         FROM classroom_block_submissions s
         JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
         JOIN profiles p ON p.id = s.profile_id
         WHERE s.room_id = ? AND s.block_id = ? AND s.kind = ? AND s.status = 'accepted'
         ORDER BY s.updated_at DESC, s.id DESC`,
      ).bind(roomId, handoff.fromBlockId, schema.kind).all<{
        id: string; block_id: string; profile_id: string; nickname: string; kind: string; payload_json: string; status: string; updated_at: string;
        submission_version: number; submission_reset_generation: number;
      }>();
      const row = (rows.results ?? []).find((item) => parseStoredSubmissionPayload(item.payload_json).schemaId === schema.id);
      if (!row) continue;
      const payload = parseStoredSubmissionPayload(row.payload_json);
      handoffs.push({
        scriptPackageId: scriptPackage.id,
        artifactName: schema.name,
        fieldLabels: Object.fromEntries(schema.fields.map((field) => [field.id, field.label])),
        fromMentorRole: scriptPackage.ownerMentorRole,
        toMentorRole: handoff.toMentorRole,
        fromBlockId: handoff.fromBlockId,
        availableAtBlockId: handoff.availableAtBlockId,
        summary: handoff.summary,
        submission: {
          id: row.id,
          profileId: row.profile_id,
          displayName: row.nickname,
          blockId: row.block_id,
          kind: row.kind,
          text: submissionPlainText(payload, schema),
          schemaId: payload.schemaId ?? null,
          values: payload.values ?? null,
          status: row.status,
          reviewFeedback: payload.review?.feedback ?? null,
          reviewedAt: payload.review?.reviewedAt ?? null,
          version: row.submission_version,
          resetGeneration: row.submission_reset_generation,
          updatedAt: row.updated_at,
        },
      });
    }
  }
  const balances = await db.prepare(
    `SELECT
       COALESCE((SELECT SUM(points) FROM reputation_entries WHERE profile_id = ? AND room_id = ?), 0) AS rp,
       COALESCE((SELECT balance_tenths FROM classroom_wallet_balances WHERE room_id = ? AND profile_id = ?), 0) AS wallet,
       COALESCE((SELECT balance_tenths FROM ledger_accounts WHERE kind = 'team-treasury' AND room_id = ? LIMIT 1), 0) AS treasury`,
  ).bind(viewProfileId, roomId, roomId, viewProfileId, roomId).first<{ rp: number; wallet: number; treasury: number }>();

  const canUnlockNext = !summary.archive && summary.script.unlockedThroughIndex < course.blocks.length - 1
    && (summary.environment === "test" || summary.isAdminDm || Boolean(summary.mentorRole));
  const nextBlock = course.blocks[summary.script.unlockedThroughIndex + 1] ?? null;
  return {
    ...summary,
    viewer: {
      profileId: user.userId,
      displayName: user.displayName,
      platformRole: user.platformRole ?? null,
      actorProfileId: user.actorProfileId ?? user.userId,
      impersonationId: user.impersonationId ?? null,
      impersonationExpiresAt: user.impersonationExpiresAt ?? null,
      viewProfileId,
      viewDisplayName,
      viewMentorRole: selectedMentor?.mentor_role ?? null,
      viewLearnerSeat: selectedLearner?.seat ?? null,
    },
    course: {
      id: course.course.id,
      title: course.course.name,
      period: course.course.period,
      stepNames: course.macroSteps.map((step) => step.name),
      blockCount: course.blocks.length,
    },
    page: {
      id: page.id,
      title: page.title,
      macroStepId: page.macroStepId,
      macroStepOrder: page.macroStepOrder,
      order: page.order,
      leadMentorId: page.leadMentorId,
      studentPrompt: page.studentPrompt,
      learnerLens: structuredClone(page.learnerLens),
      gameModes: [...page.gameModes],
    },
    scriptNavigation: {
      blocks: course.blocks.map((block, index) => ({
        id: block.id,
        title: block.title,
        index,
        macroStepOrder: block.macroStepOrder,
      })),
      unlockedBlocks: course.blocks.slice(0, summary.script.unlockedThroughIndex + 1).map((block, index) => ({
        id: block.id,
        title: block.title,
        index,
        macroStepOrder: block.macroStepOrder,
      })),
      viewedIndex,
      latestUnlocked: { id: latestUnlocked.id, title: latestUnlocked.title, index: summary.script.unlockedThroughIndex },
      nextLocked: canUnlockNext && nextBlock ? { id: nextBlock.id, title: nextBlock.title, index: summary.script.unlockedThroughIndex + 1 } : null,
      canUnlockNext,
    },
    myView,
    controlView: summary.environment === "test" || summary.isAdminDm || Boolean(summary.mentorRole) ? projection.controllerView : null,
    team: { id: team.id, name: team.name, publicId: team.public_id, seatLimit: team.seat_limit },
    mentors: mentors.map((row) => ({
      mentorRole: row.mentor_role,
      profileId: row.profile_id,
      displayName: row.nickname,
      courseware: courseware.find((ref) => ref.mentorRole === row.mentor_role)!,
    })),
    learners: learners.map((row) => ({ profileId: row.profile_id, displayName: row.nickname, seat: row.seat })),
    admins: admins.map((row) => ({
      profileId: row.profile_id,
      displayName: row.nickname,
      mode: row.delegation_mode,
      canDelegate: Boolean(row.can_delegate),
    })),
    courseware,
    activitySchema,
    submissions,
    handoffs,
    economy: {
      personalRp: Number(balances?.rp ?? 0),
      personalWalletTenths: Number(balances?.wallet ?? 0),
      teamTreasuryTenths: Number(balances?.treasury ?? 0),
    },
    runtimeIdentity: {
      courseDataId: courseDataIdForRef(summary.courseRef),
      classroomId: roomId,
      runId: classroomRunId(roomId, runtimeRow.reset_generation),
      blockId: page.id,
      seatId: request.surface === "control"
        ? "controller"
        : selectedMentor
        ? `mentor${String(CLASSROOM_MENTOR_ROLES.indexOf(selectedMentor.mentor_role) + 1).padStart(2, "0")}`
        : selectedLearner
          ? `learner${String(selectedLearner.seat).padStart(2, "0")}`
          : "controller",
      membershipId: request.surface === "control" ? null : selectedMentor?.membership_id ?? selectedLearner?.membership_id ?? null,
      dealSeed,
      deckId: privateDeckForBlock(course, page).id,
      deckRevision: summary.courseRef.revision,
      stateMachineVersion: runtimeRow.state_machine_version,
      scriptStateVersion: summary.script.version,
      controllerStateVersion: runtimeRow.controller_state_version,
      resetGeneration: runtimeRow.reset_generation,
      cacheEpoch: `reset-${runtimeRow.reset_generation}:script-${summary.script.version}:controller-${runtimeRow.controller_state_version}`,
      sourceCommit: COURSE_ACCEPTANCE_SOURCE_COMMIT,
      appBuildId: COURSE_ACCEPTANCE_APP_BUILD_ID,
      projectorContractVersion: COURSE_PROJECTOR_CONTRACT_VERSION,
      runtimeContractVersion: CLASSROOM_RUNTIME_CONTRACT_VERSION,
      cardAssignments: privateAssignments,
      candidateComparison: {
        exactMatch: runtimeRow.candidate_revision === summary.courseRef.revision && runtimeRow.candidate_digest === summary.courseRef.digest,
        currentCandidate: runtimeRow.candidate_revision === null || runtimeRow.candidate_digest === null ? null : {
          courseId: summary.courseRef.courseId,
          revision: runtimeRow.candidate_revision,
          digest: runtimeRow.candidate_digest,
        },
      },
    },
  };
}

export async function getClassroomSharedScreen(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  request: Pick<ClassroomViewRequest, "blockId"> = {},
): Promise<ClassroomSharedScreenDetail> {
  // Reuse the exact same membership and unlocked-page guards as the seat UI,
  // then construct an explicit allow-list response. Never return the private
  // detail object and ask the browser to hide fields.
  const detail = await getClassroomInstance(db, user, roomId, request);
  return {
    id: detail.id,
    title: detail.title,
    environment: detail.environment,
    lifecycle: detail.lifecycle,
    learnerCount: detail.learnerCount,
    course: { title: detail.course.title, blockCount: detail.course.blockCount },
    page: {
      id: detail.page.id,
      title: detail.page.title,
      macroStepOrder: detail.page.macroStepOrder,
      studentPrompt: detail.page.studentPrompt,
    },
    script: detail.script,
    scriptNavigation: { ...detail.scriptNavigation, nextLocked: null, canUnlockNext: false },
  };
}

/**
 * Reject every new write after a Test Classroom has entered retained history.
 * Reads intentionally remain available so the exact script, submissions and
 * audit evidence can still be inspected.
 */
export async function requireWritableClassroom(db: ClassroomD1, roomId: string): Promise<void> {
  const row = await db.prepare(
    `SELECT ci.room_id, ca.archived_at
     FROM classroom_instances ci
     LEFT JOIN classroom_archives ca ON ca.room_id = ci.room_id
     WHERE ci.room_id = ?`,
  ).bind(roomId).first<{ room_id: string; archived_at: string | null }>();
  if (!row) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (row.archived_at) {
    throw new ClassroomError(
      "CLASSROOM_ARCHIVED",
      "这场 Test Classroom 已归档并永久只读；如需继续测试，请从同一 exact 版本新建课堂。",
      409,
      [`archivedAt ${row.archived_at}`],
    );
  }
}

export type SubmissionMutationResult = {
  submissionId: string;
  version: number;
  resetGeneration: number;
  idempotent: boolean;
};

export async function submitClassroomBlockWork(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: ClassroomRunExpectation & {
    blockId: string;
    expectedVersion: number;
    idempotencyKey: string;
    kind?: string;
    text?: string;
    schemaId?: string;
    values?: unknown;
    viewAsProfileId?: string;
  },
): Promise<SubmissionMutationResult> {
  const detail = await getClassroomInstance(db, user, roomId, {
    blockId: input.blockId,
    ...(input.viewAsProfileId ? { viewAsProfileId: input.viewAsProfileId } : {}),
  });
  await requireWritableClassroom(db, roomId);
  assertRunExpectation(roomId, detail.runtimeIdentity.resetGeneration, input);
  assertMutationInput(input.expectedVersion, input.idempotencyKey);
  const course = await loadExactCoursePackage(db, detail.courseRef);
  const declaredSchema = submissionSchemaForBlock(course, detail.page.id);
  let kind: string;
  let payload: Record<string, unknown>;
  if (input.schemaId) {
    const schema = findSubmissionSchema(course, input.schemaId);
    if (!schema) throw new ClassroomError("SUBMISSION_SCHEMA_NOT_FOUND", "这个课程版本没有声明该作品结构。", 404);
    if (schema.submitAtBlockId !== detail.page.id) throw new ClassroomError("SUBMISSION_SCHEMA_BLOCK_MISMATCH", `${schema.name} 只能在 ${schema.submitAtBlockId} 提交。`, 409);
    if (detail.myView?.kind !== "learner") throw new ClassroomError("SUBMISSION_LEARNER_REQUIRED", "结构化团队作品必须从学员席提交。", 403);
    let values: StructuredSubmissionValues;
    try { values = validateStructuredSubmissionValues(schema, input.values); }
    catch (error) { throw new ClassroomError("SUBMISSION_VALUES_INVALID", error instanceof Error ? error.message : "作品字段无效。", 400); }
    kind = schema.kind;
    payload = { schemaId: schema.id, values };
  } else {
    kind = input.kind?.trim() ?? "";
    const text = input.text?.trim() ?? "";
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(kind)) throw new ClassroomError("SUBMISSION_KIND_INVALID", "作品类型无效。", 400);
    if (declaredSchema?.kind === kind) {
      throw new ClassroomError("SUBMISSION_SCHEMA_REQUIRED", `${declaredSchema.name} 必须按课程声明的结构化字段提交。`, 409);
    }
    if (text.length < 2 || text.length > 4_000) throw new ClassroomError("SUBMISSION_TEXT_INVALID", "作品内容需为 2—4000 个字符。", 400);
    payload = { text };
  }
  const profileId = detail.viewer.viewProfileId;
  const payloadJson = JSON.stringify(payload);
  const payloadDigest = await mutationDigest({ operation: "submit", roomId, profileId, blockId: detail.page.id, kind, payload });
  const replay = await submissionMutationReplay(db, roomId, profileId, input.idempotencyKey, {
    operation: "submit",
    submissionId: null,
    resetGeneration: input.expectedResetGeneration,
    expectedVersion: input.expectedVersion,
    payloadDigest,
    blockId: detail.page.id,
    kind,
  });
  if (replay) return replay;

  const existing = await db.prepare(
    `SELECT s.id, sr.version, sr.reset_generation
     FROM classroom_block_submissions s
     JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
     WHERE s.room_id = ? AND s.block_id = ? AND s.profile_id = ? AND s.kind = ?`,
  ).bind(roomId, detail.page.id, profileId, kind).first<{ id: string; version: number; reset_generation: number }>();
  if (!existing && input.expectedVersion !== 0) {
    throw new ClassroomError("SUBMISSION_VERSION_CONFLICT", "这份作品已变化或已被重置，请同步后再提交。", 409);
  }
  if (existing && (existing.version !== input.expectedVersion || existing.reset_generation !== input.expectedResetGeneration)) {
    throw new ClassroomError("SUBMISSION_VERSION_CONFLICT", "这份作品刚被其他设备更新，请先同步再决定是否覆盖。", 409);
  }

  const now = new Date().toISOString();
  const mutationId = crypto.randomUUID();
  const submissionId = existing?.id ?? crypto.randomUUID();
  const nextVersion = input.expectedVersion + 1;
  const auditDetail = withIdentityAudit(user, {
    blockId: detail.page.id,
    kind,
    schemaId: input.schemaId ?? null,
    projectedProfileId: profileId,
    testView: detail.environment === "test" && profileId !== user.userId,
    runId: input.expectedRunId,
    resetGeneration: input.expectedResetGeneration,
    expectedVersion: input.expectedVersion,
    resultingVersion: nextVersion,
    mutationId,
  });
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO classroom_submission_mutations
         (id, room_id, idempotency_key, submission_id, profile_id, block_id, kind,
          reset_generation, operation, expected_version, resulting_version, payload_digest, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'submit', ?, ?, ?, ?
         FROM classroom_instances ci
         WHERE ci.room_id = ? AND ci.reset_generation = ?
           AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)
           AND ((? = 0 AND NOT EXISTS (
                  SELECT 1 FROM classroom_block_submissions s
                  WHERE s.room_id = ? AND s.block_id = ? AND s.profile_id = ? AND s.kind = ?
                ))
                OR (? > 0 AND EXISTS (
                  SELECT 1 FROM classroom_block_submissions s
                  JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
                  WHERE s.room_id = ? AND s.block_id = ? AND s.profile_id = ? AND s.kind = ?
                    AND sr.reset_generation = ? AND sr.version = ?
                )))`,
      ).bind(
        mutationId, roomId, input.idempotencyKey, submissionId, profileId, detail.page.id, kind,
        input.expectedResetGeneration, input.expectedVersion, nextVersion, payloadDigest, now,
        roomId, input.expectedResetGeneration,
        input.expectedVersion, roomId, detail.page.id, profileId, kind,
        input.expectedVersion, roomId, detail.page.id, profileId, kind, input.expectedResetGeneration, input.expectedVersion,
      ),
      mutationAssertion(db, "classroom_submission_mutations", mutationId, now),
      db.prepare(
        `INSERT INTO classroom_block_submissions
         (id, room_id, block_id, profile_id, kind, payload_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
         ON CONFLICT(room_id, block_id, profile_id, kind) DO UPDATE SET
           payload_json = excluded.payload_json, status = 'submitted', updated_at = excluded.updated_at
         WHERE classroom_block_submissions.id = excluded.id`,
      ).bind(submissionId, roomId, detail.page.id, profileId, kind, payloadJson, now, now),
      db.prepare(
        `INSERT INTO classroom_submission_revisions
         (submission_id, room_id, reset_generation, version, last_mutation_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(submission_id) DO UPDATE SET
           reset_generation = excluded.reset_generation, version = excluded.version,
           last_mutation_id = excluded.last_mutation_id, updated_at = excluded.updated_at
         WHERE classroom_submission_revisions.reset_generation = ?
           AND classroom_submission_revisions.version = ?`,
      ).bind(submissionId, roomId, input.expectedResetGeneration, nextVersion, mutationId, now, input.expectedResetGeneration, input.expectedVersion),
      factoryEvent(db, roomId, auditActor(user), "block.submitted", auditDetail, now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1) throw mutationConflict("SUBMISSION_VERSION_CONFLICT", "这份作品刚被其他设备更新，请同步后重试。");
  } catch (error) {
    const won = await submissionMutationReplay(db, roomId, profileId, input.idempotencyKey, {
      operation: "submit",
      submissionId,
      resetGeneration: input.expectedResetGeneration,
      expectedVersion: input.expectedVersion,
      payloadDigest,
      blockId: detail.page.id,
      kind,
    });
    if (won) return won;
    if (isAtomicAssertionError(error)) throw mutationConflict("SUBMISSION_VERSION_CONFLICT", "课堂已重置或这份作品已更新，请同步后重试。");
    throw error;
  }
  return { submissionId, version: nextVersion, resetGeneration: input.expectedResetGeneration, idempotent: false };
}

export async function reviewClassroomSubmission(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  submissionId: string,
  input: ClassroomRunExpectation & {
    status: "accepted" | "rejected";
    feedback: string;
    expectedVersion: number;
    idempotencyKey: string;
    viewAsProfileId?: string;
  },
): Promise<SubmissionMutationResult> {
  const currentDetail = await getClassroomInstance(db, user, roomId);
  await requireWritableClassroom(db, roomId);
  assertRunExpectation(roomId, currentDetail.runtimeIdentity.resetGeneration, input);
  assertMutationInput(input.expectedVersion, input.idempotencyKey);
  const row = await db.prepare(
    `SELECT s.id, s.block_id, s.profile_id, s.kind, s.payload_json, s.status, s.updated_at,
            sr.version, sr.reset_generation
     FROM classroom_block_submissions s
     JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
     WHERE s.id = ? AND s.room_id = ?`,
  ).bind(submissionId, roomId).first<{
    id: string; block_id: string; profile_id: string; kind: string; payload_json: string; status: string; updated_at: string;
    version: number; reset_generation: number;
  }>();
  if (!row) throw new ClassroomError("SUBMISSION_NOT_FOUND", "找不到这份课堂作品。", 404);
  assertRunExpectation(roomId, row.reset_generation, input);
  const detail = await getClassroomInstance(db, user, roomId, {
    blockId: row.block_id,
    ...(input.viewAsProfileId ? { viewAsProfileId: input.viewAsProfileId } : {}),
  });
  assertRunExpectation(roomId, detail.runtimeIdentity.resetGeneration, input);
  const course = await loadExactCoursePackage(db, detail.courseRef);
  const payload = parseStoredSubmissionPayload(row.payload_json);
  const schema = payload.schemaId ? findSubmissionSchema(course, payload.schemaId) : null;
  if (!schema || schema.kind !== row.kind || !payload.values) {
    throw new ClassroomError("SUBMISSION_REVIEW_UNSUPPORTED", "这不是由课程声明的结构化作品，不能使用导师验收。", 409);
  }
  if (detail.myView?.kind !== "mentor" || detail.myView.mentorRole !== schema.ownerMentorRole) {
    throw new ClassroomError("SUBMISSION_REVIEW_OWNER_REQUIRED", `只有 ${schema.ownerMentorRole} 导师席可以验收 ${schema.name}。`, 403);
  }
  try { validateStructuredSubmissionValues(schema, payload.values); }
  catch { throw new ClassroomError("SUBMISSION_PAYLOAD_CORRUPT", "作品字段与当前锁定课程版本不一致，不能验收。", 409); }
  const feedback = input.feedback.trim();
  if (input.status === "rejected" && (feedback.length < 2 || feedback.length > 1_000)) {
    throw new ClassroomError("SUBMISSION_FEEDBACK_REQUIRED", "退回时请写 2—1000 字的具体修改建议。", 400);
  }
  if (input.status === "accepted" && feedback.length > 1_000) {
    throw new ClassroomError("SUBMISSION_FEEDBACK_INVALID", "导师反馈不能超过 1000 字。", 400);
  }
  const actorProfileId = auditActor(user);
  const payloadDigest = await mutationDigest({ operation: "review", roomId, submissionId, status: input.status, feedback });
  const replay = await submissionMutationReplay(db, roomId, actorProfileId, input.idempotencyKey, {
    operation: "review",
    submissionId,
    resetGeneration: input.expectedResetGeneration,
    expectedVersion: input.expectedVersion,
    payloadDigest,
    blockId: row.block_id,
    kind: row.kind,
  });
  if (replay) return replay;
  if (row.version !== input.expectedVersion) {
    throw new ClassroomError("SUBMISSION_VERSION_CONFLICT", "这份作品刚被重新提交或审核，请同步后再操作。", 409);
  }
  const now = new Date().toISOString();
  const nextPayload = { ...payload, review: { feedback, reviewedAt: now } };
  const mutationId = crypto.randomUUID();
  const nextVersion = input.expectedVersion + 1;
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO classroom_submission_mutations
         (id, room_id, idempotency_key, submission_id, profile_id, block_id, kind,
          reset_generation, operation, expected_version, resulting_version, payload_digest, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?, ?, ?, ?
         FROM classroom_instances ci
         JOIN classroom_submission_revisions sr ON sr.room_id = ci.room_id
         WHERE ci.room_id = ? AND ci.reset_generation = ?
           AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)
           AND sr.submission_id = ? AND sr.reset_generation = ? AND sr.version = ?`,
      ).bind(
        mutationId, roomId, input.idempotencyKey, submissionId, actorProfileId, row.block_id, row.kind,
        input.expectedResetGeneration, input.expectedVersion, nextVersion, payloadDigest, now,
        roomId, input.expectedResetGeneration, submissionId, input.expectedResetGeneration, input.expectedVersion,
      ),
      mutationAssertion(db, "classroom_submission_mutations", mutationId, now),
      db.prepare(
        `UPDATE classroom_block_submissions SET payload_json = ?, status = ?, updated_at = ?
         WHERE id = ? AND room_id = ?`,
      ).bind(JSON.stringify(nextPayload), input.status, now, submissionId, roomId),
      db.prepare(
        `UPDATE classroom_submission_revisions
         SET version = version + 1, last_mutation_id = ?, updated_at = ?
         WHERE submission_id = ? AND room_id = ? AND reset_generation = ? AND version = ?`,
      ).bind(mutationId, now, submissionId, roomId, input.expectedResetGeneration, input.expectedVersion),
      factoryEvent(db, roomId, actorProfileId, "submission.reviewed", withIdentityAudit(user, {
        submissionId,
        blockId: row.block_id,
        schemaId: schema.id,
        status: input.status,
        projectedProfileId: detail.viewer.viewProfileId,
        testView: detail.environment === "test" && detail.viewer.viewProfileId !== user.userId,
        runId: input.expectedRunId,
        resetGeneration: input.expectedResetGeneration,
        expectedVersion: input.expectedVersion,
        resultingVersion: nextVersion,
        mutationId,
      }), now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1) throw mutationConflict("SUBMISSION_VERSION_CONFLICT", "这份作品刚被重新提交或审核，请同步后再操作。");
  } catch (error) {
    const won = await submissionMutationReplay(db, roomId, actorProfileId, input.idempotencyKey, {
      operation: "review",
      submissionId,
      resetGeneration: input.expectedResetGeneration,
      expectedVersion: input.expectedVersion,
      payloadDigest,
      blockId: row.block_id,
      kind: row.kind,
    });
    if (won) return won;
    if (isAtomicAssertionError(error)) throw mutationConflict("SUBMISSION_VERSION_CONFLICT", "课堂已重置或这份作品已更新，请同步后重试。");
    throw error;
  }
  return { submissionId, version: nextVersion, resetGeneration: input.expectedResetGeneration, idempotent: false };
}

export async function applyScriptAction(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: ClassroomRunExpectation & {
    expectedVersion: number;
    action: ClassroomScriptAction;
    viewAsProfileId?: string;
  },
): Promise<ClassroomScriptProgress> {
  const summary = (await listClassroomInstances(db, user)).find((item) => item.id === roomId);
  if (!summary) throw new ClassroomError("CLASSROOM_ACCESS_FORBIDDEN", "你不是这个课堂的成员或 Admin DM。", 403);
  if (summary.archive) throw new ClassroomError("CLASSROOM_ARCHIVED", "这场 Test Classroom 已归档并永久只读；请从同一 exact 版本新建课堂继续测试。", 409);
  if (input.viewAsProfileId) {
    if (summary.environment !== "test") throw new ClassroomError("TEST_VIEW_PRODUCTION_FORBIDDEN", "角色视角切换不能用于 Production Classroom。", 403);
    await requireTestViewTarget(db, roomId, input.viewAsProfileId);
  }
  if (summary.environment !== "test" && !summary.isAdminDm && !summary.mentorRole) {
    throw new ClassroomError("SCRIPT_UNLOCK_MENTOR_REQUIRED", "只有本课堂导师或 Admin DM 可以解锁下一页。", 403);
  }
  const row = await db.prepare(
    `SELECT sp.*, ci.environment, ci.lifecycle, ci.course_id, ci.course_revision, ci.course_digest,
            ci.reset_generation
     FROM classroom_script_progress sp
     JOIN classroom_instances ci ON ci.room_id = sp.room_id WHERE sp.room_id = ?`,
  ).bind(roomId).first<{
    state_machine_version: typeof CLASSROOM_STATE_MACHINE_VERSION | typeof LEGACY_CLASSROOM_STATE_MACHINE_VERSION;
    unlocked_through_block_id: string; unlocked_through_index: number;
    version: number; created_at: string; updated_at: string; environment: ClassroomEnvironment; lifecycle: string;
    course_id: string; course_revision: number; course_digest: string; reset_generation: number;
  }>();
  if (!row) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (row.state_machine_version !== CLASSROOM_STATE_MACHINE_VERSION
    && row.state_machine_version !== LEGACY_CLASSROOM_STATE_MACHINE_VERSION) {
    throw new ClassroomError("CLASSROOM_STATE_MACHINE_UNSUPPORTED", "课堂状态机版本无法由当前应用安全推进。", 409, [
      `actual ${row.state_machine_version}`,
      `supported ${LEGACY_CLASSROOM_STATE_MACHINE_VERSION}, ${CLASSROOM_STATE_MACHINE_VERSION}`,
    ]);
  }
  assertRunExpectation(roomId, row.reset_generation, input);
  if (row.version !== input.expectedVersion) throw new ClassroomError("SCRIPT_VERSION_CONFLICT", "另一位导师刚刚解锁了页面，请同步后再操作。", 409);
  const now = new Date().toISOString();
  const current: ClassroomScriptProgress = {
    stateMachineVersion: row.state_machine_version,
    unlockedThroughBlockId: row.unlocked_through_block_id,
    unlockedThroughIndex: row.unlocked_through_index,
    version: row.version,
    updatedAt: row.updated_at,
  };
  const course = await loadExactCoursePackage(db, { courseId: row.course_id, revision: row.course_revision, digest: row.course_digest });
  let next: ClassroomScriptProgress;
  try { next = unlockNextScriptPage(current, input.action, course.blocks.map((block) => block.id), now); }
  catch (error) { throw new ClassroomError("SCRIPT_UNLOCK_INVALID", error instanceof Error ? error.message : "不能解锁这一页。", 409); }
  // v3 separates the script frontier from classroom completion. Existing v2
  // Production runs retain their original auto-complete behavior so a deploy
  // never rewrites the meaning of an already-started immutable classroom.
  const lifecycle = row.state_machine_version === LEGACY_CLASSROOM_STATE_MACHINE_VERSION
    && next.unlockedThroughIndex === course.blocks.length - 1
    ? "completed"
    : "running";
  const mutationId = crypto.randomUUID();
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO classroom_script_mutations
         (id, room_id, reset_generation, expected_version, resulting_version,
          from_block_id, to_block_id, actor_profile_id, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM classroom_script_progress sp
         JOIN classroom_instances ci ON ci.room_id = sp.room_id
         WHERE sp.room_id = ? AND sp.version = ? AND sp.unlocked_through_index = ?
           AND ci.reset_generation = ?
           AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)`,
      ).bind(
        mutationId, roomId, input.expectedResetGeneration, input.expectedVersion, next.version,
        current.unlockedThroughBlockId, next.unlockedThroughBlockId, auditActor(user), now,
        roomId, input.expectedVersion, current.unlockedThroughIndex, input.expectedResetGeneration,
      ),
      mutationAssertion(db, "classroom_script_mutations", mutationId, now),
      db.prepare(
        `UPDATE classroom_script_progress
         SET unlocked_through_block_id = ?, unlocked_through_index = ?, state_machine_version = ?,
             version = version + 1, updated_at = ?
         WHERE room_id = ? AND version = ? AND unlocked_through_index = ?`,
      ).bind(next.unlockedThroughBlockId, next.unlockedThroughIndex, next.stateMachineVersion, now, roomId, input.expectedVersion, current.unlockedThroughIndex),
      db.prepare(
        `UPDATE classroom_instances SET lifecycle = ?,
         locked_at = CASE WHEN locked_at IS NULL AND ? = 'running' THEN ? ELSE locked_at END,
         started_at = CASE WHEN started_at IS NULL AND ? IN ('running','completed') THEN ? ELSE started_at END,
         completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
         updated_at = ?
         WHERE room_id = ? AND reset_generation = ?`,
      ).bind(lifecycle, lifecycle, now, lifecycle, now, lifecycle, now, now, roomId, input.expectedResetGeneration),
      factoryEvent(db, roomId, auditActor(user), "script.page-unlocked", withIdentityAudit(user, {
        from: current,
        to: next,
        projectedProfileId: input.viewAsProfileId ?? user.userId,
        testView: Boolean(input.viewAsProfileId),
        runId: input.expectedRunId,
        resetGeneration: input.expectedResetGeneration,
        stateMachineVersion: row.state_machine_version,
        classroomLifecycle: lifecycle,
        mutationId,
      }), now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1) throw mutationConflict("SCRIPT_VERSION_CONFLICT", "课堂已重置或另一位导师刚刚解锁了页面，请同步后再操作。");
  } catch (error) {
    if (isAtomicAssertionError(error)) throw mutationConflict("SCRIPT_VERSION_CONFLICT", "课堂已重置或另一位导师刚刚解锁了页面，请同步后再操作。");
    throw error;
  }
  return next;
}

export type FinishClassroomRunInput = ClassroomRunExpectation & {
  expectedScriptVersion: number;
  idempotencyKey: string;
  viewAsProfileId?: string;
};

export type FinishClassroomRunResult = {
  completed: true;
  completedAt: string;
  runId: string;
  resetGeneration: number;
  idempotent: boolean;
};

/**
 * Move one exact Test Classroom into immutable, read-only history.  Archival
 * never deletes users, memberships, course versions, receipts or another
 * Classroom, and it never rewrites the run's final lifecycle.
 */
export async function archiveTestClassroom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: ArchiveTestClassroomInput,
): Promise<ArchiveTestClassroomResult> {
  if (user.impersonationId) {
    throw new ClassroomError("IMPERSONATION_ARCHIVE_FORBIDDEN", "测试身份不能归档课堂；请先返回真实账号。", 403);
  }
  await requireAdminDm(db, user, roomId);
  assertArchiveMutationInput(input);
  const actorProfileId = auditActor(user);
  const replay = await archiveMutationReplay(db, roomId, actorProfileId, input);
  if (replay) return replay;

  const row = await db.prepare(
    `SELECT ci.environment, ci.lifecycle, ci.reset_generation,
            sp.version AS script_version, ab.ui_receipt_id
     FROM classroom_instances ci
     JOIN classroom_script_progress sp ON sp.room_id = ci.room_id
     LEFT JOIN classroom_acceptance_bindings ab ON ab.room_id = ci.room_id
     WHERE ci.room_id = ?`,
  ).bind(roomId).first<{
    environment: ClassroomEnvironment;
    lifecycle: string;
    reset_generation: number;
    script_version: number;
    ui_receipt_id: string | null;
  }>();
  if (!row) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (row.environment !== "test") {
    throw new ClassroomError("PRODUCTION_ARCHIVE_FORBIDDEN", "正式课堂不能通过测试课堂归档入口处理。", 403);
  }
  assertRunExpectation(roomId, row.reset_generation, input);
  if (row.script_version !== input.expectedScriptVersion) {
    throw mutationConflict("SCRIPT_VERSION_CONFLICT", "课堂剧本边界刚刚变化，请同步后再决定是否归档。");
  }

  const reason = input.reason?.trim() ?? "";
  const now = new Date().toISOString();
  const mutationId = crypto.randomUUID();
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO classroom_archives
         (id, room_id, previous_lifecycle, reset_generation, script_version,
          archived_by_profile_id, idempotency_key, reason, archived_at)
         SELECT ?, ci.room_id, ci.lifecycle, ci.reset_generation, sp.version, ?, ?, ?, ?
         FROM classroom_instances ci
         JOIN classroom_script_progress sp ON sp.room_id = ci.room_id
         WHERE ci.room_id = ? AND ci.environment = 'test'
           AND ci.reset_generation = ? AND sp.version = ?
           AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)`,
      ).bind(
        mutationId,
        actorProfileId,
        input.idempotencyKey,
        reason,
        now,
        roomId,
        input.expectedResetGeneration,
        input.expectedScriptVersion,
      ),
      mutationAssertion(db, "classroom_archives", mutationId, now),
      db.prepare(
        `UPDATE rooms SET status = 'archived', version = version + 1, updated_at = ?
         WHERE id = ? AND EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = rooms.id)`,
      ).bind(now, roomId),
      db.prepare(
        `UPDATE classroom_instances SET updated_at = ?
         WHERE room_id = ? AND reset_generation = ?
           AND EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = classroom_instances.room_id)`,
      ).bind(now, roomId, input.expectedResetGeneration),
      factoryEvent(db, roomId, actorProfileId, "classroom.test-archived", withIdentityAudit(user, {
        mutationId,
        runId: input.expectedRunId,
        resetGeneration: input.expectedResetGeneration,
        scriptVersion: input.expectedScriptVersion,
        previousLifecycle: row.lifecycle,
        reason,
        uiAcceptanceReceiptId: row.ui_receipt_id,
        receiptPolicy: "historical-only-after-archive",
        restorePolicy: "create-new-test",
        hardDeletePolicy: "dependency-gated",
      }), now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1
      || Number(result[2]?.meta?.changes ?? 0) !== 1
      || Number(result[3]?.meta?.changes ?? 0) !== 1) {
      throw mutationConflict("CLASSROOM_ARCHIVE_CONFLICT", "课堂状态刚刚变化或已被归档，请同步后重试。");
    }
  } catch (error) {
    const won = await archiveMutationReplay(db, roomId, actorProfileId, input);
    if (won) return won;
    if (isAtomicAssertionError(error)) {
      throw mutationConflict("CLASSROOM_ARCHIVE_CONFLICT", "课堂状态刚刚变化或已被另一位 Admin DM 归档，请同步后重试。");
    }
    throw error;
  }
  return {
    archived: true,
    archivedAt: now,
    classroomId: roomId,
    idempotent: false,
    restorePolicy: "create-new-test",
  };
}

/**
 * Read-only impact and dependency check for one exact Test Classroom. This is
 * the sole source for the destructive confirmation UI and is repeated by the
 * DELETE path immediately before its atomic mutation.
 */
export async function previewTestClassroomDeletion(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<TestClassroomDeletionPreview> {
  if (user.impersonationId) {
    throw new ClassroomError("IMPERSONATION_DELETE_FORBIDDEN", "测试身份不能删除课堂；请先返回真实账号。", 403);
  }
  await requireAdminDm(db, user, roomId);
  const row = await db.prepare(
    `SELECT r.id, r.title, r.version AS room_version,
            ci.environment, ci.lifecycle, ci.course_id, ci.course_revision,
            ci.course_digest, ci.reset_generation, ci.updated_at, cv.schema_version,
            CASE WHEN rp.course_id IS NULL THEN 0 ELSE 1 END AS course_released,
            sp.version AS script_version, ca.archived_at
     FROM rooms r
     JOIN classroom_instances ci ON ci.room_id = r.id
     JOIN classroom_script_progress sp ON sp.room_id = r.id
     JOIN course_versions cv
       ON cv.course_id = ci.course_id AND cv.revision = ci.course_revision AND cv.digest = ci.course_digest
     LEFT JOIN course_release_pointers rp
       ON rp.course_id = ci.course_id AND rp.revision = ci.course_revision AND rp.digest = ci.course_digest
     LEFT JOIN classroom_archives ca ON ca.room_id = r.id
     WHERE r.id = ?`,
  ).bind(roomId).first<{
    id: string;
    title: string;
    room_version: number;
    environment: ClassroomEnvironment;
    lifecycle: string;
    course_id: string;
    course_revision: number;
    course_digest: string;
    reset_generation: number;
    updated_at: string;
    schema_version: number;
    course_released: number;
    script_version: number;
    archived_at: string | null;
  }>();
  if (!row) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (row.environment !== "test") {
    throw new ClassroomError("PRODUCTION_DELETE_FORBIDDEN", "正式课堂不能删除；该入口只处理隔离的 TEST 实例。", 403);
  }

  const [uiReceipts, legacyReceipts, releases, productionRooms, impactRow, mutationRow] = await Promise.all([
    db.prepare(
      `SELECT id, status, accepted_at FROM course_ui_acceptance_receipts WHERE room_id = ? ORDER BY accepted_at, id`,
    ).bind(roomId).all<{ id: string; status: string; accepted_at: string }>(),
    db.prepare(
      `SELECT id, status, COALESCE(accepted_at, created_at) AS evidence_at
       FROM course_test_receipts WHERE room_id = ? ORDER BY evidence_at, id`,
    ).bind(roomId).all<{ id: string; status: string; evidence_at: string }>(),
    db.prepare(
      `SELECT course_id, revision, digest
       FROM course_release_pointers
       WHERE json_extract(approval_json, '$.runId') = ?
          OR json_extract(approval_json, '$.uiReceiptId') IN (
            SELECT id FROM course_ui_acceptance_receipts WHERE room_id = ?
          )
       ORDER BY course_id`,
    ).bind(roomId, roomId).all<{ course_id: string; revision: number; digest: string }>(),
    db.prepare(
      `SELECT pci.room_id, pci.course_id, pci.course_revision
       FROM classroom_instances pci
       JOIN classroom_acceptance_bindings pab ON pab.room_id = pci.room_id
       JOIN course_ui_acceptance_receipts receipt ON receipt.id = pab.ui_receipt_id
       WHERE pci.environment = 'production' AND receipt.room_id = ?
       ORDER BY pci.created_at, pci.room_id`,
    ).bind(roomId).all<{ room_id: string; course_id: string; course_revision: number }>(),
    db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM memberships WHERE room_id = ?) AS memberships,
         (SELECT COUNT(*) FROM classroom_block_submissions WHERE room_id = ?) AS submissions,
         (SELECT COUNT(*) FROM card_grants WHERE room_id = ?) AS private_cards,
         ((SELECT COUNT(*) FROM reputation_entries WHERE room_id = ?)
           + (SELECT COUNT(*) FROM ledger_transactions WHERE room_id = ?)
           + (SELECT COUNT(*) FROM ledger_accounts WHERE room_id = ?)
           + (SELECT COUNT(*) FROM classroom_wallet_balances WHERE room_id = ?)
           + (SELECT COUNT(*) FROM team_assets WHERE room_id = ?)
           + (SELECT COUNT(*) FROM purchase_proposals WHERE room_id = ?)
           + (SELECT COUNT(*) FROM gratitude_votes WHERE room_id = ?)) AS economy_records,
         ((SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ?)
           + (SELECT COUNT(*) FROM audit_events WHERE room_id = ?)
           + (SELECT COUNT(*) FROM classroom_submission_mutations WHERE room_id = ?)
           + (SELECT COUNT(*) FROM classroom_script_mutations WHERE room_id = ?)
           + (SELECT COUNT(*) FROM classroom_reset_mutations WHERE room_id = ?)
           + (SELECT COUNT(*) FROM classroom_finish_mutations WHERE room_id = ?)) AS run_audit_records`,
    ).bind(roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId, roomId).first<{
      memberships: number;
      submissions: number;
      private_cards: number;
      economy_records: number;
      run_audit_records: number;
    }>(),
    db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = ?) AS factory_event_count,
         COALESCE((SELECT MAX(created_at) FROM classroom_factory_events WHERE room_id = ?), '') AS latest_factory_event_at,
         COALESCE((SELECT SUM(version) FROM classroom_submission_revisions WHERE room_id = ?), 0) AS submission_version_sum,
         COALESCE((SELECT MAX(updated_at) FROM classroom_submission_revisions WHERE room_id = ?), '') AS latest_submission_mutation_at`,
    ).bind(roomId, roomId, roomId, roomId).first<{
      factory_event_count: number;
      latest_factory_event_at: string;
      submission_version_sum: number;
      latest_submission_mutation_at: string;
    }>(),
  ]);

  const blockers: TestClassroomDeletionBlocker[] = [];
  if ((uiReceipts.results ?? []).length) blockers.push({
    code: "UI_ACCEPTANCE_RECEIPT",
    label: "已签发真实 UI 验收回执",
    detail: "回执是发布链的不可变证据。请保留并归档这场课堂，不能物理删除。",
    referenceIds: (uiReceipts.results ?? []).map((item) => `${item.id} · ${item.status} · ${item.accepted_at}`),
  });
  if ((legacyReceipts.results ?? []).length) blockers.push({
    code: "LEGACY_TEST_RECEIPT",
    label: "存在历史测试验收记录",
    detail: "旧版验收记录仍引用这个实例；为避免证据悬空，物理删除已阻止。",
    referenceIds: (legacyReceipts.results ?? []).map((item) => `${item.id} · ${item.status} · ${item.evidence_at}`),
  });
  if ((releases.results ?? []).length) blockers.push({
    code: "COURSE_RELEASE",
    label: "正式发布记录引用本课堂",
    detail: "Released 课程的批准记录仍以本课堂为来源，必须保留审计链。",
    referenceIds: (releases.results ?? []).map((item) => `${item.course_id}@r${item.revision}:${item.digest.slice(0, 12)}`),
  });
  if ((productionRooms.results ?? []).length) blockers.push({
    code: "PRODUCTION_CLASSROOM",
    label: "正式课堂依赖本课堂的验收证据",
    detail: "至少一场 Production Classroom 通过本课堂的 UI 回执建立，不能删除来源实例。",
    referenceIds: (productionRooms.results ?? []).map((item) => `${item.room_id} · ${item.course_id}@r${item.course_revision}`),
  });

  const impact = {
    memberships: Number(impactRow?.memberships ?? 0),
    submissions: Number(impactRow?.submissions ?? 0),
    privateCards: Number(impactRow?.private_cards ?? 0),
    economyRecords: Number(impactRow?.economy_records ?? 0),
    runAndAuditRecords: Number(impactRow?.run_audit_records ?? 0),
  };
  const mutationGuard = {
    roomVersion: Number(row.room_version),
    factoryEventCount: Number(mutationRow?.factory_event_count ?? 0),
    latestFactoryEventAt: mutationRow?.latest_factory_event_at ?? "",
    submissionVersionSum: Number(mutationRow?.submission_version_sum ?? 0),
    latestSubmissionMutationAt: mutationRow?.latest_submission_mutation_at ?? "",
  };
  const preserved = [
    "共享登录账号与个人资料",
    "不可变课程 JSON 与 exact 版本",
    "导师课件、课件版本与发布记录",
    "其他 TEST／PRODUCTION 课堂及其 Membership",
    "课程视图验收与平台级安全审计",
  ];
  const classroom: TestClassroomDeletionPreview["classroom"] = {
    id: row.id,
    title: row.title,
    environment: "test",
    lifecycle: row.lifecycle,
    courseRef: {
      courseId: row.course_id,
      schemaVersion: row.schema_version,
      revision: row.course_revision,
      digest: row.course_digest,
      status: row.course_released ? "released" : "candidate",
    },
    resetGeneration: row.reset_generation,
    scriptVersion: row.script_version,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
  const stateToken = await mutationDigest({ classroom, impact, mutationGuard, blockers });
  return { classroom, impact, mutationGuard, preserved, blockers, canDelete: blockers.length === 0, stateToken };
}

/**
 * Physically delete one dependency-free Test instance and all classroom-owned
 * rows in a single D1 batch. Global users, courses, courseware and acceptance
 * evidence are never deletion targets. A minimal immutable tombstone survives.
 */
export async function deleteTestClassroom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: DeleteTestClassroomInput,
): Promise<DeleteTestClassroomResult> {
  assertDeleteMutationInput(roomId, input);
  const actorProfileId = auditActor(user);
  const replay = await deletionMutationReplay(db, roomId, actorProfileId, input);
  if (replay) return replay;
  if (user.impersonationId) {
    throw new ClassroomError("IMPERSONATION_DELETE_FORBIDDEN", "测试身份不能删除课堂；请先返回真实账号。", 403);
  }
  const preview = await previewTestClassroomDeletion(db, user, roomId);
  if (!preview.canDelete) {
    throw new ClassroomError(
      "CLASSROOM_DELETE_BLOCKED",
      "这场 Test Classroom 仍被验收或正式发布证据引用，不能删除；请改用只读归档。",
      409,
      preview.blockers.flatMap((blocker) => [`${blocker.label}：${blocker.detail}`, ...blocker.referenceIds]),
    );
  }
  if (input.expectedStateToken !== preview.stateToken
    || input.expectedResetGeneration !== preview.classroom.resetGeneration
    || input.expectedScriptVersion !== preview.classroom.scriptVersion
    || input.expectedRunId !== classroomRunId(roomId, preview.classroom.resetGeneration)) {
    throw mutationConflict("CLASSROOM_DELETE_CONFLICT", "课堂在确认期间发生变化；没有删除任何数据，请重新检查影响范围。");
  }

  const reason = input.reason?.trim() ?? "";
  const now = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    operation: "test-classroom-delete",
    classroom: preview.classroom,
    impact: preview.impact,
    mutationGuard: preview.mutationGuard,
    preserved: preview.preserved,
    stateToken: preview.stateToken,
    deletedByProfileId: actorProfileId,
    reason,
    deletedAt: now,
  };
  const snapshotJson = JSON.stringify(snapshot);
  const snapshotDigest = await mutationDigest(snapshot);
  const securityEventId = `classroom-test-delete.${snapshotDigest}`;
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO classroom_deletions
         (room_id, classroom_title, environment, course_id, course_revision, course_digest,
          previous_lifecycle, reset_generation, script_version, was_archived,
          deleted_by_profile_id, idempotency_key, reason, snapshot_json, snapshot_digest, deleted_at)
         SELECT r.id, r.title, ci.environment, ci.course_id, ci.course_revision, ci.course_digest,
                ci.lifecycle, ci.reset_generation, sp.version,
                CASE WHEN ca.room_id IS NULL THEN 0 ELSE 1 END,
                ?, ?, ?, ?, ?, ?
         FROM rooms r
         JOIN classroom_instances ci ON ci.room_id = r.id
         JOIN classroom_script_progress sp ON sp.room_id = r.id
         LEFT JOIN classroom_archives ca ON ca.room_id = r.id
         WHERE r.id = ? AND ci.environment = 'test'
           AND r.version = ? AND ci.reset_generation = ? AND sp.version = ? AND ci.updated_at = ?
           AND ((? IS NULL AND ca.archived_at IS NULL) OR ca.archived_at = ?)
           AND (SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = r.id) = ?
           AND COALESCE((SELECT MAX(created_at) FROM classroom_factory_events WHERE room_id = r.id), '') = ?
           AND COALESCE((SELECT SUM(version) FROM classroom_submission_revisions WHERE room_id = r.id), 0) = ?
           AND COALESCE((SELECT MAX(updated_at) FROM classroom_submission_revisions WHERE room_id = r.id), '') = ?
           AND (SELECT COUNT(*) FROM memberships WHERE room_id = r.id) = ?
           AND (SELECT COUNT(*) FROM classroom_block_submissions WHERE room_id = r.id) = ?
           AND (SELECT COUNT(*) FROM card_grants WHERE room_id = r.id) = ?
           AND ((SELECT COUNT(*) FROM reputation_entries WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM ledger_transactions WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM ledger_accounts WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM classroom_wallet_balances WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM team_assets WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM purchase_proposals WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM gratitude_votes WHERE room_id = r.id)) = ?
           AND ((SELECT COUNT(*) FROM classroom_factory_events WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM audit_events WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM classroom_submission_mutations WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM classroom_script_mutations WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM classroom_reset_mutations WHERE room_id = r.id)
             + (SELECT COUNT(*) FROM classroom_finish_mutations WHERE room_id = r.id)) = ?
           AND NOT EXISTS (SELECT 1 FROM course_ui_acceptance_receipts receipt WHERE receipt.room_id = r.id)
           AND NOT EXISTS (SELECT 1 FROM course_test_receipts receipt WHERE receipt.room_id = r.id)
           AND NOT EXISTS (
             SELECT 1 FROM course_release_pointers release
             WHERE json_extract(release.approval_json, '$.runId') = r.id
                OR json_extract(release.approval_json, '$.uiReceiptId') IN (
                  SELECT id FROM course_ui_acceptance_receipts WHERE room_id = r.id
                )
           )
           AND NOT EXISTS (SELECT 1 FROM classroom_deletions deletion WHERE deletion.room_id = r.id)`,
      ).bind(
        actorProfileId, input.idempotencyKey, reason, snapshotJson, snapshotDigest, now,
        roomId, preview.mutationGuard.roomVersion,
        input.expectedResetGeneration, input.expectedScriptVersion, preview.classroom.updatedAt,
        preview.classroom.archivedAt, preview.classroom.archivedAt,
        preview.mutationGuard.factoryEventCount, preview.mutationGuard.latestFactoryEventAt,
        preview.mutationGuard.submissionVersionSum, preview.mutationGuard.latestSubmissionMutationAt,
        preview.impact.memberships, preview.impact.submissions, preview.impact.privateCards,
        preview.impact.economyRecords, preview.impact.runAndAuditRecords,
      ),
      db.prepare(
        `INSERT INTO classroom_atomic_assertions (id, verified_at)
         SELECT CASE WHEN EXISTS (
           SELECT 1 FROM classroom_deletions
           WHERE room_id = ? AND deleted_by_profile_id = ? AND idempotency_key = ?
         ) THEN 1 ELSE 0 END, ?
         ON CONFLICT(id) DO NOTHING`,
      ).bind(roomId, actorProfileId, input.idempotencyKey, now),
      db.prepare(
        `DELETE FROM classroom_archives
         WHERE room_id = ? AND EXISTS (SELECT 1 FROM classroom_deletions deletion WHERE deletion.room_id = ?)`,
      ).bind(roomId, roomId),
      db.prepare(
        `DELETE FROM rooms
         WHERE id = ? AND EXISTS (SELECT 1 FROM classroom_deletions deletion WHERE deletion.room_id = ?)`,
      ).bind(roomId, roomId),
      db.prepare(
        `INSERT OR IGNORE INTO auth_security_events
         (id, user_id, actor_user_id, action, detail_json, created_at)
         SELECT ?, ?, ?, 'classroom.test-deleted', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM classroom_deletions
           WHERE room_id = ? AND deleted_by_profile_id = ? AND idempotency_key = ? AND deleted_at = ?
         )`,
      ).bind(securityEventId, user.userId, actorProfileId, JSON.stringify({
        classroomId: roomId,
        snapshotDigest,
        courseRef: preview.classroom.courseRef,
        resetGeneration: preview.classroom.resetGeneration,
        scriptVersion: preview.classroom.scriptVersion,
        wasArchived: Boolean(preview.classroom.archivedAt),
      }), now, roomId, actorProfileId, input.idempotencyKey, now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1 || Number(result[3]?.meta?.changes ?? 0) !== 1) {
      throw mutationConflict("CLASSROOM_DELETE_CONFLICT", "课堂在删除期间发生变化；事务已回滚，没有删除任何数据。");
    }
  } catch (error) {
    const won = await deletionMutationReplay(db, roomId, actorProfileId, input);
    if (won) return won;
    if (isAtomicAssertionError(error)) {
      throw mutationConflict("CLASSROOM_DELETE_CONFLICT", "课堂在删除期间发生变化或出现新的证据依赖；事务已回滚，请重新检查。");
    }
    throw error;
  }
  return { deleted: true, deletedAt: now, classroomId: roomId, idempotent: false, tombstoneDigest: snapshotDigest };
}

/**
 * Explicitly ends a v3 classroom run after its final script page is unlocked.
 * Script unlock, evidence review, and classroom completion deliberately remain
 * separate operations. Optional evidence gates are owned by CourseDefinition.
 */
export async function finishClassroomRun(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: FinishClassroomRunInput,
): Promise<FinishClassroomRunResult> {
  assertFinishMutationInput(input.expectedScriptVersion, input.idempotencyKey);
  const summary = (await listClassroomInstances(db, user)).find((item) => item.id === roomId);
  if (!summary) throw new ClassroomError("CLASSROOM_ACCESS_FORBIDDEN", "你不是这个课堂的成员或 Admin DM。", 403);
  if (summary.archive) throw new ClassroomError("CLASSROOM_ARCHIVED", "这场 Test Classroom 已归档并永久只读；不能再结束或修改运行。", 409);
  if (input.viewAsProfileId) {
    if (summary.environment !== "test") {
      throw new ClassroomError("TEST_VIEW_PRODUCTION_FORBIDDEN", "角色视角切换不能用于 Production Classroom。", 403);
    }
    await requireTestViewTarget(db, roomId, input.viewAsProfileId);
  }
  if (summary.environment !== "test" && !summary.isAdminDm && !summary.mentorRole) {
    throw new ClassroomError("CLASSROOM_FINISH_MENTOR_REQUIRED", "只有本课堂导师或 Admin DM 可以确认结束。", 403);
  }

  const actorProfileId = auditActor(user);
  const existing = await finishMutationReplay(db, roomId, actorProfileId, input);
  if (existing) return existing;
  const row = await db.prepare(
    `SELECT ci.environment, ci.lifecycle, ci.course_id, ci.course_revision, ci.course_digest,
            ci.reset_generation, ci.state_machine_version, ci.completed_at,
            sp.version AS script_version, sp.unlocked_through_index
     FROM classroom_instances ci
     JOIN classroom_script_progress sp ON sp.room_id = ci.room_id
     WHERE ci.room_id = ?`,
  ).bind(roomId).first<{
    environment: ClassroomEnvironment;
    lifecycle: string;
    course_id: string;
    course_revision: number;
    course_digest: string;
    reset_generation: number;
    state_machine_version: number;
    completed_at: string | null;
    script_version: number;
    unlocked_through_index: number;
  }>();
  if (!row) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  assertRunExpectation(roomId, row.reset_generation, input);
  if (row.state_machine_version === LEGACY_CLASSROOM_STATE_MACHINE_VERSION) {
    throw new ClassroomError(
      "CLASSROOM_FINISH_LEGACY_RUN",
      "这是一场旧版课堂：末页解锁已按原规则自动结束。Test Classroom 可重置后切换到新版显式结束规则。",
      409,
    );
  }
  if (row.state_machine_version !== CLASSROOM_STATE_MACHINE_VERSION) {
    throw new ClassroomError("CLASSROOM_STATE_MACHINE_UNSUPPORTED", "课堂状态机版本无法由当前应用安全结束。", 409);
  }
  if (row.script_version !== input.expectedScriptVersion) {
    throw mutationConflict("SCRIPT_VERSION_CONFLICT", "剧本解锁边界刚刚变化，请同步后再确认结束。");
  }
  if (row.lifecycle === "completed") {
    throw new ClassroomError("CLASSROOM_ALREADY_COMPLETED", "本次课堂已经结束。", 409);
  }

  const exactRef = { courseId: row.course_id, revision: row.course_revision, digest: row.course_digest };
  const course = await loadExactCoursePackage(db, exactRef);
  if (row.unlocked_through_index !== course.blocks.length - 1) {
    throw new ClassroomError("CLASSROOM_FINISH_SCRIPT_INCOMPLETE", "请先解锁并讲完最后一页，再确认结束本次课堂。", 409, [
      `已解锁 ${row.unlocked_through_index + 1}/${course.blocks.length}`,
    ]);
  }
  const completion = resolveCourseCompletionPolicy(course);
  if (completion.requiredAcceptedSubmissionSchemaIds.length) {
    const acceptedRows = await db.prepare(
      `SELECT s.payload_json
       FROM classroom_block_submissions s
       JOIN classroom_submission_revisions sr ON sr.submission_id = s.id
       WHERE s.room_id = ? AND s.status = 'accepted' AND sr.reset_generation = ?`,
    ).bind(roomId, row.reset_generation).all<{ payload_json: string }>();
    const acceptedSchemaIds = new Set(
      (acceptedRows.results ?? [])
        .map((item) => parseStoredSubmissionPayload(item.payload_json).schemaId)
        .filter((schemaId): schemaId is string => Boolean(schemaId)),
    );
    const missing = completion.requiredAcceptedSubmissionSchemaIds.filter((schemaId) => !acceptedSchemaIds.has(schemaId));
    if (missing.length) {
      throw new ClassroomError(
        "CLASSROOM_FINISH_EVIDENCE_REQUIRED",
        "本课程明确要求的成果尚未全部通过导师验收；剧本已经解锁，但暂不能结束课堂。",
        409,
        missing.map((schemaId) => `待通过：${schemaId}`),
      );
    }
  }

  const mutationId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO classroom_finish_mutations
         (id, room_id, reset_generation, expected_script_version, actor_profile_id, idempotency_key, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         FROM classroom_instances ci
         JOIN classroom_script_progress sp ON sp.room_id = ci.room_id
         WHERE ci.room_id = ? AND ci.reset_generation = ? AND ci.state_machine_version = ?
           AND ci.lifecycle IN ('ready', 'running') AND sp.version = ? AND sp.unlocked_through_index = ?
           AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)
           AND NOT EXISTS (
             SELECT 1 FROM classroom_finish_mutations fm
             WHERE fm.room_id = ci.room_id AND fm.reset_generation = ci.reset_generation
           )`,
      ).bind(
        mutationId,
        roomId,
        input.expectedResetGeneration,
        input.expectedScriptVersion,
        actorProfileId,
        input.idempotencyKey,
        now,
        roomId,
        input.expectedResetGeneration,
        CLASSROOM_STATE_MACHINE_VERSION,
        input.expectedScriptVersion,
        course.blocks.length - 1,
      ),
      mutationAssertion(db, "classroom_finish_mutations", mutationId, now),
      db.prepare(
        `UPDATE classroom_instances
         SET lifecycle = 'completed',
             locked_at = COALESCE(locked_at, ?),
             started_at = COALESCE(started_at, ?),
             completed_at = ?, updated_at = ?
         WHERE room_id = ? AND reset_generation = ? AND state_machine_version = ?
           AND lifecycle IN ('ready', 'running')
           AND EXISTS (SELECT 1 FROM classroom_finish_mutations WHERE id = ?)`,
      ).bind(now, now, now, now, roomId, input.expectedResetGeneration, CLASSROOM_STATE_MACHINE_VERSION, mutationId),
      factoryEvent(db, roomId, actorProfileId, "classroom.run-finished", withIdentityAudit(user, {
        runId: input.expectedRunId,
        resetGeneration: input.expectedResetGeneration,
        scriptVersion: input.expectedScriptVersion,
        stateMachineVersion: CLASSROOM_STATE_MACHINE_VERSION,
        requiredAcceptedSubmissionSchemaIds: completion.requiredAcceptedSubmissionSchemaIds,
        projectedProfileId: input.viewAsProfileId ?? user.userId,
        testView: Boolean(input.viewAsProfileId),
        mutationId,
      }), now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1 || Number(result[2]?.meta?.changes ?? 0) !== 1) {
      throw mutationConflict("CLASSROOM_FINISH_CONFLICT", "课堂状态刚刚变化，请同步后再确认结束。");
    }
  } catch (error) {
    const replay = await finishMutationReplay(db, roomId, actorProfileId, input);
    if (replay) return replay;
    if (isAtomicAssertionError(error)) {
      throw mutationConflict("CLASSROOM_FINISH_CONFLICT", "课堂已重置、结束或剧本边界刚刚变化，请同步后重试。");
    }
    throw error;
  }
  return {
    completed: true,
    completedAt: now,
    runId: input.expectedRunId,
    resetGeneration: input.expectedResetGeneration,
    idempotent: false,
  };
}

export async function resetTestClassroom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: ClassroomRunExpectation,
): Promise<{ runId: string; resetGeneration: number }> {
  await requireAdminDm(db, user, roomId);
  await requireWritableClassroom(db, roomId);
  const instance = await db.prepare(
    `SELECT environment, course_id, course_revision, course_digest, learner_count, reset_generation
     FROM classroom_instances WHERE room_id = ?`,
  ).bind(roomId).first<{ environment: ClassroomEnvironment; course_id: string; course_revision: number; course_digest: string; learner_count: number; reset_generation: number }>();
  if (!instance) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (instance.environment !== "test") throw new ClassroomError("PRODUCTION_RESET_FORBIDDEN", "正式课堂不能重置。", 403);
  assertRunExpectation(roomId, instance.reset_generation, input);
  const exactRef = { courseId: instance.course_id, revision: instance.course_revision, digest: instance.course_digest };
  const course = await loadExactCoursePackage(db, exactRef);
  const campaign = projectCoursePackageToCampaign(course, { ...exactRef, schemaVersion: course.schemaVersion, status: "candidate" });
  const team = await db.prepare(`SELECT id FROM teams WHERE room_id = ? ORDER BY created_at LIMIT 1`).bind(roomId).first<{ id: string }>();
  if (!team) throw new ClassroomError("CLASSROOM_TEAM_MISSING", "课堂缺少团队，不能安全重置。", 500);
  const learners = await db.prepare(
    `SELECT id, profile_id, seat FROM memberships WHERE room_id = ? AND role = 'learner' AND status = 'active' ORDER BY seat`,
  ).bind(roomId).all<{ id: string; profile_id: string; seat: number }>();
  if ((learners.results ?? []).length !== instance.learner_count) throw new ClassroomError("CLASSROOM_MEMBERSHIP_CORRUPT", "学员 Membership 与实例人数不一致，不能安全重置。", 500);
  const actorMembership = await db.prepare(
    `SELECT membership_id FROM classroom_mentor_seats WHERE room_id = ? AND mentor_role = 'P'`,
  ).bind(roomId).first<{ membership_id: string }>();
  if (!actorMembership) throw new ClassroomError("CLASSROOM_MENTOR_MISSING", "课堂缺少 P 导师席，不能安全重置。", 500);
  const now = new Date().toISOString();
  const nextResetGeneration = instance.reset_generation + 1;
  const nextDealSeed = classroomDealSeed(roomId, nextResetGeneration);
  const mutationId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO classroom_reset_mutations
       (id, room_id, from_generation, to_generation, actor_profile_id, created_at)
       SELECT ?, ?, ?, ?, ?, ? FROM classroom_instances
       WHERE room_id = ? AND environment = 'test' AND reset_generation = ?
         AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = classroom_instances.room_id)`,
    ).bind(mutationId, roomId, instance.reset_generation, nextResetGeneration, auditActor(user), now, roomId, instance.reset_generation),
    mutationAssertion(db, "classroom_reset_mutations", mutationId, now),
    db.prepare(`DELETE FROM card_grants WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM intelligence_edges WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM intelligence_nodes WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM challenge_actions WHERE run_id IN (SELECT id FROM challenge_runs WHERE room_id = ?)`).bind(roomId),
    db.prepare(`DELETE FROM challenge_runs WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM reputation_entries WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM worldline_entries WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM team_assets WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM purchase_votes WHERE proposal_id IN (SELECT id FROM purchase_proposals WHERE room_id = ?)`).bind(roomId),
    db.prepare(`DELETE FROM purchase_proposals WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM gratitude_votes WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM classroom_block_submissions WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM ledger_transactions WHERE room_id = ?`).bind(roomId),
    db.prepare(`UPDATE ledger_accounts SET balance_tenths = 100 WHERE kind = 'team-treasury' AND room_id = ?`).bind(roomId),
    db.prepare(`UPDATE classroom_wallet_balances SET balance_tenths = 0, updated_at = ? WHERE room_id = ?`).bind(now, roomId),
    db.prepare(`UPDATE memberships SET pdmo_role = NULL, support_commitment = NULL, updated_at = ? WHERE room_id = ?`).bind(now, roomId),
    db.prepare(`UPDATE rooms SET phase = 'identity', chapter_id = ?, version = version + 1, paused = 0, paused_at = NULL, phase_deadline_at = NULL, player_timeline_frozen = 0, history_revealed = 0, updated_at = ? WHERE id = ?`).bind(campaign.chapters[0].id, now, roomId),
    db.prepare(`UPDATE classroom_controller_states SET state_machine_version = ?, block_id = ?, block_index = 0, state = 'ready', attempt = 1, error_message = NULL, version = version + 1, updated_at = ? WHERE room_id = ?`).bind(CLASSROOM_STATE_MACHINE_VERSION, course.blocks[0].id, now, roomId),
    db.prepare(
      `UPDATE classroom_script_progress
       SET state_machine_version = ?, unlocked_through_block_id = ?, unlocked_through_index = 0,
           version = version + 1, updated_at = ? WHERE room_id = ?`,
    ).bind(CLASSROOM_STATE_MACHINE_VERSION, course.blocks[0].id, now, roomId),
    db.prepare(`UPDATE classroom_instances SET lifecycle = 'ready', state_machine_version = ?, reset_generation = reset_generation + 1, locked_at = NULL, started_at = NULL, completed_at = NULL, updated_at = ? WHERE room_id = ? AND reset_generation = ?`).bind(CLASSROOM_STATE_MACHINE_VERSION, now, roomId, instance.reset_generation),
    db.prepare(`UPDATE classroom_acceptance_bindings SET ui_receipt_id = NULL WHERE room_id = ?`).bind(roomId),
  ];
  for (const learner of learners.results ?? []) {
    const identityId = campaign.chapters[0].identities[learner.seat - 1]?.id;
    if (!identityId) throw new ClassroomError("CLASSROOM_IDENTITY_CAPACITY", "课程身份数量不足，不能安全重置。", 500);
    statements.push(db.prepare(`UPDATE memberships SET case_identity_id = ? WHERE id = ?`).bind(identityId, learner.id));
  }
  for (const [stepIndex, step] of course.macroSteps.entries()) {
    const projection = buildStudioProjection(course, { learnerCount: instance.learner_count, blockId: step.blocks[0], seed: nextDealSeed });
    projection.learnerViews.forEach((view, learnerIndex) => {
      for (const card of view.privateCards) {
        statements.push(db.prepare(
          `INSERT INTO card_grants (id, room_id, chapter_id, team_id, card_id, member_id, state, granted_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, 'unread', ?, NULL)`,
        ).bind(crypto.randomUUID(), roomId, campaign.chapters[stepIndex].id, team.id, card.id, learners.results![learnerIndex].id, now));
      }
    });
  }
  statements.push(
    db.prepare(
      `INSERT INTO ledger_transactions
       (id, room_id, chapter_id, from_account_id, to_account_id, amount_tenths, category, source_object_id,
        created_by_member_id, idempotency_key, reason, reversal_of, created_at)
       VALUES (?, ?, ?, NULL, ?, 100, 'financing', ?, ?, ?, 'Test 重置后的初始团队资金 10 C', NULL, ?)`,
    ).bind(crypto.randomUUID(), roomId, campaign.chapters[0].id, `treasury:${team.id}`, `factory-reset:${roomId}:${now}`, actorMembership.membership_id, `factory-reset:${roomId}:${now}`, now),
    factoryEvent(db, roomId, auditActor(user), "classroom.test-reset", withIdentityAudit(user, {
      learnerCount: instance.learner_count,
      fromRunId: classroomRunId(roomId, instance.reset_generation),
      toRunId: classroomRunId(roomId, nextResetGeneration),
      dealSeed: nextDealSeed,
      mutationId,
    }), now),
  );
  try {
    const result = await db.batch(statements);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1) throw mutationConflict("CLASSROOM_RUN_CONFLICT", "课堂已经被另一位导师重置，请同步最新运行。");
  } catch (error) {
    if (isAtomicAssertionError(error)) throw mutationConflict("CLASSROOM_RUN_CONFLICT", "课堂已经被另一位导师重置，请同步最新运行。");
    throw error;
  }
  return { runId: classroomRunId(roomId, nextResetGeneration), resetGeneration: nextResetGeneration };
}

export async function acceptTestClassroom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  checks: Record<string, unknown>,
  clientMatrix: UiAcceptanceClient[],
) {
  await requireAdminDm(db, user, roomId);
  await requireWritableClassroom(db, roomId);
  const detail = await getClassroomInstance(db, user, roomId);
  if (detail.environment !== "test") throw new ClassroomError("TEST_CLASSROOM_REQUIRED", "只有 Test Classroom 可以生成验收回执。", 409);
  if (detail.script.unlockedThroughIndex !== detail.course.blockCount - 1) {
    throw new ClassroomError("TEST_NOT_COMPLETED", "请先在真实课堂 UI 中逐页确认并解锁全部剧本页。", 409);
  }
  if (detail.lifecycle !== "completed") {
    throw new ClassroomError(
      "TEST_CLASSROOM_FINISH_REQUIRED",
      "全部剧本页已经解锁，但本次课堂尚未由导师明确确认结束。",
      409,
    );
  }
  if (detail.mentors.length !== 4 || detail.learners.length !== detail.learnerCount || detail.courseware.length !== 4) {
    throw new ClassroomError("TEST_INSTANCE_INCOMPLETE", "课堂成员或四导师课件绑定不完整，不能签发验收回执。", 409);
  }
  const instance = await db.prepare(
    `SELECT reset_generation, state_machine_version FROM classroom_instances WHERE room_id = ?`,
  ).bind(roomId).first<{ reset_generation: number; state_machine_version: number }>();
  const binding = await db.prepare(
    `SELECT view_receipt_id FROM classroom_acceptance_bindings WHERE room_id = ?`,
  ).bind(roomId).first<{ view_receipt_id: string }>();
  if (!instance || !binding) throw new ClassroomError("TEST_ACCEPTANCE_BINDING_MISSING", "Test Classroom 缺少视图验收来源绑定。", 409);
  const mentorRows = await db.prepare(
    `SELECT s.mentor_role, s.membership_id, s.profile_id
     FROM classroom_mentor_seats s WHERE s.room_id = ?
     ORDER BY CASE s.mentor_role WHEN 'P' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END`,
  ).bind(roomId).all<{ mentor_role: string; membership_id: string; profile_id: string }>();
  const learnerRows = await db.prepare(
    `SELECT seat, id AS membership_id, profile_id FROM memberships
     WHERE room_id = ? AND role = 'learner' AND status = 'active' ORDER BY seat`,
  ).bind(roomId).all<{ seat: number; membership_id: string; profile_id: string }>();
  const adminRows = await db.prepare(
    `SELECT profile_id FROM classroom_admin_dm_grants
     WHERE room_id = ? AND revoked_at IS NULL
     ORDER BY CASE delegation_mode WHEN 'primary' THEN 0 ELSE 1 END, profile_id`,
  ).bind(roomId).all<{ profile_id: string }>();
  const audit = await db.prepare(
    `SELECT COUNT(*) AS event_count, MIN(created_at) AS first_event_at, MAX(created_at) AS last_event_at
     FROM classroom_factory_events WHERE room_id = ?`,
  ).bind(roomId).first<{ event_count: number; first_event_at: string | null; last_event_at: string | null }>();
  const booleanChecks = Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, value === true]));
  const receipt = await recordUiAcceptanceReceipt(db, {
    roomId,
    viewReceiptId: binding.view_receipt_id,
    courseRef: detail.courseRef,
    learnerCount: detail.learnerCount,
    dealSeed: classroomDealSeed(roomId, instance.reset_generation),
    resetGeneration: instance.reset_generation,
    stateMachineVersion: instance.state_machine_version,
    coursewareRefs: detail.courseware,
    mentorMemberships: (mentorRows.results ?? []).map((row) => ({ mentorRole: row.mentor_role, membershipId: row.membership_id, profileId: row.profile_id })),
    learnerMemberships: (learnerRows.results ?? []).map((row) => ({ seat: row.seat, membershipId: row.membership_id, profileId: row.profile_id })),
    adminDmProfileIds: (adminRows.results ?? []).map((row) => row.profile_id),
    checks: booleanChecks,
    clientMatrix,
    auditSummary: {
      eventCount: Number(audit?.event_count ?? 0),
      firstEventAt: audit?.first_event_at ?? null,
      lastEventAt: audit?.last_event_at ?? null,
      scriptUnlockVersion: detail.script.version,
      unlockedThroughBlockId: detail.script.unlockedThroughBlockId,
      appBuildId: COURSE_ACCEPTANCE_APP_BUILD_ID,
      sourceCommit: COURSE_ACCEPTANCE_SOURCE_COMMIT,
      projectorContractVersion: COURSE_PROJECTOR_CONTRACT_VERSION,
      runtimeContractVersion: CLASSROOM_RUNTIME_CONTRACT_VERSION,
      ...identityAudit(user),
    },
  }, auditActor(user));
  return {
    receiptId: receipt.receiptId,
    viewReceiptId: receipt.viewReceiptId,
    coursewareBundleDigest: receipt.coursewareBundleDigest,
    appBuildId: receipt.appBuildId,
  };
}

export type AssignableClassroomAccount = {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "mentor" | "learner";
  hasMembership: boolean;
  hasAdminDm: boolean;
  inClassroom: boolean;
};

export type TestClassroomIdentity = {
  userId: string;
  username: string;
  displayName: string;
  role: "mentor" | "learner" | "observer";
  status: "active" | "disabled";
  mentorRole: ClassroomMentorRole | null;
  learnerSeat: number | null;
  adminDmMode: AdminDmDelegationMode | null;
  mustChangePassword: boolean;
  lastSeenAt: string | null;
};

/**
 * The account switcher is intentionally Test-only and returns only identities
 * that are already scoped to this exact classroom.  It never exposes another
 * platform administrator as a target.
 */
export async function listTestClassroomIdentities(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<TestClassroomIdentity[]> {
  if (user.impersonationId || user.platformRole !== "admin") {
    throw new ClassroomError("PLATFORM_ADMIN_REQUIRED", "只有真实登录的平台管理员可以管理测试身份。", 403);
  }
  const instance = await db.prepare(
    `SELECT ci.environment,
            CASE WHEN g.id IS NULL THEN 0 ELSE 1 END AS actor_is_admin_dm
     FROM classroom_instances ci
     LEFT JOIN classroom_admin_dm_grants g
       ON g.room_id = ci.room_id AND g.profile_id = ? AND g.revoked_at IS NULL
     WHERE ci.room_id = ?`,
  ).bind(user.userId, roomId).first<{ environment: ClassroomEnvironment; actor_is_admin_dm: number }>();
  if (!instance) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (instance.environment !== "test") {
    throw new ClassroomError("TEST_CLASSROOM_REQUIRED", "测试身份只适用于 Test Classroom。", 403);
  }
  if (!instance.actor_is_admin_dm) {
    throw new ClassroomError("CLASSROOM_ADMIN_REQUIRED", "平台管理员必须显式拥有本课堂 Admin DM 权限。", 403);
  }
  const result = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, u.must_change_password,
            ms.mentor_role, lm.seat AS learner_seat, g.delegation_mode,
            MAX(CASE WHEN s.revoked_at IS NULL THEN s.last_seen_at END) AS last_seen_at
     FROM auth_users u
     LEFT JOIN classroom_mentor_seats ms ON ms.room_id = ? AND ms.profile_id = u.id
     LEFT JOIN memberships lm
       ON lm.room_id = ? AND lm.profile_id = u.id AND lm.role = 'learner' AND lm.status = 'active'
     LEFT JOIN classroom_admin_dm_grants g
       ON g.room_id = ? AND g.profile_id = u.id AND g.revoked_at IS NULL
     LEFT JOIN auth_sessions s ON s.user_id = u.id
     WHERE u.role <> 'admin'
       AND (ms.profile_id IS NOT NULL OR lm.profile_id IS NOT NULL OR g.id IS NOT NULL)
     GROUP BY u.id, ms.mentor_role, lm.seat, g.delegation_mode
     ORDER BY CASE WHEN ms.mentor_role IS NOT NULL THEN 0 WHEN lm.seat IS NOT NULL THEN 1 ELSE 2 END,
              CASE ms.mentor_role WHEN 'P' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 WHEN 'O' THEN 4 ELSE 5 END,
              lm.seat, u.username`,
  ).bind(roomId, roomId, roomId).all<{
    id: string;
    username: string;
    display_name: string;
    role: "mentor" | "learner" | "observer";
    status: "active" | "disabled";
    must_change_password: number;
    mentor_role: ClassroomMentorRole | null;
    learner_seat: number | null;
    delegation_mode: AdminDmDelegationMode | null;
    last_seen_at: string | null;
  }>();
  return (result.results ?? []).map((row) => ({
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    mentorRole: row.mentor_role,
    learnerSeat: row.learner_seat,
    adminDmMode: row.delegation_mode,
    mustChangePassword: Boolean(row.must_change_password),
    lastSeenAt: row.last_seen_at,
  }));
}

export async function listAssignableClassroomAccounts(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<AssignableClassroomAccount[]> {
  await requireAdminDm(db, user, roomId);
  const result = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role,
            CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS has_membership,
            CASE WHEN g.id IS NOT NULL THEN 1 ELSE 0 END AS has_admin_dm
     FROM auth_users u
     LEFT JOIN memberships m ON m.room_id = ? AND m.profile_id = u.id AND m.status = 'active'
     LEFT JOIN classroom_admin_dm_grants g ON g.room_id = ? AND g.profile_id = u.id AND g.revoked_at IS NULL
     WHERE u.status = 'active' AND u.role IN ('admin', 'mentor', 'learner')
     ORDER BY CASE u.role WHEN 'admin' THEN 1 WHEN 'mentor' THEN 2 ELSE 3 END, u.username LIMIT 300`,
  ).bind(roomId, roomId).all<{
    id: string;
    username: string;
    display_name: string;
    role: "admin" | "mentor" | "learner";
    has_membership: number;
    has_admin_dm: number;
  }>();
  return (result.results ?? []).map((row) => ({
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    hasMembership: Boolean(row.has_membership),
    hasAdminDm: Boolean(row.has_admin_dm),
    inClassroom: Boolean(row.has_membership || row.has_admin_dm),
  }));
}

export type ClassroomMembershipAction =
  | { type: "replace-learner"; seat: number; profileId: string }
  | { type: "replace-mentor"; mentorRole: ClassroomMentorRole; profileId: string }
  | { type: "grant-admin-dm"; profileId: string }
  | { type: "revoke-admin-dm"; profileId: string }
  | { type: "relinquish-admin-dm" };

export async function updateClassroomMembership(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  action: ClassroomMembershipAction,
): Promise<void> {
  const callerGrant = await requireAdminDm(db, user, roomId);
  await requireWritableClassroom(db, roomId);
  const instance = await db.prepare(`SELECT lifecycle, learner_count FROM classroom_instances WHERE room_id = ?`).bind(roomId).first<{ lifecycle: string; learner_count: number }>();
  if (!instance) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (action.type === "relinquish-admin-dm") {
    if (user.impersonationId) {
      await denyAdminDmDelegation(db, user, roomId, action.type, "ADMIN_DM_DELEGATION_REQUIRED");
    }
    if (callerGrant.mode !== "delegated") {
      await denyAdminDmDelegation(db, user, roomId, action.type, "PRIMARY_RELINQUISH_FORBIDDEN");
    }
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(
        `UPDATE classroom_admin_dm_grants
         SET revoked_by_profile_id = ?, revoked_at = ?, version = version + 1
         WHERE id = ? AND revoked_at IS NULL AND delegation_mode = 'delegated'`,
      ).bind(auditActor(user), now, callerGrant.id),
      db.prepare(
        `DELETE FROM classroom_permissions
         WHERE room_id = ? AND profile_id = ? AND permission = 'admin-dm'`,
      ).bind(roomId, user.userId),
      db.prepare(
        `UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'admin-dm-relinquished'
         WHERE classroom_id = ? AND effective_user_id = ? AND revoked_at IS NULL`,
      ).bind(now, roomId, user.userId),
      factoryEvent(db, roomId, auditActor(user), "membership.admin-dm.relinquished", withIdentityAudit(user, { profileId: user.userId }), now),
    ]);
    return;
  }
  const profileId = action.profileId.trim();
  if (!profileId || profileId.length > 128) throw new ClassroomError("PROFILE_ID_INVALID", "账号 ID 无效。", 400);
  const account = await db.prepare(`SELECT role, status FROM auth_users WHERE id = ?`).bind(profileId).first<{ role: string; status: string }>();
  const now = new Date().toISOString();

  if (action.type === "grant-admin-dm") {
    await requireAdminDmDelegator(db, user, roomId, callerGrant, action.type);
    const existingGrant = await db.prepare(
      `SELECT id, delegation_mode, revoked_at FROM classroom_admin_dm_grants
       WHERE room_id = ? AND profile_id = ?`,
    ).bind(roomId, profileId).first<{
      id: string;
      delegation_mode: AdminDmDelegationMode;
      revoked_at: string | null;
    }>();
    if (existingGrant?.delegation_mode === "primary") {
      await denyAdminDmDelegation(db, user, roomId, action.type, "ADMIN_DM_ALREADY_PRIMARY", profileId);
    }
    if (existingGrant && !existingGrant.revoked_at) {
      await factoryEvent(db, roomId, auditActor(user), "membership.admin-dm.grant-idempotent", withIdentityAudit(user, {
        profileId,
        delegationMode: "delegated",
      }), now).run();
      return;
    }
    if (!account || account.status !== "active") {
      throw new ClassroomError("ACCOUNT_NOT_AVAILABLE", "账号不存在或已停用。", 409);
    }
    if (account.role !== "mentor") {
      await denyAdminDmDelegation(db, user, roomId, action.type, "DELEGATED_DM_MENTOR_REQUIRED", profileId);
    }
    const grantId = existingGrant?.id ?? crypto.randomUUID();
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO classroom_permissions (id, room_id, profile_id, permission, granted_by_profile_id, created_at)
         VALUES (?, ?, ?, 'admin-dm', ?, ?)`,
      ).bind(grantId, roomId, profileId, auditActor(user), now),
      db.prepare(
        `INSERT INTO classroom_admin_dm_grants
         (id, room_id, profile_id, delegation_mode, can_delegate, granted_by_profile_id,
          granted_at, revoked_by_profile_id, revoked_at, version)
         VALUES (?, ?, ?, 'delegated', 0, ?, ?, NULL, NULL, 1)
         ON CONFLICT(room_id, profile_id) DO UPDATE SET
           granted_by_profile_id = excluded.granted_by_profile_id,
           granted_at = excluded.granted_at, revoked_by_profile_id = NULL,
           revoked_at = NULL, version = classroom_admin_dm_grants.version + 1
         WHERE classroom_admin_dm_grants.delegation_mode = 'delegated'
           AND classroom_admin_dm_grants.revoked_at IS NOT NULL`,
      ).bind(grantId, roomId, profileId, auditActor(user), now),
      db.prepare(
        `INSERT OR IGNORE INTO classroom_wallet_balances (room_id, profile_id, balance_tenths, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?)`,
      ).bind(roomId, profileId, now, now),
      factoryEvent(db, roomId, auditActor(user), "membership.admin-dm.granted", withIdentityAudit(user, { profileId, delegationMode: "delegated", canDelegate: false }), now),
    ]);
    return;
  }
  if (action.type === "revoke-admin-dm") {
    await requireAdminDmDelegator(db, user, roomId, callerGrant, action.type);
    const targetGrant = await db.prepare(
      `SELECT id, delegation_mode, revoked_at FROM classroom_admin_dm_grants
       WHERE room_id = ? AND profile_id = ?`,
    ).bind(roomId, profileId).first<{ id: string; delegation_mode: AdminDmDelegationMode; revoked_at: string | null }>();
    if (!targetGrant) {
      await denyAdminDmDelegation(db, user, roomId, action.type, "ADMIN_DM_GRANT_NOT_FOUND", profileId);
    }
    if (targetGrant!.delegation_mode === "primary") {
      await denyAdminDmDelegation(db, user, roomId, action.type, "PRIMARY_ADMIN_DM_PROTECTED", profileId);
    }
    if (targetGrant!.revoked_at) {
      await factoryEvent(db, roomId, auditActor(user), "membership.admin-dm.revoke-idempotent", withIdentityAudit(user, {
        profileId,
      }), now).run();
      return;
    }
    await db.batch([
      db.prepare(`DELETE FROM classroom_permissions WHERE room_id = ? AND profile_id = ? AND permission = 'admin-dm'`).bind(roomId, profileId),
      db.prepare(
        `UPDATE classroom_admin_dm_grants
         SET revoked_by_profile_id = ?, revoked_at = ?, version = version + 1
         WHERE id = ? AND revoked_at IS NULL AND delegation_mode = 'delegated'`,
      ).bind(auditActor(user), now, targetGrant!.id),
      db.prepare(
        `UPDATE auth_impersonations SET revoked_at = ?, end_reason = 'admin-dm-revoked'
         WHERE classroom_id = ? AND effective_user_id = ? AND revoked_at IS NULL`,
      ).bind(now, roomId, profileId),
      factoryEvent(db, roomId, auditActor(user), "membership.admin-dm.revoked", withIdentityAudit(user, { profileId }), now),
    ]);
    return;
  }

  if (!account || account.status !== "active") throw new ClassroomError("ACCOUNT_NOT_AVAILABLE", "账号不存在或已停用。", 409);

  if (instance.lifecycle === "running" || instance.lifecycle === "completed") {
    throw new ClassroomError("CLASSROOM_MEMBERS_LOCKED", "课堂开始后导师与学员席已锁定；请先在 Test 环境重置或创建新课堂。", 409);
  }
  const occupied = await db.prepare(
    `SELECT id FROM memberships WHERE room_id = ? AND profile_id = ? AND status = 'active'`,
  ).bind(roomId, profileId).first<{ id: string }>();
  if (occupied) throw new ClassroomError("ACCOUNT_ALREADY_IN_CLASSROOM", "这个账号已经占用本课堂的另一个席位。", 409);

  if (action.type === "replace-learner") {
    if (account.role !== "learner") throw new ClassroomError("LEARNER_ACCOUNT_INVALID", "学员席只能使用学员账号。", 409);
    if (!Number.isInteger(action.seat) || action.seat < 1 || action.seat > instance.learner_count) throw new ClassroomError("LEARNER_SEAT_INVALID", "学员席位无效。", 400);
    const membership = await db.prepare(
      `SELECT id, profile_id FROM memberships WHERE room_id = ? AND role = 'learner' AND seat = ? AND status = 'active'`,
    ).bind(roomId, action.seat).first<{ id: string; profile_id: string }>();
    if (!membership) throw new ClassroomError("LEARNER_SEAT_MISSING", "找不到这个学员席。", 404);
    await db.batch([
      db.prepare(`UPDATE memberships SET profile_id = ?, updated_at = ? WHERE id = ?`).bind(profileId, now, membership.id),
      db.prepare(`INSERT OR IGNORE INTO classroom_wallet_balances (room_id, profile_id, balance_tenths, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`).bind(roomId, profileId, now, now),
      factoryEvent(db, roomId, auditActor(user), "membership.learner.replaced", withIdentityAudit(user, { seat: action.seat, fromProfileId: membership.profile_id, toProfileId: profileId }), now),
    ]);
    return;
  }

  if (account.role !== "mentor" && account.role !== "admin") throw new ClassroomError("MENTOR_ACCOUNT_INVALID", "导师席只能使用导师或管理员账号。", 409);
  const mentor = await db.prepare(
    `SELECT membership_id, profile_id FROM classroom_mentor_seats WHERE room_id = ? AND mentor_role = ?`,
  ).bind(roomId, action.mentorRole).first<{ membership_id: string; profile_id: string }>();
  if (!mentor) throw new ClassroomError("MENTOR_SEAT_MISSING", "找不到这个导师席。", 404);
  await db.batch([
    db.prepare(`UPDATE memberships SET profile_id = ?, updated_at = ? WHERE id = ?`).bind(profileId, now, mentor.membership_id),
    db.prepare(`UPDATE classroom_mentor_seats SET profile_id = ?, updated_at = ? WHERE room_id = ? AND mentor_role = ?`).bind(profileId, now, roomId, action.mentorRole),
    db.prepare(`INSERT OR IGNORE INTO classroom_wallet_balances (room_id, profile_id, balance_tenths, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`).bind(roomId, profileId, now, now),
    factoryEvent(db, roomId, auditActor(user), "membership.mentor.replaced", withIdentityAudit(user, { mentorRole: action.mentorRole, fromProfileId: mentor.profile_id, toProfileId: profileId }), now),
  ]);
}

async function resolveTrustedCourseRef(db: ClassroomD1, requested: CoursePackageRef): Promise<ResolvedCourseRef> {
  const row = await db.prepare(
    `SELECT v.schema_version,
            CASE WHEN rp.revision = v.revision AND rp.digest = v.digest THEN 1 ELSE 0 END AS released,
            CASE WHEN cp.revision = v.revision AND cp.digest = v.digest THEN 1 ELSE 0 END AS candidate,
            rp.released_at, rp.released_by
     FROM course_versions v
     LEFT JOIN course_release_pointers rp ON rp.course_id = v.course_id
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = v.course_id
     WHERE v.course_id = ? AND v.revision = ? AND v.digest = ?`,
  ).bind(requested.courseId, requested.revision, requested.digest).first<{
    schema_version: number; released: number; candidate: number; released_at: string | null; released_by: string | null;
  }>();
  if (!row) throw new ClassroomError("COURSE_VERSION_NOT_FOUND", "找不到 exact 课程版本。", 404);
  if (!row.released && !row.candidate) throw new ClassroomError("COURSE_VERSION_NOT_ELIGIBLE", "课程版本既不是 Candidate 也不是 Released。", 409);
  return {
    courseId: requested.courseId,
    revision: requested.revision,
    digest: requested.digest,
    schemaVersion: row.schema_version,
    status: row.released ? "released" : "candidate",
    releasedAt: row.released_at,
    releasedBy: row.released_by,
  };
}

async function validateAccountAssignments(db: ClassroomD1, request: ClassroomFactoryRequest): Promise<void> {
  const ids = [...request.mentorSeats.map((seat) => seat.profileId), ...request.learnerProfileIds, ...request.adminDmProfileIds];
  const unique = [...new Set(ids)];
  const placeholders = unique.map(() => "?").join(",");
  const result = await db.prepare(`SELECT id, role, status FROM auth_users WHERE id IN (${placeholders})`).bind(...unique).all<{ id: string; role: string; status: string }>();
  const users = new Map((result.results ?? []).map((user) => [user.id, user]));
  for (const seat of request.mentorSeats) {
    const user = users.get(seat.profileId);
    if (!user || user.status !== "active" || (user.role !== "mentor" && user.role !== "admin")) throw new ClassroomError("MENTOR_ACCOUNT_INVALID", `${seat.mentorRole} 导师账号不存在、已停用或角色不正确。`, 409);
  }
  for (const profileId of request.learnerProfileIds) {
    const user = users.get(profileId);
    if (!user || user.status !== "active" || user.role !== "learner") throw new ClassroomError("LEARNER_ACCOUNT_INVALID", `学员账号 ${profileId} 不存在、已停用或角色不正确。`, 409);
  }
  for (const [index, profileId] of request.adminDmProfileIds.entries()) {
    const user = users.get(profileId);
    if (!user || user.status !== "active" || (index === 0 ? user.role !== "admin" && user.role !== "mentor" : user.role !== "mentor")) {
      throw new ClassroomError(
        "ADMIN_DM_ACCOUNT_INVALID",
        index === 0 ? "Primary Admin DM 必须是有效的管理员或导师账号。" : "初始 Delegated Admin DM 必须是有效导师账号。",
        409,
      );
    }
  }
}

function requireFactoryCreator(user: AuthenticatedClassroomUser): void {
  if (user.impersonationId) {
    throw new ClassroomError("IMPERSONATION_FACTORY_FORBIDDEN", "测试身份不能创建课堂；请先返回管理员身份。", 403);
  }
  if (user.platformRole !== "admin" && user.platformRole !== "mentor") {
    throw new ClassroomError("FACTORY_CREATOR_REQUIRED", "只有导师或平台管理员可以创建课堂。", 403);
  }
}

type ActiveAdminDmGrant = {
  id: string;
  mode: AdminDmDelegationMode;
  canDelegate: boolean;
};

async function requireAdminDm(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<ActiveAdminDmGrant> {
  if (user.impersonationClassroomId && user.impersonationClassroomId !== roomId) {
    throw new ClassroomError("IMPERSONATION_SCOPE_FORBIDDEN", "测试身份只能访问绑定的 Test Classroom。", 403);
  }
  const row = await db.prepare(
    `SELECT g.id, g.delegation_mode, g.can_delegate, ci.environment
     FROM classroom_admin_dm_grants g
     JOIN classroom_instances ci ON ci.room_id = g.room_id
     WHERE g.room_id = ? AND g.profile_id = ? AND g.revoked_at IS NULL`,
  ).bind(roomId, user.userId).first<{
    id: string;
    delegation_mode: AdminDmDelegationMode;
    can_delegate: number;
    environment: ClassroomEnvironment;
  }>();
  if (!row) throw new ClassroomError("ADMIN_DM_REQUIRED", "此操作需要本课堂 Admin DM 权限。", 403);
  if (user.impersonationId && row.environment !== "test") {
    throw new ClassroomError("IMPERSONATION_PRODUCTION_FORBIDDEN", "测试身份不能进入 Production Classroom。", 403);
  }
  return { id: row.id, mode: row.delegation_mode, canDelegate: Boolean(row.can_delegate) };
}

async function requireAdminDmDelegator(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  grant: ActiveAdminDmGrant,
  action: string,
): Promise<void> {
  if (user.impersonationId || grant.mode !== "primary" || !grant.canDelegate) {
    await denyAdminDmDelegation(db, user, roomId, action, "ADMIN_DM_DELEGATION_REQUIRED");
  }
}

async function denyAdminDmDelegation(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  action: string,
  reason: string,
  targetProfileId?: string,
): Promise<never> {
  const now = new Date().toISOString();
  await factoryEvent(db, roomId, auditActor(user), "membership.admin-dm.denied", withIdentityAudit(user, {
    requestedAction: action,
    reason,
    targetProfileId: targetProfileId ?? null,
  }), now).run();
  const message = reason === "PRIMARY_ADMIN_DM_PROTECTED"
    ? "Primary Admin DM 不能被撤销；课堂必须始终保留主委派人。"
    : reason === "ADMIN_DM_ALREADY_PRIMARY"
      ? "目标账号已经是本课堂 Primary Admin DM，不能改写为 Delegated。"
    : reason === "DELEGATED_DM_MENTOR_REQUIRED"
      ? "Delegated Admin DM 只能授予有效导师账号。"
      : reason === "ADMIN_DM_GRANT_NOT_FOUND"
        ? "目标账号没有可撤销的 Admin DM 权限。"
        : reason === "PRIMARY_RELINQUISH_FORBIDDEN"
          ? "Primary Admin DM 不能自行退出。"
          : "只有 Primary Admin DM 可以授予或撤销 Delegated Admin DM。";
  throw new ClassroomError(reason, message, reason === "ADMIN_DM_GRANT_NOT_FOUND" ? 404 : 403);
}

function auditActor(user: AuthenticatedClassroomUser): string {
  return user.actorProfileId ?? user.userId;
}

function identityAudit(user: AuthenticatedClassroomUser): Record<string, unknown> {
  return {
    actorProfileId: auditActor(user),
    effectiveProfileId: user.effectiveProfileId ?? user.userId,
    impersonationId: user.impersonationId ?? null,
    impersonationClassroomId: user.impersonationClassroomId ?? null,
    impersonationExpiresAt: user.impersonationExpiresAt ?? null,
  };
}

function withIdentityAudit(
  user: AuthenticatedClassroomUser,
  detail: Record<string, unknown>,
): Record<string, unknown> {
  return { ...detail, ...identityAudit(user) };
}

async function requireTestViewTarget(db: ClassroomD1, roomId: string, profileId: string): Promise<void> {
  const target = await db.prepare(
    `SELECT 1 AS value FROM memberships
     WHERE room_id = ? AND profile_id = ? AND status = 'active'
     UNION ALL
     SELECT 1 AS value FROM classroom_admin_dm_grants
     WHERE room_id = ? AND profile_id = ? AND revoked_at IS NULL
     LIMIT 1`,
  ).bind(roomId, profileId, roomId, profileId).first<{ value: number }>();
  if (!target) throw new ClassroomError("TEST_VIEW_MEMBERSHIP_REQUIRED", "测试视角必须属于这个 Test Classroom。", 403);
}

function toExactCoursewareRef(content: CoursewareContent): ExactCoursewareRef {
  return { mentorRole: content.mentorRole, packageId: content.packageId, slug: content.slug, revision: content.revision, digest: content.digest };
}

function assertRunExpectation(roomId: string, actualResetGeneration: number, expected: ClassroomRunExpectation): void {
  const actualRunId = classroomRunId(roomId, actualResetGeneration);
  if (expected.expectedResetGeneration !== actualResetGeneration || expected.expectedRunId !== actualRunId) {
    throw new ClassroomError(
      "CLASSROOM_RUN_CONFLICT",
      "课堂已经进入另一次运行；旧页面不能继续写入，请同步后重试。",
      409,
      [`expected ${expected.expectedRunId || "(missing)"}`, `actual ${actualRunId}`],
    );
  }
}

function assertMutationInput(expectedVersion: number, idempotencyKey: string): void {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new ClassroomError("SUBMISSION_VERSION_INVALID", "作品版本必须是非负整数。", 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) {
    throw new ClassroomError("IDEMPOTENCY_KEY_INVALID", "幂等键格式无效。", 400);
  }
}

function assertFinishMutationInput(expectedScriptVersion: number, idempotencyKey: string): void {
  if (!Number.isInteger(expectedScriptVersion) || expectedScriptVersion < 1) {
    throw new ClassroomError("SCRIPT_VERSION_INVALID", "剧本版本必须是正整数。", 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) {
    throw new ClassroomError("IDEMPOTENCY_KEY_INVALID", "幂等键格式无效。", 400);
  }
}

function assertArchiveMutationInput(input: ArchiveTestClassroomInput): void {
  assertFinishMutationInput(input.expectedScriptVersion, input.idempotencyKey);
  if ((input.reason?.trim().length ?? 0) > 500) {
    throw new ClassroomError("CLASSROOM_ARCHIVE_REASON_INVALID", "归档备注不能超过 500 个字符。", 400);
  }
}

function assertDeleteMutationInput(roomId: string, input: DeleteTestClassroomInput): void {
  assertFinishMutationInput(input.expectedScriptVersion, input.idempotencyKey);
  if (input.expectedRunId !== classroomRunId(roomId, input.expectedResetGeneration)) {
    throw new ClassroomError("CLASSROOM_RUN_CONFLICT", "删除请求不是这个课堂的当前运行，请重新打开删除预览。", 409);
  }
  if (input.confirmClassroomId !== roomId) {
    throw new ClassroomError("CLASSROOM_DELETE_CONFIRMATION_INVALID", "二次确认的 classroomId 与目标实例不一致。", 400);
  }
  if (!/^[0-9a-f]{64}$/.test(input.expectedStateToken)) {
    throw new ClassroomError("CLASSROOM_DELETE_STATE_INVALID", "删除预览状态标识无效，请重新检查影响范围。", 400);
  }
  if ((input.reason?.trim().length ?? 0) > 500) {
    throw new ClassroomError("CLASSROOM_DELETE_REASON_INVALID", "删除备注不能超过 500 个字符。", 400);
  }
}

function mutationAssertion(
  db: ClassroomD1,
  table: "classroom_submission_mutations" | "classroom_script_mutations" | "classroom_reset_mutations" | "classroom_finish_mutations" | "classroom_archives",
  mutationId: string,
  now: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO classroom_atomic_assertions (id, verified_at)
     SELECT CASE WHEN EXISTS (SELECT 1 FROM ${table} WHERE id = ?) THEN 1 ELSE 0 END, ?
     ON CONFLICT(id) DO NOTHING`,
  ).bind(mutationId, now);
}

async function archiveMutationReplay(
  db: ClassroomD1,
  roomId: string,
  actorProfileId: string,
  input: ArchiveTestClassroomInput,
): Promise<ArchiveTestClassroomResult | null> {
  const row = await db.prepare(
    `SELECT reset_generation, script_version, archived_by_profile_id, idempotency_key, reason, archived_at
     FROM classroom_archives WHERE room_id = ?`,
  ).bind(roomId).first<{
    reset_generation: number;
    script_version: number;
    archived_by_profile_id: string;
    idempotency_key: string;
    reason: string;
    archived_at: string;
  }>();
  if (!row) return null;
  const same = row.archived_by_profile_id === actorProfileId
    && row.idempotency_key === input.idempotencyKey
    && row.reset_generation === input.expectedResetGeneration
    && row.script_version === input.expectedScriptVersion
    && row.reason === (input.reason?.trim() ?? "")
    && input.expectedRunId === classroomRunId(roomId, row.reset_generation);
  if (!same) {
    throw new ClassroomError(
      "CLASSROOM_ALREADY_ARCHIVED",
      "这场 Test Classroom 已经归档；历史内容保持只读，不能再次改写归档记录。",
      409,
      [`archivedAt ${row.archived_at}`],
    );
  }
  return {
    archived: true,
    archivedAt: row.archived_at,
    classroomId: roomId,
    idempotent: true,
    restorePolicy: "create-new-test",
  };
}

async function deletionMutationReplay(
  db: ClassroomD1,
  roomId: string,
  actorProfileId: string,
  input: DeleteTestClassroomInput,
): Promise<DeleteTestClassroomResult | null> {
  const row = await db.prepare(
    `SELECT reset_generation, script_version, deleted_by_profile_id, idempotency_key,
            reason, snapshot_json, snapshot_digest, deleted_at
     FROM classroom_deletions WHERE room_id = ?`,
  ).bind(roomId).first<{
    reset_generation: number;
    script_version: number;
    deleted_by_profile_id: string;
    idempotency_key: string;
    reason: string;
    snapshot_json: string;
    snapshot_digest: string;
    deleted_at: string;
  }>();
  if (!row) return null;
  let stateToken = "";
  try {
    const snapshot = JSON.parse(row.snapshot_json) as { stateToken?: unknown };
    if (typeof snapshot.stateToken === "string") stateToken = snapshot.stateToken;
  } catch { /* immutable row validation remains fail-closed below */ }
  const same = row.deleted_by_profile_id === actorProfileId
    && row.idempotency_key === input.idempotencyKey
    && row.reset_generation === input.expectedResetGeneration
    && row.script_version === input.expectedScriptVersion
    && row.reason === (input.reason?.trim() ?? "")
    && stateToken === input.expectedStateToken
    && input.confirmClassroomId === roomId
    && input.expectedRunId === classroomRunId(roomId, row.reset_generation);
  if (!same) {
    throw new ClassroomError(
      "CLASSROOM_ALREADY_DELETED",
      "这场 Test Classroom 已经删除；重复请求没有删除其他课堂。",
      410,
      [`deletedAt ${row.deleted_at}`],
    );
  }
  return {
    deleted: true,
    deletedAt: row.deleted_at,
    classroomId: roomId,
    idempotent: true,
    tombstoneDigest: row.snapshot_digest,
  };
}

async function finishMutationReplay(
  db: ClassroomD1,
  roomId: string,
  actorProfileId: string,
  input: FinishClassroomRunInput,
): Promise<FinishClassroomRunResult | null> {
  const row = await db.prepare(
    `SELECT fm.reset_generation, fm.expected_script_version, fm.idempotency_key, fm.created_at,
            ci.lifecycle, ci.completed_at
     FROM classroom_finish_mutations fm
     JOIN classroom_instances ci ON ci.room_id = fm.room_id
     WHERE fm.room_id = ? AND fm.actor_profile_id = ? AND fm.idempotency_key = ?`,
  ).bind(roomId, actorProfileId, input.idempotencyKey).first<{
    reset_generation: number;
    expected_script_version: number;
    idempotency_key: string;
    created_at: string;
    lifecycle: string;
    completed_at: string | null;
  }>();
  if (!row) return null;
  if (row.reset_generation !== input.expectedResetGeneration
    || row.expected_script_version !== input.expectedScriptVersion
    || input.expectedRunId !== classroomRunId(roomId, row.reset_generation)) {
    throw new ClassroomError(
      "IDEMPOTENCY_KEY_REUSED",
      "这个结束操作幂等键已经用于另一课堂状态；请同步后重新操作。",
      409,
    );
  }
  if (row.lifecycle !== "completed") {
    throw mutationConflict("CLASSROOM_FINISH_CONFLICT", "结束确认已经被接收，但课堂状态尚未一致，请同步后重试。");
  }
  return {
    completed: true,
    completedAt: row.completed_at ?? row.created_at,
    runId: input.expectedRunId,
    resetGeneration: input.expectedResetGeneration,
    idempotent: true,
  };
}

function mutationConflict(code: string, message: string): ClassroomError {
  return new ClassroomError(code, message, 409);
}

function isAtomicAssertionError(error: unknown): boolean {
  return error instanceof Error && /chk_classroom_atomic_assertion|CHECK constraint failed:\s*classroom_atomic_assertions/i.test(error.message);
}

async function mutationDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((part) => part.toString(16).padStart(2, "0")).join("");
}

type SubmissionReplayExpectation = {
  operation: "submit" | "review";
  submissionId: string | null;
  resetGeneration: number;
  expectedVersion: number;
  payloadDigest: string;
  blockId: string;
  kind: string;
};

async function submissionMutationReplay(
  db: ClassroomD1,
  roomId: string,
  profileId: string,
  idempotencyKey: string,
  expected: SubmissionReplayExpectation,
): Promise<SubmissionMutationResult | null> {
  const row = await db.prepare(
    `SELECT submission_id, block_id, kind, reset_generation, operation, expected_version,
            resulting_version, payload_digest
     FROM classroom_submission_mutations
     WHERE room_id = ? AND profile_id = ? AND idempotency_key = ?`,
  ).bind(roomId, profileId, idempotencyKey).first<{
    submission_id: string;
    block_id: string;
    kind: string;
    reset_generation: number;
    operation: "submit" | "review";
    expected_version: number;
    resulting_version: number;
    payload_digest: string;
  }>();
  if (!row) return null;
  const same = row.operation === expected.operation
    && (expected.submissionId === null || row.submission_id === expected.submissionId)
    && row.block_id === expected.blockId
    && row.kind === expected.kind
    && row.reset_generation === expected.resetGeneration
    && row.expected_version === expected.expectedVersion
    && row.payload_digest === expected.payloadDigest;
  if (!same) {
    throw new ClassroomError("IDEMPOTENCY_KEY_REUSED", "同一个幂等键已经用于另一项课堂写入，请同步页面后重试。", 409);
  }
  return {
    submissionId: row.submission_id,
    version: row.resulting_version,
    resetGeneration: row.reset_generation,
    idempotent: true,
  };
}

function factoryEvent(db: ClassroomD1, roomId: string, actor: string, type: string, detail: Record<string, unknown>, now: string): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO classroom_factory_events (id, room_id, type, actor_profile_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), roomId, type, actor, JSON.stringify(detail), now);
}

async function uniqueTeamPublicId(db: ClassroomD1): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const publicId = `TEAM-${[...bytes].map((byte) => TEAM_PUBLIC_ALPHABET[byte % TEAM_PUBLIC_ALPHABET.length]).join("")}`;
    const exists = await db.prepare(`SELECT 1 AS value FROM team_access_ids WHERE public_id = ?`).bind(publicId).first<{ value: number }>();
    if (!exists) return publicId;
  }
  throw new ClassroomError("TEAM_ID_EXHAUSTED", "暂时无法生成队伍 ID，请重试。", 503);
}

export function studioVersionSummary(version: StudioCourseVersion) {
  const policy = resolveLearnerPolicy(version.course);
  return { ref: version.ref, candidate: version.candidate, released: version.released, course: version.course, learnerPolicy: policy };
}
