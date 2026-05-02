# Deployment SQLite And Database Topology

Taskloom supports two local persistence modes today:

- JSON default: `data/taskloom.json` is the contributor-friendly local store.
- SQLite opt-in: set `TASKLOOM_STORE=sqlite` to use `data/taskloom.sqlite`, or set `TASKLOOM_DB_PATH` to choose another local database file.

SQLite mode is a local runtime posture, not a distributed production database topology. It exists to exercise the same store API through SQLite migrations, query-indexed metadata, backup/restore commands, and safer local write behavior while keeping JSON as the default development path.

Phase 42 adds storage topology readiness reporting around this posture. Operators can run `npm run deployment:check-storage` or `npm run deployment:check-storage -- --strict`, and the same advisory is exposed through `GET /api/app/operations/status` as `storageTopology` and rendered in the Operations UI. The report does not add managed Postgres, managed database repositories, distributed SQLite, or multi-writer SQLite support; it makes the current topology limits visible before release handoff. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening for the supported managed Postgres posture only. SQLite remains single-node and does not become distributed, multi-writer, active-active, regional-failover, or PITR runtime storage. Phase 63 distributed dependency enforcement is next. See `docs/deployment-storage-topology.md`.

## Supported Local SQLite Posture

Supported use cases:

- One Taskloom app instance using one local SQLite database file on a local disk.
- Local development, demos, preview environments, and single-node evaluation where losing regional failover is acceptable.
- Command-line maintenance against the same local database path, ideally while the app is stopped for destructive operations such as reset or restore.

Not supported as a production topology:

- Multiple active app instances writing the same SQLite file as the primary coordination mechanism.
- Horizontal database writers before a real managed topology design is owned.
- Multi-region active/active writes.
- Regional failover or PITR claims backed only by the current app runtime.
- SQLite files placed on network filesystems as a way to share one database across hosts.
- Treating indexed `app_records` metadata as a substitute for a purpose-built relational schema when query volume, reporting, or migration needs grow.

## Runtime Guarantees

When the app opens the SQLite store, it applies migrations and sets these connection pragmas:

- `busy_timeout = 5000`: local writers wait briefly when another writer holds the database lock instead of failing immediately.
- `journal_mode = wal`: readers and one writer can coexist more safely for local app usage.
- `synchronous = normal`: WAL durability/performance tradeoff suitable for the current local posture.
- `foreign_keys = on`: migrated relational tables enforce declared foreign keys.

SQLite whole-store mutations use `BEGIN IMMEDIATE`. This acquires the write reservation before loading fresh state and writing changed collections, which prevents a local writer from overwriting newer committed whole-store state from a stale in-memory cache. SQLite rate-limit bucket writes also use `BEGIN IMMEDIATE` against the dedicated `rate_limit_buckets` table. If `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` is configured, shared abuse counters live outside SQLite and the SQLite buckets remain a local backstop.

These guarantees are local SQLite guarantees. They do not provide distributed consensus, cross-region conflict resolution, or process-external request serialization. `busy_timeout` reduces transient local lock failures; it does not make long-running or high-contention multi-writer deployment safe. The optional distributed rate-limit adapter coordinates only auth/invitation abuse counters; it does not change SQLite's database topology limits.

## Current Schema Shape

The current SQLite runtime persists most app collections through `app_records` rows with JSON payloads. Query-critical routes use sidecar metadata and indexes, including `app_record_search`, workspace indexes, and helper functions for session/user lookup, memberships, invitations, share tokens, workflow records, providers, and usage reads.

