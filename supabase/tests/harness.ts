/**
 * Test harness: an in-process Postgres (PGlite) with the pieces a Supabase
 * project provides before any migration runs, plus helpers to act as a
 * signed-in user the way PostgREST does (role + JWT subject).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export const SUPABASE_DIR = join(__dirname, '..');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

export const MIGRATIONS = [
  'schema.sql',
  'migrations/0002_workout_core.sql',
  'migrations/0003_athlete_foundation.sql',
  'migrations/0004_drop_placeholder_tables.sql',
  'migrations/0005_ai_proposals.sql',
  'migrations/0006_health_data.sql',
  'migrations/0007_nutrition.sql',
  'migrations/0008_meal_parsing.sql',
  'migrations/0009_coach_beta.sql',
  'migrations/0010_recovery.sql',
  'migrations/0011_rehab.sql',
];

export function readMigration(relativePath: string): string {
  return readFileSync(join(SUPABASE_DIR, relativePath), 'utf8');
}

export type Harness = Awaited<ReturnType<typeof openDatabase>>;

export async function openDatabase(migrations: string[] = MIGRATIONS) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of migrations) await db.exec(readMigration(file));

  /** Runs `fn` as that user (or signed out when null), then returns to the superuser. */
  async function as<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role ${userId ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  /** Calls a function taking one jsonb `payload` argument. */
  const rpc = (name: string, payload: unknown) => db.query(`select ${name}($1::jsonb) as id`, [JSON.stringify(payload)]);

  /** Calls a function with positional arguments and returns its single result value. */
  async function call<T = unknown>(name: string, args: unknown[] = [], casts: string[] = []): Promise<T> {
    const params = args.map((_, i) => `$${i + 1}${casts[i] ? `::${casts[i]}` : ''}`).join(', ');
    const res = await db.query<{ result: T }>(`select ${name}(${params}) as result`, args);
    return res.rows[0].result;
  }

  async function count(table: string, where = 'true', params: unknown[] = []): Promise<number> {
    return (await db.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`, params)).rows[0].n;
  }

  async function addUser(id: string, email: string) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  }

  return { db, as, rpc, call, count, addUser };
}

export async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (err: Error) => {
    assert.match(err.message, pattern);
    return true;
  });
}

/** Drops undefined-valued keys so comparisons are about stored content. */
export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
