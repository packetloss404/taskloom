import assert from "node:assert/strict";
import test from "node:test";
import { assessReleaseEvidence, buildReleaseEvidenceBundle, type ReleaseEvidenceEntry } from "./release-evidence.js";
import {
  buildManagedDatabaseRuntimeGuardReport,
  type ManagedDatabaseRuntimeGuardReport,
} from "./managed-database-runtime-guard.js";
import {
  buildManagedDatabaseTopologyReport,
  type ManagedDatabaseTopologyReport,
} from "./managed-database-topology.js";
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

function phase58CompleteMultiWriterEvidenceEnv() {
  return {
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
    TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "runtime-implementation://phase58",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "consistency-validation://phase58",
    TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "failover-validation://phase58",
    TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "data-integrity-validation://phase58",
    TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "operations-runbook://phase58",
    TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "runtime-signoff://phase58",
  };
}

function phase59CompleteMultiWriterEvidenceEnv() {
  return {
    ...phase58CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "decision://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "release-owner",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-04T16:00:00Z/2026-05-04T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "monitoring-signoff://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "abort-plan://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "release-ticket://phase59",
  };
}

function phase60CompleteMultiWriterEvidenceEnv() {
  return {
    ...phase59CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "implementation-present://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT: "support-statement://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "compatibility-matrix://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "cutover-evidence://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL: "release-automation://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "owner-acceptance://phase60",
  };
}

function phase61CompleteHorizontalWriterEvidenceEnv() {
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

function phase64CompleteHorizontalWriterEvidenceEnv() {
  return {
    ...phase61CompleteHorizontalWriterEvidenceEnv(),
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "concurrency://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.internal/taskloom",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_EVIDENCE: "rate-limit://phase63",
    TASKLOOM_SCHEDULER_LEADER_MODE: "http",
    TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://scheduler.internal/leader",
    TASKLOOM_SCHEDULER_COORDINATION_EVIDENCE: "scheduler://phase63",
    TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE: "managed-postgres-transactional-queue",
    TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE: "jobs://phase63",
    TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE: "logs://phase63",
    TASKLOOM_ALERT_EVALUATE_CRON: "*/1 * * * *",
    TASKLOOM_ALERT_WEBHOOK_URL: "https://alerts:secret@hooks.internal/taskloom",
    TASKLOOM_ALERT_DELIVERY_EVIDENCE: "alerts://phase63",
    TASKLOOM_HEALTH_MONITORING_EVIDENCE: "health://phase63",
    TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE: "restore://phase64/backup",
    TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE: "pitr://phase64/rehearsal",
    TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE: "failover://phase64/rehearsal",
    TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE: "integrity://phase64/post-recovery",
    TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION: "rto=15m;rpo=5m",
  };
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
      managedDatabaseAdapter: null,
      env: {},
    },
    managedDatabase: {
      requested: false,
      configured: false,
      supported: false,
      syncStartupSupported: false,
      phase50: {
        asyncAdapterConfigured: false,
        asyncAdapterAvailable: false,
        backfillAvailable: false,
        adapter: null,
      },
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
      managedDatabaseAdapter: null,
      env: {},
    },
    phase50: {
      asyncAdapterConfigured: false,
      asyncAdapterAvailable: false,
      backfillAvailable: false,
      adapter: null,
      syncStartupSupported: false,
    },
    phase51: {
      phase: "51",
      tracked: true,
      runtimeCallSitesMigrated: false,
      remainingSyncCallSiteGroups: ["injected sync caller"],
      managedPostgresStartupSupported: false,
      strictBlocker: true,
      summary: "Injected Phase 51 migration evidence.",
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
  assert.equal(bundle.evidence.config.phase52ManagedStartupSupported, false);
  assert.equal(bundle.evidence.config.managedDatabaseAdapterImplemented, false);
  assert.equal(bundle.evidence.config.managedDatabaseRepositoriesImplemented, false);
  assert.equal(bundle.evidence.config.managedDatabaseBackfillAvailable, false);
  assert.equal(bundle.evidence.config.managedDatabaseSyncStartupSupported, false);
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeCallSiteMigrationTracked, true);
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeCallSitesMigrated, true);
  assert.deepEqual(bundle.evidence.config.managedDatabaseRemainingSyncCallSiteGroups, []);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyGateRequired, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterRequirementsEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignPackageEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterRequirementsEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignPackageEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyReleaseAllowed, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationGateRequired, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterDesignPackageReviewEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorized, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterRuntimeSupportBlocked, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterTopologyReleaseAllowed, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessGateRequired, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterImplementationReadinessEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRolloutSafetyEvidenceRequired, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessComplete, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeSupportBlocked, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterTopologyReleaseAllowed, true);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_STORE").configured, false);
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-42-storage-topology"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-43-release-readiness"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-45-managed-database-topology"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-46-runtime-guard"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-48-managed-database-runtime-boundary"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-49-async-store-boundary"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-50-managed-database-adapter"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-51-runtime-call-site-migration"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-52-managed-postgres-startup-support"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-53-multi-writer-topology-requirements-design"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-55-multi-writer-topology-design-package-review"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-55-multi-writer-topology-implementation-authorization"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-56-multi-writer-runtime-implementation-readiness"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-56-multi-writer-rollout-safety"));
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
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 50 as adapter/backfill evidence")));
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
  assert.equal(bundle.evidence.config.managedDatabaseBackfillAvailable, false);
  assert.equal(bundle.evidence.config.managedDatabaseSyncStartupSupported, false);
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeCallSitesMigrated, true);
  assert.equal(bundle.managedDatabaseRuntimeBoundary.classification, "managed-database-blocked");
  assert.equal(bundle.asyncStoreBoundary.classification, "managed-postgres-unsupported");
  assert.match(bundle.summary, /Managed DB blockers/);
  assert.match(bundle.summary, /Phase 49 async-store boundary exists as foundation/);
  assert.match(bundle.summary, /startup support/);
  assert.match(bundle.summary, /Phase 52 managed Postgres startup support/);
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres")));
  assert.ok(bundle.nextSteps.some((step) => step.includes("adapter, repositories")));
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MANAGED_DATABASE_URL").value, "[redacted]");
});

