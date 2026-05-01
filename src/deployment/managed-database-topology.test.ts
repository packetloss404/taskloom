import assert from "node:assert/strict";
import test from "node:test";
import {
  assessManagedDatabaseTopology,
  buildManagedDatabaseTopologyReport,
  type ManagedDatabaseTopologyObservedEnvValue,
} from "./managed-database-topology.js";

function observedEnvValue(
  report: ReturnType<typeof assessManagedDatabaseTopology>,
  name: string,
): ManagedDatabaseTopologyObservedEnvValue {
  const entry = report.observed.env[name];
  assert.ok(entry, `expected observed env entry for ${name}`);
  return entry;
}

const distributedTopologyPhase55Env = {
  TASKLOOM_STORE: "postgres",
  TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
  TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-53/requirements.md",
  TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-53/design.md",
  TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "database-platform",
  TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "docs/phase-54/consistency.md",
  TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "docs/phase-54/failover-pitr.md",
  TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "docs/phase-54/migration-backfill.md",
  TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "docs/phase-54/observability.md",
  TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "docs/phase-54/rollback.md",
  TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "engineering-director",
  TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
  TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "docs/phase-55/scope.md",
  TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety.md",
} as const;

const distributedTopologyPhase56DetailedEnv = {
  ...distributedTopologyPhase55Env,
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN: "docs/phase-56/implementation.md",
  TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN: "docs/phase-56/rollout.md",
  TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN: "docs/phase-56/test-validation.md",
  TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN: "docs/phase-56/data-safety.md",
  TASKLOOM_MULTI_WRITER_CUTOVER_PLAN: "docs/phase-56/cutover.md",
  TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE: "docs/phase-56/rollback-drill.md",
} as const;

const distributedTopologyPhase56BundledEnv = {
  ...distributedTopologyPhase55Env,
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "docs/phase-56/readiness.md",
  TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "docs/phase-56/rollout-safety.md",
} as const;

const distributedTopologyPhase57Env = {
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "docs/phase-57/scope-lock.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "multi-writer-runtime-disabled",
  TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "docs/phase-57/validation.md",
  TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "docs/phase-57/migration-cutover-lock.md",
  TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "docs/phase-57/release-owner.md",
} as const;

const distributedTopologyPhase58Env = {
  TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "docs/phase-58/runtime-implementation.md",
  TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "docs/phase-58/consistency-validation.md",
  TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "docs/phase-58/failover-validation.md",
  TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "docs/phase-58/data-integrity.md",
  TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "docs/phase-58/operations-runbook.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "docs/phase-58/runtime-release-signoff.md",
} as const;

const distributedTopologyPhase59Env = {
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "docs/phase-59/decision.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "release-director",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-05T02:00Z/2026-05-05T04:00Z",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "docs/phase-59/monitoring.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "docs/phase-59/abort-plan.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "REL-59",
} as const;

const distributedTopologyPhase60Env = {
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "docs/phase-60/implementation-present.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT: "docs/phase-60/support-statement.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "docs/phase-60/compatibility-matrix.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "docs/phase-60/cutover-evidence.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL: "REL-AUTO-60",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "database-platform",
} as const;

const distributedTopologyPhase61Env = {
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "docs/phase-61/activation-decision.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "release-commander",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-06T02:00Z/2026-05-06T04:00Z",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "multi-writer-runtime-activation-disabled",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION: "REL-AUTO-61",
} as const;

const managedPostgresHorizontalWriterPhase62Env = {
  TASKLOOM_STORE: "postgres",
  TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
  TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
  ...distributedTopologyPhase61Env,
  TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
    "docs/phase-62/horizontal-writer-hardening.md",
  TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
    "docs/phase-62/concurrency-tests.md",
  TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
    "docs/phase-62/transaction-retry.md",
} as const;

