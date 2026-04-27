create table if not exists job_metric_snapshots (
  id text primary key,
  captured_at text not null,
  type text not null,
  total_runs integer not null,
  succeeded_runs integer not null,
  failed_runs integer not null,
  canceled_runs integer not null,
  last_run_started_at text,
  last_run_finished_at text,
  last_duration_ms integer,
  average_duration_ms integer,
  p95_duration_ms integer
) without rowid;

create index if not exists idx_job_metric_snapshots_captured_at
  on job_metric_snapshots (captured_at desc, id);

create index if not exists idx_job_metric_snapshots_type_captured_at
  on job_metric_snapshots (type, captured_at desc, id);
