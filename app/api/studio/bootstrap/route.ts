import { listCourseTestReceipts, studioVersionSummary } from "../../../lib/classroom-platform-store";
import { listStudioCourseVersions } from "../../../lib/course-registry";
import { listCourseware } from "../../../lib/courseware-store";
import { requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const [versions, courseware, receipts] = await Promise.all([
      listStudioCourseVersions(db),
      listCourseware(db),
      listCourseTestReceipts(db),
    ]);
    return {
      user: { userId: user.userId, displayName: user.displayName, role: user.platformRole },
      versions: versions.map(studioVersionSummary),
      courseware,
      receipts,
    };
  });
}
