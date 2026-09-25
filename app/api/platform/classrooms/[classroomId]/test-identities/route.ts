import { listTestClassroomIdentities } from "../../../../../lib/classroom-platform-store";
import { manageTestClassroomIdentity, type TestIdentityAccountAction } from "../../../../../lib/auth-store";
import { ClassroomError } from "../../../../../lib/classroom-errors";
import { objectValue, stringValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, requirePlatformAdmin, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requirePlatformAdmin(user);
    const { classroomId } = await context.params;
    return listTestClassroomIdentities(db, user, classroomId);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requirePlatformAdmin(user);
    const { classroomId } = await context.params;
    const raw = objectValue(await readPlatformJson(request));
    const action = stringValue(raw.action, "账号操作", 32);
    if (action !== "disable" && action !== "activate" && action !== "reset-credential") {
      throw new ClassroomError("TEST_IDENTITY_ACTION_INVALID", "未知测试账号操作。", 400);
    }
    return manageTestClassroomIdentity(db, user, {
      classroomId,
      targetProfileId: stringValue(raw.targetProfileId, "目标账号", 128),
      action: action as TestIdentityAccountAction,
    });
  });
}
