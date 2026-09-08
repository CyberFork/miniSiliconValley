CREATE TABLE `course_view_acceptance_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_schema_version` integer NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`status` text NOT NULL,
	`scenarios_json` text NOT NULL,
	`checks_json` text NOT NULL,
	`projector_version` text NOT NULL,
	`app_build_id` text NOT NULL,
	`reviewer_profile_id` text NOT NULL,
	`accepted_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_course_view_acceptance_status" CHECK (`status` in ('accepted', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_view_acceptance_exact` ON `course_view_acceptance_receipts` (`course_id`,`revision`,`digest`,`projector_version`,`app_build_id`);
--> statement-breakpoint
CREATE INDEX `idx_course_view_acceptance_status_time` ON `course_view_acceptance_receipts` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `course_ui_acceptance_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_schema_version` integer NOT NULL,
	`room_id` text NOT NULL,
	`view_receipt_id` text NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`learner_count` integer NOT NULL,
	`deal_seed` text NOT NULL,
	`reset_generation` integer NOT NULL,
	`state_machine_version` integer NOT NULL,
	`courseware_bundle_digest` text NOT NULL,
	`courseware_refs_json` text NOT NULL,
	`mentor_memberships_json` text NOT NULL,
	`learner_memberships_json` text NOT NULL,
	`admin_dm_json` text NOT NULL,
	`checks_json` text NOT NULL,
	`client_matrix_json` text NOT NULL,
	`app_build_id` text NOT NULL,
	`audit_summary_json` text NOT NULL,
	`status` text NOT NULL,
	`accepted_at` text NOT NULL,
	`accepted_by_profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`view_receipt_id`) REFERENCES `course_view_acceptance_receipts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accepted_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_course_ui_acceptance_status" CHECK (`status` in ('accepted', 'rejected')),
	CONSTRAINT "chk_course_ui_acceptance_learner_count" CHECK (`learner_count` >= 1 AND `learner_count` <= 24)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_ui_acceptance_run` ON `course_ui_acceptance_receipts` (`room_id`,`reset_generation`,`course_id`,`revision`,`digest`,`courseware_bundle_digest`,`app_build_id`);
--> statement-breakpoint
CREATE INDEX `idx_course_ui_acceptance_exact` ON `course_ui_acceptance_receipts` (`course_id`,`revision`,`digest`,`status`,`accepted_at`);
--> statement-breakpoint
CREATE TABLE `classroom_acceptance_bindings` (
	`room_id` text PRIMARY KEY NOT NULL,
	`view_receipt_id` text NOT NULL,
	`ui_receipt_id` text,
	`bound_at` text NOT NULL,
	`bound_by_profile_id` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`view_receipt_id`) REFERENCES `course_view_acceptance_receipts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ui_receipt_id`) REFERENCES `course_ui_acceptance_receipts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bound_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_acceptance_view` ON `classroom_acceptance_bindings` (`view_receipt_id`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_acceptance_ui` ON `classroom_acceptance_bindings` (`ui_receipt_id`);
