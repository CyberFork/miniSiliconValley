import { retiredClassroomApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return retiredClassroomApi(request);
}
