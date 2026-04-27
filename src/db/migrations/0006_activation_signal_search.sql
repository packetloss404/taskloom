create index if not exists idx_app_records_activation_signals_workspace
  on app_records (workspace_id, updated_at)
  where collection = 'activationSignals' and workspace_id is not null;

create unique index if not exists idx_app_records_activation_signals_stable_key
  on app_records (workspace_id, json_extract(payload, '$.stableKey'))
  where collection = 'activationSignals' and json_extract(payload, '$.stableKey') is not null;
