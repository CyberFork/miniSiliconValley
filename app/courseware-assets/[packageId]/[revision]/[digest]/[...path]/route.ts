import { ensureClassroomSchema, getClassroomDb } from "../../../../../../db";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { canReadCandidateBundle, loadCoursewareBundleAsset } from "../../../../../lib/courseware-bundle-store";
import { ClassroomError } from "../../../../../lib/classroom-errors";
import { isCoursewareLibraryVisible, loadCoursewareExact } from "../../../../../lib/courseware-store";

export const dynamic = "force-dynamic";

const HTML_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ packageId: string; revision: string; digest: string; path: string[] }> }): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return errorResponse(401, "请先登录 Mini Silicon Valley。");
  if (user.mustChangePassword || !["admin", "mentor", "learner"].includes(user.role ?? "")) {
    return errorResponse(403, "当前身份不能读取导师课件资源。");
  }
  const params = await context.params;
  if (!/^\d+$/.test(params.revision) || !/^[0-9a-f]{64}$/.test(params.digest)) return errorResponse(404, "资源不存在。");
  const revision = Number(params.revision);
  if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(params.path) || params.path.length === 0) return errorResponse(404, "资源不存在。");
  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  try {
    const content = await loadCoursewareExact(db, params.packageId, revision, params.digest);
    const publicReleased = !user.impersonation && isCoursewareLibraryVisible(content);
    if (!publicReleased && !await canReadCandidateBundle(db, { userId: user.userId, role: user.role, classroomId: user.impersonation?.classroomId ?? null }, content)) {
      return errorResponse(403, "这个 Candidate 课件只对作者、管理员或绑定的 Test Classroom 成员开放。");
    }
    const asset = await loadCoursewareBundleAsset(db, {
      packageId: params.packageId,
      revision,
      digest: params.digest,
      path: params.path.join("/"),
    });
    const bytes = asset.bytes.slice().buffer as ArrayBuffer;
    return new Response(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private, no-transform",
        "Content-Type": asset.mediaType,
        "Content-Length": String(asset.bytes.byteLength),
        ETag: `"sha256-${asset.digest}"`,
        "Content-Security-Policy": asset.mediaType.startsWith("text/html") ? HTML_CSP : "default-src 'none'; frame-ancestors 'self'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    if (error instanceof ClassroomError) return errorResponse(error.status, error.message);
    console.error("[courseware-bundle-asset]", error);
    return errorResponse(500, "课件资源暂时无法读取。");
  }
}