test("strict evidence separates Phase 50 adapter and backfill capability from incomplete Phase 51 startup support", () => {
  const env = {
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
  const bundle = assessReleaseEvidence({
    env,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-28T22:00:00.000Z",
    strict: true,
  });

  const phase50Attachment = bundle.attachments.find((attachment) => attachment.id === "phase-50-managed-database-adapter");
  const phase51Attachment = bundle.attachments.find((attachment) => attachment.id === "phase-51-runtime-call-site-migration");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.managedDatabaseAdapterImplemented, true);
  assert.equal(bundle.evidence.config.managedDatabaseBackfillAvailable, true);
  assert.equal(bundle.evidence.config.managedDatabaseSyncStartupSupported, false);
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeCallSiteMigrationTracked, true);
  assert.equal(bundle.evidence.config.managedDatabaseRuntimeCallSitesMigrated, false);
  assert.deepEqual(bundle.evidence.config.managedDatabaseRemainingSyncCallSiteGroups, ["startup bootstrap"]);
  assert.equal(bundle.evidence.config.managedPostgresSupported, false);
  assert.equal(bundle.evidence.config.phase52ManagedStartupSupported, false);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryClassification, "managed-postgres-adapter-available-sync-blocked");
  assert.equal(bundle.managedDatabaseRuntimeGuard.allowed, false);
  assert.equal(bundle.asyncStoreBoundary.releaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.managedDatabaseAdapterImplemented, true);
  assert.equal(bundle.asyncStoreBoundary.managedDatabaseBackfillAvailable, true);
  assert.equal(phase50Attachment?.required, true);
  assert.equal(phase51Attachment?.required, true);
  assert.match(bundle.summary, /call-site migration.*incomplete/);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MANAGED_DATABASE_ADAPTER").value, "postgres");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MANAGED_DATABASE_URL").value, "[redacted]");
});

test("strict evidence reports Phase 52 managed startup support as release-ready", () => {
  const env = {
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
  const bundle = assessReleaseEvidence({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-28T22:30:00.000Z",
    strict: true,
  });

  const phase52Attachment = bundle.attachments.find((attachment) => attachment.id === "phase-52-managed-postgres-startup-support");

  assert.equal(bundle.readyForRelease, true);
  assert.equal(bundle.evidence.config.managedPostgresSupported, true);
  assert.equal(bundle.evidence.config.phase52ManagedStartupSupported, true);
  assert.equal(bundle.evidence.config.managedDatabaseSyncStartupSupported, true);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryReleaseAllowed, true);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryClassification, "managed-postgres-startup-supported");
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyGateRequired, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyReleaseAllowed, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationGateRequired, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterTopologyReleaseAllowed, true);
  assert.equal(bundle.releaseReadiness.readyForRelease, true);
  assert.equal(bundle.managedDatabaseRuntimeBoundary.allowed, true);
  assert.equal(bundle.asyncStoreBoundary.releaseAllowed, true);
  assert.equal(phase52Attachment?.required, true);
  assert.match(phase52Attachment?.summary ?? "", /Phase 52 managed Postgres startup support is asserted/);
  assert.match(bundle.summary, /ready for handoff/);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MANAGED_DATABASE_URL").value, "[redacted]");
});

