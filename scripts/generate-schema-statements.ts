import { readdir, readFile, writeFile } from "node:fs/promises";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);
const outputPath = new URL("../db/schema-statements.ts", import.meta.url);
const migrationNames = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
const statements: string[] = [];
for (const migrationName of migrationNames) {
  const migration = await readFile(new URL(migrationName, migrationsDirectory), "utf8");
  statements.push(
    ...migration
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) =>
        statement
          .replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")
          .replace(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX IF NOT EXISTS ")
          .replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS "),
      ),
  );
}
const source = `// Generated from ${migrationNames.join(", ")}. Do not edit by hand.\nexport const CLASSROOM_SCHEMA_STATEMENTS = ${JSON.stringify(statements, null, 2)} as const;\n`;
await writeFile(outputPath, source);
console.log(`Generated ${statements.length} D1 schema statements from ${migrationNames.length} migration(s).`);
