CREATE TABLE `remote_commands` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`room` text NOT NULL,
	`command` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remote_commands_id_unique` ON `remote_commands` (`id`);--> statement-breakpoint
CREATE INDEX `idx_remote_commands` ON `remote_commands` (`room`,`seq`);--> statement-breakpoint
CREATE TABLE `remote_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`join_hash` text NOT NULL,
	`code` text NOT NULL,
	`expires` integer NOT NULL,
	`host_seen` integer NOT NULL,
	`controller_seen` integer NOT NULL,
	`controller_id` text,
	`controller_key` text,
	`face_json` text,
	`face_seq` integer NOT NULL,
	`face_updated` integer NOT NULL,
	`state_json` text,
	`offer_json` text,
	`answer_json` text,
	`acked` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_remote_pair` ON `remote_rooms` (`owner`,`code`);--> statement-breakpoint
CREATE INDEX `idx_remote_expiry` ON `remote_rooms` (`expires`);