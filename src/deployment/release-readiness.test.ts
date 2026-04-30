import assert from "node:assert/strict";
import test from "node:test";
import {
  assessReleaseReadiness,
  buildReleaseReadinessReport,
  type ReleaseReadinessEnv,
} from "./release-readiness.js";
import {
  buildManagedDatabaseRuntimeGuardReport,
  type ManagedDatabaseRuntimeGuardReport,
} from "./managed-database-runtime-guard.js";
import {
  buildManagedDatabaseTopologyReport,
  type ManagedDatabaseTopologyReport,
} from "./managed-database-topology.js";
import type { StorageTopologyReport } from "./storage-topology.js";

function checkStatus(report: ReturnType<typeof assessReleaseReadiness>, id: string): string | undefined {
  return report.checks.find((check) => check.id === id)?.status;
}

test("local JSON development produces warnings instead of release blockers", () => {
  const report = assessReleaseReadiness({ env: {} });

  assert.equal(report.phase, "43");
  assert.equal(report.readyForRelease, true);
  assert.equal(report.storageTopology.mode, "json");
  assert.equal(report.managedDatabaseTopology.classification, "local-json");
  assert.equal(report.managedDatabaseRuntimeGuard.classification, "local-json");
  assert.equal(report.managedDatabaseRuntimeBoundary.classification, "local-json");
  assert.equal(report.asyncStoreBoundary.phase, "49");
  assert.equal(report.asyncStoreBoundary.foundationAvailable, true);
  assert.equal(report.asyncStoreBoundary.managedPostgresSupported, false);
  assert.equal(report.asyncStoreBoundary.phase52ManagedStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseAdapterImplemented, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseBackfillAvailable, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseSyncStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseRuntimeCallSiteMigrationTracked, true);
  assert.equal(report.asyncStoreBoundary.managedDatabaseRuntimeCallSitesMigrated, true);
  assert.deepEqual(report.asyncStoreBoundary.managedDatabaseRemainingSyncCallSiteGroups, []);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.required, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.releaseAllowed, true);
  assert.equal(report.asyncStoreBoundary.classification, "foundation-ready");
  assert.equal(checkStatus(report, "storage-topology"), "warn");
  assert.equal(checkStatus(report, "managed-database-topology"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "pass");
  assert.equal(checkStatus(report, "async-store-boundary"), "pass");
  assert.equal(checkStatus(report, "backup-dir"), "warn");
  assert.equal(checkStatus(report, "restore-drill"), "warn");
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.some((warning) => warning.includes("TASKLOOM_BACKUP_DIR")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_STORE=sqlite")));
});

test("production SQLite with backup directory and restore drill passes release readiness", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_ARTIFACTS_PATH: "/srv/taskloom/artifacts",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_TRUST_PROXY: "true",
    TASKLOOM_ACCESS_LOG_MODE: "file",
    TASKLOOM_ACCESS_LOG_PATH: "/var/log/taskloom/access.log",
  };

  const report = buildReleaseReadinessReport(env, {
    probes: {
      directoryExists: (path) =>
        ["/srv/taskloom/backups", "/srv/taskloom/artifacts", "/var/log/taskloom"].includes(path),
    },
  });

  assert.equal(report.readyForRelease, true);
  assert.equal(report.blockers.length, 0);
  assert.equal(checkStatus(report, "storage-topology"), "pass");
  assert.equal(checkStatus(report, "managed-database-topology"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "pass");
  assert.equal(checkStatus(report, "async-store-boundary"), "pass");
  assert.equal(checkStatus(report, "database-path"), "pass");
  assert.equal(checkStatus(report, "backup-dir"), "pass");
  assert.equal(checkStatus(report, "restore-drill"), "pass");
  assert.equal(checkStatus(report, "artifact-path"), "pass");
  assert.equal(checkStatus(report, "access-log-path"), "pass");
  assert.match(report.summary, /passed strict/);
});

