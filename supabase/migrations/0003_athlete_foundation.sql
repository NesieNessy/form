-- FORM — Athlete Intelligence Foundation (roadmap Step 2)
--
-- Run AFTER 0002_workout_core.sql. Safe to run more than once.
--
-- The athlete is the only principal who can read their own data through the
-- tables. Anyone else reads it through get_shared_context(), which returns
-- only the data categories the athlete has granted and writes an audit event
-- for each one. Access is therefore deny-by-default, enforced where the data
-- is queried, and every professional read leaves a record.
--
-- Relationships, grants, audit events and domain events are written only by
-- the functions below; clients have no direct write access to those tables.

-- ---------------------------------------------------------------- profile

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sports text[] not null default '{}',
  equipment text[] not null default '{}',
  -- Days the athlete can usually train: 0 = Sunday ... 6 = Saturday.
  available_days smallint[] not null default '{}',
  minutes_per_session integer check (minutes_per_session is null or minutes_per_session > 0),
  weekly_session_target integer not null default 5 check (weekly_session_target between 1 and 21),
  updated_at timestamptz not null default now()
);

-- Reference values such as a one-rep max or FTP. Each row is one measurement;
-- history is kept, and the newest by date is the current value.
create table if not exists benchmarks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('one_rep_max', 'ftp', 'threshold_pace', 'max_heart_rate', 'css_pace')),
  activity_id text references activities (id),
  value numeric not null check (value > 0),
  unit text not null check (unit in ('kg', 'w', 'sec_per_km', 'bpm', 'sec_per_100m')),
  measured_on date not null,
  source text not null default 'manual' check (source in ('manual', 'test', 'estimate', 'session')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (kind <> 'one_rep_max' or activity_id is not null)
);

create index if not exists benchmarks_user_idx on benchmarks (user_id, kind, measured_on);

-- ------------------------------------------------------- data categories

-- What can be shared, one consent decision per category. `available` marks
-- the categories that have data behind them today; the rest arrive with the
-- wearable, nutrition, rehabilitation and video modules.
create table if not exists data_categories (
  id text primary key,
  label text not null,
  description text not null,
  sensitivity text not null check (sensitivity in ('standard', 'sensitive')),
  available boolean not null default false,
  position integer not null
);

insert into data_categories (id, label, description, sensitivity, available, position) values
  ('profile', 'Profile', 'Your sports, equipment and usual training days.', 'standard', true, 1),
  ('benchmarks', 'Benchmarks', 'Reference values such as one-rep maxes, FTP and threshold pace.', 'standard', true, 2),
  ('workout_plan', 'Workout plans', 'The workouts on your calendar and what they prescribe.', 'standard', true, 3),
  ('workout_session', 'Session results', 'What you actually did: times, loads, rounds, effort and notes.', 'standard', true, 4),
  ('performance_summary', 'Performance summary', 'Counts and totals only, such as sessions completed per month.', 'standard', true, 5),
  ('wearable_summary', 'Wearable summaries', 'Daily summaries from connected devices.', 'sensitive', false, 6),
  ('wearable_raw', 'Wearable raw data', 'Individual measurements such as heart rate, HRV and sleep.', 'sensitive', false, 7),
  ('nutrition_log', 'Food log', 'Meals, drinks and training fuel you have logged.', 'sensitive', false, 8),
  ('nutrition_target', 'Nutrition targets', 'Your nutrition targets and plans.', 'sensitive', false, 9),
  ('rehab', 'Injury and rehab records', 'Injury episodes, restrictions and rehab progress.', 'sensitive', false, 10),
  ('video', 'Video', 'Movement clips you have recorded.', 'sensitive', false, 11),
  ('communications', 'Messages', 'Messages between you and your professionals.', 'standard', false, 12),
  ('professional_notes', 'Professional notes', 'Notes a professional has written about you.', 'sensitive', false, 13)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  sensitivity = excluded.sensitivity,
  available = excluded.available,
  position = excluded.position;

