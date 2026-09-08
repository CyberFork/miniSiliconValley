import { authResponse } from "../../_shared";

/** Explicit tombstone for the retired one-time login-code API. */
export async function POST(request: Request): Promise<Response> {
  await request.text();
  return authResponse({
    ok: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "登录验证码已停用；账号统一使用用户名和密码。",
    },
  }, 404);
}
