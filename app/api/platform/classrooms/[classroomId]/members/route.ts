import {
  listAssignableClassroomAccounts,
  updateClassroomMembership,
  type ClassroomMembershipAction,
} from "../../../../../lib/classroom-platform-store";
import { ClassroomError } from "../../../../../lib/classroom-errors";
import { objectValue, stringValue, integerValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const { classroomId } = await context.params;
    return listAssignableClassroomAccounts(db, user, classroomId);
  });
}

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId } = await context.params;
    const type = stringValue(raw.type, "成员操作", 32);
    const profileId = stringValue(raw.profileId, "账号 ID", 128);
    let action: ClassroomMembershipAction;
    if (type === "replace-learner") action = { type, profileId, seat: integerValue(raw.seat, "学员席", 1, 24) };
    else if (type === "replace-mentor") {
      const mentorRole = raw.mentorRole;
      if (mentorRole !== "P" && mentorRole !== "D" && mentorRole !== "M" && mentorRole !== "O") throw new ClassroomError("INPUT_INVALID", "导师角色必须是 P、D、M 或 O。", 400);
      action = { type, profileId, mentorRole };
    } else if (type === "grant-admin-dm" || type === "revoke-admin-dm") action = { type, profileId };
    else throw new ClassroomError("INPUT_INVALID", "未知成员操作。", 400);
    await updateClassroomMembership(db, user, classroomId, action);
    return { updated: true };
  });
}
