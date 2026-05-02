import assert from "node:assert/strict";
import test from "node:test";
import type { JobRecord, TaskloomData } from "./taskloom-store.js";
import {
  getOperationsStatus,
  type JobTypeMetrics,
  type ManagedDatabaseRuntimeGuardReport,
  type ManagedDatabaseTopologyReport,
  type StorageTopologyReport,
} from "./operations-status.js";

function emptyStore(): TaskloomData {
  return { jobs: [] } as unknown as TaskloomData;
}

function storeWithJobs(jobs: JobRecord[]): TaskloomData {
  return { jobs } as unknown as TaskloomData;
}

function fakeJob(type: string, status: JobRecord["status"], id: string): JobRecord {
  return {
    id,
    workspaceId: "alpha",
    type,
    payload: {},
    status,
    attempts: 0,
    maxAttempts: 1,
    scheduledAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function completeMultiWriterPhase56Env(): NodeJS.ProcessEnv {
  return {
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
    TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus idempotent async reconciliation",
    TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
    TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
    TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
    TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
    TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "artifacts/phase55/design-package-review.md",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "artifacts/phase55/implementation-auth.md",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "artifacts/phase56/implementation-readiness.md",
    TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "artifacts/phase56/rollout-safety.md",
  };
}

function completeMultiWriterPhase57Env(): NodeJS.ProcessEnv {
  return {
    ...completeMultiWriterPhase56Env(),
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "artifacts/phase57/implementation-scope-lock.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "artifacts/phase57/runtime-feature-flag.md",
    TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "artifacts/phase57/validation.md",
    TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "artifacts/phase57/migration-cutover-lock.md",
    TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "artifacts/phase57/release-owner-signoff.md",
  };
}

function completeMultiWriterPhase58Env(): NodeJS.ProcessEnv {
  return {
    ...completeMultiWriterPhase57Env(),
    TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "artifacts/phase58/runtime-implementation.md",
    TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "artifacts/phase58/consistency-validation.md",
    TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "artifacts/phase58/failover-validation.md",
    TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "artifacts/phase58/data-integrity-validation.md",
    TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "artifacts/phase58/operations-runbook.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "artifacts/phase58/runtime-release-signoff.md",
  };
}

function completeMultiWriterPhase59Env(): NodeJS.ProcessEnv {
  return {
    ...completeMultiWriterPhase58Env(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-release-gate-only",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "platform-release-owner",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-02T02:00:00Z/2026-05-02T04:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF:
      "artifacts/phase59/monitoring-signoff.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "artifacts/phase59/abort-plan.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "TASKLOOM-59",
  };
}

function completeMultiWriterPhase60Env(): NodeJS.ProcessEnv {
  return {
    ...completeMultiWriterPhase59Env(),
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "artifacts/phase60/implementation-present.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT:
      "artifacts/phase60/explicit-support-statement.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "artifacts/phase60/compatibility-matrix.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "artifacts/phase60/cutover-evidence.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL:
      "artifacts/phase60/release-automation-approval.md",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "artifacts/phase60/owner-acceptance.md",
  };
}

function completeMultiWriterPhase61Env(): NodeJS.ProcessEnv {
  return {
    ...completeMultiWriterPhase60Env(),
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "approved-for-activation-audit-only",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "platform-activation-owner",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-03T02:00:00Z/2026-05-03T04:00:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER=false",
    TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION:
      "artifacts/phase61/release-automation-assertion.md",
  };
}

function completeManagedPostgresHorizontalWriterEnv(): NodeJS.ProcessEnv {
  return {
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_AUDIT:
      "artifacts/phase62/write-path-concurrency-audit.md",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TESTS:
      "artifacts/phase62/concurrent-writer-tests.tap",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_CONTROL:
      "row-version compare-and-swap on document updates",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY:
      "artifacts/phase62/transaction-retry-idempotency.md",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_RELEASE_ASSERTION:
      "artifacts/phase62/horizontal-writer-release-assertion.md",
  };
}

function completeDistributedDependencyEnv(): NodeJS.ProcessEnv {
  return {
    ...completeManagedPostgresHorizontalWriterEnv(),
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.example.com/taskloom/check",
    TASKLOOM_SCHEDULER_LEADER_MODE: "http",
    TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://coord.example.com/taskloom/scheduler-leader",
    TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE: "managed-postgres-transactional-queue",
    TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE: "jobs://phase63/durable",
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE: "logs://phase63/stdout-shipper",
    TASKLOOM_ALERT_EVALUATE_CRON: "*/5 * * * *",
    TASKLOOM_ALERT_WEBHOOK_URL: "https://alerts.example.com/taskloom",
    TASKLOOM_ALERT_DELIVERY_EVIDENCE: "alerts://phase63/webhook",
    TASKLOOM_HEALTH_MONITORING_EVIDENCE: "https://monitoring.example.com/taskloom/health",
  };
}

function completeRecoveryValidationEnv(): NodeJS.ProcessEnv {
  return {
    ...completeDistributedDependencyEnv(),
    TASKLOOM_RECOVERY_BACKUP_RESTORE_EVIDENCE: "artifacts/phase64/backup-restore.md",
    TASKLOOM_RECOVERY_PITR_REHEARSAL_EVIDENCE: "artifacts/phase64/pitr-rehearsal.md",
    TASKLOOM_RECOVERY_FAILOVER_REHEARSAL_EVIDENCE: "artifacts/phase64/failover-rehearsal.md",
    TASKLOOM_RECOVERY_DATA_INTEGRITY_VALIDATION: "artifacts/phase64/data-integrity.md",
    TASKLOOM_RECOVERY_TIME_EXPECTATIONS: "RTO<=15m RPO<=5m validated in phase64 rehearsal",
  };
}

function completeCutoverAutomationEnv(): NodeJS.ProcessEnv {
  return {
    ...completeRecoveryValidationEnv(),
    TASKLOOM_MANAGED_POSTGRES_CUTOVER_PREFLIGHT_EVIDENCE:
      "artifacts/phase65/cutover-preflight.json",
    TASKLOOM_MANAGED_POSTGRES_CUTOVER_PREFLIGHT_STATUS: "passed",
    TASKLOOM_MANAGED_POSTGRES_ACTIVATION_DRY_RUN_EVIDENCE:
      "artifacts/phase65/activation-dry-run.json",
    TASKLOOM_MANAGED_POSTGRES_ACTIVATION_DRY_RUN_STATUS: "passed",
    TASKLOOM_MANAGED_POSTGRES_POST_ACTIVATION_SMOKE_EVIDENCE:
      "artifacts/phase65/post-activation-smoke.json",
    TASKLOOM_MANAGED_POSTGRES_POST_ACTIVATION_SMOKE_STATUS: "passed",
    TASKLOOM_MANAGED_POSTGRES_ROLLBACK_COMMAND_GUIDANCE:
      "npm run deployment:managed-postgres:rollback -- --to-prior-safe-posture",
    TASKLOOM_MANAGED_POSTGRES_MONITORING_THRESHOLDS:
      "error_rate<1%; p95<750ms; queue_lag<60s; db_connections<80%",
  };
}

function completeFinalReleaseClosureEnv(): NodeJS.ProcessEnv {
  return {
    ...completeCutoverAutomationEnv(),
    TASKLOOM_PHASE66_SUPPORTED_PRODUCTION_TOPOLOGY:
      "managed Postgres horizontal Taskloom app writers against one provider-owned primary/cluster",
    TASKLOOM_PHASE66_UNSUPPORTED_TOPOLOGY_BOUNDARIES:
      "active-active database writes, Taskloom-owned regional failover/PITR runtime, and distributed SQLite remain unsupported",
    TASKLOOM_PHASE66_FINAL_RELEASE_CHECKLIST: "artifacts/phase66/final-release-checklist.md",
    TASKLOOM_PHASE66_VALIDATION_RUN: "npm run typecheck && npm test && npm run build",
    TASKLOOM_PHASE66_DEPLOYMENT_CLI_CHECKS:
      "deployment:check-storage, deployment:check-managed-db, deployment:check-runtime-guard, deployment:check-release, deployment:export-evidence",
    TASKLOOM_PHASE66_DOCS_CONSISTENCY_CHECKS: "artifacts/phase66/docs-consistency.md",
    TASKLOOM_PHASE66_DOCUMENTATION_FREEZE: "artifacts/phase66/documentation-freeze.md",
    TASKLOOM_NO_HIDDEN_PHASE_ASSERTION: "Phase 66 closes the supported posture with no hidden follow-up phase.",
    TASKLOOM_PHASE66_RELEASE_APPROVAL: "TASKLOOM-66 approved by release owner",
  };
}

type DistributedDependencyKey =
  | "distributedRateLimiting"
  | "schedulerCoordination"
  | "durableJobExecution"
  | "accessLogShipping"
  | "alertDelivery"
  | "healthMonitoring";

interface DistributedDependencyStatusContract {
  phase: "63";
  status: "not-required" | "blocked" | "dependencies-ready";
  enforcementStatus: "not-required" | "blocked" | "ready";
  required: boolean;
  strictActivationBlocked: boolean;
  strictActivationAllowed: boolean;
  localOnlyDependencies: DistributedDependencyKey[];
  dependencies: Record<DistributedDependencyKey, { status: "ready" | "blocked" | "local-only" | "not-required"; productionSafe: boolean }>;
}

function distributedDependencyStatus(status: ReturnType<typeof getOperationsStatus>): DistributedDependencyStatusContract {
  const dependencyStatus = (status as unknown as { distributedDependencyEnforcement?: unknown })
    .distributedDependencyEnforcement;
  assert.ok(
    dependencyStatus && typeof dependencyStatus === "object",
    "expected operations status to expose Phase 63 distributedDependencyEnforcement",
  );
  return dependencyStatus as DistributedDependencyStatusContract;
}

test("default env yields json store, off leader mode, off access log, default knobs", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.store.mode, "json");
  assert.equal(status.scheduler.leaderMode, "off");
  assert.equal(status.scheduler.leaderTtlMs, 30000);
  assert.equal(status.scheduler.leaderHeldLocally, true);
  assert.equal(status.scheduler.lockSummary, "local");
  assert.equal(status.accessLog.mode, "off");
  assert.equal(status.accessLog.path, null);
  assert.equal(status.accessLog.maxBytes, 0);
  assert.equal(status.accessLog.maxFiles, 5);
  assert.deepEqual(status.jobs, []);
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.status, "pass");
  assert.equal(status.asyncStoreBoundary?.classification, "foundation-ready");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.localRuntimeSupported, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
  assert.equal(status.managedPostgresCapability.phase, "50");
  assert.equal(status.managedPostgresCapability.adapterConfigured, false);
  assert.equal(status.managedPostgresCapability.adapterAvailable, false);
  assert.equal(status.managedPostgresCapability.backfillAvailable, false);
  assert.equal(status.managedPostgresCapability.syncRuntimeGuarded, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "not-required");
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "not-required");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "not-required");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeActivationControls.phase, "61");
  assert.equal(status.multiWriterRuntimeActivationControls.status, "not-required");
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAllowed, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.phase, "62");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.status, "not-configured");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.horizontalAppWritersSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.activeActiveDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.releaseAllowed, false);
  assert.equal(status.managedPostgresRecoveryValidation.phase, "64");
  assert.equal(status.managedPostgresRecoveryValidation.status, "not-required");
  assert.equal(status.managedPostgresRecoveryValidation.recoveryValidationComplete, false);
  assert.equal(status.managedPostgresRecoveryValidation.activationAllowed, false);
  assert.equal(status.managedPostgresRecoveryValidation.activeActiveDatabaseSupported, false);
  assert.equal(status.managedPostgresRecoveryValidation.regionalRuntimeSupported, false);
  assert.equal(status.managedPostgresRecoveryValidation.pitrRuntimeSupported, false);
  assert.equal(status.managedPostgresCutoverAutomation.phase, "65");
  assert.equal(status.managedPostgresCutoverAutomation.status, "not-required");
  assert.equal(status.managedPostgresCutoverAutomation.cutoverAutomationReady, false);
  assert.equal(status.managedPostgresCutoverAutomation.activationAllowed, false);
  assert.equal(status.managedPostgresCutoverAutomation.rollbackRequired, false);
  assert.equal(status.finalReleaseClosure.phase, "66");
  assert.equal(status.finalReleaseClosure.status, "not-required");
  assert.equal(status.finalReleaseClosure.finalReleaseReady, false);
  assert.equal(status.finalReleaseClosure.documentationFrozen, false);
  assert.equal(status.finalReleaseClosure.releaseAllowed, false);
  assert.equal(status.runtime.nodeVersion, process.versions.node);
});

