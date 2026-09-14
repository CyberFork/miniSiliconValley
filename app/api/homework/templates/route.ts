import { createManagedHomeworkTemplate, listManagedHomeworkTemplates } from "../../../lib/managed-homework-store";
import { readPlatformJson, withPlatformApi } from "../../platform/_shared";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return withPlatformApi(request, ({ db, user }) => listManagedHomeworkTemplates(db, user)); }
export async function POST(request: Request) { return withPlatformApi(request, async ({ db, user }) => createManagedHomeworkTemplate(db, user, await readPlatformJson(request))); }
