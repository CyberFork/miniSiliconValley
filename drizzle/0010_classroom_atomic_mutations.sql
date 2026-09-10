-- T-101 keeps mutable Classroom work on an explicit run identity without
-- rebuilding the historical submission table.  The companion row is the CAS
-- authority for each submission; existing rows are backfilled into the
-- Classroom run that is current at migration time.
CREATE TABLE `classroom_atomic_assertions` (
	`id` integer PRIMARY KEY NOT NULL,
	`verified_at` text NOT NULL,
	CONSTRAINT "chk_classroom_atomic_assertion" CHECK (`id` = 1)
);
--> statement-breakpoint
CREATE TABLE `classroom_submission_revisions` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`reset_generation` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_mutation_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `classroom_block_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_submission_revision_generation" CHECK (`reset_generation` >= 0),
	CONSTRAINT "chk_classroom_submission_revision_version" CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_submission_revisions_run` ON `classroom_submission_revisions` (`room_id`,`reset_generation`,`version`);
--> statement-breakpoint
INSERT OR IGNORE INTO `classroom_submission_revisions`
  (`submission_id`, `room_id`, `reset_generation`, `version`, `last_mutation_id`, `updated_at`)
SELECT s.`id`, s.`room_id`, ci.`reset_generation`, 1,
       'migration:' || s.`id`, s.`updated_at`
FROM `classroom_block_submissions` s
JOIN `classroom_instances` ci ON ci.`room_id` = s.`room_id`;
--> statement-breakpoint

-- Durable mutation receipts make a response-loss retry idempotent.  They are
-- intentionally retained across Test resets, so an old-run request can never
-- be mistaken for a mutation in the new run.
CREATE TABLE `classroom_submission_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`submission_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`block_id` text NOT NULL,
	`kind` text NOT NULL,
	`reset_generation` integer NOT NULL,
	`operation` text NOT NULL,
	`expected_version` integer NOT NULL,
	`resulting_version` integer NOT NULL,
	`payload_digest` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_submission_mutation_operation" CHECK (`operation` in ('submit', 'review')),
	CONSTRAINT "chk_classroom_submission_mutation_generation" CHECK (`reset_generation` >= 0),
	CONSTRAINT "chk_classroom_submission_mutation_versions" CHECK (`expected_version` >= 0 AND `resulting_version` = `expected_version` + 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_submission_mutation_key` ON `classroom_submission_mutations` (`room_id`,`profile_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_submission_mutations_submission` ON `classroom_submission_mutations` (`room_id`,`submission_id`,`created_at`);
--> statement-breakpoint

-- An unlock first claims one exact script version in this append-only guard.
-- The assertion immediately after the claim aborts the complete D1 batch when
-- the guard row was not created, so a stale writer cannot reach lifecycle or
-- audit writes. A later statement failure also rolls the whole batch back.
CREATE TABLE `classroom_script_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`reset_generation` integer NOT NULL,
	`expected_version` integer NOT NULL,
	`resulting_version` integer NOT NULL,
	`from_block_id` text NOT NULL,
	`to_block_id` text NOT NULL,
	`actor_profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_classroom_script_mutation_generation" CHECK (`reset_generation` >= 0),
	CONSTRAINT "chk_classroom_script_mutation_versions" CHECK (`expected_version` >= 1 AND `resulting_version` = `expected_version` + 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_script_mutation_version` ON `classroom_script_mutations` (`room_id`,`reset_generation`,`resulting_version`);
--> statement-breakpoint

-- Reset uses the same claim-first pattern.  The unique from-generation key
-- guarantees that only one reset can transform a given Test run.
CREATE TABLE `classroom_reset_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`from_generation` integer NOT NULL,
	`to_generation` integer NOT NULL,
	`actor_profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_classroom_reset_mutation_generations" CHECK (`from_generation` >= 0 AND `to_generation` = `from_generation` + 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_reset_mutation_generation` ON `classroom_reset_mutations` (`room_id`,`from_generation`);
