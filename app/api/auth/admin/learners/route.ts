import {
  createAdminManagedLearner,
  listAdminManagedLearners,
} from "../../../../lib/auth-store";
import { readSecureJson } from "../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const params = new URL(request.url).searchParams;
    return listAdminManagedLearners(db, actor, {
      query: params.get("q") ?? "",
      status: (params.get("status") ?? "all") as "all" | "active" | "disabled",
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 20),
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    return createAdminManagedLearner(db, actor, {
      displayName: body.displayName,
      initialPassword: body.initialPassword,
      adminNotes: body.adminNotes,
      idempotencyKey: body.idempotencyKey,
    });
  });
}
