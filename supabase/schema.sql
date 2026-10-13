-- FORM app schema — base tables
-- Run this in the Supabase SQL editor for your project, then run each file
-- in supabase/migrations/ in order.
--
-- Every table is scoped to auth.uid() via row-level security, so each
-- signed-in user only ever sees their own data.
--
-- These two tables are not written by the app yet: body measurements have no
-- entry screen, and goals are replaced by the full goal model in roadmap
-- Step 10. They are included in the athlete's data export.

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

alter table body_metrics enable row level security;
alter table goals enable row level security;

drop policy if exists "Users manage their own body_metrics" on body_metrics;
create policy "Users manage their own body_metrics" on body_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own goals" on goals;
create policy "Users manage their own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