-- ------------------------------------------- organizations (skeleton)

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  kind text not null check (kind in ('studio', 'clinic', 'team')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Membership grants operational roles only. It never implies access to a
-- member's personal data; that always needs a grant from the athlete.
create table if not exists organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'coach', 'physiotherapist', 'instructor', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ------------------------------------------- relationships and grants

create table if not exists professional_relationships (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  professional_user_id uuid references auth.users (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('training_coach', 'physiotherapist', 'dietitian')),
  organization_id uuid references organizations (id) on delete set null,
  invitee_email text not null,
  invite_code text unique,
  invite_expires_at timestamptz,
  status text not null check (status in ('invited', 'active', 'ended')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  ended_by uuid,
  check (status <> 'active' or professional_user_id is not null)
);

create index if not exists relationships_athlete_idx on professional_relationships (athlete_id);
create index if not exists relationships_professional_idx on professional_relationships (professional_user_id);

-- One row is one consent decision: this recipient, this athlete, this
-- category, this purpose, these operations, until this date. Rows are never
-- edited; withdrawing consent marks the row revoked.
create table if not exists data_share_grants (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  relationship_id uuid not null references professional_relationships (id) on delete cascade,
  data_category text not null references data_categories (id),
  actions text[] not null default '{read}',
  purpose text not null,
  effective_from timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  consent_version text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists grants_one_active_per_category
  on data_share_grants (relationship_id, data_category) where status = 'active';
create index if not exists grants_athlete_idx on data_share_grants (athlete_id);

-- ------------------------------------------------ audit and events

-- Who did what to whose data, and why. Identifiers and counts only, never
-- the data itself. No foreign keys: the record must outlive the accounts.
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  subject_athlete_id uuid,
  action text not null,
  data_category text,
  purpose text,
  entity_type text,
  entity_id uuid,
  detail jsonb not null default '{}'
);

create index if not exists audit_subject_idx on audit_events (subject_athlete_id, occurred_at desc);

-- Outbox of things that happened, for later consumers (notifications, AI
-- workflows, analytics). Carries references, never sensitive content.
create table if not exists domain_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  schema_version integer not null default 1,
  occurred_at timestamptz not null default now(),
  producer text not null,
  subject_id uuid,
  entity_type text,
  entity_id uuid,
  trace_id text,
  processed_at timestamptz
);

create index if not exists domain_events_unprocessed_idx on domain_events (occurred_at) where processed_at is null;

-- ------------------------------------------------------ notifications

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Local times between which nothing should be pushed; both null means no quiet hours.
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'UTC',
  muted_categories text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('sharing', 'training', 'account')),
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requested_at timestamptz not null default now()
);

-- ------------------------------------------------------ row-level security

alter table profiles enable row level security;
alter table benchmarks enable row level security;
alter table data_categories enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table professional_relationships enable row level security;
alter table data_share_grants enable row level security;
alter table audit_events enable row level security;
alter table domain_events enable row level security;
alter table notification_preferences enable row level security;
alter table notifications enable row level security;
alter table account_deletions enable row level security;

drop policy if exists "Owners manage their profile" on profiles;
create policy "Owners manage their profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners manage their benchmarks" on benchmarks;
create policy "Owners manage their benchmarks" on benchmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Signed-in users read the category list" on data_categories;
create policy "Signed-in users read the category list" on data_categories
  for select to authenticated using (true);

create or replace function is_org_member(p_org uuid, p_admin_only boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid()
      and (not p_admin_only or m.role in ('owner', 'manager'))
  )
$$;

drop policy if exists "Members read their organization" on organizations;
create policy "Members read their organization" on organizations
  for select using (is_org_member(id, false));

drop policy if exists "Members read their own membership, admins read all" on organization_members;
create policy "Members read their own membership, admins read all" on organization_members
  for select using (user_id = auth.uid() or is_org_member(organization_id, true));

drop policy if exists "Both parties read their relationship" on professional_relationships;
create policy "Both parties read their relationship" on professional_relationships
  for select using (auth.uid() = athlete_id or auth.uid() = professional_user_id);

