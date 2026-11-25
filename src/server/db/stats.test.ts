import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './client.js';
import { matches } from './schema.js';
import { getKpis, getSeason } from './stats.js';
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
