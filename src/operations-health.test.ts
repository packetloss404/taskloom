import assert from "node:assert/strict";
import test from "node:test";
import { getOperationsHealth, type OperationsHealthDeps } from "./operations-health.js";
import type { SchedulerHeartbeat } from "./jobs/scheduler-heartbeat.js";

function fixedNow(iso: string): () => Date {
  const date = new Date(iso);
  return () => date;
}

function heartbeat(overrides: Partial<SchedulerHeartbeat> = {}): SchedulerHeartbeat {
  return {
    schedulerStartedAt: "2026-04-26T09:59:00.000Z",
    lastTickStartedAt: "2026-04-26T10:00:00.000Z",
    lastTickEndedAt: "2026-04-26T10:00:00.500Z",
    lastTickDurationMs: 500,
    ticksSinceStart: 7,
    ...overrides,
  };
}

function baseDeps(overrides: Partial<OperationsHealthDeps> = {}): OperationsHealthDeps {
  return {
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => heartbeat(),
    env: { TASKLOOM_ACCESS_LOG_MODE: "off" },
    now: fixedNow("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
    schedulerStaleAfterMs: 60_000,
    ...overrides,
  };
}

function findSubsystem(report: ReturnType<typeof getOperationsHealth>, name: string) {
  const subsystem = report.subsystems.find((entry) => entry.name === name);
  assert.ok(subsystem, `expected subsystem ${name} to be present`);
  return subsystem;
}

function completePhase64Env(): NodeJS.ProcessEnv {
  return {
    TASKLOOM_STORE: "postgres",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
      "artifacts/phase62/horizontal-writer-hardening.md",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
      "artifacts/phase62/concurrency-tests.tap",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
      "artifacts/phase62/transaction-retry.md",
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
    TASKLOOM_HEALTH_MONITORING_EVIDENCE: "monitoring://phase63/health",
    TASKLOOM_RECOVERY_BACKUP_RESTORE_EVIDENCE: "artifacts/phase64/backup-restore.md",
    TASKLOOM_RECOVERY_PITR_REHEARSAL_EVIDENCE: "artifacts/phase64/pitr.md",
    TASKLOOM_RECOVERY_FAILOVER_REHEARSAL_EVIDENCE: "artifacts/phase64/failover.md",
    TASKLOOM_RECOVERY_DATA_INTEGRITY_VALIDATION: "artifacts/phase64/integrity.md",
    TASKLOOM_RECOVERY_TIME_EXPECTATIONS: "RTO<=15m RPO<=5m",
  };
}

function completePhase65Env(): NodeJS.ProcessEnv {
  return {
    ...completePhase64Env(),
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

function completePhase66Env(): NodeJS.ProcessEnv {
  return {
    ...completePhase65Env(),
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

test("default healthy deps yield overall ok with disabled accessLog", () => {
  const report = getOperationsHealth(baseDeps());
  assert.equal(report.overall, "ok");
  assert.equal(findSubsystem(report, "store").status, "ok");
  assert.equal(findSubsystem(report, "scheduler").status, "ok");
  assert.equal(findSubsystem(report, "accessLog").status, "disabled");
  assert.equal(findSubsystem(report, "managedPostgresRecoveryValidation").status, "disabled");
  assert.equal(findSubsystem(report, "managedPostgresCutoverAutomation").status, "disabled");
  assert.equal(findSubsystem(report, "finalReleaseClosure").status, "disabled");
  assert.match(findSubsystem(report, "scheduler").detail, /ticksSinceStart=7/);
  assert.equal(report.generatedAt, "2026-04-26T10:00:01.000Z");
});

test("store throws -> store down and overall down", () => {
  const report = getOperationsHealth(
    baseDeps({
      loadStore: () => {
        throw new Error("disk on fire");
      },
    }),
  );
  const store = findSubsystem(report, "store");
  assert.equal(store.status, "down");
  assert.match(store.detail, /store load failed: disk on fire/);
  assert.equal(report.overall, "down");
});

test("store returns null -> store down", () => {
  const report = getOperationsHealth(baseDeps({ loadStore: () => null }));
  const store = findSubsystem(report, "store");
  assert.equal(store.status, "down");
  assert.equal(store.detail, "store returned an unexpected shape");
  assert.equal(report.overall, "down");
});

test("scheduler with schedulerStartedAt null -> down", () => {
  const report = getOperationsHealth(
    baseDeps({ schedulerHeartbeat: () => heartbeat({ schedulerStartedAt: null, lastTickEndedAt: null, lastTickStartedAt: null }) }),
  );
  const scheduler = findSubsystem(report, "scheduler");
  assert.equal(scheduler.status, "down");
  assert.equal(scheduler.detail, "scheduler has not been started in this process");
  assert.equal(report.overall, "down");
});

test("scheduler with no completed tick -> degraded", () => {
  const report = getOperationsHealth(
    baseDeps({ schedulerHeartbeat: () => heartbeat({ lastTickEndedAt: null, lastTickStartedAt: "2026-04-26T10:00:00.000Z" }) }),
  );
  const scheduler = findSubsystem(report, "scheduler");
  assert.equal(scheduler.status, "degraded");
  assert.equal(scheduler.detail, "scheduler has started but no tick has completed yet");
  assert.equal(report.overall, "degraded");
});

test("scheduler with stale lastTickEndedAt -> degraded with rounded seconds", () => {
  const report = getOperationsHealth(
    baseDeps({
      schedulerHeartbeat: () => heartbeat({ lastTickEndedAt: "2026-04-26T09:58:00.000Z" }),
      now: fixedNow("2026-04-26T10:00:00.400Z"),
    }),
  );
  const scheduler = findSubsystem(report, "scheduler");
  assert.equal(scheduler.status, "degraded");
  assert.equal(scheduler.detail, "last tick was 120s ago");
  assert.equal(scheduler.observedAt, "2026-04-26T09:58:00.000Z");
  assert.equal(report.overall, "degraded");
});

test("scheduler with recent tick -> ok with ticksSinceStart in detail", () => {
  const report = getOperationsHealth(
    baseDeps({
      schedulerHeartbeat: () => heartbeat({ lastTickEndedAt: "2026-04-26T10:00:00.000Z", ticksSinceStart: 42 }),
      now: fixedNow("2026-04-26T10:00:00.250Z"),
    }),
  );
  const scheduler = findSubsystem(report, "scheduler");
  assert.equal(scheduler.status, "ok");
  assert.equal(scheduler.detail, "last tick 250ms ago, ticksSinceStart=42");
  assert.equal(scheduler.observedAt, "2026-04-26T10:00:00.000Z");
});

test("access log mode stdout -> ok", () => {
  const report = getOperationsHealth(baseDeps({ env: { TASKLOOM_ACCESS_LOG_MODE: "stdout" } }));
  const accessLog = findSubsystem(report, "accessLog");
  assert.equal(accessLog.status, "ok");
  assert.equal(accessLog.detail, "writing to stdout");
  assert.equal(report.overall, "ok");
});

test("access log mode file without path -> down", () => {
  const report = getOperationsHealth(baseDeps({ env: { TASKLOOM_ACCESS_LOG_MODE: "file" } }));
  const accessLog = findSubsystem(report, "accessLog");
  assert.equal(accessLog.status, "down");
  assert.equal(accessLog.detail, "file mode requires TASKLOOM_ACCESS_LOG_PATH");
  assert.equal(report.overall, "down");
});

test("access log mode file with missing parent dir -> down", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: { TASKLOOM_ACCESS_LOG_MODE: "file", TASKLOOM_ACCESS_LOG_PATH: "var/logs/access.log" },
      fileExists: () => false,
    }),
  );
  const accessLog = findSubsystem(report, "accessLog");
  assert.equal(accessLog.status, "down");
  assert.match(accessLog.detail, /^access log directory does not exist: /);
  assert.equal(report.overall, "down");
});

test("access log mode file with parent dir present but file absent -> degraded", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: { TASKLOOM_ACCESS_LOG_MODE: "file", TASKLOOM_ACCESS_LOG_PATH: "var/logs/access.log" },
      fileExists: (path) => !path.endsWith("access.log"),
    }),
  );
  const accessLog = findSubsystem(report, "accessLog");
  assert.equal(accessLog.status, "degraded");
  assert.match(accessLog.detail, /^access log file does not exist yet: /);
  assert.equal(report.overall, "degraded");
});

