import {
  authenticateSession,
  clearBrowserAccountSetCookie,
  clearSessionCookie,
  getBrowserAccountSetState,
  mutateBrowserAccounts,
  revokeCurrentSession,
  stopTestImpersonation,
} from "../../../lib/auth-store";
import { consumeEmptyMutation } from "../../../lib/request-security";
import { authResponse, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    await consumeEmptyMutation(request);
    const cookieHeader = request.headers.get("cookie");
    const current = await authenticateSession(db, cookieHeader);
    if (current?.impersonation) await stopTestImpersonation(db, current, "logout");
    const accountSet = await getBrowserAccountSetState(db, cookieHeader);
    if (accountSet) {
      await mutateBrowserAccounts(db, cookieHeader, {
        action: "logout-all",
        expectedVersion: accountSet.version,
        idempotencyKey: `legacy-logout.${crypto.randomUUID()}`,
      });
    }
    await revokeCurrentSession(db, cookieHeader);
    const headers = new Headers({
      "Clear-Site-Data": '"cache", "storage"',
    });
    headers.append("Set-Cookie", clearSessionCookie());
    headers.append("Set-Cookie", clearBrowserAccountSetCookie());
    return authResponse({ ok: true, data: { signedOut: true } }, 200, headers);
  });
}