test("local JSON reports current supported local mode", () => {
  const report = assessManagedDatabaseTopology({ env: {} });

  assert.equal(report.phase, "45");
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "local-json");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.requested, false);
  assert.equal(report.managedDatabase.configured, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.syncStartupSupported, false);
  assert.equal(report.managedDatabase.phase50?.asyncAdapterAvailable, false);
  assert.equal(report.managedDatabase.phase50?.backfillAvailable, false);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase53?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase53?.requirementsEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase53?.designEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase53?.requirementsDesignGatePassed, true);
  assert.equal(report.managedDatabase.phase53?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase53?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase54?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase54?.topologyOwnerConfigured, false);
  assert.equal(report.managedDatabase.phase54?.consistencyModelConfigured, false);
  assert.equal(report.managedDatabase.phase54?.failoverPitrPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.migrationBackfillPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.observabilityPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.rollbackPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.designPackageGatePassed, true);
  assert.equal(report.managedDatabase.phase54?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase54?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase55?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase55?.designReviewerConfigured, false);
  assert.equal(report.managedDatabase.phase55?.implementationApproverConfigured, false);
  assert.equal(report.managedDatabase.phase55?.reviewStatus, null);
  assert.equal(report.managedDatabase.phase55?.reviewStatusConfigured, false);
  assert.equal(report.managedDatabase.phase55?.reviewStatusApproved, false);
  assert.equal(report.managedDatabase.phase55?.approvedImplementationScopeConfigured, false);
  assert.equal(report.managedDatabase.phase55?.safetySignoffConfigured, false);
  assert.equal(report.managedDatabase.phase55?.implementationAuthorizationGatePassed, true);
  assert.equal(report.managedDatabase.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase55?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase56?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase56?.implementationAuthorizationGatePassed, true);
  assert.equal(report.managedDatabase.phase56?.implementationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessGatePassed, true);
  assert.equal(report.managedDatabase.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase56?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase57?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase57?.implementationReadinessGatePassed, true);
  assert.equal(report.managedDatabase.phase57?.implementationScopeLockConfigured, false);
  assert.equal(report.managedDatabase.phase57?.runtimeFeatureFlagConfigured, false);
  assert.equal(report.managedDatabase.phase57?.validationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase57?.migrationCutoverLockConfigured, false);
  assert.equal(report.managedDatabase.phase57?.releaseOwnerSignoffConfigured, false);
  assert.equal(report.managedDatabase.phase57?.implementationScopeGatePassed, true);
  assert.equal(report.managedDatabase.phase57?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase57?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase57?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase58?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase58?.implementationScopeGatePassed, true);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.consistencyValidationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.failoverValidationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.dataIntegrityValidationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.operationsRunbookConfigured, false);
  assert.equal(report.managedDatabase.phase58?.runtimeReleaseSignoffConfigured, false);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.managedDatabase.phase58?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase58?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase58?.strictBlocker, false);
  assert.equal(report.observed.store, "json");
  assert.equal(report.observed.dbPath, null);
  assert.ok(report.summary.includes("supported local JSON"));
  assert.ok(report.checks.some((check) => check.id === "supported-local-mode" && check.status === "pass"));
  assert.equal(report.blockers.length, 0);
});

test("single-node SQLite reports current supported local persistence mode", () => {
  const report = buildManagedDatabaseTopologyReport({
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_DATABASE_TOPOLOGY: "single-node",
  });

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "single-node-sqlite");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.requested, false);
  assert.equal(report.managedDatabase.configured, false);
  assert.equal(report.managedDatabase.phase50?.asyncAdapterConfigured, false);
  assert.equal(report.observed.store, "sqlite");
  assert.equal(report.observed.dbPath, "/srv/taskloom/taskloom.sqlite");
  assert.equal(report.observed.databaseTopology, "single-node");
  assert.ok(report.summary.includes("single-node SQLite"));
});

test("managed database URL is redacted and blocked as unimplemented runtime", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });
  const urlEntry = observedEnvValue(report, "TASKLOOM_MANAGED_DATABASE_URL");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.configured, true);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.syncStartupSupported, false);
  assert.equal(report.managedDatabase.phase50?.asyncAdapterAvailable, false);
  assert.equal(urlEntry.configured, true);
  assert.equal(urlEntry.redacted, true);
  assert.equal(urlEntry.value, "[redacted]");
  assert.equal(report.observed.managedDatabaseUrl, "[redacted]");
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 52 managed Postgres startup support requires")));
  assert.ok(report.warnings.some((warning) => warning.includes("require Phase 52 managed Postgres startup support")));
  assert.ok(report.summary.includes("Phase 52 managed Postgres startup support is not available"));
});

test("Phase 50 postgres adapter and managed URL report Phase 52 startup support", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.configured, true);
  assert.equal(report.managedDatabase.supported, true);
  assert.equal(report.managedDatabase.syncStartupSupported, true);
  assert.equal(report.managedDatabase.phase50?.asyncAdapterConfigured, true);
  assert.equal(report.managedDatabase.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.managedDatabase.phase50?.backfillAvailable, true);
  assert.equal(report.managedDatabase.phase50?.adapter, "postgres");
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, true);
  assert.equal(report.managedDatabase.phase53?.multiWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase53?.runtimeSupport, false);
  assert.equal(report.observed.managedDatabaseAdapter, "postgres");
  assert.ok(report.summary.includes("Phase 52"));
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 52 managed Postgres startup support is asserted")));
});

