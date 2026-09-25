CREATE TABLE `classroom_script_progress` (
	`room_id` text PRIMARY KEY NOT NULL,
	`state_machine_version` integer NOT NULL,
	`unlocked_through_block_id` text NOT NULL,
	`unlocked_through_index` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_script_progress_index" CHECK (`unlocked_through_index` >= 0),
	CONSTRAINT "chk_classroom_script_progress_version" CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_script_progress_updated` ON `classroom_script_progress` (`updated_at`);
--> statement-breakpoint
-- Existing classrooms keep every business record.  Their legacy controller
-- block is interpreted only once as the furthest page that had been exposed.
INSERT OR IGNORE INTO `classroom_script_progress`
  (`room_id`, `state_machine_version`, `unlocked_through_block_id`,
   `unlocked_through_index`, `version`, `created_at`, `updated_at`)
SELECT cs.`room_id`, 2, cs.`block_id`,
       CASE WHEN cs.`block_index` < 0 THEN 0 ELSE cs.`block_index` END,
       CASE WHEN cs.`version` < 1 THEN 1 ELSE cs.`version` END,
       cs.`created_at`, cs.`updated_at`
FROM `classroom_controller_states` cs;
--> statement-breakpoint
-- The column is retained for immutable receipt history, but now identifies
-- the script/runtime contract rather than the retired controller workflow.
UPDATE `classroom_instances`
SET `state_machine_version` = 2
WHERE `state_machine_version` < 2;
