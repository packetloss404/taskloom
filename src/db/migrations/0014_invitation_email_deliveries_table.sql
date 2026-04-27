create table if not exists invitation_email_deliveries (
  id text primary key,
  workspace_id text not null,
  invitation_id text not null,
  recipient_email text not null,
  subject text not null,
  status text not null,
  provider text not null,
  mode text not null,
  created_at text not null,
  sent_at text,
  error text,
  provider_status text,
  provider_delivery_id text,
  provider_status_at text,
  provider_error text
) without rowid;

create index if not exists idx_invitation_email_deliveries_workspace_created
  on invitation_email_deliveries (workspace_id, created_at desc, id);

create index if not exists idx_invitation_email_deliveries_invitation
  on invitation_email_deliveries (invitation_id, created_at desc, id);
