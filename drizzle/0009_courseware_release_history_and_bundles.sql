-- T-100: a release pointer identifies the default revision; it is not the
-- release history.  This append-only ledger keeps every revision that has
-- ever been published readable by classrooms that already reference it.
CREATE TABLE `courseware_releases` (
	`package_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`released_at` text NOT NULL,
	`released_by_profile_id` text NOT NULL,
	PRIMARY KEY (`package_id`, `revision`),
	FOREIGN KEY (`package_id`,`revision`) REFERENCES `courseware_versions`(`package_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`released_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_courseware_releases_exact` ON `courseware_releases` (`package_id`,`revision`,`digest`);
--> statement-breakpoint
CREATE INDEX `idx_courseware_releases_time` ON `courseware_releases` (`released_at`,`package_id`);
--> statement-breakpoint
CREATE TABLE `courseware_exact_integrity_guard` (
	`id` integer PRIMARY KEY NOT NULL,
	`verified_at` text NOT NULL,
	CONSTRAINT "chk_courseware_exact_integrity_guard" CHECK (`id` = 1)
);
--> statement-breakpoint
INSERT INTO `courseware_exact_integrity_guard` (`id`, `verified_at`)
SELECT CASE WHEN
	NOT EXISTS (
		SELECT 1 FROM `courseware_release_pointers` r
		WHERE NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = r.`package_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `room_courseware_bindings` r
		WHERE NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = r.`package_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
THEN 1 ELSE 0 END, CURRENT_TIMESTAMP
ON CONFLICT(`id`) DO NOTHING;
--> statement-breakpoint
INSERT OR IGNORE INTO `courseware_releases`
	(`package_id`, `revision`, `digest`, `released_at`, `released_by_profile_id`)
SELECT `package_id`, `revision`, `digest`, `released_at`, `released_by_profile_id`
FROM `courseware_release_pointers`;
--> statement-breakpoint

-- Browser-authored multi-file packages are uploaded as ordinary files, not
-- archives.  Avoiding server-side extraction removes symlink and compression
-- bomb classes entirely while retaining the exact original bytes.
CREATE TABLE `courseware_bundle_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`mentor_role` text NOT NULL,
	`owner_profile_id` text NOT NULL,
	`entry_file` text NOT NULL,
	`file_count` integer NOT NULL,
	`total_bytes` integer NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`result_revision` integer,
	`result_digest` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`finalized_at` text,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_courseware_bundle_upload_role" CHECK (`mentor_role` in ('P', 'D', 'M', 'O')),
	CONSTRAINT "chk_courseware_bundle_upload_status" CHECK (`status` in ('uploading', 'finalized', 'duplicate', 'aborted')),
	CONSTRAINT "chk_courseware_bundle_upload_file_count" CHECK (`file_count` >= 1 AND `file_count` <= 256),
	CONSTRAINT "chk_courseware_bundle_upload_total_bytes" CHECK (`total_bytes` >= 32 AND `total_bytes` <= 50331648)
);
--> statement-breakpoint
CREATE INDEX `idx_courseware_bundle_upload_owner_status` ON `courseware_bundle_uploads` (`owner_profile_id`,`status`,`created_at`);
--> statement-breakpoint

CREATE TABLE `courseware_bundle_files` (
	`upload_id` text NOT NULL,
	`path` text NOT NULL,
	`media_type` text NOT NULL,
	`byte_length` integer NOT NULL,
	`digest` text NOT NULL,
	`chunk_count` integer NOT NULL,
	PRIMARY KEY (`upload_id`, `path`),
	FOREIGN KEY (`upload_id`) REFERENCES `courseware_bundle_uploads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_courseware_bundle_file_bytes" CHECK (`byte_length` >= 1 AND `byte_length` <= 8388608),
	CONSTRAINT "chk_courseware_bundle_file_chunks" CHECK (`chunk_count` >= 1 AND `chunk_count` <= 46)
);
--> statement-breakpoint

CREATE TABLE `courseware_bundle_chunks` (
	`upload_id` text NOT NULL,
	`path` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`byte_length` integer NOT NULL,
	`digest` text NOT NULL,
	`data_base64` text NOT NULL,
	PRIMARY KEY (`upload_id`, `path`, `chunk_index`),
	FOREIGN KEY (`upload_id`,`path`) REFERENCES `courseware_bundle_files`(`upload_id`,`path`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_courseware_bundle_chunk_index" CHECK (`chunk_index` >= 0 AND `chunk_index` < 46),
	CONSTRAINT "chk_courseware_bundle_chunk_bytes" CHECK (`byte_length` >= 1 AND `byte_length` <= 184320)
);
--> statement-breakpoint

CREATE TABLE `courseware_bundle_versions` (
	`package_id` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`upload_id` text NOT NULL,
	`entry_file` text NOT NULL,
	`manifest_json` text NOT NULL,
	`tree_digest` text NOT NULL,
	`file_count` integer NOT NULL,
	`total_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY (`package_id`, `revision`),
	FOREIGN KEY (`package_id`,`revision`) REFERENCES `courseware_versions`(`package_id`,`revision`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`upload_id`) REFERENCES `courseware_bundle_uploads`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_courseware_bundle_versions_upload` ON `courseware_bundle_versions` (`upload_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_courseware_bundle_versions_tree` ON `courseware_bundle_versions` (`package_id`,`tree_digest`);
--> statement-breakpoint

-- Exact identity and append-only guards.  Physical deletion is intentionally
-- absent; a Classroom reference therefore remains playable after newer
-- releases and after whole-site upgrades.
CREATE TRIGGER IF NOT EXISTS `trg_courseware_release_exact_insert`
BEFORE INSERT ON `courseware_releases`
WHEN NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = NEW.`package_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_EXACT_REF_INVALID:courseware_releases'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_release_immutable_update`
BEFORE UPDATE ON `courseware_releases`
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_RELEASE_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_release_immutable_delete`
BEFORE DELETE ON `courseware_releases`
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_RELEASE_IMMUTABLE:delete'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_version_immutable_update`
BEFORE UPDATE ON `courseware_versions`
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_VERSION_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_version_immutable_delete`
BEFORE DELETE ON `courseware_versions`
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_VERSION_IMMUTABLE:delete'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_pointer_exact_insert`
BEFORE INSERT ON `courseware_release_pointers`
WHEN NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = NEW.`package_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_EXACT_REF_INVALID:courseware_release_pointers'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_pointer_exact_update`
BEFORE UPDATE OF `package_id`, `revision`, `digest` ON `courseware_release_pointers`
WHEN NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = NEW.`package_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_EXACT_REF_INVALID:courseware_release_pointers'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_room_courseware_exact_insert`
BEFORE INSERT ON `room_courseware_bindings`
WHEN NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = NEW.`package_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_EXACT_REF_INVALID:room_courseware_bindings'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_room_courseware_exact_update`
BEFORE UPDATE OF `package_id`, `revision`, `digest` ON `room_courseware_bindings`
WHEN NOT EXISTS (SELECT 1 FROM `courseware_versions` v WHERE v.`package_id` = NEW.`package_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_EXACT_REF_INVALID:room_courseware_bindings'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_final_upload_files_immutable_update`
BEFORE UPDATE ON `courseware_bundle_files`
WHEN EXISTS (SELECT 1 FROM `courseware_bundle_uploads` u WHERE u.`id` = OLD.`upload_id` AND u.`status` IN ('finalized','duplicate'))
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_BUNDLE_IMMUTABLE:files'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_final_upload_files_immutable_delete`
BEFORE DELETE ON `courseware_bundle_files`
WHEN EXISTS (SELECT 1 FROM `courseware_bundle_uploads` u WHERE u.`id` = OLD.`upload_id` AND u.`status` IN ('finalized','duplicate'))
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_BUNDLE_IMMUTABLE:files'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_final_upload_chunks_immutable_update`
BEFORE UPDATE ON `courseware_bundle_chunks`
WHEN EXISTS (SELECT 1 FROM `courseware_bundle_uploads` u WHERE u.`id` = OLD.`upload_id` AND u.`status` IN ('finalized','duplicate'))
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_BUNDLE_IMMUTABLE:chunks'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_courseware_final_upload_chunks_immutable_delete`
BEFORE DELETE ON `courseware_bundle_chunks`
WHEN EXISTS (SELECT 1 FROM `courseware_bundle_uploads` u WHERE u.`id` = OLD.`upload_id` AND u.`status` IN ('finalized','duplicate'))
BEGIN SELECT RAISE(ABORT, 'COURSEWARE_BUNDLE_IMMUTABLE:chunks'); END;
