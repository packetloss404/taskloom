# Deployment Managed Database Runtime Guard

Phase 46 adds managed database runtime guardrails for startup and release automation. Phase 48 adds the matching managed database runtime boundary/foundation inside the synchronous app-store path. Phase 49 lands the async store boundary foundation, Phase 50 lands the managed Postgres document-store adapter/backfill foundation, Phase 51 tracks runtime call-site migration as a separate evidence item with no remaining tracked sync call-site groups, and Phase 52 asserts/validates managed Postgres startup support. The main app startup path still runs this guard before serving traffic; managed/Postgres hints can be accepted only when a recognized Postgres adapter hint is paired with a managed database URL and the Phase 52 startup support assertion is present.

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
- Phase 52 managed Postgres startup when `TASKLOOM_MANAGED_DATABASE_ADAPTER` is a recognized Postgres value and one managed database URL hint is present.

SQLite remains single-node. Scheduler leader election and distributed rate limiting coordinate their own scopes only; they do not make SQLite distributed, managed, or safe for multi-writer database topologies.

## Guard And Store Boundary Inputs

The guard treats these environment values as runtime intent:

- `TASKLOOM_STORE`: the active store selector. Supported values are the current local JSON/default mode, `sqlite`, and the Phase 52 managed/Postgres posture only when the adapter, URL, and startup assertion requirements are all satisfied.
- `TASKLOOM_MANAGED_DATABASE_URL`: a deployment-owned managed database URL hint. This can be accepted only with a recognized Postgres adapter and the Phase 52 startup support assertion.
- `DATABASE_URL`: common platform database URL hint. This follows the same managed/Postgres acceptance rule.
- `TASKLOOM_DATABASE_URL`: Taskloom-specific database URL hint. This follows the same managed/Postgres acceptance rule.
- `TASKLOOM_MANAGED_DATABASE_ADAPTER`: Phase 50 adapter hint. Recognized Postgres values include `postgres`, `postgresql`, `managed-postgres`, and `managed-postgresql`; Phase 52 requires one of these values before managed/Postgres startup can be accepted.
- `TASKLOOM_DATABASE_TOPOLOGY`: topology intent. Managed database, production cluster, distributed, multi-region, active/active, or multi-writer values are blocked.
- `TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS`: break-glass/dev-only bypass for controlled experiments.

URL-like values must be treated as secrets in surrounding automation. The guard exists to reject unsupported runtime intent, not to validate credentials, provision databases, migrate data, or test connectivity.

The Phase 48 store boundary uses the same intent shape inside the current synchronous `loadStore()` / `mutateStore()` backend selection. Phase 49 then adds the `loadStoreAsync()` / `mutateStoreAsync()` boundary foundation. Phase 50 adds a managed Postgres document-store adapter behind that async boundary plus `npm run db:backfill-managed-postgres` and `npm run db:verify-managed-postgres`. Phase 51 is represented as call-site migration evidence. Phase 52 is the explicit startup support assertion: the guard may allow managed/Postgres startup only for recognized Postgres adapter + managed database URL configurations, and continues to block unsupported managed store names, incomplete hint pairs, and managed/multi-writer topology claims.

## What It Blocks

The guard blocks:

- Unsupported `TASKLOOM_STORE` values, including managed database store names outside the Phase 52 recognized Postgres adapter + managed database URL posture.
- Unpaired or unsupported managed database URL hints through `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, or `TASKLOOM_DATABASE_URL`.
- Multi-writer or managed topology hints through `TASKLOOM_DATABASE_TOPOLOGY`.
- Production/release automation that would otherwise start Taskloom while implying managed Postgres, distributed SQLite, regional failover, PITR, active/active writes, or multi-writer support.

This is a runtime guardrail and boundary foundation. Phase 52 adds narrow managed Postgres startup assertion/validation after the Phase 50 adapter and Phase 51 call-site migration. It does not add distributed SQLite, failover, PITR, active/active writes, or multi-writer support.

## Bypass Policy

`TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS` is a stern break-glass/dev-only escape hatch. Use it only for controlled local experiments where an operator is deliberately testing guard behavior or unreleased runtime work.

Do not set the bypass in production, release handoff, CI gates that certify production readiness, or customer-facing environments. The bypass does not turn on managed database support, does not make unsupported stores safe, and must not be used as evidence that managed Postgres or multi-writer runtime support exists.

## Relationship To Phases 42-52

Phase 42 reports the current storage posture. Phase 43 gates release readiness over storage, backup/restore, and persistent paths. Phase 44 packages redacted readiness/topology/environment evidence for handoff. Phase 45 documents managed database topology intent and implementation gaps as an advisory.

Phase 46 is the runtime guard layer: it blocks unsupported managed database and multi-writer hints before startup or release automation proceeds. Phase 47 integrates the guard result into the Phase 43 release-readiness gate and the Phase 44 release evidence bundle, so blocked/advisory managed database findings travel with the handoff evidence. Phase 48 adds the in-runtime managed database boundary/foundation. Phase 49 lands the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 tracks runtime call-site migration separately from both the adapter and the guard. Phase 52 asserts/validates managed Postgres startup support after that migration.

After Phase 47, release handoffs include the managed database advisory and guard findings. After Phase 48, the store runtime also has the boundary needed to prevent accidental managed database startup. After Phase 49, async store boundaries exist. After Phase 50, the managed Postgres adapter/backfill foundation is documented as landed. After Phase 51 evidence appears, operators can see that no tracked sync call-site groups remain. After Phase 52, recognized Postgres adapter + managed database URL hints can be accepted as managed Postgres startup configuration. Multi-writer topology remains separate and only needed if horizontal writers, regional failover, PITR, or active-active writes become requirements.

Use `docs/deployment-storage-topology.md` for the Phase 42 posture report, `docs/deployment-release-readiness.md` for release gates, `docs/deployment-release-evidence.md` for handoff bundles, `docs/deployment-managed-database-topology.md` for managed database planning, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
