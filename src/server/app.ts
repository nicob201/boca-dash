import express from 'express';
import { env } from './env.js';
import { safeEqual } from './secure.js';
import { handleUpdate } from './webhook.js';

export const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Telegram sends the secret we gave setWebhook in this header; anyone else gets 401.
// If handleUpdate throws, Express 5 answers 500 and Telegram retries later.
app.post('/api/telegram/webhook', async (req, res) => {
  if (!safeEqual(req.get('x-telegram-bot-api-secret-token') ?? '', env('TELEGRAM_WEBHOOK_SECRET'))) {
    res.sendStatus(401);
    return;
  }
  await handleUpdate(req.body);
  res.sendStatus(200);
});
