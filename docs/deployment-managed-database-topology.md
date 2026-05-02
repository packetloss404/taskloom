# Deployment Managed Database Topology Advisory

Phase 45 adds managed production database topology readiness reporting. It is advisory/planning work: it helps operators see when a deployment needs a managed database plan. Phase 50 is documented as the landed managed Postgres document-store adapter/backfill foundation, Phase 51 tracks runtime call-site migration separately with no remaining tracked sync call-site groups, and Phase 52 asserts/validates managed Postgres startup support. Phase 53 is the multi-writer topology requirements/design gate after Phase 52. Phase 54 makes that gate an owned design-package requirement before any multi-writer runtime implementation. Phase 55 adds the design-package review and implementation-authorization evidence gate before runtime implementation can start. Phase 56 adds the implementation-readiness and rollout-safety evidence gate before runtime support can be claimed. Phase 57 adds the implementation-scope gate after Phase 56, requiring implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Phase 58 adds a conservative runtime-implementation validation gate after Phase 57. Phase 59 adds a conservative release-enable approval gate after Phase 58. Phase 60 adds a conservative support-presence assertion gate after Phase 59. Phase 61 adds runtime activation controls and activation-ready reporting after Phase 60. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening. Phase 63 enforces production-safe shared dependencies before strict activation. Phase 64 completes recovery validation for backup restore, provider PITR rehearsal, provider failover rehearsal, data-integrity checks, and RPO/RTO expectations. Phase 65 completes cutover preflight, activation dry-run, post-activation smoke checks, rollback command guidance, and monitoring thresholds. This topology advisory still does not add distributed SQLite, Taskloom-owned regional failover, Taskloom-owned PITR runtime support, active-active multi-region writes, final release closure, runtime activation, or release approval. Phase 66 is next.

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
- Phase 61 activation controls: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION`, `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER`, `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW`, `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG`, and `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION`.

Treat these values as advisory inputs for startup readiness. Managed/Postgres startup can be accepted only when a recognized Postgres adapter value is paired with a managed database URL hint and the Phase 52 startup support assertion is present. Setting topology hints does not add replicas, provide regional failover, enable PITR, or make active/active writes safe. Phase 62 hardens managed Postgres horizontal app-writer concurrency for the supported topology only. Phase 53 through Phase 61 capture the design, evidence, approval, support-presence, and activation-control requirements that had to exist before that hardening could be claimed. Phase 63 still must enforce distributed operational dependencies before activation can proceed. Use `npm run db:backfill-managed-postgres` and `npm run db:verify-managed-postgres` for the Phase 50 adapter/backfill foundation workflow.

Phase 63 treats strict activation as unsafe until the deployment posture includes production-safe shared dependencies for distributed rate limiting, scheduler coordination, durable job execution, access-log shipping, alert delivery, and health monitoring. Local-only dependency modes can still be used for local JSON/default and single-node SQLite development, but they cannot be used as evidence that a horizontally scaled managed Postgres deployment is ready to activate.

Phase 46 adds a separate runtime guard for startup and release automation through `npm run deployment:check-runtime-guard` and `npm run deployment:check-runtime-guard -- --strict`. Where this Phase 45 advisory reports managed database intent for planning, the Phase 46/63 guard blocks unsupported managed database URL hints, unsupported `TASKLOOM_STORE` values, managed/multi-writer `TASKLOOM_DATABASE_TOPOLOGY` hints, and strict activation with missing or local-only distributed dependencies before they can be treated as supported runtime configuration. Phase 48 adds the matching runtime boundary/foundation inside the synchronous app-store path. Phase 49 lands the async store boundary foundation. Phase 50 lands the managed Postgres document-store adapter/backfill foundation. Phase 51 adds runtime call-site migration evidence with no remaining tracked sync call-site groups. Phase 52 lets the guard accept only the recognized Postgres adapter + managed database URL startup posture. Phase 53 keeps regional failover, PITR, and active-active writes out of runtime support until topology design ownership exists. Phase 54 defines the required design-package fields, Phase 55 records review/implementation-authorization evidence, Phase 56 records implementation-readiness/rollout-safety evidence, Phase 57 locks implementation scope and release-owner signoff, Phase 58 validates runtime implementation evidence, Phase 59 records release-enable approval evidence, Phase 60 records support-presence assertion evidence, Phase 61 records activation controls/activation-ready reporting, Phase 62 hardens managed Postgres horizontal app-writer concurrency, and Phase 63 records distributed dependency enforcement; these gates still do not provide distributed SQLite, regional failover, PITR runtime support, active-active multi-region writes, recovery validation, cutover automation, final release closure, runtime activation, or automatic release approval. See `docs/deployment-managed-database-runtime-guard.md`.

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

## Phase 58 Runtime Implementation Validation Gate

After Phase 57 implementation-scope evidence exists, Phase 58 requires runtime-implementation validation evidence before any multi-writer or distributed database release approval can be considered. The evidence must document:

- Runtime implementation evidence: `TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE`.
- Consistency validation evidence: `TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE`.
- Failover validation evidence: `TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE`.
- Data-integrity validation evidence: `TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE`.
- Operations runbook: `TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK`.
- Runtime release signoff: `TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF`.

This Phase 58 gate validates the runtime implementation evidence package only. It does not enable active-active writes, regional failover, PITR runtime support, multi-writer runtime support, or release approval; those remain blocked until a later release/runtime enablement phase explicitly allows them.

## Phase 59 Release-Enable Approval Gate

After Phase 58 runtime-implementation validation evidence exists, Phase 59 requires release-enable approval evidence before any multi-writer or distributed database runtime support can be released. The evidence must document:

- Enablement decision: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION`.
- Enablement approver: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER`.
- Rollout window: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW`.
- Monitoring signoff: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF`.
- Abort plan: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN`.
- Release ticket: `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET`.

