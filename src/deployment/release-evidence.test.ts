import assert from "node:assert/strict";
import test from "node:test";
import { assessReleaseEvidence, buildReleaseEvidenceBundle, type ReleaseEvidenceEntry } from "./release-evidence.js";
import type { ManagedDatabaseRuntimeGuardReport } from "./managed-database-runtime-guard.js";
import type { ManagedDatabaseTopologyReport } from "./managed-database-topology.js";
import {
  buildAsyncStoreBoundaryReport,
  buildManagedDatabaseRuntimeBoundaryReport,
  type ReleaseReadinessReport,
} from "./release-readiness.js";
import type { StorageTopologyReport } from "./storage-topology.js";

function evidenceEntry(entries: ReleaseEvidenceEntry[], name: string): ReleaseEvidenceEntry {
  const entry = entries.find((candidate) => candidate.name === name);
  assert.ok(entry, `expected evidence entry for ${name}`);
  return entry;
}

function injectedStorageTopology(): StorageTopologyReport {
  return {
    mode: "sqlite",
    classification: "single-node",
    readyForProduction: true,
    summary: "Injected storage topology.",
    requirements: [],
    warnings: [],
    nextSteps: ["Injected storage next step."],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/data/taskloom.sqlite",
      trustProxy: true,
      distributedRateLimitUrl: null,
      schedulerLeaderMode: "off",
      accessLogMode: "stdout",
      accessLogPath: null,
      probes: {},
    },
  };
}

function injectedReleaseReadiness(storageTopology: StorageTopologyReport): ReleaseReadinessReport {
  const managedDatabaseTopology = injectedManagedDatabaseTopology();
  const managedDatabaseRuntimeGuard = injectedManagedDatabaseRuntimeGuard();
  const managedDatabaseRuntimeBoundary = buildManagedDatabaseRuntimeBoundaryReport(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  return {
    phase: "43",
    readyForRelease: true,
    summary: "Injected release readiness.",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: ["Injected release next step."],
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    asyncStoreBoundary: buildAsyncStoreBoundaryReport(
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
    ),
  };
}

function injectedManagedDatabaseTopology(): ManagedDatabaseTopologyReport {
  return {
    phase: "45",
    status: "pass",
    classification: "single-node-sqlite",
    ready: true,
    summary: "Injected managed database topology.",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: ["Injected managed topology next step."],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/data/taskloom.sqlite",
      databaseTopology: null,
      managedDatabaseUrl: null,
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
    managedDatabase: {
      requested: false,
      configured: false,
      supported: false,
    },
  };
}

function injectedManagedDatabaseRuntimeGuard(): ManagedDatabaseRuntimeGuardReport {
  return {
    phase: "46",
    allowed: true,
    status: "pass",
    classification: "single-node-sqlite",
    summary: "Injected managed database runtime guard.",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: ["Injected runtime guard next step."],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/data/taskloom.sqlite",
      databaseTopology: null,
      bypassEnabled: false,
      managedDatabaseUrl: null,
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
  };
}

test("local JSON development evidence embeds Phase 42 and Phase 43 reports", () => {
  const bundle = assessReleaseEvidence({
    env: {},
    generatedAt: "2026-04-28T18:00:00.000Z",
  });

  assert.equal(bundle.phase, "44");
  assert.equal(bundle.generatedAt, "2026-04-28T18:00:00.000Z");
  assert.equal(bundle.readyForRelease, true);
  assert.equal(bundle.storageTopology.mode, "json");
  assert.equal(bundle.releaseReadiness.phase, "43");
  assert.equal(bundle.releaseReadiness.storageTopology, bundle.storageTopology);
  assert.equal(bundle.managedDatabaseTopology.phase, "45");
  assert.equal(bundle.managedDatabaseRuntimeGuard.phase, "46");
  assert.equal(bundle.managedDatabaseRuntimeBoundary.phase, "48");
  assert.equal(bundle.asyncStoreBoundary.phase, "49");
  assert.equal(bundle.asyncStoreBoundary.foundationAvailable, true);
  assert.equal(bundle.asyncStoreBoundary.managedPostgresSupported, false);
  assert.equal(bundle.asyncStoreBoundary.classification, "foundation-ready");
  assert.equal(bundle.evidence.config.storageMode, "json");
  assert.equal(bundle.evidence.config.backupConfigured, false);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryFoundationAvailable, true);
  assert.equal(bundle.evidence.config.managedPostgresSupported, false);
  assert.equal(bundle.evidence.config.managedDatabaseAdapterImplemented, false);
  assert.equal(bundle.evidence.config.managedDatabaseRepositoriesImplemented, false);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_STORE").configured, false);
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-42-storage-topology"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-43-release-readiness"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-45-managed-database-topology"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-46-runtime-guard"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-48-managed-database-runtime-boundary"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-49-async-store-boundary"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-44-release-evidence"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_STORE=sqlite")));
});

