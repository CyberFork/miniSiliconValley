import { releaseTestedCourseCandidate } from "../../../lib/course-registry";
import { objectValue, parseCourseRef, stringValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    return releaseTestedCourseCandidate(db, {
      courseRef: parseCourseRef(raw.courseRef),
      receiptId: stringValue(raw.receiptId, "receiptId", 128),
    }, user.userId);
  });
}
