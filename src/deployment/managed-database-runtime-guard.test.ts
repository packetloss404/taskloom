import assert from "node:assert/strict";
import test from "node:test";
import {
  assertManagedDatabaseRuntimeSupported,
  assessManagedDatabaseRuntimeGuard,
  buildManagedDatabaseRuntimeGuardReport,
  ManagedDatabaseRuntimeGuardError,
  type ManagedDatabaseRuntimeGuardObservedEnvValue,
} from "./managed-database-runtime-guard.js";

function observedEnvValue(
  report: ReturnType<typeof assessManagedDatabaseRuntimeGuard>,
  name: string,
): ManagedDatabaseRuntimeGuardObservedEnvValue {
  const entry = report.observed.env[name];
  assert.ok(entry, `expected observed env entry for ${name}`);
  return entry;
}

test("local JSON runtime is allowed by default", () => {
  const report = assessManagedDatabaseRuntimeGuard({ env: {} });

  assert.equal(report.phase, "46");
  assert.equal(report.allowed, true);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "local-json");
  assert.equal(report.observed.store, "json");
  assert.equal(report.observed.dbPath, null);
  assert.equal(report.phase50?.asyncAdapterAvailable, false);
  assert.equal(report.phase50?.backfillAvailable, false);
  assert.equal(report.phase50?.syncStartupSupported, false);
  assert.equal(report.phase51?.tracked, true);
  assert.equal(report.phase51?.runtimeCallSitesMigrated, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, false);
  assert.deepEqual(report.phase51?.remainingSyncCallSiteGroups, []);
  assert.equal(report.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.phase53?.multiWriterTopologyRequested, false);
  assert.equal(report.phase53?.requirementsEvidenceConfigured, false);
  assert.equal(report.phase53?.designEvidenceConfigured, false);
  assert.equal(report.phase53?.requirementsDesignGatePassed, true);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.equal(report.phase53?.strictBlocker, false);
  assert.equal(report.phase54?.multiWriterTopologyRequested, false);
  assert.equal(report.phase54?.topologyOwnerConfigured, false);
  assert.equal(report.phase54?.consistencyModelConfigured, false);
  assert.equal(report.phase54?.failoverPitrPlanConfigured, false);
  assert.equal(report.phase54?.migrationBackfillPlanConfigured, false);
  assert.equal(report.phase54?.observabilityPlanConfigured, false);
  assert.equal(report.phase54?.rollbackPlanConfigured, false);
  assert.equal(report.phase54?.designPackageGatePassed, true);
  assert.equal(report.phase54?.runtimeSupport, false);
  assert.equal(report.phase54?.strictBlocker, false);
  assert.equal(report.phase55?.multiWriterTopologyRequested, false);
  assert.equal(report.phase55?.designReviewerConfigured, false);
  assert.equal(report.phase55?.implementationApproverConfigured, false);
  assert.equal(report.phase55?.reviewStatus, null);
  assert.equal(report.phase55?.reviewStatusConfigured, false);
  assert.equal(report.phase55?.reviewStatusApproved, false);
  assert.equal(report.phase55?.approvedImplementationScopeConfigured, false);
  assert.equal(report.phase55?.safetySignoffConfigured, false);
  assert.equal(report.phase55?.implementationAuthorizationGatePassed, true);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.strictBlocker, false);
  assert.equal(report.phase56?.multiWriterTopologyRequested, false);
  assert.equal(report.phase56?.implementationAuthorizationGatePassed, true);
  assert.equal(report.phase56?.implementationPlanConfigured, false);
  assert.equal(report.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.phase56?.implementationReadinessGatePassed, true);
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.strictBlocker, false);
  assert.equal(report.blockers.length, 0);
  assert.ok(report.summary.includes("local JSON"));
  assert.ok(report.checks.some((check) => check.id === "supported-runtime-store" && check.status === "pass"));
});

