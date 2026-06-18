-- Non-destructive reshape of activities.
-- The 0003 schema and the new schema have INCOMPATIBLE column sets:
--   old: (id, workspace_id, scope, event, actor_json, data_json, occurred_at)
--   new: (id, workspace_id, occurred_at, type, payload, user_id, related_subject)
-- Rather than dropping the activity log, we migrate every row with the best
-- available mapping:
--   type            <- event           (the activity event name)
--   payload         <- data_json       (coalesced to '{}' since payload is NOT NULL
--                                        and must be valid JSON)
--   user_id         <- actor_json ->> '$.userId' / '$.id' (best-effort actor id)
--   related_subject <- scope           (preserves the old account/workspace/activation scope)
-- occurred_at and the id/workspace_id map 1:1.
--
-- The old table is guaranteed to exist (0003 creates it via
-- `create table if not exists`). We build the new table under a temp name, copy +
-- transform, then swap names. Runs once (schema_migrations) inside a single
-- transaction. cli.ts also takes a pre-migration backup as a safety net, so even
-- where this mapping is lossy the original rows remain recoverable from the .bak.

drop index if exists idx_activities_workspace;

create table if not exists activities_v2 (
  id text primary key,
  workspace_id text not null,
  occurred_at text not null,
  type text not null,
  payload text not null check (json_valid(payload)),
  user_id text,
  related_subject text
);

insert or ignore into activities_v2 (
  id, workspace_id, occurred_at, type, payload, user_id, related_subject
)
select
  id,
  workspace_id,
  occurred_at,
  event,
  case
    when data_json is not null and json_valid(data_json) then data_json
    else '{}'
  end,
  case
    when actor_json is not null and json_valid(actor_json)
      then coalesce(json_extract(actor_json, '$.userId'), json_extract(actor_json, '$.id'))
    else null
  end,
  scope
from activities;

drop table activities;
alter table activities_v2 rename to activities;

create index if not exists idx_activities_workspace_occurred
  on activities (workspace_id, occurred_at desc, id);