test("TASKLOOM_STORE=postgres reports managed runtime boundary without claiming support", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "postgres",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.configured, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.observed.store, "postgres");
  assert.ok(report.blockers.some((blocker) => blocker.includes("synchronous managed database runtime boundary")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("sync app startup path supported")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres")));
});

test("TASKLOOM_STORE=postgres reports Phase 52 support when managed adapter and URL are configured", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.configured, true);
  assert.equal(report.managedDatabase.supported, true);
  assert.equal(report.observed.store, "postgres");
  assert.ok(report.checks.some((check) => check.id === "supported-local-mode" && check.status === "pass"));
});

test("TASKLOOM_STORE=managed reports managed runtime boundary without claiming support", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "managed",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.observed.store, "managed");
  assert.ok(report.blockers.some((blocker) => blocker.includes("sync app startup path supported")));
});

test("TASKLOOM_STORE=managed reports Phase 52 support when managed adapter and URL are configured", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "managed",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
    },
  });

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.supported, true);
  assert.equal(report.observed.store, "managed");
});

test("managed URL hints are redacted and treated as boundary evidence", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "sqlite",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
    },
  });
  const databaseUrl = observedEnvValue(report, "DATABASE_URL");
  const taskloomDatabaseUrl = observedEnvValue(report, "TASKLOOM_DATABASE_URL");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.managedDatabase.configured, true);
  assert.equal(databaseUrl.value, "[redacted]");
  assert.equal(databaseUrl.redacted, true);
  assert.equal(taskloomDatabaseUrl.value, "[redacted]");
  assert.equal(taskloomDatabaseUrl.redacted, true);
  assert.ok(report.warnings.some((warning) => warning.includes("require Phase 52 managed Postgres startup support")));
});

test("managed topology intent is blocked without claiming database support", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DATABASE_TOPOLOGY: "managed-database",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.configured, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.observed.databaseTopology, "managed-database");
  assert.ok(
    report.checks.some((check) => check.id === "managed-database-runtime" && check.status === "fail"),
  );
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres")));
});

test("active-active topology remains blocked with managed Postgres adapter and URL", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.requested, true);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase53?.requirementsEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase53?.designEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase53?.requirementsDesignGatePassed, false);
  assert.equal(report.managedDatabase.phase53?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase53?.strictBlocker, true);
  assert.equal(report.managedDatabase.phase54?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase54?.topologyOwnerConfigured, false);
  assert.equal(report.managedDatabase.phase54?.consistencyModelConfigured, false);
  assert.equal(report.managedDatabase.phase54?.failoverPitrPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.migrationBackfillPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.observabilityPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.rollbackPlanConfigured, false);
  assert.equal(report.managedDatabase.phase54?.designPackageGatePassed, false);
  assert.equal(report.managedDatabase.phase54?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase54?.strictBlocker, true);
  assert.equal(report.managedDatabase.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase55?.designReviewerConfigured, false);
  assert.equal(report.managedDatabase.phase55?.implementationApproverConfigured, false);
  assert.equal(report.managedDatabase.phase55?.reviewStatusConfigured, false);
  assert.equal(report.managedDatabase.phase55?.reviewStatusApproved, false);
  assert.equal(report.managedDatabase.phase55?.approvedImplementationScopeConfigured, false);
  assert.equal(report.managedDatabase.phase55?.safetySignoffConfigured, false);
  assert.equal(report.managedDatabase.phase55?.implementationAuthorizationGatePassed, false);
  assert.equal(report.managedDatabase.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase55?.strictBlocker, true);
  assert.equal(report.managedDatabase.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase56?.implementationAuthorizationGatePassed, false);
  assert.equal(report.managedDatabase.phase56?.implementationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.managedDatabase.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase56?.strictBlocker, true);
  assert.ok(report.blockers.some((blocker) => blocker.includes("active-active")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 53 requires")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 54 requires")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 55 requires")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 56 requires")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE")));
});

