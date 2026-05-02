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

function phase58CompleteMultiWriterEnv(): ReleaseReadinessEnv {
  return {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "workspace leader plus conflict runbook",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "failover-pitr-runbook",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "migration-backfill-runbook",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "topology-observability-dashboard",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "rollback-runbook",
    TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "review://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "authorization://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "readiness://phase56",
    TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "rollout-safety://phase56",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "scope-lock://phase57",
    TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "validation://phase57",
    TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "cutover-lock://phase57",
    TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "signoff://phase57",
    TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "runtime-implementation://phase58",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "consistency-validation://phase58",
    TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "failover-validation://phase58",
    TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "data-integrity-validation://phase58",
    TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "operations-runbook://phase58",
    TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "runtime-signoff://phase58",
  };
}

function phase59CompleteMultiWriterEnv(): ReleaseReadinessEnv {
  return {
    ...phase58CompleteMultiWriterEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "decision://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "release-owner",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-04T16:00:00Z/2026-05-04T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "monitoring-signoff://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "abort-plan://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "release-ticket://phase59",
  };
}

function phase60CompleteMultiWriterEnv(): ReleaseReadinessEnv {
  return {
    ...phase59CompleteMultiWriterEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "implementation-present://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT: "support-statement://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "compatibility-matrix://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "cutover-evidence://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL: "release-automation://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "owner-acceptance://phase60",
  };
}

function phase61CompleteHorizontalWriterEnv(): ReleaseReadinessEnv {
  return {
    NODE_ENV: "production",
    TASKLOOM_STORE: "postgres",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "activation-decision://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "activation-owner://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-05T16:00:00Z/2026-05-05T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "feature-flag://horizontal-app-writers",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION: "release-automation-assertion://phase61",
  };
}

function phase63CompleteHorizontalWriterEnv(): ReleaseReadinessEnv {
  return {
    ...phase61CompleteHorizontalWriterEnv(),
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "concurrency-test://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.example.com/taskloom/check",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_EVIDENCE: "rate-limit://phase63/fail-closed",
    TASKLOOM_SCHEDULER_LEADER_MODE: "http",
    TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://coord.example.com/taskloom/scheduler-leader",
    TASKLOOM_SCHEDULER_COORDINATION_EVIDENCE: "scheduler://phase63/http-coordinator",
    TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE: "managed-postgres-transactional-queue",
    TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE: "jobs://phase63/durable",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE: "logs://phase63/stdout-shipper",
    TASKLOOM_ALERT_EVALUATE_CRON: "*/5 * * * *",
    TASKLOOM_ALERT_WEBHOOK_URL: "https://alerts.example.com/taskloom",
    TASKLOOM_ALERT_DELIVERY_EVIDENCE: "alerts://phase63/webhook",
    TASKLOOM_HEALTH_MONITORING_EVIDENCE: "monitoring://phase63/health",
  } as ReleaseReadinessEnv;
}

function phase64CompleteHorizontalWriterEnv(): ReleaseReadinessEnv {
  return {
    ...phase63CompleteHorizontalWriterEnv(),
    TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE: "restore://phase64/backup",
    TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE: "pitr://phase64/rehearsal",
    TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE: "failover://phase64/rehearsal",
    TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE: "integrity://phase64/post-recovery",
    TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION: "rto=15m;rpo=5m",
  };
}

function phase65CompleteHorizontalWriterEnv(): ReleaseReadinessEnv {
  return {
    ...phase64CompleteHorizontalWriterEnv(),
    TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE: "preflight://phase65/pass",
    TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE: "dry-run://phase65/activate",
    TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_EVIDENCE: "smoke://phase65/pass",
    TASKLOOM_ROLLBACK_COMMAND_GUIDANCE: "rollback://phase65/command",
    TASKLOOM_MONITORING_THRESHOLD_EVIDENCE: "thresholds://phase65/alerts",
    TASKLOOM_OPERATIONS_HEALTH_CUTOVER_STATUS_EVIDENCE: "ops-health://phase65/cutover-status",
    TASKLOOM_ROLLBACK_SAFE_POSTURE_EVIDENCE: "safe-posture://phase65/prior",
  };
}

interface Phase63ReadinessGateContract {
  phase: "63";
  required: boolean;
  phase62HorizontalWriterHardeningReady: boolean;
  distributedRateLimitReady: boolean;
  schedulerCoordinationReady: boolean;
  durableJobExecutionReady: boolean;
  accessLogShippingReady: boolean;
  alertDeliveryReady: boolean;
  healthMonitoringReady: boolean;
  distributedDependencyEnforcementReady: boolean;
  activationDependencyGatePassed: boolean;
  strictActivationBlocked: boolean;
  releaseAllowed: boolean;
  blockers: string[];
}

