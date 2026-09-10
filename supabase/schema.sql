-- FORM app schema
-- Run this in the Supabase SQL editor for your project.
-- Every table is scoped to auth.uid() via row-level security, so each
-- signed-in user only ever sees their own data.

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric not null,
  body_fat_pct numeric not null,
  muscle_mass_kg numeric not null,
  bmi numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create table if not exists strength_lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise text not null,
  recorded_on date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists endurance_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  distance text not null, -- '400m' | '1km' | '5km'
  recorded_on date not null,
  duration_sec integer not null,
  avg_heart_rate integer,
  vo2max numeric,
  pace_sec_per_km integer,
  distance_km numeric,
  created_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_on date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  label text not null,
  unit text not null,
  current_value numeric not null,
  target_value numeric not null,
  higher_is_better boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  icon text not null,
  color text,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table body_metrics enable row level security;
alter table strength_lifts enable row level security;
alter table endurance_sessions enable row level security;
alter table workouts enable row level security;
alter table goals enable row level security;
alter table insights enable row level security;

create policy "Users manage their own body_metrics" on body_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own strength_lifts" on strength_lifts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own endurance_sessions" on endurance_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own workouts" on workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own insights" on insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
