-- FORM — AI proposals (roadmap Step 3)
--
-- Run AFTER 0004_drop_placeholder_tables.sql. Safe to run more than once.
--
-- The assistant never writes a workout. It writes a proposal: a draft plus
-- the validator's verdict and, for an adaptation, the computed list of
-- changes. A proposal becomes a workout only when the athlete approves it,
-- and the workout is then saved through the same validated path as any
-- other (save_workout_version), so a proposal cannot bypass a rule.
--
-- Both tables are written only by the `assistant` edge function, using the
-- service role. Clients can read their own rows and decide a proposal
-- through decide_proposal(); they cannot create or edit either.

-- One row per assistant request, successful or not: which workflow ran, each
-- step it took, which model answered and what it cost in tokens. Holds sizes
-- and codes, not the athlete's text.
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workflow text not null check (workflow in ('workout_import', 'workout_adaptation', 'proposal_revision')),
  status text not null check (status in ('succeeded', 'failed')),
  failure_code text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  model_calls integer not null default 0,
  steps jsonb not null default '[]',
  input_meta jsonb not null default '{}',
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_user_time_idx on agent_runs (user_id, created_at desc);

create table if not exists agent_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid references agent_runs (id) on delete set null,
  parent_proposal_id uuid references agent_proposals (id) on delete set null,
  type text not null check (type in ('workout_import', 'workout_adaptation')),
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected', 'superseded')),
  -- Where the draft came from: the pasted text, or the workout version that was adapted.
  source jsonb not null,
  constraints jsonb,
  -- The proposed workout, in the app's workout model.
  content jsonb not null,
  -- For an adaptation: the workout as it was, and the computed differences.
  original jsonb,
  changes jsonb not null default '[]',
  rationale jsonb not null default '[]',
  validation jsonb not null,
  open_questions jsonb not null default '[]',
  notices jsonb not null default '[]',
  model text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  decided_at timestamptz,
  result_workout_id uuid
);

create index if not exists agent_proposals_user_idx on agent_proposals (user_id, status, created_at desc);

alter table agent_runs enable row level security;
alter table agent_proposals enable row level security;

drop policy if exists "Owners read their assistant runs" on agent_runs;
create policy "Owners read their assistant runs" on agent_runs
  for select using (auth.uid() = user_id);

drop policy if exists "Owners read their proposals" on agent_proposals;
create policy "Owners read their proposals" on agent_proposals
  for select using (auth.uid() = user_id);

revoke insert, update, delete on agent_runs, agent_proposals from anon, authenticated;

create or replace function _on_proposal_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _emit('AgentProposalCreated', 'assistant', new.user_id, 'agent_proposal', new.id);
  -- A revised draft replaces the one it was made from.
  if new.parent_proposal_id is not null then
    update agent_proposals set status = 'superseded', decided_at = now()
    where id = new.parent_proposal_id and status = 'pending_approval';
  end if;
  return new;
end $$;

drop trigger if exists agent_proposals_event on agent_proposals;
create trigger agent_proposals_event after insert on agent_proposals
  for each row execute function _on_proposal_created();

-- The athlete's decision on a proposal. Approving re-checks that the
-- proposal is still current: it must be undecided, unexpired, structurally
-- valid, and, for an adaptation, the schedule entry must still be on the
-- workout version the proposal was made from.
create or replace function decide_proposal(p_proposal uuid, p_decision text, p_result_workout uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p agent_proposals%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select * into p from agent_proposals where id = p_proposal for update;
  if not found or p.user_id <> uid then
    raise exception 'FORBIDDEN';
  end if;
  if p.status <> 'pending_approval' then
    raise exception 'PROPOSAL_ALREADY_DECIDED';
  end if;

  if p_decision = 'approved' then
    if p.expires_at < now() then
      raise exception 'PROPOSAL_EXPIRED';
    end if;
    if coalesce((p.validation ->> 'valid')::boolean, false) is not true then
      raise exception 'PROPOSAL_INVALID';
    end if;
    if p.type = 'workout_adaptation' and not exists (
      select 1 from scheduled_workouts sw
      where sw.id = (p.source ->> 'scheduled_id')::uuid
        and sw.user_id = uid
        and sw.deleted_at is null
        and sw.status = 'planned'
        and sw.version_id = (p.source ->> 'version_id')::uuid
    ) then
      raise exception 'PROPOSAL_STALE';
    end if;
  end if;

  update agent_proposals
  set status = p_decision, decided_at = now(), result_workout_id = p_result_workout
  where id = p_proposal;

  perform _audit(uid, uid, 'proposal.' || p_decision, null, null, 'agent_proposal', p_proposal,
    jsonb_build_object('type', p.type, 'model', p.model));
  perform _emit(case p_decision when 'approved' then 'AgentProposalApproved' else 'AgentProposalRejected' end,
    'assistant', uid, 'agent_proposal', p_proposal);
end $$;

revoke all on function decide_proposal(uuid, text, uuid) from public, anon;
grant execute on function decide_proposal(uuid, text, uuid) to authenticated;
revoke all on function _on_proposal_created() from public, anon, authenticated;

-- The data export now includes what the assistant produced for the athlete.
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
    'notification_preferences', (select to_jsonb(np) from notification_preferences np where np.user_id = uid),
    'assistant', jsonb_build_object(
      'proposals', coalesce((select jsonb_agg(to_jsonb(ap)) from agent_proposals ap where ap.user_id = uid), '[]'::jsonb),
      'runs', coalesce((select jsonb_agg(to_jsonb(ar)) from agent_runs ar where ar.user_id = uid), '[]'::jsonb)
    )
  ) into v;

  perform _audit(uid, uid, 'data.exported', null, 'data_portability', null, null, '{}');
  return v;
end $$;