test("strict release with a managed database URL fails managed topology and runtime guard checks", () => {
  const report = assessReleaseReadiness({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(checkStatus(report, "managed-database-topology"), "fail");
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "fail");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "fail");
  assert.equal(report.managedDatabaseTopology.ready, false);
  assert.equal(report.managedDatabaseRuntimeGuard.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBoundary.allowed, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.classification, "managed-postgres-unsupported");
  assert.equal(report.asyncStoreBoundary.managedDatabaseAdapterImplemented, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseRepositoriesImplemented, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseBackfillAvailable, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseSyncStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.phase52ManagedStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseRuntimeCallSitesMigrated, true);
  assert.equal(report.managedDatabaseRuntimeBoundary.classification, "managed-database-blocked");
  assert.ok(report.blockers.some((blocker) => /managed database topology/i.test(blocker)));
  assert.ok(report.blockers.some((blocker) => blocker.includes("runtime guard blocks startup")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("managed Postgres remains unsupported")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres")));
  assert.ok(report.nextSteps.some((step) => step.includes("adapter, repositories")));
});

test("strict release with Phase 50 adapter config blocks managed startup when Phase 51 migration is incomplete", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      remainingSyncCallSiteGroups: ["startup bootstrap"],
    },
  });
  const report = assessReleaseReadiness({
    env,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(report.managedDatabaseTopology.managedDatabase.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.managedDatabaseRuntimeGuard.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.managedDatabaseRuntimeGuard.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBoundary.allowed, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.classification, "managed-postgres-adapter-available-sync-blocked");
  assert.equal(report.asyncStoreBoundary.managedDatabaseAdapterImplemented, true);
  assert.equal(report.asyncStoreBoundary.managedDatabaseBackfillAvailable, true);
  assert.equal(report.asyncStoreBoundary.managedDatabaseSyncStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseRuntimeCallSitesMigrated, false);
  assert.deepEqual(report.asyncStoreBoundary.managedDatabaseRemainingSyncCallSiteGroups, ["startup bootstrap"]);
  assert.equal(report.asyncStoreBoundary.managedPostgresSupported, false);
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "fail");
  assert.equal(checkStatus(report, "async-store-boundary"), "fail");
  assert.ok(report.blockers.some((blocker) => /call-site migration.*incomplete/.test(blocker)));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 50 async adapter/backfill evidence")));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 51 runtime call-site migration")));
  assert.ok(report.summary.includes("blocked"));
});

test("strict release with Phase 52 managed startup support allows managed Postgres hints", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      managedPostgresStartupSupported: true,
    },
  });
  const report = assessReleaseReadiness({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(report.readyForRelease, true);
  assert.equal(managedDatabaseTopology.ready, true);
  assert.equal(managedDatabaseRuntimeGuard.allowed, true);
  assert.equal(report.managedDatabaseRuntimeBoundary.allowed, true);
  assert.equal(report.managedDatabaseRuntimeBoundary.classification, "managed-database-supported");
  assert.equal(report.asyncStoreBoundary.releaseAllowed, true);
  assert.equal(report.asyncStoreBoundary.classification, "managed-postgres-startup-supported");
  assert.equal(report.asyncStoreBoundary.managedPostgresSupported, true);
  assert.equal(report.asyncStoreBoundary.phase52ManagedStartupSupported, true);
  assert.equal(report.asyncStoreBoundary.managedDatabaseSyncStartupSupported, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.required, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.releaseAllowed, true);
  assert.equal(checkStatus(report, "managed-database-topology"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "warn");
  assert.equal(checkStatus(report, "async-store-boundary"), "warn");
  assert.equal(report.blockers.length, 0);
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 52 managed Postgres startup support")));
});

test("Phase 52 managed startup support does not allow multi-writer topology", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      managedPostgresStartupSupported: true,
    },
  });
  const report = assessReleaseReadiness({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(report.managedDatabaseRuntimeBoundary.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBoundary.classification, "multi-writer-blocked");
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.classification, "multi-writer-unsupported");
  assert.equal(report.asyncStoreBoundary.phase52ManagedStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.managedDatabaseSyncStartupSupported, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.required, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.requirementsEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.designEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.requirementsEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.designEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.releaseAllowed, false);
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "fail");
  assert.equal(checkStatus(report, "async-store-boundary"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("multi-writer")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 53 requirements/design gate")));
  assert.ok(report.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 53 multi-writer topology requirements evidence")));
  assert.ok(report.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 53 multi-writer topology design evidence")));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 53 requirements/design evidence")));
});

