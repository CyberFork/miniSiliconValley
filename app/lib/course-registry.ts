import type { ClassroomD1 } from "../../db";
import { ClassroomError } from "./classroom-errors";
import {
  bundledCoursePackages,
  coursePackageDigest,
  projectCoursePackageToCampaign,
  validateCoursePackage,
  type CoursePackage,
  type CoursePackageRef,
} from "./course-package";
import type { ClassroomCampaign } from "./classroom-model";
import { resolveLearnerPolicy, validateCourseInstantiation } from "./course-platform";
import { requireValidUiAcceptanceReceipt, requireValidViewAcceptanceReceipt } from "./course-acceptance";
import { migrateCourseFieldIsolation } from "./course-field-model";

export interface CourseReleaseApproval {
  schemaVersion: number;
  courseId: string;
  revision: number;
  digest: string;
  status: "approved";
  runId: string;
  runDigest: string;
  viewReceiptId: string;
  uiReceiptId: string;
  coursewareBundleDigest: string;
  acceptedAt: string;
  acceptedBy: string;
  checks?: Record<string, unknown>;
}

export type StudioCourseVersion = {
  course: ReturnType<typeof validateCoursePackage>;
  ref: CoursePackageRef;
  candidate: boolean;
  released: boolean;
};

export type ExpectedCandidateRef = Pick<CoursePackageRef, "courseId" | "revision" | "digest"> | null;

type CandidatePointerRow = {
  course_id: string;
  revision: number;
  digest: string;
  staged_at: string;
  staged_by: string;
  schema_version: number | null;
  created_at: string | null;
  created_by: string | null;
  created_by_display_name: string | null;
};

