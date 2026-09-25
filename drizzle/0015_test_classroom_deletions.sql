-- T-111: physically remove an unreferenced Test Classroom while retaining a
-- minimal immutable tombstone. The tombstone intentionally has no rooms FK.
CREATE TABLE `classroom_deletions` (
	`room_id` text PRIMARY KEY NOT NULL,
	`classroom_title` text NOT NULL,
	`environment` text NOT NULL,
	`course_id` text NOT NULL,
	`course_revision` integer NOT NULL,
	`course_digest` text NOT NULL,
	`previous_lifecycle` text NOT NULL,
	`reset_generation` integer NOT NULL,
	`script_version` integer NOT NULL,
	`was_archived` integer DEFAULT false NOT NULL,
	`deleted_by_profile_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_digest` text NOT NULL,
	`deleted_at` text NOT NULL,
	CONSTRAINT "chk_classroom_deletion_test_only" CHECK (`environment` = 'test'),
	CONSTRAINT "chk_classroom_deletion_generation" CHECK (`reset_generation` >= 0),
	CONSTRAINT "chk_classroom_deletion_script_version" CHECK (`script_version` >= 1),
	CONSTRAINT "chk_classroom_deletion_archived" CHECK (`was_archived` in (0, 1)),
	CONSTRAINT "chk_classroom_deletion_reason" CHECK (length(`reason`) <= 500),
	CONSTRAINT "chk_classroom_deletion_snapshot_digest" CHECK (length(`snapshot_digest`) = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_deletion_idempotency` ON `classroom_deletions` (`deleted_by_profile_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_deletions_actor_time` ON `classroom_deletions` (`deleted_by_profile_id`,`deleted_at`);

--> statement-breakpoint
-- Direct SQL cannot manufacture a tombstone for Production or for a missing
-- classroom. Application deletion inserts it from the same exact Test row.
CREATE TRIGGER IF NOT EXISTS `trg_classroom_deletion_test_only`
BEFORE INSERT ON `classroom_deletions`
WHEN NOT EXISTS (
	SELECT 1 FROM `classroom_instances` ci
	WHERE ci.`room_id` = NEW.`room_id` AND ci.`environment` = 'test'
)
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_DELETE_TEST_ONLY'); END;

--> statement-breakpoint
-- A direct SQL client is held to the same evidence boundary as the service.
-- This protects immutable acceptance/release history even if an application
-- bug ever attempts to manufacture a tombstone without the preview gate.
CREATE TRIGGER IF NOT EXISTS `trg_classroom_deletion_evidence_guard`
BEFORE INSERT ON `classroom_deletions`
WHEN EXISTS (SELECT 1 FROM `course_ui_acceptance_receipts` r WHERE r.`room_id` = NEW.`room_id`)
  OR EXISTS (SELECT 1 FROM `course_test_receipts` r WHERE r.`room_id` = NEW.`room_id`)
  OR EXISTS (
	SELECT 1 FROM `course_release_pointers` r
	WHERE json_extract(r.`approval_json`, '$.runId') = NEW.`room_id`
	   OR json_extract(r.`approval_json`, '$.uiReceiptId') IN (
		SELECT `id` FROM `course_ui_acceptance_receipts` WHERE `room_id` = NEW.`room_id`
	   )
  )
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_DELETE_EVIDENCE_BLOCKED'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_deletion_immutable_update`
BEFORE UPDATE ON `classroom_deletions`
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_DELETION_IMMUTABLE:update'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_deletion_immutable_delete`
BEFORE DELETE ON `classroom_deletions`
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_DELETION_IMMUTABLE:delete'); END;

--> statement-breakpoint
-- The archive remains immutable in every ordinary path. It can only disappear
-- inside the same transaction that has already created the deletion tombstone.
DROP TRIGGER IF EXISTS `trg_classroom_archive_immutable_delete`;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_archive_immutable_delete`
BEFORE DELETE ON `classroom_archives`
WHEN NOT EXISTS (
	SELECT 1 FROM `classroom_deletions` d WHERE d.`room_id` = OLD.`room_id`
)
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_ARCHIVE_IMMUTABLE:delete'); END;

--> statement-breakpoint
-- Every platform Classroom room deletion must be preceded by its durable Test
-- deletion claim. Legacy non-platform rooms remain outside this guard.
CREATE TRIGGER IF NOT EXISTS `trg_classroom_room_delete_guard`
BEFORE DELETE ON `rooms`
WHEN EXISTS (SELECT 1 FROM `classroom_instances` ci WHERE ci.`room_id` = OLD.`id`)
 AND NOT EXISTS (SELECT 1 FROM `classroom_deletions` d WHERE d.`room_id` = OLD.`id`)
BEGIN SELECT RAISE(ABORT, 'CLASSROOM_DELETE_TOMBSTONE_REQUIRED'); END;
