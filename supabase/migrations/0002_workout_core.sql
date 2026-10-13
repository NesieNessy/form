-- FORM — Workout Core (roadmap Step 1)
--
-- Run this in the Supabase SQL editor AFTER supabase/schema.sql.
-- It is safe to run more than once.
--
-- Model: workouts -> workout_versions -> blocks -> steps describe what is
-- prescribed. scheduled_workouts pins a version to a date. sessions and
-- session_results record what actually happened, with a snapshot of the
-- prescription so later edits never rewrite history.
--
-- Versions, blocks and steps can only be written through
-- save_workout_version(), which checks ownership and refuses to publish a
-- structurally invalid workout. The rules in assert_version_publishable()
-- mirror the errors in lib/workout/validate.ts.

-- The first schema had a placeholder `workouts` table (date + completed flag).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts' and column_name = 'scheduled_on'
  ) then
    alter table public.workouts rename to workouts_legacy;
  end if;
end $$;

-- ---------------------------------------------------------------- tables

create table if not exists activities (
  id text primary key,
  name text not null,
  synonyms text[] not null default '{}',
  sports text[] not null default '{}',
  equipment text[] not null default '{}',
  default_target jsonb not null,
  loadable boolean not null default false
);

create table if not exists workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  current_version_id uuid,
  is_template boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'preset', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists workout_versions (
  id uuid primary key,
  workout_id uuid not null references workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'published', 'archived')),
  title text not null,
  sport text not null check (sport in (
    'crossfit', 'strength', 'endurance', 'running', 'cycling', 'swimming', 'triathlon', 'yoga', 'hiit', 'other'
  )),
  description text,
  tags text[] not null default '{}',
  equipment text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (workout_id, version)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workouts_current_version_fk') then
    alter table workouts
      add constraint workouts_current_version_fk
      foreign key (current_version_id) references workout_versions (id) on delete set null;
  end if;
end $$;

create table if not exists blocks (
  id uuid primary key,
  version_id uuid not null references workout_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  type text not null check (type in (
    'warmup', 'strength', 'skill', 'accessory', 'conditioning', 'endurance',
    'interval', 'mobility', 'recovery', 'transition', 'cooldown'
  )),
  format text not null check (format in (
    'for_time', 'amrap', 'repeating_interval', 'sets_reps', 'continuous', 'sequence'
  )),
  label text,
  -- Format-specific settings (rounds, durationSeconds, intervalSeconds, ...).
  config jsonb not null default '{}',
  notes text,
  tags text[] not null default '{}'
);

create table if not exists steps (
  id uuid primary key,
  block_id uuid not null references blocks (id) on delete cascade,
  parent_step_id uuid references steps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('exercise', 'rest', 'transition', 'group')),
  name text,
  activity_id text references activities (id),
  prescription jsonb not null default '{}',
  rounds integer,
  duration_seconds numeric,
  notes text
);

create table if not exists scheduled_workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references workouts (id) on delete cascade,
  version_id uuid not null references workout_versions (id),
  scheduled_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references workouts (id) on delete cascade,
  version_id uuid not null references workout_versions (id),
  scheduled_workout_id uuid references scheduled_workouts (id) on delete set null,
  -- What was prescribed at the time, independent of later workout edits.
  prescribed jsonb not null,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  entry_mode text not null check (entry_mode in ('player', 'manual')),
  started_at timestamptz not null,
  ended_at timestamptz,
  rpe numeric check (rpe is null or (rpe >= 1 and rpe <= 10)),
  notes text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One row per block (step_id null) carrying the block score, plus one row
-- per logged step or set.
create table if not exists session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  block_id uuid not null,
  step_id uuid,
  set_index integer,
  status text check (status is null or status in ('completed', 'partial', 'skipped')),
  elapsed_seconds numeric,
  score jsonb,
  reps integer,
  load_kg numeric,
  duration_seconds numeric,
  distance_m numeric,
  calories numeric,
  completed boolean
);

