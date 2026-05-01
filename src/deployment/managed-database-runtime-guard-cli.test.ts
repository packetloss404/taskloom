import assert from "node:assert/strict";
import test from "node:test";
import { runManagedDatabaseRuntimeGuardCli } from "./managed-database-runtime-guard-cli.js";

test("runManagedDatabaseRuntimeGuardCli prints the report as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_DATABASE_RUNTIME: "managed" } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseRuntimeGuardReport: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        allowed: false,
        runtime: "managed-postgres",
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    allowed: false,
    runtime: "managed-postgres",
  });
});

test("runManagedDatabaseRuntimeGuardCli fails strict mode when the report is not allowed or is blocked", async () => {
  let receivedStrict: boolean | undefined;

  const notAllowedExitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseRuntimeGuardReport: (_env, deps) => {
      receivedStrict = deps?.strict;
      return { allowed: false };
    },
  });

  const blockedExitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseRuntimeGuardReport: () => ({ allowed: true, runtimeBlocked: true }),
  });

  assert.equal(notAllowedExitCode, 1);
  assert.equal(blockedExitCode, 1);
  assert.equal(receivedStrict, true);
});

test("runManagedDatabaseRuntimeGuardCli passes strict mode when the report is allowed", async () => {
  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseRuntimeGuardReport: () => ({ allowed: true }),
  });

  assert.equal(exitCode, 0);
});

test("runManagedDatabaseRuntimeGuardCli preserves Phase 57 implementation-scope fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseRuntimeGuardReport: () => ({
      allowed: false,
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
        implementationScopeSecret: "phase57-runtime-secret",
        summary: "Phase 57 runtime guard implementation scope is recorded.",
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase57MultiWriterImplementationScopeGate?: {
      implementationScopeSecret?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
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
  assert.equal(report.phase57?.summary, "Phase 57 runtime guard implementation scope is recorded.");
  assert.equal(report.phase57MultiWriterImplementationScopeGate?.implementationScopeSecret, "[redacted]");
  assert.equal(report.phase57MultiWriterImplementationScopeGate?.runtimeSupport, false);
  assert.equal(report.phase57MultiWriterImplementationScopeGate?.multiWriterSupported, false);
  assert.equal(report.phase57MultiWriterImplementationScopeGate?.runtimeImplementationBlocked, true);
  assert.equal(report.phase57MultiWriterImplementationScopeGate?.runtimeSupportBlocked, true);
  assert.equal(report.phase57MultiWriterImplementationScopeGate?.releaseAllowed, false);
  assert.doesNotMatch(output[0] ?? "", /phase57-runtime-secret/);
});

test("runManagedDatabaseRuntimeGuardCli preserves Phase 58 validation fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseRuntimeGuardReport: () => ({
      allowed: false,
      phase58MultiWriterRuntimeImplementationValidationGate: {
        runtimeImplementationValidationEvidenceAttached: true,
        runtimeImplementationValidated: true,
        runtimeImplementationValidationGatePassed: true,
        validationOwner: "database-platform",
        evidenceUrl: "https://evidence.example.com/phase58/runtime-guard-validation",
        runtimeSupport: true,
        runtimeSupported: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        runtimeSupportBlocked: false,
        releaseAllowed: true,
        strictBlocker: false,
        validationSecret: "phase58-runtime-secret",
        summary: "Phase 58 runtime guard validation evidence is recorded.",
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
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
  assert.equal(report.phase58?.summary, "Phase 58 runtime guard validation evidence is recorded.");
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.evidenceUrl, "[redacted]");
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupport, false);
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupported, false);
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.multiWriterSupported, false);
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeImplementationBlocked, true);
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.runtimeSupportBlocked, true);
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.releaseAllowed, false);
  assert.equal(report.phase58MultiWriterRuntimeImplementationValidationGate?.validationSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase58-runtime-secret/);
});

