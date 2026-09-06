import { searchLearnersForRoom } from "../../../../../lib/classroom-store";
import { withClassroomApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  return withClassroomApi(async ({ db, user }) => {
    const { roomId } = await context.params;
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return searchLearnersForRoom(db, user, roomId, query);
  });
}
