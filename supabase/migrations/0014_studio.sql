-- FORM — studio beta (roadmap Step 11)
--
-- Run AFTER 0013_goals.sql. Safe to run more than once.
--
-- A studio is an organization with facilities, staff, members, membership
-- plans and a class timetable. Everything here is operational: who booked,
-- who came, who works when, who has paid. Joining a studio never creates a
-- data grant, so staff see no member's sessions, health, rehab, nutrition or
-- goals unless that member shares them through a personal connection as
-- before. Reports are aggregates that hide groups smaller than five people.
-- Every write goes through the functions below.

alter table organizations add column if not exists staff_seats integer not null default 3 check (staff_seats between 1 and 500);

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  address text check (address is null or length(address) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'coach', 'physiotherapist', 'instructor', 'member')),
  code text unique,
  expires_at timestamptz not null,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists membership_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('monthly', 'class_pack', 'drop_in')),
  price_cents integer not null check (price_cents between 0 and 10000000),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  classes_included integer check (classes_included is null or classes_included between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'class_pack') = (classes_included is not null))
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references membership_plans (id),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  starts_on date not null,
  ends_on date,
  classes_remaining integer check (classes_remaining is null or classes_remaining >= 0),
  -- Billing is recorded by staff; no payment provider is connected yet.
  billing_status text not null default 'due' check (billing_status in ('paid', 'due', 'overdue', 'none')),
  paid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists memberships_one_open on memberships (organization_id, user_id) where status <> 'ended';

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  facility_id uuid references facilities (id) on delete set null,
  series_id uuid,
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (description is null or length(description) <= 1000),
  instructor_id uuid references auth.users (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  -- The class workout as it was when scheduled, in the shape the app reads versions in.
  workout_snapshot jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours')
);

create index if not exists class_sessions_org_idx on class_sessions (organization_id, starts_at);

create table if not exists class_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  membership_id uuid references memberships (id) on delete set null,
  status text not null check (status in ('booked', 'waitlisted', 'cancelled')),
  -- Whether a class-pack credit was used, so cancelling gives it back.
  used_credit boolean not null default false,
  attended boolean,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create table if not exists staff_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  facility_id uuid references facilities (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (note is null or length(note) <= 200),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '16 hours')
);

-- ------------------------------------------------------------ access

