CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`actor_profile_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_room_time` ON `audit_events` (`room_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `card_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`team_id` text NOT NULL,
	`card_id` text NOT NULL,
	`member_id` text NOT NULL,
	`state` text DEFAULT 'unread' NOT NULL,
	`granted_at` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_card_grants_team_chapter_card` ON `card_grants` (`room_id`,`team_id`,`chapter_id`,`card_id`);
--> statement-breakpoint
CREATE INDEX `idx_card_grants_member` ON `card_grants` (`member_id`,`chapter_id`);
--> statement-breakpoint
CREATE TABLE `challenge_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`round` integer NOT NULL,
	`member_id` text NOT NULL,
	`pdmo_role` text NOT NULL,
	`goal` text NOT NULL,
	`method` text NOT NULL,
	`evidence` text NOT NULL,
	`resource` text NOT NULL,
	`success_signal` text NOT NULL,
	`stop_condition` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `challenge_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_challenge_actions_run_round_member` ON `challenge_actions` (`run_id`,`round`,`member_id`);
--> statement-breakpoint
CREATE TABLE `challenge_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`team_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`level` integer NOT NULL,
	`pressure_die` integer,
	`round` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`consequence` text,
	`rubric_json` text,
	`resolution_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_challenge_runs_team_chapter` ON `challenge_runs` (`team_id`,`chapter_id`);
--> statement-breakpoint
CREATE TABLE `gratitude_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_gratitude_room_chapter_sender` ON `gratitude_votes` (`room_id`,`chapter_id`,`from_member_id`);
--> statement-breakpoint
CREATE TABLE `intelligence_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`team_id` text NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`kind` text NOT NULL,
	`explanation` text NOT NULL,
	`created_by_member_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_node_id`) REFERENCES `intelligence_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_node_id`) REFERENCES `intelligence_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_intelligence_edges_team_chapter` ON `intelligence_edges` (`team_id`,`chapter_id`);
--> statement-breakpoint
CREATE TABLE `intelligence_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`team_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`explanation` text NOT NULL,
	`source_card_ids_json` text NOT NULL,
	`published_by_member_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`published_by_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_intelligence_nodes_team_chapter` ON `intelligence_nodes` (`team_id`,`chapter_id`);
--> statement-breakpoint
CREATE TABLE `ledger_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`room_id` text,
	`team_id` text,
	`owner_profile_id` text,
	`balance_tenths` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_ledger_accounts_non_negative" CHECK("ledger_accounts"."balance_tenths" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ledger_accounts_team` ON `ledger_accounts` (`kind`,`room_id`,`team_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ledger_accounts_profile` ON `ledger_accounts` (`kind`,`owner_profile_id`);
--> statement-breakpoint
CREATE TABLE `ledger_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`from_account_id` text,
	`to_account_id` text,
	`amount_tenths` integer NOT NULL,
	`category` text NOT NULL,
	`source_object_id` text NOT NULL,
	`created_by_member_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reason` text NOT NULL,
	`reversal_of` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ledger_transactions_idempotency` ON `ledger_transactions` (`idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ledger_transactions_source_category` ON `ledger_transactions` (`room_id`,`category`,`source_object_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ledger_transactions_reversal` ON `ledger_transactions` (`reversal_of`);
--> statement-breakpoint
CREATE INDEX `idx_ledger_transactions_room_time` ON `ledger_transactions` (`room_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`team_id` text,
	`role` text NOT NULL,
	`seat` integer,
	`case_identity_id` text,
	`pdmo_role` text,
	`support_commitment` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_memberships_room_profile` ON `memberships` (`room_id`,`profile_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_memberships_team_seat` ON `memberships` (`team_id`,`seat`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_memberships_team_pdmo` ON `memberships` (`team_id`,`pdmo_role`);
--> statement-breakpoint
CREATE INDEX `idx_memberships_room_team` ON `memberships` (`room_id`,`team_id`);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`team_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`proposed_by_member_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposed_by_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_purchase_proposals_idempotency` ON `purchase_proposals` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_purchase_proposals_team` ON `purchase_proposals` (`team_id`,`status`);
--> statement-breakpoint
CREATE TABLE `purchase_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`member_id` text NOT NULL,
	`approve` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `purchase_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_purchase_votes_proposal_member` ON `purchase_votes` (`proposal_id`,`member_id`);
--> statement-breakpoint
CREATE TABLE `reputation_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`dimension` text NOT NULL,
	`points` integer NOT NULL,
	`evidence_object_id` text NOT NULL,
	`awarded_by_member_id` text NOT NULL,
	`reason` text NOT NULL,
	`reversal_of` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`awarded_by_member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_reputation_evidence_dimension` ON `reputation_entries` (`room_id`,`chapter_id`,`profile_id`,`dimension`,`evidence_object_id`);
--> statement-breakpoint
CREATE INDEX `idx_reputation_profile` ON `reputation_entries` (`profile_id`);
--> statement-breakpoint
CREATE INDEX `idx_reputation_room_chapter` ON `reputation_entries` (`room_id`,`chapter_id`);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`campaign_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`phase` text NOT NULL,
	`status` text NOT NULL,
	`dm_profile_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`paused_at` text,
	`phase_deadline_at` text,
	`player_timeline_frozen` integer DEFAULT false NOT NULL,
	`history_revealed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`dm_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_rooms_code` ON `rooms` (`code`);
--> statement-breakpoint
CREATE INDEX `idx_rooms_dm_status` ON `rooms` (`dm_profile_id`,`status`);
--> statement-breakpoint
CREATE TABLE `team_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`team_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`acquired_price_tenths` integer NOT NULL,
	`acquired_at` text NOT NULL,
	`last_maintained_chapter_id` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_team_assets_team_asset` ON `team_assets` (`team_id`,`asset_id`);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`seat_limit` integer DEFAULT 4 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_teams_room` ON `teams` (`room_id`);
--> statement-breakpoint
CREATE TABLE `worldline_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`team_id` text,
	`member_id` text,
	`kind` text NOT NULL,
	`content_json` text NOT NULL,
	`frozen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_worldline_room_chapter` ON `worldline_entries` (`room_id`,`chapter_id`,`kind`);