test("TASKLOOM_STORE=sqlite flips store mode", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.store.mode, "sqlite");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
  assert.match(String(status.asyncStoreBoundary?.summary), /JSON and single-node SQLite/i);
});

test("file leader mode reflects custom path and not-held when no probe registered", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_SCHEDULER_LEADER_MODE: "FILE",
      TASKLOOM_SCHEDULER_LEADER_FILE_PATH: "var/lib/taskloom/leader.json",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "file");
  assert.equal(status.scheduler.lockSummary, "var/lib/taskloom/leader.json");
  assert.equal(status.scheduler.leaderHeldLocally, false);
});

test("http leader mode strips query string from URL summary", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_SCHEDULER_LEADER_MODE: "http",
      TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://coord.internal/leader?token=secret123&extra=yes",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "http");
  assert.equal(status.scheduler.lockSummary, "https://coord.internal/leader");
  assert.equal(status.scheduler.leaderHeldLocally, false);
});

test("invalid leader mode falls back to off without throwing", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_SCHEDULER_LEADER_MODE: "bogus" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "off");
  assert.equal(status.scheduler.lockSummary, "local");
  assert.equal(status.scheduler.leaderHeldLocally, true);
});

test("jobs grouping aggregates statuses across types and uses succeeded for success", () => {
  const status = getOperationsStatus({
    loadStore: () => storeWithJobs([
      fakeJob("agent.run", "queued", "j1"),
      fakeJob("agent.run", "queued", "j2"),
      fakeJob("agent.run", "running", "j3"),
      fakeJob("agent.run", "success", "j4"),
      fakeJob("agent.run", "failed", "j5"),
      fakeJob("agent.run", "canceled", "j6"),
      fakeJob("brief.send", "queued", "j7"),
      fakeJob("brief.send", "success", "j8"),
      fakeJob("brief.send", "success", "j9"),
    ]),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.deepEqual(status.jobs, [
    { type: "agent.run", queued: 2, running: 1, succeeded: 1, failed: 1, canceled: 1 },
    { type: "brief.send", queued: 1, running: 0, succeeded: 2, failed: 0, canceled: 0 },
  ]);
});

test("access log reads max bytes, clamps max files to >= 1, and exposes file path", () => {
  const clamped = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "FILE",
      TASKLOOM_ACCESS_LOG_PATH: "logs/access.log",
      TASKLOOM_ACCESS_LOG_MAX_BYTES: "1048576",
      TASKLOOM_ACCESS_LOG_MAX_FILES: "0",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(clamped.accessLog.mode, "file");
  assert.equal(clamped.accessLog.path, "logs/access.log");
  assert.equal(clamped.accessLog.maxBytes, 1048576);
  assert.equal(clamped.accessLog.maxFiles, 1);

  const stdoutMode = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
      TASKLOOM_ACCESS_LOG_MAX_FILES: "10",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(stdoutMode.accessLog.mode, "stdout");
  assert.equal(stdoutMode.accessLog.path, null);
  assert.equal(stdoutMode.accessLog.maxFiles, 10);
});

test("storageTopology is built from the injected environment", () => {
  const fixture = {
    ready: true,
    status: "ready",
    summary: "sqlite database and backup path configured",
    checks: [
      { name: "database", status: "ready", detail: "TASKLOOM_STORE=sqlite" },
      { name: "backup", status: "ready", detail: "TASKLOOM_BACKUP_DIR configured" },
    ],
  };
  let observedBackupDir: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite", TASKLOOM_BACKUP_DIR: "backups" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildStorageTopologyReport: (env) => {
      observedBackupDir = env.TASKLOOM_BACKUP_DIR;
      return fixture as never;
    },
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(observedBackupDir, "backups");
  assert.deepEqual(status.storageTopology, fixture);
});

test("managedDatabaseTopology is built from the injected environment", () => {
  const fixture = {
    readyForManagedDatabase: true,
    status: "ready",
    summary: "managed postgres topology configured",
    observed: {
      requested: true,
      configured: true,
      supported: true,
      topology: "managed",
      provider: "postgres",
      currentStore: "sqlite",
    },
    checks: [
      { id: "requested", status: "ready", detail: "Managed database requested" },
      { id: "provider", status: "ready", detail: "Provider configured" },
    ],
  };
  let observedProvider: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_MANAGED_DATABASE_PROVIDER: "postgres" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseTopologyReport: (env) => {
      observedProvider = env.TASKLOOM_MANAGED_DATABASE_PROVIDER;
      return fixture as never;
    },
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(observedProvider, "postgres");
  assert.deepEqual(status.managedDatabaseTopology, fixture);
});

test("managedDatabaseRuntimeGuard is built from the injected environment", () => {
  const fixture: ManagedDatabaseRuntimeGuardReport = {
    phase: "46",
    allowed: false,
    status: "fail",
    classification: "managed-database-blocked",
    summary: "managed database runtime intent is blocked",
    observed: {
      nodeEnv: "development",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      bypassEnabled: false,
      managedDatabaseUrl: "[redacted]",
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
    checks: [
      { id: "managed-database-runtime", status: "fail", summary: "Managed database runtime is not enabled" },
      { id: "multi-writer-runtime", status: "pass", summary: "No multi-writer intent detected" },
    ],
    blockers: ["Remove managed database runtime intent before startup"],
    warnings: ["DATABASE_URL is advisory until runtime support lands"],
    nextSteps: ["Use single-node SQLite until the managed database adapter is ready"],
  };
  let observedProvider: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_MANAGED_DATABASE_PROVIDER: "postgres" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseRuntimeGuardReport: (env) => {
      observedProvider = env.TASKLOOM_MANAGED_DATABASE_PROVIDER;
      return fixture;
    },
  });

  assert.equal(observedProvider, "postgres");
  assert.deepEqual(status.managedDatabaseRuntimeGuard, fixture);
});

