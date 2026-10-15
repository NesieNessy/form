-- FORM — movement analysis (roadmap Step 12)
--
-- Run AFTER 0014_studio.sql. Safe to run more than once.
--
-- Clips live in a private storage bucket under the athlete's own folder,
-- at a path with a random id. Three consents are separate and per clip:
-- recording (only people who agreed are in it), analysis on the device,
-- and sharing with professionals (who also need the athlete's Video
-- grant). Use for research or model training is not offered at all.
-- Analyses use a fixed vocabulary checked here; there is no diagnosis
-- field. Professional annotations are stored with their author. Every
-- clip has a retention date after which professionals cannot open it and
-- the app removes it (owners can always reach their own folder, which is
-- also what lets them delete files). Deleting a clip, withdrawing analysis
-- consent or deleting the account removes the derived records too.

create table if not exists video_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  movement_id text not null check (movement_id in ('bodyweight_squat')),
  camera_view text not null check (camera_view in ('side', 'front')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  duration_seconds numeric check (duration_seconds is null or duration_seconds between 0 and 600),
  consent_recording boolean not null check (consent_recording),
  consent_inference boolean not null default false,
  shared_with_professionals boolean not null default false,
  research_use boolean not null default false check (not research_use),
  retention_until date not null,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists video_assets_user_idx on video_assets (user_id, created_at desc);

create table if not exists movement_analyses (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references video_assets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  engine_version text not null check (length(engine_version) between 1 and 40),
  usable boolean not null,
  limitations text[] not null default '{}',
  repetitions integer not null check (repetitions between 0 and 200),
  analysed_seconds numeric not null check (analysed_seconds between 0 and 600),
  observations jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (usable or observations = '[]'::jsonb)
);

create table if not exists video_annotations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references video_assets (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_role text not null check (author_role in ('athlete', 'professional')),
  at_seconds numeric check (at_seconds is null or at_seconds between 0 and 600),
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists video_review_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references video_assets (id) on delete cascade,
  relationship_id uuid not null references professional_relationships (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  professional_id uuid not null references auth.users (id) on delete cascade,
  note text check (note is null or length(note) <= 500),
  status text not null default 'requested' check (status in ('requested', 'answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table video_assets enable row level security;
alter table movement_analyses enable row level security;
alter table video_annotations enable row level security;
alter table video_review_requests enable row level security;

drop policy if exists "Owners read their clips" on video_assets;
create policy "Owners read their clips" on video_assets for select using (auth.uid() = user_id);
drop policy if exists "Owners read their analyses" on movement_analyses;
create policy "Owners read their analyses" on movement_analyses for select using (auth.uid() = user_id);
drop policy if exists "Athlete and author read annotations" on video_annotations;
create policy "Athlete and author read annotations" on video_annotations for select using (auth.uid() = athlete_id or auth.uid() = author_id);
drop policy if exists "Both sides read review requests" on video_review_requests;
create policy "Both sides read review requests" on video_review_requests for select using (auth.uid() = athlete_id or auth.uid() = professional_id);
revoke insert, update, delete on video_assets, movement_analyses, video_annotations, video_review_requests from anon, authenticated;

update data_categories
set available = true,
    description = 'Movement clips you switch on for sharing, with their analyses and notes. Clips you do not switch on stay private.'
where id = 'video';

-- Whether the caller may open this clip now: the owner, or a professional
-- with an active connection and Video grant, for a shared clip, until its
-- retention date.
create or replace function _can_open_video(p_asset uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from video_assets a
    where a.id = p_asset and a.status = 'uploaded' and a.retention_until >= current_date
      and (a.user_id = auth.uid() or (a.shared_with_professionals and has_grant(a.user_id, 'video', 'read')))
  )
$$;

create or replace function _can_read_video_object(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select _can_open_video((select id from video_assets where storage_path = p_path))
$$;

create or replace function _can_upload_video_object(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from video_assets where storage_path = p_path and user_id = auth.uid() and status = 'pending')
$$;

-- ------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('movement-videos', 'movement-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Athletes upload clips they registered" on storage.objects;
create policy "Athletes upload clips they registered" on storage.objects for insert to authenticated
  with check (bucket_id = 'movement-videos' and _can_upload_video_object(name));
drop policy if exists "Owners and granted professionals open clips" on storage.objects;
create policy "Owners and granted professionals open clips" on storage.objects for select to authenticated
  using (bucket_id = 'movement-videos' and ((storage.foldername(name))[1] = auth.uid()::text or _can_read_video_object(name)));
drop policy if exists "Owners delete their clips" on storage.objects;
create policy "Owners delete their clips" on storage.objects for delete to authenticated
  using (bucket_id = 'movement-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- clips

create or replace function create_video_asset(
  p_movement text, p_view text, p_mime text, p_size bigint, p_retention_days integer,
  p_consent_recording boolean, p_consent_inference boolean, p_share boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not coalesce(p_consent_recording, false) then
    raise exception 'RECORDING_CONSENT_REQUIRED';
  end if;
  if p_retention_days is null or p_retention_days not in (30, 90, 365) then
    raise exception 'INVALID_RETENTION';
  end if;
  if p_mime is null or p_mime not in ('video/mp4', 'video/quicktime', 'video/webm') then
    raise exception 'UNSUPPORTED_VIDEO';
  end if;
  if p_size is null or p_size < 1 or p_size > 104857600 then
    raise exception 'VIDEO_TOO_LARGE';
  end if;
  if p_movement is null or p_movement not in ('bodyweight_squat') or p_view is null or p_view not in ('side', 'front') then
    raise exception 'UNKNOWN_MOVEMENT';
  end if;
  v_path := uid::text || '/' || v_id::text || case p_mime when 'video/mp4' then '.mp4' when 'video/quicktime' then '.mov' else '.webm' end;
  insert into video_assets (id, user_id, movement_id, camera_view, storage_path, mime_type, size_bytes, consent_recording, consent_inference, shared_with_professionals, retention_until)
  values (v_id, uid, p_movement, p_view, v_path, p_mime, p_size, true, coalesce(p_consent_inference, false), coalesce(p_share, false), current_date + p_retention_days);
  perform _audit(uid, uid, 'video.registered', 'video', 'movement_analysis', 'video_asset', v_id,
    jsonb_build_object('inference', coalesce(p_consent_inference, false), 'shared', coalesce(p_share, false), 'retention_days', p_retention_days));
  return jsonb_build_object('id', v_id, 'storage_path', v_path);
end $$;

create or replace function finalize_video_asset(p_asset uuid, p_duration numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  a video_assets%rowtype;
begin
  select * into a from video_assets where id = p_asset and user_id = auth.uid() for update;
  if not found or a.status <> 'pending' then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'movement-videos' and o.name = a.storage_path) then
    raise exception 'NOT_UPLOADED';
  end if;
  update video_assets set status = 'uploaded', duration_seconds = least(greatest(p_duration, 0), 600), updated_at = now() where id = p_asset;
end $$;

-- Changing consent takes effect at once. Withdrawing analysis consent removes the analyses.
create or replace function set_video_consent(p_asset uuid, p_inference boolean, p_share boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  a video_assets%rowtype;
begin
  select * into a from video_assets where id = p_asset and user_id = auth.uid() and status <> 'deleted' for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  update video_assets set
    consent_inference = coalesce(p_inference, consent_inference),
    shared_with_professionals = coalesce(p_share, shared_with_professionals),
    updated_at = now()
  where id = p_asset;
  if a.consent_inference and not coalesce(p_inference, true) then
    delete from movement_analyses where asset_id = p_asset;
  end if;
  perform _audit(auth.uid(), auth.uid(), 'video.consent_changed', 'video', 'movement_analysis', 'video_asset', p_asset,
    jsonb_build_object('inference', coalesce(p_inference, a.consent_inference), 'shared', coalesce(p_share, a.shared_with_professionals)));
end $$;

-- Stores an analysis made on the device, only with analysis consent, only in the fixed vocabulary.
create or replace function save_movement_analysis(p_asset uuid, p_analysis jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a video_assets%rowtype;
  o jsonb;
  v_id uuid;
  v_usable boolean := (p_analysis -> 'quality' ->> 'usable')::boolean;
  v_obs jsonb := coalesce(p_analysis -> 'observations', '[]'::jsonb);
  v_limits text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_analysis -> 'quality' -> 'limitations', '[]'::jsonb)) x), '{}');
begin
  select * into a from video_assets where id = p_asset and user_id = auth.uid() and status = 'uploaded';
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if not a.consent_inference then
    raise exception 'ANALYSIS_NOT_ALLOWED';
  end if;
  if v_usable is null or jsonb_typeof(v_obs) <> 'array' or jsonb_array_length(v_obs) > 12
     or (not v_usable and jsonb_array_length(v_obs) > 0)
     or p_analysis ->> 'movementId' is distinct from a.movement_id or p_analysis ->> 'cameraView' is distinct from a.camera_view
     or not v_limits <@ array['too_short', 'low_frame_rate', 'person_not_found', 'person_missing_in_parts', 'key_joints_not_visible', 'partial_occlusion',
                              'body_out_of_frame', 'camera_view_mismatch', 'camera_view_unclear', 'no_repetitions_found', 'too_few_repetitions',
                              'feet_not_clear', 'trimmed_to_60_seconds'] then
    raise exception 'INVALID_ANALYSIS';
  end if;
  for o in select * from jsonb_array_elements(v_obs) loop
    if o ->> 'label' is null or o ->> 'label' not in ('repetitions', 'depth', 'depth_consistency', 'torso_lean', 'heel_lift', 'tempo', 'knee_tracking', 'hip_symmetry')
       or o ->> 'confidence' is null or o ->> 'confidence' not in ('low', 'moderate', 'high')
       or length(coalesce(o ->> 'summary', '')) not between 1 and 200
       or jsonb_typeof(coalesce(o -> 'timestamps', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(o -> 'timestamps', '[]'::jsonb)) > 50 then
      raise exception 'INVALID_ANALYSIS';
    end if;
  end loop;
  insert into movement_analyses (asset_id, user_id, engine_version, usable, limitations, repetitions, analysed_seconds, observations)
  values (p_asset, a.user_id, coalesce(p_analysis ->> 'engineVersion', 'unknown'), v_usable, v_limits,
          coalesce((p_analysis ->> 'repetitions')::int, 0), coalesce((p_analysis ->> 'analysedSeconds')::numeric, 0), v_obs)
  returning id into v_id;
  return v_id;
end $$;

-- Removes a clip's record and everything derived from it. The device removes the file itself.
create or replace function delete_video_asset(p_asset uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from video_assets where id = p_asset and user_id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  delete from movement_analyses where asset_id = p_asset;
  delete from video_annotations where asset_id = p_asset;
  delete from video_review_requests where asset_id = p_asset;
  update video_assets set status = 'deleted', deleted_at = now(), shared_with_professionals = false, consent_inference = false, updated_at = now() where id = p_asset;
  perform _audit(auth.uid(), auth.uid(), 'video.deleted', 'video', 'movement_analysis', 'video_asset', p_asset, '{}');
end $$;

-- The caller's clips past their retention date, for the device to remove.
create or replace function my_expired_videos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'storage_path', storage_path)), '[]'::jsonb)
  from video_assets where user_id = auth.uid() and status <> 'deleted' and (retention_until < current_date or (status = 'pending' and created_at < now() - interval '1 day'))
$$;

create or replace function _video_json(a video_assets, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'movement_id', a.movement_id, 'camera_view', a.camera_view, 'storage_path', a.storage_path,
    'duration_seconds', a.duration_seconds, 'size_bytes', a.size_bytes, 'consent_inference', a.consent_inference,
    'shared_with_professionals', a.shared_with_professionals, 'retention_until', a.retention_until, 'status', a.status, 'created_at', a.created_at,
    'analysis', (select jsonb_build_object('id', m.id, 'engine_version', m.engine_version, 'usable', m.usable, 'limitations', to_jsonb(m.limitations),
                   'repetitions', m.repetitions, 'analysed_seconds', m.analysed_seconds, 'observations', m.observations, 'created_at', m.created_at)
                 from movement_analyses m where m.asset_id = a.id order by m.created_at desc limit 1),
    'annotations', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'author_role', n.author_role, 'author_name', _display_name(n.author_id),
                     'by_me', n.author_id = p_viewer, 'at_seconds', n.at_seconds, 'body', n.body, 'created_at', n.created_at) order by n.at_seconds nulls last, n.created_at)
                   from video_annotations n where n.asset_id = a.id), '[]'::jsonb),
    'review_requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'professional_name', _display_name(r.professional_id), 'note', r.note,
                     'status', r.status, 'created_at', r.created_at) order by r.created_at desc)
                   from video_review_requests r where r.asset_id = a.id and (r.athlete_id = p_viewer or r.professional_id = p_viewer)), '[]'::jsonb)
  )
