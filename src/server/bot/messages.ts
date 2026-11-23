import type { MatchSnapshot, Team } from '../promiedos/parse.js';
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
