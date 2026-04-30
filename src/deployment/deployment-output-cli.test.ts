import assert from "node:assert/strict";
import test from "node:test";
import { formatDeploymentCliJson } from "./deployment-output-cli.js";

test("formatDeploymentCliJson redacts secrets and annotates Phase 53 multi-writer requests", () => {
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
  } as NodeJS.ProcessEnv;

  const output = formatDeploymentCliJson({
    databaseUrl: "postgres://taskloom:super-secret@db.example.com/taskloom",
    env: {
      DATABASE_URL: {
        configured: true,
        value: "postgres://taskloom:super-secret@db.example.com/taskloom",
        redacted: true,
      },
    },
    nested: {
      schedulerToken: "token-value",
      publicValue: "visible",
    },
  }, env);
  const report = JSON.parse(output) as {
    databaseUrl?: unknown;
    env?: { DATABASE_URL?: { configured?: unknown; value?: unknown; redacted?: unknown } };
    nested?: { schedulerToken?: unknown; publicValue?: unknown };
    phase53?: { phase?: unknown; multiWriterTopologyRequested?: unknown; multiWriterSupported?: unknown };
  };

  assert.equal(report.databaseUrl, "[redacted]");
  assert.equal(report.env?.DATABASE_URL?.configured, true);
  assert.equal(report.env?.DATABASE_URL?.value, "[redacted]");
  assert.equal(report.env?.DATABASE_URL?.redacted, true);
  assert.equal(report.nested?.schedulerToken, "[redacted]");
  assert.equal(report.nested?.publicValue, "visible");
  assert.equal(report.phase53?.phase, "53");
  assert.equal(report.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.phase53?.multiWriterSupported, false);
  assert.doesNotMatch(output, /super-secret/);
  assert.match(output, /Phase 53/);
});

