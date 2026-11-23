import { z } from 'zod';
import { HELP_MESSAGE, STOP_MESSAGE, welcomeMessage } from './bot/messages.js';
import { getNextMatch, subscribe, unsubscribe } from './db/queries.js';
import { parseGame } from './promiedos/parse.js';
import { sendMessage } from './telegram.js';

// Only what we read. Anything else (edited messages, stickers, a future
// Telegram field) is ignored rather than failing: a 500 makes Telegram retry it.
const Update = z.object({
  message: z.object({ chat: z.object({ id: z.number() }), text: z.string().optional() }).optional(),
});

export async function handleUpdate(update: unknown): Promise<void> {
  const parsed = Update.safeParse(update);
  const msg = parsed.success ? parsed.data.message : undefined;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  // "/start@BocaDashBot hola" → "/start"
  const command = msg.text.trim().split(/[\s@]/)[0].toLowerCase();

  if (command === '/start') {
    await subscribe(chatId);   // upsert: a retried or repeated /start never duplicates
    const next = await getNextMatch(new Date());
    await sendMessage(chatId, welcomeMessage(next ? parseGame(next.raw) : null));
  } else if (command === '/stop') {
    await unsubscribe(chatId);
    await sendMessage(chatId, STOP_MESSAGE);
  } else {
    await sendMessage(chatId, HELP_MESSAGE);
  }
}
