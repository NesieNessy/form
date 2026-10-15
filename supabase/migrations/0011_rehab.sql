-- FORM — rehabilitation and physio beta (roadmap Step 8)
--
-- Run AFTER 0010_recovery.sql. Safe to run more than once.
--
-- The athlete owns injury episodes and symptom logs (written by the device,
-- like the rest of their data). Clinicians author restrictions, rehab plans,
-- review notes and return-to-sport decisions through the functions below,
-- only for cases the athlete shared with them one by one. The athlete can
-- read all of it and change none of it. Return-to-sport decisions need a
-- clinician whose registration has been verified; verification is recorded
-- by the operator, never by the clinician. Nothing here diagnoses or clears.

-- ------------------------------------------------------- verification

create table if not exists professional_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profession text not null check (profession in ('physiotherapist', 'physician')),
  registration text not null,
  verified_at timestamptz not null default now(),
  verified_by text not null
);

alter table professional_verifications enable row level security;
drop policy if exists "Clinicians read their own verification" on professional_verifications;
create policy "Clinicians read their own verification" on professional_verifications for select using (auth.uid() = user_id);
revoke insert, update, delete on professional_verifications from anon, authenticated;

create or replace function _is_verified_clinician(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from professional_verifications v where v.user_id = p_user)
$$;

create or replace function _issuer(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p_user,
    'name', _display_name(p_user),
    'role', coalesce((select v.profession from professional_verifications v where v.user_id = p_user), 'physiotherapist'),
    'verified', _is_verified_clinician(p_user)
  )
$$;

-- Workouts can come from a rehab plan.
alter table workouts drop constraint if exists workouts_source_check;
alter table workouts add constraint workouts_source_check check (source in ('manual', 'preset', 'import', 'coach', 'rehab'));

-- --------------------------------------------- the athlete's own records

