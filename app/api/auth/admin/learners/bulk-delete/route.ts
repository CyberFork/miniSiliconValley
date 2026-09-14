import {
  deleteAdminManagedLearners,
  previewAdminManagedLearnerBulkDeletion,
} from "../../../../../lib/auth-store";
import { readSecureJson } from "../../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    return previewAdminManagedLearnerBulkDeletion(db, actor, body.userIds);
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    return deleteAdminManagedLearners(db, actor, body.userIds, body.confirmation);
  });
}
