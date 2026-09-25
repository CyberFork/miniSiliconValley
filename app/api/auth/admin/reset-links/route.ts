import { issuePasswordResetToken } from "../../../../lib/auth-store";
import { parseUsername } from "../../../../lib/auth-validation";
import { publicPath } from "../../../../lib/public-path";
import { readSecureJson } from "../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    const issued = await issuePasswordResetToken(db, actor, parseUsername(body.username));
    const origin = process.env.MSV_SITE_ORIGIN || new URL(request.url).origin;
    const resetPage = new URL(publicPath("/auth/reset"), origin).toString();
    return {
      username: issued.username,
      displayName: issued.displayName,
      expiresAt: issued.expiresAt,
      // A URL fragment is not sent in HTTP requests, reverse-proxy logs, or
      // referrer headers. The reset page removes it from browser history after
      // reading it into memory.
      resetUrl: `${resetPage}#token=${encodeURIComponent(issued.token)}`,
    };
  });
}
