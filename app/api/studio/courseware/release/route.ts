import { releaseCoursewareVersion } from "../../../../lib/courseware-store";
import { integerValue, objectValue, stringValue } from "../../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    await releaseCoursewareVersion(db, user, {
      packageId: stringValue(raw.packageId, "packageId", 128),
      revision: integerValue(raw.revision, "revision", 0, 1_000_000),
      digest: stringValue(raw.digest, "digest", 64),
    });
    return { released: true };
  });
}
