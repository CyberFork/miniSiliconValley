import type { ClassroomD1 } from "../../db";
import { ClassroomError } from "./classroom-errors";
import { CLASSROOM_MENTOR_ROLES, CLASSROOM_STATE_MACHINE_VERSION, type ExactCoursewareRef } from "./classroom-factory";
import { coursePackageDigest, validateCoursePackage, type CoursePackageRef } from "./course-package";
import { buildStudioProjection, resolveLearnerPolicy, validateCourseInstantiation } from "./course-platform";
import { coursewareBundleDigest } from "./courseware-store";
import { MSV_APP_BUILD_ID, MSV_SOURCE_COMMIT } from "./build-identity";
import {
  CLASSROOM_RUNTIME_CONTRACT_VERSION,
  COURSE_PROJECTOR_CONTRACT_VERSION,
  UI_ACCEPTANCE_REQUIRED_CHECKS,
} from "./course-acceptance-contract";

/** @deprecated Use COURSE_PROJECTOR_CONTRACT_VERSION for new code. */
export const COURSE_PROJECTOR_VERSION = COURSE_PROJECTOR_CONTRACT_VERSION;
export const COURSE_ACCEPTANCE_APP_BUILD_ID = MSV_APP_BUILD_ID;
export const COURSE_ACCEPTANCE_SOURCE_COMMIT = MSV_SOURCE_COMMIT;
export const COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION = 2;
export { CLASSROOM_RUNTIME_CONTRACT_VERSION, COURSE_PROJECTOR_CONTRACT_VERSION, UI_ACCEPTANCE_REQUIRED_CHECKS };

type ExactCourseRef = Pick<CoursePackageRef, "courseId" | "revision" | "digest">;

export type ViewAcceptanceScenario = {
  learnerCount: number;
  seed: string;
  blockIds: string[];
  result: "passed";
};

export type ViewAcceptanceReceipt = {
  receiptId: string;
  schemaVersion: number;
  courseRef: ExactCourseRef;
  status: "accepted" | "rejected";
  scenarios: ViewAcceptanceScenario[];
  checks: Record<string, boolean>;
  projectorVersion: string;
  sourceCommit: string;
  appBuildId: string;
  reviewerProfileId: string;
  acceptedAt: string;
  valid: boolean;
  invalidReasons: string[];
};

export type UiAcceptanceClient = {
  browser: string;
  viewport: { width: number; height: number };
  platform?: string;
};

export type UiAcceptanceReceipt = {
  receiptId: string;
  schemaVersion: number;
  roomId: string;
  viewReceiptId: string;
  courseRef: ExactCourseRef;
  learnerCount: number;
  dealSeed: string;
  resetGeneration: number;
  stateMachineVersion: number;
  coursewareBundleDigest: string;
  coursewareRefs: ExactCoursewareRef[];
  mentorMemberships: Array<{ mentorRole: string; membershipId: string; profileId: string }>;
  learnerMemberships: Array<{ seat: number; membershipId: string; profileId: string }>;
  adminDmProfileIds: string[];
  checks: Record<string, boolean>;
  clientMatrix: UiAcceptanceClient[];
  runtimeContractVersion: string;
  sourceCommit: string;
  appBuildId: string;
  auditSummary: Record<string, unknown>;
  status: "accepted" | "rejected";
  acceptedAt: string;
  acceptedByProfileId: string;
  valid: boolean;
  invalidReasons: string[];
};

export type AcceptanceClassroomSummary = {
  roomId: string;
  title: string;
  environment: "test" | "production";
  lifecycle: string;
  courseRef: ExactCourseRef;
  learnerCount: number;
  viewReceiptId: string;
  uiReceiptId: string | null;
  updatedAt: string;
  archivedAt: string | null;
};

/**
 * The Studio bootstrap is an index, not an acceptance-receipt export API.
 * These projections intentionally omit reviewer/member profile IDs, deal
 * seeds, per-client details, checks and audit payloads.
 */
export type StudioViewAcceptanceSummary = Pick<
  ViewAcceptanceReceipt,
  | "receiptId"
  | "courseRef"
  | "status"
  | "projectorVersion"
  | "sourceCommit"
  | "appBuildId"
  | "acceptedAt"
  | "valid"
  | "invalidReasons"
>;

export type StudioUiAcceptanceSummary = Pick<
  UiAcceptanceReceipt,
  | "receiptId"
  | "viewReceiptId"
  | "courseRef"
  | "learnerCount"
  | "coursewareRefs"
  | "runtimeContractVersion"
  | "sourceCommit"
  | "appBuildId"
  | "status"
  | "acceptedAt"
  | "valid"
  | "invalidReasons"
>;

export type StudioAcceptanceViewer = {
  userId: string;
  platformRole: "admin" | "mentor";
};

type ViewReceiptRow = {
  id: string;
  receipt_schema_version: number;
  course_id: string;
  revision: number;
  digest: string;
  status: "accepted" | "rejected";
  scenarios_json: string;
  checks_json: string;
  projector_version: string;
  app_build_id: string;
  identity_projector_contract_version?: string | null;
  identity_runtime_contract_version?: string | null;
  identity_source_commit?: string | null;
  identity_app_build_id?: string | null;
  reviewer_profile_id: string;
  accepted_at: string;
  pointer_current?: number;
};

