import { listCourseware, saveCoursewareVersion } from "../../../lib/courseware-store";
import { objectValue, stringValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    return listCourseware(db);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    return saveCoursewareVersion(db, user, {
      ...(raw.packageId === undefined ? {} : { packageId: stringValue(raw.packageId, "packageId", 128) }),
      slug: stringValue(raw.slug, "slug", 64),
      title: stringValue(raw.title, "标题", 100),
      mentorRole: raw.mentorRole,
      html: stringValue(raw.html, "HTML", 700_000),
    });
  });
}
