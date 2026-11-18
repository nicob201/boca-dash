import { getStoredMatch, setKv, upsertMatch } from './db/queries.js';
import { fetchNextData, gamePath, TEAM_PATH } from './promiedos/fetch.js';
import { parseGame, parseTeamPage, type MatchSnapshot } from './promiedos/parse.js';

const MAX_PER_RUN = 8;

/** Downloads one game, parses it and stores it. Throws (and stores nothing) if the shape changed. */
export async function syncMatch(ref: { id: string; slug: string }, now: Date): Promise<MatchSnapshot> {
  const raw = (await fetchNextData(gamePath(ref.slug, ref.id))).initialData.game;
  const snapshot = parseGame(raw);
  await upsertMatch(snapshot, raw, now);
  return snapshot;
}

/** Boca's page → every upcoming game + every past one not stored as finished, up to 8 per run. */
export async function generalSync(now: Date): Promise<string[]> {
  const { next, last } = parseTeamPage((await fetchNextData(TEAM_PATH)).data);

  const todo = [...next];
  // `last` comes oldest first; newest first so the cap never skips the game that just ended.
  for (const ref of last.toReversed()) {
    if (todo.length >= MAX_PER_RUN) break;
    if ((await getStoredMatch(ref.id))?.status !== 'finished') todo.push(ref);
  }

  const ids: string[] = [];
  for (const ref of todo.slice(0, MAX_PER_RUN)) {   // in series, never Promise.all: be polite to promiedos
    await syncMatch(ref, now);
    ids.push(ref.id);
  }
  await setKv('sync:lastGeneral', now.toISOString());
  return ids;
}
