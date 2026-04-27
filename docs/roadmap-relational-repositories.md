# Roadmap: Relational repositories

## 1. Goal and non-goals

Goal: enable hot collections in the SQLite runtime to live in dedicated relational tables for query efficiency, bounded memory, and operationally inspectable schema, while preserving the JSON-default runtime, the existing `loadStore()`/`mutateStore()` API surface, and the 543 API plus 15 web test suite at every phase boundary.

In scope:

- New SQLite tables behind sequential migrations under `src/db/migrations/`.
- Repository-style modules under a new `src/repositories/` directory that switch on `process.env.TASKLOOM_STORE` and fall back to the existing JSON `mutateStore` array path.
- Operator-invoked CLI backfills under `src/db/cli.ts` with idempotent `INSERT OR IGNORE` semantics and a `--dry-run` mode plus paired `db:verify-<collection>` drift commands.
- Dual-write, then read-cutover, then JSON-side drop. Three-phase per collection. JSON store keeps holding the collection during dual-write so JSON-default runtime and JSON-mode tests are unaffected.
- Documentation updates to `docs/deployment-sqlite-topology.md`, `docs/roadmap.md`, and `README.md` once each migration step lands.

Out of scope:

- Managed Postgres support, multi-region replication, or a cross-database query planner.
- Schemaless JSONB-style columns. SQLite tables get explicit columns plus a single `payload TEXT` mirror only where the record carries an open-ended sub-shape (for example `JobRecord.payload` and `AlertEventRecord.context`).
- Online schema migrations or zero-downtime DDL. Down migrations remain unsupported; rollback is `db:restore` from a pre-migration backup, matching the posture in `docs/deployment-sqlite-topology.md`.
- Changing `loadStore()` semantics to lazy-load specific collections. `loadStore()` keeps returning a fully-hydrated `TaskloomData` so existing call sites continue working. After Phase 38, SQLite hydration reads the migrated collections from their dedicated tables while JSON-default mode keeps the inline arrays.

## 2. Current topology audit

Source: `src/taskloom-store.ts` (`TaskloomData` at line 494, `RECORD_COLLECTIONS` at line 744, indexed helpers at lines 966 onward and 1090, 1163, 1269). Workspace-keyed indexed helpers already exist for jobs (`listJobsForWorkspaceIndexed`), agent runs (`listAgentRunsForWorkspaceIndexed`), invitation deliveries (`listInvitationEmailDeliveriesIndexed`), and provider calls (`listProviderCallsForWorkspaceIndexed`). Activities, agents, providers, and workspace records ride on `listWorkspaceRecordsIndexed`.

| Collection | Growth profile | Current SQLite read shape | Verdict |
|---|---|---|---|
| `jobMetricSnapshots` | Append-only, ts-keyed; one row per `metrics.snapshot` cron tick (Phase 28). 30-day retention by default. No FK dependents. | Whole-store JSON (`data.jobMetricSnapshots`); no indexed helper | **MIGRATE-PHASE-1** |
| `alertEvents` | Append-only, ts-keyed; one row per `alerts.evaluate` rule fire (Phase 29). Mutated on retry to update `deliveryAttempts`/`deadLettered`. 30-day retention. | Whole-store JSON; no indexed helper | **MIGRATE-PHASE-2** |
| `agentRuns` | Append-only-ish; one row per agent execution. Updated during run with logs, transcript, tool-call timeline. FK to `agents`. Read by workspace, by agent, by id. | `listAgentRunsForWorkspaceIndexed`, `listAgentRunsForAgentIndexed`, `findAgentRunForWorkspaceIndexed` via `app_record_search` plus `idx_app_records_collection_workspace_updated` | **MIGRATE-PHASE-3** |
| `jobs` | Mutated heavily: status churn through `queued -> running -> success|failed|canceled`, attempts increment, retry sweep on stale running. Read by workspace, by id, by status; sorted by `scheduledAt` for `claimNextJob`. FK to `agents`/`workspaces`. | `listJobsForWorkspaceIndexed`, `findJobIndexed`, and SQLite-mode repository transactional `claimNextJob`/`sweepStaleRunningJobs`; JSON mode keeps full-store iteration for scheduler claim/sweep | **MIGRATE-PHASE-4** |
| `invitationEmailDeliveries` | Append-only with later `providerStatus`/`providerError` updates from Phase 22 webhook. Indexed by workspace and invitation. | `listInvitationEmailDeliveriesIndexed` plus `idx_app_records_invitation_email_deliveries_created` | **MIGRATE-PHASE-5** |
| `activities` | Append-only, ts-keyed (`occurredAt desc`). Read by workspace and for activity detail. | `listWorkspaceRecordsIndexed("activities", ..., orderBy: "occurredAtDesc")` plus `idx_app_records_activity_occurred` | **MIGRATE-PHASE-6** |
| `providerCalls` | Append-only, ts-keyed. Used for usage rollups. | `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` plus `idx_app_records_provider_calls_completed`; Phase 39 redirects through a dedicated repository | **MIGRATE-PHASE-7 / PHASE-39 CUTOVER** |
| `agentRuns` log/tool-call sub-arrays | Embedded arrays inside `AgentRunRecord` | Inlined in JSON payload | **KEEP-IN-JSON** (sub-arrays travel with the parent row; no separate normalization in this roadmap) |
| `users`, `sessions`, `workspaces`, `memberships`, `workspaceInvitations`, `shareTokens` | Slow growth or session-rotated. Already covered by `app_record_search` indexes. | Indexed by token/email/user/workspace through `app_record_search` | **KEEP-IN-JSON** for now |
| `workspaceBriefs`, `workspaceBriefVersions`, `requirements`, `implementationPlanItems`, `workflowConcerns`, `validationEvidence`, `releaseConfirmations`, `workspaceEnvVars`, `apiKeys` | Bounded per workspace; small. | Already indexed via `idx_app_records_*` | **KEEP-IN-JSON** |
| `activationSignals` | Bounded per workspace; first-class repository already exists at `activationSignalRepository()` and is used for retry/scope-change signal writes. | Phase 40 moves the SQLite repository path to `activation_signals`; the post-Phase-40 mirror-retirement follow-up retires the SQLite `app_records` mirror while JSON mode keeps the inline collection. | **MIGRATE-PHASE-8 / PHASE-40 CUTOVER + MIRROR RETIREMENT** |
| `onboardingStates`, `apiKeys` | Per-user/per-workspace, small | Whole-store JSON | **KEEP-IN-JSON** |
| `activationFacts`, `activationMilestones`, `activationReadModels` | Map-shaped projection; already partially relational via `activation_*` tables in migration `0001` for activation tracking | Map under `MAP_COLLECTIONS` | **KEEP-IN-JSON** at the store layer; activation already has its own tables |
| `rateLimits` | Already migrated to dedicated `rate_limit_buckets` in migration `0009`. | Dedicated table | **DONE** (precedent for the pattern) |

