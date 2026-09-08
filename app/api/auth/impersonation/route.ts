import { startTestImpersonation, stopTestImpersonation } from "../../../lib/auth-store";
import { requiredString } from "../../../lib/auth-validation";
import { consumeEmptyMutation, readSecureJson } from "../../../lib/request-security";
import { authResponse, requireApiUser, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const current = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    const context = await startTestImpersonation(db, current, {
      classroomId: requiredString(body.classroomId, "Test Classroom", 128),
      effectiveProfileId: requiredString(body.effectiveProfileId, "测试账号", 128),
    });
    return authResponse({ ok: true, data: context }, 200, { "Clear-Site-Data": '"cache", "storage"' });
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    await consumeEmptyMutation(request);
    const current = await requireApiUser(db, request);
    const stopped = await stopTestImpersonation(db, current);
    return authResponse({ ok: true, data: { stopped } }, 200, { "Clear-Site-Data": '"cache", "storage"' });
  });
}
