import { acceptTestClassroom } from "../../../../../lib/classroom-platform-store";
import { objectValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId } = await context.params;
    return acceptTestClassroom(db, user, classroomId, objectValue(raw.checks ?? {}, "checks"));
  });
}