create index if not exists workouts_user_idx on workouts (user_id);
create index if not exists workout_versions_workout_idx on workout_versions (workout_id);
create index if not exists workout_versions_user_idx on workout_versions (user_id);
create index if not exists blocks_version_idx on blocks (version_id);
create index if not exists steps_block_idx on steps (block_id);
create index if not exists steps_activity_idx on steps (activity_id);
create index if not exists scheduled_workouts_user_time_idx on scheduled_workouts (user_id, scheduled_at);
create index if not exists sessions_user_time_idx on sessions (user_id, started_at);
create index if not exists session_results_session_idx on session_results (session_id);

-- ------------------------------------------------------ row-level security

alter table activities enable row level security;
alter table workouts enable row level security;
alter table workout_versions enable row level security;
alter table blocks enable row level security;
alter table steps enable row level security;
alter table scheduled_workouts enable row level security;
alter table sessions enable row level security;
alter table session_results enable row level security;

drop policy if exists "Signed-in users read the activity catalog" on activities;
create policy "Signed-in users read the activity catalog" on activities
  for select to authenticated using (true);

drop policy if exists "Owners read their workouts" on workouts;
create policy "Owners read their workouts" on workouts
  for select using (auth.uid() = user_id);

drop policy if exists "Owners flag their workouts" on workouts;
create policy "Owners flag their workouts" on workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners read their workout versions" on workout_versions;
create policy "Owners read their workout versions" on workout_versions
  for select using (auth.uid() = user_id);

drop policy if exists "Owners read their blocks" on blocks;
create policy "Owners read their blocks" on blocks
  for select using (auth.uid() = user_id);

drop policy if exists "Owners read their steps" on steps;
create policy "Owners read their steps" on steps
  for select using (auth.uid() = user_id);

drop policy if exists "Owners manage their schedule" on scheduled_workouts;
create policy "Owners manage their schedule" on scheduled_workouts
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from workout_versions v
      where v.id = version_id and v.workout_id = scheduled_workouts.workout_id and v.user_id = auth.uid()
    )
  );

drop policy if exists "Owners manage their sessions" on sessions;
create policy "Owners manage their sessions" on sessions
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from workout_versions v
      where v.id = version_id and v.workout_id = sessions.workout_id and v.user_id = auth.uid()
    )
  );

drop policy if exists "Owners manage their session results" on session_results;
create policy "Owners manage their session results" on session_results
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- Definitions are written only through save_workout_version(). On a workout
-- row the owner may change nothing but the template flag and tombstone.
revoke insert, update, delete on workout_versions, blocks, steps from anon, authenticated;
revoke insert, update, delete on workouts from anon, authenticated;
grant update (is_template, updated_at, deleted_at) on workouts to authenticated;
revoke insert, update, delete on activities from anon, authenticated;

-- ------------------------------------------------------------- functions

create or replace function _json_number(obj jsonb, key text) returns numeric
language sql immutable as $$
  select case when jsonb_typeof(obj -> key) = 'number' then (obj ->> key)::numeric end
$$;

create or replace function _insert_steps(p_block uuid, p_parent uuid, p_steps jsonb, p_user uuid, p_depth integer)
returns void language plpgsql as $$
declare
  s jsonb;
  pos integer := 0;
  sid uuid;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    return;
  end if;
  if p_depth > 3 then
    raise exception 'WORKOUT_INVALID: NESTING_TOO_DEEP';
  end if;
  for s in select * from jsonb_array_elements(p_steps) loop
    sid := (s ->> 'id')::uuid;
    insert into steps (id, block_id, parent_step_id, user_id, position, kind, name, activity_id, prescription, rounds, duration_seconds, notes)
    values (
      sid, p_block, p_parent, p_user, pos,
      s ->> 'kind',
      coalesce(s ->> 'name', s ->> 'label'),
      s ->> 'activityId',
      coalesce(s -> 'prescription', '{}'::jsonb),
      _json_number(s, 'rounds')::integer,
      _json_number(s, 'durationSeconds'),
      s ->> 'notes'
    );
    if s ->> 'kind' = 'group' then
      perform _insert_steps(p_block, sid, s -> 'steps', p_user, p_depth + 1);
    end if;
    pos := pos + 1;
  end loop;
