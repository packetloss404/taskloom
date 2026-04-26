create table if not exists activation_tracks (
  id text primary key,
  workspace_id text not null,
  subject_type text not null,
  subject_id text not null,
  started_at text null,
  current_stage text not null default 'not_started',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (workspace_id, subject_type, subject_id),
  check (current_stage in (
    'not_started',
    'discovery',
    'definition',
    'implementation',
    'validation',
    'complete',
    'blocked'
  ))
);

create index if not exists idx_activation_tracks_workspace
  on activation_tracks (workspace_id, current_stage);

create table if not exists activation_milestones (
  id text primary key,
  workspace_id text not null,
  subject_type text not null,
  subject_id text not null,
  key text not null,
  reached_at text not null,
  source text not null default 'system',
  notes text null,
  created_at text not null default (datetime('now')),
  unique (workspace_id, subject_type, subject_id, key),
  check (key in (
    'intake_ready',
    'scope_defined',
    'build_started',
    'build_complete',
    'validated',
    'released',
    'blocked'
  ))
);

create index if not exists idx_activation_milestones_workspace
  on activation_milestones (workspace_id, subject_type, subject_id, reached_at desc);

create table if not exists activation_checklist_items (
  id text primary key,
  workspace_id text not null,
  subject_type text not null,
  subject_id text not null,
  key text not null,
  completed integer not null default 0,
  completed_at text null,
  source text not null default 'system',
  notes text null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (workspace_id, subject_type, subject_id, key),
  check (completed in (0, 1)),
  check (key in (
    'brief_captured',
    'requirements_defined',
    'implementation_started',
    'validation_completed',
    'release_confirmed'
  ))
);

create index if not exists idx_activation_checklist_workspace
  on activation_checklist_items (workspace_id, subject_type, subject_id, completed);
