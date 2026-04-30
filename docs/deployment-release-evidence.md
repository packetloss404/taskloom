# Deployment Release Evidence

Phase 44 adds a release evidence bundle/export layer on top of the Phase 42 storage topology report and the Phase 43 release-readiness gate. Phase 47 extends the bundle so it also carries Phase 45 managed database advisory findings and Phase 46 runtime-guard findings. Phase 48 adds the matching managed database runtime boundary/foundation in the synchronous store path. Phase 49 lands the async store boundary foundation for the next managed-database implementation step. The export is meant for handoff packets where operators need a redacted snapshot of the readiness, topology, managed database posture, runtime guard, runtime boundary, async-boundary foundation, and environment evidence behind a release decision.

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
- Phase 49 async-boundary-foundation context: the next managed database implementation phase is the actual managed Postgres adapter/repositories/backfills, not a support claim.
- Environment and runtime evidence that is safe to include in an operator handoff.
- Persistent-path, backup/restore-readiness, and storage-topology findings needed to explain the release decision.

The export redacts secrets and token-like values before they enter the bundle. Treat the bundle as shareable operational evidence, not as a raw environment dump.

## What It Does Not Do

The evidence export is packaging-only. It does not:

- Run backups.
- Run tests or builds.
- Restore data.
- Provision managed DBs or managed database repositories.
- Add managed database runtime support.
- Make SQLite distributed or safe for multi-writer production topologies.

Local JSON/default storage and supported single-node SQLite remain allowed runtime postures. Managed database requests, managed database URL hints, and multi-writer topology hints are blocked or advisory until implementation lands. Phase 48 means those hints also fail closed inside the synchronous store runtime; Phase 49 adds async store boundary foundation. Neither phase means managed Postgres is supported. SQLite remains a single-node storage posture. The Phase 50 actual managed Postgres adapter/repositories/backfills, regional failover, PITR, active/active writes, and any multi-writer database topology remain future implementation work.

## Relationship To Earlier Phases

Phase 42 answers whether the storage topology matches Taskloom's supported posture. Phase 43 asks whether the release should proceed by checking backup/restore readiness, persistent paths, and topology findings. Phase 44 packages the redacted evidence from those layers for handoff without changing the checks or mutating production data. Phase 45 adds managed database topology advisory reporting through `npm run deployment:check-managed-db`; it remains reporting/planning only. Phase 46 adds `npm run deployment:check-runtime-guard` to block unsupported managed database and multi-writer runtime hints before startup/release automation. Phase 47 integrates the Phase 45/46 results into the readiness and evidence handoff story without changing runtime support. Phase 48 adds the managed database boundary/foundation to the synchronous store path so managed/Postgres hints fail closed. Phase 49 adds the async store boundary foundation while leaving managed Postgres runtime support for Phase 50 or later implementation.

Use `docs/deployment-release-readiness.md` for the release gate, `docs/deployment-storage-topology.md` for topology boundaries, `docs/deployment-managed-database-topology.md` for the managed database advisory, `docs/deployment-managed-database-runtime-guard.md` for guard and bypass policy, and `docs/deployment-sqlite-topology.md` for SQLite-specific limits.