/** Save the only editable CourseDefinition as a new immutable Candidate. */
export async function saveCourseCandidate(
  db: ClassroomD1,
  input: unknown,
  actor: string,
  expectedCandidateRef: ExpectedCandidateRef,
): Promise<CoursePackageRef> {
  if (expectedCandidateRef === undefined) {
    throw new ClassroomError("CANDIDATE_BASE_REQUIRED", "保存 Candidate 必须显式指定 exact 基线；首次创建时传 null。", 400);
  }
  // Normalize ownership metadata first so a legitimate structural edit (card
  // reorder, capacity change) cannot be rejected solely because its previous
  // field index is now stale. The normalized result still passes the complete
  // CourseDefinition validator before any digest or DB write occurs.
  const migration = migrateCourseFieldIsolation(input as CoursePackage);
  const course = validateCoursePackage(migration.course);
  const digest = await coursePackageDigest(course);
  const courseId = course.course.id;
  if (expectedCandidateRef && expectedCandidateRef.courseId !== courseId) {
    throw new ClassroomError("CANDIDATE_BASE_INVALID", "保存基线与 Working Copy 不属于同一门课程。", 409);
  }

  // Allocation is optimistic, while every mutation below is protected by an
  // exact pointer condition in one D1 batch. A concurrent writer can make the
  // condition false, but can never leave a pointer to somebody else's digest.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await loadCandidatePointer(db, courseId);
    if (current?.digest === digest) {
      const currentRef = candidateRef(current, migration.report);
      const exact = await loadExactCoursePackage(db, currentRef);
      if (await coursePackageDigest(exact) !== digest) throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "当前 Candidate 没有通过 exact digest 校验。", 500);
      return currentRef;
    }
    if (!sameCandidateExpectation(current, expectedCandidateRef)) {
      throw candidateConflict(expectedCandidateRef, current);
    }

    const latest = await db.prepare(
      `SELECT MAX(revision) AS revision FROM course_versions WHERE course_id = ?`,
    ).bind(courseId).first<{ revision: number | null }>();
    const revision = (latest?.revision ?? -1) + 1;
    const now = new Date().toISOString();
    const insertVersion = expectedCandidateRef
      ? db.prepare(
        `INSERT INTO course_versions
         (course_id, revision, schema_version, digest, package_json, created_at, created_by)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM course_candidate_pointers
           WHERE course_id = ? AND revision = ? AND digest = ?
         )`,
      ).bind(
        courseId, revision, course.schemaVersion, digest, JSON.stringify(course), now, actor,
        courseId, expectedCandidateRef.revision, expectedCandidateRef.digest,
      )
      : db.prepare(
        `INSERT INTO course_versions
         (course_id, revision, schema_version, digest, package_json, created_at, created_by)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM course_candidate_pointers WHERE course_id = ?)`,
      ).bind(courseId, revision, course.schemaVersion, digest, JSON.stringify(course), now, actor, courseId);
    const movePointer = expectedCandidateRef
      ? db.prepare(
        `UPDATE course_candidate_pointers
         SET revision = ?, digest = ?, staged_at = ?, staged_by = ?
         WHERE course_id = ? AND revision = ? AND digest = ?`,
      ).bind(revision, digest, now, actor, courseId, expectedCandidateRef.revision, expectedCandidateRef.digest)
      : db.prepare(
        `INSERT INTO course_candidate_pointers (course_id, revision, digest, staged_at, staged_by)
         SELECT ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM course_candidate_pointers WHERE course_id = ?)`,
      ).bind(courseId, revision, digest, now, actor, courseId);
    const writeEvent = conditionalEventStatement(
      db,
      "course.candidate-saved",
      courseId,
      revision,
      digest,
      actor,
      { previous: expectedCandidateRef },
      now,
      `EXISTS (SELECT 1 FROM course_candidate_pointers WHERE course_id = ? AND revision = ? AND digest = ?)`,
      [courseId, revision, digest],
    );
    try {
      await db.batch([insertVersion, movePointer, writeEvent]);
    } catch (error) {
      const afterFailure = await loadCandidatePointer(db, courseId);
      if (afterFailure?.digest === digest) return candidateRef(afterFailure, migration.report);
      if (!sameCandidateExpectation(afterFailure, expectedCandidateRef)) throw candidateConflict(expectedCandidateRef, afterFailure);
      if (attempt < 2) continue;
      throw new ClassroomError(
        "CANDIDATE_REVISION_CONTENTION",
        "保存期间版本号被其他写入占用；本地 Working Copy 已保留，请重试。",
        409,
        [error instanceof Error ? error.message : String(error)],
      );
    }
    const saved = await loadCandidatePointer(db, courseId);
    if (saved?.revision === revision && saved.digest === digest) {
      const savedRef = candidateRef(saved, migration.report);
      const exact = await loadExactCoursePackage(db, savedRef);
      if (await coursePackageDigest(exact) !== digest) throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "新 Candidate 没有通过 exact digest 校验。", 500);
      return savedRef;
    }
    if (saved?.digest === digest) return candidateRef(saved, migration.report);
    throw candidateConflict(expectedCandidateRef, saved);
  }
  throw new ClassroomError("CANDIDATE_REVISION_CONTENTION", "Candidate 保存竞态未解决；本地 Working Copy 已保留。", 409);
}

export async function listStudioCourseVersions(db: ClassroomD1): Promise<StudioCourseVersion[]> {
  await ensureBundledCourseRegistry(db);
  const result = await db.prepare(
    `SELECT v.*, author.display_name AS created_by_display_name,
            cp.revision AS candidate_revision, cp.digest AS candidate_digest,
            rp.revision AS released_revision, rp.digest AS released_digest, rp.released_at, rp.released_by
     FROM course_versions v
     LEFT JOIN auth_users author ON author.id = v.created_by
     LEFT JOIN course_candidate_pointers cp ON cp.course_id = v.course_id
     LEFT JOIN course_release_pointers rp ON rp.course_id = v.course_id
     ORDER BY v.course_id, v.revision DESC`,
  ).all<CourseVersionRow & {
    created_by_display_name: string | null;
    candidate_revision: number | null; candidate_digest: string | null;
    released_revision: number | null; released_digest: string | null; released_at: string | null; released_by: string | null;
  }>();
  const versions: StudioCourseVersion[] = [];
  for (const row of result.results ?? []) {
    let parsed: unknown;
    try { parsed = JSON.parse(row.package_json); } catch { throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "课程正文不是有效 JSON。", 500); }
    const course = validateCoursePackage(parsed);
    const actual = await coursePackageDigest(course);
    if (actual !== row.digest) throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `${row.course_id} r${row.revision} digest 校验失败。`, 500);
    const candidate = row.candidate_revision === row.revision && row.candidate_digest === row.digest;
    const released = row.released_revision === row.revision && row.released_digest === row.digest;
    versions.push({
      course,
      candidate,
      released,
      ref: {
        courseId: row.course_id,
        schemaVersion: row.schema_version,
        revision: row.revision,
        digest: row.digest,
        status: released ? "released" : candidate ? "candidate" : "approved",
        createdAt: row.created_at,
        createdBy: row.created_by,
        createdByDisplayName: row.created_by_display_name,
        releasedAt: released ? row.released_at : null,
        releasedBy: released ? row.released_by : null,
      },
    });
  }
  return versions;
}

