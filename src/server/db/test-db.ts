// Test-only helpers: a real Postgres (PGlite, in memory) with our migrations applied.
// Don't import './client.js' here: the tests mock client.js with this file, so that would be circular.
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { MatchStatus, Side } from '../promiedos/parse.js';
import { matches } from './schema.js';

export async function createTestDb(): Promise<PgliteDatabase> {
  const db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}

export interface TestMatch {
  id: string; competition: string; round?: string | null; startsAt: string; ourSide?: Side;
  status: MatchStatus; home?: number; away?: number; homePen?: number; awayPen?: number; events?: unknown[] | null;
}

const LEAGUES: Record<string, { id: string; url_name: string }> = {
  'Liga Profesional Argentina': { id: 'hc', url_name: 'liga-profesional' },
  'CONMEBOL Copa Libertadores': { id: 'bac', url_name: 'conmebol-libertadores' },
  'Copa Argentina': { id: 'gea', url_name: 'copa-argentina' },
  'Partido Amistoso': { id: 'dcb', url_name: 'club-friendlies' },
};

const team = (id: string, name: string) => ({ id, name, short_name: name, colors: { color: '#123456', text_color: '#FFFFFF' } });

/** Inserts a match whose `raw` has the bits our SQL reads: teams, league and events. */
export async function insertMatch(db: PgDatabase<any, any>, m: TestMatch): Promise<void> {
  const ourSide = m.ourSide ?? 'home';
  const boca = team('igg', 'Boca Juniors');
  const rival = team(`r-${m.id}`, `Rival ${m.id}`);
  const raw = {
    league: { name: m.competition, ...(LEAGUES[m.competition] ?? { id: 'x', url_name: 'x' }) },
    teams: ourSide === 'home' ? [boca, rival] : [rival, boca],
    events: m.events === undefined ? [] : m.events,   // null on purpose: zod lets promiedos send `events: null`
  };
  await db.insert(matches).values({
    id: m.id, slug: m.id, competition: m.competition, round: m.round ?? null, startsAt: new Date(m.startsAt),
    status: m.status, homeScore: m.home ?? null, awayScore: m.away ?? null,
    homePenalties: m.homePen ?? null, awayPenalties: m.awayPen ?? null,
    ourSide, rivalName: rival.name, raw, syncedAt: new Date(m.startsAt),
  });
}

const ev = (type: number, team: 1 | 2, texts: string[]) => ({ type, team, time: "10'", texts });
const stage = (events: ReturnType<typeof ev>[], penalties = false) =>
  ({ name: '', is_penalties_stage: penalties, rows: events.map((e) => ({ time: e.time, events: [e] })) });

export const fixtures: Record<'a1' | 'l1' | 'a2' | 'f1' | 'c1' | 'o1' | 's1', TestMatch> = {
  a1: {
    id: 'a1', competition: 'Liga Profesional Argentina', round: 'Apertura, Fecha 1', startsAt: '2026-02-01T23:00Z',
    status: 'finished', home: 2, away: 0,
    events: [stage([ev(1, 1, ['Miguel Merentiel', 'Leandro Paredes']), ev(3, 1, ['Leandro Paredes'])])],
  },
  l1: {
    id: 'l1', competition: 'CONMEBOL Copa Libertadores', round: 'Fecha 1', startsAt: '2026-04-08T00:00Z', ourSide: 'away',
    status: 'finished', home: 1, away: 3,
    events: [stage([
      ev(1, 2, ['Miguel Merentiel']), ev(1, 2, ['Milton Giménez', 'Leandro Paredes']),
      ev(3, 2, ['Leandro Paredes']), ev(1, 1, ['Rival Uno']),
    ])],
  },
  a2: {
    id: 'a2', competition: 'Liga Profesional Argentina', round: null, startsAt: '2026-07-01T01:30Z', ourSide: 'away',
    status: 'finished', home: 1, away: 1, homePen: 3, awayPen: 4,
    events: [
      stage([ev(1, 2, ['Miguel Merentiel']), ev(1, 1, ['Rival Dos', 'Rival Tres'])]),
      stage([ev(3, 2, ['Leandro Paredes'])], true),
    ],
  },
  f1: {
    id: 'f1', competition: 'Partido Amistoso', round: null, startsAt: '2026-07-10T20:00Z',
    status: 'finished', home: 5, away: 0, events: [stage([ev(1, 1, ['Amistoso Uno'])])],
  },
  c1: { id: 'c1', competition: 'Liga Profesional Argentina', round: 'Octavos de Final', startsAt: '2026-11-26T00:00Z', status: 'finished', home: 0, away: 1 },
  o1: { id: 'o1', competition: 'Liga Profesional Argentina', round: 'Clausura, Fecha 16', startsAt: '2025-12-01T00:00Z', status: 'finished', home: 1, away: 0 },
  s1: { id: 's1', competition: 'Copa Argentina', round: 'Final', startsAt: '2026-12-02T17:00Z', status: 'scheduled' },
};
