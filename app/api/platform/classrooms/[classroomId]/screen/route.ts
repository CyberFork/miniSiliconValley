import { getClassroomSharedScreen } from "../../../../../lib/classroom-platform-store";
import { withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const { classroomId } = await context.params;
    return getClassroomSharedScreen(db, user, classroomId);
  });
}