test("managedDatabaseRuntimeBoundary passes through when a managed runtime report exposes it", () => {
  const runtimeGuard = {
    phase: "48",
    allowed: false,
    status: "fail",
    classification: "managed-database-blocked",
    summary: "managed database runtime intent is blocked at the runtime boundary",
    runtimeBoundary: {
      status: "blocked",
      classification: "runtime-boundary",
      summary: "Managed database runtime boundary is enforced; managed DB runtime remains unsupported.",
      enforced: true,
    },
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      bypassEnabled: false,
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
  } as unknown as ManagedDatabaseRuntimeGuardReport;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_DATABASE_TOPOLOGY: "managed-database" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseRuntimeGuardReport: () => runtimeGuard,
  });

  assert.equal(status.managedDatabaseRuntimeBoundary?.source, "managedDatabaseRuntimeGuard");
  assert.equal(status.managedDatabaseRuntimeBoundary?.status, "blocked");
  assert.equal(status.managedDatabaseRuntimeBoundary?.classification, "runtime-boundary");
  assert.equal(status.managedDatabaseRuntimeBoundary?.enforced, true);
  assert.match(String(status.managedDatabaseRuntimeBoundary?.summary), /managed DB runtime remains unsupported/i);
});

test("asyncStoreBoundary passes through when a deployment report exposes it", () => {
  const releaseReadiness = {
    summary: "stubbed release readiness",
    asyncStoreBoundary: {
      phase: "49",
      status: "present",
      classification: "single-node-sqlite",
      summary: "Phase 49 async boundary evidence supplied by readiness.",
      foundationPresent: true,
      managedDatabaseRuntimeAllowed: false,
      managedDatabaseRuntimeBlocked: true,
    },
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => releaseReadiness as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.asyncStoreBoundary?.source, "releaseReadiness");
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.status, "present");
  assert.equal(status.asyncStoreBoundary?.classification, "single-node-sqlite");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
});

test("asyncStoreBoundary derives managed database runtime as blocked from runtime reports", () => {
  const runtimeGuard = {
    phase: "46",
    allowed: false,
    managedDatabaseRuntimeBlocked: true,
    status: "fail",
    classification: "managed-database-blocked",
    summary: "managed database runtime intent is blocked",
    checks: [],
    blockers: ["Remove managed database runtime intent before startup"],
    warnings: ["DATABASE_URL is advisory until runtime support lands"],
    nextSteps: ["Use single-node SQLite until the managed database adapter is ready"],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      bypassEnabled: false,
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
  } as unknown as ManagedDatabaseRuntimeGuardReport;
  const managedDatabaseTopology = {
    phase: "45",
    status: "fail",
    classification: "managed-database-requested",
    ready: false,
    summary: "managed database topology requested",
    checks: [],
    blockers: ["Managed database runtime unavailable"],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
    managedDatabase: { requested: true, configured: true, supported: false },
  } as unknown as ManagedDatabaseTopologyReport;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite", TASKLOOM_DATABASE_TOPOLOGY: "managed-database" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseTopologyReport: () => managedDatabaseTopology,
    buildManagedDatabaseRuntimeGuardReport: () => runtimeGuard,
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.asyncStoreBoundary?.source, "derived");
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.status, "blocked");
  assert.equal(status.asyncStoreBoundary?.classification, "managed-database-blocked");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.localRuntimeSupported, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
  assert.match(String(status.asyncStoreBoundary?.summary), /managed database runtime remains blocked/i);
});

test("managedPostgresCapability reports configured adapter/backfill and Phase 52 startup support", () => {
  const env = {
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env,
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.managedPostgresCapability.phase, "50");
  assert.equal(status.managedPostgresCapability.status, "available");
  assert.equal(status.managedPostgresCapability.provider, "postgres");
  assert.equal(status.managedPostgresCapability.adapterConfigured, true);
  assert.equal(status.managedPostgresCapability.adapterAvailable, true);
  assert.equal(status.managedPostgresCapability.backfillAvailable, true);
  assert.equal(status.managedPostgresCapability.managedIntentDetected, true);
  assert.equal(status.managedPostgresCapability.syncRuntimeGuarded, false);
  assert.equal(status.managedPostgresCapability.runtimeAllowed, true);
  assert.equal(status.managedPostgresCapability.adapter, "postgres");
  assert.deepEqual(status.managedPostgresCapability.configuredHintKeys, [
    "DATABASE_URL",
    "TASKLOOM_MANAGED_DATABASE_ADAPTER",
  ]);
  assert.ok(status.managedPostgresCapability.backfillCommands.includes("npm run db:backfill-activation-signals"));
  assert.match(status.managedPostgresCapability.summary, /configured and available/i);
  assert.equal(status.managedPostgresStartupSupport.phase, "52");
  assert.equal(status.managedPostgresStartupSupport.status, "supported");
  assert.equal(status.managedPostgresStartupSupport.startupSupported, true);
  assert.equal(status.managedPostgresStartupSupport.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.phase, "53");
  assert.equal(status.managedPostgresTopologyGate.status, "supported");
  assert.equal(status.managedPostgresTopologyGate.singleWriterManagedPostgresSupported, true);
  assert.equal(status.managedPostgresTopologyGate.multiWriterIntentDetected, false);
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.requirementsOnly, false);
  assert.equal(status.managedPostgresTopologyGate.implementationScope, "single-writer-managed-postgres");
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, true);
  assert.equal(status.asyncStoreBoundary?.phase52ManagedStartupSupported, true);
  assert.equal(status.managedDatabaseRuntimeGuard.allowed, true);
});

test("managedPostgresTopologyGate blocks multi-writer intent without changing Phase 52 startup support semantics", () => {
  const env = {
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env,
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.managedPostgresStartupSupport.phase, "52");
  assert.equal(status.managedPostgresStartupSupport.status, "multi-writer-unsupported");
  assert.equal(status.managedPostgresStartupSupport.startupSupported, false);
  assert.equal(status.managedPostgresStartupSupport.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.phase, "53");
  assert.equal(status.managedPostgresTopologyGate.status, "blocked");
  assert.equal(status.managedPostgresTopologyGate.topologyIntent, "active-active");
  assert.equal(status.managedPostgresTopologyGate.managedIntentDetected, true);
  assert.equal(status.managedPostgresTopologyGate.singleWriterManagedPostgresSupported, false);
  assert.equal(status.managedPostgresTopologyGate.multiWriterIntentDetected, true);
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.requirementsOnly, true);
  assert.equal(status.managedPostgresTopologyGate.implementationScope, "none");
  assert.match(status.managedPostgresTopologyGate.summary, /design intent only, not implementation support/i);
  assert.match(status.managedPostgresTopologyGate.summary, /multiWriterSupported=false/);
  assert.equal(status.multiWriterTopologyDesignPackageGate.phase, "54");
  assert.equal(status.multiWriterTopologyDesignPackageGate.status, "blocked");
  assert.equal(status.multiWriterTopologyDesignPackageGate.designPackageStatus, "incomplete");
  assert.equal(status.multiWriterTopologyDesignPackageGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.releaseAllowed, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.topologyIntent, "active-active");
  assert.equal(status.multiWriterTopologyDesignPackageGate.topologyOwner.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.consistencyModel.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.failoverPitr.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.migrationBackfill.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.observability.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.rollback.status, "missing");
  assert.match(status.multiWriterTopologyDesignPackageGate.summary, /runtimeSupported=false/);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.phase, "55");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.reviewStatus, "missing");
  assert.equal(
    status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorizationStatus,
    "missing",
  );
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.designPackageStatus, "incomplete");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.designPackageComplete, false);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorized, false);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeSupported, false);
  assert.match(status.multiWriterTopologyImplementationAuthorizationGate.summary, /runtimeSupported=false/);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationAuthorized, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
  assert.match(status.multiWriterTopologyImplementationReadinessGate.summary, /Phase 55 implementation authorization/i);
});

test("multiWriterTopologyDesignPackageGate reports a complete design package while runtime remains unsupported", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus idempotent async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterTopologyDesignPackageGate.phase, "54");
  assert.equal(status.multiWriterTopologyDesignPackageGate.required, true);
  assert.equal(status.multiWriterTopologyDesignPackageGate.status, "blocked");
  assert.equal(status.multiWriterTopologyDesignPackageGate.designPackageStatus, "complete");
  assert.equal(status.multiWriterTopologyDesignPackageGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.releaseAllowed, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.phase53RequirementsEvidenceAttached, true);
  assert.equal(status.multiWriterTopologyDesignPackageGate.phase53DesignEvidenceAttached, true);
  assert.equal(status.multiWriterTopologyDesignPackageGate.topologyOwner.status, "provided");
  assert.equal(status.multiWriterTopologyDesignPackageGate.topologyOwner.value, "platform-ops");
  assert.equal(status.multiWriterTopologyDesignPackageGate.consistencyModel.status, "provided");
  assert.equal(status.multiWriterTopologyDesignPackageGate.failoverPitr.status, "provided");
  assert.equal(status.multiWriterTopologyDesignPackageGate.migrationBackfill.status, "provided");
  assert.equal(status.multiWriterTopologyDesignPackageGate.observability.status, "provided");
  assert.equal(status.multiWriterTopologyDesignPackageGate.rollback.status, "provided");
  assert.deepEqual(status.multiWriterTopologyDesignPackageGate.missingEvidence, []);
  assert.match(status.multiWriterTopologyDesignPackageGate.summary, /runtime support remains unavailable/i);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.phase, "55");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.reviewStatus, "missing");
  assert.equal(
    status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorizationStatus,
    "missing",
  );
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.designPackageStatus, "complete");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.designPackageComplete, true);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorized, false);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeSupported, false);
  assert.equal(status.managedPostgresTopologyGate.status, "blocked");
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationAuthorized, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
});

