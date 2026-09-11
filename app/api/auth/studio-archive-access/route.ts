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
 * Nginx calls this endpoint before serving the frozen early-Workshop archive.
 * The archive is internal design history, not learner courseware: only a real
 * signed-in mentor or platform administrator may read it. Test impersonation
 * and accounts awaiting password setup stay inside their current boundary.
 * No identity data is returned to the gateway.
 */
export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return noStore(401);
  if (user.impersonation || user.mustChangePassword || !["admin", "mentor"].includes(user.role ?? "")) return noStore(403);
  return noStore(204);
}
