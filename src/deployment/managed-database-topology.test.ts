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
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 57")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support and release remain blocked")));
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
