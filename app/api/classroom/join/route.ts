import { requestTeamMembership } from "../../../lib/classroom-store";
import { parseJoinRoom } from "../../../lib/classroom-validation";
import { readJson, withClassroomApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withClassroomApi(async ({ db, user }) => {
    const { teamPublicId } = parseJoinRoom(await readJson(request));
    return requestTeamMembership(db, user, teamPublicId);
  });
}
