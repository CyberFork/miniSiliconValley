-- T-124 (original local T-121): durable learner terminal assets are account
-- scoped and partitioned from Classroom ledgers.  Test coins can never buy
-- production inventory.
CREATE TABLE `learner_terminal_wallets` (
	`profile_id` text NOT NULL,
	`environment` text NOT NULL,
	`balance_coins` integer DEFAULT 0 NOT NULL,
	`initialized_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	PRIMARY KEY (`profile_id`,`environment`),
	CONSTRAINT "chk_learner_terminal_wallet_environment" CHECK (`environment` in ('test', 'production')),
	CONSTRAINT "chk_learner_terminal_wallet_non_negative" CHECK (`balance_coins` >= 0)
);
--> statement-breakpoint
CREATE TABLE `learner_terminal_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`environment` text NOT NULL,
	`kind` text NOT NULL,
	`amount_coins` integer NOT NULL,
	`actor_profile_id` text NOT NULL,
	`room_id` text,
	`item_id` text,
	`reason` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reversal_of` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_learner_terminal_transaction_environment" CHECK (`environment` in ('test', 'production')),
	CONSTRAINT "chk_learner_terminal_transaction_kind" CHECK (`kind` in ('grant', 'purchase', 'reversal')),
	CONSTRAINT "chk_learner_terminal_transaction_amount" CHECK (`amount_coins` != 0),
	CONSTRAINT "chk_learner_terminal_transaction_reason" CHECK (length(`reason`) between 2 and 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_learner_terminal_transaction_request` ON `learner_terminal_transactions` (`actor_profile_id`,`idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_learner_terminal_transaction_reversal` ON `learner_terminal_transactions` (`reversal_of`);
--> statement-breakpoint
CREATE INDEX `idx_learner_terminal_transaction_wallet` ON `learner_terminal_transactions` (`profile_id`,`environment`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_learner_terminal_transaction_room` ON `learner_terminal_transactions` (`room_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `learner_terminal_inventory` (
	`profile_id` text NOT NULL,
	`item_id` text NOT NULL,
	`acquired_transaction_id` text NOT NULL,
	`acquired_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acquired_transaction_id`) REFERENCES `learner_terminal_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	PRIMARY KEY (`profile_id`,`item_id`)
);
--> statement-breakpoint
CREATE TABLE `learner_terminal_equipment` (
	`profile_id` text NOT NULL,
	`slot` text NOT NULL,
	`item_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	PRIMARY KEY (`profile_id`,`slot`),
	CONSTRAINT "chk_learner_terminal_equipment_slot" CHECK (`slot` in ('identity', 'terminal', 'space'))
);
--> statement-breakpoint
CREATE TABLE `learner_public_spaces` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`project_title` text DEFAULT '' NOT NULL,
	`project_summary` text DEFAULT '' NOT NULL,
	`project_url` text DEFAULT '' NOT NULL,
	`team_name` text DEFAULT '' NOT NULL,
	`contribution` text DEFAULT '' NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_learner_public_space_intro" CHECK (length(`intro`) <= 160),
	CONSTRAINT "chk_learner_public_space_project_title" CHECK (length(`project_title`) <= 80),
	CONSTRAINT "chk_learner_public_space_project_summary" CHECK (length(`project_summary`) <= 500),
	CONSTRAINT "chk_learner_public_space_project_url" CHECK (length(`project_url`) <= 512),
	CONSTRAINT "chk_learner_public_space_team_name" CHECK (length(`team_name`) <= 80),
	CONSTRAINT "chk_learner_public_space_contribution" CHECK (length(`contribution`) <= 240)
);
--> statement-breakpoint
-- The append-only transaction is the only ordinary path that changes a
-- wallet.  This makes grants, purchases and reversals auditable and ensures
-- concurrent debits fail before the balance can become negative.
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_transaction_wallet_exists`
BEFORE INSERT ON `learner_terminal_transactions`
WHEN NOT EXISTS (
	SELECT 1 FROM `learner_terminal_wallets` w
	WHERE w.`profile_id` = NEW.`profile_id` AND w.`environment` = NEW.`environment`
)
BEGIN SELECT RAISE(ABORT, 'TERMINAL_WALLET_NOT_INITIALIZED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_transaction_balance_guard`
BEFORE INSERT ON `learner_terminal_transactions`
WHEN (
	SELECT w.`balance_coins` + NEW.`amount_coins`
	FROM `learner_terminal_wallets` w
	WHERE w.`profile_id` = NEW.`profile_id` AND w.`environment` = NEW.`environment`
) < 0
BEGIN SELECT RAISE(ABORT, 'TERMINAL_WALLET_INSUFFICIENT'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_transaction_apply`
AFTER INSERT ON `learner_terminal_transactions`
BEGIN
	UPDATE `learner_terminal_wallets`
	SET `balance_coins` = `balance_coins` + NEW.`amount_coins`, `updated_at` = NEW.`created_at`
	WHERE `profile_id` = NEW.`profile_id` AND `environment` = NEW.`environment`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_transaction_immutable_update`
BEFORE UPDATE ON `learner_terminal_transactions`
BEGIN SELECT RAISE(ABORT, 'TERMINAL_TRANSACTION_IMMUTABLE:update'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_transaction_immutable_delete`
BEFORE DELETE ON `learner_terminal_transactions`
BEGIN SELECT RAISE(ABORT, 'TERMINAL_TRANSACTION_IMMUTABLE:delete'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_inventory_slot_match_insert`
BEFORE INSERT ON `learner_terminal_equipment`
WHEN NOT EXISTS (
	SELECT 1 FROM `learner_terminal_inventory` i
	WHERE i.`profile_id` = NEW.`profile_id` AND i.`item_id` = NEW.`item_id`
)
BEGIN SELECT RAISE(ABORT, 'TERMINAL_ITEM_NOT_OWNED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_learner_terminal_inventory_slot_match_update`
BEFORE UPDATE ON `learner_terminal_equipment`
WHEN NOT EXISTS (
	SELECT 1 FROM `learner_terminal_inventory` i
	WHERE i.`profile_id` = NEW.`profile_id` AND i.`item_id` = NEW.`item_id`
)
BEGIN SELECT RAISE(ABORT, 'TERMINAL_ITEM_NOT_OWNED'); END;