test("strict evidence blocks multi-writer topology on the Phase 53 requirements design gate", () => {
  const env = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      managedPostgresStartupSupported: true,
    },
  });
  const bundle = assessReleaseEvidence({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-28T23:00:00.000Z",
    strict: true,
  });

  const phase53Attachment = bundle.attachments.find((attachment) => attachment.id === "phase-53-multi-writer-topology-requirements-design");
  const phase54Attachment = bundle.attachments.find((attachment) => attachment.id === "phase-54-multi-writer-topology-design-package");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryClassification, "multi-writer-unsupported");
  assert.equal(bundle.evidence.config.phase52ManagedStartupSupported, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyGateRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterRequirementsEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignPackageEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterRequirementsEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignPackageEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyOwnerEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyOwnerEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterConsistencyModelEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterConsistencyModelEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterFailoverPitrPlanEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterFailoverPitrPlanEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterMigrationBackfillPlanEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterMigrationBackfillPlanEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterObservabilityPlanEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterObservabilityPlanEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterRollbackPlanEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterRollbackPlanEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase53MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationGateRequired, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterDesignPackageReviewEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterDesignPackageReviewEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorized, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessGateRequired, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterImplementationReadinessEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterImplementationReadinessEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRolloutSafetyEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRolloutSafetyEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessComplete, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase53MultiWriterTopologyGate?.required, true);
  assert.equal(phase53Attachment?.required, true);
  assert.match(phase53Attachment?.summary ?? "", /Phase 53 multi-writer topology requirements\/design evidence/);
  assert.equal(phase54Attachment?.required, true);
  assert.match(phase54Attachment?.summary ?? "", /Phase 54 multi-writer topology design-package evidence/);
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-55-multi-writer-topology-design-package-review" && attachment.required));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-55-multi-writer-topology-implementation-authorization" && attachment.required));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-56-multi-writer-runtime-implementation-readiness" && attachment.required));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-56-multi-writer-rollout-safety" && attachment.required));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-54-multi-writer-topology-topology-owner" && attachment.required));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-54-multi-writer-topology-rollback-plan" && attachment.required));
  assert.match(bundle.summary, /Phase 54 design-package gate/);
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 54 multi-writer topology owner evidence")));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 54 multi-writer rollback plan evidence")));
});

test("strict evidence records configured Phase 54 design package while multi-writer runtime stays blocked", () => {
  const env = {
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
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      managedPostgresStartupSupported: true,
    },
  });
  const bundle = assessReleaseEvidence({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-28T23:30:00.000Z",
    strict: true,
  });
  const gate = bundle.asyncStoreBoundary.phase53MultiWriterTopologyGate;

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.asyncStoreBoundaryClassification, "multi-writer-unsupported");
  assert.equal(bundle.evidence.config.phase54MultiWriterDesignPackageEvidenceRequired, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterRequirementsEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase53MultiWriterDesignEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterDesignPackageEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterTopologyOwnerEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterConsistencyModelEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterFailoverPitrPlanEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterMigrationBackfillPlanEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterObservabilityPlanEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterRollbackPlanEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase54MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationGateRequired, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterDesignPackageReviewEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorized, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterTopologyReleaseAllowed, false);
  assert.equal(gate?.designPackageEvidenceAttached, true);
  assert.equal(gate?.releaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.releaseAllowed, false);
  assert.ok(gate?.blockers.some((blocker) => blocker.includes("runtime support remains blocked")));
  assert.ok(bundle.asyncStoreBoundary.blockers.some((blocker) => blocker.includes("Phase 55 multi-writer design-package review evidence")));
  assert.ok(bundle.nextSteps.some((step) => step.includes("blocked even with the Phase 54 design package attached")));
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER").value, "storage-platform");
});

