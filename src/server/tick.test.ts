import { describe, expect, it, vi } from 'vitest';
import { getMatchesStartingBetween } from './db/queries.js';
import { broadcast } from './telegram.js';
import { runTick, shouldPoll } from './tick.js';

// runTick's I/O, faked: one match with one notice to send, and no general sync due.
vi.mock('./db/queries.js', () => ({
  getMatchesStartingBetween: vi.fn(),
  getSentKeys: vi.fn(async () => new Set()),
  claimNotification: vi.fn(async () => true),
  getKv: vi.fn(async () => new Date().toISOString()),
  setKv: vi.fn(),
}));
vi.mock('./telegram.js', () => ({ broadcast: vi.fn(), sendMessage: vi.fn(async () => 'ok') }));
vi.mock('./sync.js', () => ({ generalSync: vi.fn(async () => []), syncMatch: vi.fn() }));
vi.mock('./promiedos/parse.js', () => ({ parseGame: vi.fn(() => ({})) }));
vi.mock('./bot/decide.js', () => ({ decideNotifications: vi.fn(() => [{ key: 'kickoff', text: '¡Arrancó!' }]) }));

const match = { id: 'm1', slug: 'x', status: 'finished' as const, startsAt: new Date(), syncedAt: new Date(), raw: {} };

describe('runTick', () => {
  it('throws when the database is unreachable, so the route answers 500 and cron-job.org emails', async () => {
    vi.mocked(getMatchesStartingBetween).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    await expect(runTick()).rejects.toThrow('ECONNREFUSED');
  });

  it('reports a notice whose sends failed instead of passing it as sent', async () => {
    vi.mocked(getMatchesStartingBetween).mockResolvedValueOnce([match]);
    vi.mocked(broadcast).mockResolvedValueOnce({ ok: 0, blocked: 0, failed: 3 });
    const report = await runTick();
    expect(report.sent).toEqual(['m1:kickoff']);
    expect(report.errors).toEqual([expect.stringContaining('3 of 3 sends failed')]);
  });
});

const startsAt = new Date('2026-05-02T19:15:00Z');
const at = (iso: string, syncedIso: string, status: 'scheduled' | 'live' | 'finished' = 'scheduled') =>
  shouldPoll({ status, startsAt, syncedAt: new Date(syncedIso) }, new Date(iso));

describe('shouldPoll', () => {
  it('not before the 90-minute window', () => {
    expect(at('2026-05-02T17:44:00Z', '2026-05-02T10:00:00Z')).toBe(false);
  });
  it('every 5 minutes before kickoff', () => {
    expect(at('2026-05-02T18:15:00Z', '2026-05-02T18:12:00Z')).toBe(false);
    expect(at('2026-05-02T18:15:00Z', '2026-05-02T18:10:00Z')).toBe(true);
  });
  it('every tick from kickoff on', () => {
    expect(at('2026-05-02T19:40:00Z', '2026-05-02T19:39:30Z', 'live')).toBe(true);
  });
  it('stops 4 hours after kickoff, and never for a finished match', () => {
    expect(at('2026-05-02T23:16:00Z', '2026-05-02T19:00:00Z', 'live')).toBe(false);
    expect(at('2026-05-02T21:00:00Z', '2026-05-02T20:00:00Z', 'finished')).toBe(false);
  });
});
