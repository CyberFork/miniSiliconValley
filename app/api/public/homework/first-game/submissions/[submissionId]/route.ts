import { getFirstGameSubmission } from "../../../../../../lib/homework-store";
import { withPublicHomework } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ submissionId: string }> }): Promise<Response> {
  const { submissionId } = await context.params;
  return withPublicHomework((db) => getFirstGameSubmission(db, decodeURIComponent(submissionId)));
}
