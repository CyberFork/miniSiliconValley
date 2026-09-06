import { AuthError } from "../../../../../lib/auth-errors";
import { setManagedUserStatus } from "../../../../../lib/auth-store";
import { readSecureJson } from "../../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    if (body.status !== "active" && body.status !== "disabled") throw new AuthError("STATUS_INVALID", "账号状态无效。", 400);
    const { userId } = await context.params;
    await setManagedUserStatus(db, actor, userId, body.status);
    return { updated: true };
  });
}
