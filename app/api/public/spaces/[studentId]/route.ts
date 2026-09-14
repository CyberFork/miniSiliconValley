import { ensureClassroomSchema, getClassroomDb } from "../../../../../db";
import { ClassroomError } from "../../../../lib/classroom-errors";
import { getPublicTerminalSpace } from "../../../../lib/terminal-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ studentId: string }> }): Promise<Response> {
  try {
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const { studentId } = await context.params;
    return json({ ok: true, data: await getPublicTerminalSpace(db, decodeURIComponent(studentId)) }, 200);
  } catch (error) {
    if (error instanceof ClassroomError) return json({ ok: false, error: { code: error.code, message: error.message } }, error.status);
    console.error("[public-space-api]", error);
    return json({ ok: false, error: { code: "INTERNAL_ERROR", message: "空间暂时无法打开。" } }, 500);
  }
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120", "X-Content-Type-Options": "nosniff" } });
}
