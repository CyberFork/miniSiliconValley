import { createClassroomInstance, listClassroomInstances } from "../../../lib/classroom-platform-store";
import { ClassroomError } from "../../../lib/classroom-errors";
import { parseFactoryRequest } from "../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, ({ db, user }) => listClassroomInstances(db, user));
}

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const input = parseFactoryRequest(await readPlatformJson(request));
    try { return await createClassroomInstance(db, user, input); }
    catch (error) {
      if (error instanceof ClassroomError) throw error;
      throw new ClassroomError("CLASSROOM_FACTORY_INVALID", error instanceof Error ? error.message : "课堂工厂参数无效。", 400);
    }
  });
}
