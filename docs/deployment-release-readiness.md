# Deployment Release Readiness

Phase 43 layers deployment release-readiness gates on top of the Phase 42 storage topology report. The gate is meant for release automation and pre-production handoff checks that need one command to confirm the deployment plan has covered the local-store risks that Taskloom can inspect.

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

The release gate is intentionally a readiness check. It does not perform backups, restore data, provision managed databases, add managed database repositories, or make SQLite distributed. SQLite remains a single-node storage posture, and any managed Postgres, regional failover, or multi-writer database implementation remains deployment-owned work.

## Relationship To Phase 42

Phase 42 answers whether the storage topology itself is aligned with Taskloom's supported posture. Phase 43 asks whether a release should proceed with that topology by also checking backup/restore readiness and persistent-path coverage.

Use `docs/deployment-storage-topology.md` for the underlying topology boundaries and `docs/deployment-sqlite-topology.md` for SQLite-specific WAL, `busy_timeout`, `BEGIN IMMEDIATE`, backup/restore, and network filesystem guidance.

## Relationship To Phase 44

Phase 44 packages the Phase 43 release-readiness result, the Phase 42 storage topology posture, and redacted environment/runtime evidence into a release handoff bundle through `npm run deployment:export-evidence` or `npm run deployment:export-evidence -- --strict`. The evidence export does not run backups, tests, or builds; restore data; provision managed DBs; or make SQLite distributed. See `docs/deployment-release-evidence.md`.
