import { defineConfig } from 'drizzle-kit';

try { process.loadEnvFile(); } catch { /* no .env: use the real environment */ }

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  // Session pooler (5432): migrations need a real session, the transaction pooler won't do.
  dbCredentials: { url: process.env.DIRECT_URL ?? '' },
});