export async function releaseTestedCourseCandidate(
  db: ClassroomD1,
  input: {
    courseRef: Pick<CoursePackageRef, "courseId" | "revision" | "digest">;
    viewReceiptId: string;
    uiReceiptId: string;
  },
  actor: string,
): Promise<CoursePackageRef> {
  const candidate = await db.prepare(
    `SELECT revision, digest FROM course_candidate_pointers WHERE course_id = ?`,
  ).bind(input.courseRef.courseId).first<{ revision: number; digest: string }>();
  if (!candidate || candidate.revision !== input.courseRef.revision || candidate.digest !== input.courseRef.digest) {
    throw new ClassroomError("CANDIDATE_EXACT_MISMATCH", "发布目标不是当前 exact Candidate。", 409);
  }
  const viewReceipt = await requireValidViewAcceptanceReceipt(db, input.courseRef, input.viewReceiptId);
  const uiReceipt = await requireValidUiAcceptanceReceipt(db, input.courseRef, input.uiReceiptId, viewReceipt.receiptId);
  const course = await loadExactCoursePackage(db, input.courseRef);
  // A Candidate may be saved while an author is still filling a larger deck,
  // but a Released definition promises that every learner count in its stated
  // policy is actually instantiable.  Testing N=2 must not accidentally
  // publish a course that advertises N=6 while only carrying twelve cards.
  const maximumLearners = resolveLearnerPolicy(course).maxCount;
  const releaseCapacity = validateCourseInstantiation(course, maximumLearners);
  if (!releaseCapacity.ok) {
    throw new ClassroomError(
      "COURSE_RELEASE_CAPACITY_INVALID",
      `课程尚不能覆盖声明的最多 ${maximumLearners} 名学员，暂不可发布。`,
      409,
      releaseCapacity.issues.map((issue) => issue.message),
    );
  }
  const now = new Date().toISOString();
  return publishReleasedCoursePackage(db, {
    course,
    ref: {
      courseId: input.courseRef.courseId,
      schemaVersion: course.schemaVersion,
      revision: input.courseRef.revision,
      digest: input.courseRef.digest,
      status: "released",
      releasedAt: now,
      releasedBy: actor,
    },
    approval: {
      schemaVersion: 1,
      courseId: input.courseRef.courseId,
      revision: input.courseRef.revision,
      digest: input.courseRef.digest,
      status: "approved",
      runId: uiReceipt.roomId,
      runDigest: input.courseRef.digest,
      viewReceiptId: viewReceipt.receiptId,
      uiReceiptId: uiReceipt.receiptId,
      coursewareBundleDigest: uiReceipt.coursewareBundleDigest,
      acceptedAt: uiReceipt.acceptedAt,
      acceptedBy: uiReceipt.acceptedByProfileId,
      checks: uiReceipt.checks,
    },
  }, actor, input.courseRef);
}

export async function loadExactCoursePackage(
  db: ClassroomD1,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
): Promise<ReturnType<typeof validateCoursePackage>> {
  const row = await db.prepare(
    `SELECT package_json FROM course_versions WHERE course_id = ? AND revision = ? AND digest = ?`,
  ).bind(ref.courseId, ref.revision, ref.digest).first<{ package_json: string }>();
  if (!row) throw new ClassroomError("COURSE_VERSION_NOT_FOUND", "找不到 exact 课程版本。", 404);
  const course = validateCoursePackage(JSON.parse(row.package_json) as unknown);
  if (await coursePackageDigest(course) !== ref.digest) throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "课程 digest 校验失败。", 500);
  return course;
}

