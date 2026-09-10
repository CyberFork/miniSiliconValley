import { saveCoursewareBundleChunk } from "../../../../../../lib/courseware-bundle-store";
import { integerValue, objectValue, stringValue } from "../../../../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../../../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ uploadId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const { uploadId } = await context.params;
    const raw = objectValue(await readPlatformJson(request));
    return saveCoursewareBundleChunk(db, user, stringValue(uploadId, "uploadId", 128), {
      path: stringValue(raw.path, "资源路径", 240),
      chunkIndex: integerValue(raw.chunkIndex, "分块序号", 0, 45),
      digest: stringValue(raw.digest, "分块 SHA-256", 64),
      dataBase64: stringValue(raw.dataBase64, "资源分块", 300_000),
    });
  });
}
