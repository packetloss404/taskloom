drop table if exists jobs;

create table if not exists jobs (
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

create index if not exists idx_jobs_workspace_created
  on jobs (workspace_id, created_at desc, id);

create index if not exists idx_jobs_status_scheduled
  on jobs (status, scheduled_at, id);

create index if not exists idx_jobs_status_started
  on jobs (status, started_at);
