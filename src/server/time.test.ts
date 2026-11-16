import { describe, expect, it } from 'vitest';
import { formatArDay, formatArTime, matchdaySendAt, parseArDateTime } from './time.js';

describe('time', () => {
  it('parses Argentine local time', () => {
    expect(parseArDateTime('02-05-2026 16:15').toISOString()).toBe('2026-05-02T19:15:00.000Z');
  });
  it('formats in Argentine time', () => {
    const d = new Date('2026-11-01T18:00:00Z');
    expect(formatArTime(d)).toBe('15:00');
    expect(formatArDay(d)).toBe('dom 1/11');
  });
  it('matchday message at 10:00, or 2 h before an early kickoff', () => {
    expect(matchdaySendAt(new Date('2026-11-01T18:00:00Z')).toISOString()).toBe('2026-11-01T13:00:00.000Z');
    expect(matchdaySendAt(new Date('2026-11-01T14:00:00Z')).toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(matchdaySendAt(new Date('2026-11-01T04:00:00Z')).toISOString()).toBe('2026-11-01T02:00:00.000Z');
  });
});
