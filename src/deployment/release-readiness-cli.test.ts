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
