import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import {
  CLASSROOM_MENTOR_ROLES,
  CLASSROOM_STATE_MACHINE_VERSION,
  assertClassroomFactoryRequest,
  buildClassroomFactoryPlan,
  controllerTransition,
  type ClassroomControllerAction,
  type ClassroomControllerState,
  type ClassroomEnvironment,
  type ClassroomFactoryRequest,
  type ClassroomMentorRole,
  type ExactCoursewareRef,
} from "./classroom-factory";
import { assertCourseCanInstantiate, buildStudioProjection, resolveLearnerPolicy } from "./course-platform";
import {
  loadExactCoursePackage,
  type StudioCourseVersion,
} from "./course-registry";
import { projectCoursePackageToCampaign, type CoursePackageRef } from "./course-package";
import {
  coursewareBundleDigest,
  loadCoursewareExact,
  type CoursewareContent,
} from "./courseware-store";

const TEAM_PUBLIC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ClassroomInstanceSummary = {
  id: string;
  title: string;
  environment: ClassroomEnvironment;
  lifecycle: string;
  learnerCount: number;
  courseRef: CoursePackageRef;
  controller: ClassroomControllerState & { version: number };
  mentorRole: ClassroomMentorRole | null;
  learnerSeat: number | null;
  isAdminDm: boolean;
  updatedAt: string;
};

export type ClassroomInstanceDetail = ClassroomInstanceSummary & {
  viewer: { profileId: string; displayName: string; platformRole: string | null };
  course: { id: string; title: string; period: string; stepNames: string[]; blockCount: number };
  currentBlock: {
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
  myView: ReturnType<typeof buildStudioProjection>["views"][number] | null;
  /** Admin-DM-only projection. Learner responses never receive scripts or gates. */
  controlView: ReturnType<typeof buildStudioProjection>["controllerView"] | null;
  team: { id: string; name: string; publicId: string; seatLimit: number };
  mentors: Array<{ mentorRole: ClassroomMentorRole; profileId: string; displayName: string; courseware: ExactCoursewareRef }>;
  learners: Array<{ profileId: string; displayName: string; seat: number }>;
  admins: Array<{ profileId: string; displayName: string }>;
  courseware: ExactCoursewareRef[];
  submissions: Array<{ profileId: string; displayName: string; kind: string; text: string; status: string; updatedAt: string }>;
  economy: { personalRp: number; personalWalletTenths: number; teamTreasuryTenths: number };
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
  currentBlock: {
    id: string;
    title: string;
    macroStepOrder: number;
    studentPrompt: string;
  };
  controller: {
    blockId: string;
    blockIndex: number;
    state: ClassroomControllerState["state"];
  };
};

type ResolvedCourseRef = CoursePackageRef & { status: "candidate" | "released" };

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
  const course = await loadExactCoursePackage(db, courseRef);
  assertCourseCanInstantiate(course, request.learnerCount);
  await validateAccountAssignments(db, request);
  const trustedCourseware: ExactCoursewareRef[] = [];
  for (const role of CLASSROOM_MENTOR_ROLES) {
    const requested = request.coursewareRefs.find((ref) => ref.mentorRole === role)!;
    const content = await loadCoursewareExact(db, requested.packageId, requested.revision, requested.digest);
    if (content.mentorRole !== role) throw new ClassroomError("COURSEWARE_ROLE_MISMATCH", `${role} 导师课件角色不匹配。`, 409);
    if (request.environment === "production" && !content.released) throw new ClassroomError("COURSEWARE_RELEASE_REQUIRED", `正式课堂的 ${role} 课件必须已发布。`, 409);
    trustedCourseware.push(toExactCoursewareRef(content));
  }

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
  const controller = { ...plan.initialControllerState, updatedAt: now };
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
    ).bind(roomId, controller.stateMachineVersion, controller.blockId, controller.blockIndex, controller.state, controller.attempt, now, now),
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
      seed: `classroom:${roomId}`,
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
  for (const permission of plan.adminPermissions) {
    statements.push(db.prepare(
      `INSERT INTO classroom_permissions (id, room_id, profile_id, permission, granted_by_profile_id, created_at)
       VALUES (?, ?, ?, 'admin-dm', ?, ?)`,
    ).bind(crypto.randomUUID(), roomId, permission.profileId, actor.userId, now));
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
    factoryEvent(db, roomId, actor.userId, "classroom.created", {
      environment: request.environment,
      learnerCount: request.learnerCount,
      courseRef,
      coursewareRefs: trustedCourseware,
      adminDmProfileIds: request.adminDmProfileIds,
    }, now),
  );
  await db.batch(statements);
  return { classroomId: roomId, teamPublicId };
}

