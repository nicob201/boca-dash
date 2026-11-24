import express from 'express';
import { env } from './env.js';
import { safeEqual } from './secure.js';
import { runTick } from './tick.js';
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

// cron-job.org calls this every minute. 200 with the report, errors included: a job that keeps
// failing gets disabled by cron-job.org. Only a dead database throws (Express 5 answers 500),
// because then cron-job.org's email is the only alert that can still reach us.
app.post('/api/cron/tick', async (req, res) => {
  if (!safeEqual(req.get('authorization') ?? '', `Bearer ${env('CRON_SECRET')}`)) {
    res.sendStatus(401);
    return;
  }
  res.json(await runTick());
});
