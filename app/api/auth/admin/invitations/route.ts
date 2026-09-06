import { authResponse } from "../../_shared";

/** Explicit tombstone for the retired registration-invitation API. */
export async function POST(): Promise<Response> {
  return authResponse({
    ok: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "注册邀请码已停用；Young Builder 可直接注册账号。",
    },
  }, 404);
}
