-- FORM — coach beta (roadmap Step 6)
--
-- Run AFTER 0008_meal_parsing.sql. Safe to run more than once.
--
-- 1. A professional can invite an athlete (until now only the athlete could
--    invite). Whoever is invited accepts with the code and an account under
--    the invited email; the athlete then chooses what to share, starting from
--    nothing.
-- 2. Workout assignments: a coach sends one exact version of a workout
--    (copied, so later edits do not change it). The athlete accepts it into
--    their own calendar or declines. Each assignment has a comment thread.
-- 3. Outcome review and roster: the coach sees how assigned workouts went
--    and a roster overview, each only within what the athlete shares, and
--    every read is written to the athlete's access log.
-- 4. Ending a relationship also cancels pending assignments and closes the
--    threads to the professional.

-- ------------------------------------------------------- relationships

alter table professional_relationships add column if not exists invited_by text not null default 'athlete';
alter table professional_relationships drop constraint if exists professional_relationships_invited_by_check;
alter table professional_relationships add constraint professional_relationships_invited_by_check check (invited_by in ('athlete', 'professional'));
alter table professional_relationships alter column athlete_id drop not null;
alter table professional_relationships drop constraint if exists relationship_has_inviter;
alter table professional_relationships add constraint relationship_has_inviter check (
  (invited_by = 'athlete' and athlete_id is not null) or (invited_by = 'professional' and professional_user_id is not null)
);
alter table professional_relationships drop constraint if exists relationship_active_has_athlete;
alter table professional_relationships add constraint relationship_active_has_athlete check (status = 'invited' or athlete_id is not null);

grant select (invited_by) on professional_relationships to authenticated;

-- Workouts can come from a coach.
alter table workouts drop constraint if exists workouts_source_check;
alter table workouts add constraint workouts_source_check check (source in ('manual', 'preset', 'import', 'coach'));

-- A professional invites an athlete by email and gets a code to pass on.
create or replace function invite_athlete(p_email text, p_relationship_type text)
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
    left join auth.users a on a.id = r.athlete_id
    where r.professional_user_id = uid and r.relationship_type = p_relationship_type and r.status in ('invited', 'active')
      and (r.invitee_email = v_email or lower(a.email) = v_email)
  ) then
    raise exception 'ALREADY_INVITED';
  end if;

  insert into professional_relationships (professional_user_id, relationship_type, invitee_email, invite_code, invite_expires_at, status, invited_by)
  values (uid, p_relationship_type, v_email, v_code, v_expires, 'invited', 'professional')
  returning id into v_id;

  perform _audit(uid, null, 'relationship.invited', null, _purpose_for(p_relationship_type), 'professional_relationship', v_id, '{}');
  return jsonb_build_object('relationship_id', v_id, 'invite_code', v_code, 'expires_at', v_expires);
end $$;

-- Accepting works from either side: the caller fills the empty side.
create or replace function accept_relationship_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_email text;
  r professional_relationships%rowtype;
  v_inviter uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select lower(email) into v_email from auth.users where id = uid;

  select * into r from professional_relationships
  where invite_code = upper(btrim(coalesce(p_code, ''))) and status = 'invited'
  for update;

  -- One answer for every way this can fail, so a code cannot be probed.
  if not found or r.invite_expires_at < now() or r.invitee_email <> v_email
     or r.athlete_id = uid or r.professional_user_id = uid then
    raise exception 'INVITE_NOT_VALID';
  end if;

  if r.invited_by = 'professional' then
    update professional_relationships
    set athlete_id = uid, status = 'active', accepted_at = now(), invite_code = null, invite_expires_at = null
    where id = r.id;
    v_inviter := r.professional_user_id;
    perform _audit(uid, uid, 'relationship.accepted', null, _purpose_for(r.relationship_type), 'professional_relationship', r.id, '{}');
    perform _notify(v_inviter, 'sharing', 'Invitation accepted',
      _display_name(uid) || ' accepted your invitation. You will see only what they choose to share.',
      'professional_relationship', r.id);
  else
    update professional_relationships
    set professional_user_id = uid, status = 'active', accepted_at = now(), invite_code = null, invite_expires_at = null
    where id = r.id;
    perform _audit(uid, r.athlete_id, 'relationship.accepted', null, _purpose_for(r.relationship_type), 'professional_relationship', r.id, '{}');
    perform _notify(r.athlete_id, 'sharing', 'Invitation accepted',
      _display_name(uid) || ' accepted your invitation. They can see only what you choose to share.',
      'professional_relationship', r.id);
  end if;
  return r.id;
