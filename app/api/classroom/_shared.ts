import { drainRequestBody } from "../../lib/request-security";

/**
 * Permanent application-level tombstone for the pre-T-085 classroom runtime.
 * Keep this fail-closed even when a Worker is reached without the Nginx
 * gateway, so two classroom state machines can never accept writes.
 */
export async function retiredClassroomApi(request?: Request): Promise<Response> {
  if (request?.body) await drainRequestBody(request);
  return Response.json(
    {
      ok: false,
      error: {
        code: "LEGACY_CLASSROOM_API_RETIRED",
        message: "旧课堂 API 已永久停用。请使用版本化 /api/platform/classrooms 接口。",
      },
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        Link: '</api/platform/classrooms>; rel="successor-version"',
      },
    },
  );
}
