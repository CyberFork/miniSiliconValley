import { clearSessionCookie, revokeCurrentSession } from "../../../lib/auth-store";
import { consumeEmptyMutation } from "../../../lib/request-security";
import { authResponse, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    await consumeEmptyMutation(request);
    await revokeCurrentSession(db, request.headers.get("cookie"));
    return authResponse({ ok: true, data: { signedOut: true } }, 200, {
      "Set-Cookie": clearSessionCookie(),
      "Clear-Site-Data": '"cache"',
    });
  });
}
