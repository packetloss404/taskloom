import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils.js";
import { getOperationsHealth, type OperationsHealthReport } from "./operations-health.js";
import { operationsHealthRoutes } from "./operations-health-routes.js";
import { login } from "./taskloom-services.js";
import { mutateStore, resetStoreForTests } from "./taskloom-store.js";

function createApp() {
  const app = new Hono();
  app.route("/api/app/operations/health", operationsHealthRoutes);
  return app;
}

function authHeaders(cookieValue: string) {
  return { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
}

function findSubsystem(report: OperationsHealthReport, name: string) {
  const subsystem = report.subsystems.find((entry) => entry.name === name);
  assert.ok(subsystem, `expected subsystem ${name} to be present`);
  return subsystem;
}

test("operations health route rejects unauthenticated requests", async () => {
  resetStoreForTests();
  const app = createApp();

  const response = await app.request("/api/app/operations/health");

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication required" });
});

test("operations health route rejects members below admin role", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  mutateStore((data) => {
    const membership = data.memberships.find(
      (entry) => entry.workspaceId === "alpha" && entry.userId === "user_alpha",
    );
    assert.ok(membership);
    membership.role = "member";
  });
  const app = createApp();

  const response = await app.request("/api/app/operations/health", {
    headers: authHeaders(auth.cookieValue),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "workspace role admin is required" });
});

