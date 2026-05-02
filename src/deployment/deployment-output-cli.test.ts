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

test("formatDeploymentCliJson synthesizes Phase 60 support-presence fields while blocking release claims", () => {
  const output = formatDeploymentCliJson({
    phase60EvidenceUrl: "https://evidence.example.com/phase60/support-presence",
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "implementation-asserted",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT:
      "runtime support remains blocked pending owner acceptance",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX:
      "https://evidence.example.com/phase60/compatibility-matrix",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE:
      "https://evidence.example.com/phase60/cutover-evidence",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL:
      "https://approvals.example.com/phase60/release-automation",
    TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "owner-acceptance-recorded",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase60EvidenceUrl?: unknown;
    phase60?: {
      phase?: unknown;
      required?: unknown;
      multiWriterTopologyRequested?: unknown;
      runtimeSupportImplementationPresent?: unknown;
      runtimeSupportExplicitSupportStatement?: unknown;
      runtimeSupportCompatibilityMatrix?: unknown;
      runtimeSupportCutoverEvidence?: unknown;
      runtimeSupportReleaseAutomationApproval?: unknown;
      runtimeSupportOwnerAcceptance?: unknown;
      runtimeSupportPresenceAssertionComplete?: unknown;
      runtimeSupportPresenceAssertionGatePassed?: unknown;
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

  assert.equal(report.phase60EvidenceUrl, "[redacted]");
  assert.equal(report.phase60?.phase, "60");
  assert.equal(report.phase60?.required, true);
  assert.equal(report.phase60?.multiWriterTopologyRequested, true);
  assert.equal(report.phase60?.runtimeSupportImplementationPresent, "implementation-asserted");
  assert.equal(
    report.phase60?.runtimeSupportExplicitSupportStatement,
    "runtime support remains blocked pending owner acceptance",
  );
  assert.equal(report.phase60?.runtimeSupportCompatibilityMatrix, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportCutoverEvidence, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportReleaseAutomationApproval, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportOwnerAcceptance, "owner-acceptance-recorded");
  assert.equal(report.phase60?.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(report.phase60?.runtimeSupportPresenceAssertionGatePassed, true);
  assert.equal(report.phase60?.runtimeSupport, false);
  assert.equal(report.phase60?.runtimeSupported, false);
  assert.equal(report.phase60?.multiWriterSupported, false);
  assert.equal(report.phase60?.runtimeImplementationBlocked, true);
  assert.equal(report.phase60?.runtimeSupportBlocked, true);
  assert.equal(report.phase60?.releaseAllowed, false);
  assert.equal(report.phase60?.strictBlocker, false);
  assert.match(String(report.phase60?.summary), /Phase 60/);
  assert.doesNotMatch(output, /evidence\.example\.com/);
  assert.doesNotMatch(output, /approvals\.example\.com/);
});

test("formatDeploymentCliJson preserves nested Phase 60 support-presence reports while blocking support claims", () => {
  const output = formatDeploymentCliJson({
    releaseEvidence: {
      phase60MultiWriterRuntimeSupportPresenceAssertionGate: {
        implementationPresent: "implementation-present",
        explicitSupportStatement: "explicit support statement captured",
        compatibilityMatrix: "https://evidence.example.com/phase60/nested-matrix",
        cutoverEvidence: "https://evidence.example.com/phase60/nested-cutover",
        releaseAutomationApproval: "https://approvals.example.com/phase60/nested-release-automation",
        ownerAcceptance: "owner-accepted",
        runtimeSupportPresenceAssertionComplete: true,
        runtimeSupport: true,
        runtimeSupported: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        runtimeSupportBlocked: false,
        releaseAllowed: true,
        strictBlocker: false,
        assertionSecret: "phase60-assertion-secret",
        summary: "Phase 60 support presence assertion evidence is recorded.",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    releaseEvidence?: {
      phase60MultiWriterRuntimeSupportPresenceAssertionGate?: {
        compatibilityMatrix?: unknown;
        cutoverEvidence?: unknown;
        releaseAutomationApproval?: unknown;
        runtimeSupport?: unknown;
        runtimeSupported?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
        assertionSecret?: unknown;
      };
    };
    phase60?: {
      phase?: unknown;
      runtimeSupportImplementationPresent?: unknown;
      runtimeSupportExplicitSupportStatement?: unknown;
      runtimeSupportCompatibilityMatrix?: unknown;
      runtimeSupportCutoverEvidence?: unknown;
      runtimeSupportReleaseAutomationApproval?: unknown;
      runtimeSupportOwnerAcceptance?: unknown;
      runtimeSupportPresenceAssertionComplete?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      assertionSecret?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase60?.phase, "60");
  assert.equal(report.phase60?.runtimeSupportImplementationPresent, "implementation-present");
  assert.equal(report.phase60?.runtimeSupportExplicitSupportStatement, "explicit support statement captured");
  assert.equal(report.phase60?.runtimeSupportCompatibilityMatrix, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportCutoverEvidence, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportReleaseAutomationApproval, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportOwnerAcceptance, "owner-accepted");
  assert.equal(report.phase60?.runtimeSupportPresenceAssertionComplete, true);
  assert.equal(report.phase60?.runtimeSupport, false);
  assert.equal(report.phase60?.runtimeSupported, false);
  assert.equal(report.phase60?.multiWriterSupported, false);
  assert.equal(report.phase60?.runtimeImplementationBlocked, true);
  assert.equal(report.phase60?.runtimeSupportBlocked, true);
  assert.equal(report.phase60?.releaseAllowed, false);
  assert.equal(report.phase60?.strictBlocker, false);
  assert.equal(report.phase60?.assertionSecret, "[redacted]");
  assert.equal(report.phase60?.summary, "Phase 60 support presence assertion evidence is recorded.");
  assert.equal(
    report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.compatibilityMatrix,
    "[redacted]",
  );
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.cutoverEvidence, "[redacted]");
  assert.equal(
    report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAutomationApproval,
    "[redacted]",
  );
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupport, false);
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupported, false);
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.multiWriterSupported, false);
  assert.equal(
    report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeImplementationBlocked,
    true,
  );
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupportBlocked, true);
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAllowed, false);
  assert.equal(report.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.assertionSecret, "[redacted]");
  assert.doesNotMatch(output, /evidence\.example\.com/);
  assert.doesNotMatch(output, /approvals\.example\.com/);
  assert.doesNotMatch(output, /phase60-assertion-secret/);
});

test("formatDeploymentCliJson synthesizes Phase 61 unsupported-claim evidence while blocking support claims", () => {
  const output = formatDeploymentCliJson({
    phase61EvidenceUrl: "https://evidence.example.com/phase61/unsupported-claims",
    runtimeClaims: {
      activeActiveSupport: true,
      regionalSupport: true,
      pitrSupport: true,
      sqliteDistributedSupport: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    TASKLOOM_PHASE61_ACTIVE_ACTIVE_CLAIM_EVIDENCE: "https://evidence.example.com/phase61/active-active",
    TASKLOOM_PHASE61_REGIONAL_CLAIM_EVIDENCE: "regional-claim-reviewed",
    TASKLOOM_PHASE61_PITR_CLAIM_EVIDENCE: "https://evidence.example.com/phase61/pitr",
    TASKLOOM_PHASE61_SQLITE_DISTRIBUTED_CLAIM_EVIDENCE: "sqlite-distributed-claim-reviewed",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase61EvidenceUrl?: unknown;
    runtimeClaims?: {
      activeActiveSupport?: unknown;
      regionalSupport?: unknown;
      pitrSupport?: unknown;
      sqliteDistributedSupport?: unknown;
    };
    phase61?: {
      phase?: unknown;
      activeActiveClaimEvidence?: unknown;
      regionalClaimEvidence?: unknown;
      pitrClaimEvidence?: unknown;
      sqliteDistributedClaimEvidence?: unknown;
      unsupportedRuntimeReleaseClaimsComplete?: unknown;
      unsupportedRuntimeReleaseClaimsGatePassed?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      releaseSupported?: unknown;
      multiWriterSupported?: unknown;
      activeActiveSupport?: unknown;
      activeActiveSupported?: unknown;
      regionalSupport?: unknown;
      regionalSupported?: unknown;
      pitrSupport?: unknown;
      pitrSupported?: unknown;
      sqliteDistributedSupport?: unknown;
      sqliteDistributedSupported?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase61EvidenceUrl, "[redacted]");
  assert.equal(report.runtimeClaims?.activeActiveSupport, false);
  assert.equal(report.runtimeClaims?.regionalSupport, false);
  assert.equal(report.runtimeClaims?.pitrSupport, false);
  assert.equal(report.runtimeClaims?.sqliteDistributedSupport, false);
  assert.equal(report.phase61?.phase, "61");
  assert.equal(report.phase61?.activeActiveClaimEvidence, "[redacted]");
  assert.equal(report.phase61?.regionalClaimEvidence, "regional-claim-reviewed");
  assert.equal(report.phase61?.pitrClaimEvidence, "[redacted]");
  assert.equal(report.phase61?.sqliteDistributedClaimEvidence, "sqlite-distributed-claim-reviewed");
  assert.equal(report.phase61?.unsupportedRuntimeReleaseClaimsComplete, true);
  assert.equal(report.phase61?.unsupportedRuntimeReleaseClaimsGatePassed, true);
  assert.equal(report.phase61?.runtimeSupport, false);
  assert.equal(report.phase61?.runtimeSupported, false);
  assert.equal(report.phase61?.releaseSupported, false);
  assert.equal(report.phase61?.multiWriterSupported, false);
  assert.equal(report.phase61?.activeActiveSupport, false);
  assert.equal(report.phase61?.activeActiveSupported, false);
  assert.equal(report.phase61?.regionalSupport, false);
  assert.equal(report.phase61?.regionalSupported, false);
  assert.equal(report.phase61?.pitrSupport, false);
  assert.equal(report.phase61?.pitrSupported, false);
  assert.equal(report.phase61?.sqliteDistributedSupport, false);
  assert.equal(report.phase61?.sqliteDistributedSupported, false);
  assert.equal(report.phase61?.releaseAllowed, false);
  assert.equal(report.phase61?.strictBlocker, false);
  assert.match(String(report.phase61?.summary), /Phase 61/);
  assert.doesNotMatch(output, /evidence\.example\.com/);
});

test("formatDeploymentCliJson preserves nested Phase 61 reports while blocking unsupported claims", () => {
  const output = formatDeploymentCliJson({
    releaseEvidence: {
      phase61UnsupportedRuntimeReleaseClaimsGate: {
        activeActiveClaimEvidence: "https://evidence.example.com/phase61/nested-active-active",
        regionalClaimEvidence: "regional-reviewed",
        pitrClaimEvidence: "https://evidence.example.com/phase61/nested-pitr",
        sqliteDistributedClaimEvidence: "sqlite-reviewed",
        unsupportedRuntimeReleaseClaimsComplete: true,
        runtimeSupport: true,
        runtimeSupported: true,
        releaseSupported: true,
        multiWriterSupported: true,
        activeActiveSupport: true,
        activeActiveSupported: true,
        regionalSupport: true,
        regionalSupported: true,
        pitrSupport: true,
        pitrSupported: true,
        sqliteDistributedSupport: true,
        sqliteDistributedSupported: true,
        releaseAllowed: true,
        strictBlocker: false,
        claimSecret: "phase61-claim-secret",
        summary: "Phase 61 unsupported runtime/release claim evidence is recorded.",
      },
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "active-active" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    releaseEvidence?: {
      phase61UnsupportedRuntimeReleaseClaimsGate?: {
        activeActiveClaimEvidence?: unknown;
        pitrClaimEvidence?: unknown;
        runtimeSupport?: unknown;
        activeActiveSupport?: unknown;
        regionalSupport?: unknown;
        pitrSupport?: unknown;
        sqliteDistributedSupport?: unknown;
        releaseAllowed?: unknown;
        claimSecret?: unknown;
      };
    };
    phase61?: {
      phase?: unknown;
      activeActiveClaimEvidence?: unknown;
      regionalClaimEvidence?: unknown;
      pitrClaimEvidence?: unknown;
      sqliteDistributedClaimEvidence?: unknown;
      unsupportedRuntimeReleaseClaimsComplete?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      releaseSupported?: unknown;
      multiWriterSupported?: unknown;
      activeActiveSupport?: unknown;
      activeActiveSupported?: unknown;
      regionalSupport?: unknown;
      regionalSupported?: unknown;
      pitrSupport?: unknown;
      pitrSupported?: unknown;
      sqliteDistributedSupport?: unknown;
      sqliteDistributedSupported?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      claimSecret?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase61?.phase, "61");
  assert.equal(report.phase61?.activeActiveClaimEvidence, "[redacted]");
  assert.equal(report.phase61?.regionalClaimEvidence, "regional-reviewed");
  assert.equal(report.phase61?.pitrClaimEvidence, "[redacted]");
  assert.equal(report.phase61?.sqliteDistributedClaimEvidence, "sqlite-reviewed");
  assert.equal(report.phase61?.unsupportedRuntimeReleaseClaimsComplete, true);
  assert.equal(report.phase61?.runtimeSupport, false);
  assert.equal(report.phase61?.runtimeSupported, false);
  assert.equal(report.phase61?.releaseSupported, false);
  assert.equal(report.phase61?.multiWriterSupported, false);
  assert.equal(report.phase61?.activeActiveSupport, false);
  assert.equal(report.phase61?.activeActiveSupported, false);
  assert.equal(report.phase61?.regionalSupport, false);
  assert.equal(report.phase61?.regionalSupported, false);
  assert.equal(report.phase61?.pitrSupport, false);
  assert.equal(report.phase61?.pitrSupported, false);
  assert.equal(report.phase61?.sqliteDistributedSupport, false);
  assert.equal(report.phase61?.sqliteDistributedSupported, false);
  assert.equal(report.phase61?.releaseAllowed, false);
  assert.equal(report.phase61?.strictBlocker, false);
  assert.equal(report.phase61?.claimSecret, "[redacted]");
  assert.equal(report.phase61?.summary, "Phase 61 unsupported runtime/release claim evidence is recorded.");
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.activeActiveClaimEvidence, "[redacted]");
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.pitrClaimEvidence, "[redacted]");
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.runtimeSupport, false);
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.activeActiveSupport, false);
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.regionalSupport, false);
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.pitrSupport, false);
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.sqliteDistributedSupport, false);
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.releaseAllowed, false);
  assert.equal(report.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.claimSecret, "[redacted]");
  assert.doesNotMatch(output, /evidence\.example\.com/);
  assert.doesNotMatch(output, /phase61-claim-secret/);
});

