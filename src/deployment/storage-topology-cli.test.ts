import assert from "node:assert/strict";
import test from "node:test";
import { runStorageTopologyCli } from "./storage-topology-cli.js";

test("runStorageTopologyCli prints the report as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_STORAGE_MODE: "sqlite" } as NodeJS.ProcessEnv;

  const exitCode = await runStorageTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildStorageTopologyReport: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        readyForProduction: false,
        storageMode: "sqlite",
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    readyForProduction: false,
    storageMode: "sqlite",
  });
});

test("runStorageTopologyCli only fails readiness in strict mode", async () => {
  const nonStrictExitCode = await runStorageTopologyCli({
    argv: [],
    out: () => {},
    buildStorageTopologyReport: () => ({ readyForProduction: false }),
  });
  const strictExitCode = await runStorageTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildStorageTopologyReport: () => ({ readyForProduction: false }),
  });

  assert.equal(nonStrictExitCode, 0);
  assert.equal(strictExitCode, 1);
});

test("runStorageTopologyCli treats unsupported readiness as not production-ready in strict mode", async () => {
  const exitCode = await runStorageTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildStorageTopologyReport: () => ({ storageMode: "memory" }),
  });

  assert.equal(exitCode, 1);
});

test("runStorageTopologyCli passes strict mode when the report is production-ready", async () => {
  const exitCode = await runStorageTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildStorageTopologyReport: () => ({ readyForProduction: true }),
  });

  assert.equal(exitCode, 0);
});
