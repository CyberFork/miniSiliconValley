-- T-111 models archival as an immutable retention marker instead of rewriting
-- the Classroom run lifecycle.  A completed run therefore remains completed
-- for historical inspection, while current receipt eligibility can reject the
-- archived source explicitly.
CREATE TABLE `classroom_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`previous_lifecycle` text NOT NULL,
	`reset_generation` integer NOT NULL,
	`script_version` integer NOT NULL,
	`archived_by_profile_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`archived_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`archived_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_classroom_archive_lifecycle" CHECK (`previous_lifecycle` in ('draft', 'ready', 'running', 'completed', 'reset')),
	CONSTRAINT "chk_classroom_archive_generation" CHECK (`reset_generation` >= 0),
	CONSTRAINT "chk_classroom_archive_script_version" CHECK (`script_version` >= 1),
	CONSTRAINT "chk_classroom_archive_reason" CHECK (length(`reason`) <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_archive_room` ON `classroom_archives` (`room_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_archive_idempotency` ON `classroom_archives` (`room_id`,`archived_by_profile_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_archives_actor_time` ON `classroom_archives` (`archived_by_profile_id`,`archived_at`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_archive_test_only`
BEFORE INSERT ON `classroom_archives`
WHEN NOT EXISTS (
	SELECT 1 FROM `classroom_instances` ci
	WHERE ci.`room_id` = NEW.`room_id` AND ci.`environment` = 'test'
)
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_ARCHIVE_TEST_ONLY'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_archive_immutable_update`
BEFORE UPDATE ON `classroom_archives`
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_ARCHIVE_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_archive_immutable_delete`
BEFORE DELETE ON `classroom_archives`
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_ARCHIVE_IMMUTABLE:delete'); END;