create or replace function _org_role(p_org uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from organization_members where organization_id = p_org and user_id = p_user
$$;

create or replace function _is_staff_role(p_role text)
returns boolean language sql immutable as $$
  select p_role in ('owner', 'manager', 'coach', 'physiotherapist', 'instructor')
$$;

alter table facilities enable row level security;
alter table organization_invites enable row level security;
alter table membership_plans enable row level security;
alter table memberships enable row level security;
alter table class_sessions enable row level security;
alter table class_bookings enable row level security;
alter table staff_shifts enable row level security;

drop policy if exists "Members read facilities" on facilities;
create policy "Members read facilities" on facilities for select using (is_org_member(organization_id, false));
drop policy if exists "Members read plans" on membership_plans;
create policy "Members read plans" on membership_plans for select using (is_org_member(organization_id, false));
drop policy if exists "Members read classes" on class_sessions;
create policy "Members read classes" on class_sessions for select using (is_org_member(organization_id, false));
drop policy if exists "Own membership, or admins" on memberships;
create policy "Own membership, or admins" on memberships for select using (user_id = auth.uid() or is_org_member(organization_id, true));
drop policy if exists "Own booking" on class_bookings;
create policy "Own booking" on class_bookings for select using (user_id = auth.uid());
drop policy if exists "Staff read shifts" on staff_shifts;
create policy "Staff read shifts" on staff_shifts for select using (_is_staff_role(_org_role(organization_id, auth.uid())));
drop policy if exists "Admins read invites" on organization_invites;
create policy "Admins read invites" on organization_invites for select using (is_org_member(organization_id, true));

revoke insert, update, delete on facilities, organization_invites, membership_plans, memberships, class_sessions, class_bookings, staff_shifts from anon, authenticated;
revoke select on organization_invites from anon, authenticated;
grant select (id, organization_id, email, role, expires_at, status, created_at) on organization_invites to authenticated;

-- ------------------------------------------------------- organization

create or replace function _require_role(p_org uuid, p_roles text[])
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  v_role := _org_role(p_org, auth.uid());
  if v_role is null or not (v_role = any (p_roles)) then
    raise exception 'FORBIDDEN';
  end if;
  return v_role;
end $$;

create or replace function create_studio(p_name text, p_facility text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'INVALID_NAME';
  end if;
  v_id := create_organization(p_name, 'studio');
  insert into facilities (organization_id, name) values (v_id, coalesce(nullif(btrim(coalesce(p_facility, '')), ''), btrim(p_name)));
  perform _audit(auth.uid(), null, 'organization.created', null, 'studio_operations', 'organization', v_id, '{}');
  return v_id;
end $$;

create or replace function add_facility(p_org uuid, p_name text, p_address text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'INVALID_NAME';
  end if;
  insert into facilities (organization_id, name, address) values (p_org, btrim(p_name), nullif(btrim(coalesce(p_address, '')), '')) returning id into v_id;
  return v_id;
end $$;

-- Staff seats in use: staff members plus open staff invitations.
create or replace function _seats_used(p_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (select count(*)::int from organization_members m where m.organization_id = p_org and _is_staff_role(m.role))
       + (select count(*)::int from organization_invites i where i.organization_id = p_org and i.status = 'invited' and i.expires_at > now() and i.role <> 'member')
$$;

create or replace function set_staff_seats(p_org uuid, p_seats integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_role(p_org, array['owner']);
  if p_seats is null or p_seats < 1 or p_seats > 500 then
    raise exception 'INVALID_SEATS';
  end if;
  if p_seats < _seats_used(p_org) then
    raise exception 'SEATS_IN_USE';
  end if;
  update organizations set staff_seats = p_seats where id = p_org;
end $$;

create or replace function invite_to_organization(p_org uuid, p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_expires timestamptz := now() + interval '14 days';
  v_id uuid;
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;
  if p_role is null or p_role not in ('manager', 'coach', 'physiotherapist', 'instructor', 'member') then
    raise exception 'INVALID_ROLE';
  end if;
  if p_role = 'manager' and _org_role(p_org, uid) <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from organization_members m join auth.users u on u.id = m.user_id where m.organization_id = p_org and lower(u.email) = v_email)
     or exists (select 1 from organization_invites i where i.organization_id = p_org and i.email = v_email and i.status = 'invited' and i.expires_at > now()) then
    raise exception 'ALREADY_INVITED';
  end if;
  if p_role <> 'member' and _seats_used(p_org) >= (select staff_seats from organizations where id = p_org) then
    raise exception 'NO_STAFF_SEATS';
  end if;
  insert into organization_invites (organization_id, email, role, code, expires_at, invited_by)
  values (p_org, v_email, p_role, v_code, v_expires, uid) returning id into v_id;
  perform _audit(uid, null, 'organization.invited', null, 'studio_operations', 'organization_invite', v_id, jsonb_build_object('role', p_role));
  return jsonb_build_object('invite_id', v_id, 'invite_code', v_code, 'expires_at', v_expires);
end $$;

create or replace function revoke_organization_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i organization_invites%rowtype;
begin
  select * into i from organization_invites where id = p_invite;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  perform _require_role(i.organization_id, array['owner', 'manager']);
  update organization_invites set status = 'revoked', code = null where id = p_invite and status = 'invited';
end $$;

-- Joining gives an operational role only. No data grant is created.
create or replace function accept_organization_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  i organization_invites%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into i from organization_invites where code = upper(btrim(coalesce(p_code, ''))) and status = 'invited' for update;
  if not found or i.expires_at < now() or i.email <> lower((select email from auth.users where id = uid)) or _org_role(i.organization_id, uid) is not null then
    raise exception 'INVITE_NOT_VALID';
  end if;
  insert into organization_members (organization_id, user_id, role) values (i.organization_id, uid, i.role);
  update organization_invites set status = 'accepted', code = null, accepted_by = uid where id = i.id;
  perform _audit(uid, uid, 'organization.joined', null, 'studio_operations', 'organization', i.organization_id, jsonb_build_object('role', i.role));
  perform _notify(i.invited_by, 'account', 'Invitation accepted', _display_name(uid) || ' joined ' || (select name from organizations where id = i.organization_id) || '.', 'organization', i.organization_id);
  return i.organization_id;
end $$;

-- Leaving or being removed: future bookings are cancelled, the person's own
-- training data stays theirs, and the studio keeps its operational records.
create or replace function _remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update class_bookings b set status = 'cancelled', updated_at = now()
  from class_sessions c
  where c.id = b.class_id and c.organization_id = p_org and b.user_id = p_user and b.status <> 'cancelled' and c.starts_at > now();
  update memberships set status = 'ended', ends_on = coalesce(ends_on, current_date), updated_at = now()
  where organization_id = p_org and user_id = p_user and status <> 'ended';
  update class_sessions set instructor_id = null where organization_id = p_org and instructor_id = p_user and starts_at > now();
  delete from staff_shifts where organization_id = p_org and user_id = p_user and starts_at > now();
  delete from organization_members where organization_id = p_org and user_id = p_user;
end $$;

create or replace function remove_from_organization(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text := _org_role(p_org, p_user);
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if v_role is null then
    raise exception 'FORBIDDEN';
  end if;
  if v_role = 'owner' or (v_role = 'manager' and _org_role(p_org, auth.uid()) <> 'owner') then
    raise exception 'CANNOT_REMOVE_OWNER';
  end if;
  perform _remove_member(p_org, p_user);
  perform _audit(auth.uid(), p_user, 'organization.removed', null, 'studio_operations', 'organization', p_org, '{}');
end $$;

create or replace function leave_organization(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _org_role(p_org, auth.uid()) = 'owner' then
    raise exception 'OWNER_CANNOT_LEAVE';
  end if;
  perform _require_role(p_org, array['manager', 'coach', 'physiotherapist', 'instructor', 'member']);
  perform _remove_member(p_org, auth.uid());
  perform _audit(auth.uid(), auth.uid(), 'organization.left', null, 'studio_operations', 'organization', p_org, '{}');
end $$;

create or replace function my_organizations()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'name', o.name, 'kind', o.kind, 'role', m.role, 'staff_seats', o.staff_seats,
    'facilities', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'address', f.address) order by f.created_at) from facilities f where f.organization_id = o.id), '[]'::jsonb),
    'membership', (select jsonb_build_object('id', ms.id, 'plan', p.name, 'kind', p.kind, 'status', ms.status, 'starts_on', ms.starts_on, 'ends_on', ms.ends_on,
                     'classes_remaining', ms.classes_remaining, 'billing_status', ms.billing_status, 'paid_until', ms.paid_until)
                   from memberships ms join membership_plans p on p.id = ms.plan_id
                   where ms.organization_id = o.id and ms.user_id = auth.uid() and ms.status <> 'ended')
  ) order by o.name), '[]'::jsonb)
  from organization_members m join organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
