create index if not exists idx_app_records_invitation_email_deliveries_created
  on app_records (workspace_id, json_extract(payload, '$.createdAt') desc, id)
  where collection = 'invitationEmailDeliveries' and workspace_id is not null;

insert or replace into app_record_search (collection, id, workspace_id, user_id, email, token)
select
  collection,
  id,
  workspace_id,
  null,
  null,
  null
from app_records
where collection = 'invitationEmailDeliveries';
