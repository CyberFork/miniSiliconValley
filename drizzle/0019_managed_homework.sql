-- T-125: authenticated reusable templates and classroom-scoped assignments.
CREATE TABLE `homework_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`current_revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_profile_id` text NOT NULL,
	`request_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_homework_template_status" CHECK (`status` in ('active', 'archived')),
	CONSTRAINT "chk_homework_template_revision" CHECK (`current_revision` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_homework_template_request` ON `homework_templates` (`created_by_profile_id`,`request_key`);
--> statement-breakpoint
CREATE INDEX `idx_homework_template_status` ON `homework_templates` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `homework_template_versions` (
	`template_id` text NOT NULL,
	`revision` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`fields_json` text NOT NULL,
	`created_by_profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`template_id`, `revision`),
	FOREIGN KEY (`template_id`) REFERENCES `homework_templates`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_homework_template_version_revision" CHECK (`revision` >= 1)
);
--> statement-breakpoint
CREATE TABLE `homework_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`template_revision` integer NOT NULL,
	`room_id` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`recipient_count` integer NOT NULL,
	`due_at` text,
	`created_by_profile_id` text NOT NULL,
	`request_key` text NOT NULL,
	`published_at` text NOT NULL,
	`closed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`,`template_revision`) REFERENCES `homework_template_versions`(`template_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_homework_assignment_status" CHECK (`status` in ('published', 'closed')),
	CONSTRAINT "chk_homework_assignment_revision" CHECK (`template_revision` >= 1),
	CONSTRAINT "chk_homework_assignment_recipients" CHECK (`recipient_count` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_homework_assignment_request` ON `homework_assignments` (`created_by_profile_id`,`request_key`);
--> statement-breakpoint
CREATE INDEX `idx_homework_assignment_room` ON `homework_assignments` (`room_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `homework_assignment_recipients` (
	`assignment_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`assignment_id`, `profile_id`),
	FOREIGN KEY (`assignment_id`) REFERENCES `homework_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_homework_recipient_profile` ON `homework_assignment_recipients` (`profile_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `homework_assignment_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`feedback` text DEFAULT '' NOT NULL,
	`feedback_by_profile_id` text,
	`feedback_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `homework_assignments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`feedback_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_homework_response_status" CHECK (`status` in ('draft', 'submitted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_homework_response_recipient` ON `homework_assignment_responses` (`assignment_id`,`profile_id`);
--> statement-breakpoint
CREATE INDEX `idx_homework_response_assignment` ON `homework_assignment_responses` (`assignment_id`,`status`,`updated_at`);
