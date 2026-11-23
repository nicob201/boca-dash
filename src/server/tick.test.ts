import { describe, expect, it, vi } from 'vitest';
import { shouldPoll } from './tick.js';

// tick.ts imports the queries; shouldPoll never touches the DB.
vi.mock('./db/queries.js', () => ({}));

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
