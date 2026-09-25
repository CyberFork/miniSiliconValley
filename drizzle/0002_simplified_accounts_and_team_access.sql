CREATE TABLE `auth_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_reset_tokens_hash` ON `auth_reset_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_auth_reset_tokens_user_active` ON `auth_reset_tokens` (`user_id`,`consumed_at`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `team_access_ids` (
	`team_id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_team_access_ids_public_id` ON `team_access_ids` (`public_id`);
--> statement-breakpoint
CREATE TABLE `team_join_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by_profile_id` text,
	`decided_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_team_join_requests_team_profile` ON `team_join_requests` (`team_id`,`profile_id`);
--> statement-breakpoint
CREATE INDEX `idx_team_join_requests_team_status` ON `team_join_requests` (`team_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_team_join_requests_profile_status` ON `team_join_requests` (`profile_id`,`status`,`updated_at`);
--> statement-breakpoint
UPDATE `auth_codes`
SET `consumed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `consumed_at` IS NULL;
--> statement-breakpoint
UPDATE `auth_recovery_codes`
SET `consumed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `consumed_at` IS NULL;
--> statement-breakpoint
UPDATE `auth_invitations`
SET `revoked_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `revoked_at` IS NULL;
