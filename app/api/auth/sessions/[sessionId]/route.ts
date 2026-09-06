import { AuthError } from "../../../../lib/auth-errors";
import { revokeSession } from "../../../../lib/auth-store";
import { consumeEmptyMutation } from "../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  return withAuthApi(async (db) => {
    await consumeEmptyMutation(request);
    const user = await requireApiUser(db, request);
    const { sessionId } = await context.params;
    if (!(await revokeSession(db, user, sessionId))) throw new AuthError("SESSION_NOT_FOUND", "没有找到这个登录设备。", 404);
    return { revoked: true, current: sessionId === user.sessionId };
  });
}