export async function listClassroomInstances(db: ClassroomD1, user: AuthenticatedClassroomUser): Promise<ClassroomInstanceSummary[]> {
  const result = await db.prepare(
    `SELECT r.id, r.title, ci.environment, ci.lifecycle, ci.learner_count, ci.course_id, ci.course_revision,
            ci.course_digest, ci.updated_at, cv.schema_version,
            CASE WHEN rp.course_id IS NULL THEN 0 ELSE 1 END AS course_released,
            cs.state_machine_version, cs.block_id, cs.block_index, cs.state, cs.attempt, cs.error_message, cs.version,
            ms.mentor_role, lm.seat AS learner_seat,
            CASE WHEN cp.id IS NULL THEN 0 ELSE 1 END AS is_admin_dm
     FROM rooms r
     JOIN classroom_instances ci ON ci.room_id = r.id
     JOIN course_versions cv ON cv.course_id = ci.course_id AND cv.revision = ci.course_revision AND cv.digest = ci.course_digest
     LEFT JOIN course_release_pointers rp ON rp.course_id = ci.course_id AND rp.revision = ci.course_revision AND rp.digest = ci.course_digest
     JOIN classroom_controller_states cs ON cs.room_id = r.id
     LEFT JOIN classroom_mentor_seats ms ON ms.room_id = r.id AND ms.profile_id = ?
     LEFT JOIN memberships lm ON lm.room_id = r.id AND lm.profile_id = ? AND lm.role = 'learner' AND lm.status = 'active'
     LEFT JOIN classroom_permissions cp ON cp.room_id = r.id AND cp.profile_id = ? AND cp.permission = 'admin-dm'
     WHERE ms.profile_id IS NOT NULL OR lm.profile_id IS NOT NULL OR cp.id IS NOT NULL
     ORDER BY CASE ci.lifecycle WHEN 'running' THEN 0 WHEN 'ready' THEN 1 ELSE 2 END, ci.updated_at DESC`,
  ).bind(user.userId, user.userId, user.userId).all<{
    id: string; title: string; environment: ClassroomEnvironment; lifecycle: string; learner_count: number;
    course_id: string; course_revision: number; course_digest: string; schema_version: number; updated_at: string;
    state_machine_version: 1; block_id: string; block_index: number; state: ClassroomControllerState["state"];
    attempt: number; error_message: string | null; version: number; mentor_role: ClassroomMentorRole | null;
    learner_seat: number | null; is_admin_dm: number; course_released: number;
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
    controller: {
      stateMachineVersion: row.state_machine_version,
      blockId: row.block_id,
      blockIndex: row.block_index,
      state: row.state,
      attempt: row.attempt,
      errorMessage: row.error_message,
      updatedAt: row.updated_at,
      version: row.version,
    },
    mentorRole: row.mentor_role,
    learnerSeat: row.learner_seat,
    isAdminDm: Boolean(row.is_admin_dm),
    updatedAt: row.updated_at,
  }));
}

