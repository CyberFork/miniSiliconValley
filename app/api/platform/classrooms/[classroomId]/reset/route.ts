import { resetTestClassroom } from "../../../../../lib/classroom-platform-store";
import { objectValue, parseRunExpectation } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const input = parseRunExpectation(objectValue(await readPlatformJson(request)));
    const { classroomId } = await context.params;
    const nextRun = await resetTestClassroom(db, user, classroomId, input);
    return { reset: true, ...nextRun };
  });
}
