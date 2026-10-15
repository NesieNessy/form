-- FORM — goals and progress (roadmap Step 10)
--
-- Run AFTER 0012_coach_chat.sql. Safe to run more than once.
--
-- athlete_goals replaces the placeholder `goals` table of the first schema
-- (left in place, empty and unused, so no older export breaks). A goal is
-- written by the device like the athlete's other data; progress is
-- calculated on the device from the evidence and stored as a snapshot so a
-- coach can see it. Every change of target keeps the earlier value in
-- `revisions`. A coach sees a goal only when the athlete shares the goals
-- category with them AND marks that goal as shared, and can leave review
-- comments the athlete reads.

create table if not exists athlete_goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  metric jsonb not null check (metric ->> 'kind' in ('one_rep_max', 'benchmark', 'distance_time', 'sessions_per_week', 'nutrition_logging', 'event', 'rehab_stage')),
  target numeric check (target is null or target > 0),
  target_date date not null,
  baseline jsonb,
  milestones jsonb not null default '[]',
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  status text not null default 'active' check (status in ('active', 'achieved', 'paused', 'abandoned')),
  completed_on date,
  revisions jsonb not null default '[]',
  progress jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists athlete_goals_user_idx on athlete_goals (user_id);

alter table athlete_goals enable row level security;
drop policy if exists "Owners manage their goals" on athlete_goals;
create policy "Owners manage their goals" on athlete_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists goal_reviews (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references athlete_goals (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table goal_reviews enable row level security;
drop policy if exists "Athlete and author read goal reviews" on goal_reviews;
create policy "Athlete and author read goal reviews" on goal_reviews for select using (auth.uid() = athlete_id or auth.uid() = author_id);
revoke insert, update, delete on goal_reviews from anon, authenticated;

insert into data_categories (id, label, description, sensitivity, available, position)
values ('goals', 'Goals', 'Goals you mark as shared, with their progress and history. Private goals stay private.', 'standard', true, 6)
on conflict (id) do update set label = excluded.label, description = excluded.description, available = true;

-- The shared goals of one athlete for a connected professional, logged in the athlete's access log.
create or replace function list_shared_goals(p_athlete uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
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
  if not has_grant(p_athlete, 'goals', 'read') then
    return jsonb_build_object('shared', false, 'goals', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(to_jsonb(g) - 'user_id' || jsonb_build_object('reviews', coalesce((
    select jsonb_agg(jsonb_build_object('id', rv.id, 'body', rv.body, 'by_me', rv.author_id = uid, 'author_name', _display_name(rv.author_id), 'created_at', rv.created_at) order by rv.created_at)
    from goal_reviews rv where rv.goal_id = g.id), '[]'::jsonb)) order by g.target_date), '[]'::jsonb) into v_rows
  from athlete_goals g
  where g.user_id = p_athlete and g.deleted_at is null and g.visibility = 'shared';
  perform _audit(uid, p_athlete, 'data.read', 'goals', _purpose_for(r.relationship_type), 'professional_relationship', r.id,
    jsonb_build_object('rows', jsonb_array_length(v_rows)));
  return jsonb_build_object('shared', true, 'goals', v_rows);
end $$;

create or replace function add_goal_review(p_goal uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g athlete_goals%rowtype;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into g from athlete_goals where id = p_goal and deleted_at is null;
  if not found or g.visibility <> 'shared' then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from professional_relationships r where r.athlete_id = g.user_id and r.professional_user_id = uid and r.status = 'active')
     or not exists (select 1 from data_share_grants dg join professional_relationships r on r.id = dg.relationship_id
                    where dg.athlete_id = g.user_id and r.professional_user_id = uid and dg.data_category = 'goals' and dg.status = 'active' and (dg.expires_at is null or dg.expires_at > now())) then
    raise exception 'FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'INVALID_COMMENT';
  end if;
  insert into goal_reviews (goal_id, athlete_id, author_id, body) values (g.id, g.user_id, uid, btrim(p_body)) returning id into v_id;
  perform _notify(g.user_id, 'training', 'Review of ' || g.title, _display_name(uid) || ' commented on your goal.', 'athlete_goal', g.id);
  return v_id;
end $$;

revoke all on function list_shared_goals(uuid) from public, anon;
grant execute on function list_shared_goals(uuid) to authenticated;
revoke all on function add_goal_review(uuid, text) from public, anon;
grant execute on function add_goal_review(uuid, text) to authenticated;

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
