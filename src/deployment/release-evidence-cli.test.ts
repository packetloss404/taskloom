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