drop policy if exists "Athlete and recipient read a grant" on data_share_grants;
create policy "Athlete and recipient read a grant" on data_share_grants
  for select using (
    auth.uid() = athlete_id
    or exists (
      select 1 from professional_relationships r
      where r.id = relationship_id and r.professional_user_id = auth.uid()
    )
  );

drop policy if exists "Subjects and actors read their audit events" on audit_events;
create policy "Subjects and actors read their audit events" on audit_events
  for select using (auth.uid() = subject_athlete_id or auth.uid() = actor_user_id);

drop policy if exists "Owners manage their notification preferences" on notification_preferences;
create policy "Owners manage their notification preferences" on notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners read their notifications" on notifications;
create policy "Owners read their notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Owners mark their notifications read" on notifications;
create policy "Owners mark their notifications read" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert, update, delete on data_categories, organizations, organization_members,
  professional_relationships, data_share_grants, audit_events from anon, authenticated;
revoke all on domain_events, account_deletions from anon, authenticated;
revoke insert, update, delete on notifications from anon, authenticated;
grant update (read_at) on notifications to authenticated;
-- The invite code is a secret between the athlete and whoever they hand it to.
revoke select on professional_relationships from anon, authenticated;
grant select (
  id, athlete_id, professional_user_id, relationship_type, organization_id, invitee_email,
  invite_expires_at, status, created_at, accepted_at, ended_at, ended_by
) on professional_relationships to authenticated;

-- The audit trail is append-only for everyone, including the table owner.
create or replace function _audit_is_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_IMMUTABLE: audit events cannot be changed or removed';
end $$;

drop trigger if exists audit_events_immutable on audit_events;
create trigger audit_events_immutable before update or delete on audit_events
  for each row execute function _audit_is_immutable();

-- -------------------------------------------------------- internal helpers

create or replace function _audit(
  p_actor uuid, p_subject uuid, p_action text, p_category text, p_purpose text,
  p_entity_type text, p_entity_id uuid, p_detail jsonb
) returns void language sql security definer set search_path = public as $$
  insert into audit_events (actor_user_id, subject_athlete_id, action, data_category, purpose, entity_type, entity_id, detail)
  values (p_actor, p_subject, p_action, p_category, p_purpose, p_entity_type, p_entity_id, coalesce(p_detail, '{}'::jsonb))
$$;

