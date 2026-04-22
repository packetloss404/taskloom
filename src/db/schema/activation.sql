create table activation_tracks (
  id uuid primary key,
  workspace_id uuid not null,
  subject_type text not null,
  subject_id text not null,
  started_at timestamptz null,
  current_stage text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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

create index idx_activation_tracks_workspace
  on activation_tracks (workspace_id, current_stage);

create table activation_milestones (
  id uuid primary key,
  workspace_id uuid not null,
  subject_type text not null,
  subject_id text not null,
  key text not null,
  reached_at timestamptz not null,
  source text not null default 'system',
  notes text null,
  created_at timestamptz not null default now(),
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

create index idx_activation_milestones_workspace
  on activation_milestones (workspace_id, subject_type, subject_id, reached_at desc);

create table activation_checklist_items (
  id uuid primary key,
  workspace_id uuid not null,
  subject_type text not null,
  subject_id text not null,
  key text not null,
  completed boolean not null default false,
  completed_at timestamptz null,
  source text not null default 'system',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, subject_type, subject_id, key),
  check (key in (
    'brief_captured',
    'requirements_defined',
    'implementation_started',
    'validation_completed',
    'release_confirmed'
  ))
);

create index idx_activation_checklist_workspace
  on activation_checklist_items (workspace_id, subject_type, subject_id, completed);
