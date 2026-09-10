import { finishClassroomRun } from "../../../../../lib/classroom-platform-store";
import { integerValue, objectValue, parseRunExpectation, stringValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId } = await context.params;
    return finishClassroomRun(db, user, classroomId, {
      ...parseRunExpectation(raw),
      expectedScriptVersion: integerValue(raw.expectedScriptVersion, "剧本版本", 1, 1_000_000),
      idempotencyKey: stringValue(raw.idempotencyKey, "幂等键", 128),
      ...(raw.viewAsProfileId == null
        ? {}
        : { viewAsProfileId: stringValue(raw.viewAsProfileId, "测试视角账号", 128) }),
    });
  });
}
