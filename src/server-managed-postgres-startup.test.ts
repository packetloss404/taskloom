import assert from "node:assert/strict";
import test from "node:test";
import {
  assertManagedDatabaseRuntimeSupported,
  ManagedDatabaseRuntimeGuardError,
  type ManagedDatabaseRuntimeGuardEnv,
} from "./deployment/managed-database-runtime-guard.js";

function assertServerStartupRuntimeSupported(env: ManagedDatabaseRuntimeGuardEnv) {
  return assertManagedDatabaseRuntimeSupported(env);
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

test("server startup guard allows managed Postgres startup with a recognized adapter and managed database URL", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
});

test("server startup guard allows explicit TASKLOOM_STORE=postgres startup with a recognized adapter and database URL", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "postgres",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgresql",
    TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
});

test("server startup guard keeps managed Postgres allowed regardless of the database topology hint", () => {
  for (const topology of ["single-writer", "multi-writer", "distributed", "active-active", "multi-region"]) {
    const report = assertServerStartupRuntimeSupported({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: topology,
    });

    assert.equal(report.allowed, true);
    assert.equal(report.classification, "managed-postgres");
    assert.equal(report.managedDatabaseRuntimeBlocked, false);
    assert.equal(report.observed.databaseTopology, topology);
  }
});

test("server startup guard blocks an unsupported store posture before startup", () => {
  assert.throws(
    () =>
      assertServerStartupRuntimeSupported({
        TASKLOOM_STORE: "memory",
      }),
    (error) => {
      assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
      assert.equal(error.report.allowed, false);
      assert.equal(error.report.classification, "unsupported-store");
      assert.equal(error.report.observed.store, "memory");
      assert.ok(error.report.blockers.some((blocker) => blocker.includes("TASKLOOM_STORE=memory")));
      return true;
    },
  );
});

test("server startup guard blocks a managed Postgres store requested without a recognized adapter", () => {
  assert.throws(
    () =>
      assertServerStartupRuntimeSupported({
        TASKLOOM_STORE: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      }),
    (error) => {
      assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
      assert.equal(error.report.allowed, false);
      assert.equal(error.report.classification, "managed-database-blocked");
      assert.equal(error.report.managedDatabaseRuntimeBlocked, true);
      assert.ok(error.report.blockers.length > 0);
      return true;
    },
  );
});

test("server startup guard blocks a managed database URL configured without a recognized adapter", () => {
  assert.throws(
    () =>
      assertServerStartupRuntimeSupported({
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      }),
    (error) => {
      assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
      assert.equal(error.report.allowed, false);
      assert.equal(error.report.classification, "managed-database-blocked");
      assert.equal(error.report.managedDatabaseRuntimeBlocked, true);
      return true;
    },
  );
});

test("server startup guard bypass downgrades an unsupported managed posture to a warning", () => {
  const report = assertServerStartupRuntimeSupported({
    TASKLOOM_STORE: "postgres",
    TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS: "true",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "bypassed");
  assert.equal(report.status, "warn");
});
