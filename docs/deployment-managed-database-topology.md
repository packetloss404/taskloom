# Deployment Managed Database Topology Advisory

Phase 45 adds managed production database topology readiness reporting. It is advisory/planning work: it helps operators see when a deployment needs a managed database plan. Phase 50 is documented as the landed managed Postgres document-store adapter/backfill foundation, Phase 51 tracks runtime call-site migration separately with no remaining tracked sync call-site groups, and Phase 52 asserts/validates managed Postgres startup support. Phase 53 is the multi-writer topology requirements/design gate after Phase 52. This topology advisory still does not add distributed SQLite, multi-writer support, regional failover, PITR, or active/active writes.

## Advisory Surface

Run the managed database topology check before production handoff:

```bash
npm run deployment:check-managed-db
```

Use strict mode in CI, release automation, or pre-production handoff checks that should fail on blocking topology findings:

```bash
npm run deployment:check-managed-db -- --strict
```

The default command reports findings for operator review. Strict mode returns a non-zero exit when the advisory detects a deployment-blocking mismatch, such as production-like managed database requirements without an explicit deployment-owned managed database plan.

## Detection Hints

Operators can set environment hints so the advisory can classify intent without inspecting secrets:

- `TASKLOOM_MANAGED_DATABASE_URL`: indicates a deployment-owned managed database endpoint exists outside the current Taskloom runtime adapter set.
- `DATABASE_URL` or `TASKLOOM_DATABASE_URL`: common database endpoint hints used by deployment platforms.
- `TASKLOOM_MANAGED_DATABASE_ADAPTER`: Phase 50 adapter hint. Recognized Postgres values include `postgres`, `postgresql`, `managed-postgres`, and `managed-postgresql`.
- `TASKLOOM_DATABASE_TOPOLOGY`: explicit topology intent, such as `sqlite-single-node`, `managed-postgres`, `managed-relational`, `multi-region`, or `active-active`.
- `TASKLOOM_STORE`: current Taskloom store selector. Today `sqlite` remains single-node and JSON remains local/contributor-oriented.

Treat these values as advisory inputs for startup readiness. Managed/Postgres startup can be accepted only when a recognized Postgres adapter value is paired with a managed database URL hint and the Phase 52 startup support assertion is present. Setting topology hints does not add replicas, coordinate multiple writers, provide regional failover, enable PITR, or make active/active writes safe. Phase 53 captures those as blocking requirements until a real topology is designed, assigned an owner, validated, and implemented. Use `npm run db:backfill-managed-postgres` and `npm run db:verify-managed-postgres` for the Phase 50 adapter/backfill foundation workflow.

Phase 46 adds a separate runtime guard for startup and release automation through `npm run deployment:check-runtime-guard` and `npm run deployment:check-runtime-guard -- --strict`. Where this Phase 45 advisory reports managed database intent for planning, the Phase 46 guard blocks unsupported managed database URL hints, unsupported `TASKLOOM_STORE` values, and managed/multi-writer `TASKLOOM_DATABASE_TOPOLOGY` hints before they can be treated as supported runtime configuration. Phase 48 adds the matching runtime boundary/foundation inside the synchronous app-store path. Phase 49 lands the async store boundary foundation. Phase 50 lands the managed Postgres document-store adapter/backfill foundation. Phase 51 adds runtime call-site migration evidence with no remaining tracked sync call-site groups. Phase 52 lets the guard accept only the recognized Postgres adapter + managed database URL startup posture. Phase 53 keeps horizontal writers, regional failover, PITR, and active-active writes out of runtime support until topology design ownership exists. See `docs/deployment-managed-database-runtime-guard.md`.

## What It Checks

The Phase 45 check calls out whether the declared or inferred deployment intent matches the current runtime:

- JSON storage is not a production database topology.
- SQLite is supported only as a single-node local/preview/production persistence posture with durable local disk and validated backups.
- Managed Postgres startup is supported only under the Phase 52 assertion rule: recognized Postgres adapter hint plus managed database URL hint. Failover, PITR, active/active writes, and horizontal database writers are Phase 53-blocked topology requirements that Taskloom does not yet ship.
- Scheduler leader election and distributed rate limiting coordinate their own scopes only; they do not make SQLite distributed or multi-writer.
- Phase 48 provides the managed database runtime boundary/foundation in the synchronous store path. Phase 49 provides the async store boundary foundation. Phase 50 provides the managed Postgres adapter/backfill foundation. Phase 51 provides call-site migration evidence. Phase 52 provides narrow startup assertion/validation. Phase 53 provides the requirements/design gate for multi-writer topology; implementation remains pending.

## Relationship To Prior Phases

Phase 42 reports the current storage posture. Phase 43 gates release readiness over storage, backup/restore, and persistent paths. Phase 44 packages redacted readiness/topology/environment evidence for handoff. Phase 45 adds a more explicit managed-database gap/advisory layer for operators planning production database topology. Phase 46 adds runtime guardrails that block unsupported managed database and multi-writer hints before startup or release automation proceeds. Phase 47 carries those advisory/guard findings into release readiness and evidence handoff. Phase 48 adds the fail-closed managed database boundary to the current synchronous store runtime. Phase 49 adds the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 tracks runtime call-site migration. Phase 52 asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations. Phase 53 captures multi-writer/distributed database requirements as a design gate, not implementation.

Use `docs/deployment-storage-topology.md` for the Phase 42 posture report, `docs/deployment-release-readiness.md` for release gates, `docs/deployment-release-evidence.md` for handoff bundles, `docs/deployment-managed-database-runtime-guard.md` for the Phase 46 runtime guard, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