export async function getClassroomInstance(db: ClassroomD1, user: AuthenticatedClassroomUser, roomId: string): Promise<ClassroomInstanceDetail> {
  const summaries = await listClassroomInstances(db, user);
  const summary = summaries.find((item) => item.id === roomId);
  if (!summary) throw new ClassroomError("CLASSROOM_ACCESS_FORBIDDEN", "你不是这个课堂的成员或 Admin DM。", 403);
  const course = await loadExactCoursePackage(db, summary.courseRef);
  const currentBlock = course.blocks[summary.controller.blockIndex];
  if (!currentBlock || currentBlock.id !== summary.controller.blockId) throw new ClassroomError("CONTROLLER_STATE_CORRUPT", "课堂中控与课程 Block 不一致。", 500);
  const projection = buildStudioProjection(course, {
    learnerCount: summary.learnerCount,
    blockId: currentBlock.id,
    seed: `classroom:${roomId}`,
  });
  const team = await db.prepare(
    `SELECT t.id, t.name, t.seat_limit, a.public_id FROM teams t JOIN team_access_ids a ON a.team_id = t.id WHERE t.room_id = ? ORDER BY t.created_at LIMIT 1`,
  ).bind(roomId).first<{ id: string; name: string; seat_limit: number; public_id: string }>();
  if (!team) throw new ClassroomError("CLASSROOM_TEAM_MISSING", "课堂缺少团队。", 500);
  const mentorRows = await db.prepare(
    `SELECT s.mentor_role, s.profile_id, p.nickname FROM classroom_mentor_seats s JOIN profiles p ON p.id = s.profile_id WHERE s.room_id = ? ORDER BY CASE s.mentor_role WHEN 'P' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END`,
  ).bind(roomId).all<{ mentor_role: ClassroomMentorRole; profile_id: string; nickname: string }>();
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
    `SELECT cp.profile_id, p.nickname FROM classroom_permissions cp JOIN profiles p ON p.id = cp.profile_id
     WHERE cp.room_id = ? AND cp.permission = 'admin-dm' ORDER BY p.nickname`,
  ).bind(roomId).all<{ profile_id: string; nickname: string }>();
  if ((mentorRows.results ?? []).length !== 4 || courseware.length !== 4) {
    throw new ClassroomError("CLASSROOM_MENTOR_BINDING_CORRUPT", "课堂必须保持 P／D／M／O 四个导师席与四套 exact 课件绑定。", 500);
  }
  if ((learnerRows.results ?? []).length !== summary.learnerCount) {
    throw new ClassroomError("CLASSROOM_LEARNER_BINDING_CORRUPT", "课堂学员 Membership 与工厂锁定人数不一致。", 500);
  }
  if (!(adminRows.results ?? []).length) {
    throw new ClassroomError("CLASSROOM_ADMIN_BINDING_CORRUPT", "课堂缺少 Admin DM 权限账号。", 500);
  }
  const balances = await db.prepare(
    `SELECT
       COALESCE((SELECT SUM(points) FROM reputation_entries WHERE profile_id = ? AND room_id = ?), 0) AS rp,
       COALESCE((SELECT balance_tenths FROM classroom_wallet_balances WHERE room_id = ? AND profile_id = ?), 0) AS wallet,
       COALESCE((SELECT balance_tenths FROM ledger_accounts WHERE kind = 'team-treasury' AND room_id = ? LIMIT 1), 0) AS treasury`,
  ).bind(user.userId, roomId, roomId, user.userId, roomId).first<{ rp: number; wallet: number; treasury: number }>();
  let myView: ClassroomInstanceDetail["myView"] = summary.mentorRole
    ? projection.mentorViews.find((view) => view.mentorRole === summary.mentorRole) ?? null
    : summary.learnerSeat
      ? projection.learnerViews[summary.learnerSeat - 1] ?? null
      : projection.controllerView;
  if (summary.learnerSeat && myView?.kind === "learner") {
    const member = (learnerRows.results ?? []).find((row) => row.profile_id === user.userId);
    const grants = member ? await db.prepare(
      `SELECT card_id FROM card_grants WHERE room_id = ? AND chapter_id = ? AND member_id = ? ORDER BY granted_at, id`,
    ).bind(roomId, `${course.course.id}:${currentBlock.macroStepId}`, member.membership_id).all<{ card_id: string }>() : { results: [] };
    const deck = course.decks.find((item) => item.macroStepId === currentBlock.macroStepId);
    const cards = new Map((deck?.cards ?? []).map((card) => [card.id, card]));
    myView = { ...myView, privateCards: (grants.results ?? []).map((grant) => cards.get(grant.card_id)).filter((card): card is NonNullable<typeof card> => Boolean(card)).map((card) => structuredClone(card)) };
  }
  const submissionResult = await db.prepare(
    `SELECT s.profile_id, p.nickname, s.kind, s.payload_json, s.status, s.updated_at
     FROM classroom_block_submissions s JOIN profiles p ON p.id = s.profile_id
     WHERE s.room_id = ? AND s.block_id = ? AND (? = 1 OR s.profile_id = ?)
     ORDER BY s.updated_at`,
  ).bind(roomId, currentBlock.id, summary.isAdminDm || Boolean(summary.mentorRole) ? 1 : 0, user.userId).all<{
    profile_id: string; nickname: string; kind: string; payload_json: string; status: string; updated_at: string;
  }>();
  return {
    ...summary,
    viewer: { profileId: user.userId, displayName: user.displayName, platformRole: user.platformRole ?? null },
    course: {
      id: course.course.id,
      title: course.course.name,
      period: course.course.period,
      stepNames: course.macroSteps.map((step) => step.name),
      blockCount: course.blocks.length,
    },
    currentBlock: {
      id: currentBlock.id,
      title: currentBlock.title,
      macroStepId: currentBlock.macroStepId,
      macroStepOrder: currentBlock.macroStepOrder,
      order: currentBlock.order,
      leadMentorId: currentBlock.leadMentorId,
      studentPrompt: currentBlock.studentPrompt,
      learnerLens: structuredClone(currentBlock.learnerLens),
      gameModes: [...currentBlock.gameModes],
    },
    myView,
    controlView: summary.isAdminDm ? projection.controllerView : null,
    team: { id: team.id, name: team.name, publicId: team.public_id, seatLimit: team.seat_limit },
    mentors: (mentorRows.results ?? []).map((row) => ({
      mentorRole: row.mentor_role,
      profileId: row.profile_id,
      displayName: row.nickname,
      courseware: courseware.find((ref) => ref.mentorRole === row.mentor_role)!,
    })),
    learners: (learnerRows.results ?? []).map((row) => ({ profileId: row.profile_id, displayName: row.nickname, seat: row.seat })),
    admins: (adminRows.results ?? []).map((row) => ({ profileId: row.profile_id, displayName: row.nickname })),
    courseware,
    submissions: (submissionResult.results ?? []).map((row) => {
      let text = "";
      try { const payload = JSON.parse(row.payload_json) as { text?: unknown }; text = typeof payload.text === "string" ? payload.text : ""; } catch { /* fail closed to blank */ }
      return { profileId: row.profile_id, displayName: row.nickname, kind: row.kind, text, status: row.status, updatedAt: row.updated_at };
    }),
    economy: { personalRp: Number(balances?.rp ?? 0), personalWalletTenths: Number(balances?.wallet ?? 0), teamTreasuryTenths: Number(balances?.treasury ?? 0) },
  };
}

