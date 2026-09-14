import { initializeTerminalWallet, terminalEnvironment } from "../../../lib/terminal-store";
import { readPlatformJson, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const body = await readPlatformJson(request) as { environment?: unknown };
    return initializeTerminalWallet(db, user, terminalEnvironment(body?.environment));
  });
}
