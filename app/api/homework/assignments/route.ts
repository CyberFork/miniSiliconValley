import { getManagedHomeworkConsole, listOwnHomeworkAssignments, publishManagedHomeworkAssignment } from "../../../lib/managed-homework-store";
import { readPlatformJson, withPlatformApi } from "../../platform/_shared";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withPlatformApi<unknown>(request, ({ db, user }) => user.platformRole === "learner" ? listOwnHomeworkAssignments(db, user) : getManagedHomeworkConsole(db, user));
}
export async function POST(request: Request) { return withPlatformApi(request, async ({ db, user }) => publishManagedHomeworkAssignment(db, user, await readPlatformJson(request))); }
