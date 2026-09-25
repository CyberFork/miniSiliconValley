import { issuedSessionHeaders, loginWithPassword } from "../../../lib/auth-store";
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
      cookieHeader: request.headers.get("cookie"),
    });
    return authResponse({ ok: true, data: { user: issued.user, accountSet: issued.browserSet?.state ?? null } }, 200, issuedSessionHeaders(issued));
  });
}