This Phase 59 gate records release-enable approval evidence only. It does not implement active-active writes, regional failover, PITR runtime support, or multi-writer runtime support by itself. Runtime support remains blocked until the actual runtime implementation is present, explicitly supported, and approved by release automation that consumes this evidence.

## Phase 60 Support-Presence Assertion Gate

After Phase 59 release-enable approval evidence exists, Phase 60 requires support-presence assertion evidence before Phase 61 can record runtime activation controls. The evidence must document:

- Implementation present assertion: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT`.
- Explicit support statement: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT`.
- Compatibility matrix: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX`.
- Cutover evidence: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE`.
- Release automation approval: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL`.
- Owner acceptance: `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE`.

This Phase 60 gate records support-presence assertion evidence only. It does not implement active-active writes, regional failover, PITR runtime support, or multi-writer runtime support by itself, and it does not enable behavior. Phase 61 can record activation controls, Phase 62 completes managed Postgres horizontal app-writer concurrency hardening, Phase 63 enforces distributed dependency posture, Phase 64 completes recovery validation, and Phase 65 completes cutover automation. Phase 66 still must complete final release closure.

## Phase 61 Runtime Activation Controls Gate

After Phase 60 support-presence assertion evidence exists, Phase 61 requires runtime activation controls before reports can mark activation controls ready. The evidence must document:

- Activation decision: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION`.
- Activation owner: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER`.
- Activation window: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW`.
- Activation flag: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG`.
- Release automation assertion: `TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION`.

This Phase 61 gate records activation-control evidence and activation-ready reporting only. It does not implement active-active writes, regional failover, PITR runtime support, multi-writer runtime support, managed Postgres horizontal-writer concurrency hardening, distributed dependency enforcement, recovery validation, cutover automation, or final release closure by itself.

## Phase 62 Horizontal App-Writer Concurrency Hardening

Phase 62 is complete for managed Postgres horizontal app-writer concurrency hardening. It covers the approved posture of multiple Taskloom app processes writing to the same managed Postgres database, not broad multi-region database topology.

Phase 62 does not enable active-active multi-region writes, regional failover, PITR runtime support, distributed SQLite, distributed dependency enforcement, recovery validation, cutover automation, final release closure, runtime activation, or release approval.

## Phase 63 Distributed Dependency Enforcement

Phase 63 is complete for strict activation dependency posture. A horizontally scaled managed Postgres deployment cannot claim activation readiness while still relying on local-only coordination paths.

The dependency posture covers:

- Distributed rate limiting for auth and invitation abuse controls.
- Scheduler coordination that is not local-only for horizontally scaled runtimes.
- Durable job execution posture for queued agent, metrics, alert, and delivery work.
- Access-log shipping into a deployment-managed log pipeline rather than unshipped local files.
- Alert delivery with retry/dead-letter visibility so production incidents are not trapped in-process.
- Health monitoring that includes public probes plus operator status/health surfaces.

Phase 63 does not validate failover/PITR recovery, automate cutover/rollback, close final release documentation, enable runtime activation, or approve a release. Phase 64 validates managed Postgres provider-owned recovery evidence, and Phase 65 now validates repeatable cutover/rollback automation before Phase 66 final release closure.

## Phase 64 Recovery Validation

Phase 64 is complete for the supported target posture: horizontal Taskloom app writers against one managed Postgres primary/cluster. Database HA, failover mechanics, backup retention, and PITR are provider-owned controls, and Taskloom operators must attach rehearsal evidence that those controls meet the deployment's RPO/RTO expectations.

Use the canonical Phase 64 evidence names implemented in code when preparing recovery artifacts:

- `TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE`: backup restore rehearsal output.
- `TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE`: point-in-time restore rehearsal output.
- `TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE`: provider-owned HA/failover rehearsal output.
- `TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE`: post-restore and post-failover data-integrity checks.
- `TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION`: accepted RTO/RPO or recovery-time threshold.

Operations status/health also recognize compatibility aliases such as `TASKLOOM_RECOVERY_BACKUP_RESTORE_EVIDENCE`, `TASKLOOM_RECOVERY_PITR_REHEARSAL_EVIDENCE`, `TASKLOOM_RECOVERY_FAILOVER_REHEARSAL_EVIDENCE`, `TASKLOOM_RECOVERY_DATA_INTEGRITY_VALIDATION`, and `TASKLOOM_RECOVERY_TIME_EXPECTATIONS`, but the managed Postgres names above are the canonical release-readiness and release-evidence inputs.

Do not use Phase 64 evidence to claim active-active multi-region writes, distributed SQLite, Taskloom-owned regional database failover, or Taskloom-owned PITR runtime behavior. Those remain unsupported topology claims unless a later code and docs lane explicitly implements them. Phase 65 adds cutover/rollback evidence for the supported posture only, with Phase 66 final release closure still required.

## What It Checks

The Phase 45 check calls out whether the declared or inferred deployment intent matches the current runtime:

- JSON storage is not a production database topology.
- SQLite is supported only as a single-node local/preview/production persistence posture with durable local disk and validated backups.
- Managed Postgres startup is supported only under the Phase 52 assertion rule: recognized Postgres adapter hint plus managed database URL hint. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening for the approved posture, Phase 63 blocks strict activation unless the shared dependency posture is production-safe, Phase 64 validates provider-owned HA/PITR recovery evidence, and Phase 65 validates cutover/rollback/observability automation. Taskloom-owned regional database failover/PITR runtime behavior, active-active multi-region writes, distributed SQLite, final release closure, runtime activation, and release approval remain blocked until Phase 66 final release closure.
- Scheduler leader election and distributed rate limiting coordinate their own scopes only; they do not make SQLite distributed or multi-writer.
- Phase 48 provides the managed database runtime boundary/foundation in the synchronous store path. Phase 49 provides the async store boundary foundation. Phase 50 provides the managed Postgres adapter/backfill foundation. Phase 51 provides call-site migration evidence. Phase 52 provides narrow startup assertion/validation. Phase 53 provides the requirements/design gate for multi-writer topology. Phase 54 requires the owned design package. Phase 55 requires review and implementation-authorization evidence. Phase 56 requires implementation-readiness and rollout-safety evidence. Phase 57 requires implementation-scope lock and release-owner signoff. Phase 58 requires runtime implementation/consistency/failover/data-integrity validation evidence, operations runbook, and runtime release signoff. Phase 59 requires release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence. Phase 60 requires implementation-present assertion, explicit support statement, compatibility matrix, cutover evidence, release automation approval, and owner acceptance. Phase 61 requires activation decision, owner, window, flag, and release automation assertion. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening. Phase 63 enforces distributed dependency posture. Phase 64 completes provider-owned HA/PITR recovery validation. Phase 65 completes cutover/rollback/observability automation; runtime activation remains pending until Phase 66 final release closure.

## Relationship To Prior Phases

Phase 42 reports the current storage posture. Phase 43 gates release readiness over storage, backup/restore, and persistent paths. Phase 44 packages redacted readiness/topology/environment evidence for handoff. Phase 45 adds a more explicit managed-database gap/advisory layer for operators planning production database topology. Phase 46 adds runtime guardrails that block unsupported managed database and multi-writer hints before startup or release automation proceeds. Phase 47 carries those advisory/guard findings into release readiness and evidence handoff. Phase 48 adds the fail-closed managed database boundary to the current synchronous store runtime. Phase 49 adds the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 tracks runtime call-site migration. Phase 52 asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations. Phase 53 captures multi-writer/distributed database requirements as a design gate, not implementation. Phase 54 requires the owned design package before any multi-writer runtime implementation can proceed. Phase 55 requires review and implementation-authorization evidence for that package before runtime implementation can start. Phase 56 requires implementation-readiness and rollout-safety evidence before runtime support can be claimed. Phase 57 requires Phase 56 plus implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Phase 58 requires Phase 57 complete plus runtime implementation evidence, consistency validation evidence, failover validation evidence, data-integrity validation evidence, operations runbook, and runtime release signoff before runtime-implementation validation can pass. Phase 59 requires Phase 58 complete plus release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence before release-enable approval can pass. Phase 60 requires Phase 59 complete plus support-presence assertion evidence. Phase 61 requires Phase 60 complete plus activation decision, owner, window, flag, and release automation assertion evidence before checks can report activation-ready controls. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening. Phase 63 completes distributed dependency enforcement for strict activation. Phase 64 completes recovery validation for provider-owned managed Postgres HA/PITR. Phase 65 completes cutover/rollback/observability automation, but it does not enable active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, distributed SQLite, final release closure, runtime activation, or release approval. Phase 66 is next.

Use `docs/deployment-storage-topology.md` for the Phase 42 posture report, `docs/deployment-release-readiness.md` for release gates, `docs/deployment-release-evidence.md` for handoff bundles, `docs/deployment-managed-database-runtime-guard.md` for the Phase 46 runtime guard, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
