import { readTextEdition, saveTextEdition } from "../../../../lib/courseware-text-editions";
import { objectValue, stringValue, integerValue } from "../../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../../platform/_shared";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{deckId: string}> };
export async function GET(request: Request, context: Context) {
  return withPlatformApi(request, async ({db, user}) => {
    const {deckId} = await context.params; const query = new URL(request.url).searchParams;
    const revision = query.has("revision") ? Number(query.get("revision")) : undefined;
    return readTextEdition(db, user, deckId, stringValue(query.get("base"), "base", 100), revision);
  });
}
export async function POST(request: Request, context: Context) {
  return withPlatformApi(request, async ({db, user}) => {
    requireStudioRole(user); const raw = objectValue(await readPlatformJson(request));
    const {deckId} = await context.params;
    return saveTextEdition(db, user, deckId, {base: stringValue(raw.base, "base", 100), expectedRevision: integerValue(raw.expectedRevision, "expectedRevision", 0, 1_000_000), key: stringValue(raw.key, "key", 240), value: raw.value as string | null});
  });
}
