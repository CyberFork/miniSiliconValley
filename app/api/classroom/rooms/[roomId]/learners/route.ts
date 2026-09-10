import { retiredClassroomApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return retiredClassroomApi(request);
}
