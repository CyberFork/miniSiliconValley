import { resetAdminManagedLearnerPassword } from "../../../../../../lib/auth-store";
import { readSecureJson } from "../../../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    const { userId } = await context.params;
    await resetAdminManagedLearnerPassword(db, actor, userId, body.newPassword);
    return { updated: true };
  });
}
