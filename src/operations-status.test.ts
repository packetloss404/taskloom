import assert from "node:assert/strict";
import test from "node:test";
import type { JobRecord, TaskloomData } from "./taskloom-store.js";
import {
  getOperationsStatus,
  type JobTypeMetrics,
  type ManagedDatabaseRuntimeGuardReport,
  type ManagedDatabaseTopologyReport,
  type StorageTopologyReport,
} from "./operations-status.js";

function emptyStore(): TaskloomData {
  return { jobs: [] } as unknown as TaskloomData;
}

function storeWithJobs(jobs: JobRecord[]): TaskloomData {
  return { jobs } as unknown as TaskloomData;
}

function fakeJob(type: string, status: JobRecord["status"], id: string): JobRecord {
  return {
    id,
    workspaceId: "alpha",
    type,
    payload: {},
    status,
    attempts: 0,
    maxAttempts: 1,
    scheduledAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("default env yields json store, off leader mode, off access log, default knobs", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.store.mode, "json");
  assert.equal(status.scheduler.leaderMode, "off");
  assert.equal(status.scheduler.leaderTtlMs, 30000);
  assert.equal(status.scheduler.leaderHeldLocally, true);
  assert.equal(status.scheduler.lockSummary, "local");
  assert.equal(status.accessLog.mode, "off");
  assert.equal(status.accessLog.path, null);
  assert.equal(status.accessLog.maxBytes, 0);
  assert.equal(status.accessLog.maxFiles, 5);
  assert.deepEqual(status.jobs, []);
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.status, "pass");
  assert.equal(status.asyncStoreBoundary?.classification, "foundation-ready");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.localRuntimeSupported, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
  assert.equal(status.managedPostgresCapability.phase, "50");
  assert.equal(status.managedPostgresCapability.adapterConfigured, false);
  assert.equal(status.managedPostgresCapability.adapterAvailable, false);
  assert.equal(status.managedPostgresCapability.backfillAvailable, false);
  assert.equal(status.managedPostgresCapability.syncRuntimeGuarded, false);
  assert.equal(status.runtime.nodeVersion, process.versions.node);
});

test("TASKLOOM_STORE=sqlite flips store mode", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.store.mode, "sqlite");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
  assert.match(String(status.asyncStoreBoundary?.summary), /JSON and single-node SQLite/i);
});

test("file leader mode reflects custom path and not-held when no probe registered", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_SCHEDULER_LEADER_MODE: "FILE",
      TASKLOOM_SCHEDULER_LEADER_FILE_PATH: "var/lib/taskloom/leader.json",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "file");
  assert.equal(status.scheduler.lockSummary, "var/lib/taskloom/leader.json");
  assert.equal(status.scheduler.leaderHeldLocally, false);
});

test("http leader mode strips query string from URL summary", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_SCHEDULER_LEADER_MODE: "http",
      TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://coord.internal/leader?token=secret123&extra=yes",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "http");
  assert.equal(status.scheduler.lockSummary, "https://coord.internal/leader");
  assert.equal(status.scheduler.leaderHeldLocally, false);
});

test("invalid leader mode falls back to off without throwing", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_SCHEDULER_LEADER_MODE: "bogus" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "off");
  assert.equal(status.scheduler.lockSummary, "local");
  assert.equal(status.scheduler.leaderHeldLocally, true);
});