test("single-node SQLite runtime is allowed", () => {
  const report = buildManagedDatabaseRuntimeGuardReport({
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_DATABASE_TOPOLOGY: "single-node-sqlite",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "single-node-sqlite");
  assert.equal(report.observed.store, "sqlite");
  assert.equal(report.observed.dbPath, "/srv/taskloom/taskloom.sqlite");
  assert.equal(report.observed.databaseTopology, "single-node-sqlite");
  assert.equal(report.phase50?.asyncAdapterConfigured, false);
  assert.equal(report.blockers.length, 0);
  assert.ok(report.summary.includes("single-node SQLite"));
});

test("managed database URL is redacted and blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });
  const urlEntry = observedEnvValue(report, "DATABASE_URL");

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(urlEntry.configured, true);
  assert.equal(urlEntry.redacted, true);
  assert.equal(urlEntry.value, "[redacted]");
  assert.equal(report.observed.databaseUrl, "[redacted]");
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 52 managed Postgres startup support requires")));
  assert.ok(report.warnings.some((warning) => warning.includes("redacted")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres")));
});

test("Phase 50 postgres adapter and managed URL allow Phase 52 managed Postgres startup", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });

  assert.equal(report.allowed, true);
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.phase50?.asyncAdapterConfigured, true);
  assert.equal(report.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.phase50?.backfillAvailable, true);
  assert.equal(report.phase50?.syncStartupSupported, false);
  assert.equal(report.phase50?.adapter, "postgres");
  assert.equal(report.phase51?.runtimeCallSitesMigrated, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, false);
  assert.equal(report.phase51?.strictBlocker, false);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
  assert.equal(report.phase52?.strictBlocker, false);
  assert.equal(report.phase53?.multiWriterTopologyRequested, false);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.ok(report.phase51?.summary.includes("Phase 52 separately decides"));
  assert.equal(report.observed.managedDatabaseAdapter, "postgres");
  assert.ok(report.summary.includes("Phase 52"));
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 50 async managed adapter/backfill capability")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 52 managed Postgres startup support is asserted")));
  assert.doesNotThrow(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_STORE: "sqlite",
        TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      }),
  );
});

test("Phase 51 incomplete migration blocks Phase 52 startup support", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    phase51: {
      remainingSyncCallSiteGroups: ["startup-store"],
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.phase51?.runtimeCallSitesMigrated, false);
  assert.equal(report.phase51?.managedPostgresStartupSupported, false);
  assert.equal(report.phase51?.strictBlocker, true);
  assert.equal(report.phase52?.managedPostgresStartupSupported, false);
  assert.ok(report.blockers.some((blocker) => blocker.includes("Phase 51 runtime call-site migration is complete")));
});

test("TASKLOOM_STORE=postgres is blocked at the managed runtime boundary", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "postgres",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(report.observed.store, "postgres");
  assert.ok(report.blockers.some((blocker) => blocker.includes("synchronous managed database runtime boundary")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("sync app startup path supported")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres")));
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_STORE: "postgres",
      }),
    ManagedDatabaseRuntimeGuardError,
  );
});

test("TASKLOOM_STORE=postgres is allowed when managed Postgres adapter and URL are configured", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });

  assert.equal(report.allowed, true);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.observed.store, "postgres");
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
  assert.ok(report.checks.some((check) => check.id === "supported-runtime-store" && check.status === "pass"));
});

test("TASKLOOM_STORE=managed is blocked at the managed runtime boundary", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "managed",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(report.observed.store, "managed");
  assert.ok(report.blockers.some((blocker) => blocker.includes("sync app startup path supported")));
});

test("TASKLOOM_STORE=managed is allowed when managed Postgres adapter and URL are configured", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "managed",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
    },
  });

  assert.equal(report.allowed, true);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.observed.store, "managed");
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
});

test("managed URL hints are redacted and block strict startup", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
    },
  });
  const managedUrl = observedEnvValue(report, "TASKLOOM_MANAGED_DATABASE_URL");
  const taskloomDatabaseUrl = observedEnvValue(report, "TASKLOOM_DATABASE_URL");

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(managedUrl.value, "[redacted]");
  assert.equal(managedUrl.redacted, true);
  assert.equal(taskloomDatabaseUrl.value, "[redacted]");
  assert.equal(taskloomDatabaseUrl.redacted, true);
  assert.ok(report.warnings.some((warning) => warning.includes("require Phase 52 managed Postgres startup support")));
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_STORE: "sqlite",
        TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
      }),
    ManagedDatabaseRuntimeGuardError,
  );
});

