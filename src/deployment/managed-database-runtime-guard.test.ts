import assert from "node:assert/strict";
import test from "node:test";
import {
  assertManagedDatabaseRuntimeSupported,
  assessManagedDatabaseRuntimeGuard,
  buildManagedDatabaseRuntimeGuardReport,
  ManagedDatabaseRuntimeGuardError,
  type ManagedDatabaseRuntimeGuardObservedEnvValue,
} from "./managed-database-runtime-guard.js";

function observedEnvValue(
  report: ReturnType<typeof assessManagedDatabaseRuntimeGuard>,
  name: string,
): ManagedDatabaseRuntimeGuardObservedEnvValue {
  const entry = report.observed.env[name];
  assert.ok(entry, `expected observed env entry for ${name}`);
  return entry;
}

test("local JSON runtime is allowed by default", () => {
  const report = assessManagedDatabaseRuntimeGuard({ env: {} });

  assert.equal(report.phase, "46");
  assert.equal(report.allowed, true);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "local-json");
  assert.equal(report.observed.store, "json");
  assert.equal(report.observed.dbPath, null);
  assert.equal(report.phase50?.asyncAdapterAvailable, false);
  assert.equal(report.phase50?.backfillAvailable, false);
  assert.equal(report.phase50?.syncStartupSupported, false);
  assert.equal(report.phase51?.tracked, true);
  assert.equal(report.phase51?.runtimeCallSitesMigrated, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, false);
  assert.deepEqual(report.phase51?.remainingSyncCallSiteGroups, []);
  assert.equal(report.blockers.length, 0);
  assert.ok(report.summary.includes("local JSON"));
  assert.ok(report.checks.some((check) => check.id === "supported-runtime-store" && check.status === "pass"));
});

test("single-node SQLite runtime is allowed", () => {
  const report = buildManagedDatabaseRuntimeGuardReport({
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_DATABASE_TOPOLOGY: "single-node-sqlite",
  });

  assert.equal(report.allowed, true);
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "single-node-sqlite");
  assert.equal(report.observed.store, "sqlite");
  assert.equal(report.observed.dbPath, "/srv/taskloom/taskloom.sqlite");
  assert.equal(report.observed.databaseTopology, "single-node-sqlite");
  assert.equal(report.phase50?.asyncAdapterConfigured, false);
  assert.equal(report.blockers.length, 0);
  assert.ok(report.summary.includes("single-node SQLite"));
});

test("managed database URL is redacted and blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });
  const urlEntry = observedEnvValue(report, "DATABASE_URL");

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(urlEntry.configured, true);
  assert.equal(urlEntry.redacted, true);
  assert.equal(urlEntry.value, "[redacted]");
  assert.equal(report.observed.databaseUrl, "[redacted]");
  assert.ok(report.blockers.some((blocker) => blocker.includes("Managed database runtime intent")));
  assert.ok(report.warnings.some((warning) => warning.includes("redacted")));
  assert.ok(report.nextSteps.some((step) => step.includes("synchronous app startup configuration")));
});

test("Phase 50 async postgres adapter and managed URL report capability while blocking sync startup", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(report.phase50?.asyncAdapterConfigured, true);
  assert.equal(report.phase50?.asyncAdapterAvailable, true);
  assert.equal(report.phase50?.backfillAvailable, true);
  assert.equal(report.phase50?.syncStartupSupported, false);
  assert.equal(report.phase50?.adapter, "postgres");
  assert.equal(report.phase51?.runtimeCallSitesMigrated, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, false);
  assert.ok(report.phase51?.summary.includes("no remaining sync call-site groups"));
  assert.equal(report.observed.managedDatabaseAdapter, "postgres");
  assert.ok(report.summary.includes("blocked unsupported managed database"));
  assert.ok(report.blockers.some((blocker) => blocker.includes("managed Postgres startup support is not asserted")));
  assert.ok(report.warnings.some((warning) => warning.includes("Phase 50 async managed adapter/backfill capability")));
  assert.ok(report.warnings.some((warning) => warning.includes("no remaining sync call-site groups")));
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_STORE: "sqlite",
        TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
        TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      }),
    ManagedDatabaseRuntimeGuardError,
  );
});