## 3. Migration sequence

Recommendation: start with `jobMetricSnapshots`. The brief's instinct is correct. It's append-only, ts-keyed, has no foreign-key parents in `TaskloomData`, has a single read site (`listJobMetricSnapshots` in `src/jobs/job-metrics-snapshot.ts`), a single write site (`snapshotJobMetrics` in the same file), one prune site (`pruneJobMetricSnapshots`), and one CLI (`jobs:snapshot-metrics`). It's also the smallest blast radius for proving the dual-write and parity contract.

Each step takes the same shape:

1. Add migration SQL under `src/db/migrations/<NNNN>_<collection>.sql`.
2. Add repository module under `src/repositories/<collection>-repo.ts` exposing a factory `create<Collection>Repository(deps?)` that switches on `process.env.TASKLOOM_STORE` and returns either a JSON or SQLite implementation. Each implementation accepts the same dependency seam as `activationSignalRepository()` already does (no deps yet) and `snapshotJobMetrics` does (`loadStore`/`mutateStore`).
3. Redirect existing read helpers in `src/taskloom-store.ts` to the new repository in SQLite mode, keeping the JSON branch verbatim. Existing parity tests continue to assert that JSON mode returns identical rows; new SQLite mode now reads from the dedicated table.
4. Dual-write: in SQLite mode, the write helper writes to BOTH `app_records` (existing path) and the new dedicated table during the cutover phase. JSON mode is unchanged. The dedicated table is the source of truth for reads in SQLite mode; the `app_records` mirror exists only so a `db:restore` to a pre-cutover backup keeps working.
5. Backfill: add `db:backfill-<collection>` CLI command that reads existing `app_records` rows and inserts into the dedicated table with `INSERT OR IGNORE` keyed on the record id; add `--dry-run` and a paired `db:verify-<collection>` that reports drift between `app_records` JSON-side counts and the dedicated table.
6. After one stable phase (typically the next phase that lands), drop the `app_records` mirror write for that collection in a follow-up phase. The collection name is removed from `RECORD_COLLECTIONS` and from the `app_record_search` insert when its dual-write is retired. This is the "drop legacy JSON-side" step in section 10.

### Step 1: `jobMetricSnapshots`

DDL shape (migration `0010_job_metric_snapshots.sql`):

```
job_metric_snapshots (
  id              text primary key,
  captured_at     text not null,
  type            text not null,
  total_runs      integer not null,
  succeeded_runs  integer not null,
  failed_runs     integer not null,
  canceled_runs   integer not null,
  last_run_started_at  text null,
  last_run_finished_at text null,
  last_duration_ms      integer null,
  average_duration_ms   integer null,
  p95_duration_ms       integer null
) without rowid
```

Indexes: `idx_job_metric_snapshots_captured_at` on `(captured_at desc, id)` and `idx_job_metric_snapshots_type_captured_at` on `(type, captured_at desc, id)`.

`WITHOUT ROWID` is appropriate: append-only, lookups by id and by `(type, captured_at)` range.

Repository module: `src/repositories/job-metric-snapshots-repo.ts`. Surface `list(filter)`, `insertMany(records)`, `prune(cutoff)`, `count()`. The existing `snapshotJobMetrics`/`listJobMetricSnapshots`/`pruneJobMetricSnapshots` in `src/jobs/job-metrics-snapshot.ts` get wired through this repository in SQLite mode. JSON mode keeps using the inline `data.jobMetricSnapshots` array.

Dual-write: `snapshotJobMetrics` SQLite path inserts into both `app_records` and `job_metric_snapshots`. `pruneJobMetricSnapshots` deletes from both. `listJobMetricSnapshots` SQLite path reads from `job_metric_snapshots` and ignores `app_records`.

