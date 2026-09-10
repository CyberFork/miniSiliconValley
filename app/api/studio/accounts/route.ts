import { createManagedUsers, listStudioAssignableAccounts } from "../../../lib/auth-store";
import { objectValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const query = new URL(request.url).searchParams.get("q");
    return listStudioAssignableAccounts(
      db,
      { userId: user.userId, role: user.platformRole ?? "learner" },
      query,
    );
  });
}

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const accounts = Array.isArray(raw.accounts) ? raw.accounts.map((item) => objectValue(item, "账号")) : [];
    return createManagedUsers(db, { userId: user.userId, role: user.platformRole ?? "learner" }, accounts.map((item) => ({
      username: item.username,
      displayName: item.displayName,
      role: item.role,
    })));
  });
}
