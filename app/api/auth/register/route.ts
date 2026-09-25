import { issuedSessionHeaders, registerUser } from "../../../lib/auth-store";
import { parseBoolean, parseDisplayName, parsePassword, parseUsername } from "../../../lib/auth-validation";
import { readSecureJson, requestClientFingerprint, requestUserAgent } from "../../../lib/request-security";
import { authResponse, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const body = await readSecureJson(request);
    const issued = await registerUser(db, {
      username: parseUsername(body.username),
      displayName: parseDisplayName(body.displayName),
      password: parsePassword(body.password),
      remember: parseBoolean(body.remember),
      fingerprint: requestClientFingerprint(request),
      userAgent: requestUserAgent(request),
      cookieHeader: request.headers.get("cookie"),
    });
    return authResponse(
      {
        ok: true,
        data: {
          user: issued.user,
          accountSet: issued.browserSet?.state ?? null,
          admission: {
            policyVersion: "open-learner-v1",
            role: "learner",
            releasedCourseware: true,
            classroomMembership: "required",
            studio: false,
            candidatePreview: false,
            testImpersonation: false,
          },
        },
      },
      201,
      issuedSessionHeaders(issued),
    );
  });
}
