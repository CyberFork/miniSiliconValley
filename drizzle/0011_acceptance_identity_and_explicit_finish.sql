-- T-102 keeps build provenance separate from compatibility contracts.  The
-- companion table is additive, so existing immutable receipts remain intact
-- but are invalid until a new schema-v2 human receipt records this identity.
CREATE TABLE `course_acceptance_build_identities` (
	`receipt_id` text NOT NULL,
	`receipt_kind` text NOT NULL,
	`projector_contract_version` text NOT NULL,
	`runtime_contract_version` text NOT NULL,
	`source_commit` text NOT NULL,
	`app_build_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`receipt_id`, `receipt_kind`),
	CONSTRAINT "chk_course_acceptance_identity_kind" CHECK (`receipt_kind` in ('view', 'ui'))
);
--> statement-breakpoint
CREATE INDEX `idx_course_acceptance_identity_contracts` ON `course_acceptance_build_identities` (`receipt_kind`,`projector_contract_version`,`runtime_contract_version`);
--> statement-breakpoint

-- Reaching the last unlocked script page and explicitly ending the classroom
-- are different operations.  A single durable receipt per run makes the
-- confirmation retry-safe without coupling it to learner submissions.
CREATE TABLE `classroom_finish_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`reset_generation` integer NOT NULL,
	`expected_script_version` integer NOT NULL,
	`actor_profile_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_classroom_finish_generation" CHECK (`reset_generation` >= 0),
	CONSTRAINT "chk_classroom_finish_script_version" CHECK (`expected_script_version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_finish_run` ON `classroom_finish_mutations` (`room_id`,`reset_generation`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_finish_idempotency` ON `classroom_finish_mutations` (`room_id`,`actor_profile_id`,`idempotency_key`);
