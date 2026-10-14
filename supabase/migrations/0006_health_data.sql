-- FORM — health and wearable data (roadmap Step 4)
--
-- Run AFTER 0005_ai_proposals.sql. Safe to run more than once.
--
-- Two kinds of record arrive from outside the workout model:
--   external_activities  a recorded activity (a run, a ride) from a file or a
--                        connected device, kept apart from planned workouts
--                        until the athlete links it to one or logs it
--   health_observations  single measurements (resting heart rate, HRV, sleep,
--                        weight) with their unit, when they were measured,
--                        when they arrived, where from and how
--
-- Rows are written by the device with ids it made, like the rest of the
-- workout data, so a retry is an idempotent upsert. A provider's own id is
-- unique per athlete, so the same file or reading can never be stored twice.
-- Deleting a row keeps a tombstone for other devices but erases its values.

-- ------------------------------------------------- sessions from activities

alter table sessions drop constraint if exists sessions_entry_mode_check;
alter table sessions add constraint sessions_entry_mode_check check (entry_mode in ('player', 'manual', 'import'));

-- ------------------------------------------------------------- activities

create table if not exists external_activities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('file', 'manual', 'apple_health', 'garmin')),
  external_id text not null,
  -- Format, file name, device and recording app: provenance, not content.
  source jsonb not null default '{}',
  sport text not null,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  elapsed_seconds numeric not null check (elapsed_seconds >= 0),
  moving_seconds numeric check (moving_seconds >= 0),
  distance_m numeric check (distance_m >= 0),
  elevation_gain_m numeric check (elevation_gain_m >= 0),
  avg_heart_rate numeric check (avg_heart_rate between 20 and 260),
  max_heart_rate numeric check (max_heart_rate between 20 and 260),
  avg_power_w numeric check (avg_power_w >= 0),
  avg_cadence numeric check (avg_cadence >= 0),
  calories_estimate numeric check (calories_estimate >= 0),
  quality text[] not null default '{}',
  -- Downsampled heart-rate series; dropped when the activity is deleted.
  series jsonb,
  status text not null default 'new' check (status in ('new', 'linked', 'standalone', 'duplicate', 'ignored')),
  -- Not foreign keys: the session and the other activity sync on their own
  -- schedule, and a missing one must not block this row.
  session_id uuid,
  duplicate_of_id uuid,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, provider, external_id),
  check (ended_at >= started_at)
);

create index if not exists external_activities_user_idx on external_activities (user_id, started_at desc);

-- ----------------------------------------------------------- measurements

create table if not exists health_observations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null check (metric in (
    'resting_hr_bpm', 'hrv_ms', 'sleep_duration_min', 'weight_kg', 'body_fat_pct', 'subjective_fatigue', 'subjective_soreness')),
  -- Null only on a deleted row, whose value has been erased.
  value numeric,
  unit text not null,
  observed_at timestamptz not null,
  -- The athlete's calendar day of the measurement, as their device saw it.
  local_date date not null,
  ingested_at timestamptz not null default now(),
  provider text not null check (provider in ('file', 'manual', 'apple_health', 'garmin')),
  external_id text,
  device text,
  origin text not null check (origin in ('user_entered', 'device_measured', 'device_estimate')),
  -- How it was measured or computed, e.g. 'rmssd' or 'sdnn' for HRV, which are not comparable.
  method text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (value is not null or deleted_at is not null),
  -- Written so a null method fails: a check that evaluates to null passes.
  check (metric <> 'hrv_ms' or deleted_at is not null or (method is not null and method in ('rmssd', 'sdnn')))
);

create unique index if not exists health_observations_external_idx
  on health_observations (user_id, provider, external_id) where external_id is not null;
create index if not exists health_observations_user_idx on health_observations (user_id, metric, observed_at desc);

-- -------------------------------------------- deletion erases the content

create or replace function _erase_deleted_health_data() returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null then
    if tg_table_name = 'external_activities' then
      new.series := null;
      new.source := jsonb_build_object('format', new.source -> 'format');
      new.name := null;
    else
      new.value := null;
      new.device := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists external_activities_erase on external_activities;
