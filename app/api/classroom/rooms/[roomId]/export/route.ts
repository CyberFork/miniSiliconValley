import { exportClassroomArchive } from "../../../../../lib/classroom-store";
import { withClassroomApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  return withClassroomApi(async ({ db, user }) => {
    const { roomId } = await context.params;
    return exportClassroomArchive(db, user, roomId);
  });
}