test("strict evidence records redacted Phase 55 review and implementation authorization attachments while runtime stays blocked", () => {
  const env = {
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
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "https://approver:secret@auth.internal/phase55",
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      managedPostgresStartupSupported: true,
    },
  });
  const bundle = assessReleaseEvidence({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T00:00:00.000Z",
    strict: true,
  });
  const reviewAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-55-multi-writer-topology-design-package-review");
  const authorizationAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-55-multi-writer-topology-implementation-authorization");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase55MultiWriterDesignPackageReviewEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorizationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterImplementationAuthorized, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase55MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate?.releaseAllowed, false);
  assert.equal(reviewAttachment?.configured, true);
  assert.equal(reviewAttachment?.redacted, false);
  assert.equal(reviewAttachment?.value, "review://phase55");
  assert.equal(authorizationAttachment?.configured, true);
  assert.equal(authorizationAttachment?.redacted, true);
  assert.equal(authorizationAttachment?.value, "[redacted]");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION").value, "[redacted]");
  assert.ok(bundle.nextSteps.some((step) => step.includes("blocked even with Phase 55 review and implementation authorization attached")));
});

test("strict evidence records redacted Phase 56 runtime readiness attachments while runtime stays blocked", () => {
  const env = {
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
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "https://reviewer:secret@readiness.internal/phase56",
    TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "rollout-safety://phase56",
  };
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env, {
    phase51: {
      managedPostgresStartupSupported: true,
    },
  });
  const bundle = assessReleaseEvidence({
    env,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T00:30:00.000Z",
    strict: true,
  });
  const readinessAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-56-multi-writer-runtime-implementation-readiness");
  const rolloutAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-56-multi-writer-rollout-safety");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessGateRequired, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterImplementationReadinessEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRolloutSafetyEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeImplementationReady, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRolloutSafetyReady, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessComplete, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase56MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate?.releaseAllowed, false);
  assert.equal(readinessAttachment?.configured, true);
  assert.equal(readinessAttachment?.redacted, true);
  assert.equal(readinessAttachment?.value, "[redacted]");
  assert.equal(rolloutAttachment?.configured, true);
  assert.equal(rolloutAttachment?.redacted, false);
  assert.equal(rolloutAttachment?.value, "rollout-safety://phase56");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE").value, "[redacted]");
  assert.ok(bundle.nextSteps.some((step) => step.includes("blocked even with Phase 56 runtime readiness and rollout-safety evidence attached")));
});

test("strict evidence records redacted Phase 57 implementation scope attachments while runtime stays blocked", () => {
  const env = {
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
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "https://owner:secret@scope.internal/phase57",
    TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "validation://phase57",
    TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "cutover-lock://phase57",
    TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "signoff://phase57",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T00:30:00.000Z",
    strict: true,
  });
  const scopeLockAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-57-multi-writer-implementation-scope-lock");
  const featureFlagAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-57-multi-writer-runtime-feature-flag");
  const validationAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-57-multi-writer-validation-evidence");
  const cutoverAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-57-multi-writer-migration-cutover-lock");
  const signoffAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-57-multi-writer-release-owner-signoff");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase56MultiWriterRuntimeReadinessComplete, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterImplementationScopeGateRequired, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterRuntimeReadinessComplete, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterImplementationScopeLockAttached, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterRuntimeFeatureFlagAttached, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterValidationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterMigrationCutoverLockAttached, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterReleaseOwnerSignoffAttached, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterImplementationScopeComplete, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase57MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase57MultiWriterImplementationScopeGate?.releaseAllowed, false);
  assert.equal(scopeLockAttachment?.configured, true);
  assert.equal(scopeLockAttachment?.redacted, true);
  assert.equal(scopeLockAttachment?.value, "[redacted]");
  assert.equal(featureFlagAttachment?.configured, true);
  assert.equal(featureFlagAttachment?.value, "feature-flag://multi-writer-runtime-disabled");
  assert.equal(validationAttachment?.configured, true);
  assert.equal(cutoverAttachment?.configured, true);
  assert.equal(signoffAttachment?.configured, true);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK").value, "[redacted]");
  assert.ok(bundle.nextSteps.some((step) => step.includes("blocked even with Phase 57 implementation-scope evidence attached")));
});