test("production SQLite evidence passes release handoff when readiness inputs pass", () => {
  const bundle = assessReleaseEvidence({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_ARTIFACTS_PATH: "/srv/taskloom/artifacts",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "file",
      TASKLOOM_ACCESS_LOG_PATH: "/var/log/taskloom/access.log",
    },
    probes: {
      directoryExists: (path) =>
        ["/srv/taskloom/backups", "/srv/taskloom/artifacts", "/var/log/taskloom"].includes(path),
    },
    generatedAt: "2026-04-28T18:30:00.000Z",
  });

  assert.equal(bundle.readyForRelease, true);
  assert.equal(bundle.storageTopology.readyForProduction, true);
  assert.equal(bundle.releaseReadiness.readyForRelease, true);
  assert.equal(bundle.evidence.config.nodeEnv, "production");
  assert.equal(bundle.evidence.config.storageMode, "sqlite");
  assert.equal(bundle.evidence.config.backupConfigured, true);
  assert.equal(bundle.evidence.config.restoreDrillRecorded, true);
  assert.equal(bundle.evidence.config.artifactPathConfigured, true);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_BACKUP_DIR").value, "/srv/taskloom/backups");
  assert.match(bundle.summary, /ready for handoff/);
});

test("secret names and URLs with embedded credentials are redacted in evidence", () => {
  const bundle = assessReleaseEvidence({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_API_TOKEN: "super-secret-token",
      DATABASE_URL: "postgres://taskloom:visible@db.example.com/taskloom",
      TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://taskloom:secret@limits.internal/check",
    },
    generatedAt: "2026-04-28T19:00:00.000Z",
  });

  const token = evidenceEntry(bundle.evidence.environment, "TASKLOOM_API_TOKEN");
  const databaseUrl = evidenceEntry(bundle.evidence.environment, "DATABASE_URL");
  const limiterUrl = evidenceEntry(bundle.evidence.environment, "TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL");
  const backupDir = evidenceEntry(bundle.evidence.environment, "TASKLOOM_BACKUP_DIR");

  assert.equal(token.configured, true);
  assert.equal(token.redacted, true);
  assert.equal(token.value, "[redacted]");
  assert.equal(databaseUrl.configured, true);
  assert.equal(databaseUrl.redacted, true);
  assert.equal(databaseUrl.value, "[redacted]");
  assert.equal(bundle.managedDatabaseTopology.observed.databaseUrl, "[redacted]");
  assert.equal(bundle.managedDatabaseRuntimeGuard.observed.databaseUrl, "[redacted]");
  assert.equal(limiterUrl.redacted, true);
  assert.equal(limiterUrl.value, "[redacted]");
  assert.equal(backupDir.redacted, false);
  assert.equal(backupDir.value, "/srv/taskloom/backups");
});

