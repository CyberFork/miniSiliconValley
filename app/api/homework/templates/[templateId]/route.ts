import { updateManagedHomeworkTemplate } from "../../../../lib/managed-homework-store";
import { readPlatformJson, withPlatformApi } from "../../../platform/_shared";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await context.params;
  return withPlatformApi(request, async ({ db, user }) => updateManagedHomeworkTemplate(db, user, templateId, await readPlatformJson(request)));
}
