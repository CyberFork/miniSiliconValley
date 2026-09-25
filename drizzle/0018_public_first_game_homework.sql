-- T-119: intentionally public, fixed-format first-game homework submissions.
-- Self-reported names are not account identities and answers never join auth,
-- Classroom, wallet or public-space tables.
CREATE TABLE `homework_first_game_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`respondent_nickname` text DEFAULT '' NOT NULL,
	`respondent_note` text DEFAULT '' NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`answered_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`client_request_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "chk_homework_first_game_nickname" CHECK (length(`respondent_nickname`) <= 80),
	CONSTRAINT "chk_homework_first_game_note" CHECK (length(`respondent_note`) <= 300),
	CONSTRAINT "chk_homework_first_game_answered" CHECK (`answered_count` >= 0),
	CONSTRAINT "chk_homework_first_game_images" CHECK (`image_count` between 0 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_homework_first_game_request` ON `homework_first_game_submissions` (`client_request_id`);
--> statement-breakpoint
CREATE INDEX `idx_homework_first_game_created` ON `homework_first_game_submissions` (`created_at`,`id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_homework_first_game_immutable_update`
BEFORE UPDATE ON `homework_first_game_submissions`
BEGIN SELECT RAISE(ABORT, 'HOMEWORK_SUBMISSION_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_homework_first_game_immutable_delete`
BEFORE DELETE ON `homework_first_game_submissions`
BEGIN SELECT RAISE(ABORT, 'HOMEWORK_SUBMISSION_IMMUTABLE:delete'); END;
