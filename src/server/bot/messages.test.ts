import { describe, expect, it } from 'vitest';
import finished from '../promiedos/__fixtures__/game-finished.json' with { type: 'json' };
import { parseGame } from '../promiedos/parse.js';
import { welcomeMessage } from './messages.js';

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
