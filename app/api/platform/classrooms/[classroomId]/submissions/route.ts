import { submitClassroomBlockWork } from "../../../../../lib/classroom-platform-store";
import { objectValue, stringValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId } = await context.params;
    await submitClassroomBlockWork(db, user, classroomId, {
      kind: stringValue(raw.kind, "作品类型", 32),
      text: stringValue(raw.text, "作品内容", 4_000),
    });
    return { submitted: true };
  });
}
