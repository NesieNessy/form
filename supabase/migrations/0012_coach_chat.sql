-- FORM — AI coaching chat (roadmap Step 9)
--
-- Run AFTER 0011_rehab.sql. Safe to run more than once.
--
-- Conversations and their messages are kept per athlete so the assistant
-- has the thread's context; the athlete can read and delete them, and they
-- are in the export. Only the assistant function writes messages.
-- Memories are training preferences the athlete explicitly confirmed. They
-- are kept apart from health records, never hold health information (the
-- app and the assistant both refuse it), and can be deleted one by one.

alter table agent_runs drop constraint if exists agent_runs_workflow_check;
alter table agent_runs add constraint agent_runs_workflow_check
  check (workflow in ('workout_import', 'workout_adaptation', 'proposal_revision', 'meal_parse', 'chat'));

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- For the assistant: intent, citations, proposals, warnings.
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

create table if not exists coach_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table coach_memories enable row level security;

drop policy if exists "Owners read their conversations" on chat_conversations;
create policy "Owners read their conversations" on chat_conversations for select using (auth.uid() = user_id);
drop policy if exists "Owners delete their conversations" on chat_conversations;
create policy "Owners delete their conversations" on chat_conversations for delete using (auth.uid() = user_id);
drop policy if exists "Owners read their messages" on chat_messages;
create policy "Owners read their messages" on chat_messages for select using (auth.uid() = user_id);
drop policy if exists "Owners manage their memories" on coach_memories;
create policy "Owners manage their memories" on coach_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert, update on chat_conversations, chat_messages from anon, authenticated;

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