test("distributed topology with Phase 53 and Phase 54 evidence remains blocked for runtime support", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "distributed",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "database-platform",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "docs/phase-54/consistency.md",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "docs/phase-54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "docs/phase-54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "docs/phase-54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "docs/phase-54/rollback.md",
    },
  });
  const owner = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase53?.requirementsEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase53?.designEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase53?.requirementsDesignGatePassed, true);
  assert.equal(report.managedDatabase.phase53?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase53?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase54?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase54?.topologyOwnerConfigured, true);
  assert.equal(report.managedDatabase.phase54?.consistencyModelConfigured, true);
  assert.equal(report.managedDatabase.phase54?.failoverPitrPlanConfigured, true);
  assert.equal(report.managedDatabase.phase54?.migrationBackfillPlanConfigured, true);
  assert.equal(report.managedDatabase.phase54?.observabilityPlanConfigured, true);
  assert.equal(report.managedDatabase.phase54?.rollbackPlanConfigured, true);
  assert.equal(report.managedDatabase.phase54?.designPackageGatePassed, true);
  assert.equal(report.managedDatabase.phase54?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase54?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase55?.designReviewerConfigured, false);
  assert.equal(report.managedDatabase.phase55?.implementationApproverConfigured, false);
  assert.equal(report.managedDatabase.phase55?.reviewStatus, null);
  assert.equal(report.managedDatabase.phase55?.reviewStatusConfigured, false);
  assert.equal(report.managedDatabase.phase55?.reviewStatusApproved, false);
  assert.equal(report.managedDatabase.phase55?.approvedImplementationScopeConfigured, false);
  assert.equal(report.managedDatabase.phase55?.safetySignoffConfigured, false);
  assert.equal(report.managedDatabase.phase55?.implementationAuthorizationGatePassed, false);
  assert.equal(report.managedDatabase.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase55?.strictBlocker, true);
  assert.equal(report.managedDatabase.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase56?.implementationAuthorizationGatePassed, false);
  assert.equal(report.managedDatabase.phase56?.implementationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.managedDatabase.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase56?.strictBlocker, true);
  assert.equal(owner.configured, true);
  assert.equal(owner.value, "database-platform");
  assert.equal(owner.redacted, false);
  assert.ok(
    report.checks.some((check) => check.id === "phase54-multi-writer-design-package" && check.status === "pass"),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support remains blocked")));
});

test("distributed topology with Phase 55 authorization evidence still keeps runtime support blocked", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "distributed",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "database-platform",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "docs/phase-54/consistency.md",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "docs/phase-54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "docs/phase-54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "docs/phase-54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "docs/phase-54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "engineering-director",
      TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
      TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "docs/phase-55/scope.md",
      TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety.md",
    },
  });
  const reviewer = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase55?.designReviewerConfigured, true);
  assert.equal(report.managedDatabase.phase55?.implementationApproverConfigured, true);
  assert.equal(report.managedDatabase.phase55?.reviewStatus, "approved");
  assert.equal(report.managedDatabase.phase55?.reviewStatusConfigured, true);
  assert.equal(report.managedDatabase.phase55?.reviewStatusApproved, true);
  assert.equal(report.managedDatabase.phase55?.approvedImplementationScopeConfigured, true);
  assert.equal(report.managedDatabase.phase55?.safetySignoffConfigured, true);
  assert.equal(report.managedDatabase.phase55?.implementationAuthorizationGatePassed, true);
  assert.equal(report.managedDatabase.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase55?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase56?.implementationAuthorizationGatePassed, true);
  assert.equal(report.managedDatabase.phase56?.implementationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.managedDatabase.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase56?.strictBlocker, true);
  assert.equal(reviewer.configured, true);
  assert.equal(reviewer.value, "principal-architect");
  assert.equal(reviewer.redacted, false);
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase55-multi-writer-implementation-authorization" && check.status === "pass",
    ),
  );
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase56-multi-writer-implementation-readiness" && check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 56 requires")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support remains blocked")));
});

test("distributed topology with Phase 56 rollout-safety evidence still keeps runtime support blocked", () => {
  const report = assessManagedDatabaseTopology({
    env: distributedTopologyPhase56DetailedEnv,
  });
  const rollbackDrill = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase55?.implementationAuthorizationGatePassed, true);
  assert.equal(report.managedDatabase.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase56?.implementationAuthorizationGatePassed, true);
  assert.equal(report.managedDatabase.phase56?.implementationPlanConfigured, true);
  assert.equal(report.managedDatabase.phase56?.rolloutPlanConfigured, true);
  assert.equal(report.managedDatabase.phase56?.testValidationPlanConfigured, true);
  assert.equal(report.managedDatabase.phase56?.dataSafetyPlanConfigured, true);
  assert.equal(report.managedDatabase.phase56?.cutoverPlanConfigured, true);
  assert.equal(report.managedDatabase.phase56?.rollbackDrillEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessGatePassed, true);
  assert.equal(report.managedDatabase.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase56?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase57?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase57?.implementationReadinessGatePassed, true);
  assert.equal(report.managedDatabase.phase57?.implementationScopeLockConfigured, false);
  assert.equal(report.managedDatabase.phase57?.runtimeFeatureFlagConfigured, false);
  assert.equal(report.managedDatabase.phase57?.validationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase57?.migrationCutoverLockConfigured, false);
  assert.equal(report.managedDatabase.phase57?.releaseOwnerSignoffConfigured, false);
  assert.equal(report.managedDatabase.phase57?.implementationScopeGatePassed, false);
  assert.equal(report.managedDatabase.phase57?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase57?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase57?.strictBlocker, true);
  assert.equal(rollbackDrill.configured, true);
  assert.equal(rollbackDrill.value, "docs/phase-56/rollback-drill.md");
  assert.equal(rollbackDrill.redacted, false);
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase56-multi-writer-implementation-readiness" && check.status === "pass",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 57 requires")));
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase57-multi-writer-implementation-scope" && check.status === "fail",
    ),
  );
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 56")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 57 requires")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support remains blocked")));
});

