-- FORM — access requests (roadmap Step 14, professional workspace)
--
-- Run AFTER 0015_movement.sql. Safe to run more than once.
--
-- A connected professional can ask an athlete to share a data category they
-- cannot see. The request only notifies the athlete: nothing is shared until
-- the athlete switches it on under Sharing & Privacy, as before. Repeated
-- requests for the same category are refused for 7 days, so asking cannot
-- turn into pressure. Every request is in the athlete's access log.

create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references professional_relationships (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  professional_id uuid not null references auth.users (id) on delete cascade,
  data_category text not null references data_categories (id),
  created_at timestamptz not null default now()
);

create index if not exists access_requests_rel_idx on access_requests (relationship_id, data_category, created_at desc);

alter table access_requests enable row level security;
drop policy if exists "Both sides read access requests" on access_requests;
create policy "Both sides read access requests" on access_requests for select using (auth.uid() = athlete_id or auth.uid() = professional_id);
revoke insert, update, delete on access_requests from anon, authenticated;

create or replace function request_data_access(p_relationship uuid, p_category text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r professional_relationships%rowtype;
  c data_categories%rowtype;
  v_id uuid;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into r from professional_relationships where id = p_relationship and professional_user_id = uid and status = 'active';
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  select * into c from data_categories where id = p_category;
  if not found or not c.available then
    raise exception 'CATEGORY_NOT_AVAILABLE';
  end if;
  if exists (select 1 from data_share_grants g where g.relationship_id = r.id and g.data_category = p_category and g.status = 'active' and (g.expires_at is null or g.expires_at > now())) then
    raise exception 'ALREADY_SHARED';
  end if;
  if exists (select 1 from access_requests a where a.relationship_id = r.id and a.data_category = p_category and a.created_at > now() - interval '7 days') then
    raise exception 'REQUESTED_RECENTLY';
  end if;
  insert into access_requests (relationship_id, athlete_id, professional_id, data_category)
  values (r.id, r.athlete_id, uid, p_category) returning id into v_id;
  perform _audit(uid, r.athlete_id, 'access.requested', p_category, _purpose_for(r.relationship_type), 'professional_relationship', r.id, '{}');
  perform _notify(r.athlete_id, 'sharing', _display_name(uid) || ' asks to see: ' || c.label,
    'Nothing is shared until you switch it on under Sharing & Privacy. You can also ignore this.', 'professional_relationship', r.id);
  return v_id;
end $$;

revoke all on function request_data_access(uuid, text) from public, anon;
grant execute on function request_data_access(uuid, text) to authenticated;