test("jobs grouping aggregates statuses across types and uses succeeded for success", () => {
  const status = getOperationsStatus({
    loadStore: () => storeWithJobs([
      fakeJob("agent.run", "queued", "j1"),
      fakeJob("agent.run", "queued", "j2"),
      fakeJob("agent.run", "running", "j3"),
      fakeJob("agent.run", "success", "j4"),
      fakeJob("agent.run", "failed", "j5"),
      fakeJob("agent.run", "canceled", "j6"),
      fakeJob("brief.send", "queued", "j7"),
      fakeJob("brief.send", "success", "j8"),
      fakeJob("brief.send", "success", "j9"),
    ]),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.deepEqual(status.jobs, [
    { type: "agent.run", queued: 2, running: 1, succeeded: 1, failed: 1, canceled: 1 },
    { type: "brief.send", queued: 1, running: 0, succeeded: 2, failed: 0, canceled: 0 },
  ]);
});

test("access log reads max bytes, clamps max files to >= 1, and exposes file path", () => {
  const clamped = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "FILE",
      TASKLOOM_ACCESS_LOG_PATH: "logs/access.log",
      TASKLOOM_ACCESS_LOG_MAX_BYTES: "1048576",
      TASKLOOM_ACCESS_LOG_MAX_FILES: "0",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(clamped.accessLog.mode, "file");
  assert.equal(clamped.accessLog.path, "logs/access.log");
  assert.equal(clamped.accessLog.maxBytes, 1048576);
  assert.equal(clamped.accessLog.maxFiles, 1);

  const stdoutMode = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
      TASKLOOM_ACCESS_LOG_MAX_FILES: "10",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(stdoutMode.accessLog.mode, "stdout");
  assert.equal(stdoutMode.accessLog.path, null);
  assert.equal(stdoutMode.accessLog.maxFiles, 10);
});

test("storageTopology is built from the injected environment", () => {
  const fixture = {
    ready: true,
    status: "ready",
    summary: "sqlite database and backup path configured",
    checks: [
      { name: "database", status: "ready", detail: "TASKLOOM_STORE=sqlite" },
      { name: "backup", status: "ready", detail: "TASKLOOM_BACKUP_DIR configured" },
    ],
  };
  let observedBackupDir: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite", TASKLOOM_BACKUP_DIR: "backups" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildStorageTopologyReport: (env) => {
      observedBackupDir = env.TASKLOOM_BACKUP_DIR;
      return fixture as never;
    },
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(observedBackupDir, "backups");
  assert.deepEqual(status.storageTopology, fixture);
});

test("managedDatabaseTopology is built from the injected environment", () => {
  const fixture = {
    readyForManagedDatabase: true,
    status: "ready",
    summary: "managed postgres topology configured",
    observed: {
      requested: true,
      configured: true,
      supported: true,
      topology: "managed",
      provider: "postgres",
      currentStore: "sqlite",
    },
    checks: [
      { id: "requested", status: "ready", detail: "Managed database requested" },
      { id: "provider", status: "ready", detail: "Provider configured" },
    ],
  };
  let observedProvider: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_MANAGED_DATABASE_PROVIDER: "postgres" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseTopologyReport: (env) => {
      observedProvider = env.TASKLOOM_MANAGED_DATABASE_PROVIDER;
      return fixture as never;
    },
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(observedProvider, "postgres");
  assert.deepEqual(status.managedDatabaseTopology, fixture);
});

test("managedDatabaseRuntimeGuard is built from the injected environment", () => {
  const fixture: ManagedDatabaseRuntimeGuardReport = {
    phase: "46",
    allowed: false,
    status: "fail",
    classification: "managed-database-blocked",
    summary: "managed database runtime intent is blocked",
    observed: {
      nodeEnv: "development",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      bypassEnabled: false,
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      managedDatabaseAdapter: null,
      env: {},
    },
    phase50: {
      asyncAdapterConfigured: false,
      asyncAdapterAvailable: false,
      backfillAvailable: false,
      adapter: null,
      syncStartupSupported: false,
    },
    checks: [
      { id: "managed-database-runtime", status: "fail", summary: "Managed database runtime is not enabled" },
      { id: "multi-writer-runtime", status: "pass", summary: "No multi-writer intent detected" },
    ],
    blockers: ["Remove managed database runtime intent before startup"],
    warnings: ["DATABASE_URL is advisory until runtime support lands"],
    nextSteps: ["Use single-node SQLite until the managed database adapter is ready"],
  };
  let observedProvider: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_MANAGED_DATABASE_PROVIDER: "postgres" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseRuntimeGuardReport: (env) => {
      observedProvider = env.TASKLOOM_MANAGED_DATABASE_PROVIDER;
      return fixture;
    },
  });

  assert.equal(observedProvider, "postgres");
  assert.deepEqual(status.managedDatabaseRuntimeGuard, fixture);
});

