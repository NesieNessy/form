/**
 * Runs the assistant evaluation cases (evals/cases.ts) against the deployed
 * `assistant` function and prints which checks held.
 *
 *   EVAL_EMAIL=... EVAL_PASSWORD=... npm run eval
 *   npm run eval -- crossfit-fran adapt-20-minutes     (only these cases)
 *
 * Every case is a real model call and costs money; the full set is 16 calls.
 * Use a dedicated test account: the run creates one workout and several
 * proposals in it. The function allows 20 requests per account per hour.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADAPT_CASES, IMPORT_CASES, type Check, type Outcome } from '../evals/cases';
import { newUuid } from '../lib/id';
import { scheduledToRow, versionToPayload } from '../lib/sync/mappers';
import type { WorkoutContent } from '../lib/workout/model';
import { EMPTY_DATA, createWorkout } from '../lib/workout/state';

function env(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  try {
    const line = readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  } catch {
    // fall through to the error below
  }
  throw new Error(`Missing ${name}. Set it in the environment or in .env.local.`);
}

const BASE: WorkoutContent = {
  title: 'Eval Base Workout',
  sport: 'crossfit',
  blocks: [
    {
      id: newUuid(),
      type: 'strength',
      label: 'Strength',
      config: { format: 'sets_reps', sets: 5, restSeconds: 120 },
      steps: [{ kind: 'exercise', id: newUuid(), name: 'Back Squat', activityId: 'back_squat', prescription: { reps: 5, load: { value: 80, unit: 'kg' } } }],
    },
    {
      id: newUuid(),
      type: 'conditioning',
      label: 'Workout of the Day',
      config: { format: 'amrap', durationSeconds: 900 },
      steps: [
        { kind: 'exercise', id: newUuid(), name: 'Thruster', activityId: 'thruster', prescription: { reps: 10, load: { value: 40, unit: 'kg' } } },
        { kind: 'exercise', id: newUuid(), name: 'Pull Up', activityId: 'pull_up', prescription: { reps: 10 } },
        { kind: 'exercise', id: newUuid(), name: 'Run', activityId: 'run', prescription: { distanceMeters: 200 } },
      ],
    },
  ],
};

async function main() {
  const only = process.argv.slice(2);
  const supabase = createClient(env('EXPO_PUBLIC_SUPABASE_URL'), env('EXPO_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: env('EVAL_EMAIL'), password: env('EVAL_PASSWORD') });
  if (authError || !auth.user) throw new Error(`Sign-in failed: ${authError?.message}`);

  const call = async (body: Record<string, unknown>): Promise<Outcome> => {
    const { data, error } = await supabase.functions.invoke('assistant', { body });
    if (error) return { ok: false, code: 'HTTP_ERROR', message: error.message };
    return data as Outcome;
  };

  const cases = [...IMPORT_CASES, ...ADAPT_CASES].filter((c) => only.length === 0 || only.includes(c.id));
  let scheduledId: string | undefined;
  if (cases.some((c) => c.kind === 'adapt')) {
    const now = Date.now();
    const created = createWorkout(EMPTY_DATA, BASE, { source: 'manual', scheduledAt: now + 86_400_000, nowMs: now });
    scheduledId = created.scheduledId as string;
    const saved = await supabase.rpc('save_workout_version', { payload: versionToPayload(created.data.workouts[created.workoutId], created.data.versions[created.versionId]) });
    if (saved.error) throw new Error(`Could not create the base workout: ${saved.error.message}`);
    const scheduled = await supabase.from('scheduled_workouts').upsert(scheduledToRow(created.data.scheduled[scheduledId], auth.user.id));
    if (scheduled.error) throw new Error(`Could not schedule the base workout: ${scheduled.error.message}`);
  }

  let passedCases = 0;
  let passedChecks = 0;
  let totalChecks = 0;
  for (const c of cases) {
    const started = Date.now();
    const outcome = await call(c.kind === 'import' ? { action: 'import_workout', text: c.text } : { action: 'adapt_workout', scheduled_id: scheduledId, constraints: c.constraints });
    const checks: Check[] = c.grade(outcome);
    const failed = checks.filter(([, pass]) => !pass);
    totalChecks += checks.length;
    passedChecks += checks.length - failed.length;
    if (failed.length === 0) passedCases += 1;
    console.log(`${failed.length === 0 ? 'PASS' : 'FAIL'}  ${c.id.padEnd(26)} ${String(checks.length - failed.length).padStart(2)}/${checks.length}  ${((Date.now() - started) / 1000).toFixed(1)}s  [${c.sport}] guards against ${c.guards}`);
    for (const [name] of failed) console.log(`        x ${name}`);
    if (failed.length && outcome.ok) console.log(`        draft: ${JSON.stringify(outcome.proposal.content.blocks.map((b) => ({ ...b.config, steps: b.steps.length }))).slice(0, 400)}`);
    if (failed.length && !outcome.ok) console.log(`        outcome: ${outcome.code} ${outcome.message}`);
  }

  const { data: runs } = await supabase.from('agent_runs').select('input_tokens, output_tokens, model, status').order('created_at', { ascending: false }).limit(cases.length);
  const tokens = (runs ?? []).reduce((t, r) => ({ in: t.in + r.input_tokens, out: t.out + r.output_tokens }), { in: 0, out: 0 });
  console.log(`\n${passedCases}/${cases.length} cases, ${passedChecks}/${totalChecks} checks. Tokens: ${tokens.in} in, ${tokens.out} out. Model: ${[...new Set((runs ?? []).map((r) => r.model).filter(Boolean))].join(', ') || 'n/a'}`);
  if (passedCases !== cases.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
