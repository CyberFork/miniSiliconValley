import { ensureClassroomSchema, getClassroomDb } from "../../../../db";
import { listPublicReleasedCourseSummaries } from "../../../lib/course-registry";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const courses = await listPublicReleasedCourseSummaries(db);
    return Response.json({ ok: true, data: { courses } }, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[public-course-catalog]", error);
    return Response.json({ ok: false, error: { code: "COURSE_CATALOG_UNAVAILABLE", message: "课程目录暂时无法读取，请稍后重试。" } }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
