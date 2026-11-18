import { and, asc, eq, gte, lt } from 'drizzle-orm';
import type { MatchSnapshot, MatchStatus } from '../promiedos/parse.js';
import { db } from './client.js';
import { kv, matches, notifications, subscribers } from './schema.js';

export type StoredMatch = { id: string; slug: string; startsAt: Date; status: MatchStatus; syncedAt: Date; raw: unknown };

const storedCols = {
  id: matches.id, slug: matches.slug, startsAt: matches.startsAt,
  status: matches.status, syncedAt: matches.syncedAt, raw: matches.raw,
};

// ---- matches ----

export async function upsertMatch(s: MatchSnapshot, raw: unknown, now: Date): Promise<void> {
  const row = {
    slug: s.slug, competition: s.competition, round: s.round, startsAt: s.startsAt, status: s.status,
    homeScore: s.score?.home ?? null, awayScore: s.score?.away ?? null,
    homePenalties: s.penalties?.home ?? null, awayPenalties: s.penalties?.away ?? null,
    ourSide: s.ourSide, rivalName: (s.ourSide === 'home' ? s.away : s.home).name,
    raw, syncedAt: now,
  };
  await db.insert(matches).values({ id: s.id, ...row }).onConflictDoUpdate({ target: matches.id, set: row });
}

export async function getStoredMatch(id: string): Promise<StoredMatch | null> {
  const [m] = await db.select(storedCols).from(matches).where(eq(matches.id, id));
  return m ?? null;
}

/** [from, to), oldest first. */
export async function getMatchesStartingBetween(from: Date, to: Date): Promise<StoredMatch[]> {
  return db.select(storedCols).from(matches)
    .where(and(gte(matches.startsAt, from), lt(matches.startsAt, to)))
    .orderBy(asc(matches.startsAt));
}

export async function getNextMatch(now: Date): Promise<StoredMatch | null> {
  const [m] = await db.select(storedCols).from(matches)
    .where(and(eq(matches.status, 'scheduled'), gte(matches.startsAt, now)))
    .orderBy(asc(matches.startsAt)).limit(1);
  return m ?? null;
}

// ---- notifications ----

export async function getSentKeys(matchId: string): Promise<Set<string>> {
  const rows = await db.select({ key: notifications.key }).from(notifications).where(eq(notifications.matchId, matchId));
  return new Set(rows.map((r) => r.key));
}

/** true only for whoever inserts first: the PK (match_id, key) rejects the rest. */
export async function claimNotification(matchId: string, key: string): Promise<boolean> {
  const rows = await db.insert(notifications).values({ matchId, key }).onConflictDoNothing().returning({ key: notifications.key });
  return rows.length > 0;
}

// ---- subscribers ----

export async function subscribe(chatId: number): Promise<void> {
  await db.insert(subscribers).values({ chatId })
    .onConflictDoUpdate({ target: subscribers.chatId, set: { active: true } });
}

export async function unsubscribe(chatId: number): Promise<void> {
  await db.update(subscribers).set({ active: false }).where(eq(subscribers.chatId, chatId));
}

export async function activeChatIds(): Promise<number[]> {
  const rows = await db.select({ chatId: subscribers.chatId }).from(subscribers).where(eq(subscribers.active, true));
  return rows.map((r) => r.chatId);
}

// ---- kv ----

export async function getKv<T>(key: string): Promise<T | null> {
  const [row] = await db.select({ value: kv.value }).from(kv).where(eq(kv.key, key));
  return row ? (row.value as T) : null;
}

export async function setKv(key: string, value: unknown): Promise<void> {
  await db.insert(kv).values({ key, value })
    .onConflictDoUpdate({ target: kv.key, set: { value, updatedAt: new Date() } });
}
