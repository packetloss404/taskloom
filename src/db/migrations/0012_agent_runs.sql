-- Non-destructive reshape of agent_runs.
-- The 0003 schema created agent_runs with *_json column names (inputs_json,
-- logs_json, tool_calls_json, transcript_json). This migration moves to the
-- new shape (inputs, logs, tool_calls, transcript) WITHOUT dropping data.
--
-- The old table is guaranteed to exist here: 0003_app_runtime.sql always runs
-- first and creates agent_runs via `create table if not exists`. We build the
-- new table under a temp name, copy+transform every row, then swap names so the
-- final table is `agent_runs` with the new schema. This whole file runs inside a
-- single transaction (db.exec) and is guarded by schema_migrations, so it runs
-- exactly once. As a defence-in-depth safety net, cli.ts also takes a timestamped
-- backup of the DB before applying any migration containing `drop table`.

drop index if exists idx_agent_runs_workspace;
drop index if exists idx_agent_runs_agent;

create table if not exists agent_runs_v2 (
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

-- Copy existing rows from the old 0003-shaped table, mapping *_json -> new names.
-- logs is NOT NULL: coalesce to an empty JSON array for any legacy null rows.
insert or ignore into agent_runs_v2 (
  id, workspace_id, agent_id, title, status, trigger_kind,
  started_at, completed_at, inputs, output, error,
  logs, tool_calls, transcript, model_used, cost_usd,
  created_at, updated_at
)
select
  id, workspace_id, agent_id, title, status, trigger_kind,
  started_at, completed_at, inputs_json, output, error,
  coalesce(logs_json, '[]'), tool_calls_json, transcript_json, model_used, cost_usd,
  created_at, updated_at
from agent_runs;

drop table agent_runs;
alter table agent_runs_v2 rename to agent_runs;

create index if not exists idx_agent_runs_workspace_created
  on agent_runs (workspace_id, created_at desc, id);

create index if not exists idx_agent_runs_workspace_agent_created
  on agent_runs (workspace_id, agent_id, created_at desc, id);
