-- Non-destructive reshape of jobs.
-- The 0003 schema created jobs with *_json column names (payload_json,
-- result_json). This migration moves to the new shape (payload, result) WITHOUT
-- dropping the job queue. The old table is guaranteed to exist (0003 creates it
-- via `create table if not exists`). We build the new table under a temp name,
-- copy+transform every row, then swap names. Runs once (schema_migrations) inside
-- a single transaction. cli.ts also takes a pre-migration backup as a safety net.

drop index if exists idx_jobs_status;
drop index if exists idx_jobs_workspace;

create table if not exists jobs_v2 (
  id text primary key,
  workspace_id text not null,
  type text not null,
  payload text not null check (json_valid(payload)),
  status text not null check (status in ('queued', 'running', 'success', 'failed', 'canceled')),
  attempts integer not null,
  max_attempts integer not null,
  scheduled_at text not null,
  started_at text,
  completed_at text,
  cron text,
  result text check (result is null or json_valid(result)),
  error text,
  cancel_requested integer check (cancel_requested in (0, 1) or cancel_requested is null),
  created_at text not null,
  updated_at text not null
);

-- payload is NOT NULL: coalesce legacy nulls to an empty JSON object.
insert or ignore into jobs_v2 (
  id, workspace_id, type, payload, status, attempts, max_attempts,
  scheduled_at, started_at, completed_at, cron, result, error,
  cancel_requested, created_at, updated_at
)
select
  id, workspace_id, type, coalesce(payload_json, '{}'), status, attempts, max_attempts,
  scheduled_at, started_at, completed_at, cron, result_json, error,
  cancel_requested, created_at, updated_at
from jobs;

drop table jobs;
alter table jobs_v2 rename to jobs;

create index if not exists idx_jobs_workspace_created
  on jobs (workspace_id, created_at desc, id);

create index if not exists idx_jobs_status_scheduled
  on jobs (status, scheduled_at, id);

create index if not exists idx_jobs_status_started
  on jobs (status, started_at);
