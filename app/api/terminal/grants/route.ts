import { grantTerminalCoins, listGrantClassrooms, listTerminalGrantHistory } from "../../../lib/terminal-store";
import { readPlatformJson, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => ({ rooms: await listGrantClassrooms(db, user), grants: await listTerminalGrantHistory(db, user) }));
}

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => grantTerminalCoins(db, user, await readPlatformJson(request)));
}
