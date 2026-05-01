import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseEvidenceCli } from "./release-evidence-cli.js";

function parseJsonOutput(output: string[]): Record<string, unknown> {
  return JSON.parse(output[0] ?? "") as Record<string, unknown>;
}

test("runReleaseEvidenceCli prints the evidence bundle as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_RELEASE_CHANNEL: "phase-44" } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        readyForRelease: true,
        phase: 44,
        evidence: [{ id: "release-readiness", status: "pass" }],
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    readyForRelease: true,
    phase: 44,
    evidence: [{ id: "release-readiness", status: "pass" }],
  });
});

test("runReleaseEvidenceCli exports local JSON evidence in non-strict mode", async () => {
  const output: string[] = [];
  const env = {} as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
  });
  const bundle = parseJsonOutput(output);

  assert.equal(exitCode, 0);
  assert.equal(bundle.readyForRelease, true);
  assert.equal(bundle.phase, "44");
  assert.equal((bundle.storageTopology as { mode?: unknown }).mode, "json");
  assert.equal((bundle.asyncStoreBoundary as { phase?: unknown }).phase, "49");
  assert.equal(((bundle.evidence as { config?: { strictRelease?: unknown } }).config)?.strictRelease, false);
  assert.equal(((bundle.evidence as { config?: { managedPostgresSupported?: unknown } }).config)?.managedPostgresSupported, false);
});

test("runReleaseEvidenceCli fails strict mode when the bundle is not release-ready", async () => {
  let receivedStrict: boolean | undefined;

  const exitCode = await runReleaseEvidenceCli({
    argv: ["--strict"],
    out: () => {},
    buildReleaseEvidenceBundle: (_env, deps) => {
      receivedStrict = deps?.strict;
      return { readyForRelease: false };
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(receivedStrict, true);
});

test("runReleaseEvidenceCli strict mode blocks managed database runtime handoff", async () => {
  const output: string[] = [];
  const env = {
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: ["--strict"],
    env,
    out: (line) => output.push(line),
  });
  const bundle = parseJsonOutput(output);
  const serializedBundle = JSON.stringify(bundle);

  assert.equal(exitCode, 1);
  assert.equal(bundle.readyForRelease, false);
  assert.equal(((bundle.evidence as { config?: { strictRelease?: unknown } }).config)?.strictRelease, true);
  assert.match(serializedBundle, /Phase 52 managed Postgres startup support requires/);
  assert.match(serializedBundle, /managed-database-blocked/);
  assert.match(serializedBundle, /Phase 49 async-store boundary exists as foundation/);
  assert.match(serializedBundle, /managed Postgres remains unsupported/);
  assert.doesNotMatch(serializedBundle, /taskloom:secret/);
});

test("runReleaseEvidenceCli passes strict mode when the bundle is release-ready", async () => {
  const exitCode = await runReleaseEvidenceCli({
    argv: ["--strict"],
    out: () => {},
    buildReleaseEvidenceBundle: () => ({ readyForRelease: true }),
  });

  assert.equal(exitCode, 0);
});

test("runReleaseEvidenceCli preserves Phase 57 implementation-scope evidence while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: () => ({
      readyForRelease: false,
      releaseEvidence: {
        phase57MultiWriterImplementationScopeGate: {
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
          implementationScopeSecret: "phase57-evidence-secret",
          summary: "Phase 57 release evidence implementation scope is recorded.",
        },
      },
    }),
  });
  const bundle = parseJsonOutput(output) as {
    releaseEvidence?: {
      phase57MultiWriterImplementationScopeGate?: {
        implementationScopeSecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
        runtimeSupportBlocked?: unknown;
        releaseAllowed?: unknown;
      };
    };
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
  };

  assert.equal(exitCode, 0);
  assert.equal(bundle.phase57?.phase, "57");
  assert.equal(bundle.phase57?.implementationScopeEvidenceAttached, true);
  assert.equal(bundle.phase57?.implementationScopeApproved, true);
  assert.equal(bundle.phase57?.implementationScopeGatePassed, true);
  assert.equal(bundle.phase57?.approvedImplementationScope, "single-region-shadow-write-validation");
  assert.equal(bundle.phase57?.implementationOwner, "database-platform");
  assert.equal(bundle.phase57?.runtimeSupport, false);
  assert.equal(bundle.phase57?.multiWriterSupported, false);
  assert.equal(bundle.phase57?.runtimeImplementationBlocked, true);
  assert.equal(bundle.phase57?.runtimeSupportBlocked, true);
  assert.equal(bundle.phase57?.releaseAllowed, false);
  assert.equal(bundle.phase57?.strictBlocker, false);
  assert.equal(bundle.phase57?.implementationScopeSecret, "[redacted]");
  assert.equal(bundle.phase57?.summary, "Phase 57 release evidence implementation scope is recorded.");
  assert.equal(bundle.releaseEvidence?.phase57MultiWriterImplementationScopeGate?.implementationScopeSecret, "[redacted]");
  assert.equal(bundle.releaseEvidence?.phase57MultiWriterImplementationScopeGate?.runtimeSupport, false);
  assert.equal(bundle.releaseEvidence?.phase57MultiWriterImplementationScopeGate?.multiWriterSupported, false);
  assert.equal(bundle.releaseEvidence?.phase57MultiWriterImplementationScopeGate?.runtimeImplementationBlocked, true);
  assert.equal(bundle.releaseEvidence?.phase57MultiWriterImplementationScopeGate?.runtimeSupportBlocked, true);
  assert.equal(bundle.releaseEvidence?.phase57MultiWriterImplementationScopeGate?.releaseAllowed, false);
  assert.doesNotMatch(output[0] ?? "", /phase57-evidence-secret/);
});

