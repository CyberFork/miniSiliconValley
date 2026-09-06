import { getClassroomDashboard } from "../../../lib/classroom-store";
import { withClassroomApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return withClassroomApi(({ db, user }) => getClassroomDashboard(db, user));
}
