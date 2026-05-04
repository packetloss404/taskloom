create table if not exists sandbox_execs (
  id text primary key,
  workspace_id text not null,
  app_id text,
  checkpoint_id text,
  sandbox_id text not null,
  driver text not null check (driver in ('docker', 'native')),
  runtime text not null,
  command text not null,
  working_dir text not null,
  env text check (env is null or json_valid(env)),
  status text not null check (status in ('queued', 'running', 'success', 'failed', 'timeout', 'canceled')),
  exit_code integer,
  started_at text,
  completed_at text,
  duration_ms integer,
  stdout_preview text,
  stderr_preview text,
  error_message text,
  cpu_limit_ms integer,
  memory_limit_mb integer,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_sandbox_execs_workspace_created
  on sandbox_execs (workspace_id, created_at desc, id);

create index if not exists idx_sandbox_execs_workspace_app_created
  on sandbox_execs (workspace_id, app_id, created_at desc, id);

create index if not exists idx_sandbox_execs_workspace_status
  on sandbox_execs (workspace_id, status, created_at desc, id);
