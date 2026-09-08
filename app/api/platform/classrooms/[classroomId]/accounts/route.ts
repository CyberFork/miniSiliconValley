import { createManagedUsers } from "../../../../../lib/auth-store";
import { objectValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const accounts = Array.isArray(raw.accounts) ? raw.accounts.map((item) => objectValue(item, "账号")) : [];
    const { classroomId } = await context.params;
    return createManagedUsers(db, { userId: user.userId, role: user.platformRole ?? "learner" }, accounts.map((item) => ({
      username: item.username,
      displayName: item.displayName,
      role: item.role,
    })), classroomId);
  });
}
