drop table if exists agent_runs;

create table if not exists agent_runs (
  id text primary key,
  workspace_id text not null,
  agent_id text,
  title text not null,
  status text not null,
  trigger_kind text,
  started_at text,
  completed_at text,
  inputs text check (inputs is null or json_valid(inputs)),
  output text,
  error text,
  logs text not null check (json_valid(logs)),
  tool_calls text check (tool_calls is null or json_valid(tool_calls)),
  transcript text check (transcript is null or json_valid(transcript)),
  model_used text,
  cost_usd real,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_agent_runs_workspace_created
  on agent_runs (workspace_id, created_at desc, id);

create index if not exists idx_agent_runs_workspace_agent_created
  on agent_runs (workspace_id, agent_id, created_at desc, id);
