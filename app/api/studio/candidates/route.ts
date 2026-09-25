import { ClassroomError } from "../../../lib/classroom-errors";
import { saveCourseCandidate } from "../../../lib/course-registry";
import { objectValue, parseCourseRef } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    if (!Object.prototype.hasOwnProperty.call(raw, "expectedCandidateRef")) {
      throw new ClassroomError(
        "CANDIDATE_BASE_REQUIRED",
        "保存必须显式携带 expectedCandidateRef；首次创建课程时传 null。",
        400,
      );
    }
    const expectedCandidateRef = raw.expectedCandidateRef === null
      ? null
      : parseCourseRef(raw.expectedCandidateRef);
    if (expectedCandidateRef !== null && expectedCandidateRef.status !== "candidate") {
      throw new ClassroomError("CANDIDATE_BASE_INVALID", "expectedCandidateRef 必须是 exact Candidate，或在首次创建时传 null。", 400);
    }
    try { return await saveCourseCandidate(db, raw.course, user.userId, expectedCandidateRef); }
    catch (error) {
      if (error instanceof ClassroomError) throw error;
      throw new ClassroomError("COURSE_DEFINITION_INVALID", error instanceof Error ? error.message : "课程定义无效。", 400);
    }
  });
}