test("operations health route returns the report shape for an admin-equivalent owner", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const app = createApp();

  const response = await app.request("/api/app/operations/health", {
    headers: authHeaders(auth.cookieValue),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.ok(typeof body.generatedAt === "string");
  assert.ok(typeof body.overall === "string");
  assert.ok(Array.isArray(body.subsystems));
  const subsystems = body.subsystems as Array<Record<string, unknown>>;
  assert.ok(subsystems.length > 0);
  for (const subsystem of subsystems) {
    assert.ok(typeof subsystem.name === "string");
    assert.ok(typeof subsystem.status === "string");
    assert.ok(typeof subsystem.detail === "string");
    assert.ok(typeof subsystem.checkedAt === "string");
  }
  assert.ok(subsystems.some((subsystem) => subsystem.name === "managedPostgresTopologyGate"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterTopologyDesignPackageGate"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterTopologyImplementationAuthorizationGate"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterTopologyImplementationReadinessGate"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterTopologyImplementationScope"));
});

test("operations health surfaces supported single-writer managed Postgres topology gate", () => {
  const report = getOperationsHealth({
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => ({
      schedulerStartedAt: "2026-04-26T09:59:00.000Z",
      lastTickStartedAt: "2026-04-26T10:00:00.000Z",
      lastTickEndedAt: "2026-04-26T10:00:00.500Z",
      lastTickDurationMs: 500,
      ticksSinceStart: 7,
    }),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "off",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const gate = findSubsystem(report, "managedPostgresTopologyGate");
  assert.equal(gate.status, "ok");
  assert.match(gate.detail, /single-writer managed Postgres/i);
  assert.match(gate.detail, /active-active runtime support remains unavailable/i);
  const designPackageGate = findSubsystem(report, "multiWriterTopologyDesignPackageGate");
  assert.equal(designPackageGate.status, "disabled");
  assert.match(designPackageGate.detail, /Phase 54 design-package gate is not required/i);
  assert.match(designPackageGate.detail, /runtimeSupported=false/);
  const implementationAuthorizationGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationAuthorizationGate",
  );
  assert.equal(implementationAuthorizationGate.status, "disabled");
  assert.match(implementationAuthorizationGate.detail, /Phase 55 implementation-authorization gate is not required/i);
  assert.match(implementationAuthorizationGate.detail, /runtimeSupported=false/);
  const implementationReadinessGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationReadinessGate",
  );
  assert.equal(implementationReadinessGate.status, "disabled");
  assert.match(implementationReadinessGate.detail, /Phase 56 implementation readiness and rollout-safety gate is not required/i);
  assert.match(implementationReadinessGate.detail, /runtimeSupported=false/);
  const implementationScope = findSubsystem(report, "multiWriterTopologyImplementationScope");
  assert.equal(implementationScope.status, "disabled");
  assert.match(implementationScope.detail, /Phase 57 implementation-scope status is not required/i);
  assert.match(implementationScope.detail, /runtimeSupported=false/);
  assert.equal(report.overall, "ok");
});

test("operations health degrades for blocked multi-writer topology intent", () => {
  const report = getOperationsHealth({
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => ({
      schedulerStartedAt: "2026-04-26T09:59:00.000Z",
      lastTickStartedAt: "2026-04-26T10:00:00.000Z",
      lastTickEndedAt: "2026-04-26T10:00:00.500Z",
      lastTickDurationMs: 500,
      ticksSinceStart: 7,
    }),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "off",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "active-active",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const gate = findSubsystem(report, "managedPostgresTopologyGate");
  assert.equal(gate.status, "degraded");
  assert.match(gate.detail, /Phase 53 blocks active-active intent/i);
  assert.match(gate.detail, /design intent only, not implementation support/i);
  assert.match(gate.detail, /multiWriterSupported=false/);
  const designPackageGate = findSubsystem(report, "multiWriterTopologyDesignPackageGate");
  assert.equal(designPackageGate.status, "degraded");
  assert.match(designPackageGate.detail, /Phase 54 design package is incomplete/i);
  assert.match(designPackageGate.detail, /topology owner/i);
  assert.match(designPackageGate.detail, /failover\/PITR/i);
  assert.match(designPackageGate.detail, /runtimeSupported=false/);
  const implementationAuthorizationGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationAuthorizationGate",
  );
  assert.equal(implementationAuthorizationGate.status, "degraded");
  assert.match(implementationAuthorizationGate.detail, /Phase 55 implementation authorization is blocked/i);
  assert.match(implementationAuthorizationGate.detail, /Phase 54 design package is complete/i);
  assert.match(implementationAuthorizationGate.detail, /runtimeSupported=false/);
  const implementationReadinessGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationReadinessGate",
  );
  assert.equal(implementationReadinessGate.status, "degraded");
  assert.match(implementationReadinessGate.detail, /Phase 56 implementation readiness and rollout-safety gate is blocked/i);
  assert.match(implementationReadinessGate.detail, /Phase 55 implementation authorization is recorded/i);
  assert.match(implementationReadinessGate.detail, /runtimeSupported=false/);
  const implementationScope = findSubsystem(report, "multiWriterTopologyImplementationScope");
  assert.equal(implementationScope.status, "degraded");
  assert.match(implementationScope.detail, /Phase 57 implementation-scope status is blocked/i);
  assert.match(implementationScope.detail, /until Phase 56 implementation readiness and rollout-safety evidence is complete/i);
  assert.match(implementationScope.detail, /runtimeImplementationBlocked=true/);
  assert.match(implementationScope.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports complete Phase 54 design package without enabling multi-writer runtime", () => {
  const report = getOperationsHealth({
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => ({
      schedulerStartedAt: "2026-04-26T09:59:00.000Z",
      lastTickStartedAt: "2026-04-26T10:00:00.000Z",
      lastTickEndedAt: "2026-04-26T10:00:00.500Z",
      lastTickDurationMs: 500,
      ticksSinceStart: 7,
    }),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "off",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const designPackageGate = findSubsystem(report, "multiWriterTopologyDesignPackageGate");
  assert.equal(designPackageGate.status, "degraded");
  assert.match(designPackageGate.detail, /Phase 54 design package is complete/i);
  assert.match(designPackageGate.detail, /topology owner, consistency model, failover\/PITR, migration\/backfill, observability, and rollback evidence/i);
  assert.match(designPackageGate.detail, /multi-writer runtime remains unsupported/i);
  const implementationAuthorizationGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationAuthorizationGate",
  );
  assert.equal(implementationAuthorizationGate.status, "degraded");
  assert.match(implementationAuthorizationGate.detail, /Phase 55 implementation authorization is blocked/i);
  assert.match(implementationAuthorizationGate.detail, /design-package review/i);
  assert.match(implementationAuthorizationGate.detail, /runtimeSupported=false/);
  const implementationReadinessGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationReadinessGate",
  );
  assert.equal(implementationReadinessGate.status, "degraded");
  assert.match(implementationReadinessGate.detail, /Phase 56 implementation readiness and rollout-safety gate is blocked/i);
  assert.match(implementationReadinessGate.detail, /Phase 55 implementation authorization is recorded/i);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 55 implementation authorization without enabling runtime", () => {
  const report = getOperationsHealth({
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => ({
      schedulerStartedAt: "2026-04-26T09:59:00.000Z",
      lastTickStartedAt: "2026-04-26T10:00:00.000Z",
      lastTickEndedAt: "2026-04-26T10:00:00.500Z",
      lastTickDurationMs: 500,
      ticksSinceStart: 7,
    }),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "off",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "artifacts/phase55/design-package-review.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "artifacts/phase55/implementation-auth.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const implementationAuthorizationGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationAuthorizationGate",
  );
  assert.equal(implementationAuthorizationGate.status, "degraded");
  assert.match(implementationAuthorizationGate.detail, /Phase 55 design-package review and implementation authorization are recorded/i);
  assert.match(implementationAuthorizationGate.detail, /runtime implementation remains blocked/i);
  assert.match(implementationAuthorizationGate.detail, /runtimeSupported=false/);
  const implementationReadinessGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationReadinessGate",
  );
  assert.equal(implementationReadinessGate.status, "degraded");
  assert.match(implementationReadinessGate.detail, /Phase 56 implementation readiness and rollout-safety gate is blocked/i);
  assert.match(implementationReadinessGate.detail, /implementation readiness evidence/i);
  assert.match(implementationReadinessGate.detail, /rollout-safety evidence/i);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 56 readiness and rollout safety without enabling runtime", () => {
  const report = getOperationsHealth({
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => ({
      schedulerStartedAt: "2026-04-26T09:59:00.000Z",
      lastTickStartedAt: "2026-04-26T10:00:00.000Z",
      lastTickEndedAt: "2026-04-26T10:00:00.500Z",
      lastTickDurationMs: 500,
      ticksSinceStart: 7,
    }),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "off",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "artifacts/phase55/design-package-review.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "artifacts/phase55/implementation-auth.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "artifacts/phase56/readiness.md",
      TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "artifacts/phase56/rollout-safety.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const implementationReadinessGate = findSubsystem(
    report,
    "multiWriterTopologyImplementationReadinessGate",
  );
  assert.equal(implementationReadinessGate.status, "degraded");
  assert.match(implementationReadinessGate.detail, /Phase 56 implementation readiness and rollout-safety evidence is complete/i);
  assert.match(implementationReadinessGate.detail, /runtime implementation remains blocked/i);
  assert.match(implementationReadinessGate.detail, /runtimeSupported=false/);
  const implementationScope = findSubsystem(report, "multiWriterTopologyImplementationScope");
  assert.equal(implementationScope.status, "degraded");
  assert.match(implementationScope.detail, /Phase 57 implementation-scope status is blocked/i);
  assert.match(implementationScope.detail, /implementation-scope lock/i);
  assert.match(implementationScope.detail, /runtimeSupported=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 57 implementation scope without enabling runtime", () => {
  const report = getOperationsHealth({
    loadStore: () => ({ ok: true }),
    schedulerHeartbeat: () => ({
      schedulerStartedAt: "2026-04-26T09:59:00.000Z",
      lastTickStartedAt: "2026-04-26T10:00:00.000Z",
      lastTickEndedAt: "2026-04-26T10:00:00.500Z",
      lastTickDurationMs: 500,
      ticksSinceStart: 7,
    }),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "off",
      TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "artifacts/phase53/requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "artifacts/phase53/design.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes plus async reconciliation",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE: "artifacts/phase54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE: "artifacts/phase54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE: "artifacts/phase54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE: "artifacts/phase54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW: "artifacts/phase55/design-package-review.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION: "artifacts/phase55/implementation-auth.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "artifacts/phase56/readiness.md",
      TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "artifacts/phase56/rollout-safety.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "artifacts/phase57/implementation-scope-lock.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "artifacts/phase57/runtime-feature-flag.md",
      TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "artifacts/phase57/validation.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "artifacts/phase57/migration-cutover-lock.md",
      TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "artifacts/phase57/release-owner-signoff.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const implementationScope = findSubsystem(report, "multiWriterTopologyImplementationScope");
  assert.equal(implementationScope.status, "degraded");
  assert.match(implementationScope.detail, /Phase 57 implementation-scope evidence is complete/i);
  assert.match(implementationScope.detail, /runtime implementation remains blocked and unsupported/i);
  assert.match(implementationScope.detail, /runtimeImplementationBlocked=true/);
  assert.match(implementationScope.detail, /runtimeSupported=false/);
  assert.match(implementationScope.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});
