# Deployment Managed Database Runtime Guard

Phase 46 adds managed database runtime guardrails for startup and release automation. Phase 48 adds the matching managed database runtime boundary/foundation inside the synchronous app-store path. Phase 49 lands the async store boundary foundation, Phase 50 lands the managed Postgres document-store adapter/backfill foundation, Phase 51 tracks runtime call-site migration as a separate evidence item with no remaining tracked sync call-site groups, and Phase 52 asserts/validates managed Postgres startup support. Phase 53 adds the multi-writer topology requirements/design gate after Phase 52, Phase 54 requires an owned topology design package before any multi-writer runtime implementation, Phase 55 requires design-package review plus implementation-authorization evidence before runtime implementation can start, Phase 56 requires implementation-readiness plus rollout-safety evidence before runtime support can be claimed, Phase 57 requires implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed, Phase 58 validates runtime implementation evidence after Phase 57, Phase 59 records release-enable approval evidence after Phase 58, Phase 60 records support-presence assertion evidence after Phase 59, and Phase 61 records runtime activation controls and activation-ready reporting after Phase 60. The main app startup path still runs this guard before serving traffic; managed/Postgres hints can be accepted only when a recognized Postgres adapter hint is paired with a managed database URL and the Phase 52 startup support assertion is present. Horizontal writers, regional failover, PITR, and active-active needs remain blocked until a real topology design package documents the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy, passes review, has implementation authorization recorded, includes readiness/rollout-safety evidence, locks implementation scope, records release-owner signoff, provides Phase 58 runtime implementation/consistency/failover/data-integrity validation evidence, operations runbook, and runtime release signoff, records Phase 59 release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence, records Phase 60 support-presence assertion evidence, and records Phase 61 activation decision, owner, window, flag, and release-automation assertion. Phase 61 does not complete concurrency hardening, distributed dependency enforcement, recovery validation, cutover automation, final release closure, or runtime enablement by itself.

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

Phases 53, 54, 55, 56, 57, 58, 59, 60, and 61 do not widen this allowed posture. They record that multi-writer/distributed database runtime support is still unimplemented and that any production requirement for horizontal database writers, regional failover, PITR, or active-active writes must stop at topology design ownership, a complete design package, package review, implementation authorization, implementation readiness, rollout-safety evidence, implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, release-owner signoff, runtime implementation evidence, consistency/failover/data-integrity validation evidence, operations runbook, runtime release signoff, release-enable decision, approver, rollout window, monitoring signoff, abort plan, release ticket, support-presence assertion evidence, activation decision, activation owner, activation window, activation flag, and release automation assertion before later phases can harden, enforce, validate, automate, and close the release.

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

The Phase 48 store boundary uses the same intent shape inside the current synchronous `loadStore()` / `mutateStore()` backend selection. Phase 49 then adds the `loadStoreAsync()` / `mutateStoreAsync()` boundary foundation. Phase 50 adds a managed Postgres document-store adapter behind that async boundary plus `npm run db:backfill-managed-postgres` and `npm run db:verify-managed-postgres`. Phase 51 is represented as call-site migration evidence. Phase 52 is the explicit startup support assertion: the guard may allow managed/Postgres startup only for recognized Postgres adapter + managed database URL configurations, and continues to block unsupported managed store names, incomplete hint pairs, and managed/multi-writer topology claims. Phase 53 keeps those managed/multi-writer topology claims blocked as requirements until an owned topology design exists. Phase 54 requires that design to become a reviewable package with the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy. Phase 55 requires evidence that the package was reviewed and explicitly authorized for implementation before runtime work starts. Phase 56 requires implementation readiness and rollout-safety evidence before runtime support can be claimed. Phase 57 requires the implementation scope to be locked, guarded by a runtime feature flag or deployment gate, backed by validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Phase 58 requires Phase 57 complete plus runtime implementation evidence, consistency validation evidence, failover validation evidence, data-integrity validation evidence, operations runbook, and runtime release signoff before runtime-implementation validation can pass. Phase 59 requires Phase 58 complete plus release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence before release-enable approval can pass. Phase 60 requires Phase 59 complete plus support-presence assertion evidence. Phase 61 requires Phase 60 complete plus runtime activation controls before checks can report activation-ready, while still keeping runtime support and release blocked.