test("Phase 51 migration evidence can report migrated call sites without asserting startup support", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    phase51: {
      remainingSyncCallSiteGroups: [],
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.phase51?.runtimeCallSitesMigrated, true);
  assert.equal(report.phase51?.managedPostgresStartupSupported, false);
  assert.equal(report.phase51?.strictBlocker, true);
  assert.ok(report.blockers.some((blocker) => blocker.includes("startup support is not asserted")));
});

test("TASKLOOM_STORE=postgres is blocked at the managed runtime boundary", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "postgres",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(report.observed.store, "postgres");
  assert.ok(report.blockers.some((blocker) => blocker.includes("synchronous managed database runtime boundary")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("sync app startup path supported")));
  assert.ok(report.nextSteps.some((step) => step.includes("Phase 50 async adapter/backfill evidence")));
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_STORE: "postgres",
      }),
    ManagedDatabaseRuntimeGuardError,
  );
});

test("TASKLOOM_STORE=managed is blocked at the managed runtime boundary", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "managed",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(report.observed.store, "managed");
  assert.ok(report.blockers.some((blocker) => blocker.includes("sync app startup path supported")));
});

test("managed URL hints are redacted and block strict startup", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
    },
  });
  const managedUrl = observedEnvValue(report, "TASKLOOM_MANAGED_DATABASE_URL");
  const taskloomDatabaseUrl = observedEnvValue(report, "TASKLOOM_DATABASE_URL");

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "managed-database-blocked");
  assert.equal(managedUrl.value, "[redacted]");
  assert.equal(managedUrl.redacted, true);
  assert.equal(taskloomDatabaseUrl.value, "[redacted]");
  assert.equal(taskloomDatabaseUrl.redacted, true);
  assert.ok(report.warnings.some((warning) => warning.includes("synchronous app startup configuration")));
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_STORE: "sqlite",
        TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@taskloom.internal/app",
      }),
    ManagedDatabaseRuntimeGuardError,
  );
});

test("multi-writer topology is blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.managedDatabaseRuntimeBlocked, true);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "multi-writer-blocked");
  assert.equal(report.observed.databaseTopology, "multi-writer");
  assert.ok(report.checks.some((check) => check.id === "single-writer-runtime" && check.status === "fail"));
  assert.ok(report.nextSteps.some((step) => step.includes("multi-writer runtime support")));
});

test("unsupported store is blocked", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "memory",
    },
  });

  assert.equal(report.allowed, false);
  assert.equal(report.status, "fail");
  assert.equal(report.classification, "unsupported-store");
  assert.equal(report.observed.store, "memory");
  assert.ok(report.blockers.some((blocker) => blocker.includes("TASKLOOM_STORE=memory")));
});

test("explicit bypass warns but allows assert helper to continue", () => {
  const report = assessManagedDatabaseRuntimeGuard({
    env: {
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS: "true",
    },
  });

  assert.equal(report.allowed, true);
  assert.equal(report.status, "warn");
  assert.equal(report.classification, "bypassed");
  assert.equal(report.observed.bypassEnabled, true);
  assert.equal(observedEnvValue(report, "TASKLOOM_MANAGED_DATABASE_URL").value, "[redacted]");
  assert.ok(report.blockers.length > 0);
  assert.ok(report.warnings.some((warning) => warning.includes("bypassed")));
  assert.doesNotThrow(() =>
    assertManagedDatabaseRuntimeSupported({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS: "true",
    }),
  );
});

test("assert helper throws when unsupported runtime is not bypassed", () => {
  assert.throws(
    () =>
      assertManagedDatabaseRuntimeSupported({
        TASKLOOM_DATABASE_TOPOLOGY: "distributed",
      }),
    (error) => {
      assert.ok(error instanceof ManagedDatabaseRuntimeGuardError);
      assert.equal(error.report.phase, "46");
      assert.equal(error.report.allowed, false);
      assert.equal(error.report.classification, "multi-writer-blocked");
      return true;
    },
  );
});
