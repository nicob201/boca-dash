// Dashboard numbers, computed with SQL over `matches` (a learning decision: we don't copy promiedos' totals).
import { sql, type SQL } from 'drizzle-orm';
import type { MatchStatus, Score, Side } from '../promiedos/parse.js';
import { db } from './client.js';

export type Result = 'G' | 'E' | 'P';
export interface Kpis {
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; cleanSheets: number; streak: Result[];
}

// postgres.js returns the rows; PGlite (tests) returns { rows }.
async function rows<T>(q: SQL): Promise<T[]> {
  const r: any = await db.execute(q);
  return Array.isArray(r) ? r : r.rows;
}

const AR = sql.raw(`'America/Argentina/Buenos_Aires'`);

/**
 * The one place that defines what a match means here: `m` = the matches that pass `where`, plus
 * `tournament` (Apertura/Clausura split by round, playoffs by semester), `gf`/`ga` from Boca's side
 * and `result`. Every query below starts with it.
 */
const withMatches = (where: SQL) => sql`
  with m as (
    select x.*, case when gf > ga then 'G' when gf = ga then 'E' when gf < ga then 'P' end as result
    from (
      select matches.*,
        case
          when competition = 'Liga Profesional Argentina' then
            case when round like 'Apertura%' then 'Apertura' when round like 'Clausura%' then 'Clausura'
                 when extract(month from starts_at at time zone ${AR}) <= 6 then 'Apertura' else 'Clausura' end
          when competition = 'CONMEBOL Copa Libertadores' then 'Libertadores'
          when competition = 'CONMEBOL Copa Sudamericana' then 'Sudamericana'
          when competition = 'Partido Amistoso' then 'Amistoso'
          else competition end as tournament,
        case when our_side = 'home' then home_score else away_score end as gf,
        case when our_side = 'home' then away_score else home_score end as ga
      from matches
      where ${where}
    ) x
  )`;

const seasonMatches = (season: number) => withMatches(sql`extract(year from starts_at at time zone ${AR}) = ${season}`);

/** The Argentine year of the last finished official match: in January, last season until Boca plays. */
export async function getSeason(): Promise<number | null> {
  const [r] = await rows<{ y: number | null }>(sql`
    select max(extract(year from starts_at at time zone ${AR}))::int as y
    from matches where status = 'finished' and competition <> 'Partido Amistoso'`);
  return r?.y ?? null;
}

/** 'Todos' first, then each tournament in the order it started. Friendlies don't count; penalties are a draw. */
export async function getKpis(season: number): Promise<Record<string, Kpis>> {
  const result = await rows<{
    tournament: string; played: number; won: number; drawn: number; lost: number;
    goals_for: number; goals_against: number; clean_sheets: number; streak: Result[];
  }>(sql`${seasonMatches(season)},
    played as (
      select *,
        row_number() over (partition by tournament order by starts_at desc) as rn_t,
        row_number() over (order by starts_at desc) as rn_all
      from m where status = 'finished' and tournament <> 'Amistoso'
    )
    select coalesce(tournament, 'Todos') as tournament,
      count(*)::int as played,
      count(*) filter (where result = 'G')::int as won,
      count(*) filter (where result = 'E')::int as drawn,
      count(*) filter (where result = 'P')::int as lost,
      coalesce(sum(gf), 0)::int as goals_for,
      coalesce(sum(ga), 0)::int as goals_against,
      count(*) filter (where ga = 0)::int as clean_sheets,
      case when grouping(tournament) = 1
        then array_agg(result order by starts_at) filter (where rn_all <= 5)
        else array_agg(result order by starts_at) filter (where rn_t <= 5) end as streak
    from played
    group by rollup(tournament)
    order by grouping(tournament) desc, min(starts_at)`);

  return Object.fromEntries(result.map((r) => [r.tournament, {
    played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
    goalsFor: r.goals_for, goalsAgainst: r.goals_against, cleanSheets: r.clean_sheets, streak: r.streak ?? [],
  }]));
}

export interface Match {
  id: string; startsAt: string; competition: string; tournament: string; round: string | null; venue: Side;
  rival: { name: string; shortName: string; color: string; textColor: string };
  status: MatchStatus; score: Score | null; penalties: Score | null; result: Result | null;
}

type MatchRow = {
  id: string; starts_at: Date | string; competition: string; tournament: string; round: string | null; our_side: Side;
  status: MatchStatus; home_score: number | null; away_score: number | null;
  home_penalties: number | null; away_penalties: number | null; result: Result | null;
  rival: { name: string; short_name: string; colors: { color: string; text_color: string } };
};