create table if not exists injury_episodes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body_region text not null check (body_region in ('head_neck', 'shoulder', 'elbow', 'wrist_hand', 'upper_back', 'lower_back', 'hip', 'thigh', 'knee', 'lower_leg', 'ankle_foot', 'chest', 'other')),
  laterality text not null check (laterality in ('left', 'right', 'both', 'none')),
  onset_date date,
  onset_type text not null check (onset_type in ('sudden', 'gradual', 'unknown')),
  -- In the athlete's own words; not a diagnosis.
  reported_problem text not null check (length(btrim(reported_problem)) between 1 and 500),
  affected_activities text[] not null default '{}',
  status text not null check (status in ('reported', 'under_assessment', 'rehabilitating', 'paused', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists symptom_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references injury_episodes (id) on delete cascade,
  logged_at timestamptz not null,
  local_date date not null,
  intensity integer not null check (intensity between 0 and 10),
  function_score integer check (function_score between 0 and 10),
  context text,
  red_flags text[] not null default '{}' check (red_flags <@ array['cannot_bear_weight', 'numbness', 'deformity', 'fever']::text[]),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists symptom_logs_episode_idx on symptom_logs (episode_id, logged_at desc);

alter table injury_episodes enable row level security;
alter table symptom_logs enable row level security;
drop policy if exists "Owners manage their injury episodes" on injury_episodes;
create policy "Owners manage their injury episodes" on injury_episodes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owners manage their symptom logs" on symptom_logs;
create policy "Owners manage their symptom logs" on symptom_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------- case-scoped access

create table if not exists rehab_case_access (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references injury_episodes (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  relationship_id uuid not null references professional_relationships (id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists rehab_case_access_one_open on rehab_case_access (episode_id, relationship_id) where revoked_at is null;

-- The professional in an active physiotherapy relationship with open access to this case, if the caller is one.
create or replace function _case_access(p_episode uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id from rehab_case_access c
  join professional_relationships r on r.id = c.relationship_id
  where c.episode_id = p_episode and c.revoked_at is null
    and r.status = 'active' and r.relationship_type = 'physiotherapist' and r.professional_user_id = auth.uid()
  limit 1
$$;

-- ---------------------------------------------------- clinician records

create table if not exists activity_restrictions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references injury_episodes (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  tags text[] not null check (cardinality(tags) > 0 and tags <@ array['running', 'jumping', 'squatting', 'lunging', 'hinging', 'overhead', 'pressing', 'pulling', 'hanging', 'inverted', 'loaded_spine', 'cycling', 'rowing', 'swimming', 'core_flexion']::text[]),
  rule text not null check (rule in ('avoid', 'review_required', 'limit')),
  note text check (note is null or length(note) <= 500),
  issued_by uuid not null references auth.users (id),
  effective_from date not null default current_date,
  expires_on date,
  status text not null default 'active' check (status in ('active', 'lifted')),
  lifted_by uuid references auth.users (id),
  lifted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= effective_from)
);

create table if not exists rehab_plans (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references injury_episodes (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  version integer not null,
  status text not null check (status in ('published', 'retired')),
  content jsonb not null,
  sessions_per_week integer check (sessions_per_week between 1 and 14),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (episode_id, version)
);

create table if not exists rts_decisions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references injury_episodes (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  clinician_id uuid not null references auth.users (id),
  stage text not null check (stage in ('participation', 'sport', 'performance')),
  criteria text not null check (length(btrim(criteria)) between 1 and 2000),
  decided_at timestamptz not null default now()
);

create table if not exists case_notes (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references injury_episodes (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table rehab_case_access enable row level security;
alter table activity_restrictions enable row level security;
alter table rehab_plans enable row level security;
alter table rts_decisions enable row level security;
alter table case_notes enable row level security;

-- Reads only: the athlete sees everything about their own cases; a clinician
-- sees a case only while it is shared with them. Writes go through functions.
drop policy if exists "Athlete and case clinician read access rows" on rehab_case_access;
create policy "Athlete and case clinician read access rows" on rehab_case_access for select using (
  auth.uid() = athlete_id or exists (select 1 from professional_relationships r where r.id = relationship_id and r.professional_user_id = auth.uid())
);
drop policy if exists "Athlete and case clinician read restrictions" on activity_restrictions;
create policy "Athlete and case clinician read restrictions" on activity_restrictions for select using (auth.uid() = athlete_id or _case_access(episode_id) is not null);
drop policy if exists "Athlete and case clinician read rehab plans" on rehab_plans;
create policy "Athlete and case clinician read rehab plans" on rehab_plans for select using (auth.uid() = athlete_id or _case_access(episode_id) is not null);
drop policy if exists "Athlete and case clinician read decisions" on rts_decisions;
create policy "Athlete and case clinician read decisions" on rts_decisions for select using (auth.uid() = athlete_id or _case_access(episode_id) is not null);
drop policy if exists "Athlete and case clinician read notes" on case_notes;
create policy "Athlete and case clinician read notes" on case_notes for select using (auth.uid() = athlete_id or _case_access(episode_id) is not null);

revoke insert, update, delete on rehab_case_access, activity_restrictions, rehab_plans, rts_decisions, case_notes from anon, authenticated;

-- ---------------------------------------------------------- athlete side

create or replace function share_case(p_episode uuid, p_relationship uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from injury_episodes e where e.id = p_episode and e.user_id = uid and e.deleted_at is null) then
    raise exception 'EPISODE_NOT_FOUND';
  end if;
  select * into r from professional_relationships where id = p_relationship;
  if not found or r.athlete_id is distinct from uid or r.status <> 'active' then
    raise exception 'FORBIDDEN';
  end if;
  if r.relationship_type <> 'physiotherapist' then
    raise exception 'ONLY_PHYSIOTHERAPISTS';
  end if;
  if exists (select 1 from rehab_case_access c where c.episode_id = p_episode and c.relationship_id = p_relationship and c.revoked_at is null) then
    return;
  end if;
  insert into rehab_case_access (episode_id, athlete_id, relationship_id) values (p_episode, uid, p_relationship);
  perform _audit(uid, uid, 'case.shared', 'rehab', 'rehabilitation', 'injury_episode', p_episode, jsonb_build_object('relationship_id', p_relationship));
  perform _notify(r.professional_user_id, 'sharing', 'A case was shared with you', _display_name(uid) || ' shared an injury case with you.', 'injury_episode', p_episode);
end $$;

create or replace function revoke_case(p_episode uuid, p_relationship uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update rehab_case_access set revoked_at = now()
  where episode_id = p_episode and relationship_id = p_relationship and athlete_id = uid and revoked_at is null;
  if found then
    perform _audit(uid, uid, 'case.revoked', 'rehab', 'rehabilitation', 'injury_episode', p_episode, jsonb_build_object('relationship_id', p_relationship));
  end if;
end $$;

-- Everything clinicians recorded for the caller's own cases, with who did it and whether they are verified.
create or replace function my_clinical_records()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restrictions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', x.id, 'episode_id', x.episode_id, 'tags', x.tags, 'rule', x.rule, 'note', x.note, 'issuer', _issuer(x.issued_by),
      'effective_from', x.effective_from, 'expires_on', x.expires_on, 'status', x.status, 'lifted_at', x.lifted_at, 'created_at', x.created_at
    ) order by x.created_at) from activity_restrictions x where x.athlete_id = auth.uid()), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'episode_id', p.episode_id, 'version', p.version, 'status', p.status, 'content', p.content,
      'sessions_per_week', p.sessions_per_week, 'notes', p.notes, 'author', _issuer(p.author_id), 'created_at', p.created_at
    ) order by p.created_at) from rehab_plans p where p.athlete_id = auth.uid()), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'episode_id', d.episode_id, 'stage', d.stage, 'criteria', d.criteria, 'clinician', _issuer(d.clinician_id), 'decided_at', d.decided_at
    ) order by d.decided_at) from rts_decisions d where d.athlete_id = auth.uid()), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', n.id, 'episode_id', n.episode_id, 'body', n.body, 'author', _issuer(n.author_id), 'created_at', n.created_at
    ) order by n.created_at) from case_notes n where n.athlete_id = auth.uid()), '[]'::jsonb)
  )