create trigger external_activities_erase before insert or update on external_activities
  for each row execute function _erase_deleted_health_data();

drop trigger if exists health_observations_erase on health_observations;
create trigger health_observations_erase before insert or update on health_observations
  for each row execute function _erase_deleted_health_data();

revoke all on function _erase_deleted_health_data() from public, anon, authenticated;

-- ------------------------------------------------------ row-level security

alter table external_activities enable row level security;
alter table health_observations enable row level security;

drop policy if exists "Owners manage their activities" on external_activities;
create policy "Owners manage their activities" on external_activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners manage their measurements" on health_observations;
create policy "Owners manage their measurements" on health_observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------- sharing

-- Individual measurements and recorded activities can now be shared, with
-- their own consent. Daily summaries stay unavailable until they exist.
update data_categories
set label = 'Health measurements',
    description = 'Resting heart rate, HRV, sleep, body weight and recorded activities.',
    available = true
where id = 'wearable_raw';

create or replace function get_shared_context(p_athlete uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  v_purpose text;
  v_result jsonb;
  v_granted text[] := '{}';
  v_rows jsonb;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships
  where athlete_id = p_athlete and professional_user_id = uid and status = 'active'
  order by accepted_at desc limit 1;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  v_purpose := _purpose_for(r.relationship_type);

  v_result := jsonb_build_object(
    'athlete', jsonb_build_object('id', p_athlete, 'display_name', _display_name(p_athlete)),
    'relationship_id', r.id,
    'relationship_type', r.relationship_type,
    'purpose', v_purpose,
    'retrieved_at', now()
  );

  if has_grant(p_athlete, 'profile', 'read') then
    select to_jsonb(p) - 'user_id' into v_rows from profiles p where p.user_id = p_athlete;
    v_result := v_result || jsonb_build_object('profile', v_rows);
    v_granted := array_append(v_granted, 'profile');
    perform _audit(uid, p_athlete, 'data.read', 'profile', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', case when v_rows is null then 0 else 1 end));
  end if;

  if has_grant(p_athlete, 'benchmarks', 'read') then
    select coalesce(jsonb_agg(to_jsonb(b) - 'user_id' order by b.measured_on desc), '[]'::jsonb) into v_rows
    from benchmarks b where b.user_id = p_athlete and b.deleted_at is null;
    v_result := v_result || jsonb_build_object('benchmarks', v_rows);
    v_granted := array_append(v_granted, 'benchmarks');
    perform _audit(uid, p_athlete, 'data.read', 'benchmarks', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows)));
  end if;

  if has_grant(p_athlete, 'workout_plan', 'read') then
    select coalesce(jsonb_agg(item order by scheduled_at desc), '[]'::jsonb) into v_rows
    from (
      select sw.scheduled_at,
        jsonb_build_object(
          'id', sw.id, 'scheduled_at', sw.scheduled_at, 'status', sw.status,
          'version', to_jsonb(v) || jsonb_build_object('blocks', coalesce((
            select jsonb_agg(to_jsonb(b) || jsonb_build_object('steps', coalesce((
              select jsonb_agg(to_jsonb(s)) from steps s where s.block_id = b.id
            ), '[]'::jsonb)))
            from blocks b where b.version_id = v.id
          ), '[]'::jsonb))
        ) as item
      from scheduled_workouts sw
      join workout_versions v on v.id = sw.version_id
      where sw.user_id = p_athlete and sw.deleted_at is null and sw.scheduled_at > now() - interval '90 days'
      order by sw.scheduled_at desc
      limit 200
    ) plan;
    v_result := v_result || jsonb_build_object('workout_plan', v_rows);
    v_granted := array_append(v_granted, 'workout_plan');
    perform _audit(uid, p_athlete, 'data.read', 'workout_plan', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows)));
  end if;

  if has_grant(p_athlete, 'workout_session', 'read') then
    select coalesce(jsonb_agg(item order by started_at desc), '[]'::jsonb) into v_rows
    from (
      select se.started_at,
        to_jsonb(se) || jsonb_build_object('session_results', coalesce((
          select jsonb_agg(to_jsonb(sr)) from session_results sr where sr.session_id = se.id
        ), '[]'::jsonb)) as item
      from sessions se
      where se.user_id = p_athlete and se.deleted_at is null and se.status = 'completed'
        and se.started_at > now() - interval '90 days'
      order by se.started_at desc
      limit 200
    ) done;
    v_result := v_result || jsonb_build_object('workout_session', v_rows);
    v_granted := array_append(v_granted, 'workout_session');
    perform _audit(uid, p_athlete, 'data.read', 'workout_session', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows)));
  end if;

  if has_grant(p_athlete, 'performance_summary', 'read') then
    select jsonb_build_object(
      'window_days', 28,
      'sessions_completed', (select count(*) from sessions se
        where se.user_id = p_athlete and se.deleted_at is null and se.status = 'completed' and se.started_at > now() - interval '28 days'),
      'workouts_planned', (select count(*) from scheduled_workouts sw
        where sw.user_id = p_athlete and sw.deleted_at is null and sw.scheduled_at between now() - interval '28 days' and now()),
      'planned_workouts_completed', (select count(*) from scheduled_workouts sw
        where sw.user_id = p_athlete and sw.deleted_at is null and sw.status = 'completed'
          and sw.scheduled_at between now() - interval '28 days' and now()),
      'last_session_at', (select max(se.started_at) from sessions se
        where se.user_id = p_athlete and se.deleted_at is null and se.status = 'completed')
    ) into v_rows;
    v_result := v_result || jsonb_build_object('performance_summary', v_rows);
    v_granted := array_append(v_granted, 'performance_summary');
    perform _audit(uid, p_athlete, 'data.read', 'performance_summary', v_purpose, 'professional_relationship', r.id, '{}');
  end if;

  -- Measurements and activity summaries from the last 90 days. The raw
  -- heart-rate series and file names stay with the athlete.
  if has_grant(p_athlete, 'wearable_raw', 'read') then
    select jsonb_build_object(
      'observations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'metric', o.metric, 'value', o.value, 'unit', o.unit, 'method', o.method,
          'observed_at', o.observed_at, 'local_date', o.local_date, 'origin', o.origin, 'provider', o.provider
        ) order by o.observed_at desc)
        from (select * from health_observations
              where user_id = p_athlete and deleted_at is null and observed_at > now() - interval '90 days'
              order by observed_at desc limit 1000) o
      ), '[]'::jsonb),
      'activities', coalesce((
        select jsonb_agg(to_jsonb(a) - 'user_id' - 'series' - 'source' - 'external_id' order by a.started_at desc)
        from (select * from external_activities
              where user_id = p_athlete and deleted_at is null and status <> 'duplicate' and started_at > now() - interval '90 days'
              order by started_at desc limit 200) a
      ), '[]'::jsonb)
    ) into v_rows;
    v_result := v_result || jsonb_build_object('wearable_raw', v_rows);
    v_granted := array_append(v_granted, 'wearable_raw');
    perform _audit(uid, p_athlete, 'data.read', 'wearable_raw', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows -> 'observations') + jsonb_array_length(v_rows -> 'activities')));
  end if;

  return v_result || jsonb_build_object('granted', to_jsonb(v_granted));
end $$;

-- ---------------------------------------------------------------- export

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
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(x)) from body_metrics x where x.user_id = uid), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(x)) from goals x where x.user_id = uid), '[]'::jsonb),
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
      'runs', coalesce((select jsonb_agg(to_jsonb(ar)) from agent_runs ar where ar.user_id = uid), '[]'::jsonb)
    )
  ) into v;

  perform _audit(uid, uid, 'data.exported', null, 'data_portability', null, null, '{}');
  return v;
end $$;
