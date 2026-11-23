// Usage: npm run broadcast -- "texto" — sends a text to every active subscriber.
import { db } from '../src/server/db/client.js';
import { broadcast } from '../src/server/telegram.js';

const text = process.argv[2];
if (!text) throw new Error('Usage: npm run broadcast -- "<texto>"');

try {
  console.log(await broadcast(text));
} finally {
  await db.$client.end();   // close the pool, or the script never exits
}
