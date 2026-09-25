import { finalizeCoursewareBundleUpload } from "../../../../../../lib/courseware-bundle-store";
import { stringValue } from "../../../../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../../../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ uploadId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    await readPlatformJson(request);
    const { uploadId } = await context.params;
    return finalizeCoursewareBundleUpload(db, user, stringValue(uploadId, "uploadId", 128));
  });
}
