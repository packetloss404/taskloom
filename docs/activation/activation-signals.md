# Activation Signals

Activation derivation consumes a normalized `ActivationSignalSnapshot`. The pure engine does not know whether signals came from local seed facts, workflow records, activity records, jobs, or a repository. The default runtime still uses local JSON data, and `TASKLOOM_STORE=sqlite` runs the same app data through SQLite `app_records`.

Current local sources:

- Built-in seed data creates `activationFacts` for `alpha`, `beta`, and `gamma` in `data/taskloom.json`.
- Workflow writes update activation facts for brief, requirements, plan, blockers, questions, validation, and release confirmation.
- Retry and scope-change counts prefer durable `activationSignals` records and activation-scoped activity events, with legacy fact counters retained only as fallback.
- Runtime retry actions write `activationSignals` records with `kind: "retry"`, `source: "agent_run"`, `origin: "user_entered"`, and the failed run as `sourceId`.
- Workflow brief scope changes write `activationSignals` records with `kind: "scope_change"`, `source: "workflow"`, `origin: "user_entered"`, and the brief version as `sourceId`.
- `activationSignalRepository()` provides `listForWorkspace(...)` and `upsert(...)` over the active store. In JSON mode it uses the local app model; in SQLite mode it reads and writes `activationSignals` rows in `app_records` and updates app-record search metadata.
- `snapshotForWorkspace(...)` refreshes `now`, derives runtime snapshots from durable workflow/product records when present, and uses legacy `activationFacts` only for categories without durable records or for workspaces that have no durable records yet.
- `buildSignalSnapshotFromProductRecords(...)` maps durable workflow/product records into activation signals for runtime recompute and read-model repair.

## Source And Origin

`ActivationSignalRecord.source` describes where the signal was observed or produced, such as `seed`, `workflow`, `agent_run`, `activity`, `user_fact`, or `system_fact`. `ActivationSignalRecord.origin` separately records whether the signal came from user-entered behavior or system-observed behavior.

Normalized signal writes should preserve both dimensions clearly:

- `source`: producer category used for recompute and traceability.
- `sourceId`: stable upstream record id used for dedupe and audit links.
- `origin`: user-entered versus system-observed, with actor metadata when available.
- `data`: small, non-authoritative context for diagnostics, not the source of activation truth.

Do not collapse source and origin in docs, schemas, or API copy. For example, a retry can be `source: "agent_run"` while its origin is a signed-in user clicking retry; a scheduler-observed failure would still be system-observed even if it references an agent run.

## Durable Retry And Scope-Change Behavior

Durable retry and scope-change signals are intended to outlive read-model recompute, JSON-to-SQLite backfill, and repair jobs. Runtime snapshots should count durable `activationSignals` first, then activation-scoped activity events, then legacy fact counters only when durable records are absent for that signal kind.

Activity fallback exists for events with `data.activationSignalKind` or known activation event names such as `agent.run.retry` and `workflow.scope_changed`. It keeps older activity streams useful, but it is not a replacement for durable signal records.

Idempotency expectation: a repeated write for the same upstream event should not create additional counted activation signals. Durable signal writes should use stable ids or `stableKey`; SQLite enforces uniqueness for non-null activation signal `stableKey` values under a workspace, and JSON upsert dedupes by `stableKey` when callers provide one. Retry and brief scope-change service paths also emit activation activities with stable ids so repeated signal writes do not double-count through activity fallback. Callers that omit both a stable id and `stableKey` can still create duplicate records.

## Required Signals

- `now`
- `hasBrief`
- `hasRequirements`
- `hasPlan`
- `hasImplementation`
- `hasTests`
- `hasValidationEvidence`
- `hasReleaseEvidence`
- `blockerCount`
- `dependencyBlockerCount`
- `openQuestionCount`
- `criticalIssueCount`
- `scopeChangeCount`
- `failedValidationCount`
- `retryCount`

## Optional Timestamps

- `createdAt`
- `startedAt`
- `completedAt`
- `releasedAt`

## Adapter Guidance

Product-specific events and records should map into this snapshot, for example:

- profile completion
- first real customer interaction
- implementation start
- validation success/failure
- release confirmation
- active blockers and dependency blockers

Keep that mapping outside the pure engine.

Repository guidance for the future normalized implementation:

- Keep the pure activation engine dependent on `ActivationSignalSnapshot`, not database rows.
- Build snapshots from normalized signal records plus durable workflow/product records.
- Preserve local JSON as the default developer runtime and keep SQLite opt-in; the current repository stores signal payloads in `app_records`, with indexes and search metadata for activation signal access.
- Make JSON-to-SQLite backfills repeatable; importing existing JSON activation signals should not double-count retry or scope-change records.

## Operations

- Run `npm run jobs:recompute-activation` after manual changes to local activation facts or workflow records.
- Run `npm run jobs:repair-activation` to refresh stale JSON-backed read models and report repaired workspaces.
- Run `npm run db:status` to inspect applied and pending SQLite migrations without mutating a missing database.
- Run `npm run db:backup -- --backup-path=data/taskloom.sqlite.bak` before local migration or restore work.
- Run `npm run db:restore -- --backup-path=data/taskloom.sqlite.bak` to validate a backup through migrations and replace the local SQLite DB.
- Use `node --import tsx src/jobs.ts recompute-activation --workspace-ids=alpha,beta` for targeted recomputes.
- Use `node --import tsx src/jobs.ts repair-activation-read-models --workspace-ids=alpha,beta` to refresh stale activation read models and report which workspaces changed.
- Delete `data/taskloom.json` to reset to built-in seed signals on the next store load.
- Keep generated runtime artifacts ignored, including `data/taskloom.json`, `data/artifacts/`, and `web/dist/`.
