-- Public AI daily quiz submissions. Nicknames are self-reported and are not
-- platform account identities. Review is authorized by the application layer.
CREATE TABLE `homework_ai_quiz_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`respondent_nickname` text NOT NULL,
	`day_index` integer NOT NULL,
	`answers_json` text NOT NULL,
	`correct_count` integer NOT NULL,
	`total_count` integer NOT NULL,
	`score` integer NOT NULL,
	`coins` integer NOT NULL,
	`client_request_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "chk_homework_ai_quiz_nickname" CHECK (length(`respondent_nickname`) BETWEEN 1 AND 80),
	CONSTRAINT "chk_homework_ai_quiz_day" CHECK (`day_index` BETWEEN 0 AND 6),
	CONSTRAINT "chk_homework_ai_quiz_counts" CHECK (`total_count` = 5 AND `correct_count` BETWEEN 0 AND `total_count`),
	CONSTRAINT "chk_homework_ai_quiz_score" CHECK (`score` BETWEEN 0 AND 100),
	CONSTRAINT "chk_homework_ai_quiz_coins" CHECK (`coins` BETWEEN 0 AND 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_homework_ai_quiz_request` ON `homework_ai_quiz_submissions` (`client_request_id`);
--> statement-breakpoint
CREATE INDEX `idx_homework_ai_quiz_created` ON `homework_ai_quiz_submissions` (`created_at`,`id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_homework_ai_quiz_immutable_update`
BEFORE UPDATE ON `homework_ai_quiz_submissions`
BEGIN SELECT RAISE(ABORT, 'AI_QUIZ_SUBMISSION_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_homework_ai_quiz_immutable_delete`
BEFORE DELETE ON `homework_ai_quiz_submissions`
BEGIN SELECT RAISE(ABORT, 'AI_QUIZ_SUBMISSION_IMMUTABLE:delete'); END;