test("distributed topology with Phase 57 implementation scope evidence still does not claim runtime support", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
    },
  });
  const scopeLock = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK");
  const bundledReadiness = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE",
  );

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase56?.implementationPlanConfigured, false);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase56?.rolloutSafetyEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase56?.implementationReadinessGatePassed, true);
  assert.equal(report.managedDatabase.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase57?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase57?.implementationReadinessGatePassed, true);
  assert.equal(report.managedDatabase.phase57?.implementationScopeLockConfigured, true);
  assert.equal(report.managedDatabase.phase57?.runtimeFeatureFlagConfigured, true);
  assert.equal(report.managedDatabase.phase57?.validationEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase57?.migrationCutoverLockConfigured, true);
  assert.equal(report.managedDatabase.phase57?.releaseOwnerSignoffConfigured, true);
  assert.equal(report.managedDatabase.phase57?.implementationScopeGatePassed, true);
  assert.equal(report.managedDatabase.phase57?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase57?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase57?.strictBlocker, false);
  assert.equal(report.managedDatabase.phase58?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase58?.implementationScopeGatePassed, true);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.consistencyValidationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.failoverValidationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.dataIntegrityValidationEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase58?.operationsRunbookConfigured, false);
  assert.equal(report.managedDatabase.phase58?.runtimeReleaseSignoffConfigured, false);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationValidationGatePassed, false);
  assert.equal(report.managedDatabase.phase58?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase58?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase58?.strictBlocker, true);
  assert.equal(scopeLock.configured, true);
  assert.equal(scopeLock.value, "docs/phase-57/scope-lock.md");
  assert.equal(scopeLock.redacted, false);
  assert.equal(bundledReadiness.configured, true);
  assert.equal(bundledReadiness.value, "docs/phase-56/readiness.md");
  assert.equal(bundledReadiness.redacted, false);
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase57-multi-writer-implementation-scope" && check.status === "pass",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 58 requires")));
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase58-multi-writer-runtime-implementation-validation" &&
        check.status === "fail",
    ),
  );
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE"),
    ),
  );
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 57")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 58 requires")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support and release remain blocked")));
});

test("distributed topology with Phase 58 runtime implementation evidence records validation but remains blocked", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
    },
  });
  const runtimeEvidence = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE",
  );
  const operationsRunbook = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase57?.implementationScopeGatePassed, true);
  assert.equal(report.managedDatabase.phase57?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase57?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase58?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase58?.implementationScopeGatePassed, true);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase58?.consistencyValidationEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase58?.failoverValidationEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase58?.dataIntegrityValidationEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase58?.operationsRunbookConfigured, true);
  assert.equal(report.managedDatabase.phase58?.runtimeReleaseSignoffConfigured, true);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.managedDatabase.phase58?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase58?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase58?.strictBlocker, true);
  assert.equal(runtimeEvidence.configured, true);
  assert.equal(runtimeEvidence.value, "docs/phase-58/runtime-implementation.md");
  assert.equal(runtimeEvidence.redacted, false);
  assert.equal(operationsRunbook.configured, true);
  assert.equal(operationsRunbook.value, "docs/phase-58/operations-runbook.md");
  assert.equal(operationsRunbook.redacted, false);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase58-multi-writer-runtime-implementation-validation" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 58")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 58")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support and release remain blocked")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("Phase 58 records implementation validation evidence only"),
    ),
  );
});

