import { chmod, readFile, writeFile } from "node:fs/promises";
import { CLASSROOM_SCHEMA_STATEMENTS } from "../db/schema-statements";
import { createPasswordDigest } from "../app/lib/auth-crypto";
import type { AuthRole } from "../app/lib/auth-model";

type Account = { username: string; password: string; name?: string; role?: AuthRole };
type AccountFile = {
  generatedAt?: string;
  target?: string;
  dm: Account;
  mentors?: Account[];
  learners: Account[];
  outsider: Account;
};

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) throw new Error("Usage: --accounts <json> --output <sql> [--write-secrets yes]");
  args.set(key, value);
}
const accountsPath = args.get("--accounts");
const outputPath = args.get("--output");
if (!accountsPath || !outputPath) throw new Error("--accounts and --output are required");

const accounts = JSON.parse(await readFile(accountsPath, "utf8")) as AccountFile;
if (!accounts.dm || !Array.isArray(accounts.learners) || !accounts.outsider) throw new Error("invalid account file");
const dmRole = accounts.dm.role ?? "admin";
if (dmRole !== "admin" && dmRole !== "mentor") throw new Error("dm role must be admin or mentor");
const entries: Array<{ account: Account; role: AuthRole }> = [
  { account: accounts.dm, role: dmRole },
  ...(accounts.mentors ?? []).map((account) => ({ account, role: account.role ?? "mentor" as AuthRole })),
  ...accounts.learners.map((account) => ({ account, role: "learner" as const })),
  { account: accounts.outsider, role: "observer" },
];
for (const { account, role } of entries.slice(1, 1 + (accounts.mentors?.length ?? 0))) {
  if (role !== "mentor" && role !== "admin") throw new Error(`mentor account must use mentor/admin role: ${account.username}`);
}
if (new Set(entries.map(({ account }) => account.username)).size !== entries.length) throw new Error("usernames must be unique");
for (const { account } of entries) {
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(account.username)) throw new Error(`invalid username: ${account.username}`);
  if (Array.from(account.password).length < 12) throw new Error(`password too short: ${account.username}`);
}

const now = new Date().toISOString();
const statements = [...CLASSROOM_SCHEMA_STATEMENTS.map(terminate)];
for (const { account, role } of entries) {
  const password = await createPasswordDigest(account.password);
  const displayName = account.name?.trim() || account.username;
  statements.push(
    `INSERT OR IGNORE INTO auth_users
     (id, username, display_name, role, status, password_hash, password_salt, password_iterations,
      password_changed_at, must_change_password, created_at, updated_at)
     VALUES (${q(account.username)}, ${q(account.username)}, ${q(displayName)}, ${q(role)}, 'active',
      ${q(password.hash)}, ${q(password.salt)}, ${password.iterations}, ${q(now)}, 0, ${q(now)}, ${q(now)});`,
    `INSERT OR IGNORE INTO profiles (id, nickname, created_at, updated_at)
     VALUES (${q(account.username)}, ${q(displayName)}, ${q(now)}, ${q(now)});`,
    `INSERT OR IGNORE INTO ledger_accounts
     (id, kind, room_id, team_id, owner_profile_id, balance_tenths, created_at)
     VALUES (${q(`wallet:${account.username}`)}, 'personal-wallet', NULL, NULL, ${q(account.username)}, 0, ${q(now)});`,
  );
}
statements.push(
  `INSERT INTO auth_security_events (id, user_id, actor_user_id, action, detail_json, created_at)
   SELECT ${q(crypto.randomUUID())}, ${q(accounts.dm.username)}, ${q(accounts.dm.username)},
    'auth.seed.completed', ${q(JSON.stringify({ users: entries.length }))}, ${q(now)}
   WHERE NOT EXISTS (SELECT 1 FROM auth_security_events WHERE action = 'auth.seed.completed');`,
);

await writeFile(outputPath, `${statements.join("\n\n")}\n`, { mode: 0o600 });
await chmod(outputPath, 0o600);
if (args.get("--write-secrets") === "yes") {
  await writeFile(accountsPath, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 });
  await chmod(accountsPath, 0o600);
}
console.log(`AUTH_SEED_READY users=${entries.length} statements=${statements.length} output=${outputPath}`);

function q(value: string): string { return `'${value.replaceAll("'", "''")}'`; }
function terminate(statement: string): string { return `${statement.trim().replace(/;$/, "")};`; }
