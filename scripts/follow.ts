// Usage: npm run follow -- <slug> <id> — follows ANY live game every 60 s and prints the
// notifications decide would send (as if we followed the home team). No DB, no Telegram. Ctrl+C to stop.
import { decideNotifications } from '../src/server/bot/decide.js';
import { scoreLine } from '../src/server/bot/messages.js';
import { fetchNextData, gamePath } from '../src/server/promiedos/fetch.js';
import { parseGame } from '../src/server/promiedos/parse.js';
import { formatArTime } from '../src/server/time.js';

const [slug, id] = process.argv.slice(2);
if (!slug || !id) throw new Error('Usage: npm run follow -- <slug> <id>');

const sent = new Set<string>();

async function poll() {
  const now = new Date();
  try {
    const game = (await fetchNextData(gamePath(slug, id))).initialData.game;
    const m = parseGame(game, game.teams[0].id);
    console.log(`[${formatArTime(now)}] · ${m.statusText} ${m.minute ?? ''} · ${scoreLine(m)}`);
    for (const n of decideNotifications(m, sent, now)) {
      console.log(`\n${n.text}\n   (${n.key})\n`);
      sent.add(n.key);
    }
  } catch (err) {
    console.error(`[${formatArTime(now)}] error:`, err instanceof Error ? err.message : err);
  }
}

await poll();
setInterval(poll, 60_000);
