DROP INDEX `scores_board`;--> statement-breakpoint
ALTER TABLE `scores` ADD `points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `scores_board` ON `scores` (`ruleset`,`points`,`shipped`,`created_at`);