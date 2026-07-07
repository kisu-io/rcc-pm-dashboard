-- RCC PM Dashboard — schema v1.7: per-project phase percentages
-- Adds 5 nullable numeric columns to projects for direct phase % data entry.
-- When NULL, phase % is derived from tasks (via classifyPhase helper in app).
-- When set (0..100), stored value takes precedence.
-- Idempotent: safe to re-run.

alter table projects
  add column if not exists pct_legal numeric(5,2) default 0;

alter table projects
  add column if not exists pct_design numeric(5,2) default 0;

alter table projects
  add column if not exists pct_procurement numeric(5,2) default 0;

alter table projects
  add column if not exists pct_construction numeric(5,2) default 0;

alter table projects
  add column if not exists pct_sales numeric(5,2) default 0;

-- Optional: helpful comment for future schema readers
comment on column projects.pct_legal is 'Pháp lý % (0..100). NULL/0 = derive from tasks with phase=Legal/Permit.';
comment on column projects.pct_design is 'Thiết kế % (0..100). NULL/0 = derive from tasks with phase=Design.';
comment on column projects.pct_procurement is 'Cung ứng-Đấu thầu % (0..100). NULL/0 = derive from tasks with phase=Procurement/Tender.';
comment on column projects.pct_construction is 'Thi công % (0..100). NULL/0 = derive from tasks with phase=Construction/MEP/Inspection.';
comment on column projects.pct_sales is 'Sales & marketing % (0..100). NULL/0 = derive from tasks with phase=Sales/Marketing.';