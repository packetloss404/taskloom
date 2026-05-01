import assert from "node:assert/strict";
import test from "node:test";
import { runManagedDatabaseTopologyCli } from "./managed-database-topology-cli.js";

test("runManagedDatabaseTopologyCli prints the report as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_DATABASE_TOPOLOGY: "managed" } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        readyForProductionManagedDatabase: false,
        topology: "managed-postgres",
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    readyForProductionManagedDatabase: false,
    topology: "managed-postgres",
  });
});

test("runManagedDatabaseTopologyCli fails strict mode when the report is not ready for managed DB production", async () => {
  let receivedStrict: boolean | undefined;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseTopologyReport: (_env, deps) => {
      receivedStrict = deps?.strict;
      return { readyForProductionManagedDatabase: false };
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(receivedStrict, true);
});

test("runManagedDatabaseTopologyCli blocks multi-writer topology with Phase 53 and Phase 54 status and redacted URLs", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: ["--strict"],
    env,
    out: (line) => output.push(line),
  });
  const serializedReport = output[0] ?? "";
  const report = JSON.parse(serializedReport) as {
    phase53?: { phase?: unknown; multiWriterSupported?: unknown };
    phase54?: { phase?: unknown; designPackageGatePassed?: unknown; strictBlocker?: unknown };
    phase55?: {
      phase?: unknown;
      designPackageReviewPassed?: unknown;
      implementationAuthorized?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      strictBlocker?: unknown;
    };
    phase56?: {
      phase?: unknown;
      required?: unknown;
      implementationReadinessEvidenceRequired?: unknown;
      implementationReadinessEvidenceAttached?: unknown;
      rolloutSafetyEvidenceRequired?: unknown;
      rolloutSafetyEvidenceAttached?: unknown;
      runtimeImplementationReady?: unknown;
      rolloutSafetyReady?: unknown;
      runtimeReadinessComplete?: unknown;
      implementationReadinessGatePassed?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
    };
    phase57?: {
      phase?: unknown;
      required?: unknown;
      implementationScopeEvidenceRequired?: unknown;
      implementationScopeEvidenceAttached?: unknown;
      implementationScopeApproved?: unknown;
      implementationScopeGatePassed?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
    };
    classification?: unknown;
    managedDatabase?: { supported?: unknown; phase54?: { designPackageGatePassed?: unknown; strictBlocker?: unknown } };
  };

  assert.equal(exitCode, 1);
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.managedDatabase?.supported, false);
  assert.equal(report.phase53?.phase, "53");
  assert.equal(report.phase53?.multiWriterSupported, false);
  assert.equal(report.phase54?.phase, "54");
  assert.equal(report.phase54?.designPackageGatePassed, false);
  assert.equal(report.phase54?.strictBlocker, true);
  assert.equal(report.phase55?.phase, "55");
  assert.equal(report.phase55?.designPackageReviewPassed, false);
  assert.equal(report.phase55?.implementationAuthorized, false);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterSupported, false);
  assert.equal(report.phase55?.runtimeImplementationBlocked, true);
  assert.equal(report.phase55?.strictBlocker, true);
  assert.equal(report.phase56?.phase, "56");
  assert.equal(report.phase56?.required, true);
  assert.equal(report.phase56?.implementationReadinessEvidenceRequired, true);
  assert.equal(report.phase56?.implementationReadinessEvidenceAttached, false);
  assert.equal(report.phase56?.rolloutSafetyEvidenceRequired, true);
  assert.equal(report.phase56?.rolloutSafetyEvidenceAttached, false);
  assert.equal(report.phase56?.runtimeImplementationReady, false);
  assert.equal(report.phase56?.rolloutSafetyReady, false);
  assert.equal(report.phase56?.runtimeReadinessComplete, false);
  assert.equal(report.phase56?.implementationReadinessGatePassed, false);
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.multiWriterSupported, false);
  assert.equal(report.phase56?.runtimeImplementationBlocked, true);
  assert.equal(report.phase56?.runtimeSupportBlocked, true);
  assert.equal(report.phase56?.releaseAllowed, false);
  assert.equal(report.phase56?.strictBlocker, true);
  assert.equal(report.phase57?.phase, "57");
  assert.equal(report.phase57?.required, true);
  assert.equal(report.phase57?.implementationScopeEvidenceRequired, true);
  assert.equal(report.phase57?.implementationScopeEvidenceAttached, false);
  assert.equal(report.phase57?.implementationScopeApproved, false);
  assert.equal(report.phase57?.implementationScopeGatePassed, false);
  assert.equal(report.phase57?.runtimeSupport, false);
  assert.equal(report.phase57?.multiWriterSupported, false);
  assert.equal(report.phase57?.runtimeImplementationBlocked, true);
  assert.equal(report.phase57?.runtimeSupportBlocked, true);
  assert.equal(report.phase57?.releaseAllowed, false);
  assert.equal(report.phase57?.strictBlocker, true);
  assert.equal(report.managedDatabase?.phase54?.designPackageGatePassed, false);
  assert.equal(report.managedDatabase?.phase54?.strictBlocker, true);
  assert.match(serializedReport, /Phase 53/);
  assert.match(serializedReport, /Phase 54/);
  assert.match(serializedReport, /Phase 55/);
  assert.match(serializedReport, /Phase 56/);
  assert.match(serializedReport, /Phase 57/);
  assert.match(serializedReport, /multi-writer/);
  assert.doesNotMatch(serializedReport, /taskloom:secret/);
});

