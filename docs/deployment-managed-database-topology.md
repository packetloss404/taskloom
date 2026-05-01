# Deployment Managed Database Topology Advisory

Phase 45 adds managed production database topology readiness reporting. It is advisory/planning work: it helps operators see when a deployment needs a managed database plan. Phase 50 is documented as the landed managed Postgres document-store adapter/backfill foundation, Phase 51 tracks runtime call-site migration separately with no remaining tracked sync call-site groups, and Phase 52 asserts/validates managed Postgres startup support. Phase 53 is the multi-writer topology requirements/design gate after Phase 52. Phase 54 makes that gate an owned design-package requirement before any multi-writer runtime implementation. Phase 55 adds the design-package review and implementation-authorization evidence gate before runtime implementation can start. Phase 56 adds the implementation-readiness and rollout-safety evidence gate before runtime support can be claimed. Phase 57 adds the implementation-scope gate after Phase 56, requiring implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. This topology advisory still does not add distributed SQLite, multi-writer support, regional failover, PITR, or active/active writes.

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

Treat these values as advisory inputs for startup readiness. Managed/Postgres startup can be accepted only when a recognized Postgres adapter value is paired with a managed database URL hint and the Phase 52 startup support assertion is present. Setting topology hints does not add replicas, coordinate multiple writers, provide regional failover, enable PITR, or make active/active writes safe. Phase 53 captures those as blocking requirements. Phase 54 requires a real topology design package with an owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy. Phase 55 requires review outcome evidence, reviewer/approver identity, implementation authorization scope, and approval date before any multi-writer/distributed runtime implementation begins. Phase 56 requires implementation readiness, staged rollout controls, rollback/recovery proof, observability proof, and release-claim boundaries before runtime support can be claimed. Phase 57 requires a locked implementation scope, runtime feature flag or deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Use `npm run db:backfill-managed-postgres` and `npm run db:verify-managed-postgres` for the Phase 50 adapter/backfill foundation workflow.

Phase 46 adds a separate runtime guard for startup and release automation through `npm run deployment:check-runtime-guard` and `npm run deployment:check-runtime-guard -- --strict`. Where this Phase 45 advisory reports managed database intent for planning, the Phase 46 guard blocks unsupported managed database URL hints, unsupported `TASKLOOM_STORE` values, and managed/multi-writer `TASKLOOM_DATABASE_TOPOLOGY` hints before they can be treated as supported runtime configuration. Phase 48 adds the matching runtime boundary/foundation inside the synchronous app-store path. Phase 49 lands the async store boundary foundation. Phase 50 lands the managed Postgres document-store adapter/backfill foundation. Phase 51 adds runtime call-site migration evidence with no remaining tracked sync call-site groups. Phase 52 lets the guard accept only the recognized Postgres adapter + managed database URL startup posture. Phase 53 keeps horizontal writers, regional failover, PITR, and active-active writes out of runtime support until topology design ownership exists. Phase 54 defines the required design-package fields, Phase 55 records review/implementation-authorization evidence, Phase 56 records implementation-readiness/rollout-safety evidence, and Phase 57 locks implementation scope and release-owner signoff; these gates remain documentation/release-gate work, not runtime support. See `docs/deployment-managed-database-runtime-guard.md`.

## Phase 54 Design Package Gate

Before any multi-writer or distributed database runtime work can start, the deployment-owned topology package must document:

- Owner: the accountable engineering/operations owner for the topology and handoff decisions.
- Consistency model: write-leadership, read-after-write expectations, conflict handling, idempotency, and workspace/tenant isolation assumptions.
- Failover/PITR plan: provider controls, RPO/RTO targets, point-in-time restore process, failover decision authority, and validation cadence.
- Migration/backfill plan: source and target stores, cutover sequence, dry-run/verify commands, dual-write or freeze expectations, and data-drift handling.
- Observability requirements: metrics, logs, traces, alert thresholds, topology-health signals, replication lag, queue/scheduler signals, and evidence export expectations.
- Rollback strategy: backup checkpoints, revert triggers, traffic cutback, data reconciliation, and the point after which rollback becomes restore/recovery instead of code rollback.

This Phase 54 gate does not implement multi-writer/distributed database runtime support. It is the required design package that must exist before implementation can be scoped, reviewed, or claimed in release readiness.

## Phase 55 Review And Authorization Gate

After the Phase 54 design package exists, Phase 55 requires review and implementation-authorization evidence before any multi-writer or distributed database runtime work can begin. The evidence must document:

- Review outcome: approved, rejected, or changes requested, with links or references to the reviewed design package version.
- Reviewers and approvers: accountable engineering, operations, data, and release owners who reviewed the package.
- Authorization scope: the exact implementation work allowed to start, including any excluded runtime claims.
- Authorization date and expiry: when approval was recorded and when it must be refreshed before implementation continues.
- Release-gate attachment: where the evidence is carried in release-readiness and release-evidence handoff artifacts.

This Phase 55 gate is evidence only. It does not implement multi-writer/distributed database runtime support, does not widen the Phase 52 managed/Postgres startup posture, and does not authorize release claims without a later runtime implementation phase.

