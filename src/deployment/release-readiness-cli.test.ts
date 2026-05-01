import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseReadinessCli } from "./release-readiness-cli.js";

function parseJsonOutput(output: string[]): Record<string, unknown> {
  return JSON.parse(output[0] ?? "") as Record<string, unknown>;
}

test("runReleaseReadinessCli prints the report as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_RELEASE_CHANNEL: "phase-43" } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseReadinessReport: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        readyForRelease: false,
        phase: 43,
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    readyForRelease: false,
    phase: 43,
  });
});

test("runReleaseReadinessCli exports local JSON readiness in non-strict mode", async () => {
  const output: string[] = [];
  const env = {} as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    env,
    out: (line) => output.push(line),
  });
  const report = parseJsonOutput(output);

  assert.equal(exitCode, 0);
  assert.equal(report.readyForRelease, true);
  assert.equal(report.phase, "43");
  assert.equal((report.storageTopology as { mode?: unknown }).mode, "json");
  assert.equal((report.asyncStoreBoundary as { phase?: unknown }).phase, "49");
  assert.equal((report.asyncStoreBoundary as { managedPostgresSupported?: unknown }).managedPostgresSupported, false);
});

test("runReleaseReadinessCli fails strict mode when the report is not release-ready", async () => {
  let receivedStrict: boolean | undefined;
  const exitCode = await runReleaseReadinessCli({
    argv: ["--strict"],
    out: () => {},
    buildReleaseReadinessReport: (_env, deps) => {
      receivedStrict = deps?.strict;
      return { readyForRelease: false };
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(receivedStrict, true);
});

test("runReleaseReadinessCli strict mode blocks managed database runtime handoff", async () => {
  const output: string[] = [];
  const env = {
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: ["--strict"],
    env,
    out: (line) => output.push(line),
  });
  const report = parseJsonOutput(output);
  const serializedReport = JSON.stringify(report);

  assert.equal(exitCode, 1);
  assert.equal(report.readyForRelease, false);
  assert.match(serializedReport, /Phase 52 managed Postgres startup support requires/);
  assert.match(serializedReport, /managed-database-blocked/);
  assert.match(serializedReport, /Phase 49 async-store boundary exists as foundation/);
  assert.match(serializedReport, /managed Postgres remains unsupported/);
  assert.doesNotMatch(serializedReport, /taskloom:secret/);
});

test("runReleaseReadinessCli passes strict mode when the report is release-ready", async () => {
  const exitCode = await runReleaseReadinessCli({
    argv: ["--strict"],
    out: () => {},
    buildReleaseReadinessReport: () => ({ readyForRelease: true }),
  });

  assert.equal(exitCode, 0);
});

test("runReleaseReadinessCli preserves Phase 57 implementation-scope fields while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-region",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseReadinessReport: () => ({
      readyForRelease: false,
      managedDatabaseRuntimeGuard: {
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
          implementationScopeSecret: "phase57-readiness-secret",
          summary: "Phase 57 release readiness implementation scope is recorded.",
        },
      },
    }),
  });
  const report = parseJsonOutput(output) as {
    managedDatabaseRuntimeGuard?: {
      phase57?: {
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
  assert.equal(report.phase57?.summary, "Phase 57 release readiness implementation scope is recorded.");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57?.implementationScopeSecret, "[redacted]");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57?.runtimeSupport, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57?.multiWriterSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase57?.releaseAllowed, false);
  assert.doesNotMatch(output[0] ?? "", /phase57-readiness-secret/);
});

test("runReleaseReadinessCli preserves Phase 58 validation fields while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-region",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseReadinessReport: () => ({
      readyForRelease: false,
      managedDatabaseRuntimeGuard: {
        phase58: {
          runtimeImplementationValidationEvidenceAttached: true,
          runtimeImplementationValidated: true,
          runtimeImplementationValidationGatePassed: true,
          validationOwner: "release-engineering",
          evidenceUrl: "https://evidence.example.com/phase58/release-readiness-validation",
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          validationSecret: "phase58-readiness-secret",
          summary: "Phase 58 release readiness validation evidence is recorded.",
        },
      },
    }),
  });
  const report = parseJsonOutput(output) as {
    managedDatabaseRuntimeGuard?: {
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
  assert.equal(report.phase58?.validationOwner, "release-engineering");
  assert.equal(report.phase58?.evidenceUrl, "[redacted]");
  assert.equal(report.phase58?.runtimeSupport, false);
  assert.equal(report.phase58?.runtimeSupported, false);
  assert.equal(report.phase58?.multiWriterSupported, false);
  assert.equal(report.phase58?.runtimeImplementationBlocked, true);
  assert.equal(report.phase58?.runtimeSupportBlocked, true);
  assert.equal(report.phase58?.releaseAllowed, false);
  assert.equal(report.phase58?.strictBlocker, false);
  assert.equal(report.phase58?.validationSecret, "[redacted]");
  assert.equal(report.phase58?.summary, "Phase 58 release readiness validation evidence is recorded.");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.evidenceUrl, "[redacted]");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.runtimeSupport, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.runtimeSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.multiWriterSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.releaseAllowed, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase58?.validationSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase58-readiness-secret/);
});

