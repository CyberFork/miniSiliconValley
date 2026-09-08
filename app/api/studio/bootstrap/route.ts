import { studioVersionSummary } from "../../../lib/classroom-platform-store";
import {
  COURSE_ACCEPTANCE_APP_BUILD_ID,
  COURSE_PROJECTOR_VERSION,
  listAcceptanceClassrooms,
  listUiAcceptanceReceipts,
  listViewAcceptanceReceipts,
} from "../../../lib/course-acceptance";
import { listStudioCourseVersions } from "../../../lib/course-registry";
import { listCourseware } from "../../../lib/courseware-store";
import { requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const [versions, courseware, viewReceipts, uiReceipts, acceptanceClassrooms] = await Promise.all([
      listStudioCourseVersions(db),
      listCourseware(db),
      listViewAcceptanceReceipts(db),
      listUiAcceptanceReceipts(db),
      listAcceptanceClassrooms(db),
    ]);
    return {
      user: { userId: user.userId, displayName: user.displayName, role: user.platformRole },
      versions: versions.map(studioVersionSummary),
      courseware,
      viewReceipts,
      uiReceipts,
      acceptanceClassrooms,
      acceptanceRuntime: {
        projectorVersion: COURSE_PROJECTOR_VERSION,
        appBuildId: COURSE_ACCEPTANCE_APP_BUILD_ID,
      },
    };
  });
}