$$;

-- --------------------------------------------------------- clinician side

-- The cases shared with the caller. Opening them is logged in the athlete's access log.
create or replace function list_cases()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c record;
  v_out jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  for c in
    select e.*, a.relationship_id from rehab_case_access a
    join professional_relationships r on r.id = a.relationship_id
    join injury_episodes e on e.id = a.episode_id
    where a.revoked_at is null and r.status = 'active' and r.relationship_type = 'physiotherapist' and r.professional_user_id = uid and e.deleted_at is null
    order by e.updated_at desc
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'episode', jsonb_build_object('id', c.id, 'body_region', c.body_region, 'laterality', c.laterality, 'onset_date', c.onset_date, 'onset_type', c.onset_type,
        'reported_problem', c.reported_problem, 'affected_activities', c.affected_activities, 'status', c.status, 'updated_at', c.updated_at),
      'athlete', jsonb_build_object('id', c.user_id, 'name', _display_name(c.user_id)),
      'relationship_id', c.relationship_id,
      'symptoms', coalesce((select jsonb_agg(jsonb_build_object('logged_at', s.logged_at, 'intensity', s.intensity, 'function_score', s.function_score,
          'context', s.context, 'red_flags', s.red_flags, 'note', s.note) order by s.logged_at desc)
        from (select * from symptom_logs where episode_id = c.id and deleted_at is null and logged_at > now() - interval '90 days' order by logged_at desc limit 200) s), '[]'::jsonb),
      'restrictions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'episode_id', x.episode_id, 'tags', x.tags, 'rule', x.rule, 'note', x.note, 'issuer', _issuer(x.issued_by),
          'effective_from', x.effective_from, 'expires_on', x.expires_on, 'status', x.status, 'lifted_at', x.lifted_at, 'created_at', x.created_at) order by x.created_at)
        from activity_restrictions x where x.episode_id = c.id), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'episode_id', p.episode_id, 'version', p.version, 'status', p.status, 'content', p.content,
          'sessions_per_week', p.sessions_per_week, 'notes', p.notes, 'author', _issuer(p.author_id), 'created_at', p.created_at) order by p.version)
        from rehab_plans p where p.episode_id = c.id), '[]'::jsonb),
      'decisions', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'episode_id', d.episode_id, 'stage', d.stage, 'criteria', d.criteria, 'clinician', _issuer(d.clinician_id), 'decided_at', d.decided_at) order by d.decided_at)
        from rts_decisions d where d.episode_id = c.id), '[]'::jsonb),
      'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'episode_id', n.episode_id, 'body', n.body, 'author', _issuer(n.author_id), 'created_at', n.created_at) order by n.created_at)
        from case_notes n where n.episode_id = c.id), '[]'::jsonb)
    ));
    perform _audit(uid, c.user_id, 'data.read', 'rehab', 'rehabilitation', 'injury_episode', c.id, '{}');
  end loop;
  return jsonb_build_object('cases', v_out, 'verified', _is_verified_clinician(uid));
