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
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterRuntimeImplementationValidation"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterRuntimeReleaseEnablementApproval"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterRuntimeSupportPresenceAssertion"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "multiWriterRuntimeActivationControls"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "managedPostgresHorizontalWriterConcurrency"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "distributedDependencyEnforcement"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "managedPostgresRecoveryValidation"));
  assert.ok(subsystems.some((subsystem) => subsystem.name === "managedPostgresCutoverAutomation"));
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
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }),
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }),
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
  const runtimeImplementationValidation = findSubsystem(report, "multiWriterRuntimeImplementationValidation");
  assert.equal(runtimeImplementationValidation.status, "disabled");
  assert.match(runtimeImplementationValidation.detail, /Phase 58 runtime implementation validation is not required/i);
  assert.match(runtimeImplementationValidation.detail, /runtimeSupported=false/);
  const releaseEnablementApproval = findSubsystem(report, "multiWriterRuntimeReleaseEnablementApproval");
  assert.equal(releaseEnablementApproval.status, "disabled");
  assert.match(releaseEnablementApproval.detail, /Phase 59 runtime release-enable approval is not required/i);
  assert.match(releaseEnablementApproval.detail, /runtimeSupported=false/);
  const supportPresenceAssertion = findSubsystem(report, "multiWriterRuntimeSupportPresenceAssertion");
  assert.equal(supportPresenceAssertion.status, "disabled");
  assert.match(supportPresenceAssertion.detail, /Phase 60 runtime support presence assertion is not required/i);
  assert.match(supportPresenceAssertion.detail, /runtimeSupported=false/);
  const activationControls = findSubsystem(report, "multiWriterRuntimeActivationControls");
  assert.equal(activationControls.status, "disabled");
  assert.match(activationControls.detail, /Phase 61 runtime activation controls are not required/i);
  assert.match(activationControls.detail, /runtimeSupported=false/);
  const horizontalWriterConcurrency = findSubsystem(report, "managedPostgresHorizontalWriterConcurrency");
  assert.equal(horizontalWriterConcurrency.status, "disabled");
  assert.match(horizontalWriterConcurrency.detail, /Phase 62 managed Postgres horizontal app-writer concurrency hardening is not configured/i);
  assert.match(horizontalWriterConcurrency.detail, /multi-writer database support remain separate blocked capabilities/i);
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
    buildReleaseReadinessReport: () => ({ summary: "stubbed release readiness" }),
    buildReleaseEvidenceBundle: () => ({ summary: "stubbed release evidence" }),
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
  const runtimeImplementationValidation = findSubsystem(report, "multiWriterRuntimeImplementationValidation");
  assert.equal(runtimeImplementationValidation.status, "degraded");
  assert.match(runtimeImplementationValidation.detail, /Phase 58 runtime implementation validation is blocked/i);
  assert.match(runtimeImplementationValidation.detail, /until Phase 57 implementation scope is complete/i);
  assert.match(runtimeImplementationValidation.detail, /runtimeImplementationBlocked=true/);
  assert.match(runtimeImplementationValidation.detail, /runtimeSupported=false/);
  assert.match(runtimeImplementationValidation.detail, /releaseAllowed=false/);
  const releaseEnablementApproval = findSubsystem(report, "multiWriterRuntimeReleaseEnablementApproval");
  assert.equal(releaseEnablementApproval.status, "degraded");
  assert.match(releaseEnablementApproval.detail, /Phase 59 runtime release-enable approval is blocked/i);
  assert.match(releaseEnablementApproval.detail, /until Phase 58 runtime implementation validation is complete/i);
  assert.match(releaseEnablementApproval.detail, /runtimeImplementationBlocked=true/);
  assert.match(releaseEnablementApproval.detail, /runtimeSupported=false/);
  assert.match(releaseEnablementApproval.detail, /releaseAllowed=false/);
  const supportPresenceAssertion = findSubsystem(report, "multiWriterRuntimeSupportPresenceAssertion");
  assert.equal(supportPresenceAssertion.status, "degraded");
  assert.match(supportPresenceAssertion.detail, /Phase 60 runtime support presence assertion is blocked/i);
  assert.match(supportPresenceAssertion.detail, /until Phase 59 release-enable approval is complete/i);
  assert.match(supportPresenceAssertion.detail, /runtimeImplementationBlocked=true/);
  assert.match(supportPresenceAssertion.detail, /runtimeSupported=false/);
  assert.match(supportPresenceAssertion.detail, /releaseAllowed=false/);
  const activationControls = findSubsystem(report, "multiWriterRuntimeActivationControls");
  assert.equal(activationControls.status, "degraded");
  assert.match(activationControls.detail, /Phase 61 runtime activation controls are blocked/i);
  assert.match(activationControls.detail, /until Phase 60 runtime support presence assertion is complete/i);
  assert.match(activationControls.detail, /runtimeImplementationBlocked=true/);
  assert.match(activationControls.detail, /runtimeSupported=false/);
  assert.match(activationControls.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 61 activation controls complete from deployment reports but still blocked", () => {
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
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
    buildReleaseEvidenceBundle: () => ({
      phase60: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        status: "assertion-complete",
        assertionStatus: "complete",
      },
      phase61: {
        multiWriterIntentDetected: true,
        topologyIntent: "multi-writer",
        activationDecision: "report-approved-for-activation-audit-only",
        activationOwner: "report-activation-owner",
        activationWindow: "2026-05-03T02:00:00Z/2026-05-03T04:00:00Z",
        activationFlag: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER=false",
        releaseAutomationAssertion: "artifacts/reports/phase61-release-automation-assertion.md",
      },
      includedEvidence: [],
      attachments: [],
    }),
  });

  const activationControls = findSubsystem(report, "multiWriterRuntimeActivationControls");
  assert.equal(activationControls.status, "degraded");
  assert.match(activationControls.detail, /Phase 61 runtime activation controls are complete/i);
  assert.match(activationControls.detail, /activation audit/i);
  assert.match(activationControls.detail, /distributed, active-active, regional\/PITR, and SQLite-distributed runtime support remain unsupported/i);
  assert.match(activationControls.detail, /runtimeImplementationBlocked=true/);
  assert.match(activationControls.detail, /runtimeSupported=false/);
  assert.match(activationControls.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 62 horizontal app-writer hardening separately from database multi-writer support", () => {
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
      TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_AUDIT:
        "artifacts/phase62/write-path-concurrency-audit.md",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TESTS:
        "artifacts/phase62/concurrent-writer-tests.tap",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_CONTROL:
        "row-version compare-and-swap on document updates",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY:
        "artifacts/phase62/transaction-retry-idempotency.md",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_RELEASE_ASSERTION:
        "artifacts/phase62/horizontal-writer-release-assertion.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const horizontalWriterConcurrency = findSubsystem(report, "managedPostgresHorizontalWriterConcurrency");
  assert.equal(horizontalWriterConcurrency.status, "ok");
  assert.match(horizontalWriterConcurrency.detail, /Phase 62 managed Postgres horizontal app-writer concurrency hardening is complete/i);
  assert.match(horizontalWriterConcurrency.detail, /multiple Taskloom app processes writing to one managed Postgres primary/i);
  assert.match(horizontalWriterConcurrency.detail, /multi-writer database support remain unsupported/i);
  assert.match(horizontalWriterConcurrency.detail, /releaseAllowed=false/);
  const distributedDependencyEnforcement = findSubsystem(report, "distributedDependencyEnforcement");
  assert.equal(distributedDependencyEnforcement.status, "degraded");
  assert.match(distributedDependencyEnforcement.detail, /Phase 63 distributed dependency enforcement blocks strict activation/i);
  assert.match(distributedDependencyEnforcement.detail, /activationAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health accepts canonical Phase 62 release evidence env keys", () => {
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
      TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION:
        "artifacts/phase62/horizontal-writer-hardening.md",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE:
        "artifacts/phase62/concurrency-tests.tap",
      TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE:
        "artifacts/phase62/transaction-retry.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const horizontalWriterConcurrency = findSubsystem(report, "managedPostgresHorizontalWriterConcurrency");
  assert.equal(horizontalWriterConcurrency.status, "ok");
  assert.match(horizontalWriterConcurrency.detail, /Phase 62 managed Postgres horizontal app-writer concurrency hardening is complete/i);
});