$$;

-- People in the studio, for its owner and managers: names, roles and membership status. Nothing else about them.
create or replace function organization_people(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role(p_org, array['owner', 'manager']);
  return jsonb_build_object(
    'seats_used', _seats_used(p_org),
    'staff_seats', (select staff_seats from organizations where id = p_org),
    'people', coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'name', _display_name(m.user_id), 'role', m.role, 'joined_at', m.created_at,
      'membership', (select jsonb_build_object('id', ms.id, 'plan_id', ms.plan_id, 'plan', p.name, 'status', ms.status, 'classes_remaining', ms.classes_remaining,
                       'billing_status', ms.billing_status, 'paid_until', ms.paid_until, 'starts_on', ms.starts_on, 'ends_on', ms.ends_on)
                     from memberships ms join membership_plans p on p.id = ms.plan_id
                     where ms.organization_id = p_org and ms.user_id = m.user_id and ms.status <> 'ended')
    ) order by m.role <> 'owner', m.created_at) from organization_members m where m.organization_id = p_org), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'code', i.code, 'expires_at', i.expires_at) order by i.created_at desc)
                         from organization_invites i where i.organization_id = p_org and i.status = 'invited' and i.expires_at > now()), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from membership_plans p where p.organization_id = p_org), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------- memberships

