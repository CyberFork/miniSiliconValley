import { applyClassroomAction } from "../../../../../lib/classroom-store";
import { parseClassroomAction } from "../../../../../lib/classroom-validation";
import { readJson, withClassroomApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  return withClassroomApi(async ({ db, user }) => {
    const { roomId } = await context.params;
    const action = parseClassroomAction(await readJson(request));
    return applyClassroomAction(db, user, roomId, action);
  });
}
