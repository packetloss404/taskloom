create table if not exists activation_signals (
  id text primary key,
  workspace_id text not null,
  kind text not null check (kind in ('retry', 'scope_change')),
  source text not null check (source in ('activity', 'agent_run', 'workflow', 'seed', 'user_fact', 'system_fact')),
  origin text check (origin is null or origin in ('user_entered', 'system_observed')),
  source_id text,
  stable_key text,
  data text check (data is null or json_valid(data)),
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_activation_signals_workspace_created
  on activation_signals (workspace_id, created_at asc, id);

create unique index if not exists idx_activation_signals_workspace_stable_key
  on activation_signals (workspace_id, stable_key)
  where stable_key is not null;
