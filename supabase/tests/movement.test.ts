/**
 * Movement analysis (roadmap Step 12): separate consents per clip, uploads
 * only to a registered path, no analysis stored without consent and only in
 * the fixed vocabulary, per-clip access for professionals that ends with the
 * grant or the retention date, attributed notes, and deletion of derived data.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { openDatabase, readMigration, rejects, type Harness } from './harness';

const ATHLETE = 'a6000000-0000-4000-8000-0000000000a1';
const COACH = 'a6000000-0000-4000-8000-0000000000c1';
const STRANGER = 'a6000000-0000-4000-8000-0000000000d1';

let h: Harness;
const call = <T>(user: string, fn: string, args: unknown[] = [], casts: string[] = []) => h.as(user, () => h.call<T>(fn, args, casts));
const CREATE = ['text', 'text', 'text', 'bigint', 'integer', 'boolean', 'boolean', 'boolean'];
const create = (user: string, opts: { recording?: boolean; inference?: boolean; share?: boolean; mime?: string; size?: number; days?: number } = {}) =>
  call<{ id: string; storage_path: string }>(
    user,
    'create_video_asset',
    ['bodyweight_squat', 'side', opts.mime ?? 'video/mp4', opts.size ?? 5_000_000, opts.days ?? 90, opts.recording ?? true, opts.inference ?? false, opts.share ?? false],
    CREATE
  );
const upload = (user: string, path: string) => h.as(user, () => h.db.query(`insert into storage.objects (bucket_id, name) values ('movement-videos', $1)`, [path]));
const visibleObjects = (user: string) => h.as(user, () => h.count('storage.objects'));

const analysis = (patch: Record<string, unknown> = {}) => ({
  engineVersion: 'squat_v1',
  movementId: 'bodyweight_squat',
  cameraView: 'side',
  quality: { usable: true, limitations: [] },
  repetitions: 5,
  analysedSeconds: 14.5,
  observations: [{ label: 'depth', summary: 'Hips reached about knee height or lower in all 5 repetitions.', confidence: 'moderate', timestamps: [] }],
  ...patch,
});

describe('movement analysis migration', () => {
  let clip: { id: string; storage_path: string };
  let rel: string;

  before(async () => {
    h = await openDatabase();
    for (const [id, email] of [[ATHLETE, 'athlete@example.com'], [COACH, 'coach@example.com'], [STRANGER, 'stranger@example.com']]) await h.addUser(id, email);
    const inv = await call<{ relationship_id: string; invite_code: string }>(ATHLETE, 'invite_professional', ['coach@example.com', 'training_coach']);
    await call(COACH, 'accept_relationship_invite', [inv.invite_code]);
    rel = inv.relationship_id;
  });

  it('can be run a second time without error', async () => {
    await h.db.exec(readMigration('migrations/0015_movement.sql'));
  });

  it('registers a clip only with recording consent and within the limits', async () => {
    await rejects(create(ATHLETE, { recording: false }), /RECORDING_CONSENT_REQUIRED/);
    await rejects(create(ATHLETE, { mime: 'application/x-msdownload' }), /UNSUPPORTED_VIDEO/);
    await rejects(create(ATHLETE, { size: 200_000_000 }), /VIDEO_TOO_LARGE/);
    await rejects(create(ATHLETE, { days: 3650 }), /INVALID_RETENTION/);
    clip = await create(ATHLETE);
    assert.match(clip.storage_path, new RegExp(`^${ATHLETE}/[0-9a-f-]{36}\\.mp4$`));
    await rejects(h.db.query(`update video_assets set research_use = true where id = $1`, [clip.id]), /check constraint/);
  });

  it('accepts an upload only at a registered pending path of the uploader', async () => {
    await rejects(call(ATHLETE, 'finalize_video_asset', [clip.id, 14.5], ['uuid', 'numeric']), /NOT_UPLOADED/);
    await rejects(upload(ATHLETE, `${ATHLETE}/not-registered.mp4`), /row-level security/);
    await rejects(upload(STRANGER, clip.storage_path), /row-level security/);
    await upload(ATHLETE, clip.storage_path);
    await call(ATHLETE, 'finalize_video_asset', [clip.id, 14.5], ['uuid', 'numeric']);
    assert.equal(await visibleObjects(ATHLETE), 1);
    await rejects(upload(ATHLETE, clip.storage_path), /row-level security|duplicate/);
  });

  it('stores an analysis only with analysis consent and only in the fixed vocabulary', async () => {
    const save = (a: unknown) => call(ATHLETE, 'save_movement_analysis', [clip.id, JSON.stringify(a)], ['uuid', 'jsonb']);
    await rejects(save(analysis()), /ANALYSIS_NOT_ALLOWED/);
    await call(ATHLETE, 'set_video_consent', [clip.id, true, null], ['uuid', 'boolean', 'boolean']);
    await rejects(save(analysis({ observations: [{ label: 'injury_risk', summary: 'High risk of knee injury.', confidence: 'high', timestamps: [] }] })), /INVALID_ANALYSIS/);
    await rejects(save(analysis({ quality: { usable: false, limitations: ['low_frame_rate'] } })), /INVALID_ANALYSIS/);
    await rejects(save(analysis({ quality: { usable: true, limitations: ['looks_unhealthy'] } })), /INVALID_ANALYSIS/);
    await rejects(save(analysis({ cameraView: 'front' })), /INVALID_ANALYSIS/);
    await save(analysis());
    await save(analysis({ quality: { usable: false, limitations: ['camera_view_mismatch'] }, observations: [], repetitions: 0 }));
    assert.equal(await h.count('movement_analyses', 'asset_id = $1', [clip.id]), 2);
    await call(ATHLETE, 'set_video_consent', [clip.id, false, null], ['uuid', 'boolean', 'boolean']);
    assert.equal(await h.count('movement_analyses', 'asset_id = $1', [clip.id]), 0, 'withdrawing analysis consent removes the analyses');
    await call(ATHLETE, 'set_video_consent', [clip.id, true, null], ['uuid', 'boolean', 'boolean']);
    await save(analysis());
  });

  it('opens a clip to a professional only with the Video grant AND the clip shared', async () => {
    type Shared = { shared: boolean; videos: { id: string; analysis: unknown; annotations: { author_role: string; author_name: string; by_me: boolean }[] }[] };
    assert.deepEqual(await call<Shared>(COACH, 'list_shared_videos', [ATHLETE], ['uuid']), { shared: false, videos: [] });
    assert.equal(await visibleObjects(COACH), 0);
    await rejects(call(ATHLETE, 'request_video_review', [clip.id, rel, null], ['uuid', 'uuid', 'text']), /SHARE_VIDEO_FIRST/);

    await call(ATHLETE, 'create_grant', [rel, 'video', null], ['uuid', 'text', 'timestamptz']);
    assert.deepEqual((await call<Shared>(COACH, 'list_shared_videos', [ATHLETE], ['uuid'])).videos, [], 'the clip itself is not shared yet');
    assert.equal(await visibleObjects(COACH), 0);
    await rejects(call(COACH, 'add_video_annotation', [clip.id, 3.2, 'Nice depth'], ['uuid', 'numeric', 'text']), /FORBIDDEN/);

    await call(ATHLETE, 'set_video_consent', [clip.id, null, true], ['uuid', 'boolean', 'boolean']);
    const res = await call<Shared>(COACH, 'list_shared_videos', [ATHLETE], ['uuid']);
    assert.equal(res.videos.length, 1);
    assert.ok(res.videos[0].analysis);
    assert.equal(await visibleObjects(COACH), 1, 'a signed URL can now be made');
    assert.equal(await visibleObjects(STRANGER), 0);
    assert.equal(await h.count('audit_events', `actor_user_id = $1 and action = 'data.read' and data_category = 'video'`, [COACH]), 2);
  });

  it('attributes notes to their author and answers a review request', async () => {
    await call(ATHLETE, 'request_video_review', [clip.id, rel, 'Is my depth OK?'], ['uuid', 'uuid', 'text']);
    assert.equal(await h.count('notifications', `user_id = $1 and title = 'Clip to review'`, [COACH]), 1);
    await call(ATHLETE, 'add_video_annotation', [clip.id, null, 'Felt stiff today'], ['uuid', 'numeric', 'text']);
    await call(COACH, 'add_video_annotation', [clip.id, 4.2, 'Keep the chest up here.'], ['uuid', 'numeric', 'text']);
    const mine = await call<{ annotations: { author_role: string; author_name: string; at_seconds: number | null }[]; review_requests: { status: string }[] }[]>(ATHLETE, 'my_videos');
    assert.deepEqual(mine[0].annotations.map((a) => [a.author_role, a.author_name, a.at_seconds === null ? null : Number(a.at_seconds)]), [['professional', 'coach@example.com', 4.2], ['athlete', 'athlete@example.com', null]]);
    assert.equal(mine[0].review_requests[0].status, 'answered');
    await h.as(COACH, () => rejects(h.db.query(`insert into video_annotations (asset_id, athlete_id, author_id, author_role, body) values ($1, $2, $3, 'athlete', 'forged')`, [clip.id, ATHLETE, COACH]), /permission denied/));
  });

  it('ends access when the grant is revoked or the retention date passes', async () => {
    const grant = (await h.db.query<{ id: string }>(`select id from data_share_grants where relationship_id = $1 and data_category = 'video' and status = 'active'`, [rel])).rows[0].id;
    await call(ATHLETE, 'revoke_grant', [grant]);
    assert.equal(await visibleObjects(COACH), 0);
    await rejects(call(COACH, 'add_video_annotation', [clip.id, 1, 'one more'], ['uuid', 'numeric', 'text']), /FORBIDDEN/);
    assert.equal((await call<{ shared: boolean }>(COACH, 'list_shared_videos', [ATHLETE], ['uuid'])).shared, false);

    const old = await create(ATHLETE);
    await upload(ATHLETE, old.storage_path);
    await call(ATHLETE, 'finalize_video_asset', [old.id, 10], ['uuid', 'numeric']);
    await h.db.query(`update video_assets set retention_until = current_date - 1 where id = $1`, [old.id]);
    assert.equal(await visibleObjects(COACH), 0);
    assert.equal(await visibleObjects(ATHLETE), 2, 'owners reach their own folder, so the app can remove expired files');
    assert.deepEqual((await call<{ id: string }[]>(ATHLETE, 'my_expired_videos')).map((x) => x.id), [old.id]);
  });

  it('deleting a clip removes the file and what was derived from it, and the export lists the rest', async () => {
    await h.as(STRANGER, async () => assert.equal((await h.db.query(`delete from storage.objects where name = $1 returning id`, [clip.storage_path])).rows.length, 0));
    await h.as(ATHLETE, () => h.db.query(`delete from storage.objects where name = $1`, [clip.storage_path])); // the app removes the file first
    assert.equal(await h.count('storage.objects', 'name = $1', [clip.storage_path]), 0);
    await call(ATHLETE, 'delete_video_asset', [clip.id]);
    for (const table of ['movement_analyses', 'video_annotations', 'video_review_requests']) assert.equal(await h.count(table, 'asset_id = $1', [clip.id]), 0, table);
    await rejects(call(STRANGER, 'delete_video_asset', [clip.id]), /FORBIDDEN/);
    const exported = await call<{ movement: { clips: unknown[] } }>(ATHLETE, 'export_my_data');
    assert.equal(exported.movement.clips.length, 1, 'the expired clip, not the deleted one');
  });
});
