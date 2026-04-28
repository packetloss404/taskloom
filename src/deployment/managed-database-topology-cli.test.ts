import assert from "node:assert/strict";
import test from "node:test";
import { runManagedDatabaseTopologyCli } from "./managed-database-topology-cli.js";

test("runManagedDatabaseTopologyCli prints the report as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_DATABASE_TOPOLOGY: "managed" } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        readyForProductionManagedDatabase: false,
        topology: "managed-postgres",
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    readyForProductionManagedDatabase: false,
    topology: "managed-postgres",
  });
});

test("runManagedDatabaseTopologyCli fails strict mode when the report is not ready for managed DB production", async () => {
  let receivedStrict: boolean | undefined;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseTopologyReport: (_env, deps) => {
      receivedStrict = deps?.strict;
      return { readyForProductionManagedDatabase: false };
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(receivedStrict, true);
});

test("runManagedDatabaseTopologyCli passes strict mode when the report is ready for managed DB production", async () => {
  const exitCode = await runManagedDatabaseTopologyCli({
    argv: ["--strict"],
    out: () => {},
    buildManagedDatabaseTopologyReport: () => ({ ready: true }),
  });

  assert.equal(exitCode, 0);
});

test("runManagedDatabaseTopologyCli returns an error exit code when the builder throws", async () => {
  const errors: string[] = [];

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    out: () => {},
    err: (line) => errors.push(line),
    buildManagedDatabaseTopologyReport: () => {
      throw new Error("managed database topology unavailable");
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(errors, ["managed database topology unavailable"]);
});
