/**
 * Rewrites the activity seed block in supabase/migrations/0002_workout_core.sql
 * from lib/workout/catalog.ts, so the database catalog cannot drift from the
 * one the app ships with. Run with `npm run gen:activity-seed`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVITIES } from '../lib/workout/catalog';

const BEGIN = '-- BEGIN activities seed';
const END = '-- END activities seed';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (items: string[]) => (items.length ? `array[${items.map(q).join(', ')}]` : `'{}'`);

export function buildActivitySeed(): string {
  const rows = ACTIVITIES.map(
    (a) =>
      `  (${q(a.id)}, ${q(a.name)}, ${arr(a.synonyms)}, ${arr(a.sports)}, ${arr(a.equipment)}, ${q(JSON.stringify(a.defaultTarget))}::jsonb, ${a.loadable})`
  );
  return [
    'insert into activities (id, name, synonyms, sports, equipment, default_target, loadable) values',
    rows.join(',\n'),
    'on conflict (id) do update set',
    '  name = excluded.name,',
    '  synonyms = excluded.synonyms,',
    '  sports = excluded.sports,',
    '  equipment = excluded.equipment,',
    '  default_target = excluded.default_target,',
    '  loadable = excluded.loadable;',
  ].join('\n');
}

export const MIGRATION_PATH = join(__dirname, '..', 'supabase', 'migrations', '0002_workout_core.sql');

export function applySeed(sql: string): string {
  const start = sql.indexOf(BEGIN);
  const end = sql.indexOf(END);
  if (start === -1 || end === -1) throw new Error('Seed markers not found in migration');
  return `${sql.slice(0, start + BEGIN.length)}\n${buildActivitySeed()}\n${sql.slice(end)}`;
}

if (require.main === module) {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  writeFileSync(MIGRATION_PATH, applySeed(sql));
  console.log(`Seeded ${ACTIVITIES.length} activities into ${MIGRATION_PATH}`);
}
