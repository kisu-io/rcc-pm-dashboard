-- RCC PM Dashboard — schema v1.8: drop progress_pct auto-trigger
-- The recompute_project_progress trigger was auto-setting projects.progress_pct
-- to avg(tasks.progress_pct) on every task write. This conflicts with the new
-- hybrid logic where progress_pct=0 means "auto-calc Done/total in the app"
-- and progress_pct>0 means "PM override". The trigger always sets a non-zero
-- value, so the app's auto-calc path never runs.
--
-- Fix: drop the trigger so progress_pct stays at whatever the PM sets (0 = auto).
-- The app's effectiveProgress() helper handles the calculation now.
-- Idempotent: safe to re-run.

drop trigger if exists trg_recompute_progress_ins on tasks;
drop trigger if exists trg_recompute_progress_upd on tasks;
drop trigger if exists trg_recompute_progress_del on tasks;

-- Keep the function (harmless if unused) or drop it:
drop function if exists recompute_project_progress();

-- Reset all projects to progress_pct=0 so app auto-calcs from Done/total tasks.
-- (PM can still manually override by setting >0 via Edit Project.)
update projects set progress_pct = 0;