end $$;

create or replace function add_restriction(p_episode uuid, p_tags text[], p_rule text, p_note text default null, p_expires_on date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_athlete uuid;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if _case_access(p_episode) is null then
    raise exception 'FORBIDDEN';
  end if;
  if p_expires_on is not null and p_expires_on < current_date then
    raise exception 'DATE_IN_PAST';
  end if;
  select user_id into v_athlete from injury_episodes where id = p_episode;
  insert into activity_restrictions (episode_id, athlete_id, tags, rule, note, issued_by, expires_on)
  values (p_episode, v_athlete, p_tags, p_rule, nullif(btrim(coalesce(p_note, '')), ''), uid, p_expires_on)
  returning id into v_id;
  perform _audit(uid, v_athlete, 'restriction.added', 'rehab', 'rehabilitation', 'activity_restriction', v_id, jsonb_build_object('rule', p_rule));
  perform _notify(v_athlete, 'training', 'New restriction from ' || _display_name(uid), 'Your workouts are checked against it from now on.', 'activity_restriction', v_id);
  return v_id;
end $$;

-- Only a clinician with access to the case lifts a clinician restriction; the athlete cannot.
create or replace function lift_restriction(p_restriction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  x activity_restrictions%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into x from activity_restrictions where id = p_restriction for update;
  if not found or _case_access(x.episode_id) is null then
    raise exception 'FORBIDDEN';
  end if;
  if x.status = 'lifted' then
    return;
  end if;
  update activity_restrictions set status = 'lifted', lifted_by = uid, lifted_at = now() where id = x.id;
  perform _audit(uid, x.athlete_id, 'restriction.lifted', 'rehab', 'rehabilitation', 'activity_restriction', x.id, '{}');
  perform _notify(x.athlete_id, 'training', 'A restriction was lifted', _display_name(uid) || ' lifted a restriction on your training.', 'activity_restriction', x.id);
end $$;

create or replace function publish_rehab_plan(p_episode uuid, p_content jsonb, p_sessions_per_week integer default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_athlete uuid;
  v_version integer;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if _case_access(p_episode) is null then
    raise exception 'FORBIDDEN';
  end if;
  if jsonb_typeof(p_content -> 'blocks') <> 'array' or jsonb_array_length(p_content -> 'blocks') = 0 or coalesce(btrim(p_content ->> 'title'), '') = '' then
    raise exception 'PLAN_INVALID';
  end if;
  select user_id into v_athlete from injury_episodes where id = p_episode;
  select coalesce(max(version), 0) + 1 into v_version from rehab_plans where episode_id = p_episode;
  update rehab_plans set status = 'retired' where episode_id = p_episode and status = 'published';
  insert into rehab_plans (episode_id, athlete_id, author_id, version, status, content, sessions_per_week, notes)
  values (p_episode, v_athlete, uid, v_version, 'published', p_content, p_sessions_per_week, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  perform _audit(uid, v_athlete, 'rehab_plan.published', 'rehab', 'rehabilitation', 'rehab_plan', v_id, jsonb_build_object('version', v_version));
  perform _notify(v_athlete, 'training', 'New rehab plan from ' || _display_name(uid), 'Open your case to see it and add sessions to your calendar.', 'rehab_plan', v_id);
  return v_id;
end $$;

create or replace function add_case_note(p_episode uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_athlete uuid;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if _case_access(p_episode) is null then
    raise exception 'FORBIDDEN';
  end if;
  select user_id into v_athlete from injury_episodes where id = p_episode;
  insert into case_notes (episode_id, athlete_id, author_id, body) values (p_episode, v_athlete, uid, btrim(coalesce(p_body, ''))) returning id into v_id;
  perform _notify(v_athlete, 'training', 'Note from ' || _display_name(uid), 'A review note was added to your case.', 'case_note', v_id);
  return v_id;
end $$;

-- A return-to-sport decision is a clinician's act: verified clinicians only, with the criteria written down.
create or replace function record_rts_decision(p_episode uuid, p_stage text, p_criteria text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_athlete uuid;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if _case_access(p_episode) is null then
    raise exception 'FORBIDDEN';
  end if;
  if not _is_verified_clinician(uid) then
    raise exception 'CLINICIAN_NOT_VERIFIED';
  end if;
  if coalesce(btrim(p_criteria), '') = '' then
    raise exception 'CRITERIA_REQUIRED';
  end if;
  select user_id into v_athlete from injury_episodes where id = p_episode;
  insert into rts_decisions (episode_id, athlete_id, clinician_id, stage, criteria) values (p_episode, v_athlete, uid, p_stage, btrim(p_criteria)) returning id into v_id;
  perform _audit(uid, v_athlete, 'rts.decided', 'rehab', 'rehabilitation', 'rts_decision', v_id, jsonb_build_object('stage', p_stage));
  perform _notify(v_athlete, 'training', 'Return-to-sport update', _display_name(uid) || ' recorded a decision on your case.', 'rts_decision', v_id);
  return v_id;
end $$;

-- ------------------------------------------------------------- sharing

-- A coach can be allowed to see the limits on training, never the injury itself.
insert into data_categories (id, label, description, sensitivity, available, position)
values ('functional_restriction', 'Training limits', 'Which kinds of movement to avoid or limit, and until when. Not the injury, the body part or any notes.', 'sensitive', true, 10)
on conflict (id) do update set label = excluded.label, description = excluded.description, sensitivity = excluded.sensitivity, available = true;

update data_categories set description = 'Injury cases are shared one at a time, from the case itself.' where id = 'rehab';

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

  -- Daily recovery summaries: status, which signals and what the athlete chose. Never measured values.
  if has_grant(p_athlete, 'recovery_summary', 'read') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'local_date', d.local_date, 'status', d.status, 'signals', d.signals,
      'choice', d.decision ->> 'option', 'rule_version', d.rule_version
    ) order by d.local_date desc), '[]'::jsonb) into v_rows
    from (select * from daily_recovery
          where user_id = p_athlete and deleted_at is null and local_date > current_date - 28
          order by local_date desc) d;
    v_result := v_result || jsonb_build_object('recovery_summary', v_rows);
    v_granted := array_append(v_granted, 'recovery_summary');
    perform _audit(uid, p_athlete, 'data.read', 'recovery_summary', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows)));
  end if;

  -- Training limits only: which movement kinds, how, until when, and by whom. No injury, body part or notes.
  if has_grant(p_athlete, 'functional_restriction', 'read') then
    select jsonb_build_object(
      'restrictions', coalesce((select jsonb_agg(jsonb_build_object(
          'tags', x.tags, 'rule', x.rule, 'effective_from', x.effective_from, 'expires_on', x.expires_on,
          'issued_by_role', coalesce((select v.profession from professional_verifications v where v.user_id = x.issued_by), 'physiotherapist')
        ) order by x.created_at)
        from activity_restrictions x
        where x.athlete_id = p_athlete and x.status = 'active' and (x.expires_on is null or x.expires_on >= current_date)), '[]'::jsonb),
      'self_noted', coalesce((select jsonb_agg(distinct t) from injury_episodes e, unnest(e.affected_activities) t
        where e.user_id = p_athlete and e.deleted_at is null and e.status <> 'resolved'), '[]'::jsonb)
    ) into v_rows;
    v_result := v_result || jsonb_build_object('functional_restriction', v_rows);
    v_granted := array_append(v_granted, 'functional_restriction');
    perform _audit(uid, p_athlete, 'data.read', 'functional_restriction', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows -> 'restrictions')));
  end if;

  return v_result || jsonb_build_object('granted', to_jsonb(v_granted));
