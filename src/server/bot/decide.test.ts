import { describe, expect, it } from 'vitest';
import finished from '../promiedos/__fixtures__/game-finished.json' with { type: 'json' };
import { parseGame, type MatchSnapshot } from '../promiedos/parse.js';
import { decideNotifications } from './decide.js';

// Boca away, kickoff 2026-05-02T19:15Z (16:15 AR)
const base = parseGame(finished);
const snap = (o: Partial<MatchSnapshot>): MatchSnapshot => ({ ...base, ...o });
const keys = (m: MatchSnapshot, sent: string[], iso: string) =>
  decideNotifications(m, new Set(sent), new Date(iso)).map((n) => n.key);
const pre = { status: 'scheduled' as const, score: null, goals: [] };
const live = (home: number, away: number) => ({ status: 'live' as const, score: { home, away }, goals: [] });

describe('decideNotifications', () => {
  it('nothing before 10:00 on match day', () => {
    expect(keys(snap({ ...pre, lineup: null }), [], '2026-05-02T12:59:00Z')).toEqual([]);
  });
  it('matchday at 10:00', () => {
    expect(keys(snap({ ...pre, lineup: null }), [], '2026-05-02T13:00:00Z')).toEqual(['matchday']);
  });
  it('no matchday once kickoff time has passed, even if promiedos still says scheduled', () => {
    expect(keys(snap({ ...pre, lineup: null }), [], '2026-05-02T19:16:00Z')).toEqual([]);
  });
  it('lineup once confirmed', () => {
    expect(keys(snap(pre), ['matchday'], '2026-05-02T18:30:00Z')).toEqual(['lineup']);
  });
  it('no matchday after kickoff, even if it was missed', () => {
    expect(keys(snap(live(0, 0)), [], '2026-05-02T19:20:00Z')).toEqual(['lineup', 'kickoff']);
  });
  it('our goal, with our tone', () => {
    const ns = decideNotifications(snap(live(0, 1)), new Set(['matchday', 'lineup', 'kickoff']), new Date('2026-05-02T19:40:00Z'));
    expect(ns.map((n) => n.key)).toEqual(['goal:away:1:0']);
    expect(ns[0].text.startsWith('⚽ ¡GOOOL DE BOCA!')).toBe(true);
  });
  it('rival goal, with the rival tone', () => {
    const ns = decideNotifications(snap(live(1, 0)), new Set(['lineup', 'kickoff']), new Date('2026-05-02T19:40:00Z'));
    expect(ns.map((n) => n.key)).toEqual(['goal:home:1:0']);
    expect(ns[0].text.startsWith('Gol de Central Córdoba.')).toBe(true);
  });
  it('two goals between ticks produce two notifications', () => {
    expect(keys(snap(live(0, 2)), ['lineup', 'kickoff'], '2026-05-02T19:50:00Z')).toEqual(['goal:away:1:0', 'goal:away:2:0']);
  });
  it('an annulled goal is reported', () => {
    expect(keys(snap(live(0, 0)), ['lineup', 'kickoff', 'goal:away:1:0'], '2026-05-02T19:45:00Z')).toEqual(['annulled:away:1:0']);
  });
  it('a new goal after an annulment is not blocked', () => {
    expect(keys(snap(live(0, 1)), ['lineup', 'kickoff', 'goal:away:1:0', 'annulled:away:1:0'], '2026-05-02T20:00:00Z')).toEqual(['goal:away:1:1']);
  });
  it('a goal right before the final whistle still goes out, then the final', () => {
    expect(keys(base, ['kickoff', 'goal:away:1:0', 'goal:away:2:0'], '2026-05-02T21:10:00Z')).toEqual(['goal:home:1:0', 'final']);
  });
  it('a match first seen finished only sends the final', () => {
    expect(keys(base, [], '2026-05-02T21:10:00Z')).toEqual(['final']);
  });
  it('a suspended match sends nothing', () => {
    expect(keys(snap({ status: 'other', score: { home: 0, away: 1 }, goals: [] }), ['kickoff', 'goal:away:1:0'], '2026-05-02T20:30:00Z')).toEqual([]);
  });
});
