import { setTimeout as sleep } from 'node:timers/promises';
import { activeChatIds, unsubscribe } from './db/queries.js';
import { env } from './env.js';

type TgResponse = { ok: boolean; description?: string; parameters?: { retry_after?: number } };

async function call(method: string, body: object): Promise<{ status: number; data: TgResponse }> {
  const res = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return { status: res.status, data: (await res.json()) as TgResponse };
}

export async function sendMessage(chatId: number, text: string): Promise<'ok' | 'blocked' | 'error'> {
  const body = { chat_id: chatId, text, link_preview_options: { is_disabled: true } };
  try {
    let r = await call('sendMessage', body);
    if (r.status === 429) {
      await sleep((r.data.parameters?.retry_after ?? 1) * 1000);
      r = await call('sendMessage', body);
    }
    if (r.status === 200) return 'ok';
    if (r.status === 403) return 'blocked';
    console.error(`sendMessage ${chatId}: ${r.status} ${r.data.description}`);
  } catch (err) {
    // Only the name/cause: a URL-parse error message would contain the bot token.
    console.error(`sendMessage ${chatId}: ${(err as Error).name}`, (err as Error).cause ?? '');
  }
  return 'error';
}

// ponytail: serial sending (~30 msg/s); past ~800 subscribers a broadcast exceeds the 30 s tick budget, move to a queue
export async function broadcast(text: string): Promise<{ ok: number; blocked: number; failed: number }> {
  const result = { ok: 0, blocked: 0, failed: 0 };
  for (const chatId of await activeChatIds()) {
    const r = await sendMessage(chatId, text);
    if (r === 'ok') result.ok++;
    else if (r === 'blocked') { result.blocked++; await unsubscribe(chatId); }
    else result.failed++;
    await sleep(35);
  }
  return result;
}

export async function setWebhook(url: string, secret: string): Promise<void> {
  const { data } = await call('setWebhook', {
    url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true,
  });
  if (!data.ok) throw new Error(`setWebhook failed: ${data.description}`);
}