test("access log mode file with file present -> ok", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: { TASKLOOM_ACCESS_LOG_MODE: "file", TASKLOOM_ACCESS_LOG_PATH: "var/logs/access.log" },
      fileExists: () => true,
    }),
  );
  const accessLog = findSubsystem(report, "accessLog");
  assert.equal(accessLog.status, "ok");
  assert.match(accessLog.detail, /^file present at /);
  assert.equal(report.overall, "ok");
});

test("overall is down whenever any subsystem is down", () => {
  const report = getOperationsHealth(
    baseDeps({
      loadStore: () => null,
      schedulerHeartbeat: () => heartbeat({ lastTickEndedAt: null, lastTickStartedAt: null }),
    }),
  );
  assert.equal(report.overall, "down");
});

test("overall is degraded when only degraded subsystems exist", () => {
  const report = getOperationsHealth(
    baseDeps({
      schedulerHeartbeat: () => heartbeat({ lastTickEndedAt: null, lastTickStartedAt: null }),
    }),
  );
  assert.equal(report.overall, "degraded");
});

test("disabled access log does not poison overall", () => {
  const report = getOperationsHealth(
    baseDeps({ env: { TASKLOOM_ACCESS_LOG_MODE: "off" } }),
  );
  assert.equal(findSubsystem(report, "accessLog").status, "disabled");
  assert.equal(report.overall, "ok");
});

