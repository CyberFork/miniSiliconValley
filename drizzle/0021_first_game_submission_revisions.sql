-- T-131: staff edits append immutable revisions instead of mutating the
-- original public submission.  Public readers always see the latest revision.
-- only a real (non-impersonated) mentor or administrator may create one.
CREATE TABLE `homework_first_game_submission_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`revision` integer NOT NULL,
	`respondent_nickname` text NOT NULL,
	`respondent_note` text NOT NULL,
	`answers_json` text NOT NULL,
	`answered_count` integer NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`edited_by_user_id` text NOT NULL,
	`edited_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `homework_first_game_submissions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`edited_by_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_homework_first_game_revision" CHECK (`revision` >= 1),
	CONSTRAINT "chk_homework_first_game_revision_nickname" CHECK (length(`respondent_nickname`) BETWEEN 1 AND 80),
	CONSTRAINT "chk_homework_first_game_revision_note" CHECK (length(`respondent_note`) BETWEEN 1 AND 120),
	CONSTRAINT "chk_homework_first_game_revision_answered" CHECK (`answered_count` >= 0),
	CONSTRAINT "chk_homework_first_game_revision_images" CHECK (`image_count` = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_homework_first_game_submission_revision`
ON `homework_first_game_submission_revisions` (`submission_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `idx_homework_first_game_revision_time`
ON `homework_first_game_submission_revisions` (`submission_id`,`edited_at`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_homework_first_game_revision_immutable_update`
BEFORE UPDATE ON `homework_first_game_submission_revisions`
BEGIN SELECT RAISE(ABORT, 'HOMEWORK_SUBMISSION_REVISION_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_homework_first_game_revision_immutable_delete`
BEFORE DELETE ON `homework_first_game_submission_revisions`
BEGIN SELECT RAISE(ABORT, 'HOMEWORK_SUBMISSION_REVISION_IMMUTABLE:delete'); END;
