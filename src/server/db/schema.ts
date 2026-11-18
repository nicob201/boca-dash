import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { MatchStatus, Side } from '../promiedos/parse.js';

// Always timestamptz: Postgres stores UTC, we convert to Argentina time only when printing.
const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const matches = pgTable('matches', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  competition: text('competition').notNull(),
  round: text('round'),
  startsAt: tstz('starts_at').notNull(),
  status: text('status').$type<MatchStatus>().notNull(),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  homePenalties: integer('home_penalties'),
  awayPenalties: integer('away_penalties'),
  ourSide: text('our_side').$type<Side>().notNull(),
  rivalName: text('rival_name').notNull(),
  raw: jsonb('raw').notNull(),   // pageProps.initialData.game, as promiedos sent it
  syncedAt: tstz('synced_at').notNull(),
}, (t) => [index('matches_starts_at_idx').on(t.startsAt)]);

export const subscribers = pgTable('subscribers', {
  chatId: bigint('chat_id', { mode: 'number' }).primaryKey(),
  active: boolean('active').notNull().default(true),
  createdAt: tstz('created_at').notNull().defaultNow(),
});

// The composite PK is what makes a duplicate notification impossible.
export const notifications = pgTable('notifications', {
  matchId: text('match_id').notNull().references(() => matches.id),
  key: text('key').notNull(),
  sentAt: tstz('sent_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.matchId, t.key] })]);

export const kv = pgTable('kv', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});