test("multiWriterTopologyImplementationAuthorizationGate records review authorization without enabling runtime", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus idempotent async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "artifacts/phase55/design-package-review.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "artifacts/phase55/implementation-auth.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.phase, "55");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.status, "authorized");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.reviewStatus, "approved");
  assert.equal(
    status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorizationStatus,
    "authorized",
  );
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.designPackageComplete, true);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorized, true);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.releaseAllowed, false);
  assert.deepEqual(status.multiWriterTopologyImplementationAuthorizationGate.missingEvidence, []);
  assert.match(status.multiWriterTopologyImplementationAuthorizationGate.summary, /runtime implementation remains blocked/i);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationAuthorized, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
  assert.match(status.multiWriterTopologyImplementationReadinessGate.summary, /Phase 56/i);
});

test("multiWriterTopologyImplementationReadinessGate records readiness and rollout safety without enabling runtime", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus idempotent async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "artifacts/phase55/design-package-review.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "artifacts/phase55/implementation-auth.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "artifacts/phase56/implementation-readiness.md",
      TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "artifacts/phase56/rollout-safety.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.status, "evidence-complete");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessStatus, "complete");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyStatus, "complete");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationAuthorized, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessComplete, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyComplete, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.releaseAllowed, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadiness.status, "provided");
  assert.equal(
    status.multiWriterTopologyImplementationReadinessGate.implementationReadiness.value,
    "artifacts/phase56/implementation-readiness.md",
  );
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafety.status, "provided");
  assert.deepEqual(status.multiWriterTopologyImplementationReadinessGate.missingEvidence, []);
  assert.match(status.multiWriterTopologyImplementationReadinessGate.summary, /runtime implementation remains blocked/i);
  assert.match(status.multiWriterTopologyImplementationReadinessGate.summary, /runtimeSupported=false/);
});

test("multiWriterTopologyImplementationScope is blocked until Phase 56 evidence is complete", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "artifacts/phase57/implementation-scope-lock.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "artifacts/phase57/runtime-feature-flag.md",
      TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "artifacts/phase57/validation.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "artifacts/phase57/migration-cutover-lock.md",
      TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "artifacts/phase57/release-owner-signoff.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterTopologyImplementationScope.phase, "57");
  assert.equal(status.multiWriterTopologyImplementationScope.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScopeStatus, "blocked");
  assert.equal(status.multiWriterTopologyImplementationScope.phase56EvidenceComplete, false);
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScope.configured, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeFeatureFlag.configured, true);
  assert.equal(status.multiWriterTopologyImplementationScope.validationEvidence.configured, true);
  assert.equal(status.multiWriterTopologyImplementationScope.migrationCutoverLock.configured, true);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseOwnerSignoff.configured, true);
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScopeComplete, false);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseAllowed, false);
  assert.match(status.multiWriterTopologyImplementationScope.summary, /blocked until Phase 56/i);
});

test("multiWriterTopologyImplementationScope records scope evidence without enabling runtime", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase57Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterTopologyImplementationScope.phase, "57");
  assert.equal(status.multiWriterTopologyImplementationScope.status, "scope-complete");
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScopeStatus, "complete");
  assert.equal(status.multiWriterTopologyImplementationScope.phase56EvidenceComplete, true);
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScopeComplete, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseAllowed, false);
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScope.status, "provided");
  assert.equal(
    status.multiWriterTopologyImplementationScope.implementationScope.value,
    "artifacts/phase57/implementation-scope-lock.md",
  );
  assert.equal(status.multiWriterTopologyImplementationScope.evidence.runtimeFeatureFlag.status, "provided");
  assert.equal(status.multiWriterTopologyImplementationScope.validationEvidence.status, "provided");
  assert.equal(status.multiWriterTopologyImplementationScope.migrationCutoverLock.status, "provided");
  assert.equal(status.multiWriterTopologyImplementationScope.releaseOwnerSignoff.status, "provided");
  assert.deepEqual(status.multiWriterTopologyImplementationScope.missingEvidence, []);
  assert.match(status.multiWriterTopologyImplementationScope.summary, /runtime implementation remains blocked/i);
  assert.match(status.multiWriterTopologyImplementationScope.summary, /releaseAllowed=false/);
});

test("multiWriterTopologyImplementationScope can derive scope evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase56Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({
      phase57: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        implementationScopeLock: "artifacts/reports/phase57-scope-lock.md",
        runtimeFeatureFlag: "artifacts/reports/phase57-runtime-feature-flag.md",
        validationEvidence: "artifacts/reports/phase57-validation.md",
        migrationCutoverLock: "artifacts/reports/phase57-migration-cutover-lock.md",
        releaseOwnerSignoff: "artifacts/reports/phase57-release-owner-signoff.md",
      },
      checks: [],
      blockers: [],
      warnings: [],
      nextSteps: [],
    }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.multiWriterTopologyImplementationScope.status, "scope-complete");
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScope.source, "releaseReadiness");
  assert.equal(
    status.multiWriterTopologyImplementationScope.implementationScope.value,
    "artifacts/reports/phase57-scope-lock.md",
  );
  assert.equal(
    status.multiWriterTopologyImplementationScope.releaseOwnerSignoff.value,
    "artifacts/reports/phase57-release-owner-signoff.md",
  );
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseAllowed, false);
});

test("multiWriterRuntimeImplementationValidation is not required without multi-writer intent", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "not-required");
  assert.equal(status.multiWriterRuntimeImplementationValidation.validationStatus, "not-required");
  assert.equal(status.multiWriterRuntimeImplementationValidation.required, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.status, "not-required");
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
});

test("multiWriterRuntimeImplementationValidation is blocked until Phase 57 implementation scope is complete", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeMultiWriterPhase56Env(),
      TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "artifacts/phase58/runtime-implementation.md",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "artifacts/phase58/consistency-validation.md",
      TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "artifacts/phase58/failover-validation.md",
      TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "artifacts/phase58/data-integrity-validation.md",
      TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "artifacts/phase58/operations-runbook.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "artifacts/phase58/runtime-release-signoff.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "blocked");
  assert.equal(status.multiWriterRuntimeImplementationValidation.validationStatus, "blocked");
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase57ImplementationScopeComplete, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationValidationComplete, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.configured, true);
  assert.deepEqual(status.multiWriterRuntimeImplementationValidation.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeImplementationValidation.summary, /blocked until Phase 57/i);
});

test("multiWriterRuntimeImplementationValidation reports missing Phase 58 evidence", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase57Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "blocked");
  assert.equal(status.multiWriterRuntimeImplementationValidation.validationStatus, "missing");
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase57ImplementationScopeComplete, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationValidationComplete, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.status, "missing");
  assert.equal(status.multiWriterRuntimeImplementationValidation.operationsRunbook.status, "missing");
  assert.deepEqual(status.multiWriterRuntimeImplementationValidation.missingEvidence, [
    "runtimeImplementationEvidence",
    "consistencyValidationEvidence",
    "failoverValidationEvidence",
    "dataIntegrityValidationEvidence",
    "operationsRunbook",
    "runtimeReleaseSignoff",
  ]);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeImplementationValidation.summary, /blocked pending runtimeImplementationEvidence/i);
});

test("multiWriterRuntimeImplementationValidation records complete evidence without enabling runtime", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase58Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "validation-complete");
  assert.equal(status.multiWriterRuntimeImplementationValidation.validationStatus, "complete");
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase57ImplementationScopeComplete, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationValidationComplete, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.status, "provided");
  assert.equal(
    status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.value,
    "artifacts/phase58/runtime-implementation.md",
  );
  assert.equal(status.multiWriterRuntimeImplementationValidation.consistencyValidationEvidence.status, "provided");
  assert.equal(status.multiWriterRuntimeImplementationValidation.failoverValidationEvidence.status, "provided");
  assert.equal(status.multiWriterRuntimeImplementationValidation.dataIntegrityValidationEvidence.status, "provided");
  assert.equal(status.multiWriterRuntimeImplementationValidation.operationsRunbook.status, "provided");
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeReleaseSignoff.status, "provided");
  assert.deepEqual(status.multiWriterRuntimeImplementationValidation.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeImplementationValidation.summary, /runtime implementation remains blocked/i);
  assert.match(status.multiWriterRuntimeImplementationValidation.summary, /releaseAllowed=false/);
});

test("multiWriterRuntimeImplementationValidation can derive evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase57Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({
      phase58: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        runtimeImplementationEvidence: "artifacts/reports/phase58-runtime-implementation.md",
        consistencyValidationEvidence: "artifacts/reports/phase58-consistency-validation.md",
        failoverValidationEvidence: "artifacts/reports/phase58-failover-validation.md",
        dataIntegrityValidationEvidence: "artifacts/reports/phase58-data-integrity-validation.md",
        operationsRunbook: "artifacts/reports/phase58-operations-runbook.md",
        runtimeReleaseSignoff: "artifacts/reports/phase58-runtime-release-signoff.md",
      },
      checks: [],
      blockers: [],
      warnings: [],
      nextSteps: [],
    }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "validation-complete");
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.source, "releaseReadiness");
  assert.equal(
    status.multiWriterRuntimeImplementationValidation.runtimeImplementationEvidence.value,
    "artifacts/reports/phase58-runtime-implementation.md",
  );
  assert.equal(
    status.multiWriterRuntimeImplementationValidation.runtimeReleaseSignoff.value,
    "artifacts/reports/phase58-runtime-release-signoff.md",
  );
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
});

