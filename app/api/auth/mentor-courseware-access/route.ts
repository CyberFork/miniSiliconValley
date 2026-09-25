import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

function noStore(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Gateway-only authorization for teacher editions of bundled courseware.
 * Teacher notes are not learner course content: only a real mentor or platform
 * administrator session may fetch the HTML or any relative teacher asset.
 */
export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return noStore(401);
  if (user.impersonation || user.mustChangePassword || !["admin", "mentor"].includes(user.role ?? "")) return noStore(403);
  return noStore(204);
}
