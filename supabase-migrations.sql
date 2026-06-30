-- RCC PM Dashboard — schema v1.3
-- Adds: documents table columns for drive-style management

-- Add columns if missing
alter table documents add column if not exists size bigint;
alter table documents add column if not exists mimetype text;
alter table documents add column if not exists folder_path text default '';
alter table documents add column if not exists is_folder boolean default false;

-- Index for folder navigation
create index if not exists idx_documents_folder on documents(folder_path);
create index if not exists idx_documents_project on documents(project_id);

-- Backfill existing rows' folder_path to ''
update documents set folder_path = '' where folder_path is null;