Dedicated relational storage exists where it is already needed by the local runtime, including activation migration tables, SQLite `rate_limit_buckets`, the Phase 32-37 relational repositories for `jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, and `activities`, the Phase 39 `providerCalls` table, and the Phase 40 `activationSignals` table. After Phase 38, the providerCalls follow-up, and the post-Phase-40 activationSignals mirror-retirement follow-up, the retired migrated collections are no longer mirrored into `app_records` in SQLite mode; `loadStore()` still returns a fully hydrated `TaskloomData` by reading them from their dedicated tables.

This means SQLite mode improves local persistence and route-read behavior, but it should still be treated as an app-record compatibility layer rather than the final production data model.

## Backup And Restore Policy

SQLite backup and restore commands are local operational tools:

```bash
npm run db:status
npm run db:backup -- --backup-path=data/taskloom.sqlite.bak
npm run db:restore -- --backup-path=data/taskloom.sqlite.bak
```

Policy:

- Run `db:status` before migration or restore work to confirm applied and pending migrations.
- Run `db:backup` before local migration, reset, restore, or manual database inspection. The command checkpoints WAL with `pragma wal_checkpoint(full)` before copying the main database file.
- Run `db:restore` only from a trusted backup path. Restore copies the backup to a temporary database, applies migrations, validates that no migrations remain pending, and then replaces the target database.
- Stop the app before `db:restore`, `db:reset`, or `db:reset-app` to avoid replacing the database underneath a live process.
- Executable down migrations are intentionally unsupported. Rollback means restore from a known-good backup taken before the change.

For production-grade environments, use the native backup, point-in-time restore, retention, encryption, and disaster-recovery controls of the chosen managed database instead of relying on local SQLite file copies.

## Network Filesystem Caveats

Keep `TASKLOOM_DB_PATH` on a local disk for SQLite mode. WAL and file locking depend on filesystem semantics, and network filesystems can vary in lock behavior, latency, cache coherency, and failure modes.

Avoid these deployments:

- One SQLite file shared by multiple containers, VMs, or hosts over NFS, SMB, EFS, Azure Files, or similar network filesystems.
- A SQLite file mounted from object storage or sync tooling.
- Blue/green or rolling deployments where old and new app processes write the same shared file concurrently.

If the deployment needs multiple app instances, use a dedicated relational database and application-level repository boundaries rather than a shared SQLite file.

## Multi-Process And Multi-Region Limits

SQLite permits multiple readers and one writer, but Taskloom's SQLite runtime is designed for low-contention local writes. `BEGIN IMMEDIATE` prevents stale local whole-store overwrites, but it does not solve:

- request routing across several Node processes,
- queue scheduler leadership across several app instances,
- global write ordering across regions,
- regional failover and replication conflict handling,
- cross-process abuse-prevention coordination unless the optional HTTP distributed limiter or equivalent edge/shared limiter is configured.

For multi-process single-region deployments, introduce a managed relational database before scaling writes horizontally. For multi-region deployments, choose a database topology with explicit replication, failover, and write-leadership semantics. Keep the app runtime single-writer per logical workspace or introduce repository-level concurrency controls before active/active writes.

Auth rate limits and invitation delivery have separate deployment notes in `README.md`, `docs/deployment-auth-hardening.md`, and `docs/roadmap.md`; this document only calls out that any production topology should coordinate those concerns outside one local SQLite file.

The Phase 42 storage readiness report repeats these boundaries in operator-facing form. A clean report means the deployment matches the documented posture; it does not certify SQLite for horizontal write scaling or provision a managed relational database. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening for the supported managed Postgres posture, and Phase 63 enforces production-safe shared dependencies before strict activation. These phases do not change SQLite: distributed SQLite, active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, recovery validation, cutover automation, final release closure, runtime activation, and release approval remain blocked.

## When To Introduce Dedicated Relational Repositories

Indexed `app_records` are acceptable while records remain local, low-volume, and primarily accessed through the current route helpers. Introduce dedicated relational repositories, migrations, and backfills when any of these become true:

- A collection needs high-volume filtering, aggregation, retention, reporting, or pagination that cannot be cleanly served by existing indexes.
- Correctness needs row-level constraints, uniqueness, joins, or transactions across specific domain rows rather than whole-store JSON rewrites.
- A workflow needs independent backfills, partial migrations, or operational repair jobs that should not rewrite unrelated collections.
- Multi-process workers or schedulers need explicit claim/lease semantics in database rows.
- Production observability requires database-native query plans and indexes for a domain area.
- A data set has external consumers or integration contracts that should not depend on JSON payload shape inside `app_records`.

When promoting a collection beyond `app_records`:

- Add forward migrations for the dedicated tables and indexes.
- Add a repeatable backfill from existing `app_records` payloads.
- Keep activation derivation storage-agnostic by building snapshots through repository/service seams.
- Add parity coverage for JSON default, SQLite compatibility storage, and the new relational repository path where both paths remain supported.
- Update rollback guidance to restore from a pre-migration backup if the migration cannot be safely reversed.

The roadmap item for relational backfills should remain future work until a specific collection crosses one of the thresholds above.

## Relational Repository Backfills

Phase 32 begins the migration of hot collections from the JSON-payload `app_records` row into dedicated SQLite tables. Each migration step ships:

- A new SQLite migration creating the dedicated table (`src/db/migrations/<NNNN>_<collection>.sql`).
- A repository module under `src/repositories/<collection>-repo.ts` with a factory that switches on `process.env.TASKLOOM_STORE` so JSON mode keeps using the inline collection.
- Read-path delegation through the repository while preserving existing function signatures.
- Dual-write in SQLite mode during the cutover window: writes go to BOTH `app_records` (legacy JSON-side) and the dedicated table until the JSON-side mirror is retired.
- Operator CLI commands for backfill and drift detection.

### Operator workflow during a cutover window

1. Apply the new migration: `npm run db:migrate`.
2. Backfill existing rows: `npm run db:backfill-<collection> -- --dry-run` first to inspect counts, then without `--dry-run` to insert. The backfill is idempotent via `INSERT OR REPLACE` keyed on the row id; safe to re-run.
3. Verify drift periodically during the dual-write window: `npm run db:verify-<collection>`. Output reports `{ jsonOnly, sqliteOnly, contentDrift, matched }`. Zero `jsonOnly`/`sqliteOnly`/`contentDrift` is the steady-state goal.
4. After at least one stable phase has elapsed AND the most recent verify run reports zero drift, a follow-up phase retires the JSON-side mirror write. Operators do not need to take action for the retire — it ships as a code change.
5. After Phase 38, fresh SQLite writes for `jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, and `activities` no longer create `app_records` mirror rows. The backfill commands remain available for restore-from-old-backup workflows.
6. After the providerCalls mirror-retirement follow-up, fresh SQLite writes for `providerCalls` no longer create `app_records` mirror rows. The backfill command remains available for restore-from-old-backup workflows.
7. After the post-Phase-40 activationSignals mirror-retirement follow-up, fresh SQLite writes for `activationSignals` use `activation_signals` and no longer create `app_records` mirror rows. `loadStore()` remains fully hydrated, JSON mode is unchanged, and the backfill command remains available for restore-from-old-backup workflows.