test("multiWriterRuntimeReleaseEnablementApproval is not required without multi-writer intent", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "not-required");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "not-required");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.required, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.status, "not-required");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
});

test("multiWriterRuntimeReleaseEnablementApproval is blocked until Phase 58 validation is complete", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeMultiWriterPhase57Env(),
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-release-gate-only",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "platform-release-owner",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW:
        "2026-05-02T02:00:00Z/2026-05-02T04:00:00Z",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF:
        "artifacts/phase59/monitoring-signoff.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "artifacts/phase59/abort-plan.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "TASKLOOM-59",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "blocked");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "blocked");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase58RuntimeValidationComplete, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseEnablementApprovalComplete, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.configured, true);
  assert.deepEqual(status.multiWriterRuntimeReleaseEnablementApproval.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeReleaseEnablementApproval.summary, /blocked until Phase 58/i);
});

test("multiWriterRuntimeReleaseEnablementApproval reports missing Phase 59 approval evidence", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase58Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "blocked");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "missing");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase58RuntimeValidationComplete, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseEnablementApprovalComplete, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.status, "missing");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseTicket.status, "missing");
  assert.deepEqual(status.multiWriterRuntimeReleaseEnablementApproval.missingEvidence, [
    "enablementDecision",
    "approver",
    "rolloutWindow",
    "monitoringSignoff",
    "abortPlan",
    "releaseTicket",
  ]);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeReleaseEnablementApproval.summary, /blocked pending enablementDecision/i);
});

test("multiWriterRuntimeReleaseEnablementApproval records complete approval evidence without enabling runtime", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase59Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "approval-complete");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "complete");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase58RuntimeValidationComplete, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseEnablementApprovalComplete, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.status, "provided");
  assert.equal(
    status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.value,
    "approved-for-release-gate-only",
  );
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approver.status, "provided");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.rolloutWindow.status, "provided");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.monitoringSignoff.status, "provided");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.abortPlan.status, "provided");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseTicket.status, "provided");
  assert.deepEqual(status.multiWriterRuntimeReleaseEnablementApproval.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeReleaseEnablementApproval.summary, /visible for approval audit/i);
  assert.match(status.multiWriterRuntimeReleaseEnablementApproval.summary, /runtimeSupported=false/);
  assert.match(status.multiWriterRuntimeReleaseEnablementApproval.summary, /releaseAllowed=false/);
});

test("multiWriterRuntimeReleaseEnablementApproval can derive evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase58Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseEvidenceBundle: () => ({
      phase59: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        enablementDecision: "report-approved-for-release-gate-only",
        approver: "release-owner-from-report",
        rolloutWindow: "2026-05-02T02:00:00Z/2026-05-02T04:00:00Z",
        monitoringSignoff: "artifacts/reports/phase59-monitoring-signoff.md",
        abortPlan: "artifacts/reports/phase59-abort-plan.md",
        releaseTicket: "TASKLOOM-59",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "approval-complete");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.source, "releaseEvidence");
  assert.equal(
    status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.value,
    "report-approved-for-release-gate-only",
  );
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
});

test("multiWriterRuntimeSupportPresenceAssertion is not required without multi-writer intent", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "not-required");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "not-required");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.required, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.status, "not-required");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
});

test("multiWriterRuntimeSupportPresenceAssertion is blocked until Phase 59 approval is complete", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeMultiWriterPhase58Env(),
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "artifacts/phase60/implementation-present.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT:
        "artifacts/phase60/explicit-support-statement.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "artifacts/phase60/compatibility-matrix.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "artifacts/phase60/cutover-evidence.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL:
        "artifacts/phase60/release-automation-approval.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "artifacts/phase60/owner-acceptance.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "blocked");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "blocked");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase59ReleaseEnablementApprovalComplete, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupportPresenceAssertionComplete, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.configured, true);
  assert.deepEqual(status.multiWriterRuntimeSupportPresenceAssertion.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeSupportPresenceAssertion.summary, /blocked until Phase 59/i);
});

test("multiWriterRuntimeSupportPresenceAssertion reports missing Phase 60 support evidence", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase59Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "blocked");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "missing");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase59ReleaseEnablementApprovalComplete, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupportPresenceAssertionComplete, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.status, "missing");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.ownerAcceptance.status, "missing");
  assert.deepEqual(status.multiWriterRuntimeSupportPresenceAssertion.missingEvidence, [
    "implementationPresent",
    "explicitSupportStatement",
    "compatibilityMatrix",
    "cutoverEvidence",
    "releaseAutomationApproval",
    "ownerAcceptance",
  ]);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeSupportPresenceAssertion.summary, /blocked pending implementationPresent/i);
});

test("multiWriterRuntimeSupportPresenceAssertion records complete evidence without enabling runtime release", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase60Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "assertion-complete");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "complete");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase59ReleaseEnablementApprovalComplete, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.status, "provided");
  assert.equal(
    status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.value,
    "artifacts/phase60/implementation-present.md",
  );
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.explicitSupportStatement.status, "provided");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.compatibilityMatrix.status, "provided");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.cutoverEvidence.status, "provided");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAutomationApproval.status, "provided");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.ownerAcceptance.status, "provided");
  assert.deepEqual(status.multiWriterRuntimeSupportPresenceAssertion.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeSupportPresenceAssertion.summary, /visible for support audit/i);
  assert.match(status.multiWriterRuntimeSupportPresenceAssertion.summary, /runtimeSupported=false/);
  assert.match(status.multiWriterRuntimeSupportPresenceAssertion.summary, /releaseAllowed=false/);
});

test("multiWriterRuntimeSupportPresenceAssertion can derive evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase59Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseEvidenceBundle: () => ({
      phase60: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        implementationPresent: "artifacts/reports/phase60-implementation-present.md",
        explicitSupportStatement: "artifacts/reports/phase60-explicit-support-statement.md",
        compatibilityMatrix: "artifacts/reports/phase60-compatibility-matrix.md",
        cutoverEvidence: "artifacts/reports/phase60-cutover-evidence.md",
        releaseAutomationApproval: "artifacts/reports/phase60-release-automation-approval.md",
        ownerAcceptance: "artifacts/reports/phase60-owner-acceptance.md",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "assertion-complete");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.source, "releaseEvidence");
  assert.equal(
    status.multiWriterRuntimeSupportPresenceAssertion.implementationPresent.value,
    "artifacts/reports/phase60-implementation-present.md",
  );
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
});

test("multiWriterRuntimeActivationControls is not required without multi-writer intent", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeActivationControls.phase, "61");
  assert.equal(status.multiWriterRuntimeActivationControls.status, "not-required");
  assert.equal(status.multiWriterRuntimeActivationControls.activationControlStatus, "not-required");
  assert.equal(status.multiWriterRuntimeActivationControls.required, false);
  assert.equal(status.multiWriterRuntimeActivationControls.activationDecision.status, "not-required");
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAllowed, false);
});

test("multiWriterRuntimeActivationControls is blocked until Phase 60 support presence assertion is complete", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeMultiWriterPhase59Env(),
      TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "approved-for-activation-audit-only",
      TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "platform-activation-owner",
      TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-03T02:00:00Z/2026-05-03T04:00:00Z",
      TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER=false",
      TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION:
        "artifacts/phase61/release-automation-assertion.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeActivationControls.phase, "61");
  assert.equal(status.multiWriterRuntimeActivationControls.status, "blocked");
  assert.equal(status.multiWriterRuntimeActivationControls.activationControlStatus, "blocked");
  assert.equal(status.multiWriterRuntimeActivationControls.phase60RuntimeSupportPresenceAssertionComplete, false);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeActivationControlsComplete, false);
  assert.equal(status.multiWriterRuntimeActivationControls.activationDecision.configured, true);
  assert.deepEqual(status.multiWriterRuntimeActivationControls.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeActivationControls.summary, /blocked until Phase 60/i);
});

test("multiWriterRuntimeActivationControls reports missing Phase 61 controls", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase60Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeActivationControls.phase, "61");
  assert.equal(status.multiWriterRuntimeActivationControls.status, "blocked");
  assert.equal(status.multiWriterRuntimeActivationControls.activationControlStatus, "missing");
  assert.equal(status.multiWriterRuntimeActivationControls.phase60RuntimeSupportPresenceAssertionComplete, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeActivationControlsComplete, false);
  assert.equal(status.multiWriterRuntimeActivationControls.activationDecision.status, "missing");
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAutomationAssertion.status, "missing");
  assert.deepEqual(status.multiWriterRuntimeActivationControls.missingEvidence, [
    "activationDecision",
    "activationOwner",
    "activationWindow",
    "activationFlag",
    "releaseAutomationAssertion",
  ]);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeActivationControls.summary, /blocked pending activationDecision/i);
});