export async function getClassroomSharedScreen(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<ClassroomSharedScreenDetail> {
  // Reuse the exact same membership check and current-block integrity guard as
  // the seat UI, then construct an explicit allow-list response.  Never return
  // the detail object and ask the browser to hide fields.
  const detail = await getClassroomInstance(db, user, roomId);
  return {
    id: detail.id,
    title: detail.title,
    environment: detail.environment,
    lifecycle: detail.lifecycle,
    learnerCount: detail.learnerCount,
    course: { title: detail.course.title, blockCount: detail.course.blockCount },
    currentBlock: {
      id: detail.currentBlock.id,
      title: detail.currentBlock.title,
      macroStepOrder: detail.currentBlock.macroStepOrder,
      studentPrompt: detail.currentBlock.studentPrompt,
    },
    controller: {
      blockId: detail.controller.blockId,
      blockIndex: detail.controller.blockIndex,
      state: detail.controller.state,
    },
  };
}

export async function submitClassroomBlockWork(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  input: { kind: string; text: string },
): Promise<void> {
  const detail = await getClassroomInstance(db, user, roomId);
  const kind = input.kind.trim();
  const text = input.text.trim();
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(kind)) throw new ClassroomError("SUBMISSION_KIND_INVALID", "作品类型无效。", 400);
  if (text.length < 2 || text.length > 4_000) throw new ClassroomError("SUBMISSION_TEXT_INVALID", "作品内容需为 2—4000 个字符。", 400);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO classroom_block_submissions
       (id, room_id, block_id, profile_id, kind, payload_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
       ON CONFLICT(room_id, block_id, profile_id, kind) DO UPDATE SET
         payload_json = excluded.payload_json, status = 'submitted', updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), roomId, detail.currentBlock.id, user.userId, kind, JSON.stringify({ text }), now, now),
    factoryEvent(db, roomId, user.userId, "block.submitted", { blockId: detail.currentBlock.id, kind }, now),
  ]);
}

