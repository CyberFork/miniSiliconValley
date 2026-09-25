import { archiveTestClassroom } from "../../../../../lib/classroom-platform-store";
import { parseArchiveClassroomRequest } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const { classroomId } = await context.params;
    const input = parseArchiveClassroomRequest(await readPlatformJson(request));
    return archiveTestClassroom(db, user, classroomId, input);
  });
}
