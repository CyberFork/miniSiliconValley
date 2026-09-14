import { closeManagedHomeworkAssignment, getOwnHomeworkAssignment } from "../../../../lib/managed-homework-store";
import { ClassroomError } from "../../../../lib/classroom-errors";
import { readPlatformJson, withPlatformApi } from "../../../platform/_shared";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;
  return withPlatformApi(request, ({ db, user }) => getOwnHomeworkAssignment(db, user, assignmentId));
}
export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;
  return withPlatformApi(request, async ({ db, user }) => {
    const body = await readPlatformJson(request) as { action?: unknown };
    if (body.action !== "close") throw new ClassroomError("HOMEWORK_ACTION_INVALID", "不支持这个作业操作。", 400);
    return closeManagedHomeworkAssignment(db, user, assignmentId);
  });
}
