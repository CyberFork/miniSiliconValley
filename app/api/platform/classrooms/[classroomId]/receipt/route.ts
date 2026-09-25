import { acceptTestClassroom } from "../../../../../lib/classroom-platform-store";
import type { UiAcceptanceClient } from "../../../../../lib/course-acceptance";
import { objectValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId } = await context.params;
    const clientMatrix: UiAcceptanceClient[] = Array.isArray(raw.clientMatrix)
      ? raw.clientMatrix.map((item) => {
          const client = objectValue(item, "clientMatrix item");
          const viewport = objectValue(client.viewport, "viewport");
          return {
            browser: typeof client.browser === "string" ? client.browser : "",
            viewport: { width: Number(viewport.width), height: Number(viewport.height) },
            ...(typeof client.platform === "string" ? { platform: client.platform } : {}),
          };
        })
      : [];
    return acceptTestClassroom(db, user, classroomId, objectValue(raw.checks ?? {}, "checks"), clientMatrix);
  });
}
