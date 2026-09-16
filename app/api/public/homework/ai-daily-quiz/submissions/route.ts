import { createAiQuizSubmission } from "../../../../../lib/ai-daily-quiz-store";
import { readPublicHomeworkJson, withPublicHomework } from "../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const input = await readPublicHomeworkJson(request).catch((error) => error);
  if (input instanceof Error) return withPublicHomework(async () => { throw input; });
  return withPublicHomework((db) => createAiQuizSubmission(db, input));
}
