import {
  browserAccountSetCookie,
  clearBrowserAccountSetCookie,
  clearSessionCookie,
  ensureBrowserAccountSet,
  getBrowserAccountSetState,
  mutateBrowserAccounts,
  sessionCookie,
  switchBrowserAccount,
} from "../../../lib/auth-store";
import { parsePositiveInteger, requiredString } from "../../../lib/auth-validation";
import { readSecureJson, requestUserAgent } from "../../../lib/request-security";
import { authResponse, requireApiUser, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withAuthApi(async (db) => ({ accountSet: await getBrowserAccountSetState(db, request.headers.get("cookie")) }));
}

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const body = await readSecureJson(request);
    const action = requiredString(body.action, "账号操作", 32);
    if (action === "ensure") {
      const user = await requireApiUser(db, request);
      const browserSet = await ensureBrowserAccountSet(db, user, request.headers.get("cookie"));
      return authResponse({ ok: true, data: { accountSet: browserSet.state } }, 200, cookieHeaders(browserSet));
    }
    const expectedVersion = parsePositiveInteger(body.expectedVersion, "账号列表版本", 1, 2_147_483_647);
    const idempotencyKey = requiredString(body.idempotencyKey, "账号操作标识", 128);
    if (action === "switch") {
      const result = await switchBrowserAccount(db, request.headers.get("cookie"), {
        targetUserId: requiredString(body.targetUserId, "目标账号", 128),
        expectedVersion,
        idempotencyKey,
        userAgent: requestUserAgent(request),
      });
      const headers = cookieHeaders(result.browserSet);
      if (result.sessionToken) headers.append("Set-Cookie", sessionCookie(result.sessionToken, result.remember, result.user.sessionExpiresAt));
      return authResponse({ ok: true, data: {
        user: result.user,
        accountSet: result.browserSet.state,
        idempotent: result.idempotent,
      } }, 200, headers);
    }
    if (action === "logout-current" || action === "logout-all" || action === "remove") {
      const result = await mutateBrowserAccounts(db, request.headers.get("cookie"), {
        action,
        targetUserId: action === "remove" ? requiredString(body.targetUserId, "目标账号", 128) : undefined,
        expectedVersion,
        idempotencyKey,
      });
      const headers = new Headers();
      if (result.clearSession) headers.append("Set-Cookie", clearSessionCookie());
      if (result.clearBrowserSet) headers.append("Set-Cookie", clearBrowserAccountSetCookie());
      else if (result.browserSet) headers.append("Set-Cookie", browserAccountSetCookie(result.browserSet));
      if (action === "logout-all") headers.set("Clear-Site-Data", '"cache", "storage"');
      return authResponse({ ok: true, data: {
        accountSet: result.browserSet?.state ?? null,
        signedOut: result.clearSession,
        idempotent: result.idempotent,
      } }, 200, headers);
    }
    return authResponse({ ok: false, error: { code: "ACCOUNT_ACTION_INVALID", message: "未知账号操作。" } }, 400);
  });
}

function cookieHeaders(browserSet: Parameters<typeof browserAccountSetCookie>[0]): Headers {
  const headers = new Headers();
  headers.append("Set-Cookie", browserAccountSetCookie(browserSet));
  return headers;
}
