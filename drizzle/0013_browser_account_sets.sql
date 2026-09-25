-- T-106 keeps several explicitly authenticated accounts in one browser while
-- exposing exactly one effective identity at a time.  The clear set secret is
-- only carried by a Secure, HttpOnly cookie; D1 stores its SHA-256 digest.
CREATE TABLE `auth_browser_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`active_user_id` text,
	`active_session_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`active_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`active_session_id`) REFERENCES `auth_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_auth_browser_set_version" CHECK (`version` >= 1),
	CONSTRAINT "chk_auth_browser_set_active_pair" CHECK ((`active_user_id` IS NULL AND `active_session_id` IS NULL) OR (`active_user_id` IS NOT NULL AND `active_session_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_browser_sets_token_hash` ON `auth_browser_sets` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_auth_browser_sets_active` ON `auth_browser_sets` (`revoked_at`,`expires_at`,`last_seen_at`);
--> statement-breakpoint
CREATE TABLE `auth_browser_accounts` (
	`set_id` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_version` text NOT NULL,
	`remember` integer DEFAULT false NOT NULL,
	`expires_at` text NOT NULL,
	`authenticated_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`reauth_required_at` text,
	`removed_at` text,
	FOREIGN KEY (`set_id`) REFERENCES `auth_browser_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	PRIMARY KEY (`set_id`,`user_id`),
	CONSTRAINT "chk_auth_browser_account_remember" CHECK (`remember` in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_auth_browser_accounts_user` ON `auth_browser_accounts` (`user_id`,`removed_at`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `auth_browser_session_links` (
	`session_id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `auth_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`set_id`) REFERENCES `auth_browser_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_auth_browser_session_links_set_user` ON `auth_browser_session_links` (`set_id`,`user_id`,`session_id`);
--> statement-breakpoint
CREATE TABLE `auth_browser_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`expected_version` integer NOT NULL,
	`result_version` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `auth_browser_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_auth_browser_mutation_action" CHECK (`action` in ('login', 'ensure', 'switch', 'logout-current', 'remove', 'logout-all')),
	CONSTRAINT "chk_auth_browser_mutation_versions" CHECK (`expected_version` >= 1 AND `result_version` = `expected_version` + 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_browser_mutations_idempotency` ON `auth_browser_mutations` (`set_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_auth_browser_mutations_time` ON `auth_browser_mutations` (`set_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `auth_browser_atomic_assertions` (
	`id` integer PRIMARY KEY NOT NULL,
	`verified_at` text NOT NULL,
	CONSTRAINT "chk_auth_browser_atomic_assertion" CHECK (`id` = 1)
);
--> statement-breakpoint
-- A set may only point at an active session that belongs to the same set and
-- user.  This protects the identity boundary even if application code regresses.
CREATE TRIGGER IF NOT EXISTS `trg_auth_browser_set_active_integrity`
BEFORE UPDATE OF `active_user_id`, `active_session_id` ON `auth_browser_sets`
WHEN NEW.`active_user_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1
	FROM `auth_browser_accounts` a
	JOIN `auth_browser_session_links` l
	  ON l.`set_id` = a.`set_id` AND l.`user_id` = a.`user_id`
	JOIN `auth_sessions` s ON s.`id` = l.`session_id`
	WHERE a.`set_id` = NEW.`id`
	  AND a.`user_id` = NEW.`active_user_id`
	  AND l.`session_id` = NEW.`active_session_id`
	  AND a.`removed_at` IS NULL
	  AND a.`reauth_required_at` IS NULL
	  AND s.`revoked_at` IS NULL
)
BEGIN SELECT RAISE(ABORT, 'AUTH_BROWSER_ACTIVE_INTEGRITY'); END;