$$;

create or replace function my_videos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(_video_json(a, auth.uid()) order by a.created_at desc), '[]'::jsonb)
  from video_assets a where a.user_id = auth.uid() and a.status = 'uploaded'
$$;

-- A connected athlete's shared clips, for a professional with the Video grant; logged in the athlete's access log.
create or replace function list_shared_videos(p_athlete uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  v_rows jsonb;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships where athlete_id = p_athlete and professional_user_id = uid and status = 'active' order by accepted_at desc limit 1;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if not has_grant(p_athlete, 'video', 'read') then
    return jsonb_build_object('shared', false, 'videos', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(_video_json(a, uid) order by a.created_at desc), '[]'::jsonb) into v_rows
  from video_assets a where a.user_id = p_athlete and _can_open_video(a.id);
  perform _audit(uid, p_athlete, 'data.read', 'video', _purpose_for(r.relationship_type), 'professional_relationship', r.id, jsonb_build_object('rows', jsonb_array_length(v_rows)));
  return jsonb_build_object('shared', true, 'videos', v_rows);
end $$;

-- A timestamped note on a clip, by the athlete or a professional who can open it. A professional's note answers open review requests.
create or replace function add_video_annotation(p_asset uuid, p_at numeric, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a video_assets%rowtype;
  v_role text;
  v_id uuid;
begin
  select * into a from video_assets where id = p_asset;
  if not found or not _can_open_video(p_asset) then
    raise exception 'FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'INVALID_COMMENT';
  end if;
  if p_at is not null and (p_at < 0 or p_at > 600) then
    raise exception 'INVALID_TIME';
  end if;
  v_role := case when a.user_id = uid then 'athlete' else 'professional' end;
  insert into video_annotations (asset_id, athlete_id, author_id, author_role, at_seconds, body)
  values (a.id, a.user_id, uid, v_role, p_at, btrim(p_body)) returning id into v_id;
  if v_role = 'professional' then
    update video_review_requests set status = 'answered', answered_at = now() where asset_id = a.id and professional_id = uid and status = 'requested';
    perform _audit(uid, a.user_id, 'video.annotated', 'video', 'movement_review', 'video_asset', a.id, '{}');
    perform _notify(a.user_id, 'training', 'New note on your clip', _display_name(uid) || ' added a note to your ' || replace(a.movement_id, '_', ' ') || ' clip.', 'video_asset', a.id);
  end if;
  return v_id;
end $$;

create or replace function request_video_review(p_asset uuid, p_relationship uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a video_assets%rowtype;
  r professional_relationships%rowtype;
  v_id uuid;
begin
  select * into a from video_assets where id = p_asset and user_id = uid and status = 'uploaded';
  select * into r from professional_relationships where id = p_relationship and athlete_id = uid and status = 'active';
  if a.id is null or r.id is null then
    raise exception 'FORBIDDEN';
  end if;
  if not a.shared_with_professionals or not exists (
    select 1 from data_share_grants g where g.relationship_id = r.id and g.data_category = 'video' and g.status = 'active' and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'SHARE_VIDEO_FIRST';
  end if;
  if length(coalesce(p_note, '')) > 500 then
    raise exception 'INVALID_COMMENT';
  end if;
  insert into video_review_requests (asset_id, relationship_id, athlete_id, professional_id, note)
  values (a.id, r.id, uid, r.professional_user_id, nullif(btrim(coalesce(p_note, '')), '')) returning id into v_id;
  perform _notify(r.professional_user_id, 'training', 'Clip to review', _display_name(uid) || ' asked you to look at a ' || replace(a.movement_id, '_', ' ') || ' clip.', 'video_asset', a.id);
  return v_id;
end $$;

do $$
declare
  fn text;
begin
  foreach fn in array array['_can_open_video(uuid)', '_video_json(video_assets, uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
  -- Used by storage policies, so callable by signed-in users; they reveal nothing beyond yes or no for a path.
  foreach fn in array array['_can_read_video_object(text)', '_can_upload_video_object(text)'] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
  foreach fn in array array[
    'create_video_asset(text, text, text, bigint, integer, boolean, boolean, boolean)', 'finalize_video_asset(uuid, numeric)',
    'set_video_consent(uuid, boolean, boolean)', 'save_movement_analysis(uuid, jsonb)', 'delete_video_asset(uuid)',
    'my_expired_videos()', 'my_videos()', 'list_shared_videos(uuid)', 'add_video_annotation(uuid, numeric, text)',
    'request_video_review(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- The athlete's clip records join the export (the files themselves are downloaded from the app).
create or replace function export_my_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v jsonb;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select jsonb_build_object(
    'format', 'form-export-v1',
    'exported_at', now(),
    'user_id', uid,
    'profile', (select to_jsonb(p) from profiles p where p.user_id = uid),
    'benchmarks', coalesce((select jsonb_agg(to_jsonb(b)) from benchmarks b where b.user_id = uid), '[]'::jsonb),
    'workouts', coalesce((select jsonb_agg(to_jsonb(w)) from workouts w where w.user_id = uid), '[]'::jsonb),
    'workout_versions', coalesce((
      select jsonb_agg(to_jsonb(wv) || jsonb_build_object('blocks', coalesce((
        select jsonb_agg(to_jsonb(b) || jsonb_build_object('steps', coalesce((
          select jsonb_agg(to_jsonb(s)) from steps s where s.block_id = b.id), '[]'::jsonb)))
        from blocks b where b.version_id = wv.id), '[]'::jsonb)))
      from workout_versions wv where wv.user_id = uid), '[]'::jsonb),
    'scheduled_workouts', coalesce((select jsonb_agg(to_jsonb(sw)) from scheduled_workouts sw where sw.user_id = uid), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(to_jsonb(se) || jsonb_build_object('session_results', coalesce((
        select jsonb_agg(to_jsonb(sr)) from session_results sr where sr.session_id = se.id), '[]'::jsonb)))
      from sessions se where se.user_id = uid), '[]'::jsonb),
    'health', jsonb_build_object(
      'activities', coalesce((select jsonb_agg(to_jsonb(a)) from external_activities a where a.user_id = uid and a.deleted_at is null), '[]'::jsonb),
      'observations', coalesce((select jsonb_agg(to_jsonb(o)) from health_observations o where o.user_id = uid and o.deleted_at is null), '[]'::jsonb)
    ),
    'nutrition', jsonb_build_object(
      'foods', coalesce((select jsonb_agg(to_jsonb(f)) from foods f where f.user_id = uid and f.deleted_at is null), '[]'::jsonb),
      'log', coalesce((select jsonb_agg(to_jsonb(e) order by e.consumed_at) from food_log_entries e where e.user_id = uid and e.deleted_at is null), '[]'::jsonb),
      'saved_meals', coalesce((select jsonb_agg(to_jsonb(m)) from saved_meals m where m.user_id = uid and m.deleted_at is null), '[]'::jsonb)
    ),
    'recovery', coalesce((select jsonb_agg(to_jsonb(d) order by d.local_date) from daily_recovery d where d.user_id = uid and d.deleted_at is null), '[]'::jsonb),
    'rehab', jsonb_build_object(
      'episodes', coalesce((select jsonb_agg(to_jsonb(e)) from injury_episodes e where e.user_id = uid and e.deleted_at is null), '[]'::jsonb),
      'symptoms', coalesce((select jsonb_agg(to_jsonb(s) order by s.logged_at) from symptom_logs s where s.user_id = uid and s.deleted_at is null), '[]'::jsonb),
      'restrictions', coalesce((select jsonb_agg(to_jsonb(x)) from activity_restrictions x where x.athlete_id = uid), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(to_jsonb(p)) from rehab_plans p where p.athlete_id = uid), '[]'::jsonb),
      'decisions', coalesce((select jsonb_agg(to_jsonb(d)) from rts_decisions d where d.athlete_id = uid), '[]'::jsonb),
      'notes', coalesce((select jsonb_agg(to_jsonb(n)) from case_notes n where n.athlete_id = uid), '[]'::jsonb),
      'case_access', coalesce((select jsonb_agg(to_jsonb(c)) from rehab_case_access c where c.athlete_id = uid), '[]'::jsonb)
    ),
    'coaching', jsonb_build_object(
      'assignments', coalesce((
        select jsonb_agg(to_jsonb(a) || jsonb_build_object('comments', coalesce((
          select jsonb_agg(to_jsonb(c)) from assignment_comments c where c.assignment_id = a.id), '[]'::jsonb)))
        from workout_assignments a where a.athlete_id = uid or a.coach_id = uid), '[]'::jsonb)
    ),
    'goals', jsonb_build_object(
      'goals', coalesce((select jsonb_agg(to_jsonb(g)) from athlete_goals g where g.user_id = uid and g.deleted_at is null), '[]'::jsonb),
      'reviews', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from goal_reviews r where r.athlete_id = uid), '[]'::jsonb)
    ),
    'studio', jsonb_build_object(
      'organizations', coalesce((select jsonb_agg(jsonb_build_object('organization_id', m.organization_id, 'name', o.name, 'role', m.role, 'joined_at', m.created_at))
                                 from organization_members m join organizations o on o.id = m.organization_id where m.user_id = uid), '[]'::jsonb),
      'memberships', coalesce((select jsonb_agg(to_jsonb(ms)) from memberships ms where ms.user_id = uid), '[]'::jsonb),
      'bookings', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object('class_title', c.title, 'starts_at', c.starts_at) order by c.starts_at)
                            from class_bookings b join class_sessions c on c.id = b.class_id where b.user_id = uid), '[]'::jsonb),
      'shifts', coalesce((select jsonb_agg(to_jsonb(s)) from staff_shifts s where s.user_id = uid), '[]'::jsonb)
    ),
    'movement', jsonb_build_object(
      'clips', coalesce((select jsonb_agg(to_jsonb(a) - 'research_use') from video_assets a where a.user_id = uid and a.status <> 'deleted'), '[]'::jsonb),
      'analyses', coalesce((select jsonb_agg(to_jsonb(m)) from movement_analyses m where m.user_id = uid), '[]'::jsonb),
      'annotations', coalesce((select jsonb_agg(to_jsonb(n) || jsonb_build_object('author_name', _display_name(n.author_id))) from video_annotations n where n.athlete_id = uid), '[]'::jsonb),
      'review_requests', coalesce((select jsonb_agg(to_jsonb(r)) from video_review_requests r where r.athlete_id = uid), '[]'::jsonb)
    ),
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(x)) from body_metrics x where x.user_id = uid), '[]'::jsonb),
    'goals_legacy', coalesce((select jsonb_agg(to_jsonb(x)) from goals x where x.user_id = uid), '[]'::jsonb),
    'sharing', jsonb_build_object(
      'relationships', coalesce((
        select jsonb_agg(to_jsonb(r) - 'invite_code') from professional_relationships r
        where r.athlete_id = uid or r.professional_user_id = uid), '[]'::jsonb),
      'grants', coalesce((select jsonb_agg(to_jsonb(g)) from data_share_grants g where g.athlete_id = uid), '[]'::jsonb)
    ),
    'access_log', coalesce((select jsonb_agg(to_jsonb(a)) from audit_events a where a.subject_athlete_id = uid), '[]'::jsonb),
    'notification_preferences', (select to_jsonb(np) from notification_preferences np where np.user_id = uid),
    'assistant', jsonb_build_object(
      'proposals', coalesce((select jsonb_agg(to_jsonb(ap)) from agent_proposals ap where ap.user_id = uid), '[]'::jsonb),
      'runs', coalesce((select jsonb_agg(to_jsonb(ar)) from agent_runs ar where ar.user_id = uid), '[]'::jsonb),
      'conversations', coalesce((
        select jsonb_agg(to_jsonb(c) || jsonb_build_object('messages', coalesce((
          select jsonb_agg(to_jsonb(m) order by m.created_at) from chat_messages m where m.conversation_id = c.id), '[]'::jsonb)))
        from chat_conversations c where c.user_id = uid), '[]'::jsonb),
      'memories', coalesce((select jsonb_agg(to_jsonb(cm)) from coach_memories cm where cm.user_id = uid), '[]'::jsonb)
    )
  ) into v;

  perform _audit(uid, uid, 'data.exported', null, 'data_portability', null, null, '{}');
  return v;
end $$;