test("runReleaseReadinessCli preserves Phase 59 enablement fields while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-region",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseReadinessReport: () => ({
      readyForRelease: false,
      managedDatabaseRuntimeGuard: {
        phase59: {
          runtimeEnablementDecision: "approved",
          runtimeEnablementApprover: "release-council",
          runtimeEnablementRolloutWindow: "maintenance-window-59",
          runtimeEnablementMonitoringSignoff: "observability-ready",
          runtimeEnablementAbortPlan: "https://runbooks.example.com/phase59/readiness-abort",
          runtimeEnablementReleaseTicket: "MW-59",
          runtimeEnablementApprovalEvidenceComplete: true,
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          approvalSecret: "phase59-readiness-secret",
          summary: "Phase 59 release readiness enablement approval is recorded.",
        },
      },
    }),
  });
  const report = parseJsonOutput(output) as {
    managedDatabaseRuntimeGuard?: {
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
  assert.equal(report.phase59?.summary, "Phase 59 release readiness enablement approval is recorded.");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.runtimeEnablementAbortPlan, "[redacted]");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.runtimeSupport, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.runtimeSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.multiWriterSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.runtimeImplementationBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.runtimeSupportBlocked, true);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.releaseAllowed, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase59?.approvalSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /runbooks\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase59-readiness-secret/);
});

test("runReleaseReadinessCli preserves Phase 60 support-presence fields while blocking release claims", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-region",
  } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseReadinessReport: () => ({
      readyForRelease: false,
      managedDatabaseRuntimeGuard: {
        phase60: {
          implementationPresent: "implementation-present",
          explicitSupportStatement: "support statement captured",
          compatibilityMatrix: "https://evidence.example.com/phase60/readiness-matrix",
          cutoverEvidence: "https://evidence.example.com/phase60/readiness-cutover",
          releaseAutomationApproval: "https://approvals.example.com/phase60/readiness-release-automation",
          ownerAcceptance: "owner-accepted",
          runtimeSupportPresenceAssertionComplete: true,
          runtimeSupport: true,
          runtimeSupported: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          runtimeSupportBlocked: false,
          releaseAllowed: true,
          strictBlocker: false,
          assertionSecret: "phase60-readiness-secret",
          summary: "Phase 60 release readiness support presence assertion is recorded.",
        },
      },
    }),
  });
  const report = parseJsonOutput(output) as {
    managedDatabaseRuntimeGuard?: {
      phase60?: {
        compatibilityMatrix?: unknown;
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
  assert.equal(report.phase60?.summary, "Phase 60 release readiness support presence assertion is recorded.");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase60?.compatibilityMatrix, "[redacted]");
  assert.equal(report.managedDatabaseRuntimeGuard?.phase60?.runtimeSupport, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase60?.runtimeSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase60?.multiWriterSupported, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase60?.releaseAllowed, false);
  assert.equal(report.managedDatabaseRuntimeGuard?.phase60?.assertionSecret, "[redacted]");
  assert.doesNotMatch(output[0] ?? "", /evidence\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /approvals\.example\.com/);
  assert.doesNotMatch(output[0] ?? "", /phase60-readiness-secret/);
});

test("runReleaseReadinessCli returns an error exit code when the builder throws", async () => {
  const errors: string[] = [];

  const exitCode = await runReleaseReadinessCli({
    argv: [],
    out: () => {},
    err: (line) => errors.push(line),
    buildReleaseReadinessReport: () => {
      throw new Error("release readiness unavailable");
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(errors, ["release readiness unavailable"]);
});