interface Phase64ReadinessGateContract {
  phase: "64";
  required: boolean;
  phase63ActivationDependencyGatePassed: boolean;
  backupRestoreEvidenceAttached: boolean;
  pitrRehearsalEvidenceAttached: boolean;
  failoverRehearsalEvidenceAttached: boolean;
  dataIntegrityValidationEvidenceAttached: boolean;
  recoveryTimeExpectationAttached: boolean;
  managedPostgresRecoveryValidationReady: boolean;
  providerOwnedHaPitrValidated: boolean;
  activeActiveSupported: false;
  regionalFailoverSupported: false;
  pitrRuntimeSupported: false;
  distributedSqliteSupported: false;
  applicationManagedRegionalFailoverSupported: false;
  applicationManagedPitrSupported: false;
  pendingPhases: string[];
  releaseAllowed: boolean;
  blockers: string[];
  summary: string;
}

interface Phase65ReadinessGateContract {
  phase: "65";
  required: boolean;
  phase64ManagedPostgresRecoveryValidationReady: boolean;
  cutoverPreflightEvidenceAttached: boolean;
  cutoverPreflightFailed: boolean;
  activationDryRunEvidenceAttached: boolean;
  postActivationSmokeCheckEvidenceAttached: boolean;
  postActivationSmokeCheckFailed: boolean;
  rollbackCommandGuidanceAttached: boolean;
  monitoringThresholdEvidenceAttached: boolean;
  operationsHealthCutoverStatusAttached: boolean;
  rollbackSafePostureEvidenceAttached: boolean;
  activationBlocked: boolean;
  rollbackToPriorSafePostureRequired: boolean;
  rollbackToPriorSafePostureProven: boolean;
  cutoverRollbackAutomationReady: boolean;
  finalReleaseApprovalBlocked: true;
  pendingPhases: string[];
  releaseAllowed: boolean;
  blockers: string[];
  summary: string;
}

function phase63Gate(report: ReturnType<typeof assessReleaseReadiness>): Phase63ReadinessGateContract {
  const gate = (report.asyncStoreBoundary as unknown as {
    phase63DistributedDependencyEnforcementGate?: unknown;
  }).phase63DistributedDependencyEnforcementGate;
  assert.ok(gate && typeof gate === "object", "expected Phase 63 distributed dependency enforcement gate");
  return gate as Phase63ReadinessGateContract;
}

function phase64Gate(report: ReturnType<typeof assessReleaseReadiness>): Phase64ReadinessGateContract {
  const gate = (report.asyncStoreBoundary as unknown as {
    phase64ManagedPostgresRecoveryValidationGate?: unknown;
  }).phase64ManagedPostgresRecoveryValidationGate;
  assert.ok(gate && typeof gate === "object", "expected Phase 64 managed Postgres recovery validation gate");
  return gate as Phase64ReadinessGateContract;
}

function phase65Gate(report: ReturnType<typeof assessReleaseReadiness>): Phase65ReadinessGateContract {
  const gate = (report.asyncStoreBoundary as unknown as {
    phase65CutoverRollbackAutomationGate?: unknown;
  }).phase65CutoverRollbackAutomationGate;
  assert.ok(gate && typeof gate === "object", "expected Phase 65 cutover/rollback automation gate");
  return gate as Phase65ReadinessGateContract;
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
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.required, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.releaseAllowed, true);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.required, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.releaseAllowed, true);
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
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.required, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.releaseAllowed, true);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.required, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.releaseAllowed, true);
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
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.designPackageEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.requirementsEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.designEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.designPackageEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.topologyOwnerEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.topologyOwnerEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.consistencyModelEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.consistencyModelEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.failoverPitrPlanEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.failoverPitrPlanEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.migrationBackfillPlanEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.migrationBackfillPlanEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.observabilityPlanEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.observabilityPlanEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.rollbackPlanEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.rollbackPlanEvidenceAttached, false);
  assert.deepEqual(
    report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.designPackageEvidence.map((item) => ({
      id: item.id,
      required: item.required,
      attached: item.attached,
    })),
    [
      { id: "topology-owner", required: true, attached: false },
      { id: "consistency-model", required: true, attached: false },
      { id: "failover-pitr-plan", required: true, attached: false },
      { id: "migration-backfill-plan", required: true, attached: false },
      { id: "observability-plan", required: true, attached: false },
      { id: "rollback-plan", required: true, attached: false },
    ],
  );
  assert.equal(report.asyncStoreBoundary.phase53MultiWriterTopologyGate?.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.required, true);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.designPackageReviewEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.designPackageReviewEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.implementationAuthorizationEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.implementationAuthorizationEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.implementationAuthorized, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.runtimeSupportBlocked, true);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.required, true);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.implementationReadinessEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.implementationReadinessEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.rolloutSafetyEvidenceRequired, true);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.rolloutSafetyEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.runtimeReadinessComplete, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.runtimeSupportBlocked, true);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.releaseAllowed, false);
  assert.equal(checkStatus(report, "managed-database-runtime-boundary"), "fail");
  assert.equal(checkStatus(report, "async-store-boundary"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("multi-writer")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 54 design-package gate")));
  assert.ok(report.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 54 multi-writer topology owner evidence")));
  assert.ok(report.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 54 multi-writer rollback plan evidence")));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 54 design-package evidence")));
});