test("managedDatabaseRuntimeBoundary passes through when a managed runtime report exposes it", () => {
  const runtimeGuard = {
    phase: "48",
    allowed: false,
    status: "fail",
    classification: "managed-database-blocked",
    summary: "managed database runtime intent is blocked at the runtime boundary",
    runtimeBoundary: {
      status: "blocked",
      classification: "runtime-boundary",
      summary: "Managed database runtime boundary is enforced; managed DB runtime remains unsupported.",
      enforced: true,
    },
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      bypassEnabled: false,
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
  } as unknown as ManagedDatabaseRuntimeGuardReport;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_DATABASE_TOPOLOGY: "managed-database" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseRuntimeGuardReport: () => runtimeGuard,
  });

  assert.equal(status.managedDatabaseRuntimeBoundary?.source, "managedDatabaseRuntimeGuard");
  assert.equal(status.managedDatabaseRuntimeBoundary?.status, "blocked");
  assert.equal(status.managedDatabaseRuntimeBoundary?.classification, "runtime-boundary");
  assert.equal(status.managedDatabaseRuntimeBoundary?.enforced, true);
  assert.match(String(status.managedDatabaseRuntimeBoundary?.summary), /managed DB runtime remains unsupported/i);
});

test("asyncStoreBoundary passes through when a deployment report exposes it", () => {
  const releaseReadiness = {
    summary: "stubbed release readiness",
    asyncStoreBoundary: {
      phase: "49",
      status: "present",
      classification: "single-node-sqlite",
      summary: "Phase 49 async boundary evidence supplied by readiness.",
      foundationPresent: true,
      managedDatabaseRuntimeAllowed: false,
      managedDatabaseRuntimeBlocked: true,
    },
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: () => releaseReadiness as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.asyncStoreBoundary?.source, "releaseReadiness");
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.status, "present");
  assert.equal(status.asyncStoreBoundary?.classification, "single-node-sqlite");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
});

test("asyncStoreBoundary derives managed database runtime as blocked from runtime reports", () => {
  const runtimeGuard = {
    phase: "46",
    allowed: false,
    managedDatabaseRuntimeBlocked: true,
    status: "fail",
    classification: "managed-database-blocked",
    summary: "managed database runtime intent is blocked",
    checks: [],
    blockers: ["Remove managed database runtime intent before startup"],
    warnings: ["DATABASE_URL is advisory until runtime support lands"],
    nextSteps: ["Use single-node SQLite until the managed database adapter is ready"],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      bypassEnabled: false,
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
  } as unknown as ManagedDatabaseRuntimeGuardReport;
  const managedDatabaseTopology = {
    phase: "45",
    status: "fail",
    classification: "managed-database-requested",
    ready: false,
    summary: "managed database topology requested",
    checks: [],
    blockers: ["Managed database runtime unavailable"],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: "managed-database",
      managedDatabaseUrl: "[redacted]",
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      env: {},
    },
    managedDatabase: { requested: true, configured: true, supported: false },
  } as unknown as ManagedDatabaseTopologyReport;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite", TASKLOOM_DATABASE_TOPOLOGY: "managed-database" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildManagedDatabaseTopologyReport: () => managedDatabaseTopology,
    buildManagedDatabaseRuntimeGuardReport: () => runtimeGuard,
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }) as never,
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }) as never,
  });

  assert.equal(status.asyncStoreBoundary?.source, "derived");
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.status, "blocked");
  assert.equal(status.asyncStoreBoundary?.classification, "managed-database-blocked");
  assert.equal(status.asyncStoreBoundary?.foundationPresent, true);
  assert.equal(status.asyncStoreBoundary?.localRuntimeSupported, true);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, false);
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeBlocked, true);
  assert.match(String(status.asyncStoreBoundary?.summary), /managed database runtime remains blocked/i);
});