create or replace function _emit(p_type text, p_producer text, p_subject uuid, p_entity_type text, p_entity_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into domain_events (event_type, producer, subject_id, entity_type, entity_id)
  values (p_type, p_producer, p_subject, p_entity_type, p_entity_id)
$$;

create or replace function _notify(p_user uuid, p_category text, p_title text, p_body text, p_entity_type text, p_entity_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then
    return;
  end if;
  if exists (select 1 from notification_preferences np where np.user_id = p_user and p_category = any (np.muted_categories)) then
    return;
  end if;
  insert into notifications (user_id, category, title, body, entity_type, entity_id)
  values (p_user, p_category, p_title, p_body, p_entity_type, p_entity_id);
end $$;

create or replace function _display_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(btrim((select display_name from profiles where user_id = p_user)), ''),
    (select email from auth.users where id = p_user)
  )
$$;

create or replace function _purpose_for(p_relationship_type text)
returns text language sql immutable as $$
  select case p_relationship_type
    when 'training_coach' then 'training_coaching'
    when 'physiotherapist' then 'rehabilitation'
    when 'dietitian' then 'nutrition_coaching'
  end
$$;

-- True when the caller currently holds an effective grant for this athlete,
-- category and operation. The single place the sharing rule is decided.
create or replace function has_grant(p_athlete uuid, p_category text, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from data_share_grants g
    join professional_relationships r on r.id = g.relationship_id
    where g.athlete_id = p_athlete
      and r.athlete_id = p_athlete
      and r.professional_user_id = auth.uid()
      and r.status = 'active'
      and g.status = 'active'
      and g.data_category = p_category
      and p_action = any (g.actions)
      and g.effective_from <= now()
      and (g.expires_at is null or g.expires_at > now())
  )
$$;

-- ------------------------------------------------------- domain events

create or replace function _on_scheduled_workout() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _emit('WorkoutScheduled', 'workout-core', new.user_id, 'scheduled_workout', new.id);
  return new;
end $$;

drop trigger if exists scheduled_workouts_event on scheduled_workouts;
create trigger scheduled_workouts_event after insert on scheduled_workouts
  for each row execute function _on_scheduled_workout();

create or replace function _on_session_completed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform _emit('WorkoutCompleted', 'workout-core', new.user_id, 'completed_session', new.id);
  end if;
  return new;
end $$;

drop trigger if exists sessions_event on sessions;
create trigger sessions_event after insert or update on sessions
  for each row execute function _on_session_completed();

create or replace function _on_benchmark_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _emit('AthleteBenchmarkUpdated', 'athlete-profile', new.user_id, 'benchmark', new.id);
  return new;
end $$;

drop trigger if exists benchmarks_event on benchmarks;
create trigger benchmarks_event after insert or update on benchmarks
  for each row execute function _on_benchmark_changed();

-- ----------------------------------------------- relationships and grants

-- The athlete invites a professional by email and gets a code to pass on.
-- Accepting needs both the code and an account with that email address.
create or replace function invite_professional(p_email text, p_relationship_type text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_expires timestamptz := now() + interval '14 days';
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;
  if _purpose_for(p_relationship_type) is null then
    raise exception 'INVALID_RELATIONSHIP_TYPE';
  end if;
  if v_email = lower((select email from auth.users where id = uid)) then
    raise exception 'CANNOT_INVITE_YOURSELF';
  end if;
  if exists (
    select 1 from professional_relationships r
    where r.athlete_id = uid and r.invitee_email = v_email
      and r.relationship_type = p_relationship_type and r.status in ('invited', 'active')
  ) then
    raise exception 'ALREADY_INVITED';
  end if;

  insert into professional_relationships (athlete_id, relationship_type, invitee_email, invite_code, invite_expires_at, status)
  values (uid, p_relationship_type, v_email, v_code, v_expires, 'invited')
  returning id into v_id;

  perform _audit(uid, uid, 'relationship.invited', null, _purpose_for(p_relationship_type), 'professional_relationship', v_id, '{}');
  return jsonb_build_object('relationship_id', v_id, 'invite_code', v_code, 'expires_at', v_expires);
end $$;

create or replace function accept_relationship_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_email text;
  r professional_relationships%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select lower(email) into v_email from auth.users where id = uid;

  select * into r from professional_relationships
  where invite_code = upper(btrim(coalesce(p_code, ''))) and status = 'invited'
  for update;

  -- One answer for every way this can fail, so a code cannot be probed.
  if not found or r.invite_expires_at < now() or r.invitee_email <> v_email or r.athlete_id = uid then
    raise exception 'INVITE_NOT_VALID';
  end if;

  update professional_relationships
  set professional_user_id = uid, status = 'active', accepted_at = now(), invite_code = null, invite_expires_at = null
  where id = r.id;

  perform _audit(uid, r.athlete_id, 'relationship.accepted', null, _purpose_for(r.relationship_type), 'professional_relationship', r.id, '{}');
  perform _notify(r.athlete_id, 'sharing', 'Invitation accepted',
    _display_name(uid) || ' accepted your invitation. They can see only what you choose to share.',
    'professional_relationship', r.id);
  return r.id;
end $$;

create or replace function create_grant(p_relationship uuid, p_category text, p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships where id = p_relationship;
  if not found or r.athlete_id <> uid then
    raise exception 'FORBIDDEN';
  end if;
  if r.status = 'ended' then
    raise exception 'RELATIONSHIP_ENDED';
  end if;
  if not exists (select 1 from data_categories c where c.id = p_category and c.available) then
    raise exception 'CATEGORY_NOT_AVAILABLE';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'EXPIRY_IN_PAST';
  end if;

  select id into v_id from data_share_grants
  where relationship_id = p_relationship and data_category = p_category and status = 'active';
  if found then
    return v_id;
  end if;

  insert into data_share_grants (athlete_id, relationship_id, data_category, actions, purpose, expires_at, consent_version)
  values (uid, p_relationship, p_category, '{read}', _purpose_for(r.relationship_type), p_expires_at, 'v1')
  returning id into v_id;

  perform _audit(uid, uid, 'grant.created', p_category, _purpose_for(r.relationship_type), 'data_share_grant', v_id,
    jsonb_build_object('consent_version', 'v1', 'expires_at', p_expires_at, 'relationship_id', p_relationship));
  perform _emit('DataGrantCreated', 'consent', uid, 'data_share_grant', v_id);
  return v_id;
end $$;

create or replace function revoke_grant(p_grant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g data_share_grants%rowtype;
  r professional_relationships%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into g from data_share_grants where id = p_grant;
  if not found or g.athlete_id <> uid then
    raise exception 'FORBIDDEN';
  end if;
  if g.status = 'revoked' then
    return;
  end if;
  select * into r from professional_relationships where id = g.relationship_id;

  update data_share_grants set status = 'revoked', revoked_at = now() where id = p_grant;

  perform _audit(uid, uid, 'grant.revoked', g.data_category, g.purpose, 'data_share_grant', p_grant,
    jsonb_build_object('relationship_id', g.relationship_id));
  perform _emit('DataGrantRevoked', 'consent', uid, 'data_share_grant', p_grant);
  perform _notify(r.professional_user_id, 'sharing', 'Sharing changed',
    _display_name(uid) || ' stopped sharing ' || lower((select label from data_categories where id = g.data_category)) || ' with you.',
    'professional_relationship', r.id);
end $$;

-- Either party can end the relationship. All its grants are withdrawn in the
-- same step, so access stops for the very next request.
create or replace function end_relationship(p_relationship uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  g record;
  v_other uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships where id = p_relationship for update;
  if not found or (r.athlete_id <> uid and r.professional_user_id is distinct from uid) then
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

  update professional_relationships
  set status = 'ended', ended_at = now(), ended_by = uid, invite_code = null, invite_expires_at = null
  where id = r.id;

  perform _audit(uid, r.athlete_id, 'relationship.ended', null, _purpose_for(r.relationship_type), 'professional_relationship', r.id, '{}');
  perform _emit('RelationshipEnded', 'consent', r.athlete_id, 'professional_relationship', r.id);

  v_other := case when uid = r.athlete_id then r.professional_user_id else r.athlete_id end;
  perform _notify(v_other, 'sharing', 'Connection ended',
    _display_name(uid) || ' ended the connection. Nothing further is shared.',
    'professional_relationship', r.id);
end $$;

-- Everything the caller needs to show their sharing screen, in both
-- directions. The invite code is returned only to the athlete who made it.
create or replace function list_relationships()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  from (
    select
      r.created_at,
      jsonb_build_object(
        'id', r.id,
        'role', case when r.athlete_id = auth.uid() then 'athlete' else 'professional' end,
        'relationship_type', r.relationship_type,
        'status', r.status,
        'counterpart_name', case
          when r.athlete_id = auth.uid() then coalesce(_display_name(r.professional_user_id), r.invitee_email)
          else _display_name(r.athlete_id)
        end,
        'athlete_id', r.athlete_id,
        'invitee_email', case when r.athlete_id = auth.uid() then r.invitee_email end,
        'invite_code', case when r.athlete_id = auth.uid() and r.status = 'invited' then r.invite_code end,
        'invite_expires_at', case when r.athlete_id = auth.uid() and r.status = 'invited' then r.invite_expires_at end,
        'created_at', r.created_at,
        'accepted_at', r.accepted_at,
        'ended_at', r.ended_at,
        'grants', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', g.id, 'data_category', g.data_category, 'actions', g.actions, 'purpose', g.purpose,
            'effective_from', g.effective_from, 'expires_at', g.expires_at, 'consent_version', g.consent_version
          ) order by g.created_at)
          from data_share_grants g
          where g.relationship_id = r.id and g.status = 'active' and (g.expires_at is null or g.expires_at > now())
        ), '[]'::jsonb)
      ) as item
    from professional_relationships r
    where r.athlete_id = auth.uid() or r.professional_user_id = auth.uid()
  ) rows
$$;

-- ---------------------------------------------------- shared-data access

-- The only way anyone other than the athlete reads the athlete's data.
-- Returns just the granted categories and records one audit event for each.
-- Version and session rows use the same shape the athlete's own app reads.
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

  return v_result || jsonb_build_object('granted', to_jsonb(v_granted));
end $$;

-- "Who accessed my data": every recorded event about the caller, newest first.
create or replace function my_data_access_log(p_limit integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(item order by occurred_at desc), '[]'::jsonb)
  from (
    select a.occurred_at,
      jsonb_build_object(
        'id', a.id, 'occurred_at', a.occurred_at, 'action', a.action, 'data_category', a.data_category,
        'purpose', a.purpose, 'by_me', a.actor_user_id = auth.uid(),
        'actor_name', case when a.actor_user_id = auth.uid() then null else _display_name(a.actor_user_id) end,
        'rows', a.detail -> 'rows'
      ) as item
    from audit_events a
    where a.subject_athlete_id = auth.uid()
    order by a.occurred_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) events
$$;

-- ------------------------------------------------- export and deletion

-- Everything stored about the caller, in one document.
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
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(x)) from body_metrics x where x.user_id = uid), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(x)) from goals x where x.user_id = uid), '[]'::jsonb),
    'sharing', jsonb_build_object(
      'relationships', coalesce((
        select jsonb_agg(to_jsonb(r) - 'invite_code') from professional_relationships r
        where r.athlete_id = uid or r.professional_user_id = uid), '[]'::jsonb),
      'grants', coalesce((select jsonb_agg(to_jsonb(g)) from data_share_grants g where g.athlete_id = uid), '[]'::jsonb)
    ),
    'access_log', coalesce((select jsonb_agg(to_jsonb(a)) from audit_events a where a.subject_athlete_id = uid), '[]'::jsonb),
    'notification_preferences', (select to_jsonb(np) from notification_preferences np where np.user_id = uid)
  ) into v;

  perform _audit(uid, uid, 'data.exported', null, 'data_portability', null, null, '{}');
  return v;