test("Phase 54 design-package evidence attaches but still does not allow multi-writer runtime release", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "single logical writer per workspace with conflict policy RFC-53",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "runbook failover-pitr-53",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "runbook migration-backfill-53",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "dashboard topology-53",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "runbook rollback-53",
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
  const gate = report.asyncStoreBoundary.phase53MultiWriterTopologyGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.classification, "multi-writer-unsupported");
  assert.equal(gate?.required, true);
  assert.equal(gate?.designPackageEvidenceRequired, true);
  assert.equal(gate?.requirementsEvidenceAttached, true);
  assert.equal(gate?.designEvidenceAttached, true);
  assert.equal(gate?.designPackageEvidenceAttached, true);
  assert.equal(gate?.topologyOwnerEvidenceAttached, true);
  assert.equal(gate?.consistencyModelEvidenceAttached, true);
  assert.equal(gate?.failoverPitrPlanEvidenceAttached, true);
  assert.equal(gate?.migrationBackfillPlanEvidenceAttached, true);
  assert.equal(gate?.observabilityPlanEvidenceAttached, true);
  assert.equal(gate?.rollbackPlanEvidenceAttached, true);
  assert.equal(gate?.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.required, true);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.designPackageReviewEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.implementationAuthorizationEvidenceAttached, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.implementationAuthorized, false);
  assert.equal(report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.releaseAllowed, false);
  assert.ok(gate?.blockers.some((blocker) => blocker.includes("runtime support remains blocked")));
  assert.ok(report.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 55 multi-writer design-package review evidence")));
  assert.ok(report.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 55 multi-writer implementation authorization evidence")));
  assert.ok(report.summary.includes("blocked"));
  assert.ok(report.nextSteps.some((step) => step.includes("blocked even with the Phase 54 design package attached")));
});

