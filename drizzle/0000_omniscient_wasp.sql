CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`role` integer NOT NULL,
	`ruleset` text NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_player_started` ON `runs` (`player`,`started_at`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` integer NOT NULL,
	`ruleset` text NOT NULL,
	`score` integer NOT NULL,
	`shipped` integer NOT NULL,
	`missed` integer NOT NULL,
	`sourced` integer NOT NULL,
	`calls` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scores_board` ON `scores` (`ruleset`,`role`,`score`,`shipped`);