test("distributed dependency health explains blocked Phase 63 activation for local-only coordination", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: {
        TASKLOOM_STORE: "postgres",
        TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
        TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
          "artifacts/phase62/horizontal-writer-hardening.md",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
          "artifacts/phase62/concurrency-tests.tap",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
          "artifacts/phase62/transaction-retry.md",
        TASKLOOM_SCHEDULER_LEADER_MODE: "file",
        TASKLOOM_ACCESS_LOG_MODE: "file",
        TASKLOOM_ACCESS_LOG_PATH: "data/access.log",
      },
    }),
  );
  const dependencies = findSubsystem(report, "distributedDependencyEnforcement");

  assert.equal(dependencies.status, "degraded");
  assert.match(dependencies.detail, /Phase 63/);
  assert.match(dependencies.detail, /distributed rate limiting/);
  assert.match(dependencies.detail, /scheduler coordination/);
  assert.match(dependencies.detail, /durable job execution/);
  assert.match(dependencies.detail, /access-log shipping/);
  assert.match(dependencies.detail, /alert delivery/);
  assert.match(dependencies.detail, /health monitoring/);
  assert.match(dependencies.detail, /activationAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("distributed dependency health is ok when all Phase 63 dependencies are production-safe", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: {
        TASKLOOM_STORE: "postgres",
        TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
        TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
          "artifacts/phase62/horizontal-writer-hardening.md",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
          "artifacts/phase62/concurrency-tests.tap",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
          "artifacts/phase62/transaction-retry.md",
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
        TASKLOOM_HEALTH_MONITORING_EVIDENCE: "monitoring://phase63/health",
      },
    }),
  );
  const dependencies = findSubsystem(report, "distributedDependencyEnforcement");

  assert.equal(dependencies.status, "ok");
  assert.match(dependencies.detail, /Phase 63/);
  assert.match(dependencies.detail, /activationAllowed=true/);
  assert.match(dependencies.detail, /releaseAllowed=false/);
  const recovery = findSubsystem(report, "managedPostgresRecoveryValidation");
  assert.equal(recovery.status, "degraded");
  assert.match(recovery.detail, /Phase 64/);
  assert.match(recovery.detail, /backup restore evidence/);
  assert.match(recovery.detail, /PITR rehearsal evidence/);
  assert.match(recovery.detail, /activationAllowed=false/);
});

test("managed Postgres recovery validation health is ok when Phase 64 evidence is present", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: {
        TASKLOOM_STORE: "postgres",
        TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
        TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
          "artifacts/phase62/horizontal-writer-hardening.md",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
          "artifacts/phase62/concurrency-tests.tap",
        TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
          "artifacts/phase62/transaction-retry.md",
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
        TASKLOOM_HEALTH_MONITORING_EVIDENCE: "monitoring://phase63/health",
        TASKLOOM_RECOVERY_BACKUP_RESTORE_EVIDENCE: "artifacts/phase64/backup-restore.md",
        TASKLOOM_RECOVERY_PITR_REHEARSAL_EVIDENCE: "artifacts/phase64/pitr.md",
        TASKLOOM_RECOVERY_FAILOVER_REHEARSAL_EVIDENCE: "artifacts/phase64/failover.md",
        TASKLOOM_RECOVERY_DATA_INTEGRITY_VALIDATION: "artifacts/phase64/integrity.md",
        TASKLOOM_RECOVERY_TIME_EXPECTATIONS: "RTO<=15m RPO<=5m",
      },
    }),
  );
  const recovery = findSubsystem(report, "managedPostgresRecoveryValidation");

  assert.equal(recovery.status, "ok");
  assert.match(recovery.detail, /backup restore, PITR rehearsal, failover rehearsal/i);
  assert.match(recovery.detail, /provider-owned HA\/PITR is validated/i);
  assert.match(recovery.detail, /active-active, regional runtime, and SQLite-distributed support remain unsupported/i);
  assert.match(recovery.detail, /activationAllowed=true/);
  assert.match(recovery.detail, /releaseAllowed=false/);
});

