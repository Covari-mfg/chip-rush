ALTER TABLE `scores` ADD `days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `scores_days` ON `scores` (`ruleset`,`days`,`points`);