test("multiWriterRuntimeActivationControls records complete controls without enabling runtime release", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase61Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.multiWriterRuntimeActivationControls.phase, "61");
  assert.equal(status.multiWriterRuntimeActivationControls.status, "activation-controls-complete");
  assert.equal(status.multiWriterRuntimeActivationControls.activationControlStatus, "complete");
  assert.equal(status.multiWriterRuntimeActivationControls.phase60RuntimeSupportPresenceAssertionComplete, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeActivationControlsComplete, true);
  assert.equal(status.multiWriterRuntimeActivationControls.activationDecision.status, "provided");
  assert.equal(
    status.multiWriterRuntimeActivationControls.activationDecision.value,
    "approved-for-activation-audit-only",
  );
  assert.equal(status.multiWriterRuntimeActivationControls.activationOwner.status, "provided");
  assert.equal(status.multiWriterRuntimeActivationControls.activationWindow.status, "provided");
  assert.equal(status.multiWriterRuntimeActivationControls.activationFlag.status, "provided");
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAutomationAssertion.status, "provided");
  assert.deepEqual(status.multiWriterRuntimeActivationControls.missingEvidence, []);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeActivationControls.summary, /activation audit/i);
  assert.match(status.multiWriterRuntimeActivationControls.summary, /distributed, active-active, regional\/PITR, and SQLite-distributed runtime support remain unsupported/i);
});

test("multiWriterRuntimeActivationControls can derive controls from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeMultiWriterPhase60Env(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseEvidenceBundle: () => ({
      phase61: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        activationDecision: "report-approved-for-activation-audit-only",
        activationOwner: "report-activation-owner",
        activationWindow: "2026-05-03T02:00:00Z/2026-05-03T04:00:00Z",
        activationFlag: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER=false",
        releaseAutomationAssertion: "artifacts/reports/phase61-release-automation-assertion.md",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.multiWriterRuntimeActivationControls.status, "activation-controls-complete");
  assert.equal(status.multiWriterRuntimeActivationControls.activationDecision.source, "releaseEvidence");
  assert.equal(
    status.multiWriterRuntimeActivationControls.activationDecision.value,
    "report-approved-for-activation-audit-only",
  );
  assert.equal(status.multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeActivationControls.releaseAllowed, false);
});

test("managedPostgresHorizontalWriterConcurrency is not configured without horizontal app-writer intent", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.managedPostgresHorizontalWriterConcurrency.phase, "62");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.status, "not-configured");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.hardeningStatus, "not-configured");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.required, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.horizontalAppWritersSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.multiWriterDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.activeActiveDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.regionalDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.pitrRuntimeSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.sqliteDistributedSupported, false);
});

test("managedPostgresHorizontalWriterConcurrency reports missing Phase 62 evidence", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresHorizontalWriterConcurrency.phase, "62");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.status, "blocked");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.hardeningStatus, "missing");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.horizontalAppWriterIntentDetected, true);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.managedPostgresStartupSupported, true);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.supportedManagedPostgresTopology, true);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.writePathAudit.status, "missing");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.releaseAssertion.status, "missing");
  assert.deepEqual(status.managedPostgresHorizontalWriterConcurrency.missingEvidence, [
    "writePathAudit",
    "concurrentWriterTests",
    "concurrencyControl",
    "transactionRetry",
    "releaseAssertion",
  ]);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.horizontalAppWritersSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.activeActiveDatabaseSupported, false);
  assert.match(status.managedPostgresHorizontalWriterConcurrency.summary, /blocked pending writePathAudit/i);
});

test("managedPostgresHorizontalWriterConcurrency supports horizontal app writers without database multi-writer support", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeManagedPostgresHorizontalWriterEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresHorizontalWriterConcurrency.phase, "62");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.status, "hardening-complete");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.hardeningStatus, "complete");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.managedPostgresHorizontalWriterHardeningComplete, true);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.horizontalAppWritersSupported, true);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.multiWriterDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.activeActiveDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.regionalDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.pitrRuntimeSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.releaseAllowed, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.writePathAudit.status, "provided");
  assert.equal(
    status.managedPostgresHorizontalWriterConcurrency.concurrencyControl.value,
    "row-version compare-and-swap on document updates",
  );
  assert.match(status.managedPostgresHorizontalWriterConcurrency.summary, /multiple Taskloom app processes/i);
  assert.match(status.managedPostgresHorizontalWriterConcurrency.summary, /multi-writer database support remain unsupported/i);
});

test("managedPostgresHorizontalWriterConcurrency accepts canonical Phase 62 release evidence env keys", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
        "artifacts/phase62/horizontal-writer-hardening.md",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
        "artifacts/phase62/concurrency-tests.tap",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
        "artifacts/phase62/transaction-retry.md",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresHorizontalWriterConcurrency.status, "hardening-complete");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.writePathAudit.source, "env");
  assert.equal(
    status.managedPostgresHorizontalWriterConcurrency.concurrentWriterTests.value,
    "artifacts/phase62/concurrency-tests.tap",
  );
  assert.equal(
    status.managedPostgresHorizontalWriterConcurrency.transactionRetry.value,
    "artifacts/phase62/transaction-retry.md",
  );
  assert.deepEqual(status.managedPostgresHorizontalWriterConcurrency.missingEvidence, []);
});

test("managedPostgresHorizontalWriterConcurrency can derive Phase 62 evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({
      phase62: {
        horizontalAppWriterIntentDetected: true,
        managedPostgresIntentDetected: true,
        managedPostgresStartupSupported: true,
        supportedManagedPostgresTopology: true,
        writePathAudit: "artifacts/reports/phase62-audit.md",
        concurrentWriterTests: "artifacts/reports/phase62-concurrency-tests.tap",
        concurrencyControl: "row-version cas",
        transactionRetry: "serializable retry evidence",
        releaseAssertion: "artifacts/reports/phase62-release-assertion.md",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.managedPostgresHorizontalWriterConcurrency.status, "hardening-complete");
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.writePathAudit.source, "releaseEvidence");
  assert.equal(
    status.managedPostgresHorizontalWriterConcurrency.writePathAudit.value,
    "artifacts/reports/phase62-audit.md",
  );
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.horizontalAppWritersSupported, true);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.multiWriterDatabaseSupported, false);
  assert.equal(status.managedPostgresHorizontalWriterConcurrency.releaseAllowed, false);
});

test("distributedDependencyEnforcement surfaces local-only and missing dependencies after horizontal writer hardening", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeManagedPostgresHorizontalWriterEnv(),
      TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
      TASKLOOM_SCHEDULER_LEADER_MODE: "file",
      TASKLOOM_ACCESS_LOG_MODE: "file",
      TASKLOOM_ACCESS_LOG_PATH: "data/access.log",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });
  const dependencies = distributedDependencyStatus(status);

  assert.equal(dependencies.phase, "63");
  assert.equal(dependencies.required, true);
  assert.equal(dependencies.status, "blocked");
  assert.equal(dependencies.enforcementStatus, "blocked");
  assert.equal(dependencies.strictActivationBlocked, true);
  assert.equal(dependencies.strictActivationAllowed, false);
  assert.equal(dependencies.dependencies.schedulerCoordination.status, "blocked");
  assert.equal(dependencies.dependencies.accessLogShipping.status, "blocked");
  assert.ok(dependencies.localOnlyDependencies.includes("distributedRateLimiting"));
  assert.ok(dependencies.localOnlyDependencies.includes("schedulerCoordination"));
  assert.ok(dependencies.localOnlyDependencies.includes("accessLogShipping"));
  assert.ok(dependencies.localOnlyDependencies.includes("alertDelivery"));
  assert.ok(dependencies.localOnlyDependencies.includes("healthMonitoring"));
});

test("distributedDependencyEnforcement reports activation allowed only when all six dependencies are production-safe", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeDistributedDependencyEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });
  const dependencies = distributedDependencyStatus(status);

  assert.equal(dependencies.phase, "63");
  assert.equal(dependencies.required, true);
  assert.equal(dependencies.status, "dependencies-ready");
  assert.equal(dependencies.enforcementStatus, "ready");
  assert.deepEqual(dependencies.localOnlyDependencies, []);
  assert.equal(
    Object.values(dependencies.dependencies).every((entry) => entry.productionSafe && entry.status === "ready"),
    true,
  );
  assert.equal(dependencies.strictActivationBlocked, false);
  assert.equal(dependencies.strictActivationAllowed, true);
});

test("managedPostgresRecoveryValidation blocks activation when Phase 64 evidence is missing after Phase 63", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeDistributedDependencyEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresRecoveryValidation.phase, "64");
  assert.equal(status.managedPostgresRecoveryValidation.required, true);
  assert.equal(status.managedPostgresRecoveryValidation.phase63DistributedDependenciesReady, true);
  assert.equal(status.managedPostgresRecoveryValidation.status, "blocked");
  assert.equal(status.managedPostgresRecoveryValidation.validationStatus, "missing");
  assert.deepEqual(status.managedPostgresRecoveryValidation.missingEvidence, [
    "backupRestore",
    "pitrRehearsal",
    "failoverRehearsal",
    "dataIntegrityValidation",
    "recoveryTimeExpectations",
  ]);
  assert.equal(status.managedPostgresRecoveryValidation.backupRestore.status, "missing");
  assert.equal(status.managedPostgresRecoveryValidation.activationAllowed, false);
  assert.equal(status.managedPostgresRecoveryValidation.strictActivationBlocked, true);
  assert.equal(status.managedPostgresRecoveryValidation.activeActiveDatabaseSupported, false);
  assert.equal(status.managedPostgresRecoveryValidation.regionalRuntimeSupported, false);
  assert.equal(status.managedPostgresRecoveryValidation.pitrRuntimeSupported, false);
  assert.match(status.managedPostgresRecoveryValidation.summary, /blocks activation/i);
});