## Phase 61 Runtime Activation Controls

After Phase 60 support-presence assertion evidence exists, Phase 61 records the activation controls needed before a future release can proceed toward activation. The evidence must include:

- Activation decision: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION`.
- Activation owner: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER`.
- Activation window: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW`.
- Activation flag: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG`.
- Release automation assertion: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION`.

The guard and release-readiness reports surface whether those five values are configured, whether `activationControlsReady` is true, and whether the Phase 61 activation gate can report activation-ready for the proposed posture. This is activation-control evidence only. It does not complete managed Postgres horizontal-writer concurrency hardening, distributed dependency enforcement, failover/PITR recovery validation, cutover/rollback automation, observability automation, final documentation freeze, active-active writes, regional failover, PITR runtime support, multi-writer runtime support, or release closure.

## What It Blocks

The guard blocks:

- Unsupported `TASKLOOM_STORE` values, including managed database store names outside the Phase 52 recognized Postgres adapter + managed database URL posture.
- Unpaired or unsupported managed database URL hints through `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, or `TASKLOOM_DATABASE_URL`.
- Multi-writer or managed topology hints through `TASKLOOM_DATABASE_TOPOLOGY`.
- Production/release automation that would otherwise start Taskloom while implying managed Postgres, distributed SQLite, regional failover, PITR, active/active writes, or multi-writer support.

This is a runtime guardrail and boundary foundation. Phase 52 adds narrow managed Postgres startup assertion/validation after the Phase 50 adapter and Phase 51 call-site migration. Phase 53 is a requirements/design gate, Phase 54 is the owned design-package gate, Phase 55 is the review/implementation-authorization evidence gate, Phase 56 is the implementation-readiness/rollout-safety evidence gate, Phase 57 is the implementation-scope gate, Phase 58 is the runtime-implementation validation gate, Phase 59 is the release-enable approval evidence gate, Phase 60 is the support-presence assertion evidence gate, and Phase 61 is the runtime activation controls evidence gate, not runtime enablement. They do not add distributed SQLite, failover, PITR, active/active writes, multi-writer support, runtime activation, or release approval by themselves.

## Phase 54 Design Package Gate

Before any multi-writer/distributed runtime implementation can be scoped or claimed, the topology design package must include:

- Owner: accountable engineering/operations owner and approval path.
- Consistency model: write-leadership, conflict handling, read-after-write expectations, idempotency, and tenant/workspace isolation assumptions.
- Failover/PITR plan: RPO/RTO targets, provider controls, point-in-time restore process, failover authority, and validation cadence.
- Migration/backfill plan: source and target stores, dry-run/verify commands, cutover sequence, dual-write or freeze expectations, and drift handling.
- Observability requirements: metrics, logs, traces, replication lag, topology health, scheduler/queue signals, alert thresholds, and evidence export expectations.
- Rollback strategy: backup checkpoints, revert triggers, traffic cutback, data reconciliation, and restore/recovery decision points.

The guard can report or block topology intent, but this Phase 54 package is still planning evidence. It is not multi-writer/distributed runtime support.

## Phase 55 Review And Authorization Gate

Before any multi-writer/distributed runtime implementation can start, Phase 55 requires evidence that the Phase 54 package has been reviewed and authorized. The evidence must include:

- Review outcome and references to the reviewed package version.
- Reviewer and approver identities for engineering, operations, data, and release ownership.
- Implementation authorization scope, including any explicitly excluded runtime claims.
- Authorization date, expiry, and conditions that require re-review.
- Release-readiness or release-evidence attachment location.

The guard may surface missing Phase 55 evidence as a blocking release finding, but the evidence does not change runtime behavior. Multi-writer/distributed topology remains unsupported until a later implementation phase ships and is separately validated.

## Phase 56 Implementation Readiness And Rollout-Safety Gate

Before any multi-writer/distributed runtime support can be claimed, Phase 56 requires implementation-readiness and rollout-safety evidence. The evidence must include:

- Implementation readiness, including named implementers, scoped work items, dependency status, test plan, migration/backfill dry-run evidence, and operational runbook owner.
- Rollout controls, including feature flag or deployment gate, staged rollout sequence, canary criteria, abort criteria, and approval path for widening exposure.
- Rollback and recovery proof, including rollback rehearsal, backup/restore checkpoints, data reconciliation plan, and restore/recovery decision point.
- Observability proof, including metrics, logs, traces, replication/topology health checks, scheduler/queue signals, alert thresholds, and evidence-bundle attachment.
- Release claim boundary, including explicit exclusions from runtime support until a later implementation phase ships code and validation evidence.

The guard may surface missing Phase 56 evidence as a blocking release finding, but the evidence does not change runtime behavior. Multi-writer/distributed topology remains unsupported until a later implementation phase ships and is separately validated.

## Phase 57 Implementation Scope Gate

Before any multi-writer/distributed implementation claim can proceed, Phase 57 requires the Phase 56 evidence plus a locked implementation scope. The evidence must include:

- Phase 56 dependency references for implementation readiness and rollout safety.
- Implementation scope lock covering included work, excluded runtime claims, owner, dependencies, expiry, and scope-change re-review triggers.
- Runtime feature flag or deployment gate, disabled by default, that prevents accidental runtime exposure.
- Validation evidence for tests, migration dry-runs, rollback rehearsal, observability proof, and release-evidence attachment.
- Migration/cutover lock covering approved sequence, cutover window, freeze or dual-write expectations, abort path, and data-reconciliation owner.
- Release-owner signoff with approver identity, date, conditions, and evidence attachment location.

The guard may surface missing Phase 57 evidence as a blocking release finding, but the evidence does not change runtime behavior. Multi-writer/distributed topology remains unsupported until a later implementation phase ships code and separate validation proves the runtime path.

## Phase 58 Runtime Implementation Validation Gate

Before any multi-writer/distributed release approval can proceed, Phase 58 requires the Phase 57 evidence plus runtime-implementation validation evidence. The evidence must include:

- Runtime implementation evidence: `TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE`.
- Consistency validation evidence: `TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE`.
- Failover validation evidence: `TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE`.
- Data-integrity validation evidence: `TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE`.
- Operations runbook: `TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK`.
- Runtime release signoff: `TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF`.

The guard may surface missing Phase 58 evidence as a blocking release finding, but the evidence does not change runtime behavior. Phase 58 validates the runtime implementation evidence package only; active-active writes, regional failover, PITR runtime support, multi-writer runtime support, and release approval remain unsupported until a later release/runtime enablement phase explicitly allows them.

## Phase 59 Release-Enable Approval Gate

Before any multi-writer/distributed runtime release can be enabled, Phase 59 requires the Phase 58 evidence plus release-enable approval evidence. The evidence must include:

- Enablement decision: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION`.
- Enablement approver: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER`.
- Rollout window: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW`.
- Monitoring signoff: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF`.
- Abort plan: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN`.
- Release ticket: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET`.

The guard may surface missing Phase 59 evidence as a blocking release finding, but the evidence does not change runtime behavior. Phase 59 records release-enable approval evidence only; it does not implement active-active writes, regional failover, PITR runtime support, or multi-writer runtime support by itself. Runtime support remains blocked until the actual runtime implementation is present, explicitly supported, and approved by release automation that consumes this evidence.

## Phase 60 Support-Presence Assertion Gate

After Phase 59 release-enable approval evidence exists, Phase 60 requires support-presence assertion evidence before Phase 61 can record runtime activation controls. The evidence must include:

- Implementation present assertion: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT`.
- Explicit support statement: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT`.
- Compatibility matrix: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX`.
- Cutover evidence: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE`.
- Release automation approval: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL`.
- Owner acceptance: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE`.

