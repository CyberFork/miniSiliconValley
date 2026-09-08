import { createManagedUsers } from "../../../lib/auth-store";
import { objectValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const result = await db.prepare(
      `SELECT id, username, display_name, role, status FROM auth_users
       WHERE status = 'active' AND role IN ('admin', 'mentor', 'learner')
       ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'mentor' THEN 2 ELSE 3 END, username LIMIT 200`,
    ).all<{ id: string; username: string; display_name: string; role: string; status: string }>();
    return (result.results ?? []).map((row) => ({ userId: row.id, username: row.username, displayName: row.display_name, role: row.role, status: row.status }));
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
