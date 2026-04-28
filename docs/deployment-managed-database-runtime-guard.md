# Deployment Managed Database Runtime Guard

Phase 46 adds managed database runtime guardrails for startup and release automation. The guard is intentionally narrow: it keeps the current Taskloom runtime inside the supported local JSON/default and single-node SQLite modes, and it blocks managed database or multi-writer hints before they can be mistaken for implemented runtime support.

Run the default guard before startup or handoff automation:

```bash
npm run deployment:check-runtime-guard
```

Use strict mode in CI, startup wrappers, or release automation that must fail on blocked runtime posture:

```bash
npm run deployment:check-runtime-guard -- --strict
```

The default command reports the guard decision for operator review. Strict mode returns a non-zero exit when unsupported runtime hints are present.

## Allowed Runtime Posture

The guard allows only the runtime modes Taskloom currently implements:

- Local JSON/default storage for contributor and local workflows.
- `TASKLOOM_STORE=sqlite` for single-node SQLite storage with a durable local `TASKLOOM_DB_PATH`.

SQLite remains single-node. Scheduler leader election and distributed rate limiting coordinate their own scopes only; they do not make SQLite distributed, managed, or safe for multi-writer database topologies.

## Guard Inputs

The guard treats these environment values as runtime intent:

- `TASKLOOM_STORE`: the active store selector. Supported values are the current local JSON/default mode and `sqlite`; managed database store values are blocked.
- `TASKLOOM_MANAGED_DATABASE_URL`: a deployment-owned managed database URL hint. This is blocked because Taskloom does not yet implement a managed database runtime adapter.
- `DATABASE_URL`: common platform database URL hint. This is blocked for the same reason.
- `TASKLOOM_DATABASE_URL`: Taskloom-specific database URL hint. This is blocked for the same reason.
- `TASKLOOM_DATABASE_TOPOLOGY`: topology intent. Managed database, production cluster, distributed, multi-region, active/active, or multi-writer values are blocked.
- `TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS`: break-glass/dev-only bypass for controlled experiments.

URL-like values must be treated as secrets in surrounding automation. The guard exists to reject unsupported runtime intent, not to validate credentials, provision databases, migrate data, or test connectivity.

## What It Blocks

The guard blocks:

- Unsupported `TASKLOOM_STORE` values, including managed database store names that Taskloom does not implement.
- Any managed database URL hint through `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, or `TASKLOOM_DATABASE_URL`.
- Multi-writer or managed topology hints through `TASKLOOM_DATABASE_TOPOLOGY`.
- Production/release automation that would otherwise start Taskloom while implying managed Postgres, distributed SQLite, regional failover, PITR, active/active writes, or multi-writer support.

This is a runtime guardrail, not a managed database feature. It does not add a managed Postgres adapter, managed database repositories, distributed SQLite, failover, PITR, or active/active writes.

## Bypass Policy

`TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS` is a stern break-glass/dev-only escape hatch. Use it only for controlled local experiments where an operator is deliberately testing guard behavior or unreleased runtime work.

Do not set the bypass in production, release handoff, CI gates that certify production readiness, or customer-facing environments. The bypass does not turn on managed database support, does not make unsupported stores safe, and must not be used as evidence that managed Postgres or multi-writer runtime support exists.

## Relationship To Phases 42-45

Phase 42 reports the current storage posture. Phase 43 gates release readiness over storage, backup/restore, and persistent paths. Phase 44 packages redacted readiness/topology/environment evidence for handoff. Phase 45 documents managed database topology intent and implementation gaps as an advisory.

Phase 46 is the runtime guard layer: it blocks unsupported managed database and multi-writer hints before startup or release automation proceeds. Use `docs/deployment-storage-topology.md` for the Phase 42 posture report, `docs/deployment-release-readiness.md` for release gates, `docs/deployment-release-evidence.md` for handoff bundles, `docs/deployment-managed-database-topology.md` for managed database planning, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