type CourseVersionRow = {
  course_id: string;
  revision: number;
  schema_version: number;
  digest: string;
  package_json: string;
  created_at: string;
  created_by: string;
};

type ReleasedPointerRow = CourseVersionRow & {
  released_at: string;
  released_by: string;
  approval_json: string;
};

export async function ensureBundledCourseRegistry(db: ClassroomD1): Promise<void> {
  const now = "2026-09-06T00:00:00Z";
  for (const course of bundledCoursePackages()) {
    const digest = await coursePackageDigest(course);
    const ref: CoursePackageRef = {
      courseId: course.course.id,
      schemaVersion: course.schemaVersion,
      revision: 0,
      digest,
      status: "released",
      createdAt: now,
      createdBy: "bundled",
      releasedAt: now,
      releasedBy: "bundled",
      approvalRunId: null,
    };
    const existing = await db.prepare(
      `SELECT digest, package_json FROM course_versions WHERE course_id = ? AND revision = 0`,
    ).bind(ref.courseId).first<{ digest: string; package_json: string }>();
    if (existing && (existing.digest !== digest || await digestFromJson(existing.package_json) !== digest)) {
      throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `内置课程 ${ref.courseId} r0 与注册表内容不一致。`, 500);
    }
    await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO course_versions
         (course_id, revision, schema_version, digest, package_json, created_at, created_by)
         VALUES (?, 0, ?, ?, ?, ?, 'bundled')`,
      ).bind(ref.courseId, ref.schemaVersion, digest, JSON.stringify(course), now),
      db.prepare(
        `INSERT OR IGNORE INTO course_release_pointers
         (course_id, revision, digest, released_at, released_by, approval_json)
         VALUES (?, 0, ?, ?, 'bundled', '{}')`,
      ).bind(ref.courseId, digest, now),
      eventStatement(db, "course.bootstrap", ref.courseId, 0, digest, "bundled", { source: "bundled" }, now),
    ]);
  }
}

async function publishReleasedCoursePackage(
  db: ClassroomD1,
  input: { course: unknown; ref: unknown; approval: unknown },
  actor: string,
  expectedCandidateRef: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
): Promise<CoursePackageRef> {
  const course = validateCoursePackage(input.course);
  const rawRef = object(input.ref, "ref");
  const approval = object(input.approval, "approval") as unknown as CourseReleaseApproval;
  const revision = integer(rawRef.revision, "ref.revision", 1);
  const courseId = string(rawRef.courseId, "ref.courseId");
  const digest = string(rawRef.digest, "ref.digest");
  if (rawRef.status !== "released") throw new ClassroomError("COURSE_REF_INVALID", "正式课堂只接收 Released 引用。", 400);
  if (course.course.id !== courseId || course.schemaVersion !== rawRef.schemaVersion) {
    throw new ClassroomError("COURSE_REF_MISMATCH", "课程正文与发布引用不匹配。", 409);
  }
  const actualDigest = await coursePackageDigest(course);
  if (actualDigest !== digest) throw new ClassroomError("COURSE_DIGEST_MISMATCH", "课程正文 digest 与发布引用不一致。", 409);
  if (
    approval.status !== "approved"
    || approval.courseId !== courseId
    || approval.revision !== revision
    || approval.digest !== digest
    || approval.runDigest !== digest
    || !approval.runId
    || !approval.viewReceiptId
    || !approval.uiReceiptId
    || !approval.coursewareBundleDigest
  ) {
    throw new ClassroomError("TEST_APPROVAL_MISMATCH", "Test Classroom 验收回执没有绑定这个 exact Candidate。", 409);
  }
  if (
    expectedCandidateRef.courseId !== courseId
    || expectedCandidateRef.revision !== revision
    || expectedCandidateRef.digest !== digest
  ) throw new ClassroomError("CANDIDATE_EXACT_MISMATCH", "发布基线与目标 exact Candidate 不一致。", 409);
  const existing = await db.prepare(
    `SELECT schema_version, digest, package_json, created_at, created_by
     FROM course_versions WHERE course_id = ? AND revision = ?`,
  ).bind(courseId, revision).first<{
    schema_version: number; digest: string; package_json: string; created_at: string; created_by: string;
  }>();
  if (!existing || existing.digest !== digest || await digestFromJson(existing.package_json) !== digest) {
    throw new ClassroomError("COURSE_REVISION_IMMUTABLE", `课程 ${courseId} r${revision} 不是可发布的 exact 快照。`, 409);
  }
  const current = await db.prepare(
    `SELECT revision, digest, released_at, released_by FROM course_release_pointers WHERE course_id = ?`,
  ).bind(courseId).first<{ revision: number; digest: string; released_at: string; released_by: string }>();
  if (current && current.revision > revision) {
    throw new ClassroomError("COURSE_RELEASE_ROLLBACK", "禁止把正式课堂发布指针静默回退到较旧 revision。", 409);
  }
  if (current && current.revision === revision && current.digest !== digest) {
    throw new ClassroomError("COURSE_REVISION_IMMUTABLE", "同一正式 revision 不能指向另一份内容。", 409);
  }
  if (current?.revision === revision && current.digest === digest) {
    return {
      courseId,
      schemaVersion: existing.schema_version,
      revision,
      digest,
      status: "released",
      createdAt: existing.created_at,
      createdBy: existing.created_by,
      releasedAt: current.released_at,
      releasedBy: current.released_by,
      approvalRunId: approval.runId,
    };
  }
  const releasedAt = typeof rawRef.releasedAt === "string" ? rawRef.releasedAt : new Date().toISOString();
  const releasedBy = typeof rawRef.releasedBy === "string" ? rawRef.releasedBy : actor;
  const moveRelease = current
    ? db.prepare(
      `UPDATE course_release_pointers
       SET revision = ?, digest = ?, released_at = ?, released_by = ?, approval_json = ?
       WHERE course_id = ? AND revision = ? AND digest = ?
         AND EXISTS (
           SELECT 1 FROM course_candidate_pointers
           WHERE course_id = ? AND revision = ? AND digest = ?
         )`,
    ).bind(
      revision, digest, releasedAt, releasedBy, JSON.stringify(approval),
      courseId, current.revision, current.digest,
      courseId, expectedCandidateRef.revision, expectedCandidateRef.digest,
    )
    : db.prepare(
      `INSERT INTO course_release_pointers
       (course_id, revision, digest, released_at, released_by, approval_json)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM course_release_pointers WHERE course_id = ?)
         AND EXISTS (
           SELECT 1 FROM course_candidate_pointers
           WHERE course_id = ? AND revision = ? AND digest = ?
         )`,
    ).bind(
      courseId, revision, digest, releasedAt, releasedBy, JSON.stringify(approval),
      courseId, courseId, expectedCandidateRef.revision, expectedCandidateRef.digest,
    );
  const writeEvent = conditionalEventStatement(
    db,
    "course.released",
    courseId,
    revision,
    digest,
    actor,
    { runId: approval.runId, previous: current ?? null },
    releasedAt,
    `EXISTS (SELECT 1 FROM course_release_pointers WHERE course_id = ? AND revision = ? AND digest = ?)`,
    [courseId, revision, digest],
  );
  try {
    await db.batch([moveRelease, writeEvent]);
  } catch (error) {
    const candidateAfter = await loadCandidatePointer(db, courseId);
    if (!sameCandidateExpectation(candidateAfter, expectedCandidateRef)) throw candidateConflict(expectedCandidateRef, candidateAfter, "验收后 Candidate 已被新保存替换，本次未发布。");
    throw error;
  }
  const released = await db.prepare(
    `SELECT revision, digest, released_at, released_by
     FROM course_release_pointers WHERE course_id = ?`,
  ).bind(courseId).first<{ revision: number; digest: string; released_at: string; released_by: string }>();
  if (!released || released.revision !== revision || released.digest !== digest) {
    const candidateAfter = await loadCandidatePointer(db, courseId);
    if (!sameCandidateExpectation(candidateAfter, expectedCandidateRef)) throw candidateConflict(expectedCandidateRef, candidateAfter, "验收后 Candidate 已被新保存替换，本次未发布。");
    throw new ClassroomError("COURSE_RELEASE_CONFLICT", "发布指针被其他请求更新，本次未覆盖对方结果。", 409);
  }
  return {
    courseId,
    schemaVersion: existing.schema_version,
    revision,
    digest,
    status: "released",
    createdAt: existing.created_at,
    createdBy: existing.created_by,
    releasedAt: released.released_at,
    releasedBy: released.released_by,
    approvalRunId: approval.runId,
  };
}

export async function listReleasedCourseCampaigns(db: ClassroomD1): Promise<ClassroomCampaign[]> {
  await ensureBundledCourseRegistry(db);
  const rows = await allRows<ReleasedPointerRow>(
    db.prepare(
      `SELECT v.*, p.released_at, p.released_by, p.approval_json
       FROM course_release_pointers p
       JOIN course_versions v ON v.course_id = p.course_id AND v.revision = p.revision AND v.digest = p.digest
       ORDER BY v.course_id`,
    ),
  );
  const result: ClassroomCampaign[] = [];
  for (const row of rows) result.push(await campaignFromRow(row));
  return result;
}

export async function loadReleasedCourseCampaign(db: ClassroomD1, courseId: string): Promise<ClassroomCampaign> {
  await ensureBundledCourseRegistry(db);
  const row = await db.prepare(
    `SELECT v.*, p.released_at, p.released_by, p.approval_json
     FROM course_release_pointers p
     JOIN course_versions v ON v.course_id = p.course_id AND v.revision = p.revision AND v.digest = p.digest
     WHERE p.course_id = ?`,
  ).bind(courseId).first<ReleasedPointerRow>();
  if (!row) throw new ClassroomError("COURSE_NOT_RELEASED", `课程 ${courseId} 尚未发布到正式课堂。`, 404);
  return campaignFromRow(row);
}

export async function loadExactCourseCampaign(
  db: ClassroomD1,
  ref: Pick<CoursePackageRef, "courseId" | "revision" | "digest">,
): Promise<ClassroomCampaign> {
  const row = await db.prepare(
    `SELECT v.*, '' AS released_at, 'exact-binding' AS released_by, '{}' AS approval_json
     FROM course_versions v
     WHERE v.course_id = ? AND v.revision = ? AND v.digest = ?`,
  ).bind(ref.courseId, ref.revision, ref.digest).first<ReleasedPointerRow>();
  if (!row) throw new ClassroomError("COURSE_VERSION_NOT_FOUND", `找不到 exact 课程 ${ref.courseId} r${ref.revision}。`, 404);
  return campaignFromRow(row, "candidate");
}

export async function loadRoomCourseCampaign(
  db: ClassroomD1,
  room: { id: string; campaign_id: string },
): Promise<{ campaign: ClassroomCampaign; legacy: boolean }> {
  const binding = await db.prepare(
    `SELECT b.course_id, b.revision, b.digest, v.schema_version, v.package_json,
            v.created_at, v.created_by, b.bound_at
     FROM room_course_bindings b
     JOIN course_versions v ON v.course_id = b.course_id AND v.revision = b.revision AND v.digest = b.digest
     WHERE b.room_id = ?`,
  ).bind(room.id).first<{
    course_id: string;
    revision: number;
    digest: string;
    schema_version: number;
    package_json: string;
    created_at: string;
    created_by: string;
    bound_at: string;
  }>();
  if (!binding) {
    // Only pre-registry rooms may use the legacy compatibility adapter. New
    // rooms always receive a binding in the same atomic batch as room.create.
    const legacy = await import("../data/classroom-campaigns");
    const campaign = legacy.getClassroomCampaign(room.campaign_id);
    if (!campaign) throw new ClassroomError("ROOM_COURSE_BINDING_MISSING", "课堂缺少可读取的课程版本绑定。", 500);
    return { campaign, legacy: true };
  }
  const row: ReleasedPointerRow = {
    course_id: binding.course_id,
    revision: binding.revision,
    schema_version: binding.schema_version,
    digest: binding.digest,
    package_json: binding.package_json,
    created_at: binding.created_at,
    created_by: binding.created_by,
    released_at: binding.bound_at,
    released_by: "room-binding",
    approval_json: "{}",
  };
  return { campaign: await campaignFromRow(row, "released"), legacy: false };
}

export function bindRoomCourseStatement(
  db: ClassroomD1,
  roomId: string,
  campaign: ClassroomCampaign,
  now: string,
): D1PreparedStatement {
  const ref = campaign.courseRef;
  if (!ref) throw new ClassroomError("COURSE_REF_MISSING", "新课堂必须绑定 exact Released 课程版本。", 500);
  return db.prepare(
    `INSERT INTO room_course_bindings (room_id, course_id, revision, digest, legacy_campaign_id, bound_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(roomId, ref.courseId, ref.revision, ref.digest, campaign.id, now);
}

