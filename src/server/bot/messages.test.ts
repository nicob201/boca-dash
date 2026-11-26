import { describe, expect, it } from 'vitest';
import finished from '../promiedos/__fixtures__/game-finished.json' with { type: 'json' };
import penalties from '../promiedos/__fixtures__/game-penalties.json' with { type: 'json' };
import { parseGame } from '../promiedos/parse.js';
import {
  annulledMessage, finalMessage, goalMessage, kickoffMessage, lineupMessage, matchdayMessage, welcomeMessage,
} from './messages.js';

// Central Córdoba (home) 1-2 Boca (away)
const m = parseGame(finished);

describe('welcomeMessage', () => {
  it('includes the next match', () => {
    expect(welcomeMessage(m)).toBe(
      '¡Listo! Te aviso cada vez que juegue Boca 💙💛\n\n' +
      'Próximo partido: sáb 2/5 · 16:15 hs vs Central Córdoba\n' +
      'Apertura, Fecha 9 · Liga Profesional Argentina\n\n' +
      'Para dejar de recibir avisos: /stop',
    );
  });
  it('works without a next match', () => {
    expect(welcomeMessage(null)).toBe('¡Listo! Te aviso cada vez que juegue Boca 💙💛\n\nPara dejar de recibir avisos: /stop');
  });
});

describe('match messages', () => {
  it('matchday', () => {
    expect(matchdayMessage(m)).toBe('💙💛 ¡Hoy juega Boquita!\n16:15 hs vs Central Córdoba\nApertura, Fecha 9 · Liga Profesional Argentina');
  });
  it('lineup as a pitch, one centered row per line', () => {
    expect(lineupMessage(m)).toBe(
      '📋 Formación confirmada (4-2-3-1)\n<pre>' +
      '             Leandro Brey\n\n' +
      'Braida  Pellegrino  Figal  J. Barinaga\n\n' +
      '       Tomás Belmonte  Alarcón\n\n' +
      '    Zeballos  Romero  Alan Velasco\n\n' +
      '               Giménez</pre>',
    );
  });
  it('lineup without formation falls back to a list', () => {
    const lines = lineupMessage({ ...m, lineup: { ...m.lineup!, formation: null } }).split('\n');
    expect(lines).toHaveLength(12);
    expect(lines.slice(0, 2)).toEqual(['📋 Formación confirmada', '12 Leandro Brey']);
  });
  it('kickoff, annulled and final', () => {
    expect(kickoffMessage(m)).toBe('🟢 ¡Arrancó el partido!\nCentral Córdoba 1-2 Boca');
    expect(annulledMessage(m)).toBe('❌ Gol anulado\nCentral Córdoba 1-2 Boca');
    expect(finalMessage(m)).toBe('🏁 Final: Central Córdoba 1-2 Boca');
  });
  it('goals: ours, theirs and without scorer', () => {
    expect(goalMessage(m, { side: 'away', player: 'Milton Giménez', minute: "45'" })).toBe("⚽ ¡GOOOL DE BOCA! Milton Giménez 45'\nCentral Córdoba 1-2 Boca");
    expect(goalMessage(m, { side: 'home', player: 'Michael Santos', minute: "56'" })).toBe("Gol de Central Córdoba. Michael Santos 56'\nCentral Córdoba 1-2 Boca");
    expect(goalMessage(m, { side: 'away', player: null, minute: null })).toBe('⚽ ¡GOOOL DE BOCA!\nCentral Córdoba 1-2 Boca');
  });
  it('final with penalties', () => {
    expect(finalMessage(parseGame(penalties))).toBe('🏁 Final: Vélez 0-0 Boca\nBoca ganó 4-3 por penales');
  });
});