test("strict evidence records redacted Phase 58 runtime validation attachments while runtime stays blocked", () => {
  const env = {
    ...phase58CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "https://validator:secret@runtime.internal/phase58",
    TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "https://failover:secret@validation.internal/phase58",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T01:00:00.000Z",
    strict: true,
  });
  const runtimeImplementationAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-58-multi-writer-runtime-implementation-evidence");
  const consistencyAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-58-multi-writer-consistency-validation");
  const failoverAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-58-multi-writer-failover-validation");
  const dataIntegrityAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-58-multi-writer-data-integrity-validation");
  const operationsRunbookAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-58-multi-writer-operations-runbook");
  const runtimeSignoffAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-58-multi-writer-runtime-release-signoff");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase57MultiWriterImplementationScopeComplete, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterRuntimeImplementationValidationGateRequired, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterImplementationScopeComplete, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterRuntimeImplementationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterConsistencyValidationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterFailoverValidationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterDataIntegrityValidationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterOperationsRunbookAttached, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterRuntimeReleaseSignoffAttached, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterRuntimeImplementationValidationComplete, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase58MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase58MultiWriterRuntimeImplementationValidationGate?.releaseAllowed, false);
  assert.equal(runtimeImplementationAttachment?.required, true);
  assert.equal(runtimeImplementationAttachment?.configured, true);
  assert.equal(runtimeImplementationAttachment?.redacted, true);
  assert.equal(runtimeImplementationAttachment?.value, "[redacted]");
  assert.equal(consistencyAttachment?.configured, true);
  assert.equal(consistencyAttachment?.value, "consistency-validation://phase58");
  assert.equal(failoverAttachment?.redacted, true);
  assert.equal(dataIntegrityAttachment?.configured, true);
  assert.equal(operationsRunbookAttachment?.configured, true);
  assert.equal(runtimeSignoffAttachment?.configured, true);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE").value, "[redacted]");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE").value, "[redacted]");
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 58 runtime implementation validation evidence attached")));
});

test("strict evidence records missing Phase 59 approval evidence while runtime stays blocked", () => {
  const bundle = assessReleaseEvidence({
    env: phase58CompleteMultiWriterEvidenceEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T01:30:00.000Z",
    strict: true,
  });

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase58MultiWriterRuntimeImplementationValidationComplete, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeEnablementApprovalGateRequired, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeImplementationValidationComplete, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterEnablementDecisionEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterEnablementApproverEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterRolloutWindowEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterMonitoringSignoffEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterAbortPlanEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterReleaseTicketEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeEnablementApprovalComplete, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase59MultiWriterRuntimeEnablementApprovalGate?.releaseAllowed, false);
  assert.ok(bundle.summary.includes("Phase 59 release-enable approval evidence is required"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION")));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-59-multi-writer-runtime-enablement-decision" && attachment.required));
});

test("strict evidence records redacted Phase 59 approval attachments while runtime stays blocked", () => {
  const env = {
    ...phase58CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "decision://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "https://approver:secret@release.internal/phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-04T16:00:00Z/2026-05-04T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "monitoring-signoff://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "abort-plan://phase59",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "release-ticket://phase59",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T02:00:00.000Z",
    strict: true,
  });
  const approverAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-59-multi-writer-runtime-enablement-approver");
  const ticketAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-59-multi-writer-runtime-enablement-release-ticket");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeEnablementApprovalGateRequired, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterEnablementDecisionEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterEnablementApproverEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterRolloutWindowEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterMonitoringSignoffEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterAbortPlanEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterReleaseTicketEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeEnablementApprovalComplete, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase59MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase59MultiWriterRuntimeEnablementApprovalGate?.releaseAllowed, false);
  assert.equal(approverAttachment?.configured, true);
  assert.equal(approverAttachment?.redacted, true);
  assert.equal(approverAttachment?.value, "[redacted]");
  assert.equal(ticketAttachment?.configured, true);
  assert.equal(ticketAttachment?.value, "release-ticket://phase59");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER").value, "[redacted]");
  assert.ok(bundle.summary.includes("Phase 59 release-enable approval evidence is attached"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 59 release-enable approval evidence attached")));
});

test("strict evidence records missing Phase 60 support presence assertion evidence while runtime stays blocked", () => {
  const bundle = assessReleaseEvidence({
    env: phase59CompleteMultiWriterEvidenceEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T02:30:00.000Z",
    strict: true,
  });

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase59MultiWriterRuntimeEnablementApprovalComplete, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportPresenceAssertionGateRequired, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeEnablementApprovalComplete, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterImplementationPresentEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterExplicitSupportStatementAttached, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterCompatibilityMatrixAttached, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterCutoverEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterReleaseAutomationApprovalAttached, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterOwnerAcceptanceAttached, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportPresenceAssertionComplete, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAllowed, false);
  assert.ok(bundle.summary.includes("Phase 60 runtime support presence assertion evidence is required"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT")));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-60-multi-writer-runtime-support-implementation-present" && attachment.required));
});

