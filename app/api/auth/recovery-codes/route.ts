import { authResponse } from "../_shared";

/** Explicit tombstone for the retired recovery-code API. */
export async function POST(): Promise<Response> {
  return authResponse({
    ok: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "恢复代码已停用；请由导师或管理员生成密码重置链接。",
    },
  }, 404);
}
