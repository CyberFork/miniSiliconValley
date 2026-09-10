import { studioVersionSummary } from "../../../lib/classroom-platform-store";
import {
  COURSE_ACCEPTANCE_APP_BUILD_ID,
  COURSE_ACCEPTANCE_SOURCE_COMMIT,
  COURSE_PROJECTOR_CONTRACT_VERSION,
  CLASSROOM_RUNTIME_CONTRACT_VERSION,
  COURSE_PROJECTOR_VERSION,
  listAcceptanceClassrooms,
  listUiAcceptanceReceipts,
  listViewAcceptanceReceipts,
} from "../../../lib/course-acceptance";
import { listStudioCourseVersions } from "../../../lib/course-registry";
import { listCourseware } from "../../../lib/courseware-store";
import { ClassroomError } from "../../../lib/classroom-errors";
import { requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const query = new URL(request.url).searchParams;
    const scope = query.get("scope");
    const courseId = query.get("course");
    if (scope && scope !== "current" && scope !== "history") {
      throw new ClassroomError("STUDIO_SCOPE_INVALID", "不支持的课程读取范围。", 400);
    }
    if (scope === "history" && !courseId) {
      throw new ClassroomError("COURSE_ID_REQUIRED", "查看历史时请选择一门课程。", 400);
    }
    const historyOnly = scope === "history";
    const [versions, courseware, viewReceipts, uiReceipts, acceptanceClassrooms] = await Promise.all([
      listStudioCourseVersions(db, { currentOnly: scope === "current", ...(historyOnly ? { courseId: courseId! } : {}) }),
      historyOnly ? Promise.resolve([]) : listCourseware(db),
      historyOnly ? Promise.resolve([]) : listViewAcceptanceReceipts(db),
      historyOnly ? Promise.resolve([]) : listUiAcceptanceReceipts(db),
      historyOnly ? Promise.resolve([]) : listAcceptanceClassrooms(db),
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
        projectorContractVersion: COURSE_PROJECTOR_CONTRACT_VERSION,
        runtimeContractVersion: CLASSROOM_RUNTIME_CONTRACT_VERSION,
        sourceCommit: COURSE_ACCEPTANCE_SOURCE_COMMIT,
        appBuildId: COURSE_ACCEPTANCE_APP_BUILD_ID,
      },
    };
  });
}