### Phase 32 commands

- `npm run db:backfill-job-metric-snapshots [-- --dry-run]`
- `npm run db:verify-job-metric-snapshots`

### Phase 33 commands

- `npm run db:backfill-alert-events [-- --dry-run]`
- `npm run db:verify-alert-events`

### Phase 34 commands

- `npm run db:backfill-agent-runs [-- --dry-run] [-- --check-orphans]`
- `npm run db:verify-agent-runs [-- --check-orphans]`

The `--check-orphans` flag additionally counts agent runs whose `agentId` references a missing `agents` row in the JSON-side store. Orphans are surfaced in the report but do not block the backfill — they round-trip into the dedicated table as-is.

### Phase 35 commands

- `npm run db:backfill-jobs [-- --dry-run]`
- `npm run db:verify-jobs`

Phase 35 originally shipped the dedicated `jobs` table, repository, and dual-write conservatively. After Phase 38 retired the legacy JSON-side mirrors, the scheduler hot-path follow-up landed: in SQLite mode, `claimNextJob` and `sweepStaleRunningJobs` now use the repository's transactional `claimNext`/`sweepStaleRunning` primitives against the dedicated `jobs` table. JSON mode keeps the existing load-store-loop pattern with the in-process `claimMutex`.

This cutover improves the local SQLite scheduler claim/sweep path, but it does not make SQLite a distributed scheduler or multi-writer production topology. The supported posture remains one local SQLite writer at a time; use a deployment-owned coordinator and a managed relational database before scaling writers across processes, hosts, or regions. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening for that managed database direction, Phase 63 enforces distributed dependencies, and Phase 64 validates provider-owned HA/PITR recovery evidence for managed Postgres. None of those phases make SQLite distributed, and they do not enable active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, cutover automation, final release closure, runtime activation, or release approval. Phase 65 is next.