export type ExistingCourseCardGrant = {
  id: string;
  chapter_id: string;
  team_id: string;
  card_id: string;
};

/**
 * Preserve every still-valid hand position during an explicit Alpha refresh.
 * Only card ids deleted by the author are filled from unused cards in the
 * corresponding new deck.  Read/published state and ownership live on the
 * grant row and are therefore never rewritten here.
 */
export function reconcileCourseCardGrantIds(
  campaign: ClassroomCampaign,
  grants: ExistingCourseCardGrant[],
): Array<{ id: string; cardId: string }> {
  const chapters = new Map(campaign.chapters.map((chapter) => [chapter.id, chapter]));
  const grouped = new Map<string, ExistingCourseCardGrant[]>();
  for (const grant of grants) {
    const key = `${grant.chapter_id}\u0000${grant.team_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), grant]);
  }
  const updates: Array<{ id: string; cardId: string }> = [];
  for (const group of grouped.values()) {
    const chapter = chapters.get(group[0].chapter_id);
    if (!chapter) throw new ClassroomError("ALPHA_STRUCTURE_CHANGED", "新版课程缺少已有手牌所在章节。", 409);
    const valid = new Set(chapter.infoCards.map((card) => card.id));
    const kept = new Set(group.filter((grant) => valid.has(grant.card_id)).map((grant) => grant.card_id));
    const available = chapter.infoCards.map((card) => card.id).filter((id) => !kept.has(id));
    for (const grant of group) {
      if (valid.has(grant.card_id)) continue;
      const cardId = available.shift();
      if (!cardId) throw new ClassroomError("ALPHA_DECK_TOO_SMALL", "新版卡组无法保留四人手牌数量。", 409);
      updates.push({ id: grant.id, cardId });
    }
  }
  return updates;
}

async function campaignFromRow(row: ReleasedPointerRow, status: "candidate" | "released" = "released"): Promise<ClassroomCampaign> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.package_json);
  } catch {
    throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `课程 ${row.course_id} r${row.revision} 正文不是有效 JSON。`, 500);
  }
  const course = validateCoursePackage(parsed);
  const actual = await coursePackageDigest(course);
  if (course.course.id !== row.course_id || actual !== row.digest) {
    throw new ClassroomError("COURSE_REGISTRY_CORRUPT", `课程 ${row.course_id} r${row.revision} 未通过 digest 校验。`, 500);
  }
  return projectCoursePackageToCampaign(course, {
    courseId: row.course_id,
    schemaVersion: row.schema_version,
    revision: row.revision,
    digest: row.digest,
    status,
    createdAt: row.created_at,
    createdBy: row.created_by,
    releasedAt: row.released_at,
    releasedBy: row.released_by,
    approvalRunId: parseApprovalRunId(row.approval_json),
  });
}

async function digestFromJson(json: string): Promise<string> {
  try {
    return coursePackageDigest(validateCoursePackage(JSON.parse(json)));
  } catch {
    return "invalid";
  }
}

function parseApprovalRunId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { runId?: unknown };
    return typeof parsed.runId === "string" ? parsed.runId : null;
  } catch {
    return null;
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("COURSE_RELEASE_INVALID", `${label} 必须是对象。`, 400);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ClassroomError("COURSE_RELEASE_INVALID", `${label} 必须是非空文本。`, 400);
  return value;
}

function integer(value: unknown, label: string, minimum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum) throw new ClassroomError("COURSE_RELEASE_INVALID", `${label} 必须是不小于 ${minimum} 的整数。`, 400);
  return Number(value);
}

async function allRows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

async function loadCandidatePointer(db: ClassroomD1, courseId: string): Promise<CandidatePointerRow | null> {
  const row = await db.prepare(
    `SELECT p.course_id, p.revision, p.digest, p.staged_at, p.staged_by,
            v.schema_version, v.created_at, v.created_by,
            author.display_name AS created_by_display_name
     FROM course_candidate_pointers p
     LEFT JOIN course_versions v
       ON v.course_id = p.course_id AND v.revision = p.revision AND v.digest = p.digest
     LEFT JOIN auth_users author ON author.id = v.created_by
     WHERE p.course_id = ?`,
  ).bind(courseId).first<CandidatePointerRow>();
  if (row && (row.schema_version == null || !row.created_at || !row.created_by)) {
    throw new ClassroomError(
      "COURSE_REGISTRY_CORRUPT",
      `Candidate 指针 ${row.course_id}@r${row.revision} 没有匹配的 exact 快照。`,
      500,
      [`digest=${row.digest}`, `stagedBy=${row.staged_by}`, `stagedAt=${row.staged_at}`],
    );
  }
  return row ?? null;
}

function sameCandidateExpectation(current: CandidatePointerRow | null, expected: ExpectedCandidateRef): boolean {
  if (!expected) return current == null;
  return Boolean(
    current
    && current.course_id === expected.courseId
    && current.revision === expected.revision
    && current.digest === expected.digest,
  );
}

function exactLabel(ref: ExpectedCandidateRef | CandidatePointerRow): string {
  if (!ref) return "none";
  const courseId = "course_id" in ref ? ref.course_id : ref.courseId;
  return `${courseId}@r${ref.revision}:${ref.digest}`;
}

function candidateConflict(
  expected: ExpectedCandidateRef,
  current: CandidatePointerRow | null,
  message = "有人已经保存了新 Candidate；本地 Working Copy 已保留，不会自动覆盖对方。",
): ClassroomError {
  return new ClassroomError(
    "CANDIDATE_SAVE_CONFLICT",
    message,
    409,
    [
      `expected=${exactLabel(expected)}`,
      `current=${exactLabel(current)}`,
      ...(current ? [`currentAuthor=${current.created_by}`, `currentAuthorName=${current.created_by_display_name ?? ""}`, `currentCreatedAt=${current.created_at}`, `currentStagedBy=${current.staged_by}`, `currentStagedAt=${current.staged_at}`] : []),
    ],
  );
}

function candidateRef(
  row: CandidatePointerRow,
  fieldMigration: CoursePackageRef["fieldMigration"],
): CoursePackageRef {
  if (row.schema_version == null || !row.created_at || !row.created_by) {
    throw new ClassroomError("COURSE_REGISTRY_CORRUPT", "Candidate exact 快照元数据不完整。", 500);
  }
  return {
    courseId: row.course_id,
    schemaVersion: row.schema_version,
    revision: row.revision,
    digest: row.digest,
    status: "candidate",
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByDisplayName: row.created_by_display_name,
    fieldMigration,
  };
}

function conditionalEventStatement(
  db: ClassroomD1,
  type: string,
  courseId: string,
  revision: number,
  digest: string,
  actor: string,
  detail: Record<string, unknown>,
  at: string,
  conditionSql: string,
  conditionBindings: unknown[],
): D1PreparedStatement {
  return db.prepare(
    `INSERT OR IGNORE INTO course_registry_events
     (id, type, course_id, revision, digest, actor, detail_json, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?
     WHERE ${conditionSql}`,
  ).bind(
    `${type}:${courseId}:${revision}:${digest}`,
    type,
    courseId,
    revision,
    digest,
    actor,
    JSON.stringify(detail),
    at,
    ...conditionBindings,
  );
}

function eventStatement(
  db: ClassroomD1,
  type: string,
  courseId: string,
  revision: number,
  digest: string,
  actor: string,
  detail: Record<string, unknown>,
  at: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT OR IGNORE INTO course_registry_events
     (id, type, course_id, revision, digest, actor, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(`${type}:${courseId}:${revision}:${digest}`, type, courseId, revision, digest, actor, JSON.stringify(detail), at);
}
