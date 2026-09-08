import { resetTestClassroom } from "../../../../../lib/classroom-platform-store";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    await readPlatformJson(request);
    const { classroomId } = await context.params;
    await resetTestClassroom(db, user, classroomId);
    return { reset: true };
  });
}
