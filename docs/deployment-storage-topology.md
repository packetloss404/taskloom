# Deployment Storage Topology Readiness

Phase 42 adds production storage topology readiness reporting. It is an advisory phase: it helps operators see whether the current deployment is aligned with Taskloom's supported storage posture, but it does not add managed Postgres support, managed database repositories, distributed SQLite, or a multi-writer SQLite topology.

The supported storage posture remains:

- JSON default for local contributor workflows.
- SQLite opt-in for single-node local, preview, or production deployments with a durable local `TASKLOOM_DB_PATH`.
- Deployment-owned managed database topology when an operator needs horizontal writers, regional failover, active/active writes, managed retention, PITR, or database-native operational controls beyond the current single-node SQLite runtime.

## Readiness Surfaces

Operators can run the storage readiness check from the command line:

```bash
npm run deployment:check-storage
```

Use strict mode in release gates, CI, or pre-production handoff checks:

```bash
npm run deployment:check-storage -- --strict
```

The same Phase 42 readiness report is exposed through the admin operations API as `storageTopology` on `GET /api/app/operations/status`, and the Operations UI renders it in the Production Status panel.

The report is advisory by default. A warning does not migrate data, change the active store, provision Postgres, or coordinate SQLite writers. In strict mode, deployment-blocking findings return a non-zero CLI exit so release automation can stop before a risky handoff.

## What The Report Calls Out

The readiness report makes these boundaries explicit:

- `TASKLOOM_STORE=sqlite` is single-node storage, not a distributed database.
- JSON storage is for contributor workflows and is blocked for production use.
- Multiple scheduler-active or writer-active app instances need deployment-owned coordination and, for production write scale-out, a managed relational database topology.
- The optional distributed rate limiter coordinates auth/invitation abuse counters only; it does not change the database topology.
- The optional scheduler leader-election gate reduces duplicate scheduler work; it does not make SQLite a horizontally scalable write database.
- Dedicated SQLite repositories and backfill/verify commands improve local persistence and migration hygiene; they are not managed Postgres support.
- Backups, restore validation, persistent artifact storage, and log retention remain deployment responsibilities.

## Operator Checklist

Before production handoff, run:

```bash
npm run deployment:check-storage -- --strict
```

Then confirm:

- The report matches the intended topology: JSON local, SQLite single-node, or an explicitly deployment-owned managed database plan.
- SQLite deployments use a durable local disk path, not a shared network filesystem.
- Backups and restore validation are documented for the chosen storage path.
- Multi-process deployments have scheduler coordination configured and do not treat SQLite as the primary write-scaling mechanism.
- Any need for managed Postgres, managed replicas, regional failover, or active/active writes is tracked as deployment work outside Phase 42.

## Relationship To SQLite Topology Guidance

`docs/deployment-sqlite-topology.md` remains the source of truth for the supported SQLite posture, WAL/`busy_timeout`/`BEGIN IMMEDIATE` behavior, backup/restore policy, network filesystem caveats, and relational-repository thresholds. This document describes the Phase 42 readiness report that summarizes those checks for operators through CLI/API/UI surfaces.

## Relationship To Release Readiness

Phase 43 builds on this topology report with a release gate:

```bash
npm run deployment:check-release
npm run deployment:check-release -- --strict
```

That gate checks backup/restore readiness, persistent paths, and this Phase 42 storage topology posture before release handoff. It does not perform backups, restore data, provision managed DBs, or make SQLite distributed. See `docs/deployment-release-readiness.md`.
