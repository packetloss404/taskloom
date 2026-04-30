import assert from "node:assert/strict";
import test from "node:test";
import { ManagedDatabaseRuntimeGuardError } from "./deployment/managed-database-runtime-guard.js";
import { assertServerStartupRuntimeSupported } from "./server.js";

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
  });

  assert.equal(report.allowed, true);
  assert.equal(report.classification, "managed-postgres");
  assert.equal(report.managedDatabaseRuntimeBlocked, false);
  assert.equal(report.phase51?.managedPostgresStartupSupported, true);
  assert.equal(report.phase52?.managedPostgresStartupSupported, true);
});

test("server startup guard still blocks multi-writer topology before startup", () => {
  assert.throws(
    () =>
      assertServerStartupRuntimeSupported({
        TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
        TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      }),
    (error) => {
      assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
      assert.equal(error.report.allowed, false);
      assert.equal(error.report.classification, "multi-writer-blocked");
      assert.equal(error.report.phase52?.managedPostgresStartupSupported, false);
      return true;
    },
  );
});