test("managedPostgresRecoveryValidation validates backup restore PITR failover integrity and recovery-time evidence", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeRecoveryValidationEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresRecoveryValidation.phase, "64");
  assert.equal(status.managedPostgresRecoveryValidation.status, "recovery-validated");
  assert.equal(status.managedPostgresRecoveryValidation.validationStatus, "complete");
  assert.equal(status.managedPostgresRecoveryValidation.recoveryValidationComplete, true);
  assert.equal(status.managedPostgresRecoveryValidation.managedPostgresRecoveryValidated, true);
  assert.equal(status.managedPostgresRecoveryValidation.providerOwnedHaPitrValidated, true);
  assert.deepEqual(status.managedPostgresRecoveryValidation.missingEvidence, []);
  assert.equal(status.managedPostgresRecoveryValidation.backupRestore.source, "env");
  assert.equal(
    status.managedPostgresRecoveryValidation.recoveryTimeExpectations.value,
    "RTO<=15m RPO<=5m validated in phase64 rehearsal",
  );
  assert.equal(status.managedPostgresRecoveryValidation.activationAllowed, true);
  assert.equal(status.managedPostgresRecoveryValidation.strictActivationAllowed, true);
  assert.equal(status.managedPostgresRecoveryValidation.releaseAllowed, false);
  assert.equal(status.managedPostgresRecoveryValidation.activeActiveDatabaseSupported, false);
  assert.equal(status.managedPostgresRecoveryValidation.regionalRuntimeSupported, false);
  assert.equal(status.managedPostgresRecoveryValidation.pitrRuntimeSupported, false);
});

test("managedPostgresRecoveryValidation can derive Phase 64 evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeDistributedDependencyEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({
      phase64: {
        required: true,
        backupRestore: "artifacts/reports/phase64-backup-restore.md",
        pitrRehearsal: "artifacts/reports/phase64-pitr.md",
        failoverRehearsal: "artifacts/reports/phase64-failover.md",
        dataIntegrityValidation: "artifacts/reports/phase64-integrity.md",
        recoveryTimeExpectations: "RTO<=15m RPO<=5m",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.managedPostgresRecoveryValidation.status, "recovery-validated");
  assert.equal(status.managedPostgresRecoveryValidation.backupRestore.source, "releaseEvidence");
  assert.equal(
    status.managedPostgresRecoveryValidation.backupRestore.value,
    "artifacts/reports/phase64-backup-restore.md",
  );
  assert.equal(status.managedPostgresRecoveryValidation.activationAllowed, true);
  assert.equal(status.managedPostgresRecoveryValidation.releaseAllowed, false);
});

test("managedPostgresCutoverAutomation blocks activation when Phase 65 evidence is missing after recovery validation", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeRecoveryValidationEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresCutoverAutomation.phase, "65");
  assert.equal(status.managedPostgresCutoverAutomation.required, true);
  assert.equal(status.managedPostgresCutoverAutomation.phase64RecoveryValidated, true);
  assert.equal(status.managedPostgresCutoverAutomation.status, "blocked");
  assert.equal(status.managedPostgresCutoverAutomation.automationStatus, "blocked");
  assert.deepEqual(status.managedPostgresCutoverAutomation.missingEvidence, [
    "cutoverPreflight",
    "activationDryRun",
    "postActivationSmoke",
    "rollbackCommandGuidance",
    "monitoringThresholds",
  ]);
  assert.equal(status.managedPostgresCutoverAutomation.activationBlocked, true);
  assert.equal(status.managedPostgresCutoverAutomation.activationAllowed, false);
  assert.match(status.managedPostgresCutoverAutomation.summary, /blocks activation/i);
});

test("managedPostgresCutoverAutomation blocks activation when preflight fails", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeCutoverAutomationEnv(),
      TASKLOOM_MANAGED_POSTGRES_CUTOVER_PREFLIGHT_STATUS: "failed",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresCutoverAutomation.status, "blocked");
  assert.equal(status.managedPostgresCutoverAutomation.automationStatus, "preflight-failed");
  assert.equal(status.managedPostgresCutoverAutomation.cutoverPreflight.status, "failed");
  assert.deepEqual(status.managedPostgresCutoverAutomation.failedChecks, ["cutoverPreflight"]);
  assert.equal(status.managedPostgresCutoverAutomation.cutoverPreflightFailed, true);
  assert.equal(status.managedPostgresCutoverAutomation.activationAllowed, false);
  assert.equal(status.managedPostgresCutoverAutomation.rollbackRequired, false);
});

test("managedPostgresCutoverAutomation marks rollback required when smoke checks fail", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeCutoverAutomationEnv(),
      TASKLOOM_MANAGED_POSTGRES_POST_ACTIVATION_SMOKE_STATUS: "failed",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresCutoverAutomation.status, "rollback-required");
  assert.equal(status.managedPostgresCutoverAutomation.automationStatus, "smoke-failed");
  assert.equal(status.managedPostgresCutoverAutomation.postActivationSmoke.status, "failed");
  assert.deepEqual(status.managedPostgresCutoverAutomation.failedChecks, ["postActivationSmoke"]);
  assert.equal(status.managedPostgresCutoverAutomation.postActivationSmokeFailed, true);
  assert.equal(status.managedPostgresCutoverAutomation.rollbackRequired, true);
  assert.equal(status.managedPostgresCutoverAutomation.priorSafePostureRequired, true);
  assert.equal(status.managedPostgresCutoverAutomation.activationAllowed, false);
  assert.match(status.managedPostgresCutoverAutomation.summary, /prior safe posture/i);
});

test("managedPostgresCutoverAutomation is ready when all Phase 65 inputs are present", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeCutoverAutomationEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.managedPostgresCutoverAutomation.status, "ready");
  assert.equal(status.managedPostgresCutoverAutomation.automationStatus, "ready");
  assert.equal(status.managedPostgresCutoverAutomation.cutoverAutomationReady, true);
  assert.equal(status.managedPostgresCutoverAutomation.cutoverPreflightPassed, true);
  assert.equal(status.managedPostgresCutoverAutomation.activationDryRunPassed, true);
  assert.equal(status.managedPostgresCutoverAutomation.postActivationSmokePassed, true);
  assert.deepEqual(status.managedPostgresCutoverAutomation.missingEvidence, []);
  assert.deepEqual(status.managedPostgresCutoverAutomation.failedChecks, []);
  assert.equal(status.managedPostgresCutoverAutomation.rollbackCommandGuidance.source, "env");
  assert.equal(status.managedPostgresCutoverAutomation.activationBlocked, false);
  assert.equal(status.managedPostgresCutoverAutomation.activationAllowed, true);
  assert.equal(status.managedPostgresCutoverAutomation.releaseAllowed, false);
});

test("managedPostgresCutoverAutomation can derive Phase 65 evidence from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeRecoveryValidationEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({
      phase65: {
        required: true,
        cutoverPreflight: "artifacts/reports/phase65-preflight.json",
        cutoverPreflightStatus: "passed",
        activationDryRun: "artifacts/reports/phase65-dry-run.json",
        activationDryRunStatus: "passed",
        postActivationSmoke: "artifacts/reports/phase65-smoke.json",
        postActivationSmokeStatus: "passed",
        rollbackCommandGuidance: "npm run deployment:managed-postgres:rollback",
        monitoringThresholds: "error_rate<1%; db_connections<80%",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.managedPostgresCutoverAutomation.status, "ready");
  assert.equal(status.managedPostgresCutoverAutomation.cutoverPreflight.source, "releaseEvidence");
  assert.equal(
    status.managedPostgresCutoverAutomation.cutoverPreflight.value,
    "artifacts/reports/phase65-preflight.json",
  );
  assert.equal(status.managedPostgresCutoverAutomation.activationAllowed, true);
});

test("finalReleaseClosure blocks release when Phase 66 evidence is missing after cutover readiness", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeCutoverAutomationEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.finalReleaseClosure.phase, "66");
  assert.equal(status.finalReleaseClosure.required, true);
  assert.equal(status.finalReleaseClosure.phase65CutoverReady, true);
  assert.equal(status.finalReleaseClosure.status, "blocked");
  assert.equal(status.finalReleaseClosure.closureStatus, "blocked");
  assert.equal(status.finalReleaseClosure.finalReleaseReady, false);
  assert.equal(status.finalReleaseClosure.releaseAllowed, false);
  assert.deepEqual(status.finalReleaseClosure.missingEvidence, [
    "supportedProductionTopology",
    "unsupportedTopologyBoundaries",
    "finalReleaseChecklist",
    "validationRun",
    "deploymentCliChecks",
    "docsConsistencyChecks",
    "documentationFreeze",
    "noHiddenPhaseAssertion",
    "releaseApproval",
  ]);
});

test("finalReleaseClosure is ready when Phase 66 inputs are complete", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeFinalReleaseClosureEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.finalReleaseClosure.status, "ready");
  assert.equal(status.finalReleaseClosure.closureStatus, "ready");
  assert.equal(status.finalReleaseClosure.finalReleaseReady, true);
  assert.equal(status.finalReleaseClosure.documentationFrozen, true);
  assert.equal(status.finalReleaseClosure.releaseAllowed, true);
  assert.deepEqual(status.finalReleaseClosure.missingEvidence, []);
  assert.deepEqual(status.finalReleaseClosure.failedChecks, []);
  assert.equal(status.finalReleaseClosure.supportedProductionTopology.source, "env");
  assert.match(status.finalReleaseClosure.summary, /releaseAllowed=true/i);
});

