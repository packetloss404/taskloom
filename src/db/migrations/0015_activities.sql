drop index if exists idx_activities_workspace;
drop table if exists activities;

create table if not exists activities (
  id text primary key,
  workspace_id text not null,
  occurred_at text not null,
  type text not null,
  payload text not null check (json_valid(payload)),
  user_id text,
  related_subject text
);

create index if not exists idx_activities_workspace_occurred
  on activities (workspace_id, occurred_at desc, id);