Backfill CLI: `npm run db:backfill-job-metric-snapshots [-- --dry-run]` plus `npm run db:verify-job-metric-snapshots`.

Test parity expectation: existing `src/jobs/job-metrics-snapshot.test.ts` (6 occurrences of `data.jobMetricSnapshots`) keeps passing as-is in JSON mode. A new `src/repositories/job-metric-snapshots-repo.test.ts` asserts JSON and SQLite implementations return identical rows for the operations exercised. `src/db-runtime-parity.test.ts` keeps passing.

### Step 2: `alertEvents`

DDL shape (migration `0011_alert_events.sql`):

```
alert_events (
  id           text primary key,
  rule_id      text not null,
  severity     text not null check (severity in ('info', 'warning', 'critical')),
  title        text not null,
  detail       text not null,
  observed_at  text not null,
  context      text not null check (json_valid(context)),
  delivered    integer not null check (delivered in (0, 1)),
  delivery_error text null,
  delivery_attempts integer null,
  last_delivery_attempt_at text null,
  dead_lettered integer null check (dead_lettered in (0, 1) or dead_lettered is null)
) without rowid
```

Indexes: `idx_alert_events_observed_at` on `(observed_at desc, id)` and `idx_alert_events_severity_observed_at` on `(severity, observed_at desc, id)`.

Note: `context` keeps the JSON column because `Record<string, unknown>` is its declared shape per `AlertEventRecord` (see `src/taskloom-store.ts:112`). This is the one-off mirror payload the non-goals section calls out as acceptable.

Repository: `src/repositories/alert-events-repo.ts` with `list({ severity, since, until, limit })`, `insertMany`, `updateDeliveryStatus(id, patch)`, `prune(cutoff)`. Existing `recordAlerts`, `updateAlertDeliveryStatus`, and `listAlerts` in `src/alerts/alert-store.ts` get redirected.

Dual-write, backfill, verify, and test parity follow the same shape as Step 1.

### Step 3: `agentRuns`

DDL shape (migration `0012_agent_runs.sql`):

```
agent_runs (
  id            text primary key,
  workspace_id  text not null,
  agent_id      text null,
  title         text not null,
  status        text not null,
  trigger_kind  text null,
  started_at    text null,
  completed_at  text null,
  inputs        text null check (inputs is null or json_valid(inputs)),
  output        text null,
  error         text null,
  logs          text not null check (json_valid(logs)),
  tool_calls    text null check (tool_calls is null or json_valid(tool_calls)),
  transcript    text null check (transcript is null or json_valid(transcript)),
  model_used    text null,
  cost_usd      real null,
  created_at    text not null,
  updated_at    text not null
)
```

Indexes: `idx_agent_runs_workspace_created` on `(workspace_id, created_at desc, id)`, `idx_agent_runs_workspace_agent_created` on `(workspace_id, agent_id, created_at desc, id)`.

`WITHOUT ROWID` not used: rows are mutated during the run.

FK note: `workspace_id` and `agent_id` reference `app_records` rows whose primary key is `(collection, id)` with TEXT id columns (UUIDs). Direct SQLite FK from `agent_runs.agent_id` to `app_records (collection='agents', id=...)` is not expressible in SQLite without a synthetic parent table; the migration declares no FK and the application layer remains the integrity boundary, matching the existing `rate_limit_buckets` posture from migration `0009`. ON DELETE: `agentRuns` survive their parent `agents` row for audit purposes today; the new table preserves that.

Repository: `src/repositories/agent-runs-repo.ts`. Redirects from `listAgentRunsForWorkspaceIndexed`, `listAgentRunsForAgentIndexed`, `findAgentRunForWorkspaceIndexed`, plus the `upsertAgentRun` path in `src/taskloom-store.ts:2752`. Sub-arrays (`logs`, `toolCalls`, `transcript`) stay JSON-encoded inside the row, matching the non-goal "no schemaless JSONB-style columns" exception called out for in-record sub-arrays.

### Step 4: `jobs`

DDL shape (migration `0013_jobs.sql`):

```
jobs (
  id            text primary key,
  workspace_id  text not null,
  type          text not null,
  payload       text not null check (json_valid(payload)),
  status        text not null check (status in ('queued','running','success','failed','canceled')),
  attempts      integer not null,
  max_attempts  integer not null,
  scheduled_at  text not null,
  started_at    text null,
  completed_at  text null,
  cron          text null,
  result        text null check (result is null or json_valid(result)),
  error         text null,
  cancel_requested integer null check (cancel_requested in (0,1) or cancel_requested is null),
  created_at    text not null,
  updated_at    text not null
)
```

Indexes: `idx_jobs_workspace_created` on `(workspace_id, created_at desc, id)`, `idx_jobs_status_scheduled` on `(status, scheduled_at, id)` for queued-job lookups, and `idx_jobs_status_started` on `(status, started_at)` for stale-running sweeps.

