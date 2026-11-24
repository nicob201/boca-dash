# Boca Dash

A Telegram bot that follows every Boca Juniors match and messages you as it happens: matchday, lineup, kickoff, each goal and the final score.

**Try it:** [t.me/BocaDashBot](https://t.me/BocaDashBot), send `/start` (and `/stop` to leave).

> A fan project, made out of passion. Not an official site of Club Atlético Boca Juniors. Match data comes from [promiedos.com.ar](https://www.promiedos.com.ar).

## What it sends

| Notice | When |
|---|---|
| Matchday | 10:00 (Argentina time) on match day, or 2 h before kickoff if that's earlier |
| Lineup | When Boca's starting XI is confirmed |
| Kickoff | When the match goes live |
| Goal | Every goal from either side, with scorer, minute and score |
| Disallowed goal | When the score goes down |
| Full time | Final score, plus penalties if there were any |

Messages are in Spanish (rioplatense) and times are in Argentina time.

## Architecture

```
              every minute
cron-job.org ─────────────► POST /api/cron/tick ─────► promiedos.com.ar
                                   │           (only around match time)
                                   ▼
Telegram ◄──── notices ───── Express (Vercel Function) ◄────► Postgres (Supabase)
    │                              ▲
    └── POST /api/telegram/webhook ┘
```

The **tick** is the only thing that talks to promiedos. It stores what it finds in Postgres, compares it with the notices already sent and sends what's missing. The bot's webhook only reads and writes the database. The number of users never changes the load on promiedos.

## Key decisions

- **Scraping `__NEXT_DATA__`, not HTML.** promiedos has no public API, but it's a Next.js app that embeds each page's data as JSON. We read that JSON and validate it with zod. If its shape changes, nothing is written and the admin gets a Telegram alert (at most once an hour).
- **An external clock, because serverless has no process alive.** Vercel functions only run when called, and Vercel's free cron runs once a day. cron-job.org calls the tick every minute, authenticated with a bearer secret checked in constant time. The tick always answers 200 with a report so the job isn't disabled on a bad day, and it keeps its work bounded to fit cron-job.org's 30 s timeout.
- **Compare states, not events.** Each tick compares the current match with the notices already sent, not with what happened in the previous tick. If the cron is down for 10 minutes, the next tick catches up.
- **At-most-once notices, enforced by the database.** Each notice is claimed with `insert … on conflict do nothing returning` on a `(match_id, key)` primary key *before* it's sent. Only one tick can win the claim, so two ticks running in parallel can't send a goal twice. The trade-off: a crash between claim and send loses that notice instead of repeating it.
- **Pure decision logic.** `decideNotifications(snapshot, sentKeys, now)` is a pure function: no I/O, `now` as a parameter. That's where the tests live.
- **Postgres + Drizzle.** Plain Postgres through Supabase's transaction pooler (serverless opens many short connections), without `supabase-js`. Drizzle gives types inferred from the schema while staying close to SQL. Times are stored as `timestamptz` (UTC) and converted to Argentina time only when printed.
- **Zero cost.** Vercel Hobby, Supabase free tier, cron-job.org and the Telegram Bot API through plain `fetch`, with no bot library.

## Project layout

```
api/index.ts            Vercel entry point (exports the Express app)
src/server/app.ts       Routes: health, Telegram webhook, cron tick
src/server/tick.ts      The per-minute job
src/server/bot/         decide (pure) and message texts
src/server/promiedos/   Fetch + zod parsing, with real JSON fixtures for tests
src/server/db/          Drizzle schema and queries
drizzle/                SQL migrations
scripts/                One-off tools: season seed, set webhook, broadcast, follow a live game
```

## Running locally

Requirements: Node 24 and a Postgres database (a free Supabase project works).

```bash
npm install
cp .env.example .env    # fill it in; each variable is explained there
npm run db:migrate      # create the tables
npm run seed            # optional: load the 2026 season
npm run dev             # http://localhost:3000
npm test                # 43 tests (vitest)
```

Run one tick by hand:

```bash
curl -X POST http://localhost:3000/api/cron/tick -H "Authorization: Bearer $CRON_SECRET"
```

Watch what the bot would send for any live game, without a database or Telegram:

```bash
npm run follow -- <slug> <id>   # from a promiedos URL: /game/<slug>/<id>
```

## Status

The bot is live in production. Next up: a public stats dashboard (React + Vite + Tailwind) with standings, season KPIs computed in SQL, scorers, squad and a live match view.

## Credits

Data from [promiedos.com.ar](https://www.promiedos.com.ar), fetched politely: an identifiable User-Agent, serial requests and only around match time (about 150 requests per match).
