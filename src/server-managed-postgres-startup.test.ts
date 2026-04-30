import assert from "node:assert/strict";
import test from "node:test";
import {
  assertManagedDatabaseRuntimeSupported,
  ManagedDatabaseRuntimeGuardError,
  type ManagedDatabaseRuntimeGuardEnv,
} from "./deployment/managed-database-runtime-guard.js";

const COMPLETE_MULTI_WRITER_TOPOLOGY_REVIEW_AUTHORIZATION_EVIDENCE = {
  TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-53/multi-writer-requirements.md",
  TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-53/multi-writer-design.md",
  TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
  TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes with explicit conflict handling review",
  TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "docs/phase-54/failover-pitr.md",
  TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "docs/phase-54/migration-backfill.md",
  TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "docs/phase-54/observability.md",
  TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "docs/phase-54/rollback.md",
  TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "release-owner",
  TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
  TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "phase-55-design-package-review-only",
  TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety-signoff.md",
} satisfies Partial<ManagedDatabaseRuntimeGuardEnv>;

function assertServerStartupRuntimeSupported(env: ManagedDatabaseRuntimeGuardEnv) {
  return assertManagedDatabaseRuntimeSupported(env, {
    phase51: {
      remainingSyncCallSiteGroups: [],
      managedPostgresStartupSupported: true,
    },
  });
}

test("server startup guard keeps local JSON allowed", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "json",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "local-json");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
});

test("server startup guard keeps single-node SQLite allowed", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "data/taskloom.sqlite",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "single-node-sqlite");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
});

test("server startup guard allows asserted single-writer managed Postgres startup", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "single-writer",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.phase51?.managedPostgresStartupSupported, true);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
});

test("server startup guard allows explicit single-writer TASKLOOM_STORE=postgres startup", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "postgres",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgresql",
    TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "single-writer",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, true);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
});

test("server startup guard keeps single-writer managed Postgres allowed with multi-writer design evidence present", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "postgres",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "single-writer",
    TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-54/multi-writer-requirements.md",
    TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-54/multi-writer-design-package.md",
    TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
    TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "release-owner",
    TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
    TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "phase-55-design-package-review-only",
    TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety-signoff.md",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
  assert.equal(report.phase53?.multiWriterTopologyRequested, false);
  assert.equal(report.phase53?.requirementsEvidenceConfigured, true);
  assert.equal(report.phase53?.designEvidenceConfigured, true);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterTopologyRequested, false);
  assert.equal(report.phase55?.runtimeSupport, false);
});

test("server startup guard blocks multi-writer runtime even with Phase 55 review and authorization evidence", () => {
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    assert.throws(
      () =>
        assertServerStartupRuntimeSupported({
          TASKLOOM_STORE: "postgres",
          TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
          TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
          TASKLOOM_DATABASE_TOPOLOGY: topology,
          ...COMPLETE_MULTI_WRITER_TOPOLOGY_REVIEW_AUTHORIZATION_EVIDENCE,
        }),
      (error) => {
        assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
        assert.equal(error.report.allowed, false);
        assert.equal(error.report.classification, "multi-writer-blocked");
        assert.equal(error.report.managedDatabaseRuntimeBlocked, true);
        assert.equal(error.report.observed.databaseTopology, topology);
        assert.equal(error.report.phase52?.managedPostgresStartupSupported, false);
        assert.equal(error.report.phase53?.requirementsDesignGatePassed, true);
        assert.equal(error.report.phase53?.runtimeSupport, false);
        assert.equal(error.report.phase54?.designPackageGatePassed, true);
        assert.equal(error.report.phase54?.runtimeSupport, false);
        assert.equal(error.report.phase55?.implementationAuthorizationGatePassed, true);
        assert.equal(error.report.phase55?.reviewStatusApproved, true);
        assert.equal(error.report.phase55?.runtimeSupport, false);
        assert.match(error.report.phase55?.summary ?? "", /runtime support remains blocked/i);
        assert.match(error.report.summary, /blocked unsupported managed database or multi-writer runtime/i);
        assert.ok(error.report.blockers.some((blocker) => blocker.includes("TASKLOOM_DATABASE_TOPOLOGY")));
        return true;
      },
    );
  }
});

test("server startup guard still blocks multi-writer, distributed, and active-active topologies before startup", () => {
  const blockedTopologies = ["multi-writer", "distributed", "active-active", "multi-region"] as const;

  for (const topology of blockedTopologies) {
    assert.throws(
      () =>
        assertServerStartupRuntimeSupported({
          TASKLOOM_STORE: "postgres",
          TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
          TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
          TASKLOOM_DATABASE_TOPOLOGY: topology,
        }),
      (error) => {
        assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
        assert.equal(error.report.allowed, false);
        assert.equal(error.report.classification, "multi-writer-blocked");
        assert.equal(error.report.managedDatabaseRuntimeBlocked, true);
        assert.equal(error.report.observed.databaseTopology, topology);
        assert.equal(error.report.phase50?.asyncAdapterAvailable, true);
        assert.equal(error.report.phase52?.managedPostgresStartupSupported, false);
        assert.match(error.report.phase52?.summary ?? "", /multi-writer, distributed, or active-active/);
        return true;
      },
    );
  }
});

test("server startup guard blocks multi-writer runtime even when requirements and design evidence are configured", () => {
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    assert.throws(
      () =>
        assertServerStartupRuntimeSupported({
          TASKLOOM_STORE: "postgres",
          TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
          TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
          TASKLOOM_DATABASE_TOPOLOGY: topology,
          TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-54/multi-writer-requirements.md",
          TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-54/multi-writer-design-package.md",
        }),
      (error) => {
        assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
        assert.equal(error.report.allowed, false);
        assert.equal(error.report.classification, "multi-writer-blocked");
        assert.equal(error.report.managedDatabaseRuntimeBlocked, true);
        assert.equal(error.report.observed.databaseTopology, topology);
        assert.equal(error.report.phase52?.managedPostgresStartupSupported, false);
        assert.equal(error.report.phase53?.multiWriterTopologyRequested, true);
        assert.equal(error.report.phase53?.requirementsEvidenceConfigured, true);
        assert.equal(error.report.phase53?.designEvidenceConfigured, true);
        assert.equal(error.report.phase53?.requirementsDesignGatePassed, true);
        assert.equal(error.report.phase53?.runtimeSupport, false);
        assert.match(error.report.phase53?.summary ?? "", /runtime support remains blocked/);
        assert.ok(error.report.blockers.some((blocker) => blocker.includes("TASKLOOM_DATABASE_TOPOLOGY")));
        return true;
      },
    );
  }
});