### Phase 36 commands

- `npm run db:backfill-invitation-email-deliveries [-- --dry-run]`
- `npm run db:verify-invitation-email-deliveries`

After Phase 36, any future field added to `InvitationEmailDeliveryRecord` requires an explicit `ALTER TABLE invitation_email_deliveries ADD COLUMN ...` migration. The Phase 22 schema-additive trick (where `providerStatus` and friends were added without a migration because the data lived in the `app_records` JSON payload) no longer applies once a collection has its own dedicated table.

### Phase 37 commands

- `npm run db:backfill-activities [-- --dry-run]`
- `npm run db:verify-activities`

### Phase 38 mirror retirement

Phase 38 retires the legacy `app_records` mirror for `jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, and `activities`. Fresh SQLite schemas hydrate those collections from their dedicated tables, and whole-store seed/reset/import paths write them directly to those tables. The collection fields remain on `TaskloomData` and JSON-default mode is unchanged.

The migration plan and per-collection rollout sequence is documented in `docs/roadmap-relational-repositories.md`.

### Phase 39 commands

- `npm run db:backfill-provider-calls [-- --dry-run]`
- `npm run db:verify-provider-calls`

Phase 39 creates `provider_calls` with migration `0016_provider_calls.sql`, redirects `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` through `src/repositories/provider-calls-repo.ts`, and writes provider ledger rows to the dedicated table in SQLite mode. Operators restoring an old backup should run the dry-run backfill before the write backfill, then run `db:verify-provider-calls` to audit drift. For fresh SQLite writes after mirror retirement, a clean verify normally has zero `jsonOnly` rows because no `app_records` mirror is written.

The providerCalls mirror-retirement follow-up keeps `db:backfill-provider-calls` and `db:verify-provider-calls` shipped as old-backup recovery tools. JSON-default mode still stores provider calls in the inline `data.providerCalls` array.

### Phase 40 commands

- `npm run db:backfill-activation-signals [-- --dry-run]`
- `npm run db:verify-activation-signals`

Phase 40 creates `activation_signals` with migration `0017_activation_signals.sql` and moves the SQLite implementation of `activationSignalRepository()` to that table while preserving the existing repository API and JSON-default inline collection. The post-Phase-40 mirror-retirement follow-up (Phase 41, no new migration) retires the SQLite `app_records` mirror: fresh SQLite writes use `activation_signals`, `loadStore()` remains fully hydrated, and JSON mode is unchanged. Operators can still use the backfill and verify commands to recover old backups and audit drift.

### Restore semantics during and after mirror retirement

A `db:restore` to a backup taken inside a dual-write window restores both `app_records` and the dedicated table consistently. A `db:restore` to a backup from before the migration of a given collection requires a one-time `db:backfill-<collection>` re-run after the restore to repopulate the dedicated table. After mirror retirement, restored fresh-schema databases no longer need JSON-side mirror rows for the retired collections; the backfill commands remain the recovery path for old backups whose dedicated tables are empty. Restore from a pre-Phase-39 backup requires `db:backfill-provider-calls`, and restored provider-calls data can be audited with `db:verify-provider-calls`. Restore from a pre-Phase-40 activationSignals backup requires `db:backfill-activation-signals`, and restored activation-signal data can be audited with `db:verify-activation-signals`.
