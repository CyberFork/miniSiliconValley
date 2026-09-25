import { ClassroomError } from "../../../../../../lib/classroom-errors";
import { getFirstGameSubmission, HomeworkError, updateFirstGameSubmission } from "../../../../../../lib/homework-store";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../../../../platform/_shared";
import { withPublicHomework } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ submissionId: string }> }): Promise<Response> {
  const { submissionId } = await context.params;
  return withPublicHomework((db) => getFirstGameSubmission(db, decodeURIComponent(submissionId)));
}

export async function PATCH(request: Request, context: { params: Promise<{ submissionId: string }> }): Promise<Response> {
  const { submissionId } = await context.params;
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    try {
      return await updateFirstGameSubmission(db, decodeURIComponent(submissionId), await readPlatformJson(request), user.actorProfileId ?? user.userId);
    } catch (error) {
      if (error instanceof HomeworkError) throw new ClassroomError(error.code, error.message, error.status);
      throw error;
    }
  });
}
