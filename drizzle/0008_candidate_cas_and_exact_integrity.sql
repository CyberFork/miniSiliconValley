-- T-099: fail closed if an older database already contains a course reference
-- whose digest does not belong to the referenced immutable revision.  The
-- deployment runner performs a richer read-only preflight after taking a
-- quiescent backup; this guard keeps every other schema-bootstrap path safe.
CREATE TABLE `course_exact_integrity_guard` (
	`id` integer PRIMARY KEY NOT NULL,
	`verified_at` text NOT NULL,
	CONSTRAINT "chk_course_exact_integrity_guard" CHECK (`id` = 1)
);
--> statement-breakpoint
INSERT INTO `course_exact_integrity_guard` (`id`, `verified_at`)
SELECT CASE WHEN
	NOT EXISTS (
		SELECT 1 FROM `course_release_pointers` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `course_candidate_pointers` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `room_course_bindings` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `alpha_run_rooms` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `course_registry_events` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `course_test_receipts` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `classroom_instances` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`course_revision` AND v.`digest` = r.`course_digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `course_view_acceptance_receipts` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `course_ui_acceptance_receipts` r
		WHERE NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = r.`course_id` AND v.`revision` = r.`revision` AND v.`digest` = r.`digest`)
	)
THEN 1 ELSE 0 END, CURRENT_TIMESTAMP
ON CONFLICT(`id`) DO NOTHING;
--> statement-breakpoint
-- A historical body may intentionally be restored as a new immutable
-- revision.  Identity is therefore revision + digest, not digest alone.
DROP INDEX IF EXISTS `uidx_course_versions_digest`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_course_versions_exact` ON `course_versions` (`course_id`,`revision`,`digest`);
--> statement-breakpoint

-- Course versions are append-only snapshots.  Child-side exact guards are
-- insufficient if a privileged SQL caller can mutate a parent's digest or
-- body after references have been created.
CREATE TRIGGER IF NOT EXISTS `trg_course_version_immutable_update`
BEFORE UPDATE ON `course_versions`
BEGIN SELECT RAISE(ABORT, 'COURSE_VERSION_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_version_immutable_delete`
BEFORE DELETE ON `course_versions`
BEGIN SELECT RAISE(ABORT, 'COURSE_VERSION_IMMUTABLE:delete'); END;
--> statement-breakpoint

-- SQLite cannot retrofit composite foreign keys without rebuilding all
-- classroom/history tables.  Equivalent BEFORE triggers enforce the exact
-- triple for every existing and future writer while preserving every row.
CREATE TRIGGER IF NOT EXISTS `trg_course_candidate_exact_insert`
BEFORE INSERT ON `course_candidate_pointers`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_candidate_pointers'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_candidate_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `course_candidate_pointers`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_candidate_pointers'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_release_exact_insert`
BEFORE INSERT ON `course_release_pointers`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_release_pointers'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_release_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `course_release_pointers`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_release_pointers'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_room_course_binding_exact_insert`
BEFORE INSERT ON `room_course_bindings`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:room_course_bindings'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_room_course_binding_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `room_course_bindings`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:room_course_bindings'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_alpha_run_course_exact_insert`
BEFORE INSERT ON `alpha_run_rooms`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:alpha_run_rooms'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_alpha_run_course_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `alpha_run_rooms`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:alpha_run_rooms'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_registry_event_exact_insert`
BEFORE INSERT ON `course_registry_events`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_registry_events'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_registry_event_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `course_registry_events`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_registry_events'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_test_receipt_exact_insert`
BEFORE INSERT ON `course_test_receipts`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_test_receipts'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_test_receipt_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `course_test_receipts`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_test_receipts'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_instance_course_exact_insert`
BEFORE INSERT ON `classroom_instances`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`course_revision` AND v.`digest` = NEW.`course_digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:classroom_instances'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_classroom_instance_course_exact_update`
BEFORE UPDATE OF `course_id`, `course_revision`, `course_digest` ON `classroom_instances`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`course_revision` AND v.`digest` = NEW.`course_digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:classroom_instances'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_view_receipt_exact_insert`
BEFORE INSERT ON `course_view_acceptance_receipts`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_view_acceptance_receipts'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_view_receipt_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `course_view_acceptance_receipts`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_view_acceptance_receipts'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_ui_receipt_exact_insert`
BEFORE INSERT ON `course_ui_acceptance_receipts`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_ui_acceptance_receipts'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_course_ui_receipt_exact_update`
BEFORE UPDATE OF `course_id`, `revision`, `digest` ON `course_ui_acceptance_receipts`
WHEN NOT EXISTS (SELECT 1 FROM `course_versions` v WHERE v.`course_id` = NEW.`course_id` AND v.`revision` = NEW.`revision` AND v.`digest` = NEW.`digest`)
BEGIN SELECT RAISE(ABORT, 'COURSE_EXACT_REF_INVALID:course_ui_acceptance_receipts'); END;
