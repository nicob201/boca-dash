// Usage: npm run seed — one-off load of Boca's 2026 season into Postgres. Safe to re-run.
// Boca's page only lists its last ~30 games; older ones come from each tournament's rounds.
import { setTimeout as sleep } from 'node:timers/promises';
import { gte } from 'drizzle-orm';
import { db } from '../src/server/db/client.js';
import { getStoredMatch } from '../src/server/db/queries.js';
import { matches } from '../src/server/db/schema.js';
import { fetchApi, fetchNextData, TEAM_PATH } from '../src/server/promiedos/fetch.js';
import { BOCA_ID, parseTeamPage } from '../src/server/promiedos/parse.js';
import { syncMatch } from '../src/server/sync.js';
import { parseArDateTime } from '../src/server/time.js';

const TOURNAMENTS = ['liga-profesional/hc', 'libertadores/bac', 'conmebol-sudamericana/dij', 'copa-argentina/gea'];
const YEAR_START = parseArDateTime('01-01-2026 00:00');
const pause = () => sleep(1000);   // be polite: one request per second

type ApiGame = { id: string; url_name: string; start_time: string; teams: { id: string }[] };
type Ref = { id: string; slug: string; startsAt: Date };

try {
  const { last } = parseTeamPage((await fetchNextData(TEAM_PATH)).data);
  const oldest = new Date(Math.min(...last.map((g) => g.startsAt.getTime())));
  console.log(`Boca's page: ${last.length} past games, oldest ${oldest.toISOString()}`);
  const refs: Ref[] = [...last];

  for (const tournament of TOURNAMENTS) {
    await pause();
    const leagueId = tournament.split('/')[1];
    const filters: { key: string }[] = (await fetchNextData(`/league/${tournament}`)).data.games.filters;
    let found = 0;
    for (const { key } of filters.filter((f) => f.key !== 'latest')) {
      await pause();
      const games: ApiGame[] = (await fetchApi(`/league/games/${leagueId}/${key}`)).games ?? [];
      const boca = games
        .filter((g) => g.teams.some((t) => t.id === BOCA_ID))
        .map((g) => ({ id: g.id, slug: g.url_name, startsAt: parseArDateTime(g.start_time) }));
      if (boca.some((g) => g.startsAt >= oldest)) break;   // from here on, Boca's page has it
      const recovered = boca.filter((g) => g.startsAt >= YEAR_START);
      refs.push(...recovered);
      found += recovered.length;
    }
    console.log(`${tournament}: ${found} older games recovered`);
  }

  refs.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const [i, ref] of refs.entries()) {
    const tag = `[${i + 1}/${refs.length}] ${ref.slug}`;
    if ((await getStoredMatch(ref.id))?.status === 'finished') { console.log(`${tag}: already stored`); continue; }
    await pause();
    const m = await syncMatch(ref, new Date());
    console.log(`${tag}: ${m.competition} · ${m.status} ${m.score ? `${m.score.home}-${m.score.away}` : ''}`);
  }

  console.log(`Done: ${await db.$count(matches, gte(matches.startsAt, YEAR_START))} games from 2026 stored.`);
} finally {
  await db.$client.end();
}
