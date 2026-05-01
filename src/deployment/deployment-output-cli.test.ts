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

test("formatDeploymentCliJson annotates Phase 56 implementation-readiness and rollout-safety gate", () => {
  const output = formatDeploymentCliJson({
    rolloutSafetyToken: "phase56-secret",
  }, { TASKLOOM_DATABASE_TOPOLOGY: "multi-writer" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    rolloutSafetyToken?: unknown;
    phase56?: {
      phase?: unknown;
      required?: unknown;
      multiWriterTopologyRequested?: unknown;
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
      summary?: unknown;
    };
  };

  assert.equal(report.rolloutSafetyToken, "[redacted]");
  assert.equal(report.phase56?.phase, "56");
  assert.equal(report.phase56?.required, true);
  assert.equal(report.phase56?.multiWriterTopologyRequested, true);
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
  assert.match(String(report.phase56?.summary), /Phase 56/);
  assert.doesNotMatch(output, /phase56-secret/);
});

test("formatDeploymentCliJson preserves nested Phase 56 readiness reports while keeping runtime support blocked", () => {
  const output = formatDeploymentCliJson({
    asyncStoreBoundary: {
      phase56MultiWriterRuntimeReadinessGate: {
        phase: "56",
        required: true,
        implementationReadinessEvidenceRequired: true,
        implementationReadinessEvidenceAttached: true,
        rolloutSafetyEvidenceRequired: true,
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
        rolloutSafetySecret: "phase56-rollout-secret",
        summary: "Phase 56 implementation-readiness and rollout-safety evidence is recorded.",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    asyncStoreBoundary?: {
      phase56MultiWriterRuntimeReadinessGate?: {
        rolloutSafetySecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
      };
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
  };

  assert.equal(report.phase56?.phase, "56");
  assert.equal(report.phase56?.required, true);
  assert.equal(report.phase56?.implementationReadinessEvidenceRequired, true);
  assert.equal(report.phase56?.implementationReadinessEvidenceAttached, true);
  assert.equal(report.phase56?.rolloutSafetyEvidenceRequired, true);
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
  assert.equal(report.asyncStoreBoundary?.phase56MultiWriterRuntimeReadinessGate?.rolloutSafetySecret, "[redacted]");
  assert.equal(report.asyncStoreBoundary?.phase56MultiWriterRuntimeReadinessGate?.runtimeSupport, false);
  assert.equal(report.asyncStoreBoundary?.phase56MultiWriterRuntimeReadinessGate?.multiWriterSupported, false);
  assert.equal(report.asyncStoreBoundary?.phase56MultiWriterRuntimeReadinessGate?.runtimeImplementationBlocked, true);
  assert.equal(report.asyncStoreBoundary?.phase56MultiWriterRuntimeReadinessGate?.runtimeSupportBlocked, true);
  assert.doesNotMatch(output, /phase56-rollout-secret/);
});

test("formatDeploymentCliJson annotates Phase 57 implementation-scope gate", () => {
  const output = formatDeploymentCliJson({
    implementationScopeToken: "phase57-secret",
  }, { TASKLOOM_DATABASE_TOPOLOGY: "multi-writer" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    implementationScopeToken?: unknown;
    phase57?: {
      phase?: unknown;
      required?: unknown;
      multiWriterTopologyRequested?: unknown;
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
      summary?: unknown;
    };
  };

  assert.equal(report.implementationScopeToken, "[redacted]");
  assert.equal(report.phase57?.phase, "57");
  assert.equal(report.phase57?.required, true);
  assert.equal(report.phase57?.multiWriterTopologyRequested, true);
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
  assert.match(String(report.phase57?.summary), /Phase 57/);
  assert.doesNotMatch(output, /phase57-secret/);
});

test("formatDeploymentCliJson preserves nested Phase 57 implementation-scope reports while blocking support claims", () => {
  const output = formatDeploymentCliJson({
    managedDatabaseRuntimeGuard: {
      phase57MultiWriterImplementationScopeGate: {
        phase: "57",
        required: true,
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
        implementationScopeSecret: "phase57-scope-secret",
        summary: "Phase 57 implementation scope is approved for non-production validation only.",
      },
    },
    releaseEvidence: {
      phase57: {
        implementationScopeEvidenceAttached: true,
        releaseAllowed: true,
        evidenceToken: "phase57-evidence-secret",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    managedDatabaseRuntimeGuard?: {
      phase57MultiWriterImplementationScopeGate?: {
        implementationScopeSecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
      };
    };
    releaseEvidence?: { phase57?: { evidenceToken?: unknown; releaseAllowed?: unknown } };
    phase57?: {
      phase?: unknown;
      required?: unknown;
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
  };

  assert.equal(report.phase57?.phase, "57");
  assert.equal(report.phase57?.required, true);
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
  assert.equal(report.phase57?.summary, "Phase 57 implementation scope is approved for non-production validation only.");
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase57MultiWriterImplementationScopeGate?.implementationScopeSecret,
    "[redacted]",
  );
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57MultiWriterImplementationScopeGate?.runtimeSupport, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57MultiWriterImplementationScopeGate?.multiWriterSupported, false);
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase57MultiWriterImplementationScopeGate?.runtimeImplementationBlocked,
    true,
  );
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57MultiWriterImplementationScopeGate?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57MultiWriterImplementationScopeGate?.releaseAllowed, false);
  assert.equal(report.releaseEvidence?.phase57?.evidenceToken, "[redacted]");
  assert.equal(report.releaseEvidence?.phase57?.releaseAllowed, false);
  assert.doesNotMatch(output, /phase57-scope-secret/);
  assert.doesNotMatch(output, /phase57-evidence-secret/);
});

test("formatDeploymentCliJson annotates Phase 58 runtime implementation validation gate", () => {
  const output = formatDeploymentCliJson({
    runtimeImplementationValidationToken: "phase58-secret",
  }, { TASKLOOM_DATABASE_TOPOLOGY: "multi-writer" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    runtimeImplementationValidationToken?: unknown;
    phase58?: {
      phase?: unknown;
      required?: unknown;
      multiWriterTopologyRequested?: unknown;
      runtimeImplementationValidationEvidenceRequired?: unknown;
      runtimeImplementationValidationEvidenceAttached?: unknown;
      runtimeImplementationValidated?: unknown;
      runtimeImplementationValidationGatePassed?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.runtimeImplementationValidationToken, "[redacted]");
  assert.equal(report.phase58?.phase, "58");
  assert.equal(report.phase58?.required, true);
  assert.equal(report.phase58?.multiWriterTopologyRequested, true);
  assert.equal(report.phase58?.runtimeImplementationValidationEvidenceRequired, true);
  assert.equal(report.phase58?.runtimeImplementationValidationEvidenceAttached, false);
  assert.equal(report.phase58?.runtimeImplementationValidated, false);
  assert.equal(report.phase58?.runtimeImplementationValidationGatePassed, false);
  assert.equal(report.phase58?.runtimeSupport, false);
  assert.equal(report.phase58?.runtimeSupported, false);
  assert.equal(report.phase58?.multiWriterSupported, false);
  assert.equal(report.phase58?.runtimeImplementationBlocked, true);
  assert.equal(report.phase58?.runtimeSupportBlocked, true);
  assert.equal(report.phase58?.releaseAllowed, false);
  assert.equal(report.phase58?.strictBlocker, true);
  assert.match(String(report.phase58?.summary), /Phase 58/);
  assert.doesNotMatch(output, /phase58-secret/);
});

test("formatDeploymentCliJson preserves nested Phase 58 validation reports while blocking support claims", () => {
  const output = formatDeploymentCliJson({
    managedDatabaseRuntimeGuard: {
      phase58MultiWriterRuntimeImplementationValidationGate: {
        phase: "58",
        required: true,
        runtimeImplementationValidationEvidenceAttached: true,
        runtimeImplementationValidated: true,
        runtimeImplementationValidationGatePassed: true,
        validationOwner: "database-platform",
        evidenceUrl: "https://evidence.example.com/phase58/runtime-validation",
        evidenceNote: "validation evidence recorded",
        documentationUrl: "https://docs.example.com/phase58",
        runtimeSupport: true,
        runtimeSupported: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        runtimeSupportBlocked: false,
        releaseAllowed: true,
        strictBlocker: false,
        validationSecret: "phase58-validation-secret",
        summary: "Phase 58 runtime implementation validation evidence is recorded.",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    managedDatabaseRuntimeGuard?: {
      phase58MultiWriterRuntimeImplementationValidationGate?: {
        evidenceUrl?: unknown;
        documentationUrl?: unknown;
        validationSecret?: unknown;
        runtimeSupport?: unknown;
        runtimeSupported?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
      };
    };
    phase58?: {
      phase?: unknown;
      required?: unknown;
      runtimeImplementationValidationEvidenceAttached?: unknown;
      runtimeImplementationValidated?: unknown;
      runtimeImplementationValidationGatePassed?: unknown;
      validationOwner?: unknown;
      evidenceUrl?: unknown;
      evidenceNote?: unknown;
      documentationUrl?: unknown;
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
  };

  assert.equal(report.phase58?.phase, "58");
  assert.equal(report.phase58?.required, true);
  assert.equal(report.phase58?.runtimeImplementationValidationEvidenceAttached, true);
  assert.equal(report.phase58?.runtimeImplementationValidated, true);
  assert.equal(report.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(report.phase58?.validationOwner, "database-platform");
  assert.equal(report.phase58?.evidenceUrl, "[redacted]");
  assert.equal(report.phase58?.evidenceNote, "validation evidence recorded");
  assert.equal(report.phase58?.documentationUrl, "https://docs.example.com/phase58");
  assert.equal(report.phase58?.runtimeSupport, false);
  assert.equal(report.phase58?.runtimeSupported, false);
  assert.equal(report.phase58?.multiWriterSupported, false);
  assert.equal(report.phase58?.runtimeImplementationBlocked, true);
  assert.equal(report.phase58?.runtimeSupportBlocked, true);
  assert.equal(report.phase58?.releaseAllowed, false);
  assert.equal(report.phase58?.strictBlocker, false);
  assert.equal(report.phase58?.validationSecret, "[redacted]");
  assert.equal(report.phase58?.summary, "Phase 58 runtime implementation validation evidence is recorded.");
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.evidenceUrl,
    "[redacted]",
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.documentationUrl,
    "https://docs.example.com/phase58",
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.validationSecret,
    "[redacted]",
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupport,
    false,
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupported,
    false,
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.multiWriterSupported,
    false,
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate
      ?.runtimeImplementationBlocked,
    true,
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupportBlocked,
    true,
  );
  assert.equal(
    report.managedDatabaseRuntimeGuard?.phase58MultiWriterRuntimeImplementationValidationGate?.releaseAllowed,
    false,
  );
  assert.doesNotMatch(output, /evidence\.example\.com/);
  assert.doesNotMatch(output, /phase58-validation-secret/);
});

test("formatDeploymentCliJson synthesizes Phase 59 enablement fields while blocking release claims", () => {
  const output = formatDeploymentCliJson({
    phase59EvidenceUrl: "https://evidence.example.com/phase59/approval",
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-window",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "release-council",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-04T01:00Z/2026-05-04T03:00Z",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "sre-observability",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "abort-plan-recorded",
    TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "https://tickets.example.com/MW-59",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase59EvidenceUrl?: unknown;
    phase59?: {
      phase?: unknown;
      required?: unknown;
      multiWriterTopologyRequested?: unknown;
      runtimeEnablementDecision?: unknown;
      runtimeEnablementApprover?: unknown;
      runtimeEnablementRolloutWindow?: unknown;
      runtimeEnablementMonitoringSignoff?: unknown;
      runtimeEnablementAbortPlan?: unknown;
      runtimeEnablementReleaseTicket?: unknown;
      runtimeEnablementDecisionRecorded?: unknown;
      runtimeEnablementApproverRecorded?: unknown;
      runtimeEnablementRolloutWindowRecorded?: unknown;
      runtimeEnablementMonitoringSignoffRecorded?: unknown;
      runtimeEnablementAbortPlanRecorded?: unknown;
      runtimeEnablementReleaseTicketRecorded?: unknown;
      runtimeEnablementApprovalEvidenceComplete?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase59EvidenceUrl, "[redacted]");
  assert.equal(report.phase59?.phase, "59");
  assert.equal(report.phase59?.required, true);
  assert.equal(report.phase59?.multiWriterTopologyRequested, true);
  assert.equal(report.phase59?.runtimeEnablementDecision, "approved-for-window");
  assert.equal(report.phase59?.runtimeEnablementApprover, "release-council");
  assert.equal(report.phase59?.runtimeEnablementRolloutWindow, "2026-05-04T01:00Z/2026-05-04T03:00Z");
  assert.equal(report.phase59?.runtimeEnablementMonitoringSignoff, "sre-observability");
  assert.equal(report.phase59?.runtimeEnablementAbortPlan, "abort-plan-recorded");
  assert.equal(report.phase59?.runtimeEnablementReleaseTicket, "[redacted]");
  assert.equal(report.phase59?.runtimeEnablementDecisionRecorded, true);
  assert.equal(report.phase59?.runtimeEnablementApproverRecorded, true);
  assert.equal(report.phase59?.runtimeEnablementRolloutWindowRecorded, true);
  assert.equal(report.phase59?.runtimeEnablementMonitoringSignoffRecorded, true);
  assert.equal(report.phase59?.runtimeEnablementAbortPlanRecorded, true);
  assert.equal(report.phase59?.runtimeEnablementReleaseTicketRecorded, true);
  assert.equal(report.phase59?.runtimeEnablementApprovalEvidenceComplete, true);
  assert.equal(report.phase59?.runtimeSupport, false);
  assert.equal(report.phase59?.runtimeSupported, false);
  assert.equal(report.phase59?.multiWriterSupported, false);
  assert.equal(report.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.phase59?.releaseAllowed, false);
  assert.equal(report.phase59?.strictBlocker, false);
  assert.match(String(report.phase59?.summary), /Phase 59/);
  assert.doesNotMatch(output, /evidence\.example\.com/);
  assert.doesNotMatch(output, /tickets\.example\.com/);
});

test("formatDeploymentCliJson preserves nested Phase 59 enablement reports while blocking support claims", () => {
  const output = formatDeploymentCliJson({
    releaseEvidence: {
      phase59MultiWriterRuntimeEnablementGate: {
        runtimeEnablementDecision: "approved",
        runtimeEnablementApprover: "release-council",
        runtimeEnablementRolloutWindow: "maintenance-window-59",
        runtimeEnablementMonitoringSignoff: "observability-ready",
        runtimeEnablementAbortPlan: "https://runbooks.example.com/phase59/abort",
        runtimeEnablementReleaseTicket: "MW-59",
        runtimeEnablementApprovalEvidenceComplete: true,
        approvalEvidenceUrl: "https://evidence.example.com/phase59/approval",
        runtimeSupport: true,
        runtimeSupported: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        runtimeSupportBlocked: false,
        releaseAllowed: true,
        strictBlocker: false,
        approvalSecret: "phase59-approval-secret",
        summary: "Phase 59 release enablement approval evidence is recorded.",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    releaseEvidence?: {
      phase59MultiWriterRuntimeEnablementGate?: {
        runtimeEnablementAbortPlan?: unknown;
        approvalEvidenceUrl?: unknown;
        runtimeSupport?: unknown;
        runtimeSupported?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
        approvalSecret?: unknown;
      };
    };
    phase59?: {
      phase?: unknown;
      runtimeEnablementDecision?: unknown;
      runtimeEnablementApprover?: unknown;
      runtimeEnablementRolloutWindow?: unknown;
      runtimeEnablementMonitoringSignoff?: unknown;
      runtimeEnablementAbortPlan?: unknown;
      runtimeEnablementReleaseTicket?: unknown;
      runtimeEnablementApprovalEvidenceComplete?: unknown;
      approvalEvidenceUrl?: unknown;
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
  };

  assert.equal(report.phase59?.phase, "59");
  assert.equal(report.phase59?.runtimeEnablementDecision, "approved");
  assert.equal(report.phase59?.runtimeEnablementApprover, "release-council");
  assert.equal(report.phase59?.runtimeEnablementRolloutWindow, "maintenance-window-59");
  assert.equal(report.phase59?.runtimeEnablementMonitoringSignoff, "observability-ready");
  assert.equal(report.phase59?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(report.phase59?.runtimeEnablementReleaseTicket, "MW-59");
  assert.equal(report.phase59?.runtimeEnablementApprovalEvidenceComplete, true);
  assert.equal(report.phase59?.approvalEvidenceUrl, "[redacted]");
  assert.equal(report.phase59?.runtimeSupport, false);
  assert.equal(report.phase59?.runtimeSupported, false);
  assert.equal(report.phase59?.multiWriterSupported, false);
  assert.equal(report.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.phase59?.releaseAllowed, false);
  assert.equal(report.phase59?.strictBlocker, false);
  assert.equal(report.phase59?.approvalSecret, "[redacted]");
  assert.equal(report.phase59?.summary, "Phase 59 release enablement approval evidence is recorded.");
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.approvalEvidenceUrl, "[redacted]");
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeSupport, false);
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeSupported, false);
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.multiWriterSupported, false);
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeImplementationBlocked, true);
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeSupportBlocked, true);
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.releaseAllowed, false);
  assert.equal(report.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.approvalSecret, "[redacted]");
  assert.doesNotMatch(output, /runbooks\.example\.com/);
  assert.doesNotMatch(output, /evidence\.example\.com/);
  assert.doesNotMatch(output, /phase59-approval-secret/);
});
