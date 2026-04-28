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