create or replace function create_membership_plan(p_org uuid, p_name text, p_kind text, p_price_cents integer, p_currency text, p_classes integer default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'INVALID_NAME';
  end if;
  if p_kind is null or p_kind not in ('monthly', 'class_pack', 'drop_in') or (p_kind = 'class_pack') <> (p_classes is not null) then
    raise exception 'INVALID_PLAN';
  end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 10000000 then
    raise exception 'INVALID_PRICE';
  end if;
  insert into membership_plans (organization_id, name, kind, price_cents, currency, classes_included)
  values (p_org, btrim(p_name), p_kind, p_price_cents, upper(coalesce(nullif(btrim(p_currency), ''), 'EUR')), p_classes) returning id into v_id;
  return v_id;
end $$;

create or replace function set_plan_active(p_plan uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (select organization_id from membership_plans where id = p_plan);
begin
  if v_org is null then
    raise exception 'FORBIDDEN';
  end if;
  perform _require_role(v_org, array['owner', 'manager']);
  update membership_plans set active = coalesce(p_active, false) where id = p_plan;
end $$;

-- Starts a membership on a plan, ending any open one. The person must already be in the studio.
create or replace function assign_membership(p_org uuid, p_user uuid, p_plan uuid, p_starts_on date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p membership_plans%rowtype;
  v_id uuid;
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if _org_role(p_org, p_user) is null then
    raise exception 'NOT_A_MEMBER';
  end if;
  select * into p from membership_plans where id = p_plan and organization_id = p_org;
  if not found or not p.active then
    raise exception 'INVALID_PLAN';
  end if;
  update memberships set status = 'ended', ends_on = coalesce(ends_on, current_date), updated_at = now()
  where organization_id = p_org and user_id = p_user and status <> 'ended';
  insert into memberships (organization_id, user_id, plan_id, starts_on, classes_remaining, billing_status)
  values (p_org, p_user, p_plan, coalesce(p_starts_on, current_date), p.classes_included, case when p.price_cents = 0 then 'none' else 'due' end)
  returning id into v_id;
  perform _audit(auth.uid(), p_user, 'membership.started', null, 'studio_operations', 'membership', v_id, jsonb_build_object('plan', p.name));
  perform _notify(p_user, 'account', 'Membership: ' || p.name, 'Your membership at ' || (select name from organizations where id = p_org) || ' starts ' || to_char(coalesce(p_starts_on, current_date), 'YYYY-MM-DD') || '.', 'membership', v_id);
  return v_id;
end $$;

create or replace function update_membership(p_membership uuid, p_status text, p_billing_status text, p_paid_until date default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  ms memberships%rowtype;
begin
  select * into ms from memberships where id = p_membership;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  perform _require_role(ms.organization_id, array['owner', 'manager']);
  if ms.status = 'ended' then
    raise exception 'MEMBERSHIP_ENDED';
  end if;
  if coalesce(p_status, ms.status) not in ('active', 'paused', 'ended') or coalesce(p_billing_status, ms.billing_status) not in ('paid', 'due', 'overdue', 'none') then
    raise exception 'INVALID_STATUS';
  end if;
  update memberships set
    status = coalesce(p_status, status),
    ends_on = case when coalesce(p_status, status) = 'ended' then coalesce(ends_on, current_date) else ends_on end,
    billing_status = coalesce(p_billing_status, billing_status),
    paid_until = coalesce(p_paid_until, paid_until),
    updated_at = now()
  where id = p_membership;
  perform _audit(auth.uid(), ms.user_id, 'membership.updated', null, 'studio_operations', 'membership', ms.id,
    jsonb_build_object('status', coalesce(p_status, ms.status), 'billing_status', coalesce(p_billing_status, ms.billing_status)));
end $$;

-- The membership that lets this person book a class on this day, or null.
create or replace function _entitlement(p_org uuid, p_user uuid, p_day date)
returns memberships language sql stable security definer set search_path = public as $$
  select ms.* from memberships ms join membership_plans p on p.id = ms.plan_id
  where ms.organization_id = p_org and ms.user_id = p_user and ms.status = 'active' and ms.billing_status <> 'overdue'
    and ms.starts_on <= p_day and (ms.ends_on is null or ms.ends_on >= p_day)
    and (p.kind <> 'class_pack' or ms.classes_remaining > 0)
  limit 1
$$;

-- ------------------------------------------------------------- classes

create or replace function schedule_classes(
  p_org uuid, p_facility uuid, p_title text, p_description text, p_instructor uuid,
  p_first_start timestamptz, p_minutes integer, p_capacity integer, p_weeks integer default 1, p_version uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_role text := _require_role(p_org, array['owner', 'manager', 'coach', 'instructor']);
  v_series uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if v_role in ('coach', 'instructor') and p_instructor is distinct from uid then
    raise exception 'ONLY_OWN_CLASSES';
  end if;
  if p_instructor is not null and not coalesce(_is_staff_role(_org_role(p_org, p_instructor)), false) then
    raise exception 'INSTRUCTOR_NOT_STAFF';
  end if;
  if p_facility is not null and not exists (select 1 from facilities where id = p_facility and organization_id = p_org) then
    raise exception 'FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 80 then
    raise exception 'INVALID_NAME';
  end if;
  if p_first_start is null or p_first_start < now() - interval '1 hour' then
    raise exception 'DATE_IN_PAST';
  end if;
  if p_minutes is null or p_minutes not between 10 and 480 or p_capacity is null or p_capacity not between 1 and 500 or p_weeks is null or p_weeks not between 1 and 26 then
    raise exception 'INVALID_CLASS';
  end if;
  if p_version is not null then
    if not exists (select 1 from workout_versions v where v.id = p_version and v.user_id = uid and v.status = 'published') then
      raise exception 'VERSION_NOT_FOUND';
    end if;
    v_snapshot := _version_snapshot(p_version);
  end if;
  for w in 0 .. p_weeks - 1 loop
    insert into class_sessions (organization_id, facility_id, series_id, title, description, instructor_id, starts_at, ends_at, capacity, workout_snapshot, created_by)
    values (p_org, p_facility, v_series, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_instructor,
            p_first_start + make_interval(weeks => w), p_first_start + make_interval(weeks => w, mins => p_minutes), p_capacity, v_snapshot, uid)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return jsonb_build_object('series_id', v_series, 'class_ids', to_jsonb(v_ids));
end $$;

create or replace function cancel_class(p_class uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c class_sessions%rowtype;
  b record;
begin
  select * into c from class_sessions where id = p_class for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if _require_role(c.organization_id, array['owner', 'manager', 'coach', 'instructor']) in ('coach', 'instructor') and c.instructor_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if c.status = 'cancelled' then
    return;
  end if;
  update class_sessions set status = 'cancelled' where id = p_class;
  for b in select * from class_bookings where class_id = p_class and status <> 'cancelled' loop
    if b.used_credit then
      update memberships set classes_remaining = classes_remaining + 1, updated_at = now() where id = b.membership_id;
    end if;
    update class_bookings set status = 'cancelled', used_credit = false, updated_at = now() where id = b.id;
    perform _notify(b.user_id, 'training', 'Class cancelled: ' || c.title, to_char(c.starts_at, 'YYYY-MM-DD HH24:MI') || ' UTC. Any class credit was returned.', 'class_session', c.id);
  end loop;
end $$;

-- The timetable of one studio for its members and staff.
create or replace function list_classes(p_org uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := _require_role(p_org, array['owner', 'manager', 'coach', 'physiotherapist', 'instructor', 'member']);
begin
  if p_to - p_from > interval '62 days' then
    raise exception 'RANGE_TOO_LONG';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', c.id, 'series_id', c.series_id, 'title', c.title, 'description', c.description, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'capacity', c.capacity, 'status', c.status, 'facility', f.name, 'instructor_id', c.instructor_id,
    'instructor_name', case when c.instructor_id is not null then _display_name(c.instructor_id) end,
    'booked', (select count(*)::int from class_bookings b where b.class_id = c.id and b.status = 'booked'),
    'waitlisted', (select count(*)::int from class_bookings b where b.class_id = c.id and b.status = 'waitlisted'),
    'has_workout', c.workout_snapshot is not null,
    'my_booking', (select jsonb_build_object('id', b.id, 'status', b.status, 'attended', b.attended,
                     'waitlist_position', case when b.status = 'waitlisted' then (select count(*)::int from class_bookings w where w.class_id = c.id and w.status = 'waitlisted' and w.created_at <= b.created_at) end)
                   from class_bookings b where b.class_id = c.id and b.user_id = auth.uid() and b.status <> 'cancelled'),
    'can_manage', v_role in ('owner', 'manager') or c.instructor_id = auth.uid()
  ) order by c.starts_at) from class_sessions c left join facilities f on f.id = c.facility_id
  where c.organization_id = p_org and c.starts_at >= p_from and c.starts_at < p_to), '[]'::jsonb);
end $$;

create or replace function book_class(p_class uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c class_sessions%rowtype;
  ms memberships;
  v_status text;
  v_id uuid;
  v_existing class_bookings%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into c from class_sessions where id = p_class for update;
  if not found or _org_role(c.organization_id, uid) is null then
    raise exception 'FORBIDDEN';
  end if;
  if c.status = 'cancelled' then
    raise exception 'CLASS_CANCELLED';
  end if;
  if c.starts_at < now() then
    raise exception 'CLASS_STARTED';
  end if;
  select * into v_existing from class_bookings where class_id = p_class and user_id = uid;
  if found and v_existing.status <> 'cancelled' then
    raise exception 'ALREADY_BOOKED';
  end if;
  ms := _entitlement(c.organization_id, uid, (c.starts_at at time zone 'UTC')::date);
  if ms.id is null then
    raise exception 'NO_ACTIVE_MEMBERSHIP';
  end if;
  v_status := case when (select count(*) from class_bookings where class_id = p_class and status = 'booked') < c.capacity then 'booked' else 'waitlisted' end;
  insert into class_bookings (class_id, user_id, membership_id, status, used_credit)
  values (p_class, uid, ms.id, v_status, v_status = 'booked' and ms.classes_remaining is not null)
  on conflict (class_id, user_id) do update set status = excluded.status, membership_id = excluded.membership_id, used_credit = excluded.used_credit,
    attended = null, checked_in_at = null, created_at = now(), updated_at = now()
  returning id into v_id;
  if v_status = 'booked' and ms.classes_remaining is not null then
    update memberships set classes_remaining = classes_remaining - 1, updated_at = now() where id = ms.id;
  end if;
  return jsonb_build_object('booking_id', v_id, 'status', v_status);
end $$;

-- Gives the place to the first person on the waitlist who can still book it.
create or replace function _promote_waitlist(p_class uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c class_sessions%rowtype;
  w class_bookings%rowtype;
  ms memberships;
begin
  select * into c from class_sessions where id = p_class;
  if c.status <> 'scheduled' or c.starts_at < now() or (select count(*) from class_bookings where class_id = p_class and status = 'booked') >= c.capacity then
    return;
  end if;
  for w in select * from class_bookings where class_id = p_class and status = 'waitlisted' order by created_at loop
    ms := _entitlement(c.organization_id, w.user_id, (c.starts_at at time zone 'UTC')::date);
    if ms.id is null then
      continue;
    end if;
    update class_bookings set status = 'booked', membership_id = ms.id, used_credit = ms.classes_remaining is not null, updated_at = now() where id = w.id;
    if ms.classes_remaining is not null then
      update memberships set classes_remaining = classes_remaining - 1, updated_at = now() where id = ms.id;
    end if;
    perform _notify(w.user_id, 'training', 'You are in: ' || c.title, 'A place opened up for ' || to_char(c.starts_at, 'YYYY-MM-DD HH24:MI') || ' UTC.', 'class_session', c.id);
    return;
  end loop;
end $$;

create or replace function cancel_booking(p_class uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  b class_bookings%rowtype;
  c class_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into b from class_bookings where class_id = p_class and user_id = auth.uid() and status <> 'cancelled' for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  select * into c from class_sessions where id = p_class for update;
  if c.starts_at < now() then
    raise exception 'CLASS_STARTED';
  end if;
  if b.used_credit then
    update memberships set classes_remaining = classes_remaining + 1, updated_at = now() where id = b.membership_id;
  end if;
  update class_bookings set status = 'cancelled', used_credit = false, updated_at = now() where id = b.id;
  if b.status = 'booked' then
    perform _promote_waitlist(p_class);
  end if;
end $$;

-- Operational roster for the class's instructor and the studio's managers: names and attendance only.
create or replace function class_roster(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c class_sessions%rowtype;
  v_role text;
begin
  select * into c from class_sessions where id = p_class;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  v_role := _require_role(c.organization_id, array['owner', 'manager', 'coach', 'physiotherapist', 'instructor']);
  if v_role not in ('owner', 'manager') and c.instructor_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('booking_id', b.id, 'name', _display_name(b.user_id), 'status', b.status, 'attended', b.attended, 'checked_in_at', b.checked_in_at)
                   order by b.status, b.created_at)
                   from class_bookings b where b.class_id = p_class and b.status <> 'cancelled'), '[]'::jsonb);
end $$;

create or replace function mark_attendance(p_booking uuid, p_attended boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  b class_bookings%rowtype;
  c class_sessions%rowtype;
  v_role text;
begin
  select * into b from class_bookings where id = p_booking;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  select * into c from class_sessions where id = b.class_id;
  v_role := _require_role(c.organization_id, array['owner', 'manager', 'coach', 'physiotherapist', 'instructor']);
  if v_role not in ('owner', 'manager') and c.instructor_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if b.status <> 'booked' then
    raise exception 'NOT_BOOKED';
  end if;
  if c.starts_at > now() + interval '30 minutes' then
    raise exception 'TOO_EARLY';
  end if;
  update class_bookings set attended = p_attended, checked_in_at = case when p_attended then coalesce(checked_in_at, now()) end, updated_at = now() where id = p_booking;
end $$;

-- The class workout, for people booked on it and the studio's staff, to add to their own plan.
create or replace function class_workout(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c class_sessions%rowtype;
begin
  select * into c from class_sessions where id = p_class;
  if not found or _org_role(c.organization_id, auth.uid()) is null then
    raise exception 'FORBIDDEN';
  end if;
  if not _is_staff_role(_org_role(c.organization_id, auth.uid()))
     and not exists (select 1 from class_bookings b where b.class_id = p_class and b.user_id = auth.uid() and b.status = 'booked') then
    raise exception 'FORBIDDEN';
  end if;
  return c.workout_snapshot;
end $$;

-- ---------------------------------------------------------------- staff

create or replace function add_shift(p_org uuid, p_user uuid, p_facility uuid, p_starts timestamptz, p_ends timestamptz, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if not coalesce(_is_staff_role(_org_role(p_org, p_user)), false) then
    raise exception 'NOT_STAFF';
  end if;
  if p_facility is not null and not exists (select 1 from facilities where id = p_facility and organization_id = p_org) then
    raise exception 'FORBIDDEN';
  end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts or p_ends > p_starts + interval '16 hours' then
    raise exception 'INVALID_SHIFT';
  end if;
  if exists (select 1 from staff_shifts s where s.organization_id = p_org and s.user_id = p_user and s.starts_at < p_ends and s.ends_at > p_starts) then
    raise exception 'SHIFT_OVERLAPS';
  end if;
  insert into staff_shifts (organization_id, facility_id, user_id, starts_at, ends_at, note, created_by)
  values (p_org, p_facility, p_user, p_starts, p_ends, nullif(btrim(coalesce(p_note, '')), ''), auth.uid()) returning id into v_id;
  perform _notify(p_user, 'account', 'New shift', to_char(p_starts, 'YYYY-MM-DD HH24:MI') || ' UTC at ' || (select name from organizations where id = p_org) || '.', 'staff_shift', v_id);
  return v_id;
end $$;

create or replace function remove_shift(p_shift uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (select organization_id from staff_shifts where id = p_shift);
begin
  if v_org is null then
    raise exception 'FORBIDDEN';
  end if;
  perform _require_role(v_org, array['owner', 'manager']);
  delete from staff_shifts where id = p_shift;
end $$;

create or replace function list_shifts(p_org uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role(p_org, array['owner', 'manager', 'coach', 'physiotherapist', 'instructor']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'user_id', s.user_id, 'name', _display_name(s.user_id), 'facility', f.name,
                     'starts_at', s.starts_at, 'ends_at', s.ends_at, 'note', s.note, 'mine', s.user_id = auth.uid()) order by s.starts_at)
                   from staff_shifts s left join facilities f on f.id = s.facility_id
                   where s.organization_id = p_org and s.starts_at < p_to and s.ends_at > p_from), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- report

-- Weekly operations for owners and managers. Built only from classes,
-- bookings and memberships. Any count about fewer than five people is
-- hidden (null, with suppressed = true) so no individual can be singled out.
create or replace function studio_report(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  k constant integer := 5;
begin
  perform _require_role(p_org, array['owner', 'manager']);
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'RANGE_TOO_LONG';
  end if;
  return jsonb_build_object(
    'min_group_size', k,
    'weeks', coalesce((select jsonb_agg(jsonb_build_object(
        'week_start', wk,
        'classes', classes, 'cancelled', cancelled, 'capacity', capacity,
        'bookings', case when people >= k then booked end,
        'attended', case when people >= k then attended end,
        'people', case when people >= k then people end,
        'suppressed', people < k) order by wk)
      from (select wk,
                   count(*) filter (where status = 'scheduled') as classes,
                   count(*) filter (where status = 'cancelled') as cancelled,
                   coalesce(sum(capacity) filter (where status = 'scheduled'), 0) as capacity,
                   coalesce(sum(booked), 0) as booked,
                   coalesce(sum(attended), 0) as attended,
                   (select count(distinct b.user_id) from class_bookings b join class_sessions c2 on c2.id = b.class_id
                    where c2.organization_id = p_org and b.status = 'booked' and date_trunc('week', c2.starts_at at time zone 'UTC')::date = pc.wk) as people
            from (select c.status, c.capacity, date_trunc('week', c.starts_at at time zone 'UTC')::date as wk,
                         (select count(*) from class_bookings b where b.class_id = c.id and b.status = 'booked') as booked,
                         (select count(*) from class_bookings b where b.class_id = c.id and b.attended) as attended
                  from class_sessions c
                  where c.organization_id = p_org and (c.starts_at at time zone 'UTC')::date between p_from and p_to) pc
            group by wk) w), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(jsonb_build_object(
        'title', title, 'sessions', sessions,
        'occupancy', case when people >= k then round(booked::numeric / nullif(capacity, 0), 2) end,
        'attendance_rate', case when people >= k then round(attended::numeric / nullif(booked, 0), 2) end,
        'suppressed', people < k) order by title)
      from (select title, count(*) as sessions, sum(capacity) as capacity, sum(booked) as booked, sum(attended) as attended,
                   (select count(distinct b.user_id) from class_bookings b join class_sessions c2 on c2.id = b.class_id
                    where c2.organization_id = p_org and c2.title = pc.title and c2.status = 'scheduled' and b.status = 'booked'
                      and (c2.starts_at at time zone 'UTC')::date between p_from and p_to) as people
            from (select c.title, c.capacity,
                         (select count(*) from class_bookings b where b.class_id = c.id and b.status = 'booked') as booked,
                         (select count(*) from class_bookings b where b.class_id = c.id and b.attended) as attended
                  from class_sessions c
                  where c.organization_id = p_org and c.status = 'scheduled' and (c.starts_at at time zone 'UTC')::date between p_from and p_to) pc
            group by title) t), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('plan', name, 'active', case when n >= k then n end, 'suppressed', n < k) order by name)
      from (select p.name, count(ms.id) filter (where ms.status = 'active') as n from membership_plans p left join memberships ms on ms.plan_id = p.id
            where p.organization_id = p_org group by p.name) t), '[]'::jsonb)
  );
end $$;

do $$
declare
  fn text;
begin
  foreach fn in array array['_org_role(uuid, uuid)', '_require_role(uuid, text[])', '_seats_used(uuid)', '_remove_member(uuid, uuid)',
                            '_entitlement(uuid, uuid, date)', '_promote_waitlist(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'create_studio(text, text)', 'add_facility(uuid, text, text)', 'set_staff_seats(uuid, integer)',
    'invite_to_organization(uuid, text, text)', 'revoke_organization_invite(uuid)', 'accept_organization_invite(text)',
    'remove_from_organization(uuid, uuid)', 'leave_organization(uuid)', 'my_organizations()', 'organization_people(uuid)',
    'create_membership_plan(uuid, text, text, integer, text, integer)', 'set_plan_active(uuid, boolean)',
    'assign_membership(uuid, uuid, uuid, date)', 'update_membership(uuid, text, text, date)',
    'schedule_classes(uuid, uuid, text, text, uuid, timestamptz, integer, integer, integer, uuid)', 'cancel_class(uuid)',
    'list_classes(uuid, timestamptz, timestamptz)', 'book_class(uuid)', 'cancel_booking(uuid)', 'class_roster(uuid)',
    'mark_attendance(uuid, boolean)', 'class_workout(uuid)',
    'add_shift(uuid, uuid, uuid, timestamptz, timestamptz, text)', 'remove_shift(uuid)', 'list_shifts(uuid, timestamptz, timestamptz)',
    'studio_report(uuid, date, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- The athlete's own studio records join the export.
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
    'studio', jsonb_build_object(
      'organizations', coalesce((select jsonb_agg(jsonb_build_object('organization_id', m.organization_id, 'name', o.name, 'role', m.role, 'joined_at', m.created_at))
                                 from organization_members m join organizations o on o.id = m.organization_id where m.user_id = uid), '[]'::jsonb),
      'memberships', coalesce((select jsonb_agg(to_jsonb(ms)) from memberships ms where ms.user_id = uid), '[]'::jsonb),
      'bookings', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object('class_title', c.title, 'starts_at', c.starts_at) order by c.starts_at)
                            from class_bookings b join class_sessions c on c.id = b.class_id where b.user_id = uid), '[]'::jsonb),
      'shifts', coalesce((select jsonb_agg(to_jsonb(s)) from staff_shifts s where s.user_id = uid), '[]'::jsonb)
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
