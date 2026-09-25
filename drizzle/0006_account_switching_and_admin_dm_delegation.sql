CREATE TABLE `classroom_admin_dm_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`delegation_mode` text NOT NULL,
	`can_delegate` integer DEFAULT false NOT NULL,
	`granted_by_profile_id` text NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_by_profile_id` text,
	`revoked_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`revoked_by_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_classroom_admin_dm_delegation_mode" CHECK (`delegation_mode` in ('primary', 'delegated')),
	CONSTRAINT "chk_classroom_admin_dm_can_delegate" CHECK ((`delegation_mode` = 'primary' AND `can_delegate` = 1) OR (`delegation_mode` = 'delegated' AND `can_delegate` = 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_admin_dm_grant` ON `classroom_admin_dm_grants` (`room_id`,`profile_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_classroom_admin_dm_primary_room` ON `classroom_admin_dm_grants` (`room_id`) WHERE `delegation_mode` = 'primary' AND `revoked_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_classroom_admin_dm_active_profile` ON `classroom_admin_dm_grants` (`profile_id`,`revoked_at`,`room_id`);
--> statement-breakpoint
CREATE INDEX `idx_classroom_admin_dm_active_room` ON `classroom_admin_dm_grants` (`room_id`,`revoked_at`,`delegation_mode`);
--> statement-breakpoint
-- Existing classrooms used a flat admin-dm permission. The room owner is the
-- only authority that may delegate. Inserting owners first guarantees every
-- Classroom keeps exactly one Primary even if a legacy mirror row was absent.
INSERT OR IGNORE INTO `classroom_admin_dm_grants`
  (`id`, `room_id`, `profile_id`, `delegation_mode`, `can_delegate`, `granted_by_profile_id`,
   `granted_at`, `revoked_by_profile_id`, `revoked_at`, `version`)
SELECT 'admin-dm-primary:' || r.`id`, r.`id`, r.`dm_profile_id`, 'primary', 1,
       r.`dm_profile_id`, ci.`created_at`, NULL, NULL, 1
FROM `classroom_instances` ci
JOIN `rooms` r ON r.`id` = ci.`room_id`;
--> statement-breakpoint
-- Every other historical holder becomes non-recursive Delegated Admin DM.
-- INSERT OR IGNORE keeps bootstrap idempotent and never resurrects a later
-- revoked grant because the room/profile unique key remains occupied.
INSERT OR IGNORE INTO `classroom_admin_dm_grants`
  (`id`, `room_id`, `profile_id`, `delegation_mode`, `can_delegate`, `granted_by_profile_id`,
   `granted_at`, `revoked_by_profile_id`, `revoked_at`, `version`)
SELECT p.`id`, p.`room_id`, p.`profile_id`,
       CASE WHEN p.`profile_id` = r.`dm_profile_id` THEN 'primary' ELSE 'delegated' END,
       CASE WHEN p.`profile_id` = r.`dm_profile_id` THEN 1 ELSE 0 END,
       p.`granted_by_profile_id`, p.`created_at`, NULL, NULL, 1
FROM `classroom_permissions` p
JOIN `rooms` r ON r.`id` = p.`room_id`
WHERE p.`permission` = 'admin-dm';
--> statement-breakpoint
CREATE TABLE `auth_impersonations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`effective_user_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`end_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `auth_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`effective_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classroom_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_auth_impersonations_active_session` ON `auth_impersonations` (`session_id`) WHERE `revoked_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_auth_impersonations_scope` ON `auth_impersonations` (`classroom_id`,`effective_user_id`,`revoked_at`,`expires_at`);
