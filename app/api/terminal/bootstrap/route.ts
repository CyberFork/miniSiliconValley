import { getTerminalBootstrap } from "../../../lib/terminal-store";
import { withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withPlatformApi(request, ({ db, user }) => getTerminalBootstrap(db, user));
}
