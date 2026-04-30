import assert from "node:assert/strict";
import test from "node:test";
import {
  assertManagedDatabaseRuntimeSupported,
  ManagedDatabaseRuntimeGuardError,
  type ManagedDatabaseRuntimeGuardEnv,
} from "./deployment/managed-database-runtime-guard.js";

function assertServerStartupRuntimeSupported(env: ManagedDatabaseRuntimeGuardEnv) {
  return assertManagedDatabaseRuntimeSupported(env, {
    phase51: {
      remainingSyncCallSiteGroups: [],
      managedPostgresStartupSupported: true,
    },
  });
}

test("server startup guard keeps local JSON allowed", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "json",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "local-json");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
});

test("server startup guard keeps single-node SQLite allowed", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "data/taskloom.sqlite",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "single-node-sqlite");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
});

test("server startup guard allows asserted single-writer managed Postgres startup", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "single-writer",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.phase51?.managedPostgresStartupSupported, true);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
});

test("server startup guard allows explicit single-writer TASKLOOM_STORE=postgres startup", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "postgres",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgresql",
    TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "single-writer",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, true);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
});

test("server startup guard still blocks multi-writer, distributed, and active-active topologies before startup", () => {
  const blockedTopologies = ["multi-writer", "distributed", "active-active", "multi-region"] as const;

  for (const topology of blockedTopologies) {
    assert.throws(
      () =>
        assertServerStartupRuntimeSupported({
          TASKLOOM_STORE: "postgres",
          TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
          TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
          TASKLOOM_DATABASE_TOPOLOGY: topology,
        }),
      (error) => {
        assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
        assert.equal(error.report.allowed, false);
        assert.equal(error.report.classification, "multi-writer-blocked");
        assert.equal(error.report.managedDatabaseRuntimeBlocked, true);
        assert.equal(error.report.observed.databaseTopology, topology);
        assert.equal(error.report.phase50?.asyncAdapterAvailable, true);
        assert.equal(error.report.phase52?.managedPostgresStartupSupported, false);
        assert.match(error.report.phase52?.summary ?? "", /multi-writer, distributed, or active-active/);
        return true;
      },
    );
  }
});