test("formatDeploymentCliJson preserves detailed Phase 53 report fields", () => {
  const output = formatDeploymentCliJson({
    phase53: {
      multiWriterTopologyRequested: true,
      requirementsEvidenceConfigured: true,
      designEvidenceConfigured: true,
      requirementsDesignGatePassed: true,
      runtimeSupport: false,
      strictBlocker: false,
      summary: "Phase 53 evidence is present; runtime support remains blocked.",
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase53?: {
      phase?: unknown;
      requirementsEvidenceConfigured?: unknown;
      designEvidenceConfigured?: unknown;
      requirementsDesignGatePassed?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase53?.phase, "53");
  assert.equal(report.phase53?.requirementsEvidenceConfigured, true);
  assert.equal(report.phase53?.designEvidenceConfigured, true);
  assert.equal(report.phase53?.requirementsDesignGatePassed, true);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.equal(report.phase53?.multiWriterSupported, false);
  assert.equal(report.phase53?.summary, "Phase 53 evidence is present; runtime support remains blocked.");
});

test("formatDeploymentCliJson preserves nested Phase 54 design-package reports for multi-writer intent", () => {
  const output = formatDeploymentCliJson({
    managedDatabase: {
      phase54: {
        multiWriterTopologyRequested: true,
        topologyOwnerConfigured: true,
        consistencyModelConfigured: true,
        failoverPitrPlanConfigured: true,
        migrationBackfillPlanConfigured: true,
        observabilityPlanConfigured: true,
        rollbackPlanConfigured: false,
        designPackageGatePassed: false,
        runtimeSupport: false,
        strictBlocker: true,
        summary: "Phase 54 design package is almost complete.",
        approvalToken: "phase54-secret",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "active-active" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    managedDatabase?: { phase54?: { approvalToken?: unknown; rollbackPlanConfigured?: unknown } };
    phase54?: {
      phase?: unknown;
      topologyOwnerConfigured?: unknown;
      rollbackPlanConfigured?: unknown;
      designPackageGatePassed?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
      approvalToken?: unknown;
    };
  };

  assert.equal(report.phase54?.phase, "54");
  assert.equal(report.phase54?.topologyOwnerConfigured, true);
  assert.equal(report.phase54?.rollbackPlanConfigured, false);
  assert.equal(report.phase54?.designPackageGatePassed, false);
  assert.equal(report.phase54?.strictBlocker, true);
  assert.equal(report.phase54?.summary, "Phase 54 design package is almost complete.");
  assert.equal(report.phase54?.approvalToken, "[redacted]");
  assert.equal(report.managedDatabase?.phase54?.rollbackPlanConfigured, false);
  assert.equal(report.managedDatabase?.phase54?.approvalToken, "[redacted]");
  assert.doesNotMatch(output, /phase54-secret/);
});

test("formatDeploymentCliJson annotates Phase 54 without overwriting an existing design-package report", () => {
  const output = formatDeploymentCliJson({
    phase54: {
      phase: "54-custom",
      multiWriterTopologyRequested: "already-recorded",
      designPackageGatePassed: true,
      runtimeSupport: "pending-runtime-review",
      strictBlocker: false,
      extraEvidence: { owner: "platform" },
      summary: "Existing Phase 54 report stays authoritative.",
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "multi-region" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase54?: {
      phase?: unknown;
      multiWriterTopologyRequested?: unknown;
      designPackageGatePassed?: unknown;
      runtimeSupport?: unknown;
      strictBlocker?: unknown;
      extraEvidence?: { owner?: unknown };
      summary?: unknown;
    };
  };

  assert.equal(report.phase54?.phase, "54-custom");
  assert.equal(report.phase54?.multiWriterTopologyRequested, "already-recorded");
  assert.equal(report.phase54?.designPackageGatePassed, true);
  assert.equal(report.phase54?.runtimeSupport, "pending-runtime-review");
  assert.equal(report.phase54?.strictBlocker, false);
  assert.equal(report.phase54?.extraEvidence?.owner, "platform");
  assert.equal(report.phase54?.summary, "Existing Phase 54 report stays authoritative.");
});

test("formatDeploymentCliJson annotates Phase 55 review and implementation authorization gate", () => {
  const output = formatDeploymentCliJson({
    implementationAuthorizationToken: "phase55-secret",
  }, { TASKLOOM_DATABASE_TOPOLOGY: "production" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    implementationAuthorizationToken?: unknown;
    phase55?: {
      phase?: unknown;
      multiWriterTopologyRequested?: unknown;
      designPackageReviewPassed?: unknown;
      implementationAuthorized?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.implementationAuthorizationToken, "[redacted]");
  assert.equal(report.phase55?.phase, "55");
  assert.equal(report.phase55?.multiWriterTopologyRequested, true);
  assert.equal(report.phase55?.designPackageReviewPassed, false);
  assert.equal(report.phase55?.implementationAuthorized, false);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterSupported, false);
  assert.equal(report.phase55?.runtimeImplementationBlocked, true);
  assert.equal(report.phase55?.strictBlocker, true);
  assert.match(String(report.phase55?.summary), /Phase 55/);
  assert.doesNotMatch(output, /phase55-secret/);
});

test("formatDeploymentCliJson preserves nested Phase 55 review reports while keeping runtime support blocked", () => {
  const output = formatDeploymentCliJson({
    managedDatabase: {
      phase55: {
        phase: "55",
        designPackageReviewPassed: true,
        implementationAuthorized: true,
        reviewBoard: "architecture-council",
        runtimeSupport: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        strictBlocker: false,
        authorizationSecret: "phase55-authorization-secret",
        summary: "Phase 55 review and implementation authorization are recorded.",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "active-active" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    managedDatabase?: {
      phase55?: {
        authorizationSecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
      };
    };
    phase55?: {
      phase?: unknown;
      designPackageReviewPassed?: unknown;
      implementationAuthorized?: unknown;
      reviewBoard?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      strictBlocker?: unknown;
      authorizationSecret?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase55?.phase, "55");
  assert.equal(report.phase55?.designPackageReviewPassed, true);
  assert.equal(report.phase55?.implementationAuthorized, true);
  assert.equal(report.phase55?.reviewBoard, "architecture-council");
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterSupported, false);
  assert.equal(report.phase55?.runtimeImplementationBlocked, true);
  assert.equal(report.phase55?.strictBlocker, false);
  assert.equal(report.phase55?.authorizationSecret, "[redacted]");
  assert.equal(report.phase55?.summary, "Phase 55 review and implementation authorization are recorded.");
  assert.equal(report.managedDatabase?.phase55?.authorizationSecret, "[redacted]");
  assert.equal(report.managedDatabase?.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase55?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase55?.runtimeImplementationBlocked, true);
  assert.doesNotMatch(output, /phase55-authorization-secret/);
});