test("multi-writer topology is blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "multi-writer-blocked");
  assert.equal(report.observed.databaseTopology, "multi-writer");
  assert.equal(report.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.phase53?.requirementsEvidenceConfigured, false);
  assert.equal(report.phase53?.designEvidenceConfigured, false);
  assert.equal(report.phase53?.requirementsDesignGatePassed, false);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.equal(report.phase53?.strictBlocker, true);
  assert.equal(report.phase54?.multiWriterTopologyRequested, true);
  assert.equal(report.phase54?.topologyOwnerConfigured, false);
  assert.equal(report.phase54?.consistencyModelConfigured, false);
  assert.equal(report.phase54?.failoverPitrPlanConfigured, false);
  assert.equal(report.phase54?.migrationBackfillPlanConfigured, false);
  assert.equal(report.phase54?.observabilityPlanConfigured, false);
  assert.equal(report.phase54?.rollbackPlanConfigured, false);
  assert.equal(report.phase54?.designPackageGatePassed, false);
  assert.equal(report.phase54?.runtimeSupport, false);
  assert.equal(report.phase54?.strictBlocker, true);
  assert.equal(report.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.phase55?.designReviewerConfigured, false);
  assert.equal(report.phase55?.implementationApproverConfigured, false);
  assert.equal(report.phase55?.reviewStatusConfigured, false);
  assert.equal(report.phase55?.reviewStatusApproved, false);
  assert.equal(report.phase55?.approvedImplementationScopeConfigured, false);
  assert.equal(report.phase55?.safetySignoffConfigured, false);
  assert.equal(report.phase55?.implementationAuthorizationGatePassed, false);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.strictBlocker, true);
  assert.equal(report.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.phase56?.implementationAuthorizationGatePassed, false);
  assert.equal(report.phase56?.implementationPlanConfigured, false);
  assert.equal(report.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.strictBlocker, true);
  assert.ok(report.checks.some((check) => check.id === "single-writer-runtime" && check.status === "fail"));
  assert.ok(report.checks.some((check) => check.id === "phase53-multi-writer-design" && check.status === "fail"));
  assert.ok(report.checks.some((check) => check.id === "phase54-multi-writer-design-package" && check.status === "fail"));
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase55-multi-writer-implementation-authorization" && check.status === "fail",
    ),
  );
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase56-multi-writer-implementation-readiness" && check.status === "fail",
    ),
  );
  assert.ok(report.nextSteps.some((step) => step.includes("multi-writer runtime support")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE")));
});

test("active-active topology is blocked even with managed Postgres startup support", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "multi-writer-blocked");
  assert.equal(report.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.ok(report.blockers.some((blocker) => blocker.includes("active-active")));
});

test("distributed topology with Phase 53 and Phase 54 evidence remains blocked for runtime support", () => {
  const report = assessManagedDatabaseRuntimeGuard({
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

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "multi-writer-blocked");
  assert.equal(report.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.phase53?.requirementsEvidenceConfigured, true);
  assert.equal(report.phase53?.designEvidenceConfigured, true);
  assert.equal(report.phase53?.requirementsDesignGatePassed, true);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.equal(report.phase53?.strictBlocker, false);
  assert.equal(report.phase54?.multiWriterTopologyRequested, true);
  assert.equal(report.phase54?.topologyOwnerConfigured, true);
  assert.equal(report.phase54?.consistencyModelConfigured, true);
  assert.equal(report.phase54?.failoverPitrPlanConfigured, true);
  assert.equal(report.phase54?.migrationBackfillPlanConfigured, true);
  assert.equal(report.phase54?.observabilityPlanConfigured, true);
  assert.equal(report.phase54?.rollbackPlanConfigured, true);
  assert.equal(report.phase54?.designPackageGatePassed, true);
  assert.equal(report.phase54?.runtimeSupport, false);
  assert.equal(report.phase54?.strictBlocker, false);
  assert.equal(report.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.phase55?.designReviewerConfigured, false);
  assert.equal(report.phase55?.implementationApproverConfigured, false);
  assert.equal(report.phase55?.reviewStatus, null);
  assert.equal(report.phase55?.reviewStatusConfigured, false);
  assert.equal(report.phase55?.reviewStatusApproved, false);
  assert.equal(report.phase55?.approvedImplementationScopeConfigured, false);
  assert.equal(report.phase55?.safetySignoffConfigured, false);
  assert.equal(report.phase55?.implementationAuthorizationGatePassed, false);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.strictBlocker, true);
  assert.equal(report.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.phase56?.implementationAuthorizationGatePassed, false);
  assert.equal(report.phase56?.implementationPlanConfigured, false);
  assert.equal(report.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.strictBlocker, true);
  assert.equal(owner.configured, true);
  assert.equal(owner.value, "database-platform");
  assert.equal(owner.redacted, false);
  assert.ok(report.checks.some((check) => check.id === "phase53-multi-writer-design" && check.status === "pass"));
  assert.ok(report.checks.some((check) => check.id === "phase54-multi-writer-design-package" && check.status === "pass"));
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support remains blocked")));
});

