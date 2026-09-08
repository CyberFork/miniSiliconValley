import { createViewAcceptanceReceipt } from "../../../lib/course-acceptance";
import { integerValue, objectValue, parseCourseRef, stringValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const ref = parseCourseRef(raw.courseRef);
    const reviewedBlockIds = Array.isArray(raw.reviewedBlockIds)
      ? raw.reviewedBlockIds.map((value) => stringValue(value, "Block ID", 64))
      : [];
    const reviewedLearnerCounts = Array.isArray(raw.reviewedLearnerCounts)
      ? raw.reviewedLearnerCounts.map((value) => integerValue(value, "学员人数", 1, 24))
      : [];
    return createViewAcceptanceReceipt(db, {
      courseRef: ref,
      reviewedBlockIds,
      reviewedLearnerCounts,
    }, user.userId);
  });
}
