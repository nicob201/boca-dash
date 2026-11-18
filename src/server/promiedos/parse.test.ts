import { describe, expect, it } from 'vitest';
import finished from './__fixtures__/game-finished.json' with { type: 'json' };
import penalties from './__fixtures__/game-penalties.json' with { type: 'json' };
import extraTime from './__fixtures__/game-extra-time.json' with { type: 'json' };
import live from './__fixtures__/game-live.json' with { type: 'json' };
import team from './__fixtures__/team.json' with { type: 'json' };
import { parseGame, parseTeamPage } from './parse.js';

describe('parseGame', () => {
  it('finished match: Central Córdoba 1-2 Boca', () => {
    const m = parseGame(finished);
    expect(m).toMatchObject({
      id: 'egdbgje', slug: 'central-cordoba-sde-vs-boca-juniors',
      competition: 'Liga Profesional Argentina', round: 'Apertura, Fecha 9',
      ourSide: 'away', status: 'finished', minute: null,
      score: { home: 1, away: 2 }, penalties: null,
    });
    expect(m.away.shortName).toBe('Boca Jrs.');
    expect(m.startsAt.toISOString()).toBe('2026-05-02T19:15:00.000Z');
    expect(m.lineup).toMatchObject({ confirmed: true, formation: '4-2-3-1' });
    expect(m.lineup?.starters).toHaveLength(11);
    expect(m.lineup?.starters[0]).toMatchObject({ number: 12, shortName: 'Leandro Brey' });
    expect(m.goals).toEqual([
      { side: 'away', minute: "43'", player: 'Alan Velasco' },
      { side: 'away', minute: "45'", player: 'Milton Giménez' },
      { side: 'home', minute: "56'", player: 'Michael Santos' },
    ]);
  });

  it('shootout kicks are not goals; the shootout score comes apart', () => {
    expect(parseGame(penalties)).toMatchObject({
      status: 'finished', score: { home: 0, away: 0 }, penalties: { home: 3, away: 4 }, goals: [],
    });
  });

  it('extra time: enum 3 is finished even if the name says "En Tiempo Extra"; penalty goals count', () => {
    const m = parseGame(extraTime);
    expect(m).toMatchObject({ status: 'finished', statusText: 'En Tiempo Extra', ourSide: 'home', score: { home: 2, away: 3 } });
    expect(m.goals.map((g) => `${g.side} ${g.minute} ${g.player}`)).toEqual([
      "away 5' Leonardo Gil", "home 87' Milton Giménez", "away 94' Oscar Romero",
      "away 103' Oscar Romero", "home 116' Angel Romero",
    ]);
  });

  it('live match of any team (captured in extra time, Copa del Rey)', () => {
    const m = parseGame(live, live.teams[0].id);
    expect(m).toMatchObject({ status: 'live', statusText: 'Suplementario', minute: "98'", score: { home: 1, away: 1 } });
    expect(m.goals).toEqual([
      { side: 'home', minute: "65'", player: 'A. Camara' },
      { side: 'away', minute: "73'", player: 'Urko Collado' },
    ]);
  });

  it('unknown status enum maps to other', () => {
    expect(parseGame({ ...finished, status: { ...finished.status, enum: 7 } }).status).toBe('other');
  });

  it('rejects a payload without status', () => {
    const { status: _status, ...broken } = finished;
    expect(() => parseGame(broken)).toThrow();
  });

  it('rejects a match the followed team does not play', () => {
    expect(() => parseGame(finished, 'zzz')).toThrow();
  });
});

describe('parseTeamPage', () => {
  it('returns finished last games and upcoming next games, in order', () => {
    const t = parseTeamPage(team);
    expect(t.last.length).toBeGreaterThan(0);
    expect(t.next.length).toBeGreaterThan(0);
    expect(t.last.every((g) => g.status === 'finished')).toBe(true);
    expect(t.next.every((g) => g.id !== '' && g.slug !== '')).toBe(true);
    expect(t.next[0].startsAt.getTime()).toBeGreaterThan(t.last[t.last.length - 1].startsAt.getTime());
  });
});