export async function applyControllerAction(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  expectedVersion: number,
  action: ClassroomControllerAction,
): Promise<ClassroomControllerState & { version: number }> {
  await requireAdminDm(db, user.userId, roomId);
  const row = await db.prepare(
    `SELECT cs.*, ci.environment, ci.lifecycle FROM classroom_controller_states cs
     JOIN classroom_instances ci ON ci.room_id = cs.room_id WHERE cs.room_id = ?`,
  ).bind(roomId).first<{
    state_machine_version: 1; block_id: string; block_index: number; state: ClassroomControllerState["state"];
    attempt: number; error_message: string | null; version: number; created_at: string; updated_at: string;
    environment: ClassroomEnvironment; lifecycle: string;
  }>();
  if (!row) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (row.version !== expectedVersion) throw new ClassroomError("CONTROLLER_VERSION_CONFLICT", "中控已被另一位管理员更新，请刷新后重试。", 409);
  const now = new Date().toISOString();
  const current: ClassroomControllerState = {
    stateMachineVersion: row.state_machine_version,
    blockId: row.block_id,
    blockIndex: row.block_index,
    state: row.state,
    attempt: row.attempt,
    errorMessage: row.error_message,
    updatedAt: row.updated_at,
  };
  let next: ClassroomControllerState;
  try { next = controllerTransition(current, action, now); }
  catch (error) { throw new ClassroomError("CONTROLLER_TRANSITION_INVALID", error instanceof Error ? error.message : "中控状态转换无效。", 409); }
  const courseRow = await db.prepare(`SELECT course_id, course_revision, course_digest FROM classroom_instances WHERE room_id = ?`).bind(roomId).first<{ course_id: string; course_revision: number; course_digest: string }>();
  const course = await loadExactCoursePackage(db, { courseId: courseRow!.course_id, revision: courseRow!.course_revision, digest: courseRow!.course_digest });
  if (action.type === "advance") {
    if (current.blockIndex >= course.blocks.length - 1) throw new ClassroomError("USE_COMPLETE", "最后一个 Block 请使用完成课程。", 409);
    next = { ...next, blockId: course.blocks[current.blockIndex + 1].id };
  }
  const changes = await db.prepare(
    `UPDATE classroom_controller_states SET block_id = ?, block_index = ?, state = ?, attempt = ?, error_message = ?,
       version = version + 1, updated_at = ? WHERE room_id = ? AND version = ?`,
  ).bind(next.blockId, next.blockIndex, next.state, next.attempt, next.errorMessage, now, roomId, expectedVersion).run();
  if (Number(changes.meta?.changes ?? 0) !== 1) throw new ClassroomError("CONTROLLER_VERSION_CONFLICT", "中控已被另一位管理员更新，请刷新后重试。", 409);
  const lifecycle = next.state === "completed" ? "completed" : row.lifecycle === "ready" && next.state === "executing" ? "running" : row.lifecycle;
  await db.batch([
    db.prepare(
      `UPDATE classroom_instances SET lifecycle = ?, locked_at = CASE WHEN locked_at IS NULL AND ? = 'running' THEN ? ELSE locked_at END,
       started_at = CASE WHEN started_at IS NULL AND ? = 'running' THEN ? ELSE started_at END,
       completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END, updated_at = ? WHERE room_id = ?`,
    ).bind(lifecycle, lifecycle, now, lifecycle, now, lifecycle, now, now, roomId),
    factoryEvent(db, roomId, user.userId, `controller.${action.type}`, { from: current, to: next }, now),
  ]);
  return { ...next, version: expectedVersion + 1 };
}

