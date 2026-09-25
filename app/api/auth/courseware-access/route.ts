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
 * only needs a yes/no decision. Released courseware is read-only for every
 * real signed-in learner/mentor/admin, while Test impersonation must not
 * escape its Classroom and one-time credentials must finish password setup.
 */
export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return noStore(401);
  if (user.impersonation || user.mustChangePassword || !["admin", "mentor", "learner"].includes(user.role ?? "")) return noStore(403);
  return noStore(204);
}
