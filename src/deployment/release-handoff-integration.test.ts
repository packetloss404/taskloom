import assert from "node:assert/strict";
import test from "node:test";
import { buildReleaseEvidenceBundle, type ReleaseEvidenceBundle } from "./release-evidence.js";
import { buildReleaseReadinessReport, type ReleaseReadinessReport } from "./release-readiness.js";

function checkStatus(report: ReleaseReadinessReport, id: string): string | undefined {
  return report.checks.find((check) => check.id === id)?.status;
}

function attachmentIds(bundle: ReleaseEvidenceBundle): string[] {
  return bundle.attachments.map((attachment) => attachment.id);
}

function hasAttachmentLabel(bundle: ReleaseEvidenceBundle, label: string): boolean {
  return bundle.attachments.some((attachment) => attachment.label === label);
}

function asContractObject(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function evidenceEntry(bundle: ReleaseEvidenceBundle, name: string): { value: string | null; redacted: boolean } {
  const entry = bundle.evidence.environment.find((candidate) => candidate.name === name);
  assert.ok(entry, `expected evidence entry for ${name}`);
  return entry;
}

test("Phase 47 default local JSON handoff includes managed database reports without non-strict blockers", () => {
  const readiness = buildReleaseReadinessReport({});
  const evidence = buildReleaseEvidenceBundle(
    {},
    { generatedAt: "2026-04-28T20:47:00.000Z" },
  );
  const evidenceContract = asContractObject(evidence);

  assert.equal(readiness.readyForRelease, true);
  assert.equal(readiness.blockers.length, 0);
  assert.equal(readiness.storageTopology.mode, "json");
  assert.equal(readiness.managedDatabaseTopology.phase, "45");
  assert.equal(readiness.managedDatabaseTopology.ready, true);
  assert.equal(readiness.managedDatabaseTopology.classification, "local-json");
  assert.equal(checkStatus(readiness, "managed-database-topology"), "pass");
  assert.equal(readiness.managedDatabaseRuntimeGuard.phase, "46");
  assert.equal(readiness.managedDatabaseRuntimeGuard.allowed, true);
  assert.equal(readiness.managedDatabaseRuntimeGuard.classification, "local-json");
  assert.equal(checkStatus(readiness, "managed-database-runtime-guard"), "pass");
  assert.equal(readiness.managedDatabaseRuntimeBoundary.phase, "48");
  assert.equal(readiness.managedDatabaseRuntimeBoundary.allowed, true);
  assert.equal(readiness.managedDatabaseRuntimeBoundary.classification, "local-json");
  assert.equal(checkStatus(readiness, "managed-database-runtime-boundary"), "pass");
  assert.ok(!readiness.blockers.some((blocker) => /managed database/i.test(blocker)));

  assert.equal(evidence.readyForRelease, true);
  assert.equal(evidence.releaseReadiness.managedDatabaseTopology.phase, "45");
  assert.equal(evidence.releaseReadiness.managedDatabaseRuntimeGuard.phase, "46");
  assert.equal(evidence.releaseReadiness.managedDatabaseRuntimeBoundary.phase, "48");
  assert.deepEqual(evidenceContract.managedDatabaseTopology, evidence.releaseReadiness.managedDatabaseTopology);
  assert.deepEqual(evidenceContract.managedDatabaseRuntimeGuard, evidence.releaseReadiness.managedDatabaseRuntimeGuard);
  assert.deepEqual(evidenceContract.managedDatabaseRuntimeBoundary, evidence.releaseReadiness.managedDatabaseRuntimeBoundary);
  assert.ok(attachmentIds(evidence).includes("phase-45-managed-database-topology"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 46 managed database runtime guard report"));
  assert.ok(attachmentIds(evidence).includes("phase-48-managed-database-runtime-boundary"));
});

test("Phase 47 strict managed DATABASE_URL handoff blocks readiness and redacts managed DB evidence", () => {
  const env = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_ARTIFACTS_PATH: "/srv/taskloom/artifacts",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T20:30:00.000Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };
  const deps = {
    strict: true,
    probes: {
      directoryExists: (path: string) =>
        ["/srv/taskloom/backups", "/srv/taskloom/artifacts"].includes(path),
    },
  };
  const readiness = buildReleaseReadinessReport(env, deps);
  const evidence = buildReleaseEvidenceBundle(env, {
    ...deps,
    generatedAt: "2026-04-28T20:48:00.000Z",
  });
  const evidenceContract = asContractObject(evidence);

  assert.equal(readiness.readyForRelease, false);
  assert.equal(checkStatus(readiness, "managed-database-topology"), "fail");
  assert.equal(checkStatus(readiness, "managed-database-runtime-guard"), "fail");
  assert.equal(readiness.managedDatabaseTopology.phase, "45");
  assert.equal(readiness.managedDatabaseTopology.classification, "managed-database-requested");
  assert.equal(readiness.managedDatabaseTopology.observed.databaseUrl, "[redacted]");
  assert.equal(readiness.managedDatabaseRuntimeGuard.phase, "46");
  assert.equal(readiness.managedDatabaseRuntimeGuard.allowed, false);
  assert.equal(readiness.managedDatabaseRuntimeGuard.classification, "managed-database-blocked");
  assert.equal(readiness.managedDatabaseRuntimeGuard.observed.databaseUrl, "[redacted]");
  assert.equal(readiness.managedDatabaseRuntimeBoundary.phase, "48");
  assert.equal(readiness.managedDatabaseRuntimeBoundary.allowed, false);
  assert.equal(readiness.managedDatabaseRuntimeBoundary.classification, "managed-database-blocked");
  assert.equal(readiness.asyncStoreBoundary.phase, "49");
  assert.equal(readiness.asyncStoreBoundary.foundationAvailable, true);
  assert.equal(readiness.asyncStoreBoundary.managedPostgresSupported, false);
  assert.equal(readiness.asyncStoreBoundary.classification, "managed-postgres-unsupported");
  assert.equal(checkStatus(readiness, "managed-database-runtime-boundary"), "fail");
  assert.equal(checkStatus(readiness, "async-store-boundary"), "fail");
  assert.ok(readiness.blockers.some((blocker) => blocker.includes("managed Postgres remains unsupported")));
  assert.ok(readiness.blockers.some((blocker) => /managed database/i.test(blocker)));

  assert.equal(evidence.readyForRelease, false);
  assert.equal(evidence.releaseReadiness.readyForRelease, false);
  assert.deepEqual(evidenceContract.managedDatabaseTopology, evidence.releaseReadiness.managedDatabaseTopology);
  assert.deepEqual(evidenceContract.managedDatabaseRuntimeGuard, evidence.releaseReadiness.managedDatabaseRuntimeGuard);
  assert.deepEqual(evidenceContract.managedDatabaseRuntimeBoundary, evidence.releaseReadiness.managedDatabaseRuntimeBoundary);
  assert.deepEqual(evidenceContract.asyncStoreBoundary, evidence.releaseReadiness.asyncStoreBoundary);
  assert.ok(attachmentIds(evidence).includes("phase-45-managed-database-topology"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 46 managed database runtime guard report"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 48 managed database runtime boundary report"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 49 async store boundary foundation report"));
  assert.equal(evidenceEntry(evidence, "DATABASE_URL").value, "[redacted]");
  assert.equal(evidenceEntry(evidence, "DATABASE_URL").redacted, true);
  assert.match(evidence.summary, /managed Postgres remains unsupported/);
});

test("Phase 47 production SQLite handoff stays ready with Phase 45/46 reports and no managed hints", () => {
  const env = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_ARTIFACTS_PATH: "/srv/taskloom/artifacts",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T20:35:00.000Z",
    TASKLOOM_TRUST_PROXY: "true",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
  };
  const deps = {
    strict: true,
    probes: {
      directoryExists: (path: string) =>
        ["/srv/taskloom/backups", "/srv/taskloom/artifacts"].includes(path),
    },
  };
  const readiness = buildReleaseReadinessReport(env, deps);
  const evidence = buildReleaseEvidenceBundle(env, {
    ...deps,
    generatedAt: "2026-04-28T20:49:00.000Z",
  });
  const evidenceContract = asContractObject(evidence);

  assert.equal(readiness.readyForRelease, true);
  assert.equal(readiness.blockers.length, 0);
  assert.equal(checkStatus(readiness, "storage-topology"), "pass");
  assert.equal(checkStatus(readiness, "backup-dir"), "pass");
  assert.equal(checkStatus(readiness, "restore-drill"), "pass");
  assert.equal(checkStatus(readiness, "artifact-path"), "pass");
  assert.equal(checkStatus(readiness, "managed-database-topology"), "pass");
  assert.equal(checkStatus(readiness, "managed-database-runtime-guard"), "pass");
  assert.equal(readiness.managedDatabaseTopology.phase, "45");
  assert.equal(readiness.managedDatabaseTopology.classification, "single-node-sqlite");
  assert.equal(readiness.managedDatabaseTopology.managedDatabase.requested, false);
  assert.equal(readiness.managedDatabaseTopology.managedDatabase.configured, false);
  assert.equal(readiness.managedDatabaseRuntimeGuard.phase, "46");
  assert.equal(readiness.managedDatabaseRuntimeGuard.allowed, true);
  assert.equal(readiness.managedDatabaseRuntimeGuard.classification, "single-node-sqlite");
  assert.equal(readiness.managedDatabaseRuntimeGuard.observed.databaseTopology, null);
  assert.equal(readiness.managedDatabaseRuntimeBoundary.phase, "48");
  assert.equal(readiness.managedDatabaseRuntimeBoundary.allowed, true);
  assert.equal(readiness.managedDatabaseRuntimeBoundary.classification, "single-node-sqlite");
  assert.equal(readiness.asyncStoreBoundary.phase, "49");
  assert.equal(readiness.asyncStoreBoundary.classification, "foundation-ready");
  assert.equal(readiness.asyncStoreBoundary.managedPostgresSupported, false);
  assert.ok(!readiness.warnings.some((warning) => /managed database|multi-writer/i.test(warning)));

  assert.equal(evidence.readyForRelease, true);
  assert.equal(evidence.evidence.config.backupConfigured, true);
  assert.equal(evidence.evidence.config.restoreDrillRecorded, true);
  assert.equal(evidence.evidence.config.artifactPathConfigured, true);
  assert.deepEqual(evidenceContract.managedDatabaseTopology, evidence.releaseReadiness.managedDatabaseTopology);
  assert.deepEqual(evidenceContract.managedDatabaseRuntimeGuard, evidence.releaseReadiness.managedDatabaseRuntimeGuard);
  assert.deepEqual(evidenceContract.managedDatabaseRuntimeBoundary, evidence.releaseReadiness.managedDatabaseRuntimeBoundary);
  assert.deepEqual(evidenceContract.asyncStoreBoundary, evidence.releaseReadiness.asyncStoreBoundary);
  assert.ok(attachmentIds(evidence).includes("phase-45-managed-database-topology"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 46 managed database runtime guard report"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 48 managed database runtime boundary report"));
  assert.ok(hasAttachmentLabel(evidence, "Phase 49 async store boundary foundation report"));
});