## Phase 56 Implementation Readiness And Rollout-Safety Gate

After Phase 55 authorization exists, Phase 56 requires implementation-readiness and rollout-safety evidence before any multi-writer or distributed database runtime support can be claimed. The evidence must document:

- Implementation readiness: named implementers, scoped work items, dependency status, test plan, migration/backfill dry-run results, and operational runbook owner.
- Rollout controls: feature flag or deployment gate, staged rollout sequence, canary criteria, abort criteria, and approval path for widening exposure.
- Rollback and recovery proof: rollback rehearsal, backup/restore checkpoints, data reconciliation plan, and restore/recovery decision point.
- Observability proof: metrics, logs, traces, replication/topology health checks, scheduler/queue signals, alert thresholds, and release-evidence attachment.
- Claim boundary: the explicit runtime-support claim that remains blocked until a later implementation phase ships and validates code.

This Phase 56 gate is evidence only. It does not implement multi-writer/distributed database runtime support, does not widen the Phase 52 managed/Postgres startup posture, and does not authorize production support claims without a later runtime implementation phase.

## Phase 57 Implementation Scope Gate

After Phase 56 readiness and rollout-safety evidence exists, Phase 57 requires the implementation scope to be locked before any multi-writer or distributed database implementation claim can proceed. The evidence must document:

- Phase 56 dependency: the exact readiness/rollout evidence bundle this scope depends on.
- Implementation scope lock: the included work items, explicitly excluded work, owner, dependency assumptions, and expiry/re-review trigger for scope changes.
- Runtime feature flag or deployment gate: the disabled-by-default switch or deployment gate that prevents accidental runtime exposure.
- Validation evidence: the test, migration dry-run, rollback rehearsal, observability, and release-evidence references that prove the scoped implementation is ready to enter code work.
- Migration/cutover lock: the approved migration/backfill sequence, cutover window, freeze/dual-write expectations, abort path, and data-reconciliation owner.
- Release-owner signoff: the named release owner, signoff date, release conditions, and attachment location for handoff evidence.

This Phase 57 gate is implementation-scope evidence only. It does not implement multi-writer/distributed database runtime support, does not enable the runtime feature flag or deployment gate, does not widen the Phase 52 managed/Postgres startup posture, and does not authorize production support claims without a later runtime implementation phase.

## What It Checks

The Phase 45 check calls out whether the declared or inferred deployment intent matches the current runtime:

- JSON storage is not a production database topology.
- SQLite is supported only as a single-node local/preview/production persistence posture with durable local disk and validated backups.
- Managed Postgres startup is supported only under the Phase 52 assertion rule: recognized Postgres adapter hint plus managed database URL hint. Failover, PITR, active/active writes, and horizontal database writers are Phase 53-blocked topology requirements, Phase 54 design-package requirements, Phase 55 review/authorization evidence requirements, Phase 56 readiness/rollout-safety evidence requirements, and Phase 57 implementation-scope requirements that Taskloom does not yet ship.
- Scheduler leader election and distributed rate limiting coordinate their own scopes only; they do not make SQLite distributed or multi-writer.
- Phase 48 provides the managed database runtime boundary/foundation in the synchronous store path. Phase 49 provides the async store boundary foundation. Phase 50 provides the managed Postgres adapter/backfill foundation. Phase 51 provides call-site migration evidence. Phase 52 provides narrow startup assertion/validation. Phase 53 provides the requirements/design gate for multi-writer topology. Phase 54 requires the owned design package. Phase 55 requires review and implementation-authorization evidence. Phase 56 requires implementation-readiness and rollout-safety evidence. Phase 57 requires implementation-scope lock and release-owner signoff; implementation remains pending.

## Relationship To Prior Phases

Phase 42 reports the current storage posture. Phase 43 gates release readiness over storage, backup/restore, and persistent paths. Phase 44 packages redacted readiness/topology/environment evidence for handoff. Phase 45 adds a more explicit managed-database gap/advisory layer for operators planning production database topology. Phase 46 adds runtime guardrails that block unsupported managed database and multi-writer hints before startup or release automation proceeds. Phase 47 carries those advisory/guard findings into release readiness and evidence handoff. Phase 48 adds the fail-closed managed database boundary to the current synchronous store runtime. Phase 49 adds the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 tracks runtime call-site migration. Phase 52 asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations. Phase 53 captures multi-writer/distributed database requirements as a design gate, not implementation. Phase 54 requires the owned design package before any multi-writer runtime implementation can proceed. Phase 55 requires review and implementation-authorization evidence for that package before runtime implementation can start. Phase 56 requires implementation-readiness and rollout-safety evidence before runtime support can be claimed. Phase 57 requires Phase 56 plus implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed.

Use `docs/deployment-storage-topology.md` for the Phase 42 posture report, `docs/deployment-release-readiness.md` for release gates, `docs/deployment-release-evidence.md` for handoff bundles, `docs/deployment-managed-database-runtime-guard.md` for the Phase 46 runtime guard, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