Repository: `src/repositories/jobs-repo.ts` with `list({ workspaceId, status, limit })`, `find(id)`, `insert(record)`, `update(id, patch)`, `claimNext(now)`, `sweepStaleRunning(cutoff)`, `cancel(id)`. The existing `src/jobs/store.ts` becomes a thin wrapper. `claimNextJob` no longer needs the in-process `claimMutex` mutex in SQLite mode because the repository performs claim/sweep updates inside a `BEGIN IMMEDIATE` transaction against the dedicated `jobs` table while preserving existing `Date.parse` timestamp semantics. JSON mode keeps the mutex.

This is the highest-risk step. Section 9 covers the risks.

**Phase 35 conservative-cutover note (actual rollout):** Phase 35 shipped per Option 2 of the user's review: the table, repository (including `claimNext`/`sweepStaleRunning` transactional primitives), dual-write, and CLI all landed while `src/jobs/store.ts`'s `claimNextJob` and `sweepStaleRunningJobs` temporarily kept the existing load-store-loop pattern with `claimMutex`. After Phase 38 retired the legacy JSON-side mirrors, the follow-up hot-path cutover landed with no new migration: SQLite mode now calls the repository transactional primitives, and JSON mode keeps the mutex/load-store loop.

### Step 5: `invitation_email_deliveries`

DDL shape (migration `0014_invitation_email_deliveries_table.sql`):

```
invitation_email_deliveries (
  id             text primary key,
  workspace_id   text not null,
  invitation_id  text not null,
  invitee_email  text not null,
  status         text not null,
  mode           text not null,
  attempt        integer not null,
  error          text null,
  provider_status      text null,
  provider_delivery_id text null,
  provider_status_at   text null,
  provider_error       text null,
  created_at     text not null
) without rowid
```

Indexes: `idx_invitation_email_deliveries_workspace_created` on `(workspace_id, created_at desc, id)`, `idx_invitation_email_deliveries_invitation` on `(invitation_id, created_at desc, id)`.

Repository: `src/repositories/invitation-email-deliveries-repo.ts`. Redirects from `listInvitationEmailDeliveriesIndexed` and the writes in `src/invitation-email-delivery.ts` and `src/jobs/reconcile-invitation-emails.ts`.

The existing migration `0008_invitation_email_deliveries.sql` only adds an index on `app_records`; the new dedicated table coexists with that index until the JSON-side drop phase. The Phase 22 `providerStatus`/`providerError` schema-additive trick stops working past this step: any future field needs an explicit `ALTER TABLE` migration. Document that explicitly in `docs/invitation-email-operations.md` when Phase 36 lands.

**Phase 36 actual rollout:** Phase 36 shipped per the standard A/B/C/D split: migration `0014_invitation_email_deliveries_table.sql` plus `src/repositories/invitation-email-deliveries-repo.ts` with `list`/`find`/`upsert`/`count`; read-redirect of `listInvitationEmailDeliveriesIndexed` through `src/invitation-email-deliveries-read.ts` with the merge-and-fall-back pattern; dual-write of all five mutators (`createInvitationEmailDelivery`, `markInvitationEmailDeliverySent/Skipped/Failed`, `recordInvitationEmailProviderStatus`) via the deferred-queue mechanism inside `mutateSqliteStore`; CLIs `db:backfill-invitation-email-deliveries` and `db:verify-invitation-email-deliveries`. Documentation updated in `docs/roadmap.md`, `docs/deployment-sqlite-topology.md`, `docs/invitation-email-operations.md`, and this file. The Phase 22 additive-schema warning is now operational guidance.

### Step 6: `activities`

DDL shape (migration `0015_activities.sql`):

```
activities (
  id              text primary key,
  workspace_id    text not null,
  occurred_at     text not null,
  type            text not null,
  payload         text not null check (json_valid(payload)),
  user_id         text null,
  related_subject text null
)
```

Indexes: `idx_activities_workspace_occurred` on `(workspace_id, occurred_at desc, id)`. Replaces `idx_app_records_activity_occurred` once the JSON-side drop lands.

Repository: `src/repositories/activities-repo.ts`. The activity service in `src/taskloom-services.ts` is the heaviest churn surface for this step (32 occurrences of `data.<collection>` patterns); fixture-update risk is highest here (section 9, risk register).

**Phase 37 actual rollout:** Phase 37 shipped per the standard A/B/C/D split: migration `0015_activities.sql` plus `src/repositories/activities-repo.ts`; read-redirect of `listActivitiesForWorkspaceIndexed(workspaceId, limit?)` through the repository while preserving the existing helper signature; SQLite dual-write of activity writes to both `app_records` and the dedicated `activities` table during the cutover window; CLIs `db:backfill-activities` and `db:verify-activities`. Documentation updated in `docs/roadmap.md`, `docs/deployment-sqlite-topology.md`, `README.md`, and this file. Phase 37 does not retire the JSON-side mirror, change `loadStore()` semantics, normalize activity payload/data/actor into separate tables, or start Phase 38.

### Step 7: `providerCalls`

DDL shape (migration `0016_provider_calls.sql`):

```
provider_calls (
  id                text primary key,
  workspace_id      text not null,
  route_key         text not null,
  provider          text not null,
  model             text not null,
  prompt_tokens     integer not null,
  completion_tokens integer not null,
  cost_usd          real not null,
  duration_ms       integer not null,
  status            text not null check (status in ('success','error','canceled')),
  error_message     text null,
  started_at        text not null,
  completed_at      text not null
)
```

