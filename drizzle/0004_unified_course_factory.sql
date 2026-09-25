CREATE TABLE `course_candidate_pointers` (
	`course_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`staged_at` text NOT NULL,
	`staged_by` text NOT NULL,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `course_test_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`courseware_bundle_digest` text NOT NULL,
	`status` text NOT NULL,
	`checks_json` text NOT NULL,
	`accepted_at` text,
	`accepted_by_profile_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accepted_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_course_test_receipts_status" CHECK (`status` in ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_test_receipts_exact` ON `course_test_receipts` (`course_id`,`revision`,`digest`,`courseware_bundle_digest`,`room_id`);
--> statement-breakpoint
CREATE INDEX `idx_course_test_receipts_status_time` ON `course_test_receipts` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `courseware_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`mentor_role` text NOT NULL,
	`owner_profile_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_courseware_packages_role" CHECK (`mentor_role` in ('P', 'D', 'M', 'O')),
	CONSTRAINT "chk_courseware_packages_status" CHECK (`status` in ('active', 'retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_courseware_packages_slug` ON `courseware_packages` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_courseware_packages_owner_role` ON `courseware_packages` (`owner_profile_id`,`mentor_role`,`status`);
--> statement-breakpoint
CREATE TABLE `courseware_versions` (
	`package_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`content_kind` text DEFAULT 'inline-html' NOT NULL,
	`html_content` text,
	`entry_path` text,
	`byte_length` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by_profile_id` text NOT NULL,
	PRIMARY KEY (`package_id`, `revision`),
	FOREIGN KEY (`package_id`) REFERENCES `courseware_packages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_courseware_versions_kind" CHECK (`content_kind` in ('inline-html', 'static-bundle'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_courseware_versions_digest` ON `courseware_versions` (`package_id`,`digest`);
--> statement-breakpoint
CREATE TABLE `courseware_release_pointers` (
	`package_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`released_at` text NOT NULL,
	`released_by_profile_id` text NOT NULL,
	FOREIGN KEY (`package_id`,`revision`) REFERENCES `courseware_versions`(`package_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`released_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `room_courseware_bindings` (
	`room_id` text NOT NULL,
	`mentor_role` text NOT NULL,
	`package_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`bound_at` text NOT NULL,
	`bound_by_profile_id` text NOT NULL,
	PRIMARY KEY (`room_id`, `mentor_role`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`,`revision`) REFERENCES `courseware_versions`(`package_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bound_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_room_courseware_role" CHECK (`mentor_role` in ('P', 'D', 'M', 'O'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_room_courseware_role` ON `room_courseware_bindings` (`room_id`,`mentor_role`);
--> statement-breakpoint
CREATE INDEX `idx_room_courseware_exact` ON `room_courseware_bindings` (`package_id`,`revision`,`digest`);
--> statement-breakpoint
CREATE TABLE `classroom_instances` (
	`room_id` text PRIMARY KEY NOT NULL,
	`environment` text NOT NULL,
	`learner_count` integer NOT NULL,
	`lifecycle` text DEFAULT 'ready' NOT NULL,
	`state_machine_version` integer NOT NULL,
	`course_id` text NOT NULL,
	`course_revision` integer NOT NULL,
	`course_digest` text NOT NULL,
	`factory_key` text NOT NULL,
	`reset_generation` integer DEFAULT 0 NOT NULL,
	`locked_at` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`,`course_revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_classroom_instances_environment" CHECK (`environment` in ('test', 'production')),
	CONSTRAINT "chk_classroom_instances_lifecycle" CHECK (`lifecycle` in ('draft', 'ready', 'running', 'completed', 'reset')),
	CONSTRAINT "chk_classroom_instances_learner_count" CHECK (`learner_count` >= 1 AND `learner_count` <= 24)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_instances_factory_key` ON `classroom_instances` (`factory_key`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_instances_environment_lifecycle` ON `classroom_instances` (`environment`,`lifecycle`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `classroom_mentor_seats` (
	`room_id` text NOT NULL,
	`mentor_role` text NOT NULL,
	`profile_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY (`room_id`, `mentor_role`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_mentor_seats_role" CHECK (`mentor_role` in ('P', 'D', 'M', 'O'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_mentor_profile` ON `classroom_mentor_seats` (`room_id`,`profile_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_mentor_membership` ON `classroom_mentor_seats` (`membership_id`);
--> statement-breakpoint
CREATE TABLE `classroom_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`permission` text NOT NULL,
	`granted_by_profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_classroom_permissions_permission" CHECK (`permission` in ('admin-dm'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_permissions_grant` ON `classroom_permissions` (`room_id`,`profile_id`,`permission`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_permissions_profile` ON `classroom_permissions` (`profile_id`,`permission`);
--> statement-breakpoint
CREATE TABLE `classroom_controller_states` (
	`room_id` text PRIMARY KEY NOT NULL,
	`state_machine_version` integer NOT NULL,
	`block_id` text NOT NULL,
	`block_index` integer NOT NULL,
	`state` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`error_message` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_controller_states_state" CHECK (`state` in ('ready', 'executing', 'awaiting-acceptance', 'accepted', 'completed', 'error'))
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_controller_states_state` ON `classroom_controller_states` (`state`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `classroom_factory_events` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_profile_id` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_factory_events_room_time` ON `classroom_factory_events` (`room_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `classroom_block_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`block_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_block_submissions_status" CHECK (`status` in ('draft', 'submitted', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_block_submission_actor` ON `classroom_block_submissions` (`room_id`,`block_id`,`profile_id`,`kind`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_block_submissions_room_block` ON `classroom_block_submissions` (`room_id`,`block_id`,`status`);
--> statement-breakpoint
CREATE TABLE `classroom_wallet_balances` (
	`room_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`balance_tenths` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY (`room_id`, `profile_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_classroom_wallet_non_negative" CHECK (`balance_tenths` >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_wallet_profile` ON `classroom_wallet_balances` (`profile_id`,`updated_at`);
