import { updateOwnPublicSpace } from "../../../lib/terminal-store";
import { readPlatformJson, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => updateOwnPublicSpace(db, user, await readPlatformJson(request)));
}