test("strict evidence records redacted Phase 60 support presence assertion attachments while runtime stays blocked", () => {
  const env = {
    ...phase59CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "implementation-present://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT: "https://support:secret@runtime.internal/phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "compatibility-matrix://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "cutover-evidence://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL: "release-automation://phase60",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "owner-acceptance://phase60",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T03:00:00.000Z",
    strict: true,
  });
  const supportStatementAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-60-multi-writer-runtime-support-explicit-support-statement");
  const ownerAcceptanceAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-60-multi-writer-runtime-support-owner-acceptance");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportPresenceAssertionGateRequired, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterImplementationPresentEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterExplicitSupportStatementAttached, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterCompatibilityMatrixAttached, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterCutoverEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterReleaseAutomationApprovalAttached, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterOwnerAcceptanceAttached, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportPresenceAssertionComplete, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase60MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAllowed, false);
  assert.equal(supportStatementAttachment?.configured, true);
  assert.equal(supportStatementAttachment?.redacted, true);
  assert.equal(supportStatementAttachment?.value, "[redacted]");
  assert.equal(ownerAcceptanceAttachment?.configured, true);
  assert.equal(ownerAcceptanceAttachment?.value, "owner-acceptance://phase60");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT").value, "[redacted]");
  assert.ok(bundle.summary.includes("Phase 60 runtime support presence assertion evidence is attached"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 60 runtime support presence assertion evidence attached")));
});

test("strict evidence records missing Phase 61 activation controls while runtime stays blocked", () => {
  const bundle = assessReleaseEvidence({
    env: phase60CompleteMultiWriterEvidenceEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T03:30:00.000Z",
    strict: true,
  });

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase60MultiWriterRuntimeSupportPresenceAssertionComplete, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterRuntimeActivationControlsGateRequired, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterRuntimeSupportPresenceAssertionComplete, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationDecisionAttached, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationOwnerAttached, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationWindowAttached, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationFlagAttached, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterReleaseAutomationAssertionAttached, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationControlsReady, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationGatePassed, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationReady, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase61MultiWriterRuntimeActivationControlsGate?.releaseAllowed, false);
  assert.ok(bundle.summary.includes("Phase 61 runtime activation controls are required"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION")));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-61-multi-writer-runtime-activation-decision" && attachment.required));
});

test("strict evidence records complete Phase 61 activation controls without unblocking runtime or claiming later phases", () => {
  const env = {
    ...phase60CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "activation-decision://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "activation-owner://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-05T16:00:00Z/2026-05-05T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION: "release-automation-assertion://phase61",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T04:00:00.000Z",
    strict: true,
  });
  const decisionAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-61-multi-writer-runtime-activation-decision");
  const assertionAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-61-multi-writer-runtime-activation-release-automation-assertion");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterRuntimeActivationControlsGateRequired, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationDecisionAttached, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationOwnerAttached, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationWindowAttached, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationFlagAttached, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterReleaseAutomationAssertionAttached, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationControlsReady, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationGatePassed, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationReady, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterRuntimeSupportBlocked, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterTopologyReleaseAllowed, false);
  assert.equal(bundle.asyncStoreBoundary.phase61MultiWriterRuntimeActivationControlsGate?.releaseAllowed, false);
  assert.equal(decisionAttachment?.configured, true);
  assert.equal(decisionAttachment?.value, "activation-decision://phase61");
  assert.equal(assertionAttachment?.configured, true);
  assert.equal(assertionAttachment?.value, "release-automation-assertion://phase61");
  assert.ok(bundle.summary.includes("Phase 61 runtime activation controls are attached"));
  assert.ok(!bundle.summary.includes("Phase 62"));
  assert.ok(!bundle.summary.includes("Phase 66"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 61 runtime activation controls attached")));
});

test("strict evidence redacts sensitive Phase 61 activation attachments while runtime stays blocked", () => {
  const env = {
    ...phase60CompleteMultiWriterEvidenceEnv(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "activation-decision://phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "https://owner:secret@release.internal/phase61",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-05T16:00:00Z/2026-05-05T18:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "feature-flag://multi-writer-runtime-disabled",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION: "release-automation-assertion://phase61",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T04:30:00.000Z",
    strict: true,
  });
  const ownerAttachment = bundle.attachments.find((attachment) => attachment.id === "phase-61-multi-writer-runtime-activation-owner");

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationControlsReady, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterActivationGatePassed, true);
  assert.equal(bundle.evidence.config.phase61MultiWriterRuntimeSupportBlocked, true);
  assert.equal(ownerAttachment?.configured, true);
  assert.equal(ownerAttachment?.redacted, true);
  assert.equal(ownerAttachment?.value, "[redacted]");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER").value, "[redacted]");
  assert.ok(bundle.summary.includes("Phase 61 runtime activation controls are attached"));
});