test("runManagedDatabaseRuntimeGuardCli preserves Phase 59 enablement fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseRuntimeGuardReport: () => ({
      allowed: false,
      phase59MultiWriterRuntimeEnablementGate: {
        runtimeEnablementDecision: "approved",
        runtimeEnablementApprover: "release-council",
        runtimeEnablementRolloutWindow: "maintenance-window-59",
        runtimeEnablementMonitoringSignoff: "observability-ready",
        runtimeEnablementAbortPlan: "https://runbooks.example.com/phase59/runtime-abort",
        runtimeEnablementReleaseTicket: "MW-59",
        runtimeEnablementApprovalEvidenceComplete: true,
        runtimeSupport: true,
        runtimeSupported: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        runtimeSupportBlocked: false,
        releaseAllowed: true,
        strictBlocker: false,
        approvalSecret: "phase59-runtime-secret",
        summary: "Phase 59 runtime guard enablement approval is recorded.",
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase59MultiWriterRuntimeEnablementGate?: {
      runtimeEnablementAbortPlan?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      runtimeSupportBlocked?: unknown;
      releaseAllowed?: unknown;
      approvalSecret?: unknown;
    };
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
  assert.equal(report.phase59?.summary, "Phase 59 runtime guard enablement approval is recorded.");
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.runtimeSupport, false);
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.runtimeSupported, false);
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.multiWriterSupported, false);
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.runtimeImplementationBlocked, true);
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.runtimeSupportBlocked, true);
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.releaseAllowed, false);
  assert.equal(report.phase59MultiWriterRuntimeEnablementGate?.approvalSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /runbooks\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase59-runtime-secret/);
});

test("runManagedDatabaseRuntimeGuardCli preserves Phase 60 support-presence fields while blocking support claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseRuntimeGuardReport: () => ({
      allowed: false,
      phase60MultiWriterRuntimeSupportPresenceAssertionGate: {
        implementationPresent: "implementation-present",
        explicitSupportStatement: "support statement captured",
        compatibilityMatrix: "https://evidence.example.com/phase60/runtime-matrix",
        cutoverEvidence: "https://evidence.example.com/phase60/runtime-cutover",
        releaseAutomationApproval: "https://approvals.example.com/phase60/runtime-release-automation",
        ownerAcceptance: "owner-accepted",
        runtimeSupportPresenceAssertionComplete: true,
        runtimeSupport: true,
        runtimeSupported: true,
        multiWriterSupported: true,
        runtimeImplementationBlocked: false,
        runtimeSupportBlocked: false,
        releaseAllowed: true,
        strictBlocker: false,
        assertionSecret: "phase60-runtime-secret",
        summary: "Phase 60 runtime guard support presence assertion is recorded.",
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase60MultiWriterRuntimeSupportPresenceAssertionGate?: {
      compatibilityMatrix?: unknown;
      runtimeSupport?: unknown;
      runtimeSupported?: unknown;
      multiWriterSupported?: unknown;
      releaseAllowed?: unknown;
      assertionSecret?: unknown;
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
  assert.equal(report.phase60?.phase, "60");
  assert.equal(report.phase60?.runtimeSupportCompatibilityMatrix, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportCutoverEvidence, "[redacted]");
  assert.equal(report.phase60?.runtimeSupportReleaseAutomationApproval, "[redacted]");
  assert.equal(report.phase60?.runtimeSupport, false);
  assert.equal(report.phase60?.runtimeSupported, false);
  assert.equal(report.phase60?.multiWriterSupported, false);
  assert.equal(report.phase60?.runtimeImplementationBlocked, true);
  assert.equal(report.phase60?.runtimeSupportBlocked, true);
  assert.equal(report.phase60?.releaseAllowed, false);
  assert.equal(report.phase60?.strictBlocker, false);
  assert.equal(report.phase60?.assertionSecret, "[redacted]");
  assert.equal(report.phase60?.summary, "Phase 60 runtime guard support presence assertion is recorded.");
  assert.equal(report.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.compatibilityMatrix, "[redacted]");
  assert.equal(report.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupport, false);
  assert.equal(report.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.runtimeSupported, false);
  assert.equal(report.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.multiWriterSupported, false);
  assert.equal(report.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.releaseAllowed, false);
  assert.equal(report.phase60MultiWriterRuntimeSupportPresenceAssertionGate?.assertionSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /approvals\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase60-runtime-secret/);
});

test("runManagedDatabaseRuntimeGuardCli returns an error exit code when the builder throws", async () => {
  const errors: string[] = [];

  const exitCode = await runManagedDatabaseRuntimeGuardCli({
    argv: [],
    out: () => {},
    err: (line) => errors.push(line),
    buildManagedDatabaseRuntimeGuardReport: () => {
      throw new Error("managed database runtime guard unavailable");
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(errors, ["managed database runtime guard unavailable"]);
});
