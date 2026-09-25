import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
  id:text('id').primaryKey(), player:text('player').notNull(), role:integer('role').notNull(),
  ruleset:text('ruleset').notNull(), startedAt:integer('started_at').notNull(),
}, t=>[index('runs_player_started').on(t.player,t.startedAt)]);
export const scores = sqliteTable('scores', {
  id:text('id').primaryKey(), name:text('name').notNull(), role:integer('role').notNull(),
  ruleset:text('ruleset').notNull(), score:integer('score').notNull(), shipped:integer('shipped').notNull(),
  missed:integer('missed').notNull(), sourced:integer('sourced').notNull(), calls:integer('calls').notNull(),
  createdAt:integer('created_at').notNull(),
}, t=>[index('scores_board').on(t.ruleset,t.role,t.score,t.shipped)]);
