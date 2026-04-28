import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseReadinessCli } from "./release-readiness-cli.js";

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