test("runManagedDatabaseTopologyCli preserves Phase 55 review authorization fields from the builder", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase55: {
          designPackageReviewPassed: true,
          implementationAuthorized: true,
          reviewOwner: "architecture-council",
          runtimeSupport: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          strictBlocker: false,
          authorizationSecret: "phase55-cli-secret",
          summary: "Phase 55 review passed and implementation authorization is recorded.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase55?: {
      phase?: unknown;
      designPackageReviewPassed?: unknown;
      implementationAuthorized?: unknown;
      reviewOwner?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      strictBlocker?: unknown;
      authorizationSecret?: unknown;
      summary?: unknown;
    };
    managedDatabase?: {
      phase55?: {
        authorizationSecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
      };
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase55?.phase, "55");
  assert.equal(report.phase55?.designPackageReviewPassed, true);
  assert.equal(report.phase55?.implementationAuthorized, true);
  assert.equal(report.phase55?.reviewOwner, "architecture-council");
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterSupported, false);
  assert.equal(report.phase55?.runtimeImplementationBlocked, true);
  assert.equal(report.phase55?.strictBlocker, false);
  assert.equal(report.phase55?.authorizationSecret, "[redacted]");
  assert.equal(report.phase55?.summary, "Phase 55 review passed and implementation authorization is recorded.");
  assert.equal(report.managedDatabase?.phase55?.authorizationSecret, "[redacted]");
  assert.equal(report.managedDatabase?.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase55?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase55?.runtimeImplementationBlocked, true);
  assert.doesNotMatch(output[0] ?? "", /phase55-cli-secret/);
});

test("runManagedDatabaseTopologyCli preserves Phase 56 readiness fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase56: {
          implementationReadinessEvidenceAttached: true,
          rolloutSafetyEvidenceAttached: true,
          runtimeImplementationReady: true,
          rolloutSafetyReady: true,
          runtimeReadinessComplete: true,
          rolloutOwner: "release-engineering",
          runtimeSupport: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          rolloutSafetySecret: "phase56-cli-secret",
          summary: "Phase 56 implementation-readiness and rollout-safety evidence is recorded.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase56?: {
      phase?: unknown;
      implementationReadinessEvidenceAttached?: unknown;
      rolloutSafetyEvidenceAttached?: unknown;
      runtimeImplementationReady?: unknown;
      rolloutSafetyReady?: unknown;
      runtimeReadinessComplete?: unknown;
      implementationReadinessGatePassed?: unknown;
      rolloutOwner?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      rolloutSafetySecret?: unknown;
      summary?: unknown;
    };
    managedDatabase?: {
      phase56?: {
        rolloutSafetySecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
      };
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase56?.phase, "56");
  assert.equal(report.phase56?.implementationReadinessEvidenceAttached, true);
  assert.equal(report.phase56?.rolloutSafetyEvidenceAttached, true);
  assert.equal(report.phase56?.runtimeImplementationReady, true);
  assert.equal(report.phase56?.rolloutSafetyReady, true);
  assert.equal(report.phase56?.runtimeReadinessComplete, true);
  assert.equal(report.phase56?.implementationReadinessGatePassed, true);
  assert.equal(report.phase56?.rolloutOwner, "release-engineering");
  assert.equal(report.phase56?.runtimeSupport, false);
  assert.equal(report.phase56?.multiWriterSupported, false);
  assert.equal(report.phase56?.runtimeImplementationBlocked, true);
  assert.equal(report.phase56?.runtimeSupportBlocked, true);
  assert.equal(report.phase56?.releaseAllowed, false);
  assert.equal(report.phase56?.strictBlocker, false);
  assert.equal(report.phase56?.rolloutSafetySecret, "[redacted]");
  assert.equal(report.phase56?.summary, "Phase 56 implementation-readiness and rollout-safety evidence is recorded.");
  assert.equal(report.managedDatabase?.phase56?.rolloutSafetySecret, "[redacted]");
  assert.equal(report.managedDatabase?.phase56?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase56?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase56?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase?.phase56?.runtimeSupportBlocked, true);
  assert.doesNotMatch(output[0] ?? "", /phase56-cli-secret/);
});