test("runReleaseEvidenceCli preserves Phase 58 validation evidence while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: () => ({
      readyForRelease: false,
      releaseEvidence: {
        phase58MultiWriterRuntimeImplementationValidationGate: {
          runtimeImplementationValidationEvidenceAttached: true,
          runtimeImplementationValidated: true,
          runtimeImplementationValidationGatePassed: true,
          validationOwner: "release-engineering",
          evidenceUrl: "https://evidence.example.com/phase58/release-evidence-validation",
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          validationSecret: "phase58-evidence-secret",
          summary: "Phase 58 release evidence validation is recorded.",
        },
      },
    }),
  });
  const bundle = parseJsonOutput(output) as {
    releaseEvidence?: {
      phase58MultiWriterRuntimeImplementationValidationGate?: {
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
  };

  assert.equal(exitCode, 0);
  assert.equal(bundle.phase58?.phase, "58");
  assert.equal(bundle.phase58?.runtimeImplementationValidationEvidenceAttached, true);
  assert.equal(bundle.phase58?.runtimeImplementationValidated, true);
  assert.equal(bundle.phase58?.runtimeImplementationValidationGatePassed, true);
  assert.equal(bundle.phase58?.validationOwner, "release-engineering");
  assert.equal(bundle.phase58?.evidenceUrl, "[redacted]");
  assert.equal(bundle.phase58?.runtimeSupport, false);
  assert.equal(bundle.phase58?.runtimeSupported, false);
  assert.equal(bundle.phase58?.multiWriterSupported, false);
  assert.equal(bundle.phase58?.runtimeImplementationBlocked, true);
  assert.equal(bundle.phase58?.runtimeSupportBlocked, true);
  assert.equal(bundle.phase58?.releaseAllowed, false);
  assert.equal(bundle.phase58?.strictBlocker, false);
  assert.equal(bundle.phase58?.validationSecret, "[redacted]");
  assert.equal(bundle.phase58?.summary, "Phase 58 release evidence validation is recorded.");
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.evidenceUrl, "[redacted]");
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupport, false);
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupported, false);
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.multiWriterSupported, false);
  assert.equal(
    bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeImplementationBlocked,
    true,
  );
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupportBlocked, true);
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.releaseAllowed, false);
  assert.equal(bundle.releaseEvidence?.phase58MultiWriterRuntimeImplementationValidationGate?.validationSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase58-evidence-secret/);
});

