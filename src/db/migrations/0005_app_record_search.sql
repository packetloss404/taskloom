create table if not exists app_record_search (
  collection text not null,
  id text not null,
  workspace_id text null,
  user_id text null,
  email text null,
  token text null,
  primary key (collection, id),
  foreign key (collection, id) references app_records (collection, id) on delete cascade
);

create index if not exists idx_app_record_search_users_email
  on app_record_search (email)
  where collection = 'users' and email is not null;

create index if not exists idx_app_record_search_sessions_user
  on app_record_search (user_id)
  where collection = 'sessions' and user_id is not null;

create index if not exists idx_app_record_search_memberships_workspace_user
  on app_record_search (workspace_id, user_id)
  where collection = 'memberships';

create index if not exists idx_app_record_search_invitations_token
  on app_record_search (token)
  where collection = 'workspaceInvitations' and token is not null;

create index if not exists idx_app_record_search_invitations_workspace
  on app_record_search (workspace_id)
  where collection = 'workspaceInvitations' and workspace_id is not null;

create index if not exists idx_app_record_search_share_tokens_token
  on app_record_search (token)
  where collection = 'shareTokens' and token is not null;

create index if not exists idx_app_record_search_share_tokens_workspace
  on app_record_search (workspace_id)
  where collection = 'shareTokens' and workspace_id is not null;

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
where collection in ('users', 'sessions', 'memberships', 'workspaceInvitations', 'shareTokens');
