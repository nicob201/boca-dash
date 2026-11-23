// Usage: npm run webhook:set -- https://boca-dash.vercel.app — tells Telegram where to POST updates.
import { env } from '../src/server/env.js';
import { setWebhook } from '../src/server/telegram.js';

const base = process.argv[2];
if (!base) throw new Error('Usage: npm run webhook:set -- https://<project>.vercel.app');

await setWebhook(`${base.replace(/\/$/, '')}/api/telegram/webhook`, env('TELEGRAM_WEBHOOK_SECRET'));
console.log('ok: webhook set');