test("runManagedDatabaseTopologyCli preserves Phase 57 implementation-scope fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase57: {
          implementationScopeEvidenceAttached: true,
          implementationScopeApproved: true,
          implementationScopeGatePassed: true,
          approvedImplementationScope: "single-region-shadow-write-validation",
          implementationOwner: "database-platform",
          runtimeSupport: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          implementationScopeSecret: "phase57-topology-secret",
          summary: "Phase 57 topology implementation scope is recorded.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase57?: {
      phase?: unknown;
      implementationScopeEvidenceAttached?: unknown;
      implementationScopeApproved?: unknown;
      implementationScopeGatePassed?: unknown;
      approvedImplementationScope?: unknown;
      implementationOwner?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      implementationScopeSecret?: unknown;
      summary?: unknown;
    };
    managedDatabase?: {
      phase57?: {
        implementationScopeSecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
      };
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase57?.phase, "57");
  assert.equal(report.phase57?.implementationScopeEvidenceAttached, true);
  assert.equal(report.phase57?.implementationScopeApproved, true);
  assert.equal(report.phase57?.implementationScopeGatePassed, true);
  assert.equal(report.phase57?.approvedImplementationScope, "single-region-shadow-write-validation");
  assert.equal(report.phase57?.implementationOwner, "database-platform");
  assert.equal(report.phase57?.runtimeSupport, false);
  assert.equal(report.phase57?.multiWriterSupported, false);
  assert.equal(report.phase57?.runtimeImplementationBlocked, true);
  assert.equal(report.phase57?.runtimeSupportBlocked, true);
  assert.equal(report.phase57?.releaseAllowed, false);
  assert.equal(report.phase57?.strictBlocker, false);
  assert.equal(report.phase57?.implementationScopeSecret, "[redacted]");
  assert.equal(report.phase57?.summary, "Phase 57 topology implementation scope is recorded.");
  assert.equal(report.managedDatabase?.phase57?.implementationScopeSecret, "[redacted]");
  assert.equal(report.managedDatabase?.phase57?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase57?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase57?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase?.phase57?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase?.phase57?.releaseAllowed, false);
  assert.doesNotMatch(output[0] ?? "", /phase57-topology-secret/);
});

test("runManagedDatabaseTopologyCli preserves Phase 58 validation fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase58: {
          runtimeImplementationValidationEvidenceAttached: true,
          runtimeImplementationValidated: true,
          runtimeImplementationValidationGatePassed: true,
          validationOwner: "database-platform",
          evidenceUrl: "https://evidence.example.com/phase58/topology-validation",
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          validationSecret: "phase58-topology-secret",
          summary: "Phase 58 topology runtime implementation validation is recorded.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase58?: {
      phase?: unknown;
      runtimeImplementationValidationEvidenceAttached?: unknown;
      runtimeImplementationValidated?: unknown;
      runtimeImplementationValidationGatePassed?: unknown;
      validationOwner?: unknown;
      evidenceUrl?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      validationSecret?: unknown;
      summary?: unknown;
    };
    managedDatabase?: {
      phase58?: {
        evidenceUrl?: unknown;
        runtimeSupport?: unknown;
        runtimeSupported?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
        validationSecret?: unknown;
      };
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase58?.phase, "58");
  assert.equal(report.phase58?.runtimeImplementationValidationEvidenceAttached, true);
  assert.equal(report.phase58?.runtimeImplementationValidated, true);
  assert.equal(report.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.phase58?.validationOwner, "database-platform");
  assert.equal(report.phase58?.evidenceUrl, "[redacted]");
  assert.equal(report.phase58?.runtimeSupport, false);
  assert.equal(report.phase58?.runtimeSupported, false);
  assert.equal(report.phase58?.multiWriterSupported, false);
  assert.equal(report.phase58?.runtimeImplementationBlocked, true);
  assert.equal(report.phase58?.runtimeSupportBlocked, true);
  assert.equal(report.phase58?.releaseAllowed, false);
  assert.equal(report.phase58?.strictBlocker, false);
  assert.equal(report.phase58?.validationSecret, "[redacted]");
  assert.equal(report.phase58?.summary, "Phase 58 topology runtime implementation validation is recorded.");
  assert.equal(report.managedDatabase?.phase58?.evidenceUrl, "[redacted]");
  assert.equal(report.managedDatabase?.phase58?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase58?.runtimeSupported, false);
  assert.equal(report.managedDatabase?.phase58?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase58?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase?.phase58?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase?.phase58?.releaseAllowed, false);
  assert.equal(report.managedDatabase?.phase58?.validationSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase58-topology-secret/);
});