end $$;

-- Raises WORKOUT_INVALID: <CODE> when the stored version breaks a rule that
-- lib/workout/validate.ts reports as an error.
create or replace function assert_version_publishable(p_version uuid)
returns void language plpgsql as $$
declare
  b record;
  s record;
  n integer;
  rx jsonb;
begin
  if (select coalesce(btrim(title), '') = '' from workout_versions where id = p_version) then
    raise exception 'WORKOUT_INVALID: MISSING_TITLE';
  end if;

  select count(*) into n from blocks where version_id = p_version;
  if n = 0 then
    raise exception 'WORKOUT_INVALID: NO_BLOCKS';
  end if;

  for b in select * from blocks where version_id = p_version order by position loop
    if not exists (select 1 from steps where block_id = b.id and parent_step_id is null) then
      raise exception 'WORKOUT_INVALID: EMPTY_BLOCK (block %)', b.position;
    end if;

    if b.config ? 'rounds' and not (_json_number(b.config, 'rounds') > 0 and _json_number(b.config, 'rounds') = floor(_json_number(b.config, 'rounds'))) then
      raise exception 'WORKOUT_INVALID: INVALID_ROUNDS (block %)', b.position;
    end if;

    if b.format = 'for_time' then
      if b.config ? 'rounds' and b.config ? 'repScheme' then
        raise exception 'WORKOUT_INVALID: CONFLICTING_STRUCTURE (block %)', b.position;
      end if;
      if b.config ? 'repScheme' and (
        jsonb_typeof(b.config -> 'repScheme') <> 'array'
        or jsonb_array_length(b.config -> 'repScheme') = 0
        or exists (
          select 1 from jsonb_array_elements(b.config -> 'repScheme') e
          where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric <= 0 or (e #>> '{}')::numeric <> floor((e #>> '{}')::numeric)
        )
      ) then
        raise exception 'WORKOUT_INVALID: INVALID_REP_SCHEME (block %)', b.position;
      end if;
      if b.config ? 'timeCapSeconds' and not coalesce(_json_number(b.config, 'timeCapSeconds') > 0, false) then
        raise exception 'WORKOUT_INVALID: INVALID_TIME_CAP (block %)', b.position;
      end if;
    elsif b.format = 'amrap' then
      if not coalesce(_json_number(b.config, 'durationSeconds') > 0, false) then
        raise exception 'WORKOUT_INVALID: MISSING_DURATION (block %)', b.position;
      end if;
    elsif b.format = 'repeating_interval' then
      if not coalesce(_json_number(b.config, 'intervalSeconds') > 0, false) then
        raise exception 'WORKOUT_INVALID: MISSING_INTERVAL (block %)', b.position;
      end if;
      if not coalesce(_json_number(b.config, 'rounds') > 0, false) then
        raise exception 'WORKOUT_INVALID: MISSING_ROUNDS (block %)', b.position;
      end if;
      if b.config ? 'workSeconds' and not coalesce(
        _json_number(b.config, 'workSeconds') > 0
        and _json_number(b.config, 'workSeconds') <= _json_number(b.config, 'intervalSeconds'), false
      ) then
        raise exception 'WORKOUT_INVALID: WORK_EXCEEDS_INTERVAL (block %)', b.position;
      end if;
    elsif b.format = 'sets_reps' then
      if not coalesce(_json_number(b.config, 'sets') > 0 and _json_number(b.config, 'sets') = floor(_json_number(b.config, 'sets')), false) then
        raise exception 'WORKOUT_INVALID: MISSING_SETS (block %)', b.position;
      end if;
    elsif b.format = 'continuous' then
      if (b.config ? 'durationSeconds' and not coalesce(_json_number(b.config, 'durationSeconds') > 0, false))
        or (b.config ? 'distanceMeters' and not coalesce(_json_number(b.config, 'distanceMeters') > 0, false)) then
        raise exception 'WORKOUT_INVALID: INVALID_TARGET (block %)', b.position;
      end if;
    end if;

    for s in select * from steps where block_id = b.id loop
      if s.kind = 'exercise' then
        if coalesce(btrim(s.name), '') = '' then
          raise exception 'WORKOUT_INVALID: MISSING_EXERCISE_NAME (block %)', b.position;
        end if;
        rx := s.prescription;
        if rx ? 'reps' and not (
          rx ->> 'reps' = 'max'
          or coalesce(_json_number(rx, 'reps') > 0 and _json_number(rx, 'reps') = floor(_json_number(rx, 'reps')), false)
        ) then
          raise exception 'WORKOUT_INVALID: INVALID_REPS (block %)', b.position;
        end if;
        if (rx ? 'durationSeconds' and not coalesce(_json_number(rx, 'durationSeconds') > 0, false))
          or (rx ? 'distanceMeters' and not coalesce(_json_number(rx, 'distanceMeters') > 0, false))
          or (rx ? 'calories' and not coalesce(_json_number(rx, 'calories') > 0, false)) then
          raise exception 'WORKOUT_INVALID: INVALID_TARGET (block %)', b.position;
        end if;
        if rx ? 'load' and not coalesce(
          (rx -> 'load' ->> 'unit') in ('kg', 'percent_1rm')
          and _json_number(rx -> 'load', 'value') > 0
          and not ((rx -> 'load' ->> 'unit') = 'percent_1rm' and _json_number(rx -> 'load', 'value') > 200), false
        ) then
          raise exception 'WORKOUT_INVALID: INVALID_LOAD (block %)', b.position;
        end if;
      elsif s.kind = 'rest' then
        if not coalesce(s.duration_seconds > 0, false) then
          raise exception 'WORKOUT_INVALID: MISSING_DURATION (block %)', b.position;
        end if;
      elsif s.kind = 'transition' then
        if s.duration_seconds is not null and s.duration_seconds <= 0 then
          raise exception 'WORKOUT_INVALID: INVALID_DURATION (block %)', b.position;
        end if;
      elsif s.kind = 'group' then
        if not coalesce(s.rounds > 0, false) then
          raise exception 'WORKOUT_INVALID: MISSING_ROUNDS (block %)', b.position;
        end if;
        if not exists (select 1 from steps c where c.parent_step_id = s.id) then
          raise exception 'WORKOUT_INVALID: EMPTY_GROUP (block %)', b.position;
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- Saves one immutable workout version together with its blocks and steps,
-- creating the workout on first use. Idempotent: sending the same version
-- again changes nothing, so a retried upload cannot create duplicates.
--
-- payload: { workout: {id, isTemplate, source, createdAt, updatedAt},
--            version: {id, version, status, createdAt,
--                      content: {title, sport, description, tags, equipment, blocks: [...]}} }
create or replace function save_workout_version(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w jsonb := payload -> 'workout';
  v jsonb := payload -> 'version';
  c jsonb := payload -> 'version' -> 'content';
  wid uuid := (payload -> 'workout' ->> 'id')::uuid;
  vid uuid := (payload -> 'version' ->> 'id')::uuid;
  vnum integer := (payload -> 'version' ->> 'version')::integer;
  owner uuid;
  b jsonb;
  pos integer := 0;
  bid uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if wid is null or vid is null or c is null then
    raise exception 'WORKOUT_INVALID: MALFORMED_PAYLOAD';
  end if;

  insert into workouts (id, user_id, is_template, source, created_at, updated_at)
  values (
    wid, uid,
    coalesce((w ->> 'isTemplate')::boolean, false),
    coalesce(w ->> 'source', 'manual'),
    coalesce((w ->> 'createdAt')::timestamptz, now()),
    coalesce((w ->> 'updatedAt')::timestamptz, now())
  )
  on conflict (id) do nothing;

  select user_id into owner from workouts where id = wid;
  if owner is distinct from uid then
    raise exception 'FORBIDDEN';
  end if;

  select user_id into owner from workout_versions where id = vid;
  if found then
    if owner is distinct from uid then
      raise exception 'FORBIDDEN';
    end if;
  else
    insert into workout_versions (id, workout_id, user_id, version, status, title, sport, description, tags, equipment, created_at)
    values (
      vid, wid, uid, vnum,
      v ->> 'status',
      coalesce(c ->> 'title', ''),
      c ->> 'sport',
      c ->> 'description',
      coalesce(array(select jsonb_array_elements_text(c -> 'tags')), '{}'),
      coalesce(array(select jsonb_array_elements_text(c -> 'equipment')), '{}'),
      coalesce((v ->> 'createdAt')::timestamptz, now())
    );

    if jsonb_typeof(c -> 'blocks') = 'array' then
      for b in select * from jsonb_array_elements(c -> 'blocks') loop
        bid := (b ->> 'id')::uuid;
        insert into blocks (id, version_id, user_id, position, type, format, label, config, notes, tags)
        values (
          bid, vid, uid, pos,
          b ->> 'type',
          b -> 'config' ->> 'format',
          b ->> 'label',
          coalesce(b -> 'config', '{}'::jsonb) - 'format',
          b ->> 'notes',
          coalesce(array(select jsonb_array_elements_text(b -> 'tags')), '{}')
        );
        perform _insert_steps(bid, null, b -> 'steps', uid, 1);
        pos := pos + 1;
      end loop;
    end if;

    if v ->> 'status' = 'published' then
      perform assert_version_publishable(vid);
    end if;
  end if;

  -- Point the workout at the newest version it has; never move it backwards.
  update workouts wk
  set current_version_id = vid
  where wk.id = wid
    and (
      wk.current_version_id is null
      or (select cv.version from workout_versions cv where cv.id = wk.current_version_id) < vnum
    );

  return vid;
end $$;

-- Saves a session and replaces its results in one transaction. Runs with
-- the caller's rights, so row-level security applies. An older copy never
-- overwrites a newer one.
--
-- payload: { id, workoutId, versionId, scheduledWorkoutId, prescribed, status,
--            entryMode, startedAt, endedAt, rpe, notes, updatedAt, deletedAt,
--            blockResults: [{blockId, status, elapsedSeconds, score, stepResults: [...]}] }
create or replace function save_session(payload jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (payload ->> 'id')::uuid;
  br jsonb;
  sr jsonb;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  insert into sessions (
    id, user_id, workout_id, version_id, scheduled_workout_id, prescribed, status, entry_mode,
    started_at, ended_at, rpe, notes, updated_at, deleted_at
  )
  values (
    sid, uid,
    (payload ->> 'workoutId')::uuid,
    (payload ->> 'versionId')::uuid,
    (payload ->> 'scheduledWorkoutId')::uuid,
    payload -> 'prescribed',
    payload ->> 'status',
    payload ->> 'entryMode',
    (payload ->> 'startedAt')::timestamptz,
    (payload ->> 'endedAt')::timestamptz,
    _json_number(payload, 'rpe'),
    payload ->> 'notes',
    coalesce((payload ->> 'updatedAt')::timestamptz, now()),
    (payload ->> 'deletedAt')::timestamptz
  )
  on conflict (id) do update set
    status = excluded.status,
    prescribed = excluded.prescribed,
    scheduled_workout_id = excluded.scheduled_workout_id,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    rpe = excluded.rpe,
    notes = excluded.notes,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at
  where sessions.updated_at <= excluded.updated_at;

  if not found then
    return sid;
  end if;

  delete from session_results where session_id = sid;

  if jsonb_typeof(payload -> 'blockResults') = 'array' then
    for br in select * from jsonb_array_elements(payload -> 'blockResults') loop
      insert into session_results (session_id, user_id, block_id, status, elapsed_seconds, score)
      values (
        sid, uid, (br ->> 'blockId')::uuid, br ->> 'status',
        _json_number(br, 'elapsedSeconds'),
        br -> 'score'
      );
      if jsonb_typeof(br -> 'stepResults') = 'array' then
        for sr in select * from jsonb_array_elements(br -> 'stepResults') loop
          insert into session_results (
            session_id, user_id, block_id, step_id, set_index, reps, load_kg, duration_seconds, distance_m, calories, completed
          )
          values (
            sid, uid, (br ->> 'blockId')::uuid, (sr ->> 'stepId')::uuid,
            _json_number(sr, 'setIndex')::integer,
            _json_number(sr, 'reps')::integer,
            _json_number(sr, 'loadKg'),
            _json_number(sr, 'durationSeconds'),
            _json_number(sr, 'distanceMeters'),
            _json_number(sr, 'calories'),
            coalesce((sr ->> 'completed')::boolean, false)
          );
        end loop;
      end if;
    end loop;
  end if;

  return sid;
end $$;

revoke all on function save_workout_version(jsonb) from public, anon;
grant execute on function save_workout_version(jsonb) to authenticated;
revoke all on function save_session(jsonb) from public, anon;
grant execute on function save_session(jsonb) to authenticated;
revoke all on function _insert_steps(uuid, uuid, jsonb, uuid, integer) from public, anon, authenticated;
revoke all on function assert_version_publishable(uuid) from public, anon, authenticated;

-- ------------------------------------------------------ activity catalog
-- Generated from lib/workout/catalog.ts by `npm run gen:activity-seed`.
-- BEGIN activities seed
insert into activities (id, name, synonyms, sports, equipment, default_target, loadable) values
  ('back_squat', 'Back Squat', array['squat', 'bs'], array['strength', 'crossfit'], array['barbell', 'rack'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('front_squat', 'Front Squat', array['fs'], array['strength', 'crossfit'], array['barbell', 'rack'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('overhead_squat', 'Overhead Squat', array['ohs'], array['strength', 'crossfit'], array['barbell'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('deadlift', 'Deadlift', array['dl'], array['strength', 'crossfit'], array['barbell'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('bench_press', 'Bench Press', array['bench'], array['strength'], array['barbell', 'bench'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('overhead_press', 'Overhead Press', array['strict press', 'shoulder press', 'ohp', 'press'], array['strength', 'crossfit'], array['barbell'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('push_press', 'Push Press', '{}', array['strength', 'crossfit'], array['barbell'], '{"kind":"reps","reps":5}'::jsonb, true),
  ('push_jerk', 'Push Jerk', array['jerk'], array['crossfit'], array['barbell'], '{"kind":"reps","reps":3}'::jsonb, true),
  ('clean', 'Clean', array['squat clean', 'power clean'], array['crossfit'], array['barbell'], '{"kind":"reps","reps":3}'::jsonb, true),
  ('clean_and_jerk', 'Clean & Jerk', array['c&j', 'clean and jerk'], array['crossfit'], array['barbell'], '{"kind":"reps","reps":3}'::jsonb, true),
  ('snatch', 'Snatch', array['squat snatch', 'power snatch'], array['crossfit'], array['barbell'], '{"kind":"reps","reps":3}'::jsonb, true),
  ('thruster', 'Thruster', array['barbell thruster'], array['crossfit'], array['barbell'], '{"kind":"reps","reps":10}'::jsonb, true),
  ('barbell_row', 'Bent-Over Row', array['bent over row', 'barbell row'], array['strength'], array['barbell'], '{"kind":"reps","reps":8}'::jsonb, true),
  ('hip_thrust', 'Hip Thrust', '{}', array['strength'], array['barbell', 'bench'], '{"kind":"reps","reps":8}'::jsonb, true),
  ('dumbbell_thruster', 'Dumbbell Thruster', array['db thruster'], array['crossfit', 'hiit'], array['dumbbell'], '{"kind":"reps","reps":10}'::jsonb, true),
  ('dumbbell_snatch', 'Dumbbell Snatch', array['db snatch'], array['crossfit', 'hiit'], array['dumbbell'], '{"kind":"reps","reps":10}'::jsonb, true),
  ('dumbbell_hang_clean', 'Dumbbell Hang Squat Clean', array['db hang squat clean', 'dumbbell hang clean'], array['crossfit'], array['dumbbell'], '{"kind":"reps","reps":10}'::jsonb, true),
  ('goblet_squat', 'Goblet Squat', '{}', array['strength', 'hiit'], array['dumbbell', 'kettlebell'], '{"kind":"reps","reps":10}'::jsonb, true),
  ('kettlebell_swing', 'Kettlebell Swing', array['kb swing', 'kbs'], array['crossfit', 'hiit'], array['kettlebell'], '{"kind":"reps","reps":15}'::jsonb, true),
  ('wall_ball', 'Wall Ball', array['wall ball shot', 'wb'], array['crossfit'], array['medicine ball'], '{"kind":"reps","reps":15}'::jsonb, true),
  ('walking_lunge', 'Walking Lunge', array['lunge', 'walking lunges'], array['crossfit', 'hiit'], '{}', '{"kind":"reps","reps":20}'::jsonb, false),
  ('pull_up', 'Pull Up', array['pullup', 'pull-up'], array['crossfit', 'strength'], array['pull-up bar'], '{"kind":"reps","reps":10}'::jsonb, false),
  ('chest_to_bar', 'Chest-to-Bar Pull Up', array['c2b', 'chest to bar'], array['crossfit'], array['pull-up bar'], '{"kind":"reps","reps":8}'::jsonb, false),
  ('ring_row', 'Ring Row', '{}', array['crossfit'], array['rings'], '{"kind":"reps","reps":10}'::jsonb, false),
  ('muscle_up', 'Muscle Up', array['bar muscle up', 'ring muscle up'], array['crossfit'], array['rings', 'pull-up bar'], '{"kind":"reps","reps":3}'::jsonb, false),
  ('toes_to_bar', 'Toes-to-Bar', array['t2b', 'toes to bar'], array['crossfit'], array['pull-up bar'], '{"kind":"reps","reps":10}'::jsonb, false),
  ('push_up', 'Push Up', array['pushup', 'push-up'], array['crossfit', 'hiit', 'strength'], '{}', '{"kind":"reps","reps":10}'::jsonb, false),
  ('handstand_push_up', 'Handstand Push Up', array['hspu'], array['crossfit'], '{}', '{"kind":"reps","reps":5}'::jsonb, false),
  ('dip', 'Dip', array['ring dip'], array['strength', 'crossfit'], array['dip bars'], '{"kind":"reps","reps":8}'::jsonb, false),
  ('air_squat', 'Air Squat', array['bodyweight squat'], array['crossfit', 'hiit'], '{}', '{"kind":"reps","reps":15}'::jsonb, false),
  ('pistol', 'Pistol Squat', array['pistol'], array['crossfit'], '{}', '{"kind":"reps","reps":6}'::jsonb, false),
  ('burpee', 'Burpee', '{}', array['crossfit', 'hiit'], '{}', '{"kind":"reps","reps":10}'::jsonb, false),
  ('box_jump', 'Box Jump', '{}', array['crossfit', 'hiit'], array['box'], '{"kind":"reps","reps":10}'::jsonb, false),
  ('double_under', 'Double Under', array['du'], array['crossfit', 'hiit'], array['jump rope'], '{"kind":"reps","reps":50}'::jsonb, false),
  ('single_under', 'Single Under', '{}', array['crossfit', 'hiit'], array['jump rope'], '{"kind":"reps","reps":100}'::jsonb, false),
  ('sit_up', 'Sit Up', array['situp', 'sit-up', 'abmat sit up'], array['crossfit', 'hiit'], '{}', '{"kind":"reps","reps":15}'::jsonb, false),
  ('v_up', 'V-Up', array['v up'], array['crossfit', 'hiit'], '{}', '{"kind":"reps","reps":15}'::jsonb, false),
  ('tuck_crunch', 'Tuck Crunch', '{}', array['hiit'], '{}', '{"kind":"reps","reps":15}'::jsonb, false),
  ('mountain_climber', 'Mountain Climber', '{}', array['hiit'], '{}', '{"kind":"reps","reps":20}'::jsonb, false),
  ('jumping_jack', 'Jumping Jack', '{}', array['hiit'], '{}', '{"kind":"reps","reps":30}'::jsonb, false),
  ('plank', 'Plank', array['plank hold'], array['hiit', 'yoga', 'strength'], '{}', '{"kind":"duration","seconds":60}'::jsonb, false),
  ('side_plank', 'Side Plank', array['side plank lift'], array['hiit', 'yoga'], '{}', '{"kind":"duration","seconds":30}'::jsonb, false),
  ('hollow_hold', 'Hollow Hold', '{}', array['crossfit'], '{}', '{"kind":"duration","seconds":30}'::jsonb, false),
  ('handstand_hold', 'Handstand Hold', array['handstand practice'], array['crossfit'], '{}', '{"kind":"duration","seconds":30}'::jsonb, false),
  ('run', 'Run', array['running', 'jog'], array['running', 'crossfit', 'triathlon', 'endurance'], '{}', '{"kind":"distance","meters":400}'::jsonb, false),
  ('row', 'Row', array['rowing', 'rower'], array['crossfit', 'endurance'], array['rower'], '{"kind":"distance","meters":500}'::jsonb, false),
  ('ski_erg', 'Ski Erg', array['skierg'], array['crossfit', 'endurance'], array['ski erg'], '{"kind":"distance","meters":400}'::jsonb, false),
  ('bike', 'Bike', array['assault bike', 'echo bike', 'bike erg'], array['crossfit', 'endurance'], array['bike erg'], '{"kind":"calories","calories":20}'::jsonb, false),
  ('cycling', 'Cycling', array['ride', 'cycle'], array['cycling', 'triathlon', 'endurance'], array['bike'], '{"kind":"duration","seconds":3600}'::jsonb, false),
  ('swim', 'Swim', array['swimming'], array['swimming', 'triathlon', 'endurance'], array['pool'], '{"kind":"distance","meters":400}'::jsonb, false),
  ('walk', 'Walk', array['walking'], array['endurance', 'other'], '{}', '{"kind":"duration","seconds":600}'::jsonb, false),
  ('downward_dog', 'Downward Dog', array['downward facing dog'], array['yoga'], array['mat'], '{"kind":"duration","seconds":60}'::jsonb, false),
  ('warrior_1', 'Warrior I', array['warrior 1'], array['yoga'], array['mat'], '{"kind":"duration","seconds":30}'::jsonb, false),
  ('warrior_2', 'Warrior II', array['warrior 2'], array['yoga'], array['mat'], '{"kind":"duration","seconds":30}'::jsonb, false),
  ('childs_pose', 'Child''s Pose', array['childs pose'], array['yoga'], array['mat'], '{"kind":"duration","seconds":120}'::jsonb, false),
  ('pigeon_pose', 'Pigeon Pose', array['pigeon'], array['yoga'], array['mat'], '{"kind":"duration","seconds":90}'::jsonb, false),
  ('cat_cow', 'Cat-Cow', array['cat cow'], array['yoga'], array['mat'], '{"kind":"duration","seconds":60}'::jsonb, false),
  ('couch_stretch', 'Couch Stretch', '{}', array['yoga', 'other'], '{}', '{"kind":"duration","seconds":120}'::jsonb, false),
  ('pranayama', 'Pranayama', array['breathwork', 'breathing'], array['yoga'], '{}', '{"kind":"duration","seconds":300}'::jsonb, false),
  ('meditation', 'Meditation', '{}', array['yoga', 'other'], '{}', '{"kind":"duration","seconds":600}'::jsonb, false)
on conflict (id) do update set
  name = excluded.name,
  synonyms = excluded.synonyms,
  sports = excluded.sports,
  equipment = excluded.equipment,
  default_target = excluded.default_target,
  loadable = excluded.loadable;
-- END activities seed