test("distributed topology with Phase 55 authorization evidence still keeps runtime support blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
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
  const approver = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER");

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "multi-writer-blocked");
  assert.equal(report.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.phase55?.designReviewerConfigured, true);
  assert.equal(report.phase55?.implementationApproverConfigured, true);
  assert.equal(report.phase55?.reviewStatus, "approved");
  assert.equal(report.phase55?.reviewStatusConfigured, true);
  assert.equal(report.phase55?.reviewStatusApproved, true);
  assert.equal(report.phase55?.approvedImplementationScopeConfigured, true);
  assert.equal(report.phase55?.safetySignoffConfigured, true);
  assert.equal(report.phase55?.implementationAuthorizationGatePassed, true);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.strictBlocker, false);
  assert.equal(report.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.phase56?.implementationAuthorizationGatePassed, true);
  assert.equal(report.phase56?.implementationPlanConfigured, false);
  assert.equal(report.phase56?.rolloutPlanConfigured, false);
  assert.equal(report.phase56?.testValidationPlanConfigured, false);
  assert.equal(report.phase56?.dataSafetyPlanConfigured, false);
  assert.equal(report.phase56?.cutoverPlanConfigured, false);
  assert.equal(report.phase56?.rollbackDrillEvidenceConfigured, false);
  assert.equal(report.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.strictBlocker, true);
  assert.equal(approver.configured, true);
  assert.equal(approver.value, "engineering-director");
  assert.equal(approver.redacted, false);
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
  const report = assessManagedDatabaseRuntimeGuard({
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
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN: "docs/phase-56/implementation.md",
      TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN: "docs/phase-56/rollout.md",
      TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN: "docs/phase-56/test-validation.md",
      TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN: "docs/phase-56/data-safety.md",
      TASKLOOM_MULTI_WRITER_CUTOVER_PLAN: "docs/phase-56/cutover.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE: "docs/phase-56/rollback-drill.md",
    },
  });
  const implementationPlan = observedEnvValue(report, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN");

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "multi-writer-blocked");
  assert.equal(report.phase52?.managedPostgresStartupSupported, false);
  assert.equal(report.phase55?.implementationAuthorizationGatePassed, true);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase56?.multiWriterTopologyRequested, true);
  assert.equal(report.phase56?.implementationAuthorizationGatePassed, true);
  assert.equal(report.phase56?.implementationPlanConfigured, true);
  assert.equal(report.phase56?.rolloutPlanConfigured, true);
  assert.equal(report.phase56?.testValidationPlanConfigured, true);
  assert.equal(report.phase56?.dataSafetyPlanConfigured, true);
  assert.equal(report.phase56?.cutoverPlanConfigured, true);
  assert.equal(report.phase56?.rollbackDrillEvidenceConfigured, true);
  assert.equal(report.phase56?.implementationReadinessGatePassed, true);
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.strictBlocker, false);
  assert.equal(implementationPlan.configured, true);
  assert.equal(implementationPlan.value, "docs/phase-56/implementation.md");
  assert.equal(implementationPlan.redacted, false);
  assert.ok(
    report.checks.some(
      (check) => check.id === "phase56-multi-writer-implementation-readiness" && check.status === "pass",
    ),
  );
  assert.ok(report.blockers.some((blocker) => blocker.includes("distributed")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 56")));
  assert.ok(report.warnings.some((warning) => warning.includes("runtime support remains blocked")));
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
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
        TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN: "docs/phase-56/implementation.md",
        TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN: "docs/phase-56/rollout.md",
        TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN: "docs/phase-56/test-validation.md",
        TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN: "docs/phase-56/data-safety.md",
        TASKLOOM_MULTI_WRITER_CUTOVER_PLAN: "docs/phase-56/cutover.md",
        TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE: "docs/phase-56/rollback-drill.md",
      }),
    ManagedDatabaseRuntimeGuardError,
  );
});

test("unsupported store is blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "memory",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "unsupported-store");
  assert.equal(report.observed.store, "memory");
  assert.ok(report.blockers.some((blocker) => blocker.includes("TASKLOOM_STORE=memory")));
});

test("explicit bypass warns but allows assert helper to continue", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS: "true",
    },
  });

  assert.equal(report.allowed, true);
  assert.equal(report.status, "warn");
  assert.equal(report.classification, "bypassed");
  assert.equal(report.observed.bypassEnabled, true);
  assert.equal(observedEnvValue(report, "TASKLOOM_MANAGED_DATABASE_URL").value, "[redacted]");
  assert.ok(report.blockers.length > 0);
  assert.ok(report.warnings.some((warning) => warning.includes("bypassed")));
  assert.doesNotThrow(() =>
    assertManagedDatabaseRuntimeSupported({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS: "true",
    }),
  );
});

test("assert helper throws when unsupported runtime is not bypassed", () => {
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_DATABASE_TOPOLOGY: "distributed",
      }),
    (error) => {
      assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
      assert.equal(error.report.phase, "46");
      assert.equal(error.report.allowed, false);
      assert.equal(error.report.classification, "multi-writer-blocked");
      return true;
    },
  );
});
