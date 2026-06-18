-- Non-destructive reshape of provider_calls.
-- The 0003 schema and the new schema have identical columns, so this is a clean
-- 1:1 copy that preserves all billing / provider-call records. The old table is
-- guaranteed to exist (0003 creates it via `create table if not exists`). We
-- build the new table under a temp name, copy every row, then swap names. Runs
-- once (schema_migrations) inside a single transaction. cli.ts also takes a
-- pre-migration backup as a safety net.

drop index if exists idx_provider_calls_workspace;

create table if not exists provider_calls_v2 (
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

insert or ignore into provider_calls_v2 (
  id, workspace_id, route_key, provider, model, prompt_tokens, completion_tokens,
  cost_usd, duration_ms, status, error_message, started_at, completed_at
)
select
  id, workspace_id, route_key, provider, model, prompt_tokens, completion_tokens,
  cost_usd, duration_ms, status, error_message, started_at, completed_at
from provider_calls;

drop table provider_calls;
alter table provider_calls_v2 rename to provider_calls;

create index if not exists idx_provider_calls_workspace_completed
  on provider_calls (workspace_id, completed_at desc, id);