Indexes: workspace/completed-at ordering for `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` and usage rollups that scan recent provider calls. The table is append-only from the provider ledger, so `WITHOUT ROWID` is acceptable if the migration keeps lookups keyed by the text primary key and timestamp indexes.

Repository: `src/repositories/provider-calls-repo.ts`. Redirects from `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` while preserving its caller-facing signature, `since` cutoff behavior on `completedAt`, completed-at descending sort, and optional limit. JSON mode keeps using the inline `data.providerCalls` array.

Cutover write path: the provider ledger writes rows to the dedicated `provider_calls` table in SQLite mode, while JSON-default mode keeps using the inline `data.providerCalls` array. The backfill/verify commands remain available for old backups that still have provider calls only in `app_records`.

Backfill CLI: `npm run db:backfill-provider-calls [-- --dry-run]` plus `npm run db:verify-provider-calls`.

**Phase 39 actual rollout:** Phase 39 ships per the standard A/B/C/D split plus immediate mirror retirement: migration `0016_provider_calls.sql` plus `src/repositories/provider-calls-repo.ts`; read-redirect of `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` through the repository while preserving the existing helper signature; SQLite provider ledger writes to the dedicated `provider_calls` table; CLIs `db:backfill-provider-calls` and `db:verify-provider-calls` for old-backup recovery and drift audits. Documentation updates live in `docs/roadmap.md`, `docs/deployment-sqlite-topology.md`, `README.md`, and this file. Phase 39 does not change `loadStore()` semantics or normalize usage aggregates into separate tables.

### Step 8: `activationSignals`

DDL shape (migration `0017_activation_signals.sql`):

```
activation_signals (
  id           text primary key,
  workspace_id text not null,
  kind         text not null,
  source       text not null,
  origin       text null,
  source_id    text null,
  stable_key   text null,
  data         text null check (data is null or json_valid(data)),
  created_at   text not null,
  updated_at   text not null
)
```

Indexes: workspace/created-at ordering for `activationSignalRepository().listForWorkspace(workspaceId)` and a unique `(workspace_id, stable_key)` index when `stable_key` is not null to preserve the existing stable-key dedupe contract.

Repository: the existing `activationSignalRepository()` in `src/taskloom-store.ts` keeps its caller-facing API. JSON mode keeps using `data.activationSignals`; SQLite mode reads/writes `activation_signals`, and `loadStore()` hydrates `data.activationSignals` from the dedicated table.

Mirror retirement: Phase 40 introduced the dedicated-table write after SQLite `mutateStore()` commits, so existing service call sites continued mutating the full store shape while the dedicated table stayed current. The post-Phase-40 mirror-retirement follow-up (Phase 41, no new migration) removes the SQLite `app_records` mirror for fresh writes; JSON mode is unchanged.

Backfill CLI: `npm run db:backfill-activation-signals [-- --dry-run]` plus `npm run db:verify-activation-signals`.

**Phase 40 actual rollout and follow-up:** Phase 40 ships migration `0017_activation_signals.sql`, keeps the existing repository API, moves the SQLite repository path to `activation_signals`, dual-writes service helper mutations to the dedicated table, and adds backfill/verify CLIs. The post-Phase-40 mirror-retirement follow-up (Phase 41, no new migration) retires the SQLite `app_records` mirror for activation signals: fresh SQLite writes use `activation_signals`, `loadStore()` remains fully hydrated, JSON mode is unchanged, and the backfill/verify CLIs remain old-backup recovery and drift-audit tools. Neither step changes activation facts/read models or normalizes signal `data` into separate columns.

## 4. Schema and migration mechanics

Current max migration prefix is `0009` (verified: `ls src/db/migrations/` returns `0001`, `0003`-`0009`; `0002` is intentionally absent and remains so). The next available number is `0010`.

Forward-only migrations: each new step adds one `<NNNN>_<collection>.sql` file. No down-migration files; rollback strategy continues to be `db:restore` from a pre-migration backup, matching `docs/deployment-sqlite-topology.md` backup/restore policy.

Foreign keys: SQLite TEXT primary keys carry UUIDs in the current store. The new tables do not declare FKs to `app_records` because `app_records` uses a composite `(collection, id)` primary key and the dedicated tables only carry the bare id. Application-layer integrity remains the boundary, matching the existing `rate_limit_buckets` table from migration `0009`. The seed/normalize path in `src/taskloom-store.ts` already enforces these invariants.

`WITHOUT ROWID`: applied to tables that are predominantly append-only and keyed by a TEXT primary key (`job_metric_snapshots`, `alert_events`, `invitation_email_deliveries`). Not applied to `agent_runs` and `jobs` because both see substantial in-place updates.

JSON-mode mirror: in `TASKLOOM_STORE` default JSON mode, the new tables are not present. The repository factory returns a JSON implementation that operates on the existing `data.<collection>` array via `loadStore()`/`mutateStore()`. The factory shape mirrors `activationSignalRepository()` at `src/taskloom-store.ts:2764`:

```ts
export function createJobMetricSnapshotsRepository(deps: Deps = {}): JobMetricSnapshotsRepository {
  if (process.env.TASKLOOM_STORE === "sqlite") return sqliteJobMetricSnapshotsRepository(deps);
  return jsonJobMetricSnapshotsRepository(deps);
}
```