test("managedPostgresCapability reports configured adapter/backfill and Phase 52 startup support", () => {
  const env = {
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env,
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.managedPostgresCapability.phase, "50");
  assert.equal(status.managedPostgresCapability.status, "available");
  assert.equal(status.managedPostgresCapability.provider, "postgres");
  assert.equal(status.managedPostgresCapability.adapterConfigured, true);
  assert.equal(status.managedPostgresCapability.adapterAvailable, true);
  assert.equal(status.managedPostgresCapability.backfillAvailable, true);
  assert.equal(status.managedPostgresCapability.managedIntentDetected, true);
  assert.equal(status.managedPostgresCapability.syncRuntimeGuarded, false);
  assert.equal(status.managedPostgresCapability.runtimeAllowed, true);
  assert.equal(status.managedPostgresCapability.adapter, "postgres");
  assert.deepEqual(status.managedPostgresCapability.configuredHintKeys, [
    "DATABASE_URL",
    "TASKLOOM_MANAGED_DATABASE_ADAPTER",
  ]);
  assert.ok(status.managedPostgresCapability.backfillCommands.includes("npm run db:backfill-activation-signals"));
  assert.match(status.managedPostgresCapability.summary, /configured and available/i);
  assert.equal(status.managedPostgresStartupSupport.phase, "52");
  assert.equal(status.managedPostgresStartupSupport.status, "supported");
  assert.equal(status.managedPostgresStartupSupport.startupSupported, true);
  assert.equal(status.managedPostgresStartupSupport.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.phase, "53");
  assert.equal(status.managedPostgresTopologyGate.status, "supported");
  assert.equal(status.managedPostgresTopologyGate.singleWriterManagedPostgresSupported, true);
  assert.equal(status.managedPostgresTopologyGate.multiWriterIntentDetected, false);
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.requirementsOnly, false);
  assert.equal(status.managedPostgresTopologyGate.implementationScope, "single-writer-managed-postgres");
  assert.equal(status.asyncStoreBoundary?.phase, "49");
  assert.equal(status.asyncStoreBoundary?.managedDatabaseRuntimeAllowed, true);
  assert.equal(status.asyncStoreBoundary?.phase52ManagedStartupSupported, true);
  assert.equal(status.managedDatabaseRuntimeGuard.allowed, true);
});

test("managedPostgresTopologyGate blocks multi-writer intent without changing Phase 52 startup support semantics", () => {
  const env = {
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    TASKLOOM_DATABASE_TOPOLOGY: "active-active",
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env,
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.managedPostgresStartupSupport.phase, "52");
  assert.equal(status.managedPostgresStartupSupport.status, "multi-writer-unsupported");
  assert.equal(status.managedPostgresStartupSupport.startupSupported, false);
  assert.equal(status.managedPostgresStartupSupport.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.phase, "53");
  assert.equal(status.managedPostgresTopologyGate.status, "blocked");
  assert.equal(status.managedPostgresTopologyGate.topologyIntent, "active-active");
  assert.equal(status.managedPostgresTopologyGate.managedIntentDetected, true);
  assert.equal(status.managedPostgresTopologyGate.singleWriterManagedPostgresSupported, false);
  assert.equal(status.managedPostgresTopologyGate.multiWriterIntentDetected, true);
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.requirementsOnly, true);
  assert.equal(status.managedPostgresTopologyGate.implementationScope, "none");
  assert.match(status.managedPostgresTopologyGate.summary, /design intent only, not implementation support/i);
  assert.match(status.managedPostgresTopologyGate.summary, /multiWriterSupported=false/);
});

test("releaseReadiness is built from the injected environment", () => {
  const fixture = {
    readyForRelease: false,
    status: "blocked",
    summary: "release readiness blocked by missing confirmation",
    checks: [
      { id: "release-confirmed", status: "blocked", detail: "Release confirmation is missing" },
      { id: "storage-topology", status: "ready", detail: "Storage topology classified" },
    ],
    blockers: ["Confirm release owner sign-off"],
    warnings: [],
    nextSteps: ["Record release confirmation before handoff"],
  };
  let observedNodeEnv: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { NODE_ENV: "production" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseReadinessReport: (env) => {
      observedNodeEnv = env.NODE_ENV;
      return fixture as never;
    },
  });

  assert.equal(observedNodeEnv, "production");
  assert.deepEqual(status.releaseReadiness, fixture);
});

