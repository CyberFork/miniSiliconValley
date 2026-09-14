import { createFirstGameSubmission, listFirstGameSubmissions } from "../../../../../lib/homework-store";
import { readPublicHomeworkJson, withPublicHomework } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  return withPublicHomework((db) => listFirstGameSubmissions(db, page));
}

export async function POST(request: Request): Promise<Response> {
  const input = await readPublicHomeworkJson(request).catch((error) => error);
  if (input instanceof Error) return withPublicHomework(async () => { throw input; });
  return withPublicHomework((db) => createFirstGameSubmission(db, input));
}
