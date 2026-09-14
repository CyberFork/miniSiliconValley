import { purchaseTerminalItem } from "../../../lib/terminal-store";
import { readPlatformJson, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => purchaseTerminalItem(db, user, await readPlatformJson(request)));
}
