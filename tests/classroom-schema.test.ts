import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { CLASSROOM_SCHEMA_STATEMENTS } from "../db/schema-statements";

const tables = [
  "auth_users", "auth_sessions", "auth_codes", "auth_invitations", "auth_recovery_codes", "auth_reset_tokens", "auth_rate_limits", "auth_security_events",
  "profiles", "rooms", "teams", "memberships", "card_grants", "intelligence_nodes", "intelligence_edges",
  "challenge_runs", "challenge_actions", "reputation_entries", "ledger_accounts", "ledger_transactions",
  "team_assets", "purchase_proposals", "purchase_votes", "gratitude_votes", "worldline_entries", "audit_events",
  "team_access_ids", "team_join_requests",
  "course_versions", "course_release_pointers", "room_course_bindings", "alpha_run_rooms", "course_registry_events",
  "course_candidate_pointers", "course_test_receipts", "courseware_packages", "courseware_versions",
  "courseware_release_pointers", "room_courseware_bindings", "classroom_instances", "classroom_mentor_seats",
  "classroom_permissions", "classroom_admin_dm_grants", "classroom_controller_states", "classroom_factory_events",
  "classroom_script_progress",
  "classroom_block_submissions", "classroom_wallet_balances",
  "classroom_atomic_assertions", "classroom_submission_revisions", "classroom_submission_mutations",
  "classroom_script_mutations", "classroom_reset_mutations",
  "course_view_acceptance_receipts", "course_ui_acceptance_receipts", "classroom_acceptance_bindings",
  "auth_impersonations",
  "course_exact_integrity_guard",
  "courseware_releases", "courseware_exact_integrity_guard", "courseware_bundle_uploads",
  "courseware_bundle_files", "courseware_bundle_chunks", "courseware_bundle_versions",
];
const migrationNames = readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
assert.ok(migrationNames.length >= 2, "classroom and auth migrations are required");
const migration = migrationNames.map((name) => readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8")).join("\n");
const hosting = JSON.parse(readFileSync(new URL("../.openai/hosting.json", import.meta.url), "utf8")) as { d1?: string | null };
const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
const store = readFileSync(new URL("../app/lib/classroom-store.ts", import.meta.url), "utf8");

test("initial D1 migration contains the complete classroom domain", () => {
  for (const table of tables) assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"), `missing table ${table}`);
  assert.equal((migration.match(/CREATE TABLE/g) ?? []).length, tables.length);
  assert.match(migration, /`chapter_id` text NOT NULL[\s\S]*CREATE UNIQUE INDEX `uidx_ledger_transactions_idempotency`/);
  assert.match(migration, /CONSTRAINT "chk_ledger_accounts_non_negative" CHECK\("ledger_accounts"\."balance_tenths" >= 0\)/);
  assert.match(migration, /uidx_memberships_team_seat/);
  assert.match(migration, /uidx_memberships_team_pdmo/);
  assert.match(migration, /uidx_reputation_evidence_dimension/);
  assert.match(migration, /`paused` integer DEFAULT false NOT NULL/);
  assert.match(migration, /`phase_deadline_at` text/);
});

test("runtime schema bootstrap is idempotent and exactly mirrors the migration", () => {
  assert.ok(CLASSROOM_SCHEMA_STATEMENTS.length >= tables.length);
  for (const table of tables) assert.ok(CLASSROOM_SCHEMA_STATEMENTS.some((statement) => statement.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``)));
  for (const statement of CLASSROOM_SCHEMA_STATEMENTS) {
    const executable = statement.replace(/^(?:--[^\n]*(?:\n|$))+/g, "").trimStart();
    if (/^UPDATE\s/i.test(executable)) {
      assert.match(executable, /WHERE [\s\S]*(?:IS NULL|<\s*2)/i, "data updates must be guarded and repeatable");
    } else if (/^INSERT OR IGNORE\s/i.test(executable)) {
      assert.match(executable, /(?:classroom_admin_dm_grants|classroom_script_progress|classroom_submission_revisions|courseware_releases)/, "backfills must be conflict-safe and repeatable");
    } else if (/^INSERT INTO `(?:course|courseware)_exact_integrity_guard`/i.test(executable)) {
      assert.match(executable, /CASE WHEN[\s\S]*ON CONFLICT\(`id`\) DO NOTHING/, "exact preflight must fail closed and remain repeatable");
    } else if (/^DROP INDEX IF EXISTS\s/i.test(executable)) {
      assert.match(executable, /uidx_course_versions_digest/, "only the superseded digest-only identity may be dropped");
    } else {
      assert.match(executable, /IF NOT EXISTS/, "DDL bootstrap must be repeatable");
    }
  }
});

