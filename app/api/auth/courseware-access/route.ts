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
 * Nginx uses this endpoint as an auth_request subrequest before serving a
 * bundled mentor deck.  It deliberately returns no profile data: the gateway
 * only needs a yes/no decision, and test impersonation must not inherit the
 * administrator's ability to read mentor-only material.
 */
export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return noStore(401);
  if (user.impersonation || (user.role !== "admin" && user.role !== "mentor")) return noStore(403);
  return noStore(204);
}
