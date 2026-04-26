create table if not exists app_records (
  collection text not null,
  id text not null,
  workspace_id text null,
  payload text not null check (json_valid(payload)),
  updated_at text null,
  primary key (collection, id)
);

create index if not exists idx_app_records_workspace
  on app_records (workspace_id, collection);
