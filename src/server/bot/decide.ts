import type { MatchSnapshot } from '../promiedos/parse.js';
import { matchdaySendAt } from '../time.js';
import { annulledMessage, finalMessage, goalMessage, kickoffMessage, lineupMessage, matchdayMessage } from './messages.js';

export type Notification = { key: string; text: string; html?: boolean };

/**
 * Pure: compares the match as it is now with the keys already sent and returns
 * what's missing, in order. No events, no memory: a missed tick catches up on the next.
 *
 * Goal keys are `goal:{side}:{k}:{v}`: the k-th goal of that side, re-scored after v
 * annulments. They follow the score, not the scorer, because promiedos may fix the
 * scorer later; and the v lets a goal scored again after an annulment go out.
 */
export function decideNotifications(m: MatchSnapshot, sent: ReadonlySet<string>, now: Date): Notification[] {
  const out: Notification[] = [];
  const add = (key: string, text: string, html?: boolean) => { if (!sent.has(key)) out.push({ key, text, html }); };

  if (m.status === 'scheduled' && now >= matchdaySendAt(m.startsAt) && now < m.startsAt) add('matchday', matchdayMessage(m));
  if (m.lineup?.confirmed && (m.status === 'scheduled' || m.status === 'live')) add('lineup', lineupMessage(m), true);
  if (m.status === 'live') add('kickoff', kickoffMessage(m));

  // Goals only for a match we followed live: one first seen finished just gets the final.
  const following = sent.has('kickoff') || m.status === 'live';
  if (following && (m.status === 'live' || m.status === 'finished')) {
    for (const side of ['home', 'away'] as const) {
      const n = m.score?.[side] ?? 0;
      const scorers = m.goals.filter((g) => g.side === side);
      for (let k = 1; k <= n; k++) {
        const v = [...sent].filter((s) => s.startsWith(`annulled:${side}:${k}:`)).length;
        const g = scorers[k - 1];
        add(`goal:${side}:${k}:${v}`, goalMessage(m, { side, player: g?.player ?? null, minute: g?.minute ?? null }));
      }
      // A sent goal beyond the current score was annulled.
      for (const key of sent) {
        const [kind, s, k, v] = key.split(':');
        if (kind === 'goal' && s === side && Number(k) > n) add(`annulled:${side}:${k}:${v}`, annulledMessage(m));
      }
    }
  }

  if (m.status === 'finished') add('final', finalMessage(m));
  return out;
}
