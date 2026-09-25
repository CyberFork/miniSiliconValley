-- T-104: append-only human decisions for the reviewQueue embedded in one
-- immutable CourseDefinition.  The authored queue remains part of the course
-- digest; reviewers only append decisions against an exact snapshot.
CREATE TABLE `course_content_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`item_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`action` text NOT NULL,
	`disposition` text,
	`note` text NOT NULL,
	`source_ref` text DEFAULT '' NOT NULL,
	`reviewer_profile_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`,`revision`,`digest`) REFERENCES `course_versions`(`course_id`,`revision`,`digest`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_course_content_review_sequence" CHECK (`sequence` >= 1),
	CONSTRAINT "chk_course_content_review_action" CHECK (
		(`action` = 'decision' AND `disposition` in ('revision-required', 'source-added', 'excluded-this-release'))
		OR (`action` = 'reopen' AND `disposition` IS NULL)
	),
	CONSTRAINT "chk_course_content_review_note" CHECK (length(`note`) BETWEEN 1 AND 500),
	CONSTRAINT "chk_course_content_review_source" CHECK (
		(`action` = 'decision' AND `disposition` = 'source-added' AND length(`source_ref`) BETWEEN 1 AND 512)
		OR (`action` = 'decision' AND `disposition` in ('revision-required', 'excluded-this-release') AND `source_ref` = '')
		OR (`action` = 'reopen' AND `source_ref` = '')
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_content_review_sequence` ON `course_content_review_events` (`course_id`,`revision`,`digest`,`item_id`,`sequence`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_content_review_idempotency` ON `course_content_review_events` (`reviewer_profile_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_course_content_review_exact` ON `course_content_review_events` (`course_id`,`revision`,`digest`,`created_at`);
--> statement-breakpoint
-- A decision cannot invent a review item that is absent from the exact course
-- snapshot.  JSON is inspected only on insert; later course mutation is already
-- prohibited by the course-version immutability triggers.
CREATE TRIGGER IF NOT EXISTS `trg_course_content_review_item_exact`
BEFORE INSERT ON `course_content_review_events`
WHEN NOT EXISTS (
	SELECT 1
	FROM `course_versions` v, json_each(v.`package_json`, '$.contentPackages.reviewQueue') q
	WHERE v.`course_id` = NEW.`course_id`
	  AND v.`revision` = NEW.`revision`
	  AND v.`digest` = NEW.`digest`
	  AND json_extract(q.`value`, '$.id') = NEW.`item_id`
)
BEGIN SELECT RAISE(ABORT, 'COURSE_CONTENT_REVIEW_ITEM_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_content_review_immutable_update`
BEFORE UPDATE ON `course_content_review_events`
BEGIN SELECT RAISE(ABORT, 'COURSE_CONTENT_REVIEW_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_content_review_immutable_delete`
BEFORE DELETE ON `course_content_review_events`
BEGIN SELECT RAISE(ABORT, 'COURSE_CONTENT_REVIEW_IMMUTABLE:delete'); END;
