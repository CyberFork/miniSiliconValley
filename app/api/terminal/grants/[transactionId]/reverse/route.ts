import { reverseTerminalGrant } from "../../../../../lib/terminal-store";
import { readPlatformJson, withPlatformApi } from "../../../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ transactionId: string }> }): Promise<Response> {
  const { transactionId } = await context.params;
  return withPlatformApi(request, async ({ db, user }) => reverseTerminalGrant(db, user, transactionId, await readPlatformJson(request)));
}