The dependency seam is a `Deps = { loadStore?, mutateStore? }` object. Tests inject fakes through that seam; production callers omit it and get the default backend-aware implementation.

## 5. Repository abstraction

Concrete signatures for the first repository to migrate (`jobMetricSnapshots`):

```ts
// src/repositories/job-metric-snapshots-repo.ts
import type { JobMetricSnapshotRecord, TaskloomData } from "../taskloom-store.js";

export interface ListJobMetricSnapshotsFilter {
  type?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface JobMetricSnapshotsRepository {
  list(filter?: ListJobMetricSnapshotsFilter): JobMetricSnapshotRecord[];
  insertMany(records: JobMetricSnapshotRecord[]): void;
  prune(retainAfterIso: string): number;
  count(): number;
}

export interface JobMetricSnapshotsRepositoryDeps {
  loadStore?: () => TaskloomData;
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
  dbPath?: string;
}

export function createJobMetricSnapshotsRepository(
  deps?: JobMetricSnapshotsRepositoryDeps,
): JobMetricSnapshotsRepository;
```

JSON implementation reads/writes `data.jobMetricSnapshots` through the injected `loadStore`/`mutateStore`. SQLite implementation opens its own `DatabaseSync` per call, identical to the pattern used by `sqliteActivationSignalRepository` at `src/taskloom-store.ts:2780`. Both implementations sort by `capturedAt` ascending and apply the same default limit (100, capped at 500) so JSON-mode and SQLite-mode tests assert identical results.

Test injection: existing call sites in `src/jobs/job-metrics-snapshot.ts` already accept `loadStore`/`mutateStore` deps. The new repository factory accepts the same shape, so tests that already inject `loadStore: () => fakeData` keep working without changes. New repository unit tests construct the JSON and SQLite implementations side-by-side and assert behavioral parity.

## 6. Backfill strategy

For each migration step:

- Operator-invoked CLI, not startup-side. Startup-side backfills mask divergence and turn boot into a long-running maintenance task. The Phase 27/28 pattern of explicit `npm run jobs:snapshot-metrics` is the right precedent.
- New CLI command added to `src/db/cli.ts` with the same shape as `backfillAppDatabase`. Surface as `npm run db:backfill-<collection>` in `package.json`. Default behavior: read every JSON-side row from `app_records` for that collection and `INSERT OR IGNORE` into the dedicated table keyed on the row id.
- `--dry-run` flag returns row counts grouped by `would-insert` versus `already-present` versus `drift` (id present in both with different content). No writes.
- `db:verify-<collection>` command is independent of the backfill: it scans `app_records` and the dedicated table and reports `{ jsonOnly, sqliteOnly, contentDrift, matched }` for that collection. Designed for cron invocation during the dual-write window so operators can detect drift early.
- Idempotency: backfill keys on the row id. Re-running is a no-op except for new rows. `--reconcile` flag is reserved for a later phase if content drift becomes a real concern; for now drift is reported, not auto-resolved.
- Documentation: each new CLI command is documented in `docs/deployment-sqlite-topology.md` under a new "Relational repository backfills" section (additive, not replacing the existing "When To Introduce Dedicated Relational Repositories" section).

## 7. Testing strategy

- Existing tests stay unchanged. Parity remains the contract: the 543 API and 15 web tests must continue to pass at every phase boundary. Specifically, `src/db-runtime-parity.test.ts` (9 sub-tests) must keep passing in both modes.
- Per-repository new test file under `src/repositories/<name>-repo.test.ts` constructs both JSON and SQLite implementations against a temp `data` dir and asserts identical results for the operations the repository exposes. Mirrors the pattern already in `src/db-runtime-parity.test.ts` (open temp dir, set `TASKLOOM_STORE=sqlite` plus `TASKLOOM_DB_PATH`, restore env on teardown).
- Backfill tests under `src/db/cli.test.ts` (existing file) extend with cases for each new `db:backfill-<collection>` command: empty store, one row, idempotent re-run, `--dry-run` non-mutating, drift detection.
- Performance assertions are out of scope. The win is bounded memory and indexable queries, not benchmark numbers. Any future benchmark suite is a separate roadmap item.
- Fixture audit per phase: the brief calls out that some test files build full `TaskloomData` literals. Phases 22, 27, and 29 had to extend those fixtures additively when they introduced `providerStatus`, `jobMetricSnapshots`, and `alertEvents` respectively. The same will happen for each migration step; the fixture work is owned by Slice C in the per-phase split below because dual-write tests need updated fixtures to round-trip.

## 8. Phase sizing for sub-agent dispatch

Each migration step splits into four disjoint sub-agent slices with zero file overlap. Slice ownership for the first step (`jobMetricSnapshots`) is given concretely; later steps follow the same shape with file paths swapped for the relevant collection.

### Step 1 (`jobMetricSnapshots`) slice ownership

**Slice A — migration plus repository (additive only, no integration yet):**

- Owns: `src/db/migrations/0010_job_metric_snapshots.sql` (new), `src/repositories/job-metric-snapshots-repo.ts` (new), `src/repositories/job-metric-snapshots-repo.test.ts` (new).
- Does not touch: any existing helper, any existing test, any docs.

**Slice B — read redirect:**