test("distributed topology with Phase 58 complete requires Phase 59 release-enable approval evidence", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
    },
  });
  const decision = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION");

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.managedDatabase.phase59?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase59?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementDecisionConfigured, false);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementApproverConfigured, false);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementRolloutWindowConfigured, false);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementMonitoringSignoffConfigured, false);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementAbortPlanConfigured, false);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementReleaseTicketConfigured, false);
  assert.equal(report.managedDatabase.phase59?.runtimeReleaseEnablementApprovalGatePassed, false);
  assert.equal(report.managedDatabase.phase59?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase59?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase59?.multiWriterSupported, false);
  assert.equal(report.managedDatabase.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase.phase59?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase59?.strictBlocker, true);
  assert.equal(decision.configured, false);
  assert.equal(decision.value, null);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase59-multi-writer-runtime-release-enable-approval" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 59 requires complete Phase 58")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION"),
    ),
  );
});

test("distributed topology with Phase 59 release-enable approval evidence still remains blocked", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
    },
  });
  const approver = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER");
  const releaseTicket = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET",
  );

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.managedDatabase.phase59?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase59?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementDecisionConfigured, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementApproverConfigured, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementRolloutWindowConfigured, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementMonitoringSignoffConfigured, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementAbortPlanConfigured, true);
  assert.equal(report.managedDatabase.phase59?.runtimeEnablementReleaseTicketConfigured, true);
  assert.equal(report.managedDatabase.phase59?.runtimeReleaseEnablementApprovalGatePassed, true);
  assert.equal(report.managedDatabase.phase59?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase59?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase59?.multiWriterSupported, false);
  assert.equal(report.managedDatabase.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase.phase59?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase59?.strictBlocker, true);
  assert.equal(approver.configured, true);
  assert.equal(approver.value, "release-director");
  assert.equal(approver.redacted, false);
  assert.equal(releaseTicket.configured, true);
  assert.equal(releaseTicket.value, "REL-59");
  assert.equal(releaseTicket.redacted, false);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase59-multi-writer-runtime-release-enable-approval" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 59")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 59")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support and release remain blocked")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("Phase 59 records release-enable approval evidence only"),
    ),
  );
});

test("distributed topology with Phase 59 complete requires Phase 60 runtime support presence assertion evidence", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
    },
  });
  const implementationPresent = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT",
  );

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase59?.runtimeReleaseEnablementApprovalGatePassed, true);
  assert.equal(report.managedDatabase.phase60?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase60?.runtimeReleaseEnablementApprovalGatePassed, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportImplementationPresentConfigured, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportExplicitSupportStatementConfigured, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportCompatibilityMatrixConfigured, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportCutoverEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportReleaseAutomationApprovalConfigured, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportOwnerAcceptanceConfigured, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportPresenceAssertionGatePassed, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase60?.multiWriterSupported, false);
  assert.equal(report.managedDatabase.phase60?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase.phase60?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase60?.strictBlocker, true);
  assert.equal(implementationPresent.configured, false);
  assert.equal(implementationPresent.value, null);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase60-multi-writer-runtime-support-presence-assertion" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 60 requires complete Phase 59")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT"),
    ),
  );
});

test("distributed topology with Phase 60 runtime support presence assertion evidence still remains blocked", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
      ...distributedTopologyPhase60Env,
    },
  });
  const supportStatement = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT",
  );
  const ownerAcceptance = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE",
  );

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase59?.runtimeReleaseEnablementApprovalGatePassed, true);
  assert.equal(report.managedDatabase.phase60?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase60?.runtimeReleaseEnablementApprovalGatePassed, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportImplementationPresentConfigured, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportExplicitSupportStatementConfigured, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportCompatibilityMatrixConfigured, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportCutoverEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportReleaseAutomationApprovalConfigured, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportOwnerAcceptanceConfigured, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportPresenceAssertionGatePassed, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase60?.multiWriterSupported, false);
  assert.equal(report.managedDatabase.phase60?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase.phase60?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase60?.strictBlocker, true);
  assert.equal(supportStatement.configured, true);
  assert.equal(supportStatement.value, "docs/phase-60/support-statement.md");
  assert.equal(supportStatement.redacted, false);
  assert.equal(ownerAcceptance.configured, true);
  assert.equal(ownerAcceptance.value, "database-platform");
  assert.equal(ownerAcceptance.redacted, false);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase60-multi-writer-runtime-support-presence-assertion" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 60")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 60")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support and release remain blocked")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("Phase 60 records runtime support presence assertion evidence only"),
    ),
  );
});

