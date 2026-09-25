import { env } from "cloudflare:workers";

import { CLASSROOM_SCHEMA_STATEMENTS } from "./schema-statements";

export type ClassroomD1 = D1Database;

let schemaReady: Promise<void> | null = null;

export function getClassroomDb(): ClassroomD1 {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable. Set `.openai/hosting.json` d1 to `DB`.");
  }
  return env.DB as ClassroomD1;
}

export async function ensureClassroomSchema(db: ClassroomD1 = getClassroomDb()): Promise<void> {
  schemaReady ??= applySchema(db).catch((error: unknown) => {
    schemaReady = null;
    throw error;
  });
  await schemaReady;
}

async function applySchema(db: ClassroomD1): Promise<void> {
  const statements = CLASSROOM_SCHEMA_STATEMENTS.map((statement) => db.prepare(statement));
  await db.batch(statements);
}