- Owns: a new `src/jobs/job-metrics-snapshot-read.ts` thin wrapper that delegates to the repository, plus a re-export edit in `src/jobs/job-metrics-snapshot.ts` so existing call sites continue to import `listJobMetricSnapshots` from the same path. Adds a new test file `src/jobs/job-metrics-snapshot.read-parity.test.ts` (new).
- Does not touch: `src/db/migrations/`, `src/repositories/`, or write-side wiring.

**Slice C — backfill CLI plus dual-write integration:**

- Owns: edits to `src/db/cli.ts` to add `backfillJobMetricSnapshots` plus `verifyJobMetricSnapshots`, edits to `package.json` `scripts` to add `db:backfill-job-metric-snapshots` and `db:verify-job-metric-snapshots`, write-path edits in `src/jobs/job-metrics-snapshot.ts` to add the SQLite-mode dual-write into the dedicated table from `snapshotJobMetrics`/`pruneJobMetricSnapshots`, plus extension of `src/db/cli.test.ts`.
- Does not touch: the repository module (Slice A), the read-redirect wrapper (Slice B), or docs (Slice D).

**Slice D — docs:**

- Owns: `docs/roadmap.md` (new "Phase 32 Relational repository for job metric snapshots" entry plus updated "this phase does not ship..." paragraph), `docs/deployment-sqlite-topology.md` (new "Relational repository backfills" section listing the new CLI commands), `README.md` (cross-link).
- Does not touch: any code or migration file.

File overlap audit: Slice A only touches new files. Slice B touches a new `src/jobs/job-metrics-snapshot-read.ts` file plus a re-export edit at the top of `src/jobs/job-metrics-snapshot.ts`. Slice C touches the write-path inside `src/jobs/job-metrics-snapshot.ts` plus `src/db/cli.ts`. Slice B's edits and Slice C's edits to `src/jobs/job-metrics-snapshot.ts` are at non-overlapping line ranges (top-of-file imports/re-exports for B, write functions in the body for C) — but to fully eliminate any merge friction, Slice B's contract is to introduce its read-path entry-point in the new helper file and only add the import in `src/jobs/job-metrics-snapshot.ts`, while Slice C edits the existing function bodies. The orchestrator merges both and runs the combined typecheck + tests.

Steps 2–6 follow the same A/B/C/D layout against their own collection's files. Slice A always gets the new migration + repository module. Slice B always gets the read-redirect path (the indexed helper in `src/taskloom-store.ts` for jobs/agent runs/invitations/activities; the `listAlerts`/`recordAlerts` helpers in `src/alerts/alert-store.ts` for alerts). Slice C always gets the CLI + dual-write + fixture extension. Slice D always gets the roadmap + topology docs.

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Data drift between `app_records` JSON-side and dedicated table during dual-write | Medium | `db:verify-<collection>` command runs as a periodic operator check during the dual-write window. Drift counts surface to a log. |
| Application-layer FK violations on backfill (orphaned `agentRuns.agentId` referencing missing `agents` rows) | Medium for `agentRuns`, low elsewhere | Backfill `--dry-run` reports orphan counts before insertion. The dedicated table does not declare FKs (matching `rate_limit_buckets`), so existing orphans round-trip. A `db:verify-<collection> --check-orphans` mode is added for `agent_runs` and `jobs` only. |
| Test fixture proliferation | High | Each step's Slice C audit covers all `TaskloomData` literal builders. The Phase 22, 27, 29 precedents touched `src/taskloom-store.test.ts`, `src/jobs/job-metrics-snapshot.test.ts`, `src/alerts/alert-store.test.ts`, `src/operations-status.test.ts`, and `src/operations-health.test.ts`; the same set is the floor for each new step. |
| Migration ordering dependency | Low | Migrations are forward-only and ordered by numeric prefix. `db:status` already detects pending migrations and refuses to advance restore validation. Each step's migration is independent; it does not depend on a later step's table existing. |
| Coupling to `loadStore()` returning the full store becomes leaky once collections split | Medium | Document explicitly in section 1 that `loadStore()` keeps returning a fully hydrated `TaskloomData` even after the relational tables exist. The hydration path simply reads from the dedicated tables (in SQLite mode) and merges into the same shape. Acceptable cost during the cutover; revisit only if the SQLite hydration becomes a measurable startup cost. |
| `claimNextJob` mutex behavior change | Low for SQLite, none for JSON | SQLite-mode `claimNextJob` switches to a repository transaction against the dedicated `jobs` table; the in-process `claimMutex` continues to gate JSON-mode and remains a no-op safeguard in SQLite mode. The existing `claimNextJob` parity test in `src/jobs.test.ts` validates both. |
| The Phase 22 schema-additive trick stops working for `invitationEmailDeliveries` | Certain at Step 5 | Document loudly in `docs/invitation-email-operations.md` and `docs/deployment-sqlite-topology.md`. Any future field on `InvitationEmailDeliveryRecord` after Step 5 lands needs an explicit `ALTER TABLE` migration. |
| Restore from a pre-Step backup leaves the dedicated table empty | Low; mitigated by dual-write window | During dual-write, a restore from a backup taken inside the window restores both `app_records` and the dedicated table consistently. After the JSON-side drop phase, restore-from-pre-drop-backup works; restore-from-pre-Step-backup requires a one-time `db:backfill-<collection>` re-run. Document in `docs/deployment-sqlite-topology.md`. |

