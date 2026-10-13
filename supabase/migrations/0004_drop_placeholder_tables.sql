-- FORM — remove placeholder tables from the first schema
--
-- Run AFTER 0003_athlete_foundation.sql. Safe to run more than once.
--
-- The first schema created four tables that only ever backed demo screens:
-- `strength_lifts`, `endurance_sessions`, `insights`, and a placeholder
-- `workouts` (date + completed flag) that migration 0002 renamed to
-- `workouts_legacy`. Strength and endurance trends and insights are now
-- computed from logged sessions, so nothing reads these tables.
--
-- A table is dropped only if it is empty. If one holds rows, it is left in
-- place and a notice says so, so nothing anyone stored is lost.

do $$
declare
  t text;
  has_rows boolean;
begin
  foreach t in array array['workouts_legacy', 'strength_lifts', 'endurance_sessions', 'insights'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('select exists (select 1 from public.%I)', t) into has_rows;
    if has_rows then
      raise notice 'Table % still holds rows and was kept.', t;
    else
      execute format('drop table public.%I', t);
    end if;
  end loop;
end $$;