end $$;

-- As before, plus who invited whom; the code is shown only to the inviter.
create or replace function list_relationships()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  from (
    select
      r.created_at,
      jsonb_build_object(
        'id', r.id,
        'role', case when r.professional_user_id = auth.uid() then 'professional' else 'athlete' end,
        'relationship_type', r.relationship_type,
        'status', r.status,
        'invited_by', r.invited_by,
        'counterpart_name', case
          when r.professional_user_id = auth.uid() then coalesce(_display_name(r.athlete_id), r.invitee_email)
          else coalesce(_display_name(r.professional_user_id), r.invitee_email)
        end,
        'athlete_id', r.athlete_id,
        'invitee_email', case
          when (r.invited_by = 'athlete' and r.athlete_id = auth.uid()) or (r.invited_by = 'professional' and r.professional_user_id = auth.uid())
          then r.invitee_email end,
        'invite_code', case
          when r.status = 'invited' and ((r.invited_by = 'athlete' and r.athlete_id = auth.uid()) or (r.invited_by = 'professional' and r.professional_user_id = auth.uid()))
          then r.invite_code end,
        'invite_expires_at', case when r.status = 'invited' then r.invite_expires_at end,
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

-- ----------------------------------------------------------- assignments

create table if not exists workout_assignments (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references professional_relationships (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  source_workout_id uuid,
  source_version_id uuid,
  -- The version as it was when assigned, in the same shape the app reads
  -- versions in. Later edits by the coach do not change it.
  version_snapshot jsonb not null,
  title text not null,
  scheduled_for timestamptz not null,
  message text check (message is null or length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  -- The athlete's own calendar entry made from it, once accepted.
  athlete_scheduled_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists assignments_athlete_idx on workout_assignments (athlete_id, created_at desc);
create index if not exists assignments_coach_idx on workout_assignments (coach_id, created_at desc);

create table if not exists assignment_comments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references workout_assignments (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists assignment_comments_idx on assignment_comments (assignment_id, created_at);

alter table workout_assignments enable row level security;
alter table assignment_comments enable row level security;

-- Reads only; every write goes through the functions below. The coach keeps
-- seeing an assignment only while the relationship is active.
drop policy if exists "Athlete and active coach read an assignment" on workout_assignments;
create policy "Athlete and active coach read an assignment" on workout_assignments
  for select using (
    auth.uid() = athlete_id
    or (auth.uid() = coach_id and exists (select 1 from professional_relationships r where r.id = relationship_id and r.status = 'active'))
  );

drop policy if exists "Parties read the comments on their assignment" on assignment_comments;
create policy "Parties read the comments on their assignment" on assignment_comments
  for select using (exists (
    select 1 from workout_assignments a join professional_relationships r on r.id = a.relationship_id
    where a.id = assignment_id
      and (a.athlete_id = auth.uid() or (a.coach_id = auth.uid() and r.status = 'active'))
  ));

revoke insert, update, delete on workout_assignments, assignment_comments from anon, authenticated;

create or replace function _version_snapshot(p_version uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(v) || jsonb_build_object('blocks', coalesce((
    select jsonb_agg(to_jsonb(b) || jsonb_build_object('steps', coalesce((
      select jsonb_agg(to_jsonb(s)) from steps s where s.block_id = b.id), '[]'::jsonb)))
    from blocks b where b.version_id = v.id), '[]'::jsonb))
  from workout_versions v where v.id = p_version
$$;

revoke all on function _version_snapshot(uuid) from public, anon, authenticated;

create or replace function assign_workout(p_relationship uuid, p_version uuid, p_scheduled_for timestamptz, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  v workout_versions%rowtype;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships where id = p_relationship;
  if not found or r.professional_user_id is distinct from uid or r.status <> 'active' then
    raise exception 'FORBIDDEN';
  end if;
  if r.relationship_type <> 'training_coach' then
    raise exception 'ONLY_COACHES_ASSIGN';
  end if;
  select * into v from workout_versions where id = p_version;
  if not found or v.user_id <> uid then
    raise exception 'VERSION_NOT_FOUND';
  end if;
  if v.status <> 'published' then
    raise exception 'VERSION_NOT_PUBLISHED';
  end if;
  if p_scheduled_for is null or p_scheduled_for < now() - interval '1 day' then
    raise exception 'DATE_IN_PAST';
  end if;

  insert into workout_assignments (relationship_id, coach_id, athlete_id, source_workout_id, source_version_id, version_snapshot, title, scheduled_for, message)
  values (r.id, uid, r.athlete_id, v.workout_id, v.id, _version_snapshot(v.id), v.title, p_scheduled_for, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_id;

  perform _audit(uid, r.athlete_id, 'assignment.created', null, _purpose_for(r.relationship_type), 'workout_assignment', v_id, '{}');
  perform _emit('WorkoutAssigned', 'coaching', r.athlete_id, 'workout_assignment', v_id);
  perform _notify(r.athlete_id, 'training', 'New workout from ' || _display_name(uid),
    v.title || ' is waiting for you. Nothing is added to your calendar until you accept it.', 'workout_assignment', v_id);
  return v_id;
end $$;

-- The athlete accepts (after adding it to their own calendar) or declines.
create or replace function decide_assignment(p_assignment uuid, p_decision text, p_scheduled uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a workout_assignments%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_decision not in ('accepted', 'declined') then
    raise exception 'INVALID_DECISION';
  end if;
  select * into a from workout_assignments where id = p_assignment for update;
  if not found or a.athlete_id <> uid then
    raise exception 'FORBIDDEN';
  end if;
  if a.status <> 'pending' then
    raise exception 'ASSIGNMENT_ALREADY_DECIDED';
  end if;
  if p_decision = 'accepted' and p_scheduled is null then
    raise exception 'SCHEDULE_REQUIRED';
  end if;

  update workout_assignments
  set status = p_decision, decided_at = now(), athlete_scheduled_id = case when p_decision = 'accepted' then p_scheduled end
  where id = a.id;

  perform _audit(uid, uid, 'assignment.' || p_decision, null, 'training_coaching', 'workout_assignment', a.id, '{}');
  perform _notify(a.coach_id, 'training', a.title || case when p_decision = 'accepted' then ' was accepted' else ' was declined' end,
    _display_name(uid) || case when p_decision = 'accepted' then ' added it to their calendar.' else ' declined it.' end,
    'workout_assignment', a.id);
end $$;

create or replace function cancel_assignment(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a workout_assignments%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into a from workout_assignments where id = p_assignment for update;
  if not found or a.coach_id <> uid then
    raise exception 'FORBIDDEN';
  end if;
  if a.status <> 'pending' then
    raise exception 'ASSIGNMENT_ALREADY_DECIDED';
  end if;
  update workout_assignments set status = 'cancelled', decided_at = now() where id = a.id;
  perform _audit(uid, a.athlete_id, 'assignment.cancelled', null, 'training_coaching', 'workout_assignment', a.id, '{}');
  perform _notify(a.athlete_id, 'training', a.title || ' was withdrawn', _display_name(uid) || ' withdrew this workout.', 'workout_assignment', a.id);
end $$;

create or replace function add_assignment_comment(p_assignment uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a workout_assignments%rowtype;
  r professional_relationships%rowtype;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into a from workout_assignments where id = p_assignment;
  if not found or (a.athlete_id <> uid and a.coach_id <> uid) then
    raise exception 'FORBIDDEN';
  end if;
  select * into r from professional_relationships where id = a.relationship_id;
  if r.status <> 'active' then
    raise exception 'RELATIONSHIP_ENDED';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'INVALID_COMMENT';
  end if;
  insert into assignment_comments (assignment_id, author_id, body) values (a.id, uid, btrim(p_body)) returning id into v_id;
  perform _notify(case when uid = a.athlete_id then a.coach_id else a.athlete_id end, 'training',
    'New comment on ' || a.title, _display_name(uid) || ' commented.', 'workout_assignment', a.id);
  return v_id;
end $$;

-- Assignments for the caller, from either side, with comments and names.
create or replace function list_assignments()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  from (
    select a.created_at, jsonb_build_object(
      'id', a.id,
      'role', case when a.coach_id = auth.uid() then 'coach' else 'athlete' end,
      'relationship_id', a.relationship_id,
      'athlete_id', a.athlete_id,
      'coach_name', _display_name(a.coach_id),
      'athlete_name', _display_name(a.athlete_id),
      'title', a.title,
      'version', a.version_snapshot,
      'scheduled_for', a.scheduled_for,
      'message', a.message,
      'status', a.status,
      'athlete_scheduled_id', a.athlete_scheduled_id,
      'created_at', a.created_at,
      'decided_at', a.decided_at,
      'comments', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'by_me', c.author_id = auth.uid(), 'author_name', _display_name(c.author_id), 'body', c.body, 'created_at', c.created_at) order by c.created_at)
        from assignment_comments c where c.assignment_id = a.id
      ), '[]'::jsonb)
    ) as item
    from workout_assignments a
    join professional_relationships r on r.id = a.relationship_id
    where a.athlete_id = auth.uid() or (a.coach_id = auth.uid() and r.status = 'active')
  ) rows
$$;

-- How the coach's assignments to one athlete went, within what the athlete
-- shares: the calendar status needs workout_plan, the result needs
-- workout_session. Each category read is logged.
create or replace function get_assignment_outcomes(p_athlete uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  v_plan boolean;
  v_session boolean;
  v_rows jsonb;
  v_purpose text;
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
  v_plan := has_grant(p_athlete, 'workout_plan', 'read');
  v_session := has_grant(p_athlete, 'workout_session', 'read');

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', a.id,
    'status', a.status,
    'scheduled_status', case when v_plan then (select sw.status from scheduled_workouts sw where sw.id = a.athlete_scheduled_id and sw.user_id = p_athlete and sw.deleted_at is null) end,
    'session', case when v_session then (
      select to_jsonb(se) || jsonb_build_object('session_results', coalesce((
        select jsonb_agg(to_jsonb(sr)) from session_results sr where sr.session_id = se.id), '[]'::jsonb))
      from sessions se
      where se.scheduled_workout_id = a.athlete_scheduled_id and se.user_id = p_athlete and se.status = 'completed' and se.deleted_at is null
      order by se.started_at desc limit 1) end
  ) order by a.scheduled_for desc), '[]'::jsonb) into v_rows
  from workout_assignments a
  where a.coach_id = uid and a.athlete_id = p_athlete and a.status = 'accepted';

  if v_plan then
    perform _audit(uid, p_athlete, 'data.read', 'workout_plan', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows), 'view', 'assignment_outcomes'));
  end if;
  if v_session then
    perform _audit(uid, p_athlete, 'data.read', 'workout_session', v_purpose, 'professional_relationship', r.id,
      jsonb_build_object('rows', jsonb_array_length(v_rows), 'view', 'assignment_outcomes'));
  end if;
  return jsonb_build_object('plan_shared', v_plan, 'sessions_shared', v_session, 'outcomes', v_rows);
end $$;

-- The professional's roster: every active athlete, what they share, pending
-- assignments, and the 28-day summary for those who share it (logged).
create or replace function coach_roster()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r record;
  v_out jsonb := '[]'::jsonb;
  v_summary jsonb;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  for r in select * from professional_relationships where professional_user_id = uid and status = 'active' order by accepted_at loop
    v_summary := null;
    if has_grant(r.athlete_id, 'performance_summary', 'read') then
      select jsonb_build_object(
        'sessions_7d', (select count(*) from sessions se where se.user_id = r.athlete_id and se.deleted_at is null and se.status = 'completed' and se.started_at > now() - interval '7 days'),
        'sessions_28d', (select count(*) from sessions se where se.user_id = r.athlete_id and se.deleted_at is null and se.status = 'completed' and se.started_at > now() - interval '28 days'),
        'planned_28d', (select count(*) from scheduled_workouts sw where sw.user_id = r.athlete_id and sw.deleted_at is null and sw.scheduled_at between now() - interval '28 days' and now()),
        'planned_done_28d', (select count(*) from scheduled_workouts sw where sw.user_id = r.athlete_id and sw.deleted_at is null and sw.status = 'completed' and sw.scheduled_at between now() - interval '28 days' and now()),
        'last_session_at', (select max(se.started_at) from sessions se where se.user_id = r.athlete_id and se.deleted_at is null and se.status = 'completed')
      ) into v_summary;
      perform _audit(uid, r.athlete_id, 'data.read', 'performance_summary', _purpose_for(r.relationship_type), 'professional_relationship', r.id,
        jsonb_build_object('view', 'roster'));
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'relationship_id', r.id,
      'athlete_id', r.athlete_id,
      'athlete_name', _display_name(r.athlete_id),
      'relationship_type', r.relationship_type,
      'granted', coalesce((select jsonb_agg(g.data_category order by g.created_at) from data_share_grants g
                           where g.relationship_id = r.id and g.status = 'active' and (g.expires_at is null or g.expires_at > now())), '[]'::jsonb),
      'pending_assignments', (select count(*) from workout_assignments a where a.relationship_id = r.id and a.status = 'pending'),
      'declined_assignments_28d', (select count(*) from workout_assignments a where a.relationship_id = r.id and a.status = 'declined' and a.decided_at > now() - interval '28 days'),
      'summary', v_summary
    ));
  end loop;
  return v_out;
end $$;

-- ------------------------------------------------------- ending a relationship

-- As before, and pending assignments are cancelled in the same step.
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

-- ---------------------------------------------------------------- export

-- Assignments the athlete received and the comments on them belong in their export.
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

revoke all on function invite_athlete(text, text) from public, anon;
grant execute on function invite_athlete(text, text) to authenticated;
revoke all on function assign_workout(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function assign_workout(uuid, uuid, timestamptz, text) to authenticated;
revoke all on function decide_assignment(uuid, text, uuid) from public, anon;
grant execute on function decide_assignment(uuid, text, uuid) to authenticated;
revoke all on function cancel_assignment(uuid) from public, anon;
grant execute on function cancel_assignment(uuid) to authenticated;
revoke all on function add_assignment_comment(uuid, text) from public, anon;
grant execute on function add_assignment_comment(uuid, text) to authenticated;
revoke all on function list_assignments() from public, anon;
grant execute on function list_assignments() to authenticated;
revoke all on function get_assignment_outcomes(uuid) from public, anon;
grant execute on function get_assignment_outcomes(uuid) to authenticated;
revoke all on function coach_roster() from public, anon;
grant execute on function coach_roster() to authenticated;
