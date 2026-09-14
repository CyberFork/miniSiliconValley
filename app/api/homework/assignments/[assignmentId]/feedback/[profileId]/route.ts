import { saveManagedHomeworkFeedback } from "../../../../../../lib/managed-homework-store";
import { readPlatformJson, withPlatformApi } from "../../../../../platform/_shared";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string; profileId: string }> }) {
  const { assignmentId, profileId } = await context.params;
  return withPlatformApi(request, async ({ db, user }) => saveManagedHomeworkFeedback(db, user, assignmentId, profileId, await readPlatformJson(request)));
}
