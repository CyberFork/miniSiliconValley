import { updateOwnProfile } from "../../../lib/auth-store";
import { parseDisplayName, parsePassword, requiredString } from "../../../lib/auth-validation";
import { readSecureJson } from "../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const user = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    const displayName = body.displayName === undefined ? undefined : parseDisplayName(body.displayName);
    const newPassword = body.newPassword === undefined || body.newPassword === "" ? undefined : parsePassword(body.newPassword);
    const currentPassword = newPassword ? requiredString(body.currentPassword, "当前密码", 128) : undefined;
    await updateOwnProfile(db, user, { displayName, currentPassword, newPassword });
    return { updated: true };
  });
}
