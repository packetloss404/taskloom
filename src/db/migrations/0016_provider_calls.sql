drop index if exists idx_provider_calls_workspace;
drop table if exists provider_calls;

create table if not exists provider_calls (
  id text primary key,
  workspace_id text not null,
  route_key text not null,
  provider text not null,
  model text not null,
  prompt_tokens integer not null,
  completion_tokens integer not null,
  cost_usd real not null,
  duration_ms integer not null,
  status text not null check (status in ('success', 'error', 'canceled')),
  error_message text,
  started_at text not null,
  completed_at text not null
);

create index if not exists idx_provider_calls_workspace_completed
  on provider_calls (workspace_id, completed_at desc, id);
