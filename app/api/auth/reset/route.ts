import { resetPasswordWithToken, sessionCookie } from "../../../lib/auth-store";
import { parsePassword, requiredString } from "../../../lib/auth-validation";
import { readSecureJson, requestClientFingerprint, requestUserAgent } from "../../../lib/request-security";
import { authResponse, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const body = await readSecureJson(request);
    const token = requiredString(body.token, "重置链接", 128);
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
      return authResponse({ ok: false, error: { code: "RESET_LINK_INVALID", message: "重置链接无效、已使用或已经过期。" } }, 401);
    }
    const issued = await resetPasswordWithToken(db, {
      token,
      newPassword: parsePassword(body.newPassword),
      fingerprint: requestClientFingerprint(request),
      userAgent: requestUserAgent(request),
    });
    return authResponse(
      { ok: true, data: { user: issued.user } },
      200,
      { "Set-Cookie": sessionCookie(issued.token, false) },
    );
  });
}