test("releaseEvidence is built from the injected environment", () => {
  const fixture = {
    generatedAt: "2026-04-26T12:00:00.000Z",
    readyForRelease: true,
    status: "ready",
    summary: "release evidence bundle includes handoff checks",
    includedEvidence: [
      { id: "readiness", title: "Release readiness", status: "pass" },
      { id: "storage", title: "Storage topology", status: "pass" },
    ],
    attachments: [
      { id: "handoff", name: "release-handoff.json", path: "artifacts/release-handoff.json" },
    ],
  };
  let observedPhase: string | undefined;

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_RELEASE_PHASE: "44" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildReleaseEvidenceBundle: (env) => {
      observedPhase = env.TASKLOOM_RELEASE_PHASE;
      return fixture as never;
    },
  });

  assert.equal(observedPhase, "44");
  assert.deepEqual(status.releaseEvidence, fixture);
});

test("release readiness and evidence receive the already-built managed reports", () => {
  const storageTopology = {
    readyForProduction: true,
    status: "ready",
    summary: "single-node sqlite storage ready",
  } as unknown as StorageTopologyReport;
  const managedDatabaseTopology: ManagedDatabaseTopologyReport = {
    phase: "45",
    status: "pass",
    classification: "single-node-sqlite",
    ready: true,
    summary: "managed database topology handoff captured",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: null,
      managedDatabaseUrl: null,
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      managedDatabaseAdapter: null,
      env: {},
    },
    managedDatabase: {
      requested: false,
      configured: false,
      supported: false,
      syncStartupSupported: false,
      phase50: {
        asyncAdapterConfigured: false,
        asyncAdapterAvailable: false,
        backfillAvailable: false,
        adapter: null,
      },
    },
  };
  const managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport = {
    phase: "46",
    allowed: true,
    status: "pass",
    classification: "single-node-sqlite",
    summary: "runtime guard allows single-node sqlite",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    observed: {
      nodeEnv: "production",
      store: "sqlite",
      dbPath: "/srv/taskloom/taskloom.sqlite",
      databaseTopology: null,
      bypassEnabled: false,
      managedDatabaseUrl: null,
      databaseUrl: null,
      taskloomDatabaseUrl: null,
      managedDatabaseAdapter: null,
      env: {},
    },
    phase50: {
      asyncAdapterConfigured: false,
      asyncAdapterAvailable: false,
      backfillAvailable: false,
      adapter: null,
      syncStartupSupported: false,
    },
  };
  const releaseReadiness = {
    readyForRelease: true,
    status: "ready",
    summary: "release readiness includes managed handoff",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: [],
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  };
  const releaseEvidence = {
    generatedAt: "2026-04-26T12:00:00.000Z",
    readyForRelease: true,
    status: "ready",
    summary: "release evidence includes managed handoff",
    includedEvidence: [],
    attachments: [],
    storageTopology,
    releaseReadiness,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  };

  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    buildStorageTopologyReport: () => storageTopology,
    buildManagedDatabaseTopologyReport: () => managedDatabaseTopology,
    buildManagedDatabaseRuntimeGuardReport: () => managedDatabaseRuntimeGuard,
    buildReleaseReadinessReport: (_env, deps) => {
      assert.equal(deps?.storageTopology, storageTopology);
      assert.equal(deps?.managedDatabaseTopology, managedDatabaseTopology);
      assert.equal(deps?.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
      return releaseReadiness as never;
    },
    buildReleaseEvidenceBundle: (_env, deps) => {
      assert.equal(deps?.storageTopology, storageTopology);
      assert.equal(deps?.managedDatabaseTopology, managedDatabaseTopology);
      assert.equal(deps?.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
      assert.equal(deps?.releaseReadiness, releaseReadiness);
      return releaseEvidence as never;
    },
  });

  assert.equal(status.storageTopology, storageTopology);
  assert.equal(status.managedDatabaseTopology, managedDatabaseTopology);
  assert.equal(status.managedDatabaseRuntimeGuard, managedDatabaseRuntimeGuard);
  assert.equal(status.releaseReadiness, releaseReadiness);
  assert.equal(status.releaseEvidence, releaseEvidence);
});