test("finalReleaseClosure fails closed when a Phase 66 check reports failure", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      ...completeFinalReleaseClosureEnv(),
      TASKLOOM_PHASE66_DOCS_CONSISTENCY_STATUS: "failed",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.finalReleaseClosure.status, "failed");
  assert.equal(status.finalReleaseClosure.closureStatus, "failed");
  assert.equal(status.finalReleaseClosure.docsConsistencyChecks.status, "failed");
  assert.deepEqual(status.finalReleaseClosure.failedChecks, ["docsConsistencyChecks"]);
  assert.equal(status.finalReleaseClosure.finalReleaseReady, false);
  assert.equal(status.finalReleaseClosure.documentationFrozen, false);
  assert.equal(status.finalReleaseClosure.releaseAllowed, false);
});

test("finalReleaseClosure can derive Phase 66 readiness from deployment reports", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: completeCutoverAutomationEnv(),
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({
      phase66: {
        required: true,
        finalReleaseClosureReady: true,
        supportedProductionTopology: "reports/phase66/supported-topology.md",
        unsupportedTopologyBoundaries: "reports/phase66/unsupported-boundaries.md",
        finalReleaseChecklist: "reports/phase66/checklist.md",
        validationRun: "reports/phase66/validation.json",
        deploymentCliChecks: "reports/phase66/deployment-cli.json",
        docsConsistencyChecks: "reports/phase66/docs-consistency.md",
        documentationFreeze: "reports/phase66/docs-freeze.md",
        noHiddenPhaseAssertion: "reports/phase66/no-hidden-phase.md",
        releaseApproval: "TASKLOOM-66",
      },
      includedEvidence: [],
      attachments: [],
    }) as never,
  });

  assert.equal(status.finalReleaseClosure.status, "ready");
  assert.equal(status.finalReleaseClosure.supportedProductionTopology.source, "releaseEvidence");
  assert.equal(
    status.finalReleaseClosure.supportedProductionTopology.value,
    "reports/phase66/supported-topology.md",
  );
  assert.equal(status.finalReleaseClosure.releaseAllowed, true);
});

test("releaseReadiness is built from the injected environment", () => {
  const fixture = {
    readyForRelease: false,
    status: "blocked",
    summary: "release readiness blocked by missing confirmation",
    checks: [
      { id: "release-confirmed", status: "blocked", detail: "Release confirmation is missing" },
      { id: "storage-topology", status: "ready", detail: "Storage topology classified" },
    ],
    blockers: ["Confirm release owner sign-off"],
    warnings: [],
    nextSteps: ["Record release confirmation before handoff"],
  };
  let observedNodeEnv: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { NODE_ENV: "production" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: (env) => {
      observedNodeEnv = env.NODE_ENV;
      return fixture as never;
    },
  });

  assert.equal(observedNodeEnv, "production");
  assert.deepEqual(status.releaseReadiness, fixture);
});

test("releaseEvidence is built from the injected environment", () => {
  const fixture = {
    generatedAt: "2026-04-26T12:00:00.000Z",
    readyForRelease: true,
    status: "ready",
    summary: "release evidence bundle includes handoff checks",
    includedEvidence: [
      { id: "readiness", title: "Release readiness", status: "pass" },
      { id: "storage", title: "Storage topology", status: "pass" },
    ],
    attachments: [
      { id: "handoff", name: "release-handoff.json", path: "artifacts/release-handoff.json" },
    ],
  };
  let observedPhase: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_RELEASE_PHASE: "44" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseEvidenceBundle: (env) => {
      observedPhase = env.TASKLOOM_RELEASE_PHASE;
      return fixture as never;
    },
  });

  assert.equal(observedPhase, "44");
  assert.deepEqual(status.releaseEvidence, fixture);
});

test("release readiness and evidence receive the already-built managed reports", () => {
  const storageTopology = {
    readyForProduction: true,
    status: "ready",
    summary: "single-node sqlite storage ready",
  } as unknown as StorageTopologyReport;
  const managedDatabaseTopology: ManagedDatabaseTopologyReport = {
    phase: "45",
    status: "pass",
    classification: "single-node-sqlite",
    ready: true,
    summary: "managed database topology handoff captured",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
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
  const managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport = {
    phase: "46",
    allowed: true,
    status: "pass",
    classification: "single-node-sqlite",
    summary: "runtime guard allows single-node sqlite",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
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
  };
  const releaseReadiness = {
    readyForRelease: true,
    status: "ready",
    summary: "release readiness includes managed handoff",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  };
  const releaseEvidence = {
    generatedAt: "2026-04-26T12:00:00.000Z",
    readyForRelease: true,
    status: "ready",
    summary: "release evidence includes managed handoff",
    includedEvidence: [],
    attachments: [],
    storageTopology,
    releaseReadiness,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildStorageTopologyReport: () => storageTopology,
    buildManagedDatabaseTopologyReport: () => managedDatabaseTopology,
    buildManagedDatabaseRuntimeGuardReport: () => managedDatabaseRuntimeGuard,
    buildReleaseReadinessReport: (_env, deps) => {
      assert.equal(deps?.storageTopology, storageTopology);
      assert.equal(deps?.managedDatabaseTopology, managedDatabaseTopology);
      assert.equal(deps?.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
      return releaseReadiness as never;
    },
    buildReleaseEvidenceBundle: (_env, deps) => {
      assert.equal(deps?.storageTopology, storageTopology);
      assert.equal(deps?.managedDatabaseTopology, managedDatabaseTopology);
      assert.equal(deps?.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
      assert.equal(deps?.releaseReadiness, releaseReadiness);
      return releaseEvidence as never;
    },
  });

  assert.equal(status.storageTopology, storageTopology);
  assert.equal(status.managedDatabaseTopology, managedDatabaseTopology);
  assert.equal(status.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
  assert.equal(status.releaseReadiness, releaseReadiness);
  assert.equal(status.releaseEvidence, releaseEvidence);
});

test("generatedAt reflects the injected now", () => {
  const fixedDate = new Date("2026-04-26T13:37:00.000Z");
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => fixedDate,
  });

  assert.equal(status.generatedAt, "2026-04-26T13:37:00.000Z");
});

test("jobMetrics defaults to an empty array when the fixture returns none", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    jobTypeMetrics: () => [],
  });

  assert.deepEqual(status.jobMetrics, []);
});

test("jobMetrics fixture appears verbatim in the result", () => {
  const fixture: JobTypeMetrics[] = [
    {
      type: "agent.run",
      totalRuns: 3,
      succeededRuns: 2,
      failedRuns: 1,
      canceledRuns: 0,
      lastRunStartedAt: "2026-04-26T11:59:00.000Z",
      lastRunFinishedAt: "2026-04-26T11:59:30.000Z",
      lastDurationMs: 30000,
      averageDurationMs: 25000,
      p95DurationMs: 29000,
    },
  ];
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    jobTypeMetrics: () => fixture,
  });

  assert.deepEqual(status.jobMetrics, fixture);
});

test("jobMetricsSnapshots reports zero and null when the store has no snapshots", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.deepEqual(status.jobMetricsSnapshots, { total: 0, lastCapturedAt: null });
});

test("jobMetricsSnapshots picks the max capturedAt across out-of-order rows", () => {
  const store = {
    jobs: [],
    jobMetricSnapshots: [
      { id: "s1", capturedAt: "2026-01-01T00:00:00.000Z", type: "agent.run" },
      { id: "s2", capturedAt: "2026-01-03T00:00:00.000Z", type: "agent.run" },
      { id: "s3", capturedAt: "2026-01-02T00:00:00.000Z", type: "agent.run" },
    ],
  } as unknown as TaskloomData;

  const status = getOperationsStatus({
    loadStore: () => store,
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.jobMetricsSnapshots.total, 3);
  assert.equal(status.jobMetricsSnapshots.lastCapturedAt, "2026-01-03T00:00:00.000Z");
});

test("jobMetricsSnapshots falls back to null when the only row has an unparseable capturedAt", () => {
  const store = {
    jobs: [],
    jobMetricSnapshots: [
      { id: "s1", capturedAt: "not-a-date", type: "agent.run" },
    ],
  } as unknown as TaskloomData;

  const status = getOperationsStatus({
    loadStore: () => store,
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.jobMetricsSnapshots.total, 1);
  assert.equal(status.jobMetricsSnapshots.lastCapturedAt, null);
});

test("jobMetrics preserves the order returned by the fixture", () => {
  const fixture: JobTypeMetrics[] = [
    {
      type: "zeta.task",
      totalRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
      canceledRuns: 0,
      lastRunStartedAt: "2026-04-26T10:00:00.000Z",
      lastRunFinishedAt: "2026-04-26T10:00:05.000Z",
      lastDurationMs: 5000,
      averageDurationMs: 5000,
      p95DurationMs: null,
    },
    {
      type: "alpha.task",
      totalRuns: 2,
      succeededRuns: 0,
      failedRuns: 2,
      canceledRuns: 0,
      lastRunStartedAt: "2026-04-26T11:00:00.000Z",
      lastRunFinishedAt: "2026-04-26T11:00:10.000Z",
      lastDurationMs: 10000,
      averageDurationMs: null,
      p95DurationMs: null,
    },
  ];
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    jobTypeMetrics: () => fixture,
  });

  assert.equal(status.jobMetrics.length, 2);
  assert.equal(status.jobMetrics[0].type, "zeta.task");
  assert.equal(status.jobMetrics[1].type, "alpha.task");
  assert.deepEqual(status.jobMetrics, fixture);
});
