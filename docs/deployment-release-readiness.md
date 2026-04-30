# Deployment Release Readiness

Phase 43 layers deployment release-readiness gates on top of the Phase 42 storage topology report. Phase 47 extends that handoff story by carrying Phase 45 managed database advisory findings and Phase 46 runtime-guard findings into the same release-readiness decision. Phase 48 adds the managed database runtime boundary/foundation in the synchronous app-store path, so the release story now has both handoff evidence and a fail-closed runtime boundary. Phase 49 lands the async store boundary foundation, Phase 50 lands the managed Postgres adapter/backfill foundation, Phase 51 tracks runtime call-site migration, and Phase 52 asserts/validates managed Postgres startup support. The gate is meant for release automation and pre-production handoff checks that need one command to confirm the deployment plan has covered the local-store and guarded managed-database risks that Taskloom can inspect.

Run the default advisory check before handoff:

```bash
npm run deployment:check-release
```

Use strict mode in CI or release gates that should fail on release-blocking findings:

```bash
npm run deployment:check-release -- --strict
```

## What It Checks

The Phase 43 release-readiness gate checks that the deployment plan has accounted for:

- Backup readiness for the active local store.
- Restore-readiness documentation or validation expectations for the chosen storage path.
- Persistent paths for SQLite data, artifacts, and deployment logs that must survive restarts.
- Phase 42 storage topology posture, including JSON-local limits, SQLite single-node limits, and managed database requirements for horizontal writers, failover, PITR, or active/active needs.
- Phase 45 managed database topology advisory findings and attachments, including any managed database intent or implementation gaps surfaced by `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, `TASKLOOM_DATABASE_URL`, `TASKLOOM_DATABASE_TOPOLOGY`, or `TASKLOOM_STORE`.
- Phase 46 runtime-guard findings and attachments, including unsupported store values, managed database URL hints, managed/multi-writer topology hints, and any break-glass bypass posture that must not be treated as production support.
- Phase 48 runtime-boundary context for the synchronous store path, where managed/Postgres store modes and managed database URL hints fail closed.
- Phase 49 async-boundary-foundation context.
- Phase 50 managed Postgres adapter/backfill foundation context, including `TASKLOOM_MANAGED_DATABASE_ADAPTER`, `npm run db:backfill-managed-postgres`, and `npm run db:verify-managed-postgres`.
- Phase 51 runtime call-site migration context, including the fact that the tracked sync call-site group list is empty.
- Phase 52 managed Postgres startup support assertion context, including the requirement that accepted managed/Postgres hints have both a recognized Postgres adapter and a managed database URL.

The release gate is intentionally a readiness check. It does not perform backups, restore data, provision managed databases, add broad managed database topology, or make SQLite distributed. Local JSON/default storage and supported single-node SQLite remain allowed. Managed/Postgres hints can be accepted only under the Phase 52 rule: recognized Postgres adapter + managed database URL + startup support assertion. Missing adapter/URL pairs, unsupported managed store names, and multi-writer topology hints remain blocked or advisory. Phase 48 adds a runtime boundary/foundation, Phase 49 adds the async store boundary foundation, Phase 50 lands the managed Postgres document-store adapter/backfill foundation, Phase 51 reports call-site migration evidence with no remaining tracked sync call-site groups, and Phase 52 validates the guarded startup posture. Regional failover, PITR, active/active writes, and multi-writer database implementation remain future/deployment-owned work.

## Relationship To Phase 42

Phase 42 answers whether the storage topology itself is aligned with Taskloom's supported posture. Phase 43 asks whether a release should proceed with that topology by also checking backup/restore readiness and persistent-path coverage.

Use `docs/deployment-storage-topology.md` for the underlying topology boundaries and `docs/deployment-sqlite-topology.md` for SQLite-specific WAL, `busy_timeout`, `BEGIN IMMEDIATE`, backup/restore, and network filesystem guidance.

## Relationship To Phases 45-46

Phase 45 answers whether operators have signaled managed database intent and whether that intent matches Taskloom's current implementation. Phase 46 answers whether the runtime should be allowed to start with the provided database hints. Phase 47 makes those findings part of the release-readiness record so release automation can hand off a complete storage story without claiming broad managed database topology. Phase 48 adds the corresponding in-runtime boundary to the synchronous store path. Phase 49 adds the async store boundary foundation. Phase 50 lands the managed Postgres adapter/backfill foundation. Phase 51 adds reportable call-site migration evidence. Phase 52 is the assertion/validation step that lets managed/Postgres hints pass strict readiness only when the recognized adapter + managed database URL rule is satisfied.

Use `docs/deployment-managed-database-topology.md` for the managed database advisory and `docs/deployment-managed-database-runtime-guard.md` for the runtime guard and bypass policy.

## Relationship To Phase 44

Phase 44 packages the Phase 43 release-readiness result, the Phase 42 storage topology posture, Phase 45/46 managed database advisory and runtime-guard findings, and redacted environment/runtime evidence into a release handoff bundle through `npm run deployment:export-evidence` or `npm run deployment:export-evidence -- --strict`. The evidence export does not run backups, tests, or builds; restore data; provision managed DBs; add managed database support; or make SQLite distributed. See `docs/deployment-release-evidence.md`.