test("generatedAt reflects the injected now", () => {
  const fixedDate = new Date("2026-04-26T13:37:00.000Z");
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => fixedDate,
  });

  assert.equal(status.generatedAt, "2026-04-26T13:37:00.000Z");
});

test("jobMetrics defaults to an empty array when the fixture returns none", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    jobTypeMetrics: () => [],
  });

  assert.deepEqual(status.jobMetrics, []);
});

test("jobMetrics fixture appears verbatim in the result", () => {
  const fixture: JobTypeMetrics[] = [
    {
      type: "agent.run",
      totalRuns: 3,
      succeededRuns: 2,
      failedRuns: 1,
      canceledRuns: 0,
      lastRunStartedAt: "2026-04-26T11:59:00.000Z",
      lastRunFinishedAt: "2026-04-26T11:59:30.000Z",
      lastDurationMs: 30000,
      averageDurationMs: 25000,
      p95DurationMs: 29000,
    },
  ];
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    jobTypeMetrics: () => fixture,
  });

  assert.deepEqual(status.jobMetrics, fixture);
});

test("jobMetricsSnapshots reports zero and null when the store has no snapshots", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.deepEqual(status.jobMetricsSnapshots, { total: 0, lastCapturedAt: null });
});

test("jobMetricsSnapshots picks the max capturedAt across out-of-order rows", () => {
  const store = {
    jobs: [],
    jobMetricSnapshots: [
      { id: "s1", capturedAt: "2026-01-01T00:00:00.000Z", type: "agent.run" },
      { id: "s2", capturedAt: "2026-01-03T00:00:00.000Z", type: "agent.run" },
      { id: "s3", capturedAt: "2026-01-02T00:00:00.000Z", type: "agent.run" },
    ],
  } as unknown as TaskloomData;

  const status = getOperationsStatus({
    loadStore: () => store,
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.jobMetricsSnapshots.total, 3);
  assert.equal(status.jobMetricsSnapshots.lastCapturedAt, "2026-01-03T00:00:00.000Z");
});

test("jobMetricsSnapshots falls back to null when the only row has an unparseable capturedAt", () => {
  const store = {
    jobs: [],
    jobMetricSnapshots: [
      { id: "s1", capturedAt: "not-a-date", type: "agent.run" },
    ],
  } as unknown as TaskloomData;

  const status = getOperationsStatus({
    loadStore: () => store,
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.jobMetricsSnapshots.total, 1);
  assert.equal(status.jobMetricsSnapshots.lastCapturedAt, null);
});

test("jobMetrics preserves the order returned by the fixture", () => {
  const fixture: JobTypeMetrics[] = [
    {
      type: "zeta.task",
      totalRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
      canceledRuns: 0,
      lastRunStartedAt: "2026-04-26T10:00:00.000Z",
      lastRunFinishedAt: "2026-04-26T10:00:05.000Z",
      lastDurationMs: 5000,
      averageDurationMs: 5000,
      p95DurationMs: null,
    },
    {
      type: "alpha.task",
      totalRuns: 2,
      succeededRuns: 0,
      failedRuns: 2,
      canceledRuns: 0,
      lastRunStartedAt: "2026-04-26T11:00:00.000Z",
      lastRunFinishedAt: "2026-04-26T11:00:10.000Z",
      lastDurationMs: 10000,
      averageDurationMs: null,
      p95DurationMs: null,
    },
  ];
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    jobTypeMetrics: () => fixture,
  });

  assert.equal(status.jobMetrics.length, 2);
  assert.equal(status.jobMetrics[0].type, "zeta.task");
  assert.equal(status.jobMetrics[1].type, "alpha.task");
  assert.deepEqual(status.jobMetrics, fixture);
});
