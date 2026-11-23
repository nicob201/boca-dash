import { BOCA_ID, type MatchSnapshot, type Side, type Team } from '../promiedos/parse.js';
import { formatArDay, formatArTime } from '../time.js';

export const rival = (m: MatchSnapshot): Team => (m.ourSide === 'home' ? m.away : m.home);

export const matchLine = (m: MatchSnapshot): string => (m.round ? `${m.round} · ${m.competition}` : m.competition);

export function welcomeMessage(next: MatchSnapshot | null): string {
  const nextPart = next
    ? `\n\nPróximo partido: ${formatArDay(next.startsAt)} · ${formatArTime(next.startsAt)} hs vs ${rival(next).name}\n${matchLine(next)}`
    : '';
  return `¡Listo! Te aviso cada vez que juegue Boca 💙💛${nextPart}\n\nPara dejar de recibir avisos: /stop`;
}

export const STOP_MESSAGE = 'Listo, no te mando más avisos. Si querés volver: /start';
export const HELP_MESSAGE = 'Comandos:\n/start para recibir los avisos de Boca\n/stop para dejar de recibirlos';

// ---- match notifications ----

const teamName = (t: Team): string => (t.id === BOCA_ID ? 'Boca' : t.shortName);

export const scoreLine = (m: MatchSnapshot): string =>
  `${teamName(m.home)} ${m.score?.home ?? 0}-${m.score?.away ?? 0} ${teamName(m.away)}`;

export const matchdayMessage = (m: MatchSnapshot): string =>
  `💙💛 ¡Hoy juega Boquita!\n${formatArTime(m.startsAt)} hs vs ${rival(m).name}\n${matchLine(m)}`;

export function lineupMessage(m: MatchSnapshot): string {
  const formation = m.lineup?.formation ? ` (${m.lineup.formation})` : '';
  const starters = (m.lineup?.starters ?? []).map((p) => `${p.number} ${p.shortName}`);
  return [`📋 Formación confirmada${formation}`, ...starters].join('\n');
}

export const kickoffMessage = (m: MatchSnapshot): string => `🟢 ¡Arrancó el partido!\n${scoreLine(m)}`;

// ponytail: shows the current score, so two goals caught in the same tick both show the later score
export function goalMessage(m: MatchSnapshot, goal: { side: Side; player: string | null; minute: string | null }): string {
  const detail = goal.player ? ` ${goal.player}${goal.minute ? ` ${goal.minute}` : ''}` : '';
  const head = goal.side === m.ourSide ? `⚽ ¡GOOOL DE BOCA!${detail}` : `Gol de ${rival(m).shortName}.${detail}`;
  return `${head}\n${scoreLine(m)}`;
}

export const annulledMessage = (m: MatchSnapshot): string => `❌ Gol anulado\n${scoreLine(m)}`;

export function finalMessage(m: MatchSnapshot): string {
  const p = m.penalties;
  const shootout = p
    ? `\n${teamName(p.home > p.away ? m.home : m.away)} ganó ${Math.max(p.home, p.away)}-${Math.min(p.home, p.away)} por penales`
    : '';
  return `🏁 Final: ${scoreLine(m)}${shootout}`;
}