test("strict evidence records missing Phase 62 horizontal writer hardening for managed Postgres app writers", () => {
  const bundle = assessReleaseEvidence({
    env: phase61CompleteHorizontalWriterEvidenceEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T05:00:00.000Z",
    strict: true,
  });
  const implementationAttachment = bundle.attachments.find((attachment) =>
    attachment.id === "phase-62-managed-postgres-horizontal-writer-hardening-implementation"
  );

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase62ManagedPostgresHorizontalWriterHardeningGateRequired, true);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterTopologyRequested, true);
  assert.equal(bundle.evidence.config.phase62ManagedPostgresStartupSupported, true);
  assert.equal(bundle.evidence.config.phase62Phase61ActivationReady, true);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterHardeningImplementationAttached, false);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterConcurrencyTestEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterTransactionRetryEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterHardeningReady, false);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterRuntimeSupported, false);
  assert.equal(bundle.evidence.config.phase62ActiveActiveSupported, false);
  assert.equal(bundle.evidence.config.phase62DistributedSqliteSupported, false);
  assert.equal(bundle.evidence.config.phase62Phases63To66Pending, true);
  assert.equal(bundle.evidence.config.phase62TopologyReleaseAllowed, false);
  assert.equal(implementationAttachment?.required, true);
  assert.equal(implementationAttachment?.configured, false);
  assert.ok(bundle.summary.includes("Phase 62 managed Postgres horizontal app-writer concurrency hardening is incomplete"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE")));
});

test("strict evidence records complete Phase 62 hardening without claiming active-active or final release", () => {
  const env = {
    ...phase61CompleteHorizontalWriterEvidenceEnv(),
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "https://tests:secret@evidence.internal/phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T05:30:00.000Z",
    strict: true,
  });
  const concurrencyAttachment = bundle.attachments.find((attachment) =>
    attachment.id === "phase-62-managed-postgres-horizontal-writer-concurrency-test-evidence"
  );

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterHardeningImplementationAttached, true);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterConcurrencyTestEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterTransactionRetryEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterHardeningReady, true);
  assert.equal(bundle.evidence.config.phase62HorizontalWriterRuntimeSupported, true);
  assert.equal(bundle.evidence.config.phase62ActiveActiveSupported, false);
  assert.equal(bundle.evidence.config.phase62RegionalFailoverSupported, false);
  assert.equal(bundle.evidence.config.phase62PitrRuntimeSupported, false);
  assert.equal(bundle.evidence.config.phase62DistributedSqliteSupported, false);
  assert.equal(bundle.evidence.config.phase62GenericMultiWriterDatabaseSupported, false);
  assert.deepEqual(bundle.evidence.config.phase62PendingPhases, ["63", "64", "65", "66"]);
  assert.equal(bundle.evidence.config.phase62TopologyReleaseAllowed, false);
  assert.equal(concurrencyAttachment?.configured, true);
  assert.equal(concurrencyAttachment?.redacted, true);
  assert.equal(concurrencyAttachment?.value, "[redacted]");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE").value, "[redacted]");
  assert.ok(bundle.summary.includes("Phase 62 concurrency hardening is complete"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 66 final release closure")));
});

