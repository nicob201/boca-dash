import { decideNotifications } from './bot/decide.js';
import { claimNotification, getKv, getMatchesStartingBetween, getSentKeys, setKv, type StoredMatch } from './db/queries.js';
import { parseGame, type MatchSnapshot } from './promiedos/parse.js';
import { generalSync, syncMatch } from './sync.js';
import { broadcast, sendMessage } from './telegram.js';

export type TickReport = { polled: string[]; sent: string[]; synced: string[]; errors: string[] };

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Ask promiedos only around the match: every 5 min from 90 min before kickoff, every tick from kickoff to +4 h. */
export function shouldPoll(c: Pick<StoredMatch, 'status' | 'startsAt' | 'syncedAt'>, now: Date): boolean {
  const t = now.getTime();
  const start = c.startsAt.getTime();
  if (c.status === 'finished' || t < start - 90 * MIN || t > start + 4 * HOUR) return false;
  return t >= start || t - c.syncedAt.getTime() >= 5 * MIN;
}

/** Called by cron-job.org every minute. Never throws: errors go to the report and to the admin. */
export async function runTick(now = new Date()): Promise<TickReport> {
  const report: TickReport = { polled: [], sent: [], synced: [], errors: [] };
  const fail = async (where: string, err: unknown) => {
    const message = `${where}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(message);
    report.errors.push(message);
    try { await alertAdmin(message, now); } catch (e) { console.error('alertAdmin failed', e); }
  };

  try {
    const candidates = await getMatchesStartingBetween(new Date(now.getTime() - 4 * HOUR), new Date(now.getTime() + 24 * HOUR));
    for (const c of candidates) {
      try {   // one broken match doesn't stop the others
        let snapshot: MatchSnapshot;
        if (shouldPoll(c, now)) {
          snapshot = await syncMatch(c, now);
          report.polled.push(c.id);
        } else {
          snapshot = parseGame(c.raw);
        }
        // At-most-once: whoever claims the key sends; a crash after the claim loses that notice, never repeats it.
        for (const n of decideNotifications(snapshot, await getSentKeys(c.id), now)) {
          if (await claimNotification(c.id, n.key)) {
            await broadcast(n.text);
            report.sent.push(`${c.id}:${n.key}`);
          }
        }
        if (c.status !== 'finished' && snapshot.status === 'finished') await setKv('sync:due', true);
      } catch (err) {
        await fail(`match ${c.id}`, err);
      }
    }

    const last = await getKv<string>('sync:lastGeneral');
    if (!last || now.getTime() - Date.parse(last) >= 6 * HOUR || (await getKv<boolean>('sync:due')) === true) {
      report.synced = await generalSync(now);
      await setKv('sync:due', false);
    }
  } catch (err) {
    await fail('tick', err);
  }
  return report;
}

/** Telegram message to the author, at most once an hour so a broken promiedos doesn't send one per minute. */
export async function alertAdmin(message: string, now: Date): Promise<void> {
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!chatId) {
    console.error(`[alert, no ADMIN_CHAT_ID] ${message}`);
    return;
  }
  const last = await getKv<string>('alert:last');
  if (last && now.getTime() - Date.parse(last) <= HOUR) return;
  await sendMessage(Number(chatId), `⚠️ Boca Dash: ${message}`.slice(0, 500));
  await setKv('alert:last', now.toISOString());
}
