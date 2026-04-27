create table if not exists alert_events (
  id text primary key,
  rule_id text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  detail text not null,
  observed_at text not null,
  context text not null check (json_valid(context)),
  delivered integer not null check (delivered in (0, 1)),
  delivery_error text,
  delivery_attempts integer,
  last_delivery_attempt_at text,
  dead_lettered integer check (dead_lettered in (0, 1) or dead_lettered is null)
) without rowid;

create index if not exists idx_alert_events_observed_at
  on alert_events (observed_at desc, id);

create index if not exists idx_alert_events_severity_observed_at
  on alert_events (severity, observed_at desc, id);
