import { deleteTestClassroom, getClassroomInstance, previewTestClassroomDeletion } from "../../../../lib/classroom-platform-store";
import { parseDeleteClassroomRequest } from "../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const { classroomId } = await context.params;
    const url = new URL(request.url);
    if (url.searchParams.get("deletePreview") === "1") {
      return previewTestClassroomDeletion(db, user, classroomId);
    }
    return getClassroomInstance(db, user, classroomId, {
      ...(url.searchParams.get("block") ? { blockId: url.searchParams.get("block")! } : {}),
      ...(url.searchParams.get("viewAs") ? { viewAsProfileId: url.searchParams.get("viewAs")! } : {}),
      ...(url.searchParams.get("surface") === "control" ? { surface: "control" as const } : {}),
    });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const { classroomId } = await context.params;
    const input = parseDeleteClassroomRequest(await readPlatformJson(request));
    return deleteTestClassroom(db, user, classroomId, input);
  });
}
