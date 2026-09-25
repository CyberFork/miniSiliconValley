import { getBrowserAccountSetState, listOwnSessions } from "../../../lib/auth-store";
import { requireApiUser, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const user = await requireApiUser(db, request);
    return {
      user,
      sessions: await listOwnSessions(db, user),
      accountSet: await getBrowserAccountSetState(db, request.headers.get("cookie")),
    };
  });
}