test("operations health degrades Phase 62 when horizontal app-writer evidence is missing", () => {
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
      TASKLOOM_APP_WRITER_TOPOLOGY: "horizontal",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const horizontalWriterConcurrency = findSubsystem(report, "managedPostgresHorizontalWriterConcurrency");
  assert.equal(horizontalWriterConcurrency.status, "degraded");
  assert.match(horizontalWriterConcurrency.detail, /Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked/i);
  assert.match(horizontalWriterConcurrency.detail, /managed Postgres write-path concurrency audit/i);
  assert.match(horizontalWriterConcurrency.detail, /managed Postgres horizontal-writer release assertion/i);
  assert.match(horizontalWriterConcurrency.detail, /multi-writer database support remain unsupported/i);
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
  const runtimeImplementationValidation = findSubsystem(report, "multiWriterRuntimeImplementationValidation");
  assert.equal(runtimeImplementationValidation.status, "degraded");
  assert.match(runtimeImplementationValidation.detail, /Phase 58 runtime implementation validation is blocked/i);
  assert.match(runtimeImplementationValidation.detail, /runtime implementation evidence/i);
  assert.match(runtimeImplementationValidation.detail, /operations runbook/i);
  assert.match(runtimeImplementationValidation.detail, /runtime release signoff/i);
  assert.match(runtimeImplementationValidation.detail, /runtimeSupported=false/);
  assert.match(runtimeImplementationValidation.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 58 runtime validation complete but still blocked", () => {
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
      TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "artifacts/phase58/runtime-implementation.md",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "artifacts/phase58/consistency-validation.md",
      TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "artifacts/phase58/failover-validation.md",
      TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "artifacts/phase58/data-integrity-validation.md",
      TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "artifacts/phase58/operations-runbook.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "artifacts/phase58/runtime-release-signoff.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const runtimeImplementationValidation = findSubsystem(report, "multiWriterRuntimeImplementationValidation");
  assert.equal(runtimeImplementationValidation.status, "degraded");
  assert.match(runtimeImplementationValidation.detail, /Phase 58 runtime implementation validation evidence is complete/i);
  assert.match(runtimeImplementationValidation.detail, /runtime implementation remains blocked and unsupported/i);
  assert.match(runtimeImplementationValidation.detail, /runtimeImplementationBlocked=true/);
  assert.match(runtimeImplementationValidation.detail, /runtimeSupported=false/);
  assert.match(runtimeImplementationValidation.detail, /releaseAllowed=false/);
  const releaseEnablementApproval = findSubsystem(report, "multiWriterRuntimeReleaseEnablementApproval");
  assert.equal(releaseEnablementApproval.status, "degraded");
  assert.match(releaseEnablementApproval.detail, /Phase 59 runtime release-enable approval is blocked/i);
  assert.match(releaseEnablementApproval.detail, /runtime enablement decision/i);
  assert.match(releaseEnablementApproval.detail, /runtime enablement release ticket/i);
  assert.match(releaseEnablementApproval.detail, /runtimeSupported=false/);
  assert.match(releaseEnablementApproval.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 59 release-enable approval complete but still blocked", () => {
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
      TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "artifacts/phase58/runtime-implementation.md",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "artifacts/phase58/consistency-validation.md",
      TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "artifacts/phase58/failover-validation.md",
      TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "artifacts/phase58/data-integrity-validation.md",
      TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "artifacts/phase58/operations-runbook.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "artifacts/phase58/runtime-release-signoff.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-release-gate-only",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "platform-release-owner",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW:
        "2026-05-02T02:00:00Z/2026-05-02T04:00:00Z",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF:
        "artifacts/phase59/monitoring-signoff.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "artifacts/phase59/abort-plan.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "TASKLOOM-59",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const releaseEnablementApproval = findSubsystem(report, "multiWriterRuntimeReleaseEnablementApproval");
  assert.equal(releaseEnablementApproval.status, "degraded");
  assert.match(releaseEnablementApproval.detail, /Phase 59 runtime release-enable approval evidence is complete/i);
  assert.match(releaseEnablementApproval.detail, /visible for approval audit/i);
  assert.match(releaseEnablementApproval.detail, /runtime support and release remain blocked/i);
  assert.match(releaseEnablementApproval.detail, /runtimeImplementationBlocked=true/);
  assert.match(releaseEnablementApproval.detail, /runtimeSupported=false/);
  assert.match(releaseEnablementApproval.detail, /releaseAllowed=false/);
  const supportPresenceAssertion = findSubsystem(report, "multiWriterRuntimeSupportPresenceAssertion");
  assert.equal(supportPresenceAssertion.status, "degraded");
  assert.match(supportPresenceAssertion.detail, /Phase 60 runtime support presence assertion is blocked/i);
  assert.match(supportPresenceAssertion.detail, /runtime support implementation presence/i);
  assert.match(supportPresenceAssertion.detail, /runtime support owner acceptance/i);
  assert.match(supportPresenceAssertion.detail, /runtimeSupported=false/);
  assert.match(supportPresenceAssertion.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});

test("operations health reports Phase 60 support presence assertion complete but still blocked", () => {
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
      TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "artifacts/phase58/runtime-implementation.md",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "artifacts/phase58/consistency-validation.md",
      TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "artifacts/phase58/failover-validation.md",
      TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "artifacts/phase58/data-integrity-validation.md",
      TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "artifacts/phase58/operations-runbook.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "artifacts/phase58/runtime-release-signoff.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-release-gate-only",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "platform-release-owner",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW:
        "2026-05-02T02:00:00Z/2026-05-02T04:00:00Z",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF:
        "artifacts/phase59/monitoring-signoff.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "artifacts/phase59/abort-plan.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "TASKLOOM-59",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT:
        "artifacts/phase60/implementation-present.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT:
        "artifacts/phase60/explicit-support-statement.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX:
        "artifacts/phase60/compatibility-matrix.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE:
        "artifacts/phase60/cutover-evidence.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL:
        "artifacts/phase60/release-automation-approval.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE:
        "artifacts/phase60/owner-acceptance.md",
    },
    now: () => new Date("2026-04-26T10:00:01.000Z"),
    fileExists: () => true,
  });

  const supportPresenceAssertion = findSubsystem(report, "multiWriterRuntimeSupportPresenceAssertion");
  assert.equal(supportPresenceAssertion.status, "degraded");
  assert.match(supportPresenceAssertion.detail, /Phase 60 runtime support presence assertion evidence is complete/i);
  assert.match(supportPresenceAssertion.detail, /visible for support audit/i);
  assert.match(supportPresenceAssertion.detail, /runtime support and release remain blocked in this repo/i);
  assert.match(supportPresenceAssertion.detail, /runtimeImplementationBlocked=true/);
  assert.match(supportPresenceAssertion.detail, /runtimeSupported=false/);
  assert.match(supportPresenceAssertion.detail, /releaseAllowed=false/);
  const activationControls = findSubsystem(report, "multiWriterRuntimeActivationControls");
  assert.equal(activationControls.status, "degraded");
  assert.match(activationControls.detail, /Phase 61 runtime activation controls are blocked/i);
  assert.match(activationControls.detail, /runtime activation decision/i);
  assert.match(activationControls.detail, /runtime activation release automation assertion/i);
  assert.match(activationControls.detail, /runtimeImplementationBlocked=true/);
  assert.match(activationControls.detail, /runtimeSupported=false/);
  assert.match(activationControls.detail, /releaseAllowed=false/);
  assert.equal(report.overall, "degraded");
});
