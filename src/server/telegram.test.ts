import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from './telegram.js';

// telegram.ts imports the queries for broadcast; sendMessage never touches the DB.
vi.mock('./db/queries.js', () => ({}));

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('sendMessage', () => {
  it.each([
    [200, { ok: true }, 'ok'],
    [403, { ok: false, description: 'Forbidden: bot was blocked by the user' }, 'blocked'],
    [400, { ok: false, description: 'Bad Request: chat not found' }, 'error'],
  ])('maps HTTP %i to %s', async (status, body, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(status, body)));
    expect(await sendMessage(1, 'hola')).toBe(expected);
  });

  it('retries once after a 429, and only once', async () => {
    const tooMany = () => reply(429, { ok: false, parameters: { retry_after: 0 } });
    const fetch = vi.fn().mockResolvedValueOnce(tooMany()).mockResolvedValueOnce(reply(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendMessage(1, 'hola')).toBe('ok');

    const fetch2 = vi.fn().mockResolvedValueOnce(tooMany()).mockResolvedValueOnce(tooMany());
    vi.stubGlobal('fetch', fetch2);
    expect(await sendMessage(1, 'hola')).toBe('error');
    expect(fetch2).toHaveBeenCalledTimes(2);
  });

  it('returns error instead of throwing when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await sendMessage(1, 'hola')).toBe('error');
  });
});