test("strict evidence records complete Phase 63 dependency enforcement with redacted attachments", () => {
  const env = {
    ...phase61CompleteHorizontalWriterEvidenceEnv(),
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "concurrency://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.internal/taskloom",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_EVIDENCE: "https://auditor:secret@evidence.internal/phase63-rate-limit",
    TASKLOOM_SCHEDULER_LEADER_MODE: "http",
    TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://scheduler.internal/leader",
    TASKLOOM_SCHEDULER_COORDINATION_EVIDENCE: "scheduler://phase63",
    TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE: "managed-postgres-transactional-queue",
    TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE: "jobs://phase63",
    TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE: "logs://phase63",
    TASKLOOM_ALERT_EVALUATE_CRON: "*/1 * * * *",
    TASKLOOM_ALERT_WEBHOOK_URL: "https://alerts:secret@hooks.internal/taskloom",
    TASKLOOM_ALERT_DELIVERY_EVIDENCE: "alerts://phase63",
    TASKLOOM_HEALTH_MONITORING_EVIDENCE: "health://phase63",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T06:00:00.000Z",
    strict: true,
  });
  const rateLimitAttachment = bundle.attachments.find((attachment) =>
    attachment.id === "phase-63-distributed-rate-limit-evidence"
  );

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase63DistributedDependencyEnforcementGateRequired, true);
  assert.equal(bundle.evidence.config.phase63Phase62HorizontalWriterHardeningReady, true);
  assert.equal(bundle.evidence.config.phase63DistributedRateLimitReady, true);
  assert.equal(bundle.evidence.config.phase63SchedulerCoordinationReady, true);
  assert.equal(bundle.evidence.config.phase63DurableJobExecutionReady, true);
  assert.equal(bundle.evidence.config.phase63AccessLogShippingReady, true);
  assert.equal(bundle.evidence.config.phase63AlertDeliveryReady, true);
  assert.equal(bundle.evidence.config.phase63HealthMonitoringReady, true);
  assert.equal(bundle.evidence.config.phase63ActivationDependencyGatePassed, true);
  assert.equal(bundle.evidence.config.phase63StrictActivationBlocked, false);
  assert.equal(bundle.evidence.config.phase63ActiveActiveSupported, false);
  assert.deepEqual(bundle.evidence.config.phase63PendingPhases, ["64", "65", "66"]);
  assert.equal(bundle.evidence.config.phase63TopologyReleaseAllowed, false);
  assert.equal(rateLimitAttachment?.required, true);
  assert.equal(rateLimitAttachment?.configured, true);
  assert.equal(rateLimitAttachment?.redacted, true);
  assert.equal(rateLimitAttachment?.value, "[redacted]");
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_ALERT_WEBHOOK_URL").value, "[redacted]");
  assert.ok(bundle.summary.includes("Phase 63 distributed dependency enforcement is complete"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 64 recovery validation")));
});

test("strict evidence blocks Phase 64 recovery validation until all recovery evidence is attached", () => {
  const env = {
    ...phase64CompleteHorizontalWriterEvidenceEnv(),
    TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE: "",
  };
  const bundle = assessReleaseEvidence({
    env,
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T06:30:00.000Z",
    strict: true,
  });
  const pitrAttachment = bundle.attachments.find((attachment) =>
    attachment.id === "phase-64-managed-postgres-pitr-rehearsal-evidence"
  );

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase64ManagedPostgresRecoveryValidationGateRequired, true);
  assert.equal(bundle.evidence.config.phase64Phase63ActivationDependencyGatePassed, true);
  assert.equal(bundle.evidence.config.phase64BackupRestoreEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64PitrRehearsalEvidenceAttached, false);
  assert.equal(bundle.evidence.config.phase64FailoverRehearsalEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64DataIntegrityValidationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64RecoveryTimeExpectationAttached, true);
  assert.equal(bundle.evidence.config.phase64ManagedPostgresRecoveryValidationReady, false);
  assert.equal(bundle.evidence.config.phase64TopologyReleaseAllowed, false);
  assert.equal(pitrAttachment?.required, true);
  assert.equal(pitrAttachment?.configured, false);
  assert.ok(bundle.summary.includes("Phase 64 recovery validation"));
});

test("strict evidence records complete Phase 64 recovery validation without claiming release readiness", () => {
  const bundle = assessReleaseEvidence({
    env: phase64CompleteHorizontalWriterEvidenceEnv(),
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
    generatedAt: "2026-04-29T07:00:00.000Z",
    strict: true,
  });
  const restoreAttachment = bundle.attachments.find((attachment) =>
    attachment.id === "phase-64-managed-postgres-backup-restore-evidence"
  );

  assert.equal(bundle.readyForRelease, false);
  assert.equal(bundle.evidence.config.phase64BackupRestoreEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64PitrRehearsalEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64FailoverRehearsalEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64DataIntegrityValidationEvidenceAttached, true);
  assert.equal(bundle.evidence.config.phase64RecoveryTimeExpectationAttached, true);
  assert.equal(bundle.evidence.config.phase64ManagedPostgresRecoveryValidationReady, true);
  assert.equal(bundle.evidence.config.phase64ProviderOwnedHaPitrValidated, true);
  assert.equal(bundle.evidence.config.phase64ActiveActiveSupported, false);
  assert.equal(bundle.evidence.config.phase64ApplicationManagedRegionalFailoverSupported, false);
  assert.deepEqual(bundle.evidence.config.phase64PendingPhases, ["65", "66"]);
  assert.equal(bundle.evidence.config.phase64TopologyReleaseAllowed, false);
  assert.equal(restoreAttachment?.configured, true);
  assert.equal(restoreAttachment?.redacted, false);
  assert.equal(restoreAttachment?.value, "restore://phase64/backup");
  assert.ok(bundle.nextSteps.some((step) => step.includes("Phase 65 cutover/rollback automation")));
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