test("unified course factory keeps release, courseware, permissions and script progress exact", () => {
  for (const marker of [
    "uidx_course_test_receipts_exact",
    "uidx_courseware_versions_digest",
    "uidx_room_courseware_role",
    "uidx_classroom_mentor_profile",
    "uidx_classroom_permissions_grant",
    "uidx_classroom_admin_dm_grant",
    "uidx_classroom_admin_dm_primary_room",
    "uidx_auth_impersonations_active_session",
    "classroom_controller_states",
    "classroom_script_progress",
    "chk_classroom_script_progress_index",
    "chk_classroom_wallet_non_negative",
    "uidx_course_view_acceptance_exact",
    "uidx_course_ui_acceptance_run",
    "idx_classroom_acceptance_view",
    "uidx_course_versions_exact",
    "trg_course_version_immutable_update",
    "trg_course_version_immutable_delete",
    "trg_course_candidate_exact_insert",
    "trg_course_release_exact_update",
    "trg_classroom_instance_course_exact_insert",
    "uidx_courseware_releases_exact",
    "uidx_courseware_bundle_versions_tree",
    "trg_courseware_version_immutable_update",
    "trg_courseware_release_exact_insert",
    "uidx_classroom_submission_mutation_key",
    "uidx_classroom_script_mutation_version",
    "uidx_classroom_reset_mutation_generation",
    "chk_classroom_atomic_assertion",
  ]) assert.match(migration, new RegExp(marker));
  assert.match(migration, /DROP INDEX IF EXISTS `uidx_course_versions_digest`/);
  assert.match(migration, /CHECK \(`environment` in \('test', 'production'\)\)/);
  assert.match(migration, /CHECK \(`mentor_role` in \('P', 'D', 'M', 'O'\)\)/);
  assert.match(migration, /CHECK \(`state` in \('ready', 'executing', 'awaiting-acceptance', 'accepted', 'completed', 'error'\)\)/);
});

test("simplified account and team migration retires old credentials without deleting audit history", () => {
  assert.match(migration, /CREATE TABLE `auth_reset_tokens`/);
  assert.match(migration, /CREATE TABLE `team_access_ids`/);
  assert.match(migration, /CREATE TABLE `team_join_requests`/);
  assert.match(migration, /UPDATE `auth_codes`\s+SET `consumed_at` =/);
  assert.match(migration, /UPDATE `auth_recovery_codes`\s+SET `consumed_at` =/);
  assert.match(migration, /UPDATE `auth_invitations`\s+SET `revoked_at` =/);
  assert.doesNotMatch(migration, /DROP TABLE\s+(?:auth_codes|auth_recovery_codes|auth_invitations)/i);
});

test("hosting and worker expose the logical DB binding", () => {
  assert.equal(hosting.d1, "DB");
  assert.match(worker, /DB: D1Database/);
});

test("store enforces server-side membership, DM gates, atomic ledger and privacy projection", () => {
  assert.match(store, /requireMembership\(db, roomId, user\.userId\)/);
  assert.match(store, /function requireDm/);
  assert.match(store, /await db\.batch\(statements\)/);
  assert.match(store, /idempotency_key/);
  assert.match(store, /balance_tenths = balance_tenths -/);
  assert.match(store, /publicChapter: Omit<ClassroomChapter, "identities" \| "infoCards" \| "historyReveal" \| "dm" \| "challenges">/);
  assert.match(store, /dm: viewer\.role === "dm" \? chapter\.dm : null/);
  assert.match(store, /viewer\.role === "learner" \? toStudentInfoCard\(card\) : card/);
  assert.doesNotMatch(store, /SELECT \* FROM profiles/);
});