test("runReleaseEvidenceCli preserves Phase 59 enablement evidence while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: () => ({
      readyForRelease: false,
      releaseEvidence: {
        phase59MultiWriterRuntimeEnablementGate: {
          runtimeEnablementDecision: "approved",
          runtimeEnablementApprover: "release-council",
          runtimeEnablementRolloutWindow: "maintenance-window-59",
          runtimeEnablementMonitoringSignoff: "observability-ready",
          runtimeEnablementAbortPlan: "https://runbooks.example.com/phase59/evidence-abort",
          runtimeEnablementReleaseTicket: "MW-59",
          runtimeEnablementApprovalEvidenceComplete: true,
          approvalEvidenceUrl: "https://evidence.example.com/phase59/release-evidence",
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          approvalSecret: "phase59-evidence-secret",
          summary: "Phase 59 release evidence enablement approval is recorded.",
        },
      },
    }),
  });
  const bundle = parseJsonOutput(output) as {
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
      runtimeEnablementAbortPlan?: unknown;
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

  assert.equal(exitCode, 0);
  assert.equal(bundle.phase59?.phase, "59");
  assert.equal(bundle.phase59?.runtimeEnablementDecision, "approved");
  assert.equal(bundle.phase59?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(bundle.phase59?.approvalEvidenceUrl, "[redacted]");
  assert.equal(bundle.phase59?.runtimeSupport, false);
  assert.equal(bundle.phase59?.runtimeSupported, false);
  assert.equal(bundle.phase59?.multiWriterSupported, false);
  assert.equal(bundle.phase59?.runtimeImplementationBlocked, true);
  assert.equal(bundle.phase59?.runtimeSupportBlocked, true);
  assert.equal(bundle.phase59?.releaseAllowed, false);
  assert.equal(bundle.phase59?.strictBlocker, false);
  assert.equal(bundle.phase59?.approvalSecret, "[redacted]");
  assert.equal(bundle.phase59?.summary, "Phase 59 release evidence enablement approval is recorded.");
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.approvalEvidenceUrl, "[redacted]");
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeSupport, false);
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeSupported, false);
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.multiWriterSupported, false);
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeImplementationBlocked, true);
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.runtimeSupportBlocked, true);
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.releaseAllowed, false);
  assert.equal(bundle.releaseEvidence?.phase59MultiWriterRuntimeEnablementGate?.approvalSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /runbooks\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase59-evidence-secret/);
});

test("runReleaseEvidenceCli preserves Phase 60 support-presence evidence while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: () => ({
      readyForRelease: false,
      releaseEvidence: {
        phase60MultiWriterRuntimeSupportPresenceAssertionGate: {
          implementationPresent: "implementation-present",
          explicitSupportStatement: "support statement captured",
          compatibilityMatrix: "https://evidence.example.com/phase60/evidence-matrix",
          cutoverEvidence: "https://evidence.example.com/phase60/evidence-cutover",
          releaseAutomationApproval: "https://approvals.example.com/phase60/evidence-release-automation",
          ownerAcceptance: "owner-accepted",
          runtimeSupportPresenceAssertionComplete: true,
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          assertionSecret: "phase60-evidence-secret",
          summary: "Phase 60 release evidence support presence assertion is recorded.",
        },
      },
    }),
  });
  const bundle = parseJsonOutput(output) as {
    releaseEvidence?: {
      phase60MultiWriterRuntimeSupportPresenceAssertionGate?: {
        compatibilityMatrix?: unknown;
        cutoverEvidence?: unknown;
        releaseAutomationApproval?: unknown;
        runtimeSupport?: unknown;
        runtimeSupported?: unknown;
        multiWriterSupported?: unknown;
        releaseAllowed?: unknown;
        assertionSecret?: unknown;
      };
    };
    phase60?: {
      phase?: unknown;
      runtimeSupportCompatibilityMatrix?: unknown;
      runtimeSupportCutoverEvidence?: unknown;
      runtimeSupportReleaseAutomationApproval?: unknown;
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

  assert.equal(exitCode, 0);
  assert.equal(bundle.phase60?.phase, "60");
  assert.equal(bundle.phase60?.runtimeSupportCompatibilityMatrix, "[redacted]");
  assert.equal(bundle.phase60?.runtimeSupportCutoverEvidence, "[redacted]");
  assert.equal(bundle.phase60?.runtimeSupportReleaseAutomationApproval, "[redacted]");
  assert.equal(bundle.phase60?.runtimeSupport, false);
  assert.equal(bundle.phase60?.runtimeSupported, false);
  assert.equal(bundle.phase60?.multiWriterSupported, false);
  assert.equal(bundle.phase60?.runtimeImplementationBlocked, true);
  assert.equal(bundle.phase60?.runtimeSupportBlocked, true);
  assert.equal(bundle.phase60?.releaseAllowed, false);
  assert.equal(bundle.phase60?.strictBlocker, false);
  assert.equal(bundle.phase60?.assertionSecret, "[redacted]");
  assert.equal(bundle.phase60?.summary, "Phase 60 release evidence support presence assertion is recorded.");
  assert.equal(
    bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.compatibilityMatrix,
    "[redacted]",
  );
  assert.equal(bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.cutoverEvidence, "[redacted]");
  assert.equal(
    bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAutomationApproval,
    "[redacted]",
  );
  assert.equal(bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupport, false);
  assert.equal(bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupported, false);
  assert.equal(bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.multiWriterSupported, false);
  assert.equal(bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAllowed, false);
  assert.equal(bundle.releaseEvidence?.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.assertionSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /approvals\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase60-evidence-secret/);
});

