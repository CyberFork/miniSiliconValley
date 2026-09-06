import { listManagedUsers } from "../../../../lib/auth-store";
import { requireApiUser, withAuthApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return listManagedUsers(db, await requireApiUser(db, request), query);
  });
}
