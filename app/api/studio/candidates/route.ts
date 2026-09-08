import { ClassroomError } from "../../../lib/classroom-errors";
import { saveCourseCandidate } from "../../../lib/course-registry";
import { objectValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    try { return await saveCourseCandidate(db, raw.course, user.userId); }
    catch (error) {
      if (error instanceof ClassroomError) throw error;
      throw new ClassroomError("COURSE_DEFINITION_INVALID", error instanceof Error ? error.message : "课程定义无效。", 400);
    }
  });
}