test("Phase 55 review and implementation authorization evidence attaches but still blocks multi-writer runtime release", () => {
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
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "workspace leader plus conflict runbook",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "failover-pitr-runbook",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "migration-backfill-runbook",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "topology-observability-dashboard",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "rollback-runbook",
    TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "review://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "authorization://phase55",
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
  const phase55Gate = report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.classification, "multi-writer-unsupported");
  assert.equal(phase55Gate?.required, true);
  assert.equal(phase55Gate?.designPackageReviewEvidenceAttached, true);
  assert.equal(phase55Gate?.implementationAuthorizationEvidenceAttached, true);
  assert.equal(phase55Gate?.implementationAuthorized, true);
  assert.equal(phase55Gate?.runtimeSupportBlocked, true);
  assert.equal(phase55Gate?.releaseAllowed, false);
  assert.ok(phase55Gate?.blockers.some((blocker) => blocker.includes("runtime support remains blocked")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 55 review/authorization evidence is attached"));
  assert.ok(report.nextSteps.some((step) => step.includes("blocked even with Phase 55 review and implementation authorization attached")));
});

test("Phase 56 runtime readiness and rollout-safety evidence attaches but still blocks multi-writer runtime release", () => {
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
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "workspace leader plus conflict runbook",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "failover-pitr-runbook",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "migration-backfill-runbook",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "topology-observability-dashboard",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "rollback-runbook",
    TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "review://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "authorization://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "readiness://phase56",
    TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "rollout-safety://phase56",
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
  const phase56Gate = report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.classification, "multi-writer-unsupported");
  assert.equal(phase56Gate?.required, true);
  assert.equal(phase56Gate?.implementationReadinessEvidenceAttached, true);
  assert.equal(phase56Gate?.rolloutSafetyEvidenceAttached, true);
  assert.equal(phase56Gate?.runtimeImplementationReady, true);
  assert.equal(phase56Gate?.rolloutSafetyReady, true);
  assert.equal(phase56Gate?.runtimeReadinessComplete, true);
  assert.equal(phase56Gate?.runtimeSupportBlocked, true);
  assert.equal(phase56Gate?.releaseAllowed, false);
  assert.ok(phase56Gate?.blockers.some((blocker) => blocker.includes("runtime support remains blocked")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 56 runtime readiness/rollout-safety evidence is attached"));
  assert.ok(report.nextSteps.some((step) => step.includes("blocked even with Phase 56 runtime readiness and rollout-safety evidence attached")));
});

test("Phase 57 implementation scope evidence attaches but still blocks multi-writer runtime release", () => {
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
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "workspace leader plus conflict runbook",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "failover-pitr-runbook",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "migration-backfill-runbook",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "topology-observability-dashboard",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "rollback-runbook",
    TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "review://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "authorization://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "readiness://phase56",
    TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "rollout-safety://phase56",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "scope-lock://phase57",
    TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "validation://phase57",
    TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "cutover-lock://phase57",
    TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "signoff://phase57",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase57Gate = report.asyncStoreBoundary.phase57MultiWriterImplementationScopeGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.runtimeReadinessComplete, true);
  assert.equal(phase57Gate?.required, true);
  assert.equal(phase57Gate?.runtimeReadinessComplete, true);
  assert.equal(phase57Gate?.implementationScopeLockAttached, true);
  assert.equal(phase57Gate?.runtimeFeatureFlagAttached, true);
  assert.equal(phase57Gate?.validationEvidenceAttached, true);
  assert.equal(phase57Gate?.migrationCutoverLockAttached, true);
  assert.equal(phase57Gate?.releaseOwnerSignoffAttached, true);
  assert.equal(phase57Gate?.implementationScopeComplete, true);
  assert.equal(phase57Gate?.runtimeSupportBlocked, true);
  assert.equal(phase57Gate?.releaseAllowed, false);
  assert.ok(phase57Gate?.blockers.some((blocker) => blocker.includes("runtime support remains blocked")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 57 implementation-scope evidence is attached"));
  assert.ok(report.nextSteps.some((step) => step.includes("blocked even with Phase 57 implementation-scope evidence attached")));
});

test("Phase 58 runtime implementation validation evidence is required after Phase 57 scope completion", () => {
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
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "workspace leader plus conflict runbook",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "failover-pitr-runbook",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "migration-backfill-runbook",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "topology-observability-dashboard",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "rollback-runbook",
    TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "review://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "authorization://phase55",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "readiness://phase56",
    TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "rollout-safety://phase56",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "scope-lock://phase57",
    TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "validation://phase57",
    TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "cutover-lock://phase57",
    TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "signoff://phase57",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase58Gate = report.asyncStoreBoundary.phase58MultiWriterRuntimeImplementationValidationGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase57MultiWriterImplementationScopeGate?.implementationScopeComplete, true);
  assert.equal(phase58Gate?.required, true);
  assert.equal(phase58Gate?.implementationScopeComplete, true);
  assert.equal(phase58Gate?.runtimeImplementationEvidenceRequired, true);
  assert.equal(phase58Gate?.runtimeImplementationEvidenceAttached, false);
  assert.equal(phase58Gate?.consistencyValidationEvidenceAttached, false);
  assert.equal(phase58Gate?.failoverValidationEvidenceAttached, false);
  assert.equal(phase58Gate?.dataIntegrityValidationEvidenceAttached, false);
  assert.equal(phase58Gate?.operationsRunbookAttached, false);
  assert.equal(phase58Gate?.runtimeReleaseSignoffAttached, false);
  assert.equal(phase58Gate?.runtimeImplementationValidationComplete, false);
  assert.equal(phase58Gate?.runtimeSupportBlocked, true);
  assert.equal(phase58Gate?.releaseAllowed, false);
  assert.ok(phase58Gate?.blockers.some((blocker) => blocker.includes("runtime implementation evidence")));
  assert.ok(phase58Gate?.blockers.some((blocker) => blocker.includes("runtime release signoff")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE")));
});

test("Phase 58 runtime implementation validation evidence attaches but still blocks multi-writer runtime release", () => {
  const env = phase58CompleteMultiWriterEnv();
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase58Gate = report.asyncStoreBoundary.phase58MultiWriterRuntimeImplementationValidationGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(phase58Gate?.required, true);
  assert.equal(phase58Gate?.implementationScopeComplete, true);
  assert.equal(phase58Gate?.runtimeImplementationEvidenceAttached, true);
  assert.equal(phase58Gate?.consistencyValidationEvidenceAttached, true);
  assert.equal(phase58Gate?.failoverValidationEvidenceAttached, true);
  assert.equal(phase58Gate?.dataIntegrityValidationEvidenceAttached, true);
  assert.equal(phase58Gate?.operationsRunbookAttached, true);
  assert.equal(phase58Gate?.runtimeReleaseSignoffAttached, true);
  assert.equal(phase58Gate?.runtimeImplementationValidationComplete, true);
  assert.equal(phase58Gate?.runtimeSupportBlocked, true);
  assert.equal(phase58Gate?.releaseAllowed, false);
  assert.ok(phase58Gate?.blockers.some((blocker) => blocker.includes("runtime support remains blocked")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 58 runtime implementation validation evidence is attached"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 58 runtime implementation validation evidence attached")));
});

test("Phase 59 release-enable approval evidence is required after Phase 58 completion", () => {
  const report = assessReleaseReadiness({
    env: phase58CompleteMultiWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase59Gate = report.asyncStoreBoundary.phase59MultiWriterRuntimeEnablementApprovalGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeImplementationValidationComplete, true);
  assert.equal(phase59Gate?.required, true);
  assert.equal(phase59Gate?.runtimeImplementationValidationComplete, true);
  assert.equal(phase59Gate?.enablementDecisionEvidenceAttached, false);
  assert.equal(phase59Gate?.enablementApproverEvidenceAttached, false);
  assert.equal(phase59Gate?.rolloutWindowEvidenceAttached, false);
  assert.equal(phase59Gate?.monitoringSignoffEvidenceAttached, false);
  assert.equal(phase59Gate?.abortPlanEvidenceAttached, false);
  assert.equal(phase59Gate?.releaseTicketEvidenceAttached, false);
  assert.equal(phase59Gate?.runtimeEnablementApprovalComplete, false);
  assert.equal(phase59Gate?.runtimeSupportBlocked, true);
  assert.equal(phase59Gate?.releaseAllowed, false);
  assert.ok(phase59Gate?.blockers.some((blocker) => blocker.includes("enablement decision evidence")));
  assert.ok(phase59Gate?.blockers.some((blocker) => blocker.includes("release ticket evidence")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION")));
});

test("Phase 59 release-enable approval evidence attaches but still blocks multi-writer runtime release", () => {
  const env: ReleaseReadinessEnv = {
    ...phase58CompleteMultiWriterEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "decision://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "release-owner",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-04T16:00:00Z/2026-05-04T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "monitoring-signoff://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "abort-plan://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "release-ticket://phase59",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase59Gate = report.asyncStoreBoundary.phase59MultiWriterRuntimeEnablementApprovalGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(phase59Gate?.required, true);
  assert.equal(phase59Gate?.runtimeImplementationValidationComplete, true);
  assert.equal(phase59Gate?.enablementDecisionEvidenceAttached, true);
  assert.equal(phase59Gate?.enablementApproverEvidenceAttached, true);
  assert.equal(phase59Gate?.rolloutWindowEvidenceAttached, true);
  assert.equal(phase59Gate?.monitoringSignoffEvidenceAttached, true);
  assert.equal(phase59Gate?.abortPlanEvidenceAttached, true);
  assert.equal(phase59Gate?.releaseTicketEvidenceAttached, true);
  assert.equal(phase59Gate?.runtimeEnablementApprovalComplete, true);
  assert.equal(phase59Gate?.runtimeSupportBlocked, true);
  assert.equal(phase59Gate?.releaseAllowed, false);
  assert.ok(phase59Gate?.blockers.some((blocker) => blocker.includes("approval evidence does not permit")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 59 release-enable approval evidence is attached"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 59 release-enable approval evidence attached")));
});

test("Phase 60 runtime support presence assertion evidence is required after Phase 59 completion", () => {
  const report = assessReleaseReadiness({
    env: phase59CompleteMultiWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase60Gate = report.asyncStoreBoundary.phase60MultiWriterRuntimeSupportPresenceAssertionGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase59MultiWriterRuntimeEnablementApprovalGate?.runtimeEnablementApprovalComplete, true);
  assert.equal(phase60Gate?.required, true);
  assert.equal(phase60Gate?.runtimeEnablementApprovalComplete, true);
  assert.equal(phase60Gate?.implementationPresentEvidenceAttached, false);
  assert.equal(phase60Gate?.explicitSupportStatementAttached, false);
  assert.equal(phase60Gate?.compatibilityMatrixAttached, false);
  assert.equal(phase60Gate?.cutoverEvidenceAttached, false);
  assert.equal(phase60Gate?.releaseAutomationApprovalAttached, false);
  assert.equal(phase60Gate?.ownerAcceptanceAttached, false);
  assert.equal(phase60Gate?.runtimeSupportPresenceAssertionComplete, false);
  assert.equal(phase60Gate?.runtimeSupportBlocked, true);
  assert.equal(phase60Gate?.releaseAllowed, false);
  assert.ok(phase60Gate?.blockers.some((blocker) => blocker.includes("implementation-present evidence")));
  assert.ok(phase60Gate?.blockers.some((blocker) => blocker.includes("owner acceptance evidence")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT")));
});

test("Phase 60 runtime support presence assertion evidence attaches but still blocks multi-writer runtime release", () => {
  const env: ReleaseReadinessEnv = {
    ...phase59CompleteMultiWriterEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "implementation-present://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT: "support-statement://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "compatibility-matrix://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "cutover-evidence://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL: "release-automation://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "owner-acceptance://phase60",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase60Gate = report.asyncStoreBoundary.phase60MultiWriterRuntimeSupportPresenceAssertionGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(phase60Gate?.required, true);
  assert.equal(phase60Gate?.runtimeEnablementApprovalComplete, true);
  assert.equal(phase60Gate?.implementationPresentEvidenceAttached, true);
  assert.equal(phase60Gate?.explicitSupportStatementAttached, true);
  assert.equal(phase60Gate?.compatibilityMatrixAttached, true);
  assert.equal(phase60Gate?.cutoverEvidenceAttached, true);
  assert.equal(phase60Gate?.releaseAutomationApprovalAttached, true);
  assert.equal(phase60Gate?.ownerAcceptanceAttached, true);
  assert.equal(phase60Gate?.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(phase60Gate?.runtimeSupportBlocked, true);
  assert.equal(phase60Gate?.releaseAllowed, false);
  assert.ok(phase60Gate?.blockers.some((blocker) => blocker.includes("support presence assertion evidence does not permit")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 60 runtime support presence assertion evidence is attached"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 60 runtime support presence assertion evidence attached")));
});

test("Phase 61 runtime activation controls are required after Phase 60 completion", () => {
  const report = assessReleaseReadiness({
    env: phase60CompleteMultiWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase61Gate = report.asyncStoreBoundary.phase61MultiWriterRuntimeActivationControlsGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(report.asyncStoreBoundary.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(phase61Gate?.required, true);
  assert.equal(phase61Gate?.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(phase61Gate?.activationDecisionAttached, false);
  assert.equal(phase61Gate?.activationOwnerAttached, false);
  assert.equal(phase61Gate?.activationWindowAttached, false);
  assert.equal(phase61Gate?.activationFlagAttached, false);
  assert.equal(phase61Gate?.releaseAutomationAssertionAttached, false);
  assert.equal(phase61Gate?.activationControlsReady, false);
  assert.equal(phase61Gate?.activationGatePassed, false);
  assert.equal(phase61Gate?.activationReady, false);
  assert.equal(phase61Gate?.runtimeSupportBlocked, true);
  assert.equal(phase61Gate?.releaseAllowed, false);
  assert.ok(phase61Gate?.blockers.some((blocker) => blocker.includes("activation decision evidence")));
  assert.ok(phase61Gate?.blockers.some((blocker) => blocker.includes("release automation assertion evidence")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION")));
});

test("Phase 61 runtime activation controls attach but still block multi-writer runtime release", () => {
  const env: ReleaseReadinessEnv = {
    ...phase60CompleteMultiWriterEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "activation-decision://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "activation-owner://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-05T16:00:00Z/2026-05-05T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION: "release-automation-assertion://phase61",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase61Gate = report.asyncStoreBoundary.phase61MultiWriterRuntimeActivationControlsGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(phase61Gate?.required, true);
  assert.equal(phase61Gate?.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(phase61Gate?.activationDecisionAttached, true);
  assert.equal(phase61Gate?.activationOwnerAttached, true);
  assert.equal(phase61Gate?.activationWindowAttached, true);
  assert.equal(phase61Gate?.activationFlagAttached, true);
  assert.equal(phase61Gate?.releaseAutomationAssertionAttached, true);
  assert.equal(phase61Gate?.activationControlsReady, true);
  assert.equal(phase61Gate?.activationGatePassed, true);
  assert.equal(phase61Gate?.activationReady, true);
  assert.equal(phase61Gate?.runtimeSupportBlocked, true);
  assert.equal(phase61Gate?.releaseAllowed, false);
  assert.ok(phase61Gate?.blockers.some((blocker) => blocker.includes("activation controls evidence does not permit")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 61 runtime activation controls are attached"));
  assert.ok(!report.asyncStoreBoundary.summary.includes("Phase 62"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 61 runtime activation controls attached")));
});

test("Phase 62 horizontal writer hardening evidence is required for managed Postgres horizontal app writers", () => {
  const report = assessReleaseReadiness({
    env: phase61CompleteHorizontalWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase62Gate = report.asyncStoreBoundary.phase62ManagedPostgresHorizontalWriterHardeningGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.managedDatabaseTopology.managedDatabase.phase62?.horizontalWriterTopologyRequested, true);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(phase62Gate?.required, true);
  assert.equal(phase62Gate?.managedPostgresStartupSupported, true);
  assert.equal(phase62Gate?.phase61ActivationReady, true);
  assert.equal(phase62Gate?.horizontalWriterHardeningImplementationAttached, false);
  assert.equal(phase62Gate?.horizontalWriterConcurrencyTestEvidenceAttached, false);
  assert.equal(phase62Gate?.horizontalWriterTransactionRetryEvidenceAttached, false);
  assert.equal(phase62Gate?.horizontalWriterHardeningReady, false);
  assert.equal(phase62Gate?.horizontalWriterRuntimeSupported, false);
  assert.equal(phase62Gate?.activeActiveSupported, false);
  assert.equal(phase62Gate?.distributedSqliteSupported, false);
  assert.equal(phase62Gate?.phases63To66Pending, true);
  assert.equal(phase62Gate?.releaseAllowed, false);
  assert.ok(phase62Gate?.blockers.some((blocker) => blocker.includes("hardening implementation evidence")));
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 62 managed Postgres horizontal app-writer concurrency hardening is incomplete"));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION")));
});

test("Phase 62 horizontal writer hardening completes only the supported managed Postgres app-writer posture", () => {
  const env: ReleaseReadinessEnv = {
    ...phase61CompleteHorizontalWriterEnv(),
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "concurrency-test://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase62Gate = report.asyncStoreBoundary.phase62ManagedPostgresHorizontalWriterHardeningGate;

  assert.equal(report.readyForRelease, false);
  assert.equal(report.managedDatabaseTopology.managedDatabase.phase62?.horizontalWriterHardeningReady, true);
  assert.equal(phase62Gate?.required, true);
  assert.equal(phase62Gate?.horizontalWriterHardeningImplementationAttached, true);
  assert.equal(phase62Gate?.horizontalWriterConcurrencyTestEvidenceAttached, true);
  assert.equal(phase62Gate?.horizontalWriterTransactionRetryEvidenceAttached, true);
  assert.equal(phase62Gate?.horizontalWriterHardeningReady, true);
  assert.equal(phase62Gate?.horizontalWriterRuntimeSupported, true);
  assert.equal(phase62Gate?.activeActiveSupported, false);
  assert.equal(phase62Gate?.regionalFailoverSupported, false);
  assert.equal(phase62Gate?.pitrRuntimeSupported, false);
  assert.equal(phase62Gate?.distributedSqliteSupported, false);
  assert.equal(phase62Gate?.genericMultiWriterDatabaseSupported, false);
  assert.deepEqual(phase62Gate?.pendingPhases, ["63", "64", "65", "66"]);
  assert.equal(phase62Gate?.releaseAllowed, false);
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 62 concurrency hardening is complete"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 63 distributed dependency enforcement")));
});

test("Phase 63 distributed dependency enforcement is required after Phase 62 horizontal writer hardening", () => {
  const env: ReleaseReadinessEnv = {
    ...phase61CompleteHorizontalWriterEnv(),
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "concurrency-test://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase63Gate(report);

  assert.equal(report.readyForRelease, false);
  assert.equal(report.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(gate.phase, "63");
  assert.equal(gate.required, true);
  assert.equal(gate.phase62HorizontalWriterHardeningReady, true);
  assert.equal(gate.distributedRateLimitReady, false);
  assert.equal(gate.schedulerCoordinationReady, false);
  assert.equal(gate.durableJobExecutionReady, false);
  assert.equal(gate.accessLogShippingReady, false);
  assert.equal(gate.alertDeliveryReady, false);
  assert.equal(gate.healthMonitoringReady, false);
  assert.equal(gate.distributedDependencyEnforcementReady, false);
  assert.equal(gate.activationDependencyGatePassed, false);
  assert.equal(gate.strictActivationBlocked, true);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase63-distributed-dependency-enforcement"), "fail");
  assert.ok(gate.blockers.some((blocker) => blocker.includes("distributed rate limiting")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 63")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL")));
});

test("Phase 63 dependency enforcement activation gate passes only when all six dependency areas are production-safe", () => {
  const report = assessReleaseReadiness({
    env: phase63CompleteHorizontalWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase63Gate(report);

  assert.equal(gate.required, true);
  assert.equal(gate.phase62HorizontalWriterHardeningReady, true);
  assert.equal(gate.distributedRateLimitReady, true);
  assert.equal(gate.schedulerCoordinationReady, true);
  assert.equal(gate.durableJobExecutionReady, true);
  assert.equal(gate.accessLogShippingReady, true);
  assert.equal(gate.alertDeliveryReady, true);
  assert.equal(gate.healthMonitoringReady, true);
  assert.equal(gate.distributedDependencyEnforcementReady, true);
  assert.equal(gate.activationDependencyGatePassed, true);
  assert.equal(gate.strictActivationBlocked, false);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase63-distributed-dependency-enforcement"), "pass");
  assert.equal(report.readyForRelease, false);
  assert.ok(report.asyncStoreBoundary.summary.includes("Phase 63 distributed dependency enforcement is complete"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 64 recovery validation")));
});

test("Phase 64 recovery validation blocks strict activation when recovery evidence is missing", () => {
  const report = assessReleaseReadiness({
    env: phase63CompleteHorizontalWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase64Gate(report);

  assert.equal(report.readyForRelease, false);
  assert.equal(gate.phase, "64");
  assert.equal(gate.required, true);
  assert.equal(gate.phase63ActivationDependencyGatePassed, true);
  assert.equal(gate.backupRestoreEvidenceAttached, false);
  assert.equal(gate.pitrRehearsalEvidenceAttached, false);
  assert.equal(gate.failoverRehearsalEvidenceAttached, false);
  assert.equal(gate.dataIntegrityValidationEvidenceAttached, false);
  assert.equal(gate.recoveryTimeExpectationAttached, false);
  assert.equal(gate.managedPostgresRecoveryValidationReady, false);
  assert.equal(gate.providerOwnedHaPitrValidated, false);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase64-managed-postgres-recovery-validation"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 64")));
});

test("Phase 64 recovery validation passes only when all recovery evidence is present", () => {
  const report = assessReleaseReadiness({
    env: phase64CompleteHorizontalWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase64Gate(report);

  assert.equal(gate.required, true);
  assert.equal(gate.backupRestoreEvidenceAttached, true);
  assert.equal(gate.pitrRehearsalEvidenceAttached, true);
  assert.equal(gate.failoverRehearsalEvidenceAttached, true);
  assert.equal(gate.dataIntegrityValidationEvidenceAttached, true);
  assert.equal(gate.recoveryTimeExpectationAttached, true);
  assert.equal(gate.managedPostgresRecoveryValidationReady, true);
  assert.equal(gate.providerOwnedHaPitrValidated, true);
  assert.equal(gate.activeActiveSupported, false);
  assert.equal(gate.regionalFailoverSupported, false);
  assert.equal(gate.pitrRuntimeSupported, false);
  assert.equal(gate.distributedSqliteSupported, false);
  assert.equal(gate.applicationManagedRegionalFailoverSupported, false);
  assert.equal(gate.applicationManagedPitrSupported, false);
  assert.deepEqual(gate.pendingPhases, ["65", "66"]);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase64-managed-postgres-recovery-validation"), "pass");
  assert.equal(report.readyForRelease, false);
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 65 cutover/rollback automation")));
});

test("Phase 65 cutover automation blocks activation when preflight evidence is missing", () => {
  const report = assessReleaseReadiness({
    env: phase64CompleteHorizontalWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase65Gate(report);

  assert.equal(report.readyForRelease, false);
  assert.equal(gate.phase, "65");
  assert.equal(gate.required, true);
  assert.equal(gate.phase64ManagedPostgresRecoveryValidationReady, true);
  assert.equal(gate.cutoverPreflightEvidenceAttached, false);
  assert.equal(gate.activationDryRunEvidenceAttached, false);
  assert.equal(gate.postActivationSmokeCheckEvidenceAttached, false);
  assert.equal(gate.rollbackCommandGuidanceAttached, false);
  assert.equal(gate.monitoringThresholdEvidenceAttached, false);
  assert.equal(gate.operationsHealthCutoverStatusAttached, false);
  assert.equal(gate.rollbackSafePostureEvidenceAttached, false);
  assert.equal(gate.activationBlocked, true);
  assert.equal(gate.cutoverRollbackAutomationReady, false);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase65-cutover-rollback-automation"), "fail");
  assert.ok(gate.blockers.some((blocker) => blocker.includes("Phase 65 cutover preflight")));
});

test("Phase 65 failed smoke checks require rollback proof and keep activation blocked", () => {
  const report = assessReleaseReadiness({
    env: {
      ...phase65CompleteHorizontalWriterEnv(),
      TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_FAILED: "true",
      TASKLOOM_ROLLBACK_SAFE_POSTURE_EVIDENCE: "safe-posture://phase65/rollback-complete",
    },
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase65Gate(report);

  assert.equal(gate.postActivationSmokeCheckEvidenceAttached, true);
  assert.equal(gate.postActivationSmokeCheckFailed, true);
  assert.equal(gate.rollbackToPriorSafePostureRequired, true);
  assert.equal(gate.rollbackToPriorSafePostureProven, true);
  assert.equal(gate.activationBlocked, true);
  assert.equal(gate.cutoverRollbackAutomationReady, false);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase65-cutover-rollback-automation"), "fail");
  assert.ok(gate.blockers.some((blocker) => blocker.includes("smoke checks failed")));
});

test("Phase 65 cutover automation passes with preflight, dry-run, smoke, rollback, monitoring, and health evidence", () => {
  const report = assessReleaseReadiness({
    env: phase65CompleteHorizontalWriterEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const gate = phase65Gate(report);

  assert.equal(gate.cutoverPreflightEvidenceAttached, true);
  assert.equal(gate.cutoverPreflightFailed, false);
  assert.equal(gate.activationDryRunEvidenceAttached, true);
  assert.equal(gate.postActivationSmokeCheckEvidenceAttached, true);
  assert.equal(gate.postActivationSmokeCheckFailed, false);
  assert.equal(gate.rollbackCommandGuidanceAttached, true);
  assert.equal(gate.monitoringThresholdEvidenceAttached, true);
  assert.equal(gate.operationsHealthCutoverStatusAttached, true);
  assert.equal(gate.rollbackSafePostureEvidenceAttached, true);
  assert.equal(gate.activationBlocked, false);
  assert.equal(gate.cutoverRollbackAutomationReady, true);
  assert.equal(gate.finalReleaseApprovalBlocked, true);
  assert.deepEqual(gate.pendingPhases, ["66"]);
  assert.equal(gate.releaseAllowed, false);
  assert.equal(checkStatus(report, "phase65-cutover-rollback-automation"), "pass");
  assert.equal(report.readyForRelease, false);
  assert.ok(gate.summary.includes("Phase 65 cutover/rollback automation is complete"));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 66")));
});

test("Phase 55 detailed reviewer and authorization evidence attaches without coarse evidence refs", () => {
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
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "requirements://phase53",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "design://phase53",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "storage-platform",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "workspace leader plus conflict runbook",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "failover-pitr-runbook",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "migration-backfill-runbook",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "topology-observability-dashboard",
    TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "rollback-runbook",
    TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "release-owner",
    TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
    TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "phase-55-design-package-review-only",
    TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety-signoff.md",
  };
  const report = assessReleaseReadiness({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    strict: true,
  });
  const phase55Gate = report.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate;

  assert.equal(phase55Gate?.designPackageReviewEvidenceAttached, true);
  assert.equal(phase55Gate?.implementationAuthorizationEvidenceAttached, true);
  assert.equal(phase55Gate?.implementationAuthorized, true);
  assert.equal(phase55Gate?.releaseAllowed, false);
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
