// Usage: npm run sync — forces a general sync (Boca's page → Postgres) and prints the synced ids.
import { db } from '../src/server/db/client.js';
import { generalSync } from '../src/server/sync.js';

try {
  console.log(await generalSync(new Date()));
} finally {
  await db.$client.end();   // close the pool, or the script never exits
}
