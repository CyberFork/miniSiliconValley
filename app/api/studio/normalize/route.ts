import { validateCoursePackage } from "../../../lib/course-package";
import { migrateCourseFieldIsolation } from "../../../lib/course-field-model";
import { objectValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

/** Build an isolated browser Working Copy; persistence remains a separate Candidate action. */
export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const migration = migrateCourseFieldIsolation(raw.course as Parameters<typeof migrateCourseFieldIsolation>[0]);
    return { course: validateCoursePackage(migration.course), report: migration.report };
  });
}
