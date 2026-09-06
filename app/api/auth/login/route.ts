import { loginWithPassword, revokeCurrentSession, sessionCookie } from "../../../lib/auth-store";
import { parseBoolean, parseUsername, requiredString } from "../../../lib/auth-validation";
import { readSecureJson, requestClientFingerprint, requestUserAgent } from "../../../lib/request-security";
import { authResponse, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const body = await readSecureJson(request);
    const username = parseUsername(body.username);
    const remember = parseBoolean(body.remember);
    const issued = await loginWithPassword(db, {
      username,
      remember,
      password: requiredString(body.password, "密码", 128),
      fingerprint: requestClientFingerprint(request),
      userAgent: requestUserAgent(request),
    });
    // A deliberate account switch should not leave the previous browser
    // session active and invisible in the new account's device list.
    await revokeCurrentSession(db, request.headers.get("cookie"));
    return authResponse({ ok: true, data: { user: issued.user } }, 200, { "Set-Cookie": sessionCookie(issued.token, issued.remember) });
  });
}