## 10. Rollout sequencing recommendation

Each phase migrates exactly one collection. Each phase consumes one migration number. Each phase ships A/B/C/D slices in parallel.

- **Phase 32: `jobMetricSnapshots`.** Migration `0010`. ~30-40 new test cases (repository parity + CLI tests). Smallest blast radius. Validates the dual-write pattern before higher-risk collections.
- **Phase 33: `alertEvents`.** Migration `0011`. ~30 new test cases. Adds the `updateDeliveryStatus` mutation pattern absent from Phase 32. Validates that updates round-trip through the repository.
- **Phase 34: `agentRuns`.** Migration `0012`. ~50-60 new test cases. First collection with FK considerations and JSON-encoded sub-arrays (`logs`, `toolCalls`, `transcript`).
- **Phase 35: `jobs`.** Migration `0013`. ~70-80 new test cases. Heaviest mutation profile; the repository ships SQLite-native `claimNext` + `sweepStaleRunning` primitives while the scheduler initially keeps the conservative load-store-loop cutover.
- **Phase 36: `invitationEmailDeliveries`.** Migration `0014`. ~30-40 new test cases. Phase 22's additive-schema trick stops working past this point; the deployment doc gets an explicit warning.
- **Phase 37: `activities`.** Migration `0015`. ~40-50 new test cases. Highest fixture-update churn (32 `data.activities` occurrences in `src/taskloom-services.ts`). Slice C size grows accordingly.
- **Phase 38: drop legacy JSON-side mirrors.** No new migration; the code removes the collection name from `RECORD_COLLECTIONS` in `src/taskloom-store.ts` and from the `app_record_search` insert for `jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, and `activities`. SQLite `loadStore()` keeps returning a fully hydrated `TaskloomData` by reading those six collections from their dedicated tables. `db:backfill-<collection>` commands stay shipped as restore-from-old-backup tools and become no-ops when there are no legacy `app_records` rows to recover. After this mirror retirement, the no-migration scheduler hot-path follow-up flips SQLite-mode `claimNextJob`/`sweepStaleRunningJobs` to the `jobs` repository transactional primitives.
- **Phase 39: `providerCalls`.** Migration `0016`. Standard table/repository/read-redirect/backfill/verify rollout plus SQLite mirror retirement. The read path preserves `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })`, and provider ledger writes use `provider_calls` in SQLite mode.
- **Phase 40: `activationSignals`.** Migration `0017`. Existing repository API moves to a dedicated SQLite table with stable-key uniqueness.
- **Post-Phase-40 / Phase 41: `activationSignals` mirror retirement.** No new migration. Fresh SQLite writes use `activation_signals`, `loadStore()` remains hydrated, JSON mode is unchanged, and backfill/verify commands remain for old-backup recovery and drift audits.
- **Phase 42+: future MIGRATE-LATER collections** as their thresholds in `docs/deployment-sqlite-topology.md` get crossed.

Test deltas are rough order-of-magnitude. Actual counts depend on how aggressively each phase exercises edge cases. The 543 API + 15 web suite is the floor; new tests are additive.

## 11. Open questions for the human

- **Permanent JSON-side fallback or full retire?** Phase 38 keeps `data.jobMetricSnapshots`/`data.alertEvents`/etc. as fields on `TaskloomData` for both JSON-default runtime and SQLite hydration. That preserves contributor ergonomics; the dedicated tables are the SQLite persistence source for the migrated collections.
- **Feature flag?** Should `TASKLOOM_RELATIONAL_REPOSITORIES=on|off` exist as a kill-switch so an operator can revert reads to `app_records` without rolling back the migration? This is friendly to long-running deployments but doubles the test matrix. Recommendation: do not add the flag. The dual-write window already provides the safety net; flag complexity is not warranted for a local-SQLite topology.
- **Dual-write window length policy?** Section 3 mentions "after one stable phase" before retiring the JSON-side write. Is the policy "one phase later" (mechanical), "two stable releases" (calendar), or "until `db:verify-<collection>` reports zero drift across an environment for N consecutive runs" (operational)? Recommendation: "one phase later" plus "zero drift in the most recent verify run" combined.
- **Should `agentRuns` sub-arrays normalize?** Step 3 keeps `logs`/`toolCalls`/`transcript` as JSON columns inside the row. If observability needs grow (per-tool-call latency aggregation across runs, for example) those become first-class tables in a future phase. For now, keep them inlined. Confirm.
- **Activation tables interplay?** Migration `0001` already created relational `activation_tracks`/`activation_milestones`/`activation_checklist_items` for the activation domain. Section 2 lists `activationFacts`/`activationMilestones`/`activationReadModels` as KEEP-IN-JSON at the store layer. Confirm that the activation team does not want a unifying step that points the store-side facts at the existing relational activation tables; that's a different scope from this roadmap.
- **`activationSignals` mirror retirement?** Resolved by the post-Phase-40 mirror-retirement follow-up (Phase 41, no new migration): SQLite fresh writes now use `activation_signals`, `loadStore()` remains hydrated, JSON mode is unchanged, and `db:backfill-activation-signals` / `db:verify-activation-signals` remain old-backup recovery and drift-audit tools.