test("runReleaseEvidenceCli preserves Phase 61 unsupported-claim evidence while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: () => ({
      readyForRelease: false,
      releaseEvidence: {
        phase61UnsupportedRuntimeReleaseClaimsGate: {
          activeActiveClaimEvidence: "https://evidence.example.com/phase61/evidence-active-active",
          regionalClaimEvidence: "regional-reviewed",
          pitrClaimEvidence: "https://evidence.example.com/phase61/evidence-pitr",
          sqliteDistributedClaimEvidence: "sqlite-reviewed",
          unsupportedRuntimeReleaseClaimsComplete: true,
          activeActiveSupport: true,
          regionalSupport: true,
          pitrSupport: true,
          sqliteDistributedSupport: true,
          runtimeSupport: true,
          releaseAllowed: true,
          strictBlocker: false,
          claimSecret: "phase61-evidence-secret",
          summary: "Phase 61 release evidence unsupported claim evidence is recorded.",
        },
      },
    }),
  });
  const bundle = parseJsonOutput(output) as {
    releaseEvidence?: {
      phase61UnsupportedRuntimeReleaseClaimsGate?: {
        activeActiveClaimEvidence?: unknown;
        pitrClaimEvidence?: unknown;
        activeActiveSupport?: unknown;
        regionalSupport?: unknown;
        pitrSupport?: unknown;
        sqliteDistributedSupport?: unknown;
        runtimeSupport?: unknown;
        releaseAllowed?: unknown;
        claimSecret?: unknown;
      };
    };
    phase61?: {
      phase?: unknown;
      activeActiveClaimEvidence?: unknown;
      pitrClaimEvidence?: unknown;
      unsupportedRuntimeReleaseClaimsComplete?: unknown;
      activeActiveSupport?: unknown;
      regionalSupport?: unknown;
      pitrSupport?: unknown;
      sqliteDistributedSupport?: unknown;
      runtimeSupport?: unknown;
      releaseAllowed?: unknown;
      strictBlocker?: unknown;
      claimSecret?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(bundle.phase61?.phase, "61");
  assert.equal(bundle.phase61?.activeActiveClaimEvidence, "[redacted]");
  assert.equal(bundle.phase61?.pitrClaimEvidence, "[redacted]");
  assert.equal(bundle.phase61?.unsupportedRuntimeReleaseClaimsComplete, true);
  assert.equal(bundle.phase61?.activeActiveSupport, false);
  assert.equal(bundle.phase61?.regionalSupport, false);
  assert.equal(bundle.phase61?.pitrSupport, false);
  assert.equal(bundle.phase61?.sqliteDistributedSupport, false);
  assert.equal(bundle.phase61?.runtimeSupport, false);
  assert.equal(bundle.phase61?.releaseAllowed, false);
  assert.equal(bundle.phase61?.strictBlocker, false);
  assert.equal(bundle.phase61?.claimSecret, "[redacted]");
  assert.equal(bundle.phase61?.summary, "Phase 61 release evidence unsupported claim evidence is recorded.");
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.activeActiveClaimEvidence, "[redacted]");
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.pitrClaimEvidence, "[redacted]");
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.activeActiveSupport, false);
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.regionalSupport, false);
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.pitrSupport, false);
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.sqliteDistributedSupport, false);
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.runtimeSupport, false);
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.releaseAllowed, false);
  assert.equal(bundle.releaseEvidence?.phase61UnsupportedRuntimeReleaseClaimsGate?.claimSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase61-evidence-secret/);
});

test("runReleaseEvidenceCli returns an error exit code when the builder throws", async () => {
  const errors: string[] = [];

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    out: () => {},
    err: (line) => errors.push(line),
    buildReleaseEvidenceBundle: () => {
      throw new Error("release evidence unavailable");
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(errors, ["release evidence unavailable"]);
});