end $$;

-- As before; cases shared with a physiotherapist close with the relationship too.
create or replace function end_relationship(p_relationship uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  g record;
  v_other uuid;
  v_cancelled integer;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships where id = p_relationship for update;
  if not found or (r.athlete_id is distinct from uid and r.professional_user_id is distinct from uid) then
    raise exception 'FORBIDDEN';
  end if;
  if r.status = 'ended' then
    return;
  end if;

  for g in select id, data_category, purpose from data_share_grants where relationship_id = r.id and status = 'active' loop
    update data_share_grants set status = 'revoked', revoked_at = now() where id = g.id;
    perform _audit(uid, r.athlete_id, 'grant.revoked', g.data_category, g.purpose, 'data_share_grant', g.id,
      jsonb_build_object('relationship_id', r.id, 'reason', 'relationship_ended'));
    perform _emit('DataGrantRevoked', 'consent', r.athlete_id, 'data_share_grant', g.id);
  end loop;

  update workout_assignments set status = 'cancelled', decided_at = now() where relationship_id = r.id and status = 'pending';
  get diagnostics v_cancelled = row_count;

  -- Cases shared with a physiotherapist close with the relationship.
  update rehab_case_access set revoked_at = now() where relationship_id = r.id and revoked_at is null;

  update professional_relationships
  set status = 'ended', ended_at = now(), ended_by = uid, invite_code = null, invite_expires_at = null
  where id = r.id;

  perform _audit(uid, r.athlete_id, 'relationship.ended', null, _purpose_for(r.relationship_type), 'professional_relationship', r.id,
    jsonb_build_object('assignments_cancelled', v_cancelled));
  perform _emit('RelationshipEnded', 'consent', r.athlete_id, 'professional_relationship', r.id);

  v_other := case when uid = r.athlete_id then r.professional_user_id else r.athlete_id end;
  perform _notify(v_other, 'sharing', 'Connection ended',
    _display_name(uid) || ' ended the connection. Nothing further is shared.',
    'professional_relationship', r.id);
end $$;

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

-- ------------------------------------------------------------- grants

revoke all on function share_case(uuid, uuid) from public, anon;
grant execute on function share_case(uuid, uuid) to authenticated;
revoke all on function revoke_case(uuid, uuid) from public, anon;
grant execute on function revoke_case(uuid, uuid) to authenticated;
revoke all on function my_clinical_records() from public, anon;
grant execute on function my_clinical_records() to authenticated;
revoke all on function list_cases() from public, anon;
grant execute on function list_cases() to authenticated;
revoke all on function add_restriction(uuid, text[], text, text, date) from public, anon;
grant execute on function add_restriction(uuid, text[], text, text, date) to authenticated;
revoke all on function lift_restriction(uuid) from public, anon;
grant execute on function lift_restriction(uuid) to authenticated;
revoke all on function publish_rehab_plan(uuid, jsonb, integer, text) from public, anon;
grant execute on function publish_rehab_plan(uuid, jsonb, integer, text) to authenticated;
revoke all on function add_case_note(uuid, text) from public, anon;
grant execute on function add_case_note(uuid, text) to authenticated;
revoke all on function record_rts_decision(uuid, text, text) from public, anon;
grant execute on function record_rts_decision(uuid, text, text) to authenticated;
revoke all on function _is_verified_clinician(uuid) from public, anon;
revoke all on function _issuer(uuid) from public, anon;
revoke all on function _case_access(uuid) from public, anon;