test("formatDeploymentCliJson synthesizes Phase 62 horizontal writer hardening while blocking unsupported topologies", () => {
  const output = formatDeploymentCliJson({
    asyncStoreBoundary: {
      phase52ManagedStartupSupported: true,
    },
    phase61: {
      activationReady: true,
    },
    runtimeClaims: {
      activeActiveSupport: true,
      pitrSupport: true,
      sqliteDistributedSupport: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION: "hardening://phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE: "https://tests:secret@evidence.internal/phase62",
    TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE: "transaction-retry://phase62",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    runtimeClaims?: {
      activeActiveSupport?: unknown;
      pitrSupport?: unknown;
      sqliteDistributedSupport?: unknown;
    };
    phase62?: {
      phase?: unknown;
      horizontalWriterTopologyRequested?: unknown;
      horizontalWriterHardeningImplementation?: unknown;
      horizontalWriterConcurrencyTestEvidence?: unknown;
      horizontalWriterTransactionRetryEvidence?: unknown;
      horizontalWriterHardeningReady?: unknown;
      horizontalWriterRuntimeSupported?: unknown;
      managedPostgresHorizontalWriterSupported?: unknown;
      activeActiveSupported?: unknown;
      regionalFailoverSupported?: unknown;
      pitrRuntimeSupported?: unknown;
      distributedSqliteSupported?: unknown;
      genericMultiWriterDatabaseSupported?: unknown;
      phases63To66Pending?: unknown;
      pendingPhases?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
    };
  };

  assert.equal(report.runtimeClaims?.activeActiveSupport, false);
  assert.equal(report.runtimeClaims?.pitrSupport, false);
  assert.equal(report.runtimeClaims?.sqliteDistributedSupport, false);
  assert.equal(report.phase62?.phase, "62");
  assert.equal(report.phase62?.horizontalWriterTopologyRequested, true);
  assert.equal(report.phase62?.horizontalWriterHardeningImplementation, "hardening://phase62");
  assert.equal(report.phase62?.horizontalWriterConcurrencyTestEvidence, "[redacted]");
  assert.equal(report.phase62?.horizontalWriterTransactionRetryEvidence, "[redacted]");
  assert.equal(report.phase62?.horizontalWriterHardeningReady, true);
  assert.equal(report.phase62?.horizontalWriterRuntimeSupported, true);
  assert.equal(report.phase62?.managedPostgresHorizontalWriterSupported, true);
  assert.equal(report.phase62?.activeActiveSupported, false);
  assert.equal(report.phase62?.regionalFailoverSupported, false);
  assert.equal(report.phase62?.pitrRuntimeSupported, false);
  assert.equal(report.phase62?.distributedSqliteSupported, false);
  assert.equal(report.phase62?.genericMultiWriterDatabaseSupported, false);
  assert.equal(report.phase62?.phases63To66Pending, true);
  assert.deepEqual(report.phase62?.pendingPhases, ["63", "64", "65", "66"]);
  assert.equal(report.phase62?.releaseAllowed, false);
  assert.equal(report.phase62?.strictBlocker, false);
  assert.doesNotMatch(output, /tests:secret/);
});

test("formatDeploymentCliJson synthesizes Phase 63 distributed dependency enforcement", () => {
  const output = formatDeploymentCliJson({
    asyncStoreBoundary: {
      phase52ManagedStartupSupported: true,
    },
    phase61: {
      activationReady: true,
    },
    runtimeClaims: {
      activeActiveSupport: true,
      regionalFailoverSupported: true,
      pitrRuntimeSupported: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
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
    TASKLOOM_ACCESS_LOG_MODE: "stdout",
    TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE: "logs://phase63",
    TASKLOOM_ALERT_EVALUATE_CRON: "*/1 * * * *",
    TASKLOOM_ALERT_WEBHOOK_URL: "https://alerts:secret@hooks.internal/taskloom",
    TASKLOOM_ALERT_DELIVERY_EVIDENCE: "alerts://phase63",
    TASKLOOM_HEALTH_MONITORING_EVIDENCE: "health://phase63",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    runtimeClaims?: {
      activeActiveSupport?: unknown;
      regionalFailoverSupported?: unknown;
      pitrRuntimeSupported?: unknown;
    };
    phase63?: {
      phase?: unknown;
      required?: unknown;
      horizontalWriterTopologyRequested?: unknown;
      phase62HorizontalWriterHardeningReady?: unknown;
      distributedRateLimitEvidence?: unknown;
      distributedRateLimitReady?: unknown;
      schedulerCoordinationReady?: unknown;
      durableJobExecutionReady?: unknown;
      accessLogShippingReady?: unknown;
      alertDeliveryReady?: unknown;
      healthMonitoringReady?: unknown;
      distributedDependencyEnforcementReady?: unknown;
      activationDependencyGatePassed?: unknown;
      strictActivationBlocked?: unknown;
      activeActiveSupported?: unknown;
      regionalFailoverSupported?: unknown;
      pitrRuntimeSupported?: unknown;
      distributedSqliteSupported?: unknown;
      pendingPhases?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.runtimeClaims?.activeActiveSupport, false);
  assert.equal(report.runtimeClaims?.regionalFailoverSupported, false);
  assert.equal(report.runtimeClaims?.pitrRuntimeSupported, false);
  assert.equal(report.phase63?.phase, "63");
  assert.equal(report.phase63?.required, true);
  assert.equal(report.phase63?.horizontalWriterTopologyRequested, true);
  assert.equal(report.phase63?.phase62HorizontalWriterHardeningReady, true);
  assert.equal(report.phase63?.distributedRateLimitEvidence, "[redacted]");
  assert.equal(report.phase63?.distributedRateLimitReady, true);
  assert.equal(report.phase63?.schedulerCoordinationReady, true);
  assert.equal(report.phase63?.durableJobExecutionReady, true);
  assert.equal(report.phase63?.accessLogShippingReady, true);
  assert.equal(report.phase63?.alertDeliveryReady, true);
  assert.equal(report.phase63?.healthMonitoringReady, true);
  assert.equal(report.phase63?.distributedDependencyEnforcementReady, true);
  assert.equal(report.phase63?.activationDependencyGatePassed, true);
  assert.equal(report.phase63?.strictActivationBlocked, false);
  assert.equal(report.phase63?.activeActiveSupported, false);
  assert.equal(report.phase63?.regionalFailoverSupported, false);
  assert.equal(report.phase63?.pitrRuntimeSupported, false);
  assert.equal(report.phase63?.distributedSqliteSupported, false);
  assert.deepEqual(report.phase63?.pendingPhases, ["64", "65", "66"]);
  assert.equal(report.phase63?.releaseAllowed, false);
  assert.equal(report.phase63?.strictBlocker, false);
  assert.match(String(report.phase63?.summary), /Phase 63/);
  assert.doesNotMatch(output, /auditor:secret/);
  assert.doesNotMatch(output, /alerts:secret/);
});

test("formatDeploymentCliJson synthesizes Phase 64 managed Postgres recovery validation", () => {
  const output = formatDeploymentCliJson({
    phase63: {
      horizontalWriterTopologyRequested: true,
      activationDependencyGatePassed: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE: "https://auditor:secret@evidence.internal/phase64-restore",
    TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE: "pitr://phase64/rehearsal",
    TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE: "failover://phase64/provider-ha",
    TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE: "integrity://phase64/checks",
    TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION: "RTO <= 30m; RPO <= 5m",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase64?: {
      phase?: unknown;
      required?: unknown;
      phase63ActivationDependencyGatePassed?: unknown;
      backupRestoreEvidence?: unknown;
      backupRestoreEvidenceAttached?: unknown;
      pitrRehearsalEvidenceAttached?: unknown;
      failoverRehearsalEvidenceAttached?: unknown;
      dataIntegrityValidationEvidenceAttached?: unknown;
      recoveryTimeExpectationAttached?: unknown;
      managedPostgresRecoveryValidationReady?: unknown;
      providerOwnedHaPitrValidated?: unknown;
      activeActiveSupported?: unknown;
      regionalFailoverSupported?: unknown;
      pitrRuntimeSupported?: unknown;
      distributedSqliteSupported?: unknown;
      applicationManagedRegionalFailoverSupported?: unknown;
      applicationManagedPitrSupported?: unknown;
      pendingPhases?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
    };
  };

  assert.equal(report.phase64?.phase, "64");
  assert.equal(report.phase64?.required, true);
  assert.equal(report.phase64?.phase63ActivationDependencyGatePassed, true);
  assert.equal(report.phase64?.backupRestoreEvidence, "[redacted]");
  assert.equal(report.phase64?.backupRestoreEvidenceAttached, true);
  assert.equal(report.phase64?.pitrRehearsalEvidenceAttached, true);
  assert.equal(report.phase64?.failoverRehearsalEvidenceAttached, true);
  assert.equal(report.phase64?.dataIntegrityValidationEvidenceAttached, true);
  assert.equal(report.phase64?.recoveryTimeExpectationAttached, true);
  assert.equal(report.phase64?.managedPostgresRecoveryValidationReady, true);
  assert.equal(report.phase64?.providerOwnedHaPitrValidated, true);
  assert.equal(report.phase64?.activeActiveSupported, false);
  assert.equal(report.phase64?.regionalFailoverSupported, false);
  assert.equal(report.phase64?.pitrRuntimeSupported, false);
  assert.equal(report.phase64?.distributedSqliteSupported, false);
  assert.equal(report.phase64?.applicationManagedRegionalFailoverSupported, false);
  assert.equal(report.phase64?.applicationManagedPitrSupported, false);
  assert.deepEqual(report.phase64?.pendingPhases, ["65", "66"]);
  assert.equal(report.phase64?.releaseAllowed, false);
  assert.equal(report.phase64?.strictBlocker, false);
  assert.doesNotMatch(output, /auditor:secret/);
});

test("formatDeploymentCliJson synthesizes Phase 65 cutover rollback automation", () => {
  const output = formatDeploymentCliJson({
    phase64: {
      horizontalWriterTopologyRequested: true,
      managedPostgresRecoveryValidationReady: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_CUTOVER_PREFLIGHT_STATUS: "passed",
    TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE: "https://auditor:secret@evidence.internal/phase65-preflight",
    TASKLOOM_ACTIVATION_DRY_RUN_STATUS: "passed",
    TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE: "dry-run://phase65",
    TASKLOOM_POST_ACTIVATION_SMOKE_STATUS: "passed",
    TASKLOOM_POST_ACTIVATION_SMOKE_EVIDENCE: "smoke://phase65",
    TASKLOOM_ROLLBACK_COMMAND_GUIDANCE: "rollback://phase65/command",
    TASKLOOM_MONITORING_THRESHOLDS: "thresholds://phase65",
    TASKLOOM_OPERATIONS_HEALTH_CUTOVER_STATUS_EVIDENCE: "ops://phase65",
    TASKLOOM_SMOKE_FAILURE_ROLLBACK_EVIDENCE: "safe://phase65",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase65?: {
      phase?: unknown;
      required?: unknown;
      phase64ManagedPostgresRecoveryValidationReady?: unknown;
      cutoverPreflightEvidence?: unknown;
      cutoverPreflightEvidenceAttached?: unknown;
      activationDryRunEvidenceAttached?: unknown;
      postActivationSmokeCheckEvidenceAttached?: unknown;
      rollbackCommandGuidanceAttached?: unknown;
      monitoringThresholdEvidenceAttached?: unknown;
      operationsHealthCutoverStatusEvidenceAttached?: unknown;
      rollbackToPriorSafePostureProven?: unknown;
      automationFailureDetected?: unknown;
      cutoverRollbackAutomationReady?: unknown;
      activationBlocked?: unknown;
      pendingPhases?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase65?.phase, "65");
  assert.equal(report.phase65?.required, true);
  assert.equal(report.phase65?.phase64ManagedPostgresRecoveryValidationReady, true);
  assert.equal(report.phase65?.cutoverPreflightEvidence, "[redacted]");
  assert.equal(report.phase65?.cutoverPreflightEvidenceAttached, true);
  assert.equal(report.phase65?.activationDryRunEvidenceAttached, true);
  assert.equal(report.phase65?.postActivationSmokeCheckEvidenceAttached, true);
  assert.equal(report.phase65?.rollbackCommandGuidanceAttached, true);
  assert.equal(report.phase65?.monitoringThresholdEvidenceAttached, true);
  assert.equal(report.phase65?.operationsHealthCutoverStatusEvidenceAttached, true);
  assert.equal(report.phase65?.rollbackToPriorSafePostureProven, true);
  assert.equal(report.phase65?.automationFailureDetected, false);
  assert.equal(report.phase65?.cutoverRollbackAutomationReady, true);
  assert.equal(report.phase65?.activationBlocked, false);
  assert.deepEqual(report.phase65?.pendingPhases, ["66"]);
  assert.equal(report.phase65?.releaseAllowed, false);
  assert.equal(report.phase65?.strictBlocker, false);
  assert.match(String(report.phase65?.summary), /Phase 65 records repeatable/);
  assert.doesNotMatch(output, /auditor:secret/);
});

test("formatDeploymentCliJson blocks Phase 65 when a smoke check fails", () => {
  const output = formatDeploymentCliJson({
    phase64: {
      horizontalWriterTopologyRequested: true,
      managedPostgresRecoveryValidationReady: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_CUTOVER_PREFLIGHT_STATUS: "passed",
    TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE: "preflight://phase65",
    TASKLOOM_ACTIVATION_DRY_RUN_STATUS: "passed",
    TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE: "dry-run://phase65",
    TASKLOOM_POST_ACTIVATION_SMOKE_STATUS: "failed",
    TASKLOOM_POST_ACTIVATION_SMOKE_EVIDENCE: "smoke://phase65",
    TASKLOOM_ROLLBACK_COMMAND_GUIDANCE: "rollback://phase65/command",
    TASKLOOM_MONITORING_THRESHOLDS: "thresholds://phase65",
    TASKLOOM_OPERATIONS_HEALTH_CUTOVER_STATUS_EVIDENCE: "ops://phase65",
    TASKLOOM_SMOKE_FAILURE_ROLLBACK_EVIDENCE: "safe://phase65",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase65?: {
      postActivationSmokeCheckFailed?: unknown;
      rollbackToPriorSafePostureProven?: unknown;
      automationFailureDetected?: unknown;
      cutoverRollbackAutomationReady?: unknown;
      activationBlocked?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase65?.postActivationSmokeCheckFailed, true);
  assert.equal(report.phase65?.rollbackToPriorSafePostureProven, true);
  assert.equal(report.phase65?.automationFailureDetected, true);
  assert.equal(report.phase65?.cutoverRollbackAutomationReady, false);
  assert.equal(report.phase65?.activationBlocked, true);
  assert.equal(report.phase65?.strictBlocker, true);
  assert.match(String(report.phase65?.summary), /failed preflight, dry-run, or smoke check/);
});

test("formatDeploymentCliJson synthesizes Phase 66 final closure while blocking release until evidence is present", () => {
  const output = formatDeploymentCliJson({
    phase65: {
      horizontalWriterTopologyRequested: true,
      cutoverRollbackAutomationReady: true,
      releaseAllowed: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase65?: { releaseAllowed?: unknown };
    phase66?: {
      phase?: unknown;
      required?: unknown;
      phase65CutoverAutomationGatePassed?: unknown;
      finalReleaseClosureStatusPassed?: unknown;
      finalReleaseClosureEvidenceAttached?: unknown;
      finalReleaseChecklistAttached?: unknown;
      releaseApprovalAttached?: unknown;
      documentationFreezeEvidenceAttached?: unknown;
      noHiddenPhaseAssertionAttached?: unknown;
      finalReleaseValidationEvidenceAttached?: unknown;
      finalReleaseClosureReady?: unknown;
      activationAllowed?: unknown;
      releaseAllowed?: unknown;
      finalReleaseApprovalGranted?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase65?.releaseAllowed, false);
  assert.equal(report.phase66?.phase, "66");
  assert.equal(report.phase66?.required, true);
  assert.equal(report.phase66?.phase65CutoverAutomationGatePassed, true);
  assert.equal(report.phase66?.finalReleaseClosureStatusPassed, true);
  assert.equal(report.phase66?.finalReleaseClosureEvidenceAttached, false);
  assert.equal(report.phase66?.finalReleaseChecklistAttached, false);
  assert.equal(report.phase66?.releaseApprovalAttached, false);
  assert.equal(report.phase66?.documentationFreezeEvidenceAttached, false);
  assert.equal(report.phase66?.noHiddenPhaseAssertionAttached, false);
  assert.equal(report.phase66?.finalReleaseValidationEvidenceAttached, false);
  assert.equal(report.phase66?.finalReleaseClosureReady, false);
  assert.equal(report.phase66?.activationAllowed, false);
  assert.equal(report.phase66?.releaseAllowed, false);
  assert.equal(report.phase66?.finalReleaseApprovalGranted, false);
  assert.equal(report.phase66?.strictBlocker, true);
  assert.match(String(report.phase66?.summary), /Phase 66 requires/);
});

test("formatDeploymentCliJson allows Phase 66 release and redacts final closure evidence URLs", () => {
  const output = formatDeploymentCliJson({
    phase65: {
      horizontalWriterTopologyRequested: true,
      cutoverRollbackAutomationReady: true,
    },
    releaseClaims: {
      activeActiveSupported: true,
      regionalFailoverSupported: true,
      pitrRuntimeSupported: true,
      distributedSqliteSupported: true,
    },
  }, {
    TASKLOOM_DATABASE_TOPOLOGY: "managed-postgres-horizontal-app-writers",
    TASKLOOM_FINAL_RELEASE_CLOSURE_STATUS: "passed",
    TASKLOOM_FINAL_RELEASE_CLOSURE_EVIDENCE: "https://approver:secret@evidence.internal/phase66-closure",
    TASKLOOM_FINAL_RELEASE_CHECKLIST: "checklist://phase66",
    TASKLOOM_RELEASE_APPROVAL: "approval://phase66",
    TASKLOOM_DOCUMENTATION_FREEZE_ASSERTION: "docs-freeze://phase66",
    TASKLOOM_NO_HIDDEN_PHASE_ASSERTION: "no-hidden://phase66",
    TASKLOOM_FINAL_VERIFICATION_EVIDENCE: "validation://phase66",
  } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    releaseClaims?: {
      activeActiveSupported?: unknown;
      regionalFailoverSupported?: unknown;
      pitrRuntimeSupported?: unknown;
      distributedSqliteSupported?: unknown;
    };
    phase66?: {
      finalReleaseClosureStatus?: unknown;
      finalReleaseClosureEvidence?: unknown;
      finalReleaseChecklist?: unknown;
      releaseApproval?: unknown;
      documentationFreezeEvidence?: unknown;
      noHiddenPhaseAssertion?: unknown;
      finalReleaseValidationEvidence?: unknown;
      finalReleaseClosureReady?: unknown;
      activationAllowed?: unknown;
      releaseAllowed?: unknown;
      finalReleaseApprovalGranted?: unknown;
      activeActiveSupported?: unknown;
      regionalFailoverSupported?: unknown;
      pitrRuntimeSupported?: unknown;
      distributedSqliteSupported?: unknown;
      pendingPhases?: unknown;
      strictBlocker?: unknown;
    };
  };

  assert.equal(report.releaseClaims?.activeActiveSupported, false);
  assert.equal(report.releaseClaims?.regionalFailoverSupported, false);
  assert.equal(report.releaseClaims?.pitrRuntimeSupported, false);
  assert.equal(report.releaseClaims?.distributedSqliteSupported, false);
  assert.equal(report.phase66?.finalReleaseClosureStatus, "passed");
  assert.equal(report.phase66?.finalReleaseClosureEvidence, "[redacted]");
  assert.equal(report.phase66?.finalReleaseChecklist, "[redacted]");
  assert.equal(report.phase66?.releaseApproval, "[redacted]");
  assert.equal(report.phase66?.documentationFreezeEvidence, "[redacted]");
  assert.equal(report.phase66?.noHiddenPhaseAssertion, "[redacted]");
  assert.equal(report.phase66?.finalReleaseValidationEvidence, "[redacted]");
  assert.equal(report.phase66?.finalReleaseClosureReady, true);
  assert.equal(report.phase66?.activationAllowed, true);
  assert.equal(report.phase66?.releaseAllowed, true);
  assert.equal(report.phase66?.finalReleaseApprovalGranted, true);
  assert.equal(report.phase66?.activeActiveSupported, false);
  assert.equal(report.phase66?.regionalFailoverSupported, false);
  assert.equal(report.phase66?.pitrRuntimeSupported, false);
  assert.equal(report.phase66?.distributedSqliteSupported, false);
  assert.deepEqual(report.phase66?.pendingPhases, []);
  assert.equal(report.phase66?.strictBlocker, false);
  assert.doesNotMatch(output, /approver:secret/);
});
