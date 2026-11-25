// Dashboard numbers, computed with SQL over `matches` (a learning decision: we don't copy promiedos' totals).
import { sql, type SQL } from 'drizzle-orm';
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
 * The one place that defines the season's matches: `m` = matches of that Argentine year, plus
 * `tournament` (Apertura/Clausura split by round, playoffs by semester), `gf`/`ga` from Boca's side
 * and `result`. Every query below starts with it.
 */
const seasonMatches = (season: number) => sql`
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
      where extract(year from starts_at at time zone ${AR}) = ${season}
    ) x
  )`;

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