test("distributed topology with Phase 60 complete requires Phase 61 runtime activation controls", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
      ...distributedTopologyPhase60Env,
    },
  });
  const activationDecision = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION",
  );

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.phase60?.runtimeSupportPresenceAssertionGatePassed, true);
  assert.equal(report.managedDatabase.phase61?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase61?.runtimeSupportPresenceAssertionGatePassed, true);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationDecisionConfigured, false);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationOwnerConfigured, false);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationWindowConfigured, false);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationFlagConfigured, false);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationReleaseAutomationAssertionConfigured, false);
  assert.equal(report.managedDatabase.phase61?.activationControlsReady, false);
  assert.equal(report.managedDatabase.phase61?.activationGatePassed, false);
  assert.equal(report.managedDatabase.phase61?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase61?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase61?.strictBlocker, true);
  assert.equal(activationDecision.configured, false);
  assert.equal(activationDecision.value, null);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase61-multi-writer-runtime-activation-controls" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 61 requires complete Phase 60")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION"),
    ),
  );
});

test("distributed topology with Phase 61 activation controls records readiness but remains blocked", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
      ...distributedTopologyPhase60Env,
      ...distributedTopologyPhase61Env,
    },
  });
  const activationOwner = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER",
  );
  const activationAutomation = observedEnvValue(
    report,
    "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION",
  );

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.syncStartupSupported, false);
  assert.equal(report.managedDatabase.phase61?.runtimeSupportPresenceAssertionGatePassed, true);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationDecisionConfigured, true);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationOwnerConfigured, true);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationWindowConfigured, true);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationFlagConfigured, true);
  assert.equal(report.managedDatabase.phase61?.runtimeActivationReleaseAutomationAssertionConfigured, true);
  assert.equal(report.managedDatabase.phase61?.activationControlsReady, true);
  assert.equal(report.managedDatabase.phase61?.activationGatePassed, true);
  assert.equal(report.managedDatabase.phase61?.runtimeSupport, false);
  assert.equal(report.managedDatabase.phase61?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase61?.multiWriterSupported, false);
  assert.equal(report.managedDatabase.phase61?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase.phase61?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase.phase61?.releaseAllowed, false);
  assert.equal(report.managedDatabase.phase61?.strictBlocker, true);
  assert.equal(activationOwner.configured, true);
  assert.equal(activationOwner.value, "release-commander");
  assert.equal(activationOwner.redacted, false);
  assert.equal(activationAutomation.configured, true);
  assert.equal(activationAutomation.value, "REL-AUTO-61");
  assert.equal(activationAutomation.redacted, false);
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 61")));
  assert.ok(report.warnings.some((warning) => warning.includes("activation controls are ready")));
  assert.ok(
    report.nextSteps.some((step) => step.includes("Phase 61 records activation controls only")),
  );
});

test("Phase 61 activation controls do not bypass SQLite regional PITR topology", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
      ...distributedTopologyPhase60Env,
      ...distributedTopologyPhase61Env,
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: undefined,
      TASKLOOM_MANAGED_DATABASE_URL: undefined,
      TASKLOOM_DATABASE_TOPOLOGY: "regional-pitr",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "production-blocked");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.configured, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.managedDatabase.syncStartupSupported, false);
  assert.equal(report.observed.databaseTopology, "regional-pitr");
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.managedDatabase.phase61?.activationControlsReady, true);
  assert.equal(report.managedDatabase.phase61?.activationGatePassed, true);
  assert.equal(report.managedDatabase.phase61?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase61?.releaseAllowed, false);
  assert.ok(
    report.checks.some((check) => check.id === "single-writer-topology" && check.status === "fail"),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
});

test("managed Postgres horizontal app-writer topology requires Phase 61 controls and Phase 62 evidence", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.supported, true);
  assert.equal(report.managedDatabase.phase52?.managedPostgresStartupSupported, true);
  assert.equal(report.managedDatabase.phase61?.activationControlsReady, false);
  assert.equal(report.managedDatabase.phase61?.activationGatePassed, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase62?.managedPostgresStartupSupported, true);
  assert.equal(report.managedDatabase.phase62?.phase61ActivationReady, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterHardeningImplementationConfigured, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterConcurrencyTestEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterTransactionRetryEvidenceConfigured, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterHardeningReady, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterRuntimeSupported, false);
  assert.equal(report.managedDatabase.phase62?.genericMultiWriterDatabaseSupported, false);
  assert.equal(report.managedDatabase.phase62?.activeActiveSupported, false);
  assert.equal(report.managedDatabase.phase62?.regionalFailoverSupported, false);
  assert.equal(report.managedDatabase.phase62?.pitrRuntimeSupported, false);
  assert.equal(report.managedDatabase.phase62?.distributedSqliteSupported, false);
  assert.equal(report.managedDatabase.phase62?.strictBlocker, true);
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase62-managed-postgres-horizontal-writer-hardening" &&
        check.status === "fail",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 62 requires Phase 61 activation controls")));
  assert.ok(
    report.nextSteps.some((step) =>
      step.includes("TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION"),
    ),
  );
});

