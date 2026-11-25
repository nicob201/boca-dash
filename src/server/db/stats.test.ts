import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './client.js';
import { matches } from './schema.js';
import { getKpis, getLeaders, getNextAndLast, getSeason, getSeasonLeagues, getSeasonMatches } from './stats.js';
import { fixtures, insertMatch } from './test-db.js';

vi.mock('./client.js', async () => ({ db: await (await import('./test-db.js')).createTestDb() }));

beforeEach(async () => {
  await db.delete(matches);
  for (const m of Object.values(fixtures)) await insertMatch(db, m);
});

describe('getSeason', () => {
  it('is the Argentine year of the last finished official match', async () => {
    expect(await getSeason()).toBe(2026);
  });
  it('ignores a January friendly', async () => {
    await insertMatch(db, { id: 'j1', competition: 'Partido Amistoso', startsAt: '2027-01-10T20:00Z', status: 'finished', home: 1, away: 0 });
    expect(await getSeason()).toBe(2026);
  });
  it('counts 31/12 22:00 AR as that year', async () => {
    await insertMatch(db, { id: 'd31', competition: 'Liga Profesional Argentina', round: 'Clausura, Fecha 17', startsAt: '2027-01-01T01:00Z', status: 'finished', home: 1, away: 0 });
    expect(await getSeason()).toBe(2026);
  });
  it('is null without official matches', async () => {
    await db.delete(matches);
    expect(await getSeason()).toBeNull();
  });
});

describe('getKpis', () => {
  it('per tournament plus Todos, friendlies out, penalties as a draw', async () => {
    const k = await getKpis(2026);
    expect(Object.keys(k)).toEqual(['Todos', 'Apertura', 'Libertadores', 'Clausura']);
    expect(k.Todos).toEqual({ played: 4, won: 2, drawn: 1, lost: 1, goalsFor: 6, goalsAgainst: 3, cleanSheets: 1, streak: ['G', 'G', 'E', 'P'] });
    expect(k.Apertura).toEqual({ played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, cleanSheets: 1, streak: ['G', 'E'] });
    expect(k.Clausura.streak).toEqual(['P']);
  });
  it('streak keeps only the last 5, oldest first', async () => {
    for (let i = 1; i <= 5; i++)
      await insertMatch(db, { id: `w${i}`, competition: 'Liga Profesional Argentina', round: `Clausura, Fecha ${i}`, startsAt: `2026-08-0${i}T20:00Z`, status: 'finished', home: 1, away: 0 });
    expect((await getKpis(2026)).Clausura.streak).toEqual(['G', 'G', 'G', 'G', 'P']);
  });
});

describe('getLeaders', () => {
  it('counts Boca goals in play only, per tournament and Todos', async () => {
    const { scorers, assists } = await getLeaders(2026);
    expect(scorers.Todos).toEqual([
      { name: 'Miguel Merentiel', goals: 3 }, { name: 'Leandro Paredes', goals: 2 }, { name: 'Milton Giménez', goals: 1 },
    ]);
    expect(scorers.Libertadores.map((s) => s.name)).toEqual(['Leandro Paredes', 'Miguel Merentiel', 'Milton Giménez']); // empate en 1: por nombre
    expect(scorers.Clausura).toBeUndefined();
    expect(assists.Todos).toEqual([{ name: 'Leandro Paredes', assists: 2 }]);
  });
  it("survives a finished match stored with events: null", async () => {
    await insertMatch(db, { id: 'n1', competition: 'Liga Profesional Argentina', round: 'Clausura, Fecha 9', startsAt: '2026-09-01T20:00Z', status: 'finished', home: 1, away: 1, events: null });
    expect((await getLeaders(2026)).scorers.Todos).toHaveLength(3);
  });
});

describe('getSeasonMatches', () => {
  it('finished matches of the season, newest first, friendlies included', async () => {
    const ms = await getSeasonMatches(2026);
    expect(ms.map((m) => m.id)).toEqual(['c1', 'f1', 'a2', 'l1', 'a1']);
    const a2 = ms.find((m) => m.id === 'a2')!;
    expect(a2).toMatchObject({ tournament: 'Apertura', venue: 'away', result: 'E', score: { home: 1, away: 1 }, penalties: { home: 3, away: 4 } });
    expect(a2.rival.name).toBe('Rival a2');
    expect(ms.find((m) => m.id === 'f1')!.tournament).toBe('Amistoso');
  });
});

describe('getNextAndLast', () => {
  it('next scheduled and last finished', async () => {
    const { next, last } = await getNextAndLast(new Date('2026-11-27T00:00Z'));
    expect(next).toMatchObject({ id: 's1', tournament: 'Copa Argentina', result: null, score: null });
    expect(last?.id).toBe('c1');
  });
});

describe('getSeasonLeagues', () => {
  it('leagues of the season without friendlies', async () => {
    const ls = await getSeasonLeagues(2026);
    expect(ls.map((l) => l.id).sort()).toEqual(['bac', 'gea', 'hc']);
    expect(ls.find((l) => l.id === 'hc')!.urlName).toBe('liga-profesional');
  });
});
