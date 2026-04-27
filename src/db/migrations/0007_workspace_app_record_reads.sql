create index if not exists idx_app_records_collection_workspace_updated
  on app_records (collection, workspace_id, updated_at desc, id)
  where workspace_id is not null;

create index if not exists idx_app_records_plan_order
  on app_records (workspace_id, json_extract(payload, '$.order'), id)
  where collection = 'implementationPlanItems' and workspace_id is not null;

create index if not exists idx_app_records_brief_versions_order
  on app_records (workspace_id, json_extract(payload, '$.versionNumber') desc, id)
  where collection = 'workspaceBriefVersions' and workspace_id is not null;

create index if not exists idx_app_records_activity_occurred
  on app_records (workspace_id, json_extract(payload, '$.occurredAt') desc, id)
  where collection = 'activities' and workspace_id is not null;

create index if not exists idx_app_records_provider_calls_completed
  on app_records (workspace_id, json_extract(payload, '$.completedAt') desc, id)
  where collection = 'providerCalls' and workspace_id is not null;

insert or replace into app_record_search (collection, id, workspace_id, user_id, email, token)
select
  collection,
  id,
  workspace_id,
  case
    when collection in ('sessions', 'memberships') then json_extract(payload, '$.userId')
    else null
  end,
  case
    when collection = 'users' then lower(json_extract(payload, '$.email'))
    else null
  end,
  case
    when collection in ('workspaceInvitations', 'shareTokens') then json_extract(payload, '$.token')
    else null
  end
from app_records
where collection in (
  'users',
  'sessions',
  'workspaces',
  'memberships',
  'workspaceInvitations',
  'shareTokens',
  'activationSignals',
  'workspaceBriefs',
  'workspaceBriefVersions',
  'requirements',
  'implementationPlanItems',
  'workflowConcerns',
  'validationEvidence',
  'releaseConfirmations',
  'activities',
  'agents',
  'providers',
  'agentRuns',
  'workspaceEnvVars',
  'jobs',
  'providerCalls'
);
