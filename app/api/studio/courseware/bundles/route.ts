import { beginCoursewareBundleUpload, type BundleFileDeclaration } from "../../../../lib/courseware-bundle-store";
import { integerValue, objectValue, stringValue } from "../../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const files = Array.isArray(raw.files) ? raw.files.map((value): BundleFileDeclaration => {
      const file = objectValue(value);
      return {
        path: stringValue(file.path, "资源路径", 240),
        byteLength: integerValue(file.byteLength, "资源长度", 1, 8 * 1024 * 1024),
        digest: stringValue(file.digest, "资源 SHA-256", 64),
        ...(file.mediaType === undefined ? {} : { mediaType: stringValue(file.mediaType, "资源类型", 128) }),
      };
    }) : [];
    return beginCoursewareBundleUpload(db, user, {
      ...(raw.packageId === undefined ? {} : { packageId: stringValue(raw.packageId, "packageId", 128) }),
      slug: stringValue(raw.slug, "slug", 64),
      title: stringValue(raw.title, "标题", 100),
      mentorRole: raw.mentorRole,
      entryFile: stringValue(raw.entryFile, "入口文件", 240),
      files,
    });
  });
}
