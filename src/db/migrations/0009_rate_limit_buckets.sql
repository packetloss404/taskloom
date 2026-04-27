create table if not exists rate_limit_buckets (
  id text primary key,
  count integer not null check (count >= 0),
  reset_at text not null,
  updated_at text not null
);

create index if not exists idx_rate_limit_buckets_reset_at
  on rate_limit_buckets (reset_at);

create index if not exists idx_rate_limit_buckets_updated_at
  on rate_limit_buckets (updated_at);

insert or replace into rate_limit_buckets (id, count, reset_at, updated_at)
select
  id,
  coalesce(cast(json_extract(payload, '$.count') as integer), 0),
  json_extract(payload, '$.resetAt'),
  json_extract(payload, '$.updatedAt')
from app_records
where collection = 'rateLimits'
  and json_extract(payload, '$.resetAt') is not null
  and json_extract(payload, '$.updatedAt') is not null;

delete from app_records
where collection = 'rateLimits';
