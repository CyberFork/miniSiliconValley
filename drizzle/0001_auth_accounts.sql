CREATE TABLE `auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'learner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`password_changed_at` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_users_username` ON `auth_users` (`username`);
--> statement-breakpoint
CREATE INDEX `idx_auth_users_status_role` ON `auth_users` (`status`,`role`);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`remember` integer DEFAULT false NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_sessions_token_hash` ON `auth_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user_active` ON `auth_sessions` (`user_id`,`revoked_at`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `auth_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts_remaining` integer DEFAULT 5 NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_auth_codes_user_purpose` ON `auth_codes` (`user_id`,`purpose`,`created_at`);
--> statement-breakpoint
CREATE TABLE `auth_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`label` text NOT NULL,
	`role` text DEFAULT 'learner' NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_invitations_code_hash` ON `auth_invitations` (`code_hash`);
--> statement-breakpoint
CREATE INDEX `idx_auth_invitations_creator` ON `auth_invitations` (`created_by_user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `auth_recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_recovery_codes_user_hash` ON `auth_recovery_codes` (`user_id`,`code_hash`);
--> statement-breakpoint
CREATE INDEX `idx_auth_recovery_codes_user_active` ON `auth_recovery_codes` (`user_id`,`consumed_at`);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`blocked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_rate_limits_updated` ON `auth_rate_limits` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `auth_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`actor_user_id` text,
	`action` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_auth_security_events_user_time` ON `auth_security_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_auth_security_events_action_time` ON `auth_security_events` (`action`,`created_at`);
