import { createClassroomRoom } from "../../../lib/classroom-store";
import { parseCreateRoom } from "../../../lib/classroom-validation";
import { readJson, withClassroomApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withClassroomApi(async ({ db, user }) => {
    const { title, campaignId } = parseCreateRoom(await readJson(request));
    return createClassroomRoom(db, user, title, campaignId);
  });
}