export async function resetTestClassroom(db: ClassroomD1, user: AuthenticatedClassroomUser, roomId: string): Promise<void> {
  await requireAdminDm(db, user.userId, roomId);
  const instance = await db.prepare(
    `SELECT environment, course_id, course_revision, course_digest, learner_count
     FROM classroom_instances WHERE room_id = ?`,
  ).bind(roomId).first<{ environment: ClassroomEnvironment; course_id: string; course_revision: number; course_digest: string; learner_count: number }>();
  if (!instance) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  if (instance.environment !== "test") throw new ClassroomError("PRODUCTION_RESET_FORBIDDEN", "正式课堂不能重置。", 403);
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
  const statements: D1PreparedStatement[] = [
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
    db.prepare(`UPDATE classroom_controller_states SET block_id = ?, block_index = 0, state = 'ready', attempt = 1, error_message = NULL, version = version + 1, updated_at = ? WHERE room_id = ?`).bind(course.blocks[0].id, now, roomId),
    db.prepare(`UPDATE classroom_instances SET lifecycle = 'ready', reset_generation = reset_generation + 1, locked_at = NULL, started_at = NULL, completed_at = NULL, updated_at = ? WHERE room_id = ?`).bind(now, roomId),
  ];
  for (const learner of learners.results ?? []) {
    const identityId = campaign.chapters[0].identities[learner.seat - 1]?.id;
    if (!identityId) throw new ClassroomError("CLASSROOM_IDENTITY_CAPACITY", "课程身份数量不足，不能安全重置。", 500);
    statements.push(db.prepare(`UPDATE memberships SET case_identity_id = ? WHERE id = ?`).bind(identityId, learner.id));
  }
  for (const [stepIndex, step] of course.macroSteps.entries()) {
    const projection = buildStudioProjection(course, { learnerCount: instance.learner_count, blockId: step.blocks[0], seed: `classroom:${roomId}` });
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
    factoryEvent(db, roomId, user.userId, "classroom.test-reset", { learnerCount: instance.learner_count }, now),
  );
  await db.batch(statements);
}