test("runManagedDatabaseTopologyCli preserves Phase 59 enablement fields while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase59: {
          runtimeEnablementDecision: "approved",
          runtimeEnablementApprover: "release-council",
          runtimeEnablementRolloutWindow: "maintenance-window-59",
          runtimeEnablementMonitoringSignoff: "observability-ready",
          runtimeEnablementAbortPlan: "https://runbooks.example.com/phase59/topology-abort",
          runtimeEnablementReleaseTicket: "MW-59",
          runtimeEnablementApprovalEvidenceComplete: true,
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          approvalSecret: "phase59-topology-secret",
          summary: "Phase 59 topology release enablement approval is recorded.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase59?: {
      phase?: unknown;
      runtimeEnablementDecision?: unknown;
      runtimeEnablementAbortPlan?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      approvalSecret?: unknown;
      summary?: unknown;
    };
    managedDatabase?: {
      phase59?: {
        runtimeEnablementAbortPlan?: unknown;
        runtimeSupport?: unknown;
        runtimeSupported?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
        approvalSecret?: unknown;
      };
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase59?.phase, "59");
  assert.equal(report.phase59?.runtimeEnablementDecision, "approved");
  assert.equal(report.phase59?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(report.phase59?.runtimeSupport, false);
  assert.equal(report.phase59?.runtimeSupported, false);
  assert.equal(report.phase59?.multiWriterSupported, false);
  assert.equal(report.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.phase59?.releaseAllowed, false);
  assert.equal(report.phase59?.strictBlocker, false);
  assert.equal(report.phase59?.approvalSecret, "[redacted]");
  assert.equal(report.phase59?.summary, "Phase 59 topology release enablement approval is recorded.");
  assert.equal(report.managedDatabase?.phase59?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(report.managedDatabase?.phase59?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase59?.runtimeSupported, false);
  assert.equal(report.managedDatabase?.phase59?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabase?.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabase?.phase59?.releaseAllowed, false);
  assert.equal(report.managedDatabase?.phase59?.approvalSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /runbooks\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase59-topology-secret/);
});

test("runManagedDatabaseTopologyCli preserves detailed Phase 54 design-package reports from the builder", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase54: {
          multiWriterTopologyRequested: true,
          topologyOwnerConfigured: true,
          consistencyModelConfigured: true,
          failoverPitrPlanConfigured: true,
          migrationBackfillPlanConfigured: true,
          observabilityPlanConfigured: true,
          rollbackPlanConfigured: true,
          designPackageGatePassed: true,
          runtimeSupport: false,
          strictBlocker: false,
          summary: "Phase 54 design package evidence is complete.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase54?: {
      phase?: unknown;
      topologyOwnerConfigured?: unknown;
      designPackageGatePassed?: unknown;
      runtimeSupport?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
    managedDatabase?: { phase54?: { designPackageGatePassed?: unknown } };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase54?.phase, "54");
  assert.equal(report.phase54?.topologyOwnerConfigured, true);
  assert.equal(report.phase54?.designPackageGatePassed, true);
  assert.equal(report.phase54?.runtimeSupport, false);
  assert.equal(report.phase54?.strictBlocker, false);
  assert.equal(report.phase54?.summary, "Phase 54 design package evidence is complete.");
  assert.equal(report.managedDatabase?.phase54?.designPackageGatePassed, true);
});

test("runManagedDatabaseTopologyCli passes strict mode when the report is ready for managed DB production", async () => {
  const exitCode = await runManagedDatabaseTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseTopologyReport: () => ({ ready: true }),
  });

  assert.equal(exitCode, 0);
});

test("runManagedDatabaseTopologyCli returns an error exit code when the builder throws", async () => {
  const errors: string[] = [];

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    out: () => {},
    err: (line) => errors.push(line),
    buildManagedDatabaseTopologyReport: () => {
      throw new Error("managed database topology unavailable");
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(errors, ["managed database topology unavailable"]);
});
