type EnvName =
  | 'DATABASE_URL' | 'DIRECT_URL' | 'TELEGRAM_BOT_TOKEN'
  | 'TELEGRAM_WEBHOOK_SECRET' | 'CRON_SECRET' | 'ADMIN_CHAT_ID';

export function env(name: EnvName): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}