// Only the rival out of `raw`: the whole JSON weighs tens of KB per match.
const matchCols = sql`id, starts_at, competition, tournament, round, our_side, status,
  home_score, away_score, home_penalties, away_penalties, result,
  raw->'teams'->(case when our_side = 'home' then 1 else 0 end) as rival`;

const pair = (home: number | null, away: number | null): Score | null => (home == null || away == null ? null : { home, away });

const toMatch = (r: MatchRow): Match => ({
  id: r.id, startsAt: new Date(r.starts_at).toISOString(), competition: r.competition, tournament: r.tournament,
  round: r.round, venue: r.our_side, status: r.status, result: r.result,
  rival: { name: r.rival.name, shortName: r.rival.short_name, color: r.rival.colors.color, textColor: r.rival.colors.text_color },
  score: pair(r.home_score, r.away_score), penalties: pair(r.home_penalties, r.away_penalties),
});

/** Finished matches of the season, newest first, friendlies included. */
export async function getSeasonMatches(season: number): Promise<Match[]> {
  const r = await rows<MatchRow>(sql`${seasonMatches(season)}
    select ${matchCols} from m where status = 'finished' order by starts_at desc`);
  return r.map(toMatch);
}

/** Any season: the closest scheduled match and the latest finished one (friendlies included). */
export async function getNextAndLast(now: Date): Promise<{ next: Match | null; last: Match | null }> {
  const [next] = await rows<MatchRow>(sql`${withMatches(sql`status = 'scheduled' and starts_at >= ${now.toISOString()}::timestamptz`)}
    select ${matchCols} from m order by starts_at limit 1`);
  const [last] = await rows<MatchRow>(sql`${withMatches(sql`status = 'finished'`)}
    select ${matchCols} from m order by starts_at desc limit 1`);
  return { next: next ? toMatch(next) : null, last: last ? toMatch(last) : null };
}

/** The promiedos leagues Boca plays this season (friendlies out): where the standings come from. */
export async function getSeasonLeagues(season: number): Promise<{ id: string; urlName: string }[]> {
  const r = await rows<{ id: string; url_name: string }>(sql`${seasonMatches(season)}
    select distinct raw->'league'->>'id' as id, raw->'league'->>'url_name' as url_name
    from m where tournament <> 'Amistoso'`);
  return r.map(({ id, url_name }) => ({ id, urlName: url_name }));
}

/**
 * Boca's goals in play (types 1 = goal, 3 = penalty goal; the shootout doesn't count), per tournament and 'Todos'.
 * The scorer is texts[0]; texts[1] is the assist, only on type 1.
 */
const leaders = async (season: number, who: 'scorer' | 'assist') => {
  const r = await rows<{ tournament: string; name: string; n: number }>(sql`${seasonMatches(season)},
    goals as (
      select m.tournament, e->'texts'->>0 as scorer, case when (e->>'type')::int = 1 then e->'texts'->>1 end as assist
      from m,
        -- zod lets promiedos send events: null, and jsonb_array_elements throws on a JSON null
        jsonb_array_elements(case when jsonb_typeof(m.raw->'events') = 'array' then m.raw->'events' else '[]' end) as st,
        jsonb_array_elements(st->'rows') as r,
        jsonb_array_elements(r->'events') as e
      where m.status = 'finished' and m.tournament <> 'Amistoso'
        and coalesce((st->>'is_penalties_stage')::boolean, false) = false
        and (e->>'type')::int in (1, 3)
        and (e->>'team')::int = case when m.our_side = 'home' then 1 else 2 end
    )
    select coalesce(tournament, 'Todos') as tournament, ${sql.raw(who)} as name, count(*)::int as n
    from goals where ${sql.raw(who)} is not null
    group by rollup(tournament), ${sql.raw(who)}
    order by grouping(tournament) desc, tournament, n desc, name`);
  const out: Record<string, { name: string; n: number }[]> = {};
  for (const { tournament, name, n } of r) (out[tournament] ??= []).push({ name, n });
  return out;
};

export async function getLeaders(season: number): Promise<{
  scorers: Record<string, { name: string; goals: number }[]>;
  assists: Record<string, { name: string; assists: number }[]>;
}> {
  const [s, a] = [await leaders(season, 'scorer'), await leaders(season, 'assist')];
  const map = <K extends string>(o: typeof s, key: K) =>
    Object.fromEntries(Object.entries(o).map(([t, list]) => [t, list.map(({ name, n }) => ({ name, [key]: n }) as { name: string } & Record<K, number>)]));
  return { scorers: map(s, 'goals'), assists: map(a, 'assists') };
}
