# Deployment Release Evidence

Phase 44 adds a release evidence bundle/export layer on top of the Phase 42 storage topology report and the Phase 43 release-readiness gate. Phase 47 extends the bundle so it also carries Phase 45 managed database advisory findings and Phase 46 runtime-guard findings. Phase 48 adds the matching managed database runtime boundary/foundation in the synchronous store path. Phase 49 lands the async store boundary foundation, Phase 50 lands the managed Postgres adapter/backfill foundation, Phase 51 adds runtime call-site migration evidence, and Phase 52 adds managed Postgres startup support assertion/validation. Phase 53 adds the multi-writer topology requirements/design gate after Phase 52, Phase 54 requires an owned design package before any multi-writer runtime implementation, Phase 55 requires design-package review plus implementation-authorization evidence before runtime implementation can start, Phase 56 requires implementation-readiness plus rollout-safety evidence before runtime support can be claimed, Phase 57 requires implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed, and Phase 58 validates runtime implementation evidence after Phase 57. The export is meant for handoff packets where operators need a redacted snapshot of the readiness, topology, managed database posture, runtime guard, runtime boundary, async-boundary foundation, adapter/backfill foundation, call-site migration status, startup assertion status, multi-writer topology gate context, design-package status, review/authorization evidence, implementation-readiness/rollout-safety evidence, implementation-scope evidence, runtime-implementation validation evidence, and environment evidence behind a release decision.

Create the default evidence bundle before release handoff:

```bash
npm run deployment:export-evidence
```

Use strict mode in CI or release automation that should fail when blocking readiness findings are present:

```bash
npm run deployment:export-evidence -- --strict
```

## What It Packages

The Phase 44 evidence export packages release-facing evidence such as:

- Phase 43 release-readiness output.
- Phase 42 storage topology posture.
- Phase 45 managed database topology advisory output and attachments, including redacted managed database intent/gap findings.
- Phase 46 managed database runtime-guard output and attachments, including blocked runtime hints and bypass posture when present.
- Phase 48 runtime-boundary context: managed/Postgres store modes and managed database URL hints fail closed in the current synchronous store path.
- Phase 49 async-boundary-foundation context.
- Phase 50 managed Postgres adapter/backfill foundation context, including `TASKLOOM_MANAGED_DATABASE_ADAPTER`, `npm run db:backfill-managed-postgres`, and `npm run db:verify-managed-postgres`.
- Phase 51 runtime call-site migration context, including the empty tracked sync call-site group list.
- Phase 52 managed Postgres startup support assertion context, including the recognized Postgres adapter + managed database URL requirement.
- Phase 53/54/55/56/57/58 multi-writer topology gate context, including blocked horizontal writers, regional failover, PITR, active-active requirements, design-package status, review/authorization status, implementation-readiness status, rollout-safety status, implementation-scope status, and runtime-implementation validation status.
- Phase 54 design-package evidence when multi-writer implementation is proposed: owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy.
- Phase 55 review and implementation-authorization evidence when multi-writer implementation is proposed: reviewed package version, review outcome, reviewers/approvers, authorization scope, approval date/expiry, and release-evidence attachment.
- Phase 56 implementation-readiness and rollout-safety evidence when multi-writer implementation is proposed: implementers, scoped work items, dependency status, test plan, migration/backfill dry-run evidence, staged rollout controls, rollback/recovery proof, observability proof, and release-claim boundaries.
- Phase 57 implementation-scope evidence when multi-writer implementation is proposed: Phase 56 dependency, implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff.
- Phase 58 runtime-implementation validation evidence when multi-writer implementation is proposed: `TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE`, `TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE`, `TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE`, `TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE`, `TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK`, and `TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF`.
- Environment and runtime evidence that is safe to include in an operator handoff.
- Persistent-path, backup/restore-readiness, and storage-topology findings needed to explain the release decision.

The export redacts secrets and token-like values before they enter the bundle. Treat the bundle as shareable operational evidence, not as a raw environment dump.

## What It Does Not Do

The evidence export is packaging-only. It does not:

- Run backups.
- Run tests or builds.
- Restore data.
- Provision managed DBs or managed database repositories.
- Add broad managed database topology or multi-writer runtime support.
- Make SQLite distributed or safe for multi-writer production topologies.
- Approve a release for active-active, regional failover, PITR, or multi-writer runtime support.

Local JSON/default storage and supported single-node SQLite remain allowed runtime postures. Managed/Postgres hints can be accepted only under the Phase 52 rule: recognized Postgres adapter + managed database URL + startup support assertion. Missing adapter/URL pairs, unsupported managed store names, and multi-writer topology hints remain blocked or advisory. Phase 48 provides the runtime boundary, Phase 49 adds async store boundary foundation, Phase 50 adds the managed Postgres document-store adapter/backfill foundation, Phase 51 exposes call-site migration evidence with no remaining tracked sync call-site groups, Phase 52 validates the guarded startup posture, Phase 53 records multi-writer/distributed topology needs as blocked requirements until a real topology is designed and owned, Phase 54 requires the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy before any implementation, Phase 55 requires reviewed package and implementation-authorization evidence before implementation can start, Phase 56 requires implementation-readiness and rollout-safety evidence before runtime support can be claimed, Phase 57 requires implementation scope lock plus release-owner signoff before implementation claims can proceed, and Phase 58 requires runtime implementation/consistency/failover/data-integrity validation evidence, operations runbook, and runtime release signoff before runtime-implementation validation can pass. SQLite remains a single-node storage posture, and regional failover, PITR, active/active writes, any multi-writer database topology, and release approval remain future implementation work until a later release/runtime enablement phase explicitly allows them.

## Relationship To Earlier Phases

Phase 42 answers whether the storage topology matches Taskloom's supported posture. Phase 43 asks whether the release should proceed by checking backup/restore readiness, persistent paths, and topology findings. Phase 44 packages the redacted evidence from those layers for handoff without changing the checks or mutating production data. Phase 45 adds managed database topology advisory reporting through `npm run deployment:check-managed-db`; it remains reporting/planning only. Phase 46 adds `npm run deployment:check-runtime-guard` to block unsupported managed database and multi-writer runtime hints before startup/release automation. Phase 47 integrates the Phase 45/46 results into the readiness and evidence handoff story without changing runtime support. Phase 48 adds the managed database boundary/foundation to the synchronous store path. Phase 49 adds the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 adds runtime call-site migration evidence with no remaining tracked sync call-site groups. Phase 52 asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations. Phase 53 captures horizontal writers, regional failover, PITR, and active-active writes as requirements/design blockers rather than implemented runtime support. Phase 54 requires an owned design package before those blockers can become implementation work. Phase 55 records design-package review and implementation-authorization evidence before runtime implementation can start, without adding runtime support. Phase 56 records implementation-readiness and rollout-safety evidence before runtime support can be claimed, also without adding runtime support. Phase 57 records implementation-scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed, also without adding runtime support. Phase 58 records runtime implementation evidence, consistency validation evidence, failover validation evidence, data-integrity validation evidence, operations runbook, and runtime release signoff before runtime-implementation validation can pass, also without enabling active-active/regional/PITR runtime support, multi-writer runtime support, or release approval.

Use `docs/deployment-release-readiness.md` for the release gate, `docs/deployment-storage-topology.md` for topology boundaries, `docs/deployment-managed-database-topology.md` for the managed database advisory, `docs/deployment-managed-database-runtime-guard.md` for guard and bypass policy, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