end $$;

-- Ends every connection, then removes the account. Every table that holds
-- the athlete's data references the account with ON DELETE CASCADE, so
-- nothing personal is left behind. The audit trail keeps identifiers only.
create or replace function delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  for r in
    select id from professional_relationships
    where (athlete_id = uid or professional_user_id = uid) and status <> 'ended'
  loop
    perform end_relationship(r.id);
  end loop;

  insert into account_deletions (user_id) values (uid);
  perform _audit(uid, uid, 'account.deleted', null, 'erasure', null, null, '{}');
  delete from auth.users where id = uid;
end $$;

create or replace function create_organization(p_name text, p_kind text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into organizations (name, kind, created_by) values (btrim(p_name), p_kind, uid) returning id into v_id;
  insert into organization_members (organization_id, user_id, role) values (v_id, uid, 'owner');
  return v_id;
end $$;

-- --------------------------------------------------- function privileges

do $$
declare
  fn text;
begin
  -- Internal: callable only from other functions here, never by a client.
  foreach fn in array array[
    '_audit(uuid, uuid, text, text, text, text, uuid, jsonb)',
    '_emit(text, text, uuid, text, uuid)',
    '_notify(uuid, text, text, text, text, uuid)',
    '_display_name(uuid)',
    '_on_scheduled_workout()',
    '_on_session_completed()',
    '_on_benchmark_changed()',
    '_audit_is_immutable()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;

  foreach fn in array array[
    'invite_professional(text, text)',
    'accept_relationship_invite(text)',
    'create_grant(uuid, text, timestamptz)',
    'revoke_grant(uuid)',
    'end_relationship(uuid)',
    'list_relationships()',
    'get_shared_context(uuid)',
    'my_data_access_log(integer)',
    'export_my_data()',
    'delete_my_account()',
    'create_organization(text, text)',
    'has_grant(uuid, text, text)',
    'is_org_member(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