test("managed Postgres cutover automation health blocks activation when Phase 65 evidence is missing", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: completePhase64Env(),
    }),
  );
  const cutover = findSubsystem(report, "managedPostgresCutoverAutomation");

  assert.equal(cutover.status, "degraded");
  assert.match(cutover.detail, /Phase 65/);
  assert.match(cutover.detail, /cutover preflight evidence/);
  assert.match(cutover.detail, /activation dry-run evidence/);
  assert.match(cutover.detail, /post-activation smoke-check evidence/);
  assert.match(cutover.detail, /rollback command guidance/);
  assert.match(cutover.detail, /monitoring thresholds/);
  assert.match(cutover.detail, /activationAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("managed Postgres cutover automation health blocks activation when preflight fails", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: {
        ...completePhase65Env(),
        TASKLOOM_MANAGED_POSTGRES_CUTOVER_PREFLIGHT_STATUS: "failed",
      },
    }),
  );
  const cutover = findSubsystem(report, "managedPostgresCutoverAutomation");

  assert.equal(cutover.status, "degraded");
  assert.match(cutover.detail, /cutover preflight evidence failed/i);
  assert.match(cutover.detail, /activationAllowed=false/);
});

test("managed Postgres cutover automation health requires rollback after smoke failure", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: {
        ...completePhase65Env(),
        TASKLOOM_MANAGED_POSTGRES_POST_ACTIVATION_SMOKE_STATUS: "failed",
      },
    }),
  );
  const cutover = findSubsystem(report, "managedPostgresCutoverAutomation");

  assert.equal(cutover.status, "degraded");
  assert.match(cutover.detail, /post-activation smoke checks failed/i);
  assert.match(cutover.detail, /prior safe posture/i);
  assert.match(cutover.detail, /rollbackRequired=true/);
  assert.match(cutover.detail, /activationAllowed=false/);
});

test("managed Postgres cutover automation health is ok when all Phase 65 inputs are present", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: completePhase65Env(),
    }),
  );
  const cutover = findSubsystem(report, "managedPostgresCutoverAutomation");

  assert.equal(cutover.status, "ok");
  assert.match(cutover.detail, /cutover preflight, activation dry-run, post-activation smoke checks/i);
  assert.match(cutover.detail, /rollback command guidance/);
  assert.match(cutover.detail, /monitoring thresholds/);
  assert.match(cutover.detail, /activationAllowed=true/);
  assert.match(cutover.detail, /releaseAllowed=false/);
});

test("final release closure health blocks release when Phase 66 evidence is missing", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: completePhase65Env(),
    }),
  );
  const closure = findSubsystem(report, "finalReleaseClosure");

  assert.equal(closure.status, "degraded");
  assert.match(closure.detail, /Phase 66/);
  assert.match(closure.detail, /supported production topology statement/);
  assert.match(closure.detail, /documentation freeze/);
  assert.match(closure.detail, /no-hidden-phase assertion/);
  assert.match(closure.detail, /final release approval/);
  assert.match(closure.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("final release closure health is ok when Phase 66 inputs are complete", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: completePhase66Env(),
    }),
  );
  const closure = findSubsystem(report, "finalReleaseClosure");

  assert.equal(closure.status, "ok");
  assert.match(closure.detail, /Phase 66 final release closure is ready/i);
  assert.match(closure.detail, /documentation freeze/);
  assert.match(closure.detail, /no-hidden-phase assertion/);
  assert.match(closure.detail, /releaseAllowed=true/);
});

test("final release closure health fails closed when Phase 66 check reports failure", () => {
  const report = getOperationsHealth(
    baseDeps({
      env: {
        ...completePhase66Env(),
        TASKLOOM_PHASE66_DOCS_CONSISTENCY_STATUS: "failed",
      },
    }),
  );
  const closure = findSubsystem(report, "finalReleaseClosure");

  assert.equal(closure.status, "degraded");
  assert.match(closure.detail, /docs consistency checks/);
  assert.match(closure.detail, /failed/i);
  assert.match(closure.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});