test("strict release with TASKLOOM_STORE=postgres fails the managed database runtime boundary", () => {
  const report = assessReleaseReadiness({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(report.managedDatabaseTopology.classification, "managed-database-requested");
  assert.equal(report.managedDatabaseRuntimeGuard.classification, "managed-database-blocked");
  assert.equal(report.managedDatabaseRuntimeBoundary.classification, "managed-database-blocked");
  assert.equal(report.asyncStoreBoundary.classification, "managed-postgres-unsupported");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "fail");
  assert.equal(checkStatus(report, "async-store-boundary"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("managed Postgres remains unsupported")));
  assert.ok(report.nextSteps.some((step) => step.includes("adapter, repositories")));
});

test("runtime guard bypass warns without blocking release when the managed topology is already accepted", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_TRUST_PROXY: "true",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS: "true",
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport({
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
  });

  const report = assessReleaseReadiness({
    env,
    managedDatabaseTopology,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });

  assert.equal(report.managedDatabaseRuntimeGuard.allowed, true);
  assert.equal(report.managedDatabaseRuntimeGuard.classification, "bypassed");
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "warn");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "warn");
  assert.equal(checkStatus(report, "async-store-boundary"), "warn");
  assert.equal(report.readyForRelease, true);
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.some((warning) => warning.includes("bypassed")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS")));
});

test("production SQLite missing backup directory fails release readiness", () => {
  const report = assessReleaseReadiness({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(checkStatus(report, "storage-topology"), "pass");
  assert.equal(checkStatus(report, "backup-dir"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("TASKLOOM_BACKUP_DIR")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_BACKUP_DIR")));
});

test("production SQLite with distributed storage topology fails release readiness", () => {
  const report = assessReleaseReadiness({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_SCHEDULER_LEADER_MODE: "http",
      TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.internal/check",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(checkStatus(report, "storage-topology"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("not production-ready")));
  assert.equal(report.storageTopology.classification, "production-blocked");
  assert.ok(report.nextSteps.some((step) => step.includes("deployment-managed database")));
});

test("injected storage report is embedded and used without calling the report builder", () => {
  const storageTopology: StorageTopologyReport = {
    mode: "sqlite",
    classification: "single-node",
    readyForProduction: true,
    summary: "Injected single-node topology.",
    requirements: [],
    warnings: ["Injected topology warning."],
    nextSteps: ["Injected topology next step."],
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
  const managedDatabaseTopology: ManagedDatabaseTopologyReport = buildManagedDatabaseTopologyReport({
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/data/taskloom.sqlite",
  });
  const managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport = buildManagedDatabaseRuntimeGuardReport({
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/data/taskloom.sqlite",
  });

  const report = assessReleaseReadiness({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "json",
      TASKLOOM_DB_PATH: "/data/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/data/backups",
      TASKLOOM_RESTORE_DRILL_MARKER: "restore-drill-ticket-123",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    buildStorageTopologyReport: () => {
      throw new Error("builder should not be called when storageTopology is injected");
    },
    buildManagedDatabaseTopologyReport: () => {
      throw new Error("builder should not be called when managedDatabaseTopology is injected");
    },
    buildManagedDatabaseRuntimeGuardReport: () => {
      throw new Error("builder should not be called when managedDatabaseRuntimeGuard is injected");
    },
  });

  assert.equal(report.readyForRelease, true);
  assert.equal(report.storageTopology, storageTopology);
  assert.equal(report.managedDatabaseTopology, managedDatabaseTopology);
  assert.equal(report.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
  assert.equal(report.managedDatabaseRuntimeBoundary.classification, "single-node-sqlite");
  assert.equal(report.asyncStoreBoundary.classification, "foundation-ready");
  assert.equal(checkStatus(report, "storage-topology"), "pass");
  assert.equal(checkStatus(report, "managed-database-topology"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-guard"), "pass");
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "pass");
  assert.equal(checkStatus(report, "async-store-boundary"), "pass");
  assert.ok(report.warnings.includes("Injected topology warning."));
});