test("injected reports are embedded without calling report builders", () => {
  const storageTopology = injectedStorageTopology();
  const releaseReadiness = injectedReleaseReadiness(storageTopology);
  const managedDatabaseTopology = injectedManagedDatabaseTopology();
  const managedDatabaseRuntimeGuard = injectedManagedDatabaseRuntimeGuard();
  const managedDatabaseRuntimeBoundary = buildManagedDatabaseRuntimeBoundaryReport(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const bundle = assessReleaseEvidence({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "json",
    },
    storageTopology,
    releaseReadiness,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    buildStorageTopologyReport: () => {
      throw new Error("storage builder should not be called");
    },
    buildReleaseReadinessReport: () => {
      throw new Error("release builder should not be called");
    },
    buildManagedDatabaseTopologyReport: () => {
      throw new Error("managed topology builder should not be called");
    },
    buildManagedDatabaseRuntimeGuardReport: () => {
      throw new Error("runtime guard builder should not be called");
    },
  });

  assert.equal(bundle.storageTopology, storageTopology);
  assert.equal(bundle.releaseReadiness.storageTopology, releaseReadiness.storageTopology);
  assert.equal(bundle.managedDatabaseTopology, managedDatabaseTopology);
  assert.equal(bundle.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
  assert.equal(bundle.managedDatabaseRuntimeBoundary, managedDatabaseRuntimeBoundary);
  assert.equal(bundle.asyncStoreBoundary.phase, "49");
  assert.equal(bundle.releaseReadiness.managedDatabaseTopology, managedDatabaseTopology);
  assert.equal(bundle.releaseReadiness.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
  assert.equal(bundle.releaseReadiness.managedDatabaseRuntimeBoundary, managedDatabaseRuntimeBoundary);
  assert.equal(bundle.releaseReadiness.asyncStoreBoundary, bundle.asyncStoreBoundary);
  assert.equal(bundle.readyForRelease, true);
  assert.ok(bundle.nextSteps.includes("Injected release next step."));
  assert.ok(bundle.nextSteps.includes("Injected managed topology next step."));
  assert.ok(bundle.nextSteps.includes("Injected runtime guard next step."));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 49 as async-store-boundary foundation only")));
});

test("strict evidence reflects managed database blockers in summary config and next steps", () => {
  const bundle = assessReleaseEvidence({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.managedDatabaseTopology.ready, false);
  assert.equal(bundle.managedDatabaseRuntimeGuard.allowed, false);
  assert.equal(bundle.evidence.config.managedDatabaseTopologyStatus, "fail");
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeGuardStatus, "fail");
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeAllowed, false);
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeBoundaryStatus, "fail");
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeBoundaryAllowed, false);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryStatus, "fail");
  assert.equal(bundle.evidence.config.asyncStoreBoundaryClassification, "managed-postgres-unsupported");
  assert.equal(bundle.evidence.config.asyncStoreBoundaryReleaseAllowed, false);
  assert.equal(bundle.evidence.config.managedPostgresSupported, false);
  assert.equal(bundle.managedDatabaseRuntimeBoundary.classification, "managed-database-blocked");
  assert.equal(bundle.asyncStoreBoundary.classification, "managed-postgres-unsupported");
  assert.match(bundle.summary, /Managed DB blockers/);
  assert.match(bundle.summary, /Phase 49 async-store boundary exists as foundation/);
  assert.match(bundle.summary, /managed Postgres remains unsupported/);
  assert.ok(bundle.summary.includes("no executable managed database adapter yet"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("managed database URL environment variables")));
  assert.ok(bundle.nextSteps.some((step) => step.includes("real adapter and repositories")));
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MANAGED_DATABASE_URL").value, "[redacted]");
});

test("release readiness managed reports are reused when present", () => {
  const storageTopology = injectedStorageTopology();
  const managedDatabaseTopology = injectedManagedDatabaseTopology();
  const managedDatabaseRuntimeGuard = injectedManagedDatabaseRuntimeGuard();
  const managedDatabaseRuntimeBoundary = buildManagedDatabaseRuntimeBoundaryReport(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const releaseReadiness = Object.assign(injectedReleaseReadiness(storageTopology), {
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
  });
  const bundle = assessReleaseEvidence({
    storageTopology,
    releaseReadiness,
    buildManagedDatabaseTopologyReport: () => {
      throw new Error("managed topology builder should not be called");
    },
    buildManagedDatabaseRuntimeGuardReport: () => {
      throw new Error("runtime guard builder should not be called");
    },
  });

  assert.equal(bundle.managedDatabaseTopology, managedDatabaseTopology);
  assert.equal(bundle.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
  assert.equal(bundle.managedDatabaseRuntimeBoundary, managedDatabaseRuntimeBoundary);
  assert.equal(bundle.asyncStoreBoundary, bundle.releaseReadiness.asyncStoreBoundary);
  assert.equal(bundle.asyncStoreBoundary.phase, "49");
});

test("generatedAt accepts Date injection", () => {
  const bundle = assessReleaseEvidence({
    env: {},
    generatedAt: new Date("2026-04-28T20:15:00.000Z"),
  });

  assert.equal(bundle.generatedAt, "2026-04-28T20:15:00.000Z");
});

test("buildReleaseEvidenceBundle accepts env and dependency arguments", () => {
  const bundle = buildReleaseEvidenceBundle(
    { TASKLOOM_STORE: "json" },
    { generatedAt: "2026-04-28T21:00:00.000Z", strict: true },
  );

  assert.equal(bundle.generatedAt, "2026-04-28T21:00:00.000Z");
  assert.equal(bundle.evidence.config.storageMode, "json");
  assert.equal(bundle.evidence.config.strictRelease, true);
});
