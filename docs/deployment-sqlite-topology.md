# Deployment SQLite And Database Topology

Taskloom supports two local persistence modes today:

- JSON default: `data/taskloom.json` is the contributor-friendly local store.
- SQLite opt-in: set `TASKLOOM_STORE=sqlite` to use `data/taskloom.sqlite`, or set `TASKLOOM_DB_PATH` to choose another local database file.

SQLite mode is a local runtime posture, not a distributed production database topology. It exists to exercise the same store API through SQLite migrations, query-indexed metadata, backup/restore commands, and safer local write behavior while keeping JSON as the default development path.

## Supported Local SQLite Posture

Supported use cases:

- One Taskloom app instance using one local SQLite database file on a local disk.
- Local development, demos, preview environments, and single-node evaluation where losing regional failover is acceptable.
- Command-line maintenance against the same local database path, ideally while the app is stopped for destructive operations such as reset or restore.

Not supported as a production topology:

- Multiple active app instances writing the same SQLite file as the primary coordination mechanism.
- Multi-region active/active writes.
- SQLite files placed on network filesystems as a way to share one database across hosts.
- Treating indexed `app_records` metadata as a substitute for a purpose-built relational schema when query volume, reporting, or migration needs grow.

## Runtime Guarantees

When the app opens the SQLite store, it applies migrations and sets these connection pragmas:

- `busy_timeout = 5000`: local writers wait briefly when another writer holds the database lock instead of failing immediately.
- `journal_mode = wal`: readers and one writer can coexist more safely for local app usage.
- `synchronous = normal`: WAL durability/performance tradeoff suitable for the current local posture.
- `foreign_keys = on`: migrated relational tables enforce declared foreign keys.

SQLite whole-store mutations use `BEGIN IMMEDIATE`. This acquires the write reservation before loading fresh state and writing changed collections, which prevents a local writer from overwriting newer committed whole-store state from a stale in-memory cache. SQLite rate-limit bucket writes also use `BEGIN IMMEDIATE` against the dedicated `rate_limit_buckets` table.

These guarantees are local SQLite guarantees. They do not provide distributed consensus, cross-region conflict resolution, or process-external request serialization. `busy_timeout` reduces transient local lock failures; it does not make long-running or high-contention multi-writer deployment safe.

## Current Schema Shape

The current SQLite runtime persists most app collections through `app_records` rows with JSON payloads. Query-critical routes use sidecar metadata and indexes, including `app_record_search`, workspace indexes, and helper functions for session/user lookup, memberships, invitations, share tokens, workflow records, activities, agents/runs, jobs, providers, and usage reads.

Dedicated relational storage exists where it is already needed by the local runtime, including activation migration tables and SQLite `rate_limit_buckets`. Most app records are not yet split into fully relational repositories.

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
- cross-process abuse-prevention coordination.

For multi-process single-region deployments, introduce a managed relational database before scaling writes horizontally. For multi-region deployments, choose a database topology with explicit replication, failover, and write-leadership semantics. Keep the app runtime single-writer per logical workspace or introduce repository-level concurrency controls before active/active writes.

Auth rate limits and invitation delivery have separate deployment notes in `README.md` and `docs/roadmap.md`; this document only calls out that any production topology should coordinate those concerns outside one local SQLite file.

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
