-- FORM — assistant meal parsing (roadmap Step 5)
--
-- Run AFTER 0007_nutrition.sql. Safe to run more than once.
--
-- The assistant can now turn a meal description into draft food-log items.
-- The draft goes straight back to the app for the athlete to check and is
-- never stored; only the run is logged, like every other assistant request.

alter table agent_runs drop constraint if exists agent_runs_workflow_check;
alter table agent_runs add constraint agent_runs_workflow_check
  check (workflow in ('workout_import', 'workout_adaptation', 'proposal_revision', 'meal_parse'));