test("managed Postgres horizontal app-writer topology reports hardened Phase 62 posture", () => {
  const report = assessManagedDatabaseTopology({ env: managedPostgresHorizontalWriterPhase62Env });
  const hardeningImplementation = observedEnvValue(
    report,
    "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
  );
  const retryEvidence = observedEnvValue(
    report,
    "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE",
  );

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.supported, true);
  assert.equal(report.managedDatabase.syncStartupSupported, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase62?.managedPostgresStartupSupported, true);
  assert.equal(report.managedDatabase.phase62?.phase61ActivationControlsReady, true);
  assert.equal(report.managedDatabase.phase62?.phase61ActivationGatePassed, true);
  assert.equal(report.managedDatabase.phase62?.phase61ActivationReady, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterHardeningImplementationConfigured, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterConcurrencyTestEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterTransactionRetryEvidenceConfigured, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterHardeningReady, true);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterRuntimeSupported, true);
  assert.equal(report.managedDatabase.phase62?.genericMultiWriterDatabaseSupported, false);
  assert.equal(report.managedDatabase.phase62?.activeActiveSupported, false);
  assert.equal(report.managedDatabase.phase62?.regionalFailoverSupported, false);
  assert.equal(report.managedDatabase.phase62?.pitrRuntimeSupported, false);
  assert.equal(report.managedDatabase.phase62?.distributedSqliteSupported, false);
  assert.equal(hardeningImplementation.value, "docs/phase-62/horizontal-writer-hardening.md");
  assert.equal(hardeningImplementation.redacted, false);
  assert.equal(retryEvidence.value, "docs/phase-62/transaction-retry.md");
  assert.equal(retryEvidence.redacted, false);
  assert.ok(report.summary.includes("Phase 62"));
  assert.ok(report.warnings.some((warning) => warning.includes("horizontal app-writer")));
  assert.ok(
    report.checks.some(
      (check) =>
        check.id === "phase62-managed-postgres-horizontal-writer-hardening" &&
        check.status === "pass",
    ),
  );
  assert.equal(report.blockers.length, 0);
});

test("Phase 62 horizontal app-writer evidence does not unblock active-active topology", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      ...managedPostgresHorizontalWriterPhase62Env,
      ...distributedTopologyPhase56BundledEnv,
      ...distributedTopologyPhase57Env,
      ...distributedTopologyPhase58Env,
      ...distributedTopologyPhase59Env,
      ...distributedTopologyPhase60Env,
      ...distributedTopologyPhase61Env,
      TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterTopologyRequested, false);
  assert.equal(report.managedDatabase.phase62?.horizontalWriterRuntimeSupported, false);
  assert.equal(report.managedDatabase.phase62?.activeActiveSupported, false);
  assert.equal(report.managedDatabase.phase62?.genericMultiWriterDatabaseSupported, false);
  assert.equal(report.managedDatabase.phase61?.multiWriterTopologyRequested, true);
  assert.equal(report.managedDatabase.phase61?.runtimeSupported, false);
  assert.equal(report.managedDatabase.phase61?.multiWriterSupported, false);
  assert.ok(
    report.checks.some((check) => check.id === "single-writer-topology" && check.status === "fail"),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("active-active")));
});

test("production SQLite remains single-node advisory-supported without managed database intent", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    },
  });

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "single-node-sqlite");
  assert.equal(report.ready, true);
  assert.equal(report.managedDatabase.requested, false);
  assert.equal(report.managedDatabase.configured, false);
  assert.equal(report.managedDatabase.supported, false);
  assert.equal(report.observed.isProductionEnv, true);
  assert.equal(report.blockers.length, 0);
  assert.ok(report.checks.some((check) => check.id === "production-topology" && check.status === "pass"));
});

test("production JSON surfaces blockers for production database topology readiness", () => {
  const report = assessManagedDatabaseTopology({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "json",
    },
  });

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "production-blocked");
  assert.equal(report.ready, false);
  assert.equal(report.managedDatabase.requested, false);
  assert.ok(report.blockers.some((blocker) => blocker.includes("JSON storage")));
  assert.ok(report.nextSteps.some((step) => step.includes("advisory evidence")));
});
