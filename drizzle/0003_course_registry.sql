CREATE TABLE `course_versions` (
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`digest` text NOT NULL,
	`package_json` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY (`course_id`, `revision`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_versions_digest` ON `course_versions` (`course_id`,`digest`);
--> statement-breakpoint
CREATE TABLE `course_release_pointers` (
	`course_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`released_at` text NOT NULL,
	`released_by` text NOT NULL,
	`approval_json` text NOT NULL,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `room_course_bindings` (
	`room_id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`legacy_campaign_id` text NOT NULL,
	`bound_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_room_course_bindings_ref` ON `room_course_bindings` (`course_id`,`revision`,`digest`);
--> statement-breakpoint
CREATE TABLE `alpha_run_rooms` (
	`run_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`,`revision`) REFERENCES `course_versions`(`course_id`,`revision`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `course_registry_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`course_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`actor` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_course_registry_events_course_time` ON `course_registry_events` (`course_id`,`created_at`);
