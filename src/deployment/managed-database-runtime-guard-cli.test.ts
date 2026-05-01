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
