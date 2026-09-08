import { applyControllerAction } from "../../../../../lib/classroom-platform-store";
import { parseControllerAction } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const { classroomId } = await context.params;
    const { expectedVersion, action } = parseControllerAction(await readPlatformJson(request));
    return applyControllerAction(db, user, classroomId, expectedVersion, action);
  });
}
