import { saveOwnHomeworkResponse } from "../../../../../lib/managed-homework-store";
import { readPlatformJson, withPlatformApi } from "../../../../platform/_shared";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;
  return withPlatformApi(request, async ({ db, user }) => saveOwnHomeworkResponse(db, user, assignmentId, await readPlatformJson(request)));
}
