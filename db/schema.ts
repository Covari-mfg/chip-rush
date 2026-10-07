import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
  id:text('id').primaryKey(), player:text('player').notNull(), role:integer('role').notNull(),
  ruleset:text('ruleset').notNull(), startedAt:integer('started_at').notNull(),
}, t=>[index('runs_player_started').on(t.player,t.startedAt)]);
export const scores = sqliteTable('scores', {
  id:text('id').primaryKey(), name:text('name').notNull(), role:integer('role').notNull(),
  ruleset:text('ruleset').notNull(), score:integer('score').notNull(), points:integer('points').notNull().default(0), shipped:integer('shipped').notNull(),
  missed:integer('missed').notNull(), sourced:integer('sourced').notNull(), calls:integer('calls').notNull(),
  // Open for Business: days survived. Shift rows keep the default 0.
  days:integer('days').notNull().default(0),
  createdAt:integer('created_at').notNull(),
}, t=>[index('scores_board').on(t.ruleset,t.points,t.shipped,t.createdAt),index('scores_days').on(t.ruleset,t.days,t.points)]);
