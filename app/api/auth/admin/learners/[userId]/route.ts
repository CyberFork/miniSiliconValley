import {
  deleteAdminManagedLearner,
  previewAdminManagedLearnerDeletion,
  updateAdminManagedLearner,
} from "../../../../../lib/auth-store";
import { readSecureJson } from "../../../../../lib/request-security";
import { requireApiUser, withAuthApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const { userId } = await context.params;
    return previewAdminManagedLearnerDeletion(db, actor, userId);
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const body = await readSecureJson(request);
    const { userId } = await context.params;
    return updateAdminManagedLearner(db, actor, userId, {
      displayName: body.displayName,
      adminNotes: body.adminNotes,
      status: body.status,
      regenerateAvatar: body.regenerateAvatar,
    });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  return withAuthApi(async (db) => {
    const actor = await requireApiUser(db, request);
    const { userId } = await context.params;
    await deleteAdminManagedLearner(db, actor, userId);
    return { deleted: true, userId };
  });
}
