import { getClassroomRoom } from "../../../../lib/classroom-store";
import { withClassroomApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  return withClassroomApi(async ({ db, user }) => {
    const { roomId } = await context.params;
    const focusTeamId = new URL(request.url).searchParams.get("team");
    return getClassroomRoom(db, user, roomId, focusTeamId);
  });
}
