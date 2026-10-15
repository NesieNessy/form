-- FORM — nutrition tracking (roadmap Step 5)
--
-- Run AFTER 0006_health_data.sql. Safe to run more than once.
--
--   foods             the athlete's own foods (from labels); FORM's starter
--                     catalog ships with the app and is not stored here
--   food_log_entries  what the athlete reports eating or drinking, with a
--                     snapshot of the food and the nutrients computed on the
--                     device; unknown nutrients are absent, never zero
--   saved_meals       reusable groups of foods and amounts
--   profiles          gain the calorie-free view and approved targets
--
-- Rows are written by the device with ids it made, as for workouts. Deleting
-- an entry keeps a tombstone for other devices and erases what was eaten.

-- --------------------------------------------------------------- profile

alter table profiles add column if not exists hide_energy boolean not null default false;
alter table profiles add column if not exists nutrition_targets jsonb;

-- ----------------------------------------------------------------- foods

create table if not exists foods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  brand text,
  basis text not null check (basis in ('per_100g', 'per_100ml', 'per_serving')),
  nutrients jsonb not null default '{}',
  servings jsonb not null default '[]',
  density_g_per_ml numeric check (density_g_per_ml > 0),
  is_fluid boolean not null default false,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists foods_user_idx on foods (user_id);

-- ------------------------------------------------------------------- log

create table if not exists food_log_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  consumed_at timestamptz not null,
  -- The athlete's calendar day, fixed when logged so travel does not move meals.
  local_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'during_workout', 'post_workout')),
  -- The food as it was when logged, and the amount. Both absent for a quick-add.
  food jsonb,
  quantity jsonb,
  label text,
  nutrients jsonb not null default '{}',
  fluid_ml numeric check (fluid_ml >= 0 and fluid_ml <= 5000),
  -- Not a foreign key: the session syncs on its own schedule.
  session_id uuid,
  entry_method text not null check (entry_method in ('search', 'quick_add', 'saved_meal', 'ai_draft')),
  estimated boolean not null default false,
  note text,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (deleted_at is not null or food is not null or entry_method = 'quick_add')
);

create index if not exists food_log_user_day_idx on food_log_entries (user_id, local_date);
create index if not exists food_log_session_idx on food_log_entries (session_id) where session_id is not null;

create table if not exists saved_meals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- -------------------------------------------- deletion erases the content

create or replace function _erase_deleted_food_entry() returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null then
    new.food := null;
    new.quantity := null;
    new.label := null;
    new.nutrients := '{}';
    new.fluid_ml := null;
    new.note := null;
  end if;
  return new;
end $$;

drop trigger if exists food_log_entries_erase on food_log_entries;
create trigger food_log_entries_erase before insert or update on food_log_entries
  for each row execute function _erase_deleted_food_entry();

revoke all on function _erase_deleted_food_entry() from public, anon, authenticated;

-- ------------------------------------------------------ row-level security

alter table foods enable row level security;
alter table food_log_entries enable row level security;
alter table saved_meals enable row level security;

drop policy if exists "Owners manage their foods" on foods;
create policy "Owners manage their foods" on foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners manage their food log" on food_log_entries;
create policy "Owners manage their food log" on food_log_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners manage their saved meals" on saved_meals;
create policy "Owners manage their saved meals" on saved_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------- sharing

update data_categories set available = true where id in ('nutrition_log', 'nutrition_target');

-- The profile category no longer carries nutrition settings; targets have their own consent.
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
    select to_jsonb(p) - 'user_id' - 'nutrition_targets' - 'hide_energy' into v_rows from profiles p where p.user_id = p_athlete;
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

  -- What the athlete logged in the last 90 days: foods, amounts and nutrients. Notes stay private.
  if has_grant(p_athlete, 'nutrition_log', 'read') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'consumed_at', e.consumed_at, 'local_date', e.local_date, 'meal_type', e.meal_type,
      'name', coalesce(e.food ->> 'name', e.label), 'quantity', e.quantity, 'nutrients', e.nutrients,
      'fluid_ml', e.fluid_ml, 'session_id', e.session_id, 'estimated', e.estimated, 'entry_method', e.entry_method
    ) order by e.consumed_at desc), '[]'::jsonb) into v_rows
    from (select * from food_log_entries
          where user_id = p_athlete and deleted_at is null and consumed_at > now() - interval '90 days'
          order by consumed_at desc limit 2000) e;
    v_result := v_result || jsonb_build_object('nutrition_log', v_rows);
    v_granted := array_append(v_granted, 'nutrition_log');
    perform _audit(uid, p_athlete, 'data.read', 'nutrition_log', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows)));
  end if;

  if has_grant(p_athlete, 'nutrition_target', 'read') then
    select p.nutrition_targets into v_rows from profiles p where p.user_id = p_athlete;
    v_result := v_result || jsonb_build_object('nutrition_target', v_rows);
    v_granted := array_append(v_granted, 'nutrition_target');
    perform _audit(uid, p_athlete, 'data.read', 'nutrition_target', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', case when v_rows is null then 0 else 1 end));
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
    'nutrition', jsonb_build_object(
      'foods', coalesce((select jsonb_agg(to_jsonb(f)) from foods f where f.user_id = uid and f.deleted_at is null), '[]'::jsonb),
      'log', coalesce((select jsonb_agg(to_jsonb(e) order by e.consumed_at) from food_log_entries e where e.user_id = uid and e.deleted_at is null), '[]'::jsonb),
      'saved_meals', coalesce((select jsonb_agg(to_jsonb(m)) from saved_meals m where m.user_id = uid and m.deleted_at is null), '[]'::jsonb)
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