type UiReceiptRow = {
  id: string;
  receipt_schema_version: number;
  room_id: string;
  view_receipt_id: string;
  course_id: string;
  revision: number;
  digest: string;
  learner_count: number;
  deal_seed: string;
  reset_generation: number;
  state_machine_version: number;
  courseware_bundle_digest: string;
  courseware_refs_json: string;
  mentor_memberships_json: string;
  learner_memberships_json: string;
  admin_dm_json: string;
  checks_json: string;
  client_matrix_json: string;
  app_build_id: string;
  identity_projector_contract_version?: string | null;
  identity_runtime_contract_version?: string | null;
  identity_source_commit?: string | null;
  identity_app_build_id?: string | null;
  audit_summary_json: string;
  status: "accepted" | "rejected";
  accepted_at: string;
  accepted_by_profile_id: string;
  current_reset_generation?: number;
  classroom_lifecycle?: string;
  classroom_archived_at?: string | null;
};

export function acceptanceLearnerCounts(course: ReturnType<typeof validateCoursePackage>): number[] {
  const policy = resolveLearnerPolicy(course);
  return Array.from({ length: policy.maxCount - policy.minCount + 1 }, (_, index) => policy.minCount + index);
}

export async function createViewAcceptanceReceipt(
  db: ClassroomD1,
  input: { courseRef: ExactCourseRef; reviewedBlockIds: string[]; reviewedLearnerCounts: number[] },
  reviewerProfileId: string,
): Promise<ViewAcceptanceReceipt> {
  const course = await loadEligibleExactCourse(db, input.courseRef);
  const blockIds = course.blocks.map((block) => block.id);
  const learnerCounts = acceptanceLearnerCounts(course);
  const reviewedBlocks = new Set(input.reviewedBlockIds);
  const reviewedCounts = new Set(input.reviewedLearnerCounts);
  const missingBlocks = blockIds.filter((blockId) => !reviewedBlocks.has(blockId));
  const missingCounts = learnerCounts.filter((count) => !reviewedCounts.has(count));
  if (missingBlocks.length || missingCounts.length) {
    throw new ClassroomError(
      "VIEW_ACCEPTANCE_REVIEW_INCOMPLETE",
      "请先亲自查看全部 Block 和课程声明支持的全部学员人数，再确认视图验收。",
      409,
      [
        ...(missingBlocks.length ? [`未查看 Block：${missingBlocks.join("、")}`] : []),
        ...(missingCounts.length ? [`未查看人数：${missingCounts.join("、")}`] : []),
      ],
    );
  }
  if (course.macroSteps.length !== 5 || course.blocks.length === 0) {
    throw new ClassroomError("VIEW_ACCEPTANCE_STRUCTURE_INVALID", "课程必须包含完整五大步与至少一个 Block。", 409);
  }

  const scenarios: ViewAcceptanceScenario[] = [];
  let pdmoProjection = true;
  let learnerTaskProjection = true;
  let controllerProjection = true;
  let privateCardAssignment = true;
  let uniqueDealRule = true;
  for (const learnerCount of learnerCounts) {
    const capacity = validateCourseInstantiation(course, learnerCount);
    if (!capacity.ok) {
      throw new ClassroomError(
        "VIEW_ACCEPTANCE_CAPACITY_INVALID",
        `${learnerCount} 人视图不能通过课程容量校验。`,
        409,
        capacity.issues.map((issue) => issue.message),
      );
    }
    const seed = `view-acceptance-${learnerCount}`;
    for (const blockId of blockIds) {
      const projection = buildStudioProjection(course, { learnerCount, blockId, seed });
      pdmoProjection &&= projection.mentorViews.length === 4
        && new Set(projection.mentorViews.map((view) => view.mentorRole)).size === 4;
      learnerTaskProjection &&= projection.learnerViews.length === learnerCount
        && projection.learnerViews.every((view) => Boolean(view.task.trim()));
      controllerProjection &&= projection.controllerView.blockId === blockId
        && projection.views.at(-1)?.kind === "controller";
      privateCardAssignment &&= projection.learnerViews.every((view) => view.privateCards.length === resolveLearnerPolicy(course).cardsPerLearner);
      if (resolveLearnerPolicy(course).dealPolicy === "unique-within-step") {
        const ids = projection.learnerViews.flatMap((view) => view.privateCards.map((card) => card.id));
        uniqueDealRule &&= ids.length === new Set(ids).size;
      }
    }
    scenarios.push({ learnerCount, seed, blockIds: [...blockIds], result: "passed" });
  }
  const checks = {
    fiveMacroSteps: course.macroSteps.length === 5,
    allBlocksReviewed: true,
    pdmoProjection,
    learnerTaskProjection,
    controllerProjection,
    cardCapacity: true,
    uniqueDealRule,
    privateCardAssignment,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new ClassroomError("VIEW_ACCEPTANCE_CHECK_FAILED", "共享投影器没有通过全部视图验收项。", 409, failed);

  const now = new Date().toISOString();
  const proposedId = crypto.randomUUID();
  await db.batch([
    db.prepare(
    `INSERT OR IGNORE INTO course_view_acceptance_receipts
     (id, receipt_schema_version, course_id, revision, digest, status, scenarios_json, checks_json,
      projector_version, app_build_id, reviewer_profile_id, accepted_at, created_at)
     SELECT ?, ?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM course_candidate_pointers
       WHERE course_id = ? AND revision = ? AND digest = ?
       UNION ALL
       SELECT 1 FROM course_release_pointers
       WHERE course_id = ? AND revision = ? AND digest = ?
     )`,
  ).bind(
    proposedId,
    COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION,
    input.courseRef.courseId,
    input.courseRef.revision,
    input.courseRef.digest,
    JSON.stringify(scenarios),
    JSON.stringify(checks),
    COURSE_PROJECTOR_VERSION,
    COURSE_ACCEPTANCE_APP_BUILD_ID,
    reviewerProfileId,
    now,
    now,
    input.courseRef.courseId,
    input.courseRef.revision,
    input.courseRef.digest,
    input.courseRef.courseId,
    input.courseRef.revision,
    input.courseRef.digest,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO course_acceptance_build_identities
       (receipt_id, receipt_kind, projector_contract_version, runtime_contract_version,
        source_commit, app_build_id, created_at)
       SELECT r.id, 'view', ?, 'not-applicable', ?, ?, ?
       FROM course_view_acceptance_receipts r
       WHERE r.course_id = ? AND r.revision = ? AND r.digest = ?
         AND r.projector_version = ? AND r.app_build_id = ?`,
    ).bind(
      COURSE_PROJECTOR_CONTRACT_VERSION,
      COURSE_ACCEPTANCE_SOURCE_COMMIT,
      COURSE_ACCEPTANCE_APP_BUILD_ID,
      now,
      input.courseRef.courseId,
      input.courseRef.revision,
      input.courseRef.digest,
      COURSE_PROJECTOR_VERSION,
      COURSE_ACCEPTANCE_APP_BUILD_ID,
    ),
  ]);
  const row = await db.prepare(
    `SELECT r.*,
            ai.projector_contract_version AS identity_projector_contract_version,
            ai.runtime_contract_version AS identity_runtime_contract_version,
            ai.source_commit AS identity_source_commit,
            ai.app_build_id AS identity_app_build_id,
            CASE WHEN cp.course_id IS NOT NULL OR rp.course_id IS NOT NULL THEN 1 ELSE 0 END AS pointer_current
     FROM course_view_acceptance_receipts r
     LEFT JOIN course_acceptance_build_identities ai ON ai.receipt_id = r.id AND ai.receipt_kind = 'view'
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = r.course_id AND cp.revision = r.revision AND cp.digest = r.digest
     LEFT JOIN course_release_pointers rp ON rp.course_id = r.course_id AND rp.revision = r.revision AND rp.digest = r.digest
     WHERE r.course_id = ? AND r.revision = ? AND r.digest = ? AND r.projector_version = ? AND r.app_build_id = ?`,
  ).bind(input.courseRef.courseId, input.courseRef.revision, input.courseRef.digest, COURSE_PROJECTOR_VERSION, COURSE_ACCEPTANCE_APP_BUILD_ID).first<ViewReceiptRow>();
  if (!row) throw new ClassroomError("VIEW_ACCEPTANCE_VERSION_CHANGED", "课程版本在验收过程中发生变化，请打开当前 Candidate 重新验收。", 409);
  const receipt = mapViewReceipt(row);
  if (!receipt.valid) {
    throw new ClassroomError("VIEW_ACCEPTANCE_VERSION_CHANGED", "课程版本在验收过程中发生变化，请打开当前 Candidate 重新验收。", 409, receipt.invalidReasons);
  }
  return receipt;
}

export async function listViewAcceptanceReceipts(db: ClassroomD1): Promise<ViewAcceptanceReceipt[]> {
  const rows = await db.prepare(
    `SELECT r.*,
            ai.projector_contract_version AS identity_projector_contract_version,
            ai.runtime_contract_version AS identity_runtime_contract_version,
            ai.source_commit AS identity_source_commit,
            ai.app_build_id AS identity_app_build_id,
            CASE WHEN cp.course_id IS NOT NULL OR rp.course_id IS NOT NULL THEN 1 ELSE 0 END AS pointer_current
     FROM course_view_acceptance_receipts r
     LEFT JOIN course_acceptance_build_identities ai ON ai.receipt_id = r.id AND ai.receipt_kind = 'view'
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = r.course_id AND cp.revision = r.revision AND cp.digest = r.digest
     LEFT JOIN course_release_pointers rp ON rp.course_id = r.course_id AND rp.revision = r.revision AND rp.digest = r.digest
     ORDER BY r.created_at DESC LIMIT 200`,
  ).all<ViewReceiptRow>();
  return (rows.results ?? []).map(mapViewReceipt);
}

export async function requireValidViewAcceptanceReceipt(
  db: ClassroomD1,
  ref: ExactCourseRef,
  receiptId: string,
): Promise<ViewAcceptanceReceipt> {
  const row = await db.prepare(
    `SELECT r.*,
            ai.projector_contract_version AS identity_projector_contract_version,
            ai.runtime_contract_version AS identity_runtime_contract_version,
            ai.source_commit AS identity_source_commit,
            ai.app_build_id AS identity_app_build_id,
            CASE WHEN cp.course_id IS NOT NULL OR rp.course_id IS NOT NULL THEN 1 ELSE 0 END AS pointer_current
     FROM course_view_acceptance_receipts r
     LEFT JOIN course_acceptance_build_identities ai ON ai.receipt_id = r.id AND ai.receipt_kind = 'view'
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = r.course_id AND cp.revision = r.revision AND cp.digest = r.digest
     LEFT JOIN course_release_pointers rp ON rp.course_id = r.course_id AND rp.revision = r.revision AND rp.digest = r.digest
     WHERE r.id = ?`,
  ).bind(receiptId).first<ViewReceiptRow>();
  const receipt = row ? mapViewReceipt(row) : null;
  if (!receipt || !sameCourseRef(receipt.courseRef, ref) || !receipt.valid) {
    throw new ClassroomError(
      "VIEW_ACCEPTANCE_RECEIPT_INVALID",
      "多角色视图验收回执缺失、已失效，或没有绑定这个 exact 课程版本。",
      409,
      receipt?.invalidReasons,
    );
  }
  return receipt;
}

export async function recordUiAcceptanceReceipt(
  db: ClassroomD1,
  input: {
    roomId: string;
    viewReceiptId: string;
    courseRef: ExactCourseRef;
    learnerCount: number;
    dealSeed: string;
    resetGeneration: number;
    stateMachineVersion: number;
    coursewareRefs: ExactCoursewareRef[];
    mentorMemberships: Array<{ mentorRole: string; membershipId: string; profileId: string }>;
    learnerMemberships: Array<{ seat: number; membershipId: string; profileId: string }>;
    adminDmProfileIds: string[];
    checks: Record<string, boolean>;
    clientMatrix: UiAcceptanceClient[];
    auditSummary: Record<string, unknown>;
  },
  acceptedByProfileId: string,
): Promise<UiAcceptanceReceipt> {
  await requireValidViewAcceptanceReceipt(db, input.courseRef, input.viewReceiptId);
  const missingChecks = UI_ACCEPTANCE_REQUIRED_CHECKS.filter((key) => input.checks[key] !== true);
  if (missingChecks.length) {
    throw new ClassroomError("UI_ACCEPTANCE_CHECKS_INCOMPLETE", `请逐项确认真实课堂 UI 验收：${missingChecks.join("、")}。`, 409, missingChecks);
  }
  if (input.stateMachineVersion !== CLASSROOM_STATE_MACHINE_VERSION) {
    throw new ClassroomError("UI_ACCEPTANCE_STATE_MACHINE_STALE", "课堂状态机版本已变化，请重新创建 Test Classroom 验收。", 409);
  }
  const clientMatrix = validateClientMatrix(input.clientMatrix);
  const coursewareRefs = orderCourseware(input.coursewareRefs);
  const coursewareDigest = await coursewareBundleDigest(coursewareRefs);
  const now = new Date().toISOString();
  const proposedId = crypto.randomUUID();
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO course_ui_acceptance_receipts
       (id, receipt_schema_version, room_id, view_receipt_id, course_id, revision, digest, learner_count,
        deal_seed, reset_generation, state_machine_version, courseware_bundle_digest, courseware_refs_json,
        mentor_memberships_json, learner_memberships_json, admin_dm_json, checks_json, client_matrix_json,
        app_build_id, audit_summary_json,
        status, accepted_at, accepted_by_profile_id, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?, ?, ?
       FROM classroom_instances ci
       JOIN classroom_acceptance_bindings binding ON binding.room_id = ci.room_id
       WHERE ci.room_id = ? AND ci.environment = 'test' AND ci.lifecycle = 'completed'
         AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)
         AND ci.reset_generation = ? AND ci.state_machine_version = ? AND binding.view_receipt_id = ?`,
    ).bind(
      proposedId,
      COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION,
      input.roomId,
      input.viewReceiptId,
      input.courseRef.courseId,
      input.courseRef.revision,
      input.courseRef.digest,
      input.learnerCount,
      input.dealSeed,
      input.resetGeneration,
      input.stateMachineVersion,
      coursewareDigest,
      JSON.stringify(coursewareRefs),
      JSON.stringify(input.mentorMemberships),
      JSON.stringify(input.learnerMemberships),
      JSON.stringify(input.adminDmProfileIds),
      JSON.stringify(input.checks),
      JSON.stringify(clientMatrix),
      COURSE_ACCEPTANCE_APP_BUILD_ID,
      JSON.stringify(input.auditSummary),
      now,
      acceptedByProfileId,
      now,
      input.roomId,
      input.resetGeneration,
      input.stateMachineVersion,
      input.viewReceiptId,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO course_acceptance_build_identities
       (receipt_id, receipt_kind, projector_contract_version, runtime_contract_version,
        source_commit, app_build_id, created_at)
       SELECT r.id, 'ui', ?, ?, ?, ?, ?
       FROM course_ui_acceptance_receipts r
       WHERE r.room_id = ? AND r.reset_generation = ? AND r.course_id = ? AND r.revision = ? AND r.digest = ?
         AND r.courseware_bundle_digest = ? AND r.app_build_id = ?`,
    ).bind(
      COURSE_PROJECTOR_CONTRACT_VERSION,
      CLASSROOM_RUNTIME_CONTRACT_VERSION,
      COURSE_ACCEPTANCE_SOURCE_COMMIT,
      COURSE_ACCEPTANCE_APP_BUILD_ID,
      now,
      input.roomId,
      input.resetGeneration,
      input.courseRef.courseId,
      input.courseRef.revision,
      input.courseRef.digest,
      coursewareDigest,
      COURSE_ACCEPTANCE_APP_BUILD_ID,
    ),
    db.prepare(
      `UPDATE classroom_acceptance_bindings
       SET ui_receipt_id = (
         SELECT id FROM course_ui_acceptance_receipts
         WHERE room_id = ? AND reset_generation = ? AND course_id = ? AND revision = ? AND digest = ?
           AND courseware_bundle_digest = ? AND app_build_id = ?
       )
       WHERE room_id = ? AND view_receipt_id = ?
         AND EXISTS (
           SELECT 1 FROM classroom_instances ci
           WHERE ci.room_id = ? AND ci.environment = 'test' AND ci.lifecycle = 'completed'
             AND NOT EXISTS (SELECT 1 FROM classroom_archives ca WHERE ca.room_id = ci.room_id)
             AND ci.reset_generation = ? AND ci.state_machine_version = ?
         )`,
    ).bind(
      input.roomId,
      input.resetGeneration,
      input.courseRef.courseId,
      input.courseRef.revision,
      input.courseRef.digest,
      coursewareDigest,
      COURSE_ACCEPTANCE_APP_BUILD_ID,
      input.roomId,
      input.viewReceiptId,
      input.roomId,
      input.resetGeneration,
      input.stateMachineVersion,
    ),
  ]);
  const row = await db.prepare(
    `SELECT r.*, ci.reset_generation AS current_reset_generation, ci.lifecycle AS classroom_lifecycle,
            ca.archived_at AS classroom_archived_at,
            ai.projector_contract_version AS identity_projector_contract_version,
            ai.runtime_contract_version AS identity_runtime_contract_version,
            ai.source_commit AS identity_source_commit,
            ai.app_build_id AS identity_app_build_id
     FROM course_ui_acceptance_receipts r
     JOIN classroom_instances ci ON ci.room_id = r.room_id
     LEFT JOIN classroom_archives ca ON ca.room_id = ci.room_id
     LEFT JOIN course_acceptance_build_identities ai ON ai.receipt_id = r.id AND ai.receipt_kind = 'ui'
     WHERE r.room_id = ? AND r.reset_generation = ? AND r.course_id = ? AND r.revision = ? AND r.digest = ?
       AND r.courseware_bundle_digest = ? AND r.app_build_id = ?`,
  ).bind(input.roomId, input.resetGeneration, input.courseRef.courseId, input.courseRef.revision, input.courseRef.digest, coursewareDigest, COURSE_ACCEPTANCE_APP_BUILD_ID).first<UiReceiptRow>();
  if (!row) throw new ClassroomError("UI_ACCEPTANCE_INSTANCE_CHANGED", "Test Classroom 在签发过程中发生重置或状态变化，请重新完成真实 UI 验收。", 409);
  const receipt = mapUiReceipt(row, true);
  if (!receipt.valid) {
    throw new ClassroomError("UI_ACCEPTANCE_INSTANCE_CHANGED", "Test Classroom 在签发过程中发生重置或状态变化，请重新完成真实 UI 验收。", 409, receipt.invalidReasons);
  }
  return receipt;
}

export async function listUiAcceptanceReceipts(
  db: ClassroomD1,
  viewer: StudioAcceptanceViewer,
): Promise<UiAcceptanceReceipt[]> {
  assertStudioAcceptanceViewer(viewer);
  const mentorScope = viewer.platformRole === "mentor"
    ? `WHERE (
         EXISTS (
           SELECT 1 FROM memberships scope_membership
           WHERE scope_membership.room_id = ci.room_id
             AND scope_membership.profile_id = ?
             AND scope_membership.status = 'active'
         )
         OR EXISTS (
           SELECT 1 FROM classroom_admin_dm_grants scope_grant
           WHERE scope_grant.room_id = ci.room_id
             AND scope_grant.profile_id = ?
             AND scope_grant.revoked_at IS NULL
         )
       )`
    : "";
  const rows = await db.prepare(
    `SELECT r.*, ci.reset_generation AS current_reset_generation, ci.lifecycle AS classroom_lifecycle,
            ca.archived_at AS classroom_archived_at,
            ai.projector_contract_version AS identity_projector_contract_version,
            ai.runtime_contract_version AS identity_runtime_contract_version,
            ai.source_commit AS identity_source_commit,
            ai.app_build_id AS identity_app_build_id
     FROM course_ui_acceptance_receipts r
     JOIN classroom_instances ci ON ci.room_id = r.room_id
     LEFT JOIN classroom_archives ca ON ca.room_id = ci.room_id
     LEFT JOIN course_acceptance_build_identities ai ON ai.receipt_id = r.id AND ai.receipt_kind = 'ui'
     ${mentorScope}
     ORDER BY r.created_at DESC LIMIT 200`,
  ).bind(...(viewer.platformRole === "mentor" ? [viewer.userId, viewer.userId] : [])).all<UiReceiptRow>();
  const result: UiAcceptanceReceipt[] = [];
  for (const row of rows.results ?? []) {
    const viewValid = await isViewReceiptCurrentlyValid(db, row.view_receipt_id, {
      courseId: row.course_id,
      revision: row.revision,
      digest: row.digest,
    });
    result.push(mapUiReceipt(row, viewValid));
  }
  return result;
}

export async function requireValidUiAcceptanceReceipt(
  db: ClassroomD1,
  ref: ExactCourseRef,
  receiptId: string,
  viewReceiptId: string,
  coursewareRefs?: ExactCoursewareRef[],
): Promise<UiAcceptanceReceipt> {
  const row = await db.prepare(
    `SELECT r.*, ci.reset_generation AS current_reset_generation, ci.lifecycle AS classroom_lifecycle,
            ca.archived_at AS classroom_archived_at,
            ai.projector_contract_version AS identity_projector_contract_version,
            ai.runtime_contract_version AS identity_runtime_contract_version,
            ai.source_commit AS identity_source_commit,
            ai.app_build_id AS identity_app_build_id
     FROM course_ui_acceptance_receipts r
     JOIN classroom_instances ci ON ci.room_id = r.room_id
     LEFT JOIN classroom_archives ca ON ca.room_id = ci.room_id
     LEFT JOIN course_acceptance_build_identities ai ON ai.receipt_id = r.id AND ai.receipt_kind = 'ui'
     WHERE r.id = ?`,
  ).bind(receiptId).first<UiReceiptRow>();
  const viewValid = row ? await isViewReceiptCurrentlyValid(db, row.view_receipt_id, ref) : false;
  const receipt = row ? mapUiReceipt(row, viewValid) : null;
  const expectedBundle = coursewareRefs ? await coursewareBundleDigest(orderCourseware(coursewareRefs)) : null;
  const mismatchReasons = [
    ...(receipt?.invalidReasons ?? []),
    ...(!receipt ? ["找不到这张 UI 验收回执"] : []),
    ...(receipt && !sameCourseRef(receipt.courseRef, ref) ? ["回执绑定了其他课程 revision／digest"] : []),
    ...(receipt && receipt.viewReceiptId !== viewReceiptId ? ["回执绑定了其他 ViewAcceptanceReceipt"] : []),
    ...(receipt && expectedBundle !== null && receipt.coursewareBundleDigest !== expectedBundle ? [
      `课件包 digest 不匹配：验收 ${receipt.coursewareBundleDigest}，请求 ${expectedBundle}`,
    ] : []),
  ];
  if (
    !receipt || !sameCourseRef(receipt.courseRef, ref) || receipt.viewReceiptId !== viewReceiptId || !receipt.valid
    || (expectedBundle !== null && receipt.coursewareBundleDigest !== expectedBundle)
  ) {
    throw new ClassroomError(
      "UI_ACCEPTANCE_RECEIPT_INVALID",
      "真实课堂 UI 验收回执缺失、已失效，或没有绑定相同的课程／课件 exact 版本。",
      409,
      mismatchReasons,
    );
  }
  return receipt;
}

export async function listAcceptanceClassrooms(
  db: ClassroomD1,
  viewer: StudioAcceptanceViewer,
): Promise<AcceptanceClassroomSummary[]> {
  assertStudioAcceptanceViewer(viewer);
  const mentorScope = viewer.platformRole === "mentor"
    ? `WHERE (
         EXISTS (
           SELECT 1 FROM memberships scope_membership
           WHERE scope_membership.room_id = ci.room_id
             AND scope_membership.profile_id = ?
             AND scope_membership.status = 'active'
         )
         OR EXISTS (
           SELECT 1 FROM classroom_admin_dm_grants scope_grant
           WHERE scope_grant.room_id = ci.room_id
             AND scope_grant.profile_id = ?
             AND scope_grant.revoked_at IS NULL
         )
       )`
    : "";
  const rows = await db.prepare(
    `SELECT r.id, r.title, ci.environment, ci.lifecycle, ci.course_id, ci.course_revision, ci.course_digest,
            ci.learner_count, ci.updated_at, b.view_receipt_id, b.ui_receipt_id,
            ca.archived_at
     FROM classroom_instances ci
     JOIN rooms r ON r.id = ci.room_id
     JOIN classroom_acceptance_bindings b ON b.room_id = ci.room_id
     LEFT JOIN classroom_archives ca ON ca.room_id = ci.room_id
     ${mentorScope}
     ORDER BY ci.updated_at DESC LIMIT 300`,
  ).bind(...(viewer.platformRole === "mentor" ? [viewer.userId, viewer.userId] : [])).all<{
    id: string; title: string; environment: "test" | "production"; lifecycle: string;
    course_id: string; course_revision: number; course_digest: string; learner_count: number;
    updated_at: string; view_receipt_id: string; ui_receipt_id: string | null; archived_at: string | null;
  }>();
  return (rows.results ?? []).map((row) => ({
    roomId: row.id,
    title: row.title,
    environment: row.environment,
    lifecycle: row.lifecycle,
    courseRef: { courseId: row.course_id, revision: row.course_revision, digest: row.course_digest },
    learnerCount: row.learner_count,
    viewReceiptId: row.view_receipt_id,
    uiReceiptId: row.ui_receipt_id,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  }));
}

export function studioViewAcceptanceSummary(receipt: ViewAcceptanceReceipt): StudioViewAcceptanceSummary {
  return {
    receiptId: receipt.receiptId,
    courseRef: receipt.courseRef,
    status: receipt.status,
    projectorVersion: receipt.projectorVersion,
    sourceCommit: receipt.sourceCommit,
    appBuildId: receipt.appBuildId,
    acceptedAt: receipt.acceptedAt,
    valid: receipt.valid,
    invalidReasons: [...receipt.invalidReasons],
  };
}

export function studioUiAcceptanceSummary(receipt: UiAcceptanceReceipt): StudioUiAcceptanceSummary {
  return {
    receiptId: receipt.receiptId,
    viewReceiptId: receipt.viewReceiptId,
    courseRef: receipt.courseRef,
    learnerCount: receipt.learnerCount,
    coursewareRefs: receipt.coursewareRefs.map((ref) => ({ ...ref })),
    runtimeContractVersion: receipt.runtimeContractVersion,
    sourceCommit: receipt.sourceCommit,
    appBuildId: receipt.appBuildId,
    status: receipt.status,
    acceptedAt: receipt.acceptedAt,
    valid: receipt.valid,
    invalidReasons: [...receipt.invalidReasons],
  };
}

function assertStudioAcceptanceViewer(viewer: StudioAcceptanceViewer): void {
  if (!viewer.userId || (viewer.platformRole !== "admin" && viewer.platformRole !== "mentor")) {
    throw new ClassroomError("STUDIO_ROLE_REQUIRED", "Course Studio 只对导师和管理员开放。", 403);
  }
}

function mapViewReceipt(row: ViewReceiptRow): ViewAcceptanceReceipt {
  const invalidReasons: string[] = [];
  if (row.receipt_schema_version !== COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION) invalidReasons.push("视图验收回执结构版本已变化");
  if (row.status !== "accepted") invalidReasons.push("回执状态不是 accepted");
  if (!row.pointer_current) invalidReasons.push("课程已产生新的 Candidate，且本版本也不是当前 Released");
  if (!row.identity_projector_contract_version) invalidReasons.push("回执缺少可追溯构建身份");
  if (row.identity_projector_contract_version !== COURSE_PROJECTOR_CONTRACT_VERSION) invalidReasons.push("共享投影器兼容契约已变化");
  return {
    receiptId: row.id,
    schemaVersion: row.receipt_schema_version,
    courseRef: { courseId: row.course_id, revision: row.revision, digest: row.digest },
    status: row.status,
    scenarios: parseJson<ViewAcceptanceScenario[]>(row.scenarios_json, []),
    checks: parseJson<Record<string, boolean>>(row.checks_json, {}),
    projectorVersion: row.identity_projector_contract_version ?? row.projector_version,
    sourceCommit: row.identity_source_commit ?? "legacy-untracked",
    appBuildId: row.identity_app_build_id ?? row.app_build_id,
    reviewerProfileId: row.reviewer_profile_id,
    acceptedAt: row.accepted_at,
    valid: invalidReasons.length === 0,
    invalidReasons,
  };
}

function mapUiReceipt(row: UiReceiptRow, viewValid: boolean): UiAcceptanceReceipt {
  const invalidReasons: string[] = [];
  if (row.receipt_schema_version !== COURSE_ACCEPTANCE_RECEIPT_SCHEMA_VERSION) invalidReasons.push("课堂 UI 验收回执结构版本已变化");
  if (row.status !== "accepted") invalidReasons.push("回执状态不是 accepted");
  if (row.current_reset_generation !== row.reset_generation) invalidReasons.push("Test Classroom 已在签发后重置");
  if (row.classroom_lifecycle !== "completed") invalidReasons.push("Test Classroom 当前不是 completed");
  if (row.classroom_archived_at) invalidReasons.push("来源 Test Classroom 已归档；回执仅保留为历史证据");
  if (row.state_machine_version !== CLASSROOM_STATE_MACHINE_VERSION) invalidReasons.push("课堂状态机版本已变化");
  if (!row.identity_runtime_contract_version) invalidReasons.push("回执缺少可追溯构建身份");
  if (row.identity_runtime_contract_version !== CLASSROOM_RUNTIME_CONTRACT_VERSION) invalidReasons.push("课堂运行时兼容契约已变化");
  if (row.identity_projector_contract_version !== COURSE_PROJECTOR_CONTRACT_VERSION) invalidReasons.push("共享投影器兼容契约已变化");
  if (!viewValid) invalidReasons.push("关联的多角色视图验收回执已失效");
  return {
    receiptId: row.id,
    schemaVersion: row.receipt_schema_version,
    roomId: row.room_id,
    viewReceiptId: row.view_receipt_id,
    courseRef: { courseId: row.course_id, revision: row.revision, digest: row.digest },
    learnerCount: row.learner_count,
    dealSeed: row.deal_seed,
    resetGeneration: row.reset_generation,
    stateMachineVersion: row.state_machine_version,
    coursewareBundleDigest: row.courseware_bundle_digest,
    coursewareRefs: parseJson<ExactCoursewareRef[]>(row.courseware_refs_json, []),
    mentorMemberships: parseJson(row.mentor_memberships_json, []),
    learnerMemberships: parseJson(row.learner_memberships_json, []),
    adminDmProfileIds: parseJson(row.admin_dm_json, []),
    checks: parseJson(row.checks_json, {}),
    clientMatrix: parseJson(row.client_matrix_json, []),
    runtimeContractVersion: row.identity_runtime_contract_version ?? "legacy-untracked",
    sourceCommit: row.identity_source_commit ?? "legacy-untracked",
    appBuildId: row.identity_app_build_id ?? row.app_build_id,
    auditSummary: parseJson(row.audit_summary_json, {}),
    status: row.status,
    acceptedAt: row.accepted_at,
    acceptedByProfileId: row.accepted_by_profile_id,
    valid: invalidReasons.length === 0,
    invalidReasons,
  };
}

async function loadEligibleExactCourse(db: ClassroomD1, ref: ExactCourseRef): Promise<ReturnType<typeof validateCoursePackage>> {
  const row = await db.prepare(
    `SELECT v.package_json,
            CASE WHEN cp.course_id IS NOT NULL OR rp.course_id IS NOT NULL THEN 1 ELSE 0 END AS pointer_current
     FROM course_versions v
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = v.course_id AND cp.revision = v.revision AND cp.digest = v.digest
     LEFT JOIN course_release_pointers rp ON rp.course_id = v.course_id AND rp.revision = v.revision AND rp.digest = v.digest
     WHERE v.course_id = ? AND v.revision = ? AND v.digest = ?`,
  ).bind(ref.courseId, ref.revision, ref.digest).first<{ package_json: string; pointer_current: number }>();
  if (!row) throw new ClassroomError("COURSE_VERSION_NOT_FOUND", "找不到 exact 课程版本。", 404);
  if (!row.pointer_current) throw new ClassroomError("VIEW_ACCEPTANCE_HISTORICAL_VERSION", "只能验收当前 Candidate 或当前 Released 版本。", 409);
  const course = validateCoursePackage(JSON.parse(row.package_json) as unknown);
  if (await coursePackageDigest(course) !== ref.digest) throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "课程 digest 校验失败。", 500);
  return course;
}

async function isViewReceiptCurrentlyValid(db: ClassroomD1, receiptId: string, ref: ExactCourseRef): Promise<boolean> {
  try { await requireValidViewAcceptanceReceipt(db, ref, receiptId); return true; }
  catch { return false; }
}

function validateClientMatrix(input: UiAcceptanceClient[]): UiAcceptanceClient[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 12) {
    throw new ClassroomError("UI_ACCEPTANCE_CLIENT_MATRIX_INVALID", "至少记录一个、最多十二个真实浏览器／视口。", 400);
  }
  return input.map((entry, index) => {
    const browser = String(entry?.browser ?? "").trim();
    const platform = String(entry?.platform ?? "").trim();
    const width = Number(entry?.viewport?.width);
    const height = Number(entry?.viewport?.height);
    if (!browser || browser.length > 240 || !Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 10_000 || height < 240 || height > 10_000) {
      throw new ClassroomError("UI_ACCEPTANCE_CLIENT_MATRIX_INVALID", `第 ${index + 1} 个浏览器／视口记录无效。`, 400);
    }
    return { browser, viewport: { width, height }, ...(platform ? { platform: platform.slice(0, 120) } : {}) };
  });
}

function orderCourseware(refs: ExactCoursewareRef[]): ExactCoursewareRef[] {
  if (refs.length !== 4 || CLASSROOM_MENTOR_ROLES.some((role) => refs.filter((ref) => ref.mentorRole === role).length !== 1)) {
    throw new ClassroomError("COURSEWARE_EXACT_SET_INVALID", "P／D／M／O 四套 exact 课件必须完整且不重复。", 409);
  }
  return CLASSROOM_MENTOR_ROLES.map((role) => structuredClone(refs.find((ref) => ref.mentorRole === role)!));
}

function sameCourseRef(left: ExactCourseRef, right: ExactCourseRef): boolean {
  return left.courseId === right.courseId && left.revision === right.revision && left.digest === right.digest;
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}