export async function acceptTestClassroom(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  checks: Record<string, unknown>,
): Promise<{ receiptId: string; coursewareBundleDigest: string }> {
  await requireAdminDm(db, user.userId, roomId);
  const detail = await getClassroomInstance(db, user, roomId);
  if (detail.environment !== "test") throw new ClassroomError("TEST_CLASSROOM_REQUIRED", "只有 Test Classroom 可以生成验收回执。", 409);
  if (detail.controller.state !== "completed") throw new ClassroomError("TEST_NOT_COMPLETED", "请先用真实课堂 UI 完成全部 Block。", 409);
  const requiredChecks = ["sameRuntimeUi", "pdmoMentors", "learnerPrivacy", "fiveStepCompletion", "exactVersions"] as const;
  const missingChecks = requiredChecks.filter((key) => checks[key] !== true);
  if (missingChecks.length) {
    throw new ClassroomError(
      "TEST_CHECKS_INCOMPLETE",
      `请在真实 Test Classroom 中逐项确认验收：${missingChecks.join("、")}。`,
      409,
    );
  }
  if (detail.mentors.length !== 4 || detail.learners.length !== detail.learnerCount || detail.courseware.length !== 4) {
    throw new ClassroomError("TEST_INSTANCE_INCOMPLETE", "课堂成员或四导师课件绑定不完整，不能签发验收回执。", 409);
  }
  const bundleDigest = await coursewareBundleDigest(detail.courseware);
  const now = new Date().toISOString();
  const proposedReceiptId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO course_test_receipts
     (id, room_id, course_id, revision, digest, courseware_bundle_digest, status, checks_json,
      accepted_at, accepted_by_profile_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'accepted', ?, ?, ?, ?)
     ON CONFLICT(course_id, revision, digest, courseware_bundle_digest, room_id) DO UPDATE SET
       status = 'accepted', checks_json = excluded.checks_json, accepted_at = excluded.accepted_at,
       accepted_by_profile_id = excluded.accepted_by_profile_id`,
  ).bind(proposedReceiptId, roomId, detail.courseRef.courseId, detail.courseRef.revision, detail.courseRef.digest, bundleDigest, JSON.stringify(checks), now, user.userId, now).run();
  // Re-accepting the same exact Test Classroom hits the unique receipt key.
  // SQLite keeps the original primary id on that upsert, so return the id that
  // is actually persisted rather than a fresh id that cannot unlock release.
  const persisted = await db.prepare(
    `SELECT id FROM course_test_receipts
     WHERE course_id = ? AND revision = ? AND digest = ? AND courseware_bundle_digest = ? AND room_id = ?`,
  ).bind(detail.courseRef.courseId, detail.courseRef.revision, detail.courseRef.digest, bundleDigest, roomId).first<{ id: string }>();
  if (!persisted) throw new ClassroomError("TEST_RECEIPT_PERSIST_FAILED", "验收回执未能持久化，请重试。", 500);
  return { receiptId: persisted.id, coursewareBundleDigest: bundleDigest };
}

export async function listCourseTestReceipts(db: ClassroomD1): Promise<Array<Record<string, unknown>>> {
  const result = await db.prepare(
    `SELECT id, room_id, course_id, revision, digest, courseware_bundle_digest, status, checks_json,
            accepted_at, accepted_by_profile_id, created_at
     FROM course_test_receipts ORDER BY created_at DESC LIMIT 100`,
  ).all<Record<string, unknown>>();
  return result.results ?? [];
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

export async function listAssignableClassroomAccounts(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
): Promise<AssignableClassroomAccount[]> {
  await requireAdminDm(db, user.userId, roomId);
  const result = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.role,
            CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS has_membership,
            CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS has_admin_dm
     FROM auth_users u
     LEFT JOIN memberships m ON m.room_id = ? AND m.profile_id = u.id AND m.status = 'active'
     LEFT JOIN classroom_permissions p ON p.room_id = ? AND p.profile_id = u.id AND p.permission = 'admin-dm'
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
  | { type: "revoke-admin-dm"; profileId: string };

export async function updateClassroomMembership(
  db: ClassroomD1,
  user: AuthenticatedClassroomUser,
  roomId: string,
  action: ClassroomMembershipAction,
): Promise<void> {
  await requireAdminDm(db, user.userId, roomId);
  const instance = await db.prepare(`SELECT lifecycle, learner_count FROM classroom_instances WHERE room_id = ?`).bind(roomId).first<{ lifecycle: string; learner_count: number }>();
  if (!instance) throw new ClassroomError("CLASSROOM_NOT_FOUND", "课堂不存在。", 404);
  const profileId = action.profileId.trim();
  if (!profileId || profileId.length > 128) throw new ClassroomError("PROFILE_ID_INVALID", "账号 ID 无效。", 400);
  const account = await db.prepare(`SELECT role, status FROM auth_users WHERE id = ?`).bind(profileId).first<{ role: string; status: string }>();
  if (!account || account.status !== "active") throw new ClassroomError("ACCOUNT_NOT_AVAILABLE", "账号不存在或已停用。", 409);
  const now = new Date().toISOString();

  if (action.type === "grant-admin-dm") {
    if (account.role !== "admin" && account.role !== "mentor") throw new ClassroomError("ADMIN_DM_ACCOUNT_INVALID", "Admin DM 只能授予管理员或导师账号。", 409);
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO classroom_permissions (id, room_id, profile_id, permission, granted_by_profile_id, created_at)
         VALUES (?, ?, ?, 'admin-dm', ?, ?)`,
      ).bind(crypto.randomUUID(), roomId, profileId, user.userId, now),
      db.prepare(
        `INSERT OR IGNORE INTO classroom_wallet_balances (room_id, profile_id, balance_tenths, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?)`,
      ).bind(roomId, profileId, now, now),
      factoryEvent(db, roomId, user.userId, "membership.admin-dm.granted", { profileId }, now),
    ]);
    return;
  }
  if (action.type === "revoke-admin-dm") {
    const count = await db.prepare(`SELECT COUNT(*) AS value FROM classroom_permissions WHERE room_id = ? AND permission = 'admin-dm'`).bind(roomId).first<{ value: number }>();
    if (Number(count?.value ?? 0) <= 1) throw new ClassroomError("LAST_ADMIN_DM", "课堂必须保留至少一个 Admin DM。", 409);
    if (profileId === user.userId) throw new ClassroomError("SELF_ADMIN_DM_REVOKE", "请让另一位 Admin DM 撤销你的权限，避免误锁课堂。", 409);
    await db.batch([
      db.prepare(`DELETE FROM classroom_permissions WHERE room_id = ? AND profile_id = ? AND permission = 'admin-dm'`).bind(roomId, profileId),
      factoryEvent(db, roomId, user.userId, "membership.admin-dm.revoked", { profileId }, now),
    ]);
    return;
  }

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
      factoryEvent(db, roomId, user.userId, "membership.learner.replaced", { seat: action.seat, fromProfileId: membership.profile_id, toProfileId: profileId }, now),
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
    factoryEvent(db, roomId, user.userId, "membership.mentor.replaced", { mentorRole: action.mentorRole, fromProfileId: mentor.profile_id, toProfileId: profileId }, now),
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
  for (const profileId of request.adminDmProfileIds) {
    const user = users.get(profileId);
    if (!user || user.status !== "active" || (user.role !== "admin" && user.role !== "mentor")) throw new ClassroomError("ADMIN_DM_ACCOUNT_INVALID", "Admin DM 必须是有效的管理员或导师账号。", 409);
  }
}

function requireFactoryCreator(user: AuthenticatedClassroomUser): void {
  if (user.platformRole !== "admin" && user.platformRole !== "mentor") {
    throw new ClassroomError("FACTORY_CREATOR_REQUIRED", "只有导师或平台管理员可以创建课堂。", 403);
  }
}

async function requireAdminDm(db: ClassroomD1, profileId: string, roomId: string): Promise<void> {
  const row = await db.prepare(`SELECT id FROM classroom_permissions WHERE room_id = ? AND profile_id = ? AND permission = 'admin-dm'`).bind(roomId, profileId).first<{ id: string }>();
  if (!row) throw new ClassroomError("ADMIN_DM_REQUIRED", "此操作需要本课堂 Admin DM 权限。", 403);
}

function toExactCoursewareRef(content: CoursewareContent): ExactCoursewareRef {
  return { mentorRole: content.mentorRole, packageId: content.packageId, slug: content.slug, revision: content.revision, digest: content.digest };
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
