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

test("runManagedDatabaseTopologyCli blocks multi-writer topology with Phase 53 and Phase 54 status and redacted URLs", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: ["--strict"],
    env,
    out: (line) => output.push(line),
  });
  const serializedReport = output[0] ?? "";
  const report = JSON.parse(serializedReport) as {
    phase53?: { phase?: unknown; multiWriterSupported?: unknown };
    phase54?: { phase?: unknown; designPackageGatePassed?: unknown; strictBlocker?: unknown };
    phase55?: {
      phase?: unknown;
      designPackageReviewPassed?: unknown;
      implementationAuthorized?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      strictBlocker?: unknown;
    };
    classification?: unknown;
    managedDatabase?: { supported?: unknown; phase54?: { designPackageGatePassed?: unknown; strictBlocker?: unknown } };
  };

  assert.equal(exitCode, 1);
  assert.equal(report.classification, "managed-database-requested");
  assert.equal(report.managedDatabase?.supported, false);
  assert.equal(report.phase53?.phase, "53");
  assert.equal(report.phase53?.multiWriterSupported, false);
  assert.equal(report.phase54?.phase, "54");
  assert.equal(report.phase54?.designPackageGatePassed, false);
  assert.equal(report.phase54?.strictBlocker, true);
  assert.equal(report.phase55?.phase, "55");
  assert.equal(report.phase55?.designPackageReviewPassed, false);
  assert.equal(report.phase55?.implementationAuthorized, false);
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterSupported, false);
  assert.equal(report.phase55?.runtimeImplementationBlocked, true);
  assert.equal(report.phase55?.strictBlocker, true);
  assert.equal(report.managedDatabase?.phase54?.designPackageGatePassed, false);
  assert.equal(report.managedDatabase?.phase54?.strictBlocker, true);
  assert.match(serializedReport, /Phase 53/);
  assert.match(serializedReport, /Phase 54/);
  assert.match(serializedReport, /Phase 55/);
  assert.match(serializedReport, /multi-writer/);
  assert.doesNotMatch(serializedReport, /taskloom:secret/);
});

test("runManagedDatabaseTopologyCli preserves Phase 55 review authorization fields from the builder", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase55: {
          designPackageReviewPassed: true,
          implementationAuthorized: true,
          reviewOwner: "architecture-council",
          runtimeSupport: true,
          multiWriterSupported: true,
          runtimeImplementationBlocked: false,
          strictBlocker: false,
          authorizationSecret: "phase55-cli-secret",
          summary: "Phase 55 review passed and implementation authorization is recorded.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase55?: {
      phase?: unknown;
      designPackageReviewPassed?: unknown;
      implementationAuthorized?: unknown;
      reviewOwner?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      runtimeImplementationBlocked?: unknown;
      strictBlocker?: unknown;
      authorizationSecret?: unknown;
      summary?: unknown;
    };
    managedDatabase?: {
      phase55?: {
        authorizationSecret?: unknown;
        runtimeSupport?: unknown;
        multiWriterSupported?: unknown;
        runtimeImplementationBlocked?: unknown;
      };
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase55?.phase, "55");
  assert.equal(report.phase55?.designPackageReviewPassed, true);
  assert.equal(report.phase55?.implementationAuthorized, true);
  assert.equal(report.phase55?.reviewOwner, "architecture-council");
  assert.equal(report.phase55?.runtimeSupport, false);
  assert.equal(report.phase55?.multiWriterSupported, false);
  assert.equal(report.phase55?.runtimeImplementationBlocked, true);
  assert.equal(report.phase55?.strictBlocker, false);
  assert.equal(report.phase55?.authorizationSecret, "[redacted]");
  assert.equal(report.phase55?.summary, "Phase 55 review passed and implementation authorization is recorded.");
  assert.equal(report.managedDatabase?.phase55?.authorizationSecret, "[redacted]");
  assert.equal(report.managedDatabase?.phase55?.runtimeSupport, false);
  assert.equal(report.managedDatabase?.phase55?.multiWriterSupported, false);
  assert.equal(report.managedDatabase?.phase55?.runtimeImplementationBlocked, true);
  assert.doesNotMatch(output[0] ?? "", /phase55-cli-secret/);
});

test("runManagedDatabaseTopologyCli preserves detailed Phase 54 design-package reports from the builder", async () => {
  const output: string[] = [];
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "distributed",
  } as NodeJS.ProcessEnv;

  const exitCode = await runManagedDatabaseTopologyCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildManagedDatabaseTopologyReport: () => ({
      ready: false,
      managedDatabase: {
        phase54: {
          multiWriterTopologyRequested: true,
          topologyOwnerConfigured: true,
          consistencyModelConfigured: true,
          failoverPitrPlanConfigured: true,
          migrationBackfillPlanConfigured: true,
          observabilityPlanConfigured: true,
          rollbackPlanConfigured: true,
          designPackageGatePassed: true,
          runtimeSupport: false,
          strictBlocker: false,
          summary: "Phase 54 design package evidence is complete.",
        },
      },
    }),
  });
  const report = JSON.parse(output[0] ?? "") as {
    phase54?: {
      phase?: unknown;
      topologyOwnerConfigured?: unknown;
      designPackageGatePassed?: unknown;
      runtimeSupport?: unknown;
      strictBlocker?: unknown;
      summary?: unknown;
    };
    managedDatabase?: { phase54?: { designPackageGatePassed?: unknown } };
  };

  assert.equal(exitCode, 0);
  assert.equal(report.phase54?.phase, "54");
  assert.equal(report.phase54?.topologyOwnerConfigured, true);
  assert.equal(report.phase54?.designPackageGatePassed, true);
  assert.equal(report.phase54?.runtimeSupport, false);
  assert.equal(report.phase54?.strictBlocker, false);
  assert.equal(report.phase54?.summary, "Phase 54 design package evidence is complete.");
  assert.equal(report.managedDatabase?.phase54?.designPackageGatePassed, true);
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
