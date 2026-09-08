import { authResponse } from "../_shared";

/**
 * Password recovery is intentionally link-based and issued by a DM/admin.
 * Keep the retired self-service API explicit so a POST cannot fall through to
 * the similarly named HTML page and become a misleading 503 in Workers.
 */
export async function POST(request: Request): Promise<Response> {
  await request.text();
  return authResponse({
    ok: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "自助找回接口已停用；请由导师或管理员生成密码重置链接。",
    },
  }, 404);
}
