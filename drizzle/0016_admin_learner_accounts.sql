-- T-114 keeps private administrator metadata separate from the public account
-- profile.  Existing learners receive a deterministic legacy seed; newly
-- created learners receive a cryptographically random seed in application
-- code.  Neither notes nor avatar metadata is exposed by ordinary profile or
-- classroom APIs.
CREATE TABLE `auth_learner_admin_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`avatar_seed` text NOT NULL,
	`avatar_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_auth_learner_admin_notes" CHECK (length(`admin_notes`) <= 500),
	CONSTRAINT "chk_auth_learner_avatar_seed" CHECK (length(`avatar_seed`) BETWEEN 8 AND 128),
	CONSTRAINT "chk_auth_learner_avatar_version" CHECK (`avatar_version` >= 1)
);
--> statement-breakpoint

INSERT OR IGNORE INTO `auth_learner_admin_profiles`
  (`user_id`, `admin_notes`, `avatar_seed`, `avatar_version`, `created_at`, `updated_at`)
SELECT `id`, '', 'legacy:' || `id`, 1, `created_at`, `updated_at`
FROM `auth_users`
WHERE `role` = 'learner';
--> statement-breakpoint

-- A retry of the same administrator request must return the same account,
-- never allocate the next numbered learner.  The request record intentionally
-- stores no password or private note.
CREATE TABLE `auth_admin_learner_requests` (
	`actor_user_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`target_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	PRIMARY KEY (`actor_user_id`,`idempotency_key`)
);
--> statement-breakpoint

CREATE INDEX `idx_auth_admin_learner_request_target`
ON `auth_admin_learner_requests` (`target_user_id`,`created_at`);
--> statement-breakpoint

-- Numbered login names are never recycled after an account is deleted.  This
-- prevents a printed credential or old human note for @msv-student-05 from
-- ever pointing at a different learner later.
CREATE TABLE `auth_learner_username_allocations` (
	`username` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL UNIQUE,
	`allocated_at` text NOT NULL
);
--> statement-breakpoint

INSERT OR IGNORE INTO `auth_learner_username_allocations` (`username`, `user_id`, `allocated_at`)
SELECT `username`, `id`, `created_at`
FROM `auth_users`
WHERE `role` = 'learner' AND `username` GLOB 'msv-student-[0-9]*';
