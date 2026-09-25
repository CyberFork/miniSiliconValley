import { listAiQuizSubmissions } from "../../../../lib/ai-daily-quiz-store";
import { requireStudioRole, withPlatformApi } from "../../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  return withPlatformApi(request, ({ db, user }) => {
    requireStudioRole(user);
    return listAiQuizSubmissions(db, page);
  });
}