The guard may surface missing Phase 60 evidence as a blocking release finding, but the evidence does not change runtime behavior. Phase 60 records support-presence assertion evidence only; it does not implement active-active writes, regional failover, PITR runtime support, or multi-writer runtime support by itself, and it does not enable behavior. Runtime support remains blocked after Phase 60; Phase 61 can record activation controls, but Phases 62 through 66 still must complete concurrency hardening, dependency enforcement, recovery validation, cutover automation, and final release closure.

## Bypass Policy

`TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS` is a stern break-glass/dev-only escape hatch. Use it only for controlled local experiments where an operator is deliberately testing guard behavior or unreleased runtime work.

Do not set the bypass in production, release handoff, CI gates that certify production readiness, or customer-facing environments. The bypass does not turn on managed database support, does not make unsupported stores safe, and must not be used as evidence that managed Postgres or multi-writer runtime support exists.

## Relationship To Phases 42-61

Phase 42 reports the current storage posture. Phase 43 gates release readiness over storage, backup/restore, and persistent paths. Phase 44 packages redacted readiness/topology/environment evidence for handoff. Phase 45 documents managed database topology intent and implementation gaps as an advisory.

Phase 46 is the runtime guard layer: it blocks unsupported managed database and multi-writer hints before startup or release automation proceeds. Phase 47 integrates the guard result into the Phase 43 release-readiness gate and the Phase 44 release evidence bundle, so blocked/advisory managed database findings travel with the handoff evidence. Phase 48 adds the in-runtime managed database boundary/foundation. Phase 49 lands the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 tracks runtime call-site migration separately from both the adapter and the guard. Phase 52 asserts/validates managed Postgres startup support after that migration. Phase 53 captures the remaining multi-writer/distributed topology requirements as a design gate. Phase 54 requires the owned design package before any implementation work starts. Phase 55 requires review and implementation-authorization evidence for that package before runtime implementation can start. Phase 56 requires implementation-readiness and rollout-safety evidence before runtime support can be claimed. Phase 57 requires the implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Phase 58 requires runtime implementation evidence, consistency validation evidence, failover validation evidence, data-integrity validation evidence, operations runbook, and runtime release signoff before runtime-implementation validation can pass. Phase 59 requires release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence before release-enable approval can pass. Phase 60 requires implementation-present assertion, explicit support statement, compatibility matrix, cutover evidence, release automation approval, and owner acceptance. Phase 61 requires the activation decision, activation owner, activation window, activation flag, and release automation assertion before checks can report activation-ready.

After Phase 47, release handoffs include the managed database advisory and guard findings. After Phase 48, the store runtime also has the boundary needed to prevent accidental managed database startup. After Phase 49, async store boundaries exist. After Phase 50, the managed Postgres adapter/backfill foundation is documented as landed. After Phase 51 evidence appears, operators can see that no tracked sync call-site groups remain. After Phase 52, recognized Postgres adapter + managed database URL hints can be accepted as managed Postgres startup configuration. After Phase 53, horizontal writers, regional failover, PITR, and active-active writes are explicit blockers until a real topology is designed and owned. After Phase 54, implementation still remains blocked unless the design package documents the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy. After Phase 55, implementation still remains blocked unless the reviewed package has explicit implementation authorization evidence. After Phase 56, runtime support still remains blocked unless implementation readiness, staged rollout controls, rollback/recovery proof, observability proof, and release-claim boundaries are attached. After Phase 57, implementation claims still remain blocked unless scope is locked, runtime exposure is gated, validation evidence is attached, migration/cutover is locked, and release-owner signoff is recorded. After Phase 58, runtime implementation evidence may be validated. After Phase 59, release-enable approval evidence may be recorded. After Phase 60, support-presence assertion evidence may be recorded. After Phase 61, activation controls may be recorded and readiness reports may say activation-ready, but active-active/regional/PITR runtime support, multi-writer runtime support, and release approval remain blocked until Phases 62 through 66 complete concurrency hardening, distributed dependency enforcement, recovery validation, cutover automation, and final release closure.

Use `docs/deployment-storage-topology.md` for the Phase 42 posture report, `docs/deployment-release-readiness.md` for release gates, `docs/deployment-release-evidence.md` for handoff bundles, `docs/deployment-managed-database-topology.md` for managed database planning, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
