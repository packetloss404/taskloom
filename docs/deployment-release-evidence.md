# Deployment Release Evidence

Phase 44 adds a release evidence bundle/export layer on top of the Phase 42 storage topology report and the Phase 43 release-readiness gate. It is meant for handoff packets where operators need a redacted snapshot of the readiness, topology, and environment evidence behind a release decision.

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
- Environment and runtime evidence that is safe to include in an operator handoff.
- Persistent-path, backup/restore-readiness, and storage-topology findings needed to explain the release decision.

The export redacts secrets and token-like values before they enter the bundle. Treat the bundle as shareable operational evidence, not as a raw environment dump.

## What It Does Not Do

The evidence export is packaging-only. It does not:

- Run backups.
- Run tests or builds.
- Restore data.
- Provision managed DBs or managed database repositories.
- Make SQLite distributed or safe for multi-writer production topologies.

SQLite remains a single-node storage posture. Managed Postgres, regional failover, PITR, active/active writes, and any multi-writer database topology remain deployment-owned implementation work.

## Relationship To Earlier Phases

Phase 42 answers whether the storage topology matches Taskloom's supported posture. Phase 43 asks whether the release should proceed by checking backup/restore readiness, persistent paths, and topology findings. Phase 44 packages the redacted evidence from those layers for handoff without changing the checks or mutating production data. Phase 45 adds a separate managed database topology advisory through `npm run deployment:check-managed-db`; it remains reporting/planning only.

Use `docs/deployment-release-readiness.md` for the release gate, `docs/deployment-storage-topology.md` for topology boundaries, `docs/deployment-managed-database-topology.md` for the managed database advisory, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
