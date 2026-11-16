import { z } from 'zod';
import { parseArDateTime } from '../time.js';

export const BOCA_ID = 'igg';
export type Side = 'home' | 'away';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'other';
export interface Team { id: string; name: string; shortName: string; color: string; textColor: string }
export interface Goal { side: Side; minute: string; player: string }
export interface Starter { number: number; name: string; shortName: string; position: string }
export interface Lineup { confirmed: boolean; formation: string | null; starters: Starter[] }
export interface Score { home: number; away: number }
export interface MatchSnapshot {
  id: string; slug: string; competition: string; round: string | null; startsAt: Date;
  home: Team; away: Team; ourSide: Side;   // ourSide: where the followed team plays
  status: MatchStatus; statusText: string; minute: string | null;
  score: Score | null; penalties: Score | null;
  lineup: Lineup | null;                   // the followed team's lineup
  goals: Goal[];                           // shootout excluded, in order
}
export interface TeamGameRef { id: string; slug: string; startsAt: Date; status: MatchStatus }

// Only the fields we use; zod drops the rest. Scheduled games come without
// scores, events and players, so those are optional.
const Status = z.object({ enum: z.number(), name: z.string() });
const Pair = z.tuple([z.number(), z.number()]).nullish();
const TeamSchema = z.object({
  id: z.string(), name: z.string(), short_name: z.string(),
  colors: z.object({ color: z.string(), text_color: z.string() }),
});
const LineupTeam = z.object({
  team_num: z.number(), status: z.string(), formation: z.string().nullish(),
  starting: z.array(z.object({
    jersey_num: z.number(), name: z.string(), player_short_name: z.string(), position: z.string(),
  })),
});
const Event = z.object({ type: z.number(), team: z.number(), time: z.string(), texts: z.array(z.string()) });
const Stage = z.object({ is_penalties_stage: z.boolean().nullish(), rows: z.array(z.object({ events: z.array(Event) })) });
const GameSchema = z.object({
  id: z.string(), url_name: z.string(), start_time: z.string(),
  league: z.object({ name: z.string() }), stage_round_name: z.string().nullish(),
  status: Status, game_time_to_display: z.string().nullish(),
  scores: Pair, penalties: Pair,
  teams: z.tuple([TeamSchema, TeamSchema]),
  players: z.object({ lineups: z.object({ teams: z.array(LineupTeam) }).nullish() }).nullish(),
  events: z.array(Stage).nullish(),
});
const GameRef = z.object({ id: z.string(), url_name: z.string(), start_time: z.string(), status: Status });
const TeamPage = z.object({
  games: z.object({
    next: z.object({ rows: z.array(z.object({ game: GameRef })) }),
    last: z.object({ rows: z.array(z.object({ game: GameRef })) }),
  }),
});

const GOAL = 1;
const PENALTY_GOAL = 3;
// ponytail: own goals have an event type we haven't seen yet, so they're not in `goals`.
// The tick still announces them from the score (no scorer). Add the type here when one shows up.

const toStatus = (n: number): MatchStatus => ({ 1: 'scheduled', 2: 'live', 3: 'finished' } as const)[n] ?? 'other';
const toScore = (p: [number, number] | null | undefined): Score | null => (p ? { home: p[0], away: p[1] } : null);
const toTeam = (t: z.infer<typeof TeamSchema>): Team => ({
  id: t.id, name: t.name, shortName: t.short_name, color: t.colors.color, textColor: t.colors.text_color,
});

/** `game` = pageProps.initialData.game. Throws if the shape changed or `teamId` doesn't play. */
export function parseGame(game: unknown, teamId: string = BOCA_ID): MatchSnapshot {
  const g = GameSchema.parse(game);
  const [home, away] = g.teams;
  const ourSide: Side | null = home.id === teamId ? 'home' : away.id === teamId ? 'away' : null;
  if (!ourSide) throw new Error(`Team ${teamId} doesn't play game ${g.id}`);

  const ours = g.players?.lineups?.teams.find((t) => t.team_num === (ourSide === 'home' ? 1 : 2));
  const lineup: Lineup | null = ours
    ? {
        confirmed: ours.status === 'Confirmado',
        formation: ours.formation ?? null,
        starters: ours.starting.map((p) => ({
          number: p.jersey_num, name: p.name, shortName: p.player_short_name, position: p.position,
        })),
      }
    : null;

  const goals: Goal[] = (g.events ?? [])
    .filter((stage) => stage.is_penalties_stage !== true)
    .flatMap((stage) => stage.rows.flatMap((row) => row.events))
    .filter((e) => e.type === GOAL || e.type === PENALTY_GOAL)
    .map((e) => ({ side: e.team === 1 ? 'home' : 'away', minute: e.time, player: e.texts[0] }));

  return {
    id: g.id, slug: g.url_name, competition: g.league.name, round: g.stage_round_name || null,
    startsAt: parseArDateTime(g.start_time),
    home: toTeam(home), away: toTeam(away), ourSide,
    status: toStatus(g.status.enum), statusText: g.status.name, minute: g.game_time_to_display || null,
    score: toScore(g.scores), penalties: toScore(g.penalties),
    lineup, goals,
  };
}

/** `data` = pageProps.data of /team/<slug>/<id>. */
export function parseTeamPage(data: unknown): { next: TeamGameRef[]; last: TeamGameRef[] } {
  const { games } = TeamPage.parse(data);
  const toRef = ({ game: g }: { game: z.infer<typeof GameRef> }): TeamGameRef => ({
    id: g.id, slug: g.url_name, startsAt: parseArDateTime(g.start_time), status: toStatus(g.status.enum),
  });
  return { next: games.next.rows.map(toRef), last: games.last.rows.map(toRef) };
}
