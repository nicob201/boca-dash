import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

// prepare: false — Supabase's transaction pooler (port 6543) can't keep prepared statements.
export const db = drizzle(postgres(env('DATABASE_URL'), { prepare: false, max: 5 }), { schema });
