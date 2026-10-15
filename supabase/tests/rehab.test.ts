/**
 * Access and authority tests for rehabilitation (roadmap Step 8): case-by-
 * case sharing, clinician-authored records the athlete can read but not
 * change, return-to-sport decisions only by verified clinicians, and the
 * coach's narrow view of training limits.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { newUuid } from '../../lib/id';
import type { InjuryEpisode, SymptomLog } from '../../lib/rehab/model';
import { episodeToRow, parseClinical, symptomToRow, type ClinicalJson } from '../../lib/sync/mappers';
import { openDatabase, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a2000000-0000-4000-8000-0000000000a1';
const PHYSIO = 'b2000000-0000-4000-8000-0000000000b1';
const OTHER_PHYSIO = 'b2000000-0000-4000-8000-0000000000b2';
const COACH = 'c2000000-0000-4000-8000-0000000000c1';
const NOW = Date.now() - 3_600_000;

let h: Harness;

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const values = Object.values(row).map((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v));
  await h.db.query(`insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, values);
}
const call = <T>(user: string, fn: string, args: unknown[] = [], casts: string[] = []) => h.as(user, () => h.call<T>(fn, args, casts));

async function connect(athlete: string, pro: string, email: string, type: string) {
  const inv = await call<{ relationship_id: string; invite_code: string }>(athlete, 'invite_professional', [email, type]);
  await call(pro, 'accept_relationship_invite', [inv.invite_code]);
  return inv.relationship_id;
}

const episode: InjuryEpisode = {
  id: newUuid(),
  bodyRegion: 'knee',
  laterality: 'left',
  onsetType: 'gradual',
  reportedProblem: 'Pain on the outside of the knee when running',
  affectedActivities: ['running'],
  status: 'under_assessment',
  createdAt: NOW,
  updatedAt: NOW,
};
const otherEpisode: InjuryEpisode = { ...episode, id: newUuid(), bodyRegion: 'shoulder', reportedProblem: 'Shoulder clicks overhead', affectedActivities: ['overhead'] };
const log: SymptomLog = { id: newUuid(), episodeId: episode.id, loggedAt: NOW, localDate: '2026-10-14', intensity: 4, function: 6, redFlags: [], note: 'after intervals', createdAt: NOW, updatedAt: NOW };

const plan = {
  title: 'Knee rehab, phase 1',
  sport: 'other',
  blocks: [{ id: newUuid(), type: 'recovery', config: { format: 'sequence' }, steps: [{ kind: 'exercise', id: newUuid(), name: 'Wall sit', activityId: null, prescription: {} }] }],
};

describe('rehab migration', () => {
  let physioRel: string;
  let coachRel: string;
  let restrictionId: string;

  before(async () => {
    h = await openDatabase();
    for (const [id, email] of [[ATHLETE, 'athlete@example.com'], [PHYSIO, 'physio@example.com'], [OTHER_PHYSIO, 'other.physio@example.com'], [COACH, 'coach@example.com']]) await h.addUser(id, email);
    await h.as(ATHLETE, async () => {
      await insert('injury_episodes', episodeToRow(episode, ATHLETE) as unknown as Record<string, unknown>);
      await insert('injury_episodes', episodeToRow(otherEpisode, ATHLETE) as unknown as Record<string, unknown>);
      await insert('symptom_logs', symptomToRow(log, ATHLETE) as unknown as Record<string, unknown>);
    });
    physioRel = await connect(ATHLETE, PHYSIO, 'physio@example.com', 'physiotherapist');
    await connect(ATHLETE, OTHER_PHYSIO, 'other.physio@example.com', 'physiotherapist');
    coachRel = await connect(ATHLETE, COACH, 'coach@example.com', 'training_coach');
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0011_rehab.sql'));
  });

  it('keeps the athlete’s records private until a case is shared, one case at a time', async () => {
    await h.as(PHYSIO, async () => {
      assert.equal(await h.count('injury_episodes'), 0);
      assert.equal(await h.count('symptom_logs'), 0);
    });
    assert.deepEqual((await call<{ cases: unknown[] }>(PHYSIO, 'list_cases')).cases, []);
    await rejects(call(PHYSIO, 'add_restriction', [episode.id, ['running'], 'avoid', null, null], ['uuid', 'text[]', 'text', 'text', 'date']), /FORBIDDEN/);
    await rejects(call(ATHLETE, 'share_case', [episode.id, coachRel], ['uuid', 'uuid']), /ONLY_PHYSIOTHERAPISTS/);
    await rejects(call(PHYSIO, 'share_case', [episode.id, physioRel], ['uuid', 'uuid']), /EPISODE_NOT_FOUND/);

    await call(ATHLETE, 'share_case', [episode.id, physioRel], ['uuid', 'uuid']);
    type Case = { episode: { id: string; reported_problem: string }; symptoms: { intensity: number }[] };
    const cases = (await call<{ cases: Case[]; verified: boolean }>(PHYSIO, 'list_cases')).cases;
    assert.deepEqual(cases.map((c) => [c.episode.id, c.symptoms[0].intensity]), [[episode.id, 4]], 'only the shared case, with its symptoms');
    assert.deepEqual((await call<{ cases: unknown[] }>(OTHER_PHYSIO, 'list_cases')).cases, []);
    assert.equal(await h.count('audit_events', `actor_user_id = $1 and action = 'data.read' and data_category = 'rehab'`, [PHYSIO]), 1);
  });

  it('lets the treating clinician author restrictions, plans and notes; the athlete can read but not write them', async () => {
    restrictionId = await call<string>(PHYSIO, 'add_restriction', [episode.id, ['running', 'jumping'], 'avoid', 'until reviewed', null], ['uuid', 'text[]', 'text', 'text', 'date']);
    await rejects(call(PHYSIO, 'add_restriction', [episode.id, ['flying'], 'avoid', null, null], ['uuid', 'text[]', 'text', 'text', 'date']), /check constraint/);
    await call(PHYSIO, 'publish_rehab_plan', [episode.id, JSON.stringify(plan), 3, 'Pain up to 3/10 is fine'], ['uuid', 'jsonb', 'integer', 'text']);
    await call(PHYSIO, 'publish_rehab_plan', [episode.id, JSON.stringify({ ...plan, title: 'Knee rehab, phase 2' }), null, null], ['uuid', 'jsonb', 'integer', 'text']);
    await call(PHYSIO, 'add_case_note', [episode.id, 'Reviewed running technique.']);
    await rejects(call(OTHER_PHYSIO, 'add_case_note', [episode.id, 'not my case']), /FORBIDDEN/);

    await h.as(ATHLETE, async () => {
      await rejects(insert('activity_restrictions', { episode_id: episode.id, athlete_id: ATHLETE, tags: ['running'], rule: 'avoid', issued_by: ATHLETE }), /permission denied|row-level security/);
      await rejects(h.db.query(`update activity_restrictions set status = 'lifted'`), /permission denied/);
      await rejects(h.db.query(`delete from rehab_plans`), /permission denied/);
    });
    await rejects(call(ATHLETE, 'lift_restriction', [restrictionId], ['uuid']), /FORBIDDEN/);

    const records = parseClinical(await call<ClinicalJson>(ATHLETE, 'my_clinical_records'), NOW);
    assert.deepEqual(records.restrictions.map((r) => [r.tags.join(), r.rule, r.note, r.issuer.role, r.issuer.verified]), [['running,jumping', 'avoid', 'until reviewed', 'physiotherapist', false]]);
    assert.deepEqual(records.plans.map((p) => [p.version, p.status, p.content.title]), [[1, 'retired', 'Knee rehab, phase 1'], [2, 'published', 'Knee rehab, phase 2']]);
    assert.equal(records.notes[0].body, 'Reviewed running technique.');
  });

  it('records a return-to-sport decision only from a verified clinician, with criteria', async () => {
    await rejects(call(PHYSIO, 'record_rts_decision', [episode.id, 'participation', 'Pain-free hopping']), /CLINICIAN_NOT_VERIFIED/);
    await h.as(PHYSIO, async () => {
      await rejects(insert('professional_verifications', { user_id: PHYSIO, profession: 'physiotherapist', registration: 'X', verified_by: 'self' }), /permission denied|row-level security/);
    });
    // Verification is recorded by the operator (here the superuser), never by the clinician.
    await insert('professional_verifications', { user_id: PHYSIO, profession: 'physiotherapist', registration: 'PT-12345', verified_by: 'operator' });
    await rejects(call(PHYSIO, 'record_rts_decision', [episode.id, 'participation', '  ']), /CRITERIA_REQUIRED/);
    await call(PHYSIO, 'record_rts_decision', [episode.id, 'participation', 'Pain-free hopping, full range']);
    const records = parseClinical(await call<ClinicalJson>(ATHLETE, 'my_clinical_records'), NOW);
    assert.deepEqual(records.decisions.map((d) => [d.stage, d.clinician.verified]), [['participation', true]]);
  });

  it('shows a coach the training limits only with consent, never the injury', async () => {
    type Shared = { granted: string[]; functional_restriction?: { restrictions: Record<string, unknown>[]; self_noted: string[] } };
    const before = await call<Shared>(COACH, 'get_shared_context', [ATHLETE], ['uuid']);
    assert.equal(before.functional_restriction, undefined);
    await call(ATHLETE, 'create_grant', [coachRel, 'functional_restriction', null], ['uuid', 'text', 'timestamptz']);
    const s = await call<Shared>(COACH, 'get_shared_context', [ATHLETE], ['uuid']);
    assert.deepEqual(s.functional_restriction?.restrictions.map((r) => [r.tags, r.rule, r.issued_by_role]), [[['running', 'jumping'], 'avoid', 'physiotherapist']]);
    assert.deepEqual(s.functional_restriction?.self_noted.sort(), ['overhead', 'running']);
    const text = JSON.stringify(s);
    for (const leak of ['knee', 'shoulder', 'until reviewed', 'Pain on the outside', 'reported_problem', 'body_region']) assert.equal(text.includes(leak), false, leak);
    await h.as(COACH, async () => {
      assert.equal(await h.count('injury_episodes'), 0);
      assert.equal(await h.count('activity_restrictions'), 0);
    });
  });

  it('lets the clinician lift a restriction; revoking or ending closes the case at once', async () => {
    await call(PHYSIO, 'lift_restriction', [restrictionId], ['uuid']);
    const records = parseClinical(await call<ClinicalJson>(ATHLETE, 'my_clinical_records'), NOW);
    assert.equal(records.restrictions[0].status, 'lifted');

    await call(ATHLETE, 'revoke_case', [episode.id, physioRel], ['uuid', 'uuid']);
    assert.deepEqual((await call<{ cases: unknown[] }>(PHYSIO, 'list_cases')).cases, []);
    await rejects(call(PHYSIO, 'add_case_note', [episode.id, 'still here?']), /FORBIDDEN/);
    await h.as(PHYSIO, async () => assert.equal(await h.count('rehab_plans'), 0));

    await call(ATHLETE, 'share_case', [episode.id, physioRel], ['uuid', 'uuid']);
    assert.equal((await call<{ cases: unknown[] }>(PHYSIO, 'list_cases')).cases.length, 1);
    await call(ATHLETE, 'end_relationship', [physioRel], ['uuid']);
    assert.deepEqual((await call<{ cases: unknown[] }>(PHYSIO, 'list_cases')).cases, []);
    // The athlete keeps every record about their case.
    const kept = parseClinical(await call<ClinicalJson>(ATHLETE, 'my_clinical_records'), NOW);
    assert.deepEqual([kept.plans.length, kept.decisions.length, kept.notes.length], [2, 1, 1]);
  });

  it('includes the rehab records in the export', async () => {
    const exported = await call<{ rehab: { episodes: unknown[]; symptoms: unknown[]; restrictions: unknown[]; plans: unknown[]; decisions: unknown[] } }>(ATHLETE, 'export_my_data');
    assert.deepEqual([exported.rehab.episodes.length, exported.rehab.symptoms.length, exported.rehab.restrictions.length, exported.rehab.plans.length, exported.rehab.decisions.length], [2, 1, 1, 2, 1]);
  });
});
