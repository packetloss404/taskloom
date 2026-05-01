import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils.js";
import { operationsStatusRoutes } from "./operations-status-routes.js";
import { getOperationsStatus } from "./operations-status.js";
import { login } from "./taskloom-services.js";
import { mutateStore, resetStoreForTests } from "./taskloom-store.js";

function createApp() {
  const app = new Hono();
  app.route("/api/app/operations/status", operationsStatusRoutes);
  return app;
}

function authHeaders(cookieValue: string) {
  return { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
}

test("operations status route rejects unauthenticated requests", async () => {
  resetStoreForTests();
  const app = createApp();

  const response = await app.request("/api/app/operations/status");

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication required" });
});

test("operations status route rejects members below admin role", async () => {
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

  const response = await app.request("/api/app/operations/status", {
    headers: authHeaders(auth.cookieValue),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "workspace role admin is required" });
});

test("operations status route returns the report shape for an admin-equivalent owner", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const app = createApp();

  const response = await app.request("/api/app/operations/status", {
    headers: authHeaders(auth.cookieValue),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.ok(typeof body.generatedAt === "string");
  assert.ok(body.store && typeof body.store === "object");
  assert.ok(body.scheduler && typeof body.scheduler === "object");
  assert.ok(Array.isArray(body.jobs));
  assert.ok(Array.isArray(body.jobMetrics));
  assert.ok(body.jobMetricsSnapshots && typeof body.jobMetricsSnapshots === "object");
  const snapshots = body.jobMetricsSnapshots as Record<string, unknown>;
  assert.ok("total" in snapshots);
  assert.ok("lastCapturedAt" in snapshots);
  assert.equal(typeof snapshots.total, "number");
  assert.ok(snapshots.lastCapturedAt === null || typeof snapshots.lastCapturedAt === "string");
  assert.ok(body.accessLog && typeof body.accessLog === "object");
  assert.ok(body.asyncStoreBoundary && typeof body.asyncStoreBoundary === "object");
  const asyncStoreBoundary = body.asyncStoreBoundary as Record<string, unknown>;
  assert.equal(asyncStoreBoundary.phase, "49");
  assert.equal(asyncStoreBoundary.foundationPresent, true);
  assert.equal(asyncStoreBoundary.managedDatabaseRuntimeAllowed, false);
  assert.equal(asyncStoreBoundary.managedDatabaseRuntimeBlocked, true);
  assert.ok(body.managedPostgresCapability && typeof body.managedPostgresCapability === "object");
  const managedPostgresCapability = body.managedPostgresCapability as Record<string, unknown>;
  assert.equal(managedPostgresCapability.phase, "50");
  assert.equal(managedPostgresCapability.provider, "postgres");
  assert.equal(managedPostgresCapability.adapterAvailable, false);
  assert.equal(managedPostgresCapability.backfillAvailable, false);
  assert.ok(body.managedPostgresStartupSupport && typeof body.managedPostgresStartupSupport === "object");
  const managedPostgresStartupSupport = body.managedPostgresStartupSupport as Record<string, unknown>;
  assert.equal(managedPostgresStartupSupport.phase, "52");
  assert.equal(managedPostgresStartupSupport.startupSupported, false);
  assert.equal(managedPostgresStartupSupport.multiWriterSupported, false);
  assert.ok(body.managedPostgresTopologyGate && typeof body.managedPostgresTopologyGate === "object");
  const managedPostgresTopologyGate = body.managedPostgresTopologyGate as Record<string, unknown>;
  assert.equal(managedPostgresTopologyGate.phase, "53");
  assert.equal(managedPostgresTopologyGate.multiWriterSupported, false);
  assert.ok(body.multiWriterTopologyDesignPackageGate && typeof body.multiWriterTopologyDesignPackageGate === "object");
  const multiWriterTopologyDesignPackageGate = body.multiWriterTopologyDesignPackageGate as Record<string, unknown>;
  assert.equal(multiWriterTopologyDesignPackageGate.phase, "54");
  assert.equal(multiWriterTopologyDesignPackageGate.runtimeSupported, false);
  assert.equal(multiWriterTopologyDesignPackageGate.releaseAllowed, false);
  assert.ok(multiWriterTopologyDesignPackageGate.topologyOwner && typeof multiWriterTopologyDesignPackageGate.topologyOwner === "object");
  assert.ok(
    body.multiWriterTopologyImplementationAuthorizationGate &&
      typeof body.multiWriterTopologyImplementationAuthorizationGate === "object",
  );
  const multiWriterTopologyImplementationAuthorizationGate =
    body.multiWriterTopologyImplementationAuthorizationGate as Record<string, unknown>;
  assert.equal(multiWriterTopologyImplementationAuthorizationGate.phase, "55");
  assert.equal(multiWriterTopologyImplementationAuthorizationGate.runtimeSupported, false);
  assert.equal(multiWriterTopologyImplementationAuthorizationGate.runtimeImplementationBlocked, true);
  assert.equal(multiWriterTopologyImplementationAuthorizationGate.releaseAllowed, false);
  assert.ok(
    body.multiWriterTopologyImplementationReadinessGate &&
      typeof body.multiWriterTopologyImplementationReadinessGate === "object",
  );
  const multiWriterTopologyImplementationReadinessGate =
    body.multiWriterTopologyImplementationReadinessGate as Record<string, unknown>;
  assert.equal(multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
  assert.equal(multiWriterTopologyImplementationReadinessGate.runtimeImplementationBlocked, true);
  assert.equal(multiWriterTopologyImplementationReadinessGate.releaseAllowed, false);
  assert.ok(
    body.multiWriterTopologyImplementationScope &&
      typeof body.multiWriterTopologyImplementationScope === "object",
  );
  const multiWriterTopologyImplementationScope =
    body.multiWriterTopologyImplementationScope as Record<string, unknown>;
  assert.equal(multiWriterTopologyImplementationScope.phase, "57");
  assert.equal(multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(multiWriterTopologyImplementationScope.runtimeImplementationBlocked, true);
  assert.equal(multiWriterTopologyImplementationScope.releaseAllowed, false);
  assert.ok(
    body.multiWriterRuntimeImplementationValidation &&
      typeof body.multiWriterRuntimeImplementationValidation === "object",
  );
  const multiWriterRuntimeImplementationValidation =
    body.multiWriterRuntimeImplementationValidation as Record<string, unknown>;
  assert.equal(multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.ok(
    body.multiWriterRuntimeReleaseEnablementApproval &&
      typeof body.multiWriterRuntimeReleaseEnablementApproval === "object",
  );
  const multiWriterRuntimeReleaseEnablementApproval =
    body.multiWriterRuntimeReleaseEnablementApproval as Record<string, unknown>;
  assert.equal(multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.ok(
    body.multiWriterRuntimeSupportPresenceAssertion &&
      typeof body.multiWriterRuntimeSupportPresenceAssertion === "object",
  );
  const multiWriterRuntimeSupportPresenceAssertion =
    body.multiWriterRuntimeSupportPresenceAssertion as Record<string, unknown>;
  assert.equal(multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
  assert.ok(
    body.multiWriterRuntimeActivationControls &&
      typeof body.multiWriterRuntimeActivationControls === "object",
  );
  const multiWriterRuntimeActivationControls =
    body.multiWriterRuntimeActivationControls as Record<string, unknown>;
  assert.equal(multiWriterRuntimeActivationControls.phase, "61");
  assert.equal(multiWriterRuntimeActivationControls.runtimeSupported, false);
  assert.equal(multiWriterRuntimeActivationControls.runtimeImplementationBlocked, true);
  assert.equal(multiWriterRuntimeActivationControls.releaseAllowed, false);
  assert.ok(body.runtime && typeof body.runtime === "object");
  const runtime = body.runtime as { nodeVersion?: unknown };
  assert.equal(runtime.nodeVersion, process.versions.node);
});

test("operations status report surfaces Phase 52 managed Postgres startup support", () => {
  const status = getOperationsStatus({
    loadStore: () => ({ jobs: [] }) as never,
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
    },
  });

  assert.equal(status.managedPostgresCapability.phase, "50");
  assert.equal(status.managedPostgresCapability.adapterAvailable, true);
  assert.equal(status.managedPostgresCapability.backfillAvailable, true);
  assert.equal(status.managedPostgresStartupSupport.phase, "52");
  assert.equal(status.managedPostgresStartupSupport.status, "supported");
  assert.equal(status.managedPostgresStartupSupport.startupSupported, true);
  assert.equal(status.managedPostgresStartupSupport.adapterAvailable, true);
  assert.equal(status.managedPostgresStartupSupport.runtimeCallSitesMigrated, true);
  assert.equal(status.managedPostgresStartupSupport.multiWriterSupported, false);
  assert.equal(status.managedPostgresStartupSupport.multiWriterIntentDetected, false);
  assert.equal(status.managedPostgresTopologyGate.phase, "53");
  assert.equal(status.managedPostgresTopologyGate.status, "supported");
  assert.equal(status.managedPostgresTopologyGate.singleWriterManagedPostgresSupported, true);
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.multiWriterIntentDetected, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.phase, "54");
  assert.equal(status.multiWriterTopologyDesignPackageGate.status, "not-required");
  assert.equal(status.multiWriterTopologyDesignPackageGate.designPackageStatus, "not-required");
  assert.equal(status.multiWriterTopologyDesignPackageGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.topologyOwner.status, "not-required");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.phase, "55");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.status, "not-required");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.reviewStatus, "not-required");
  assert.equal(
    status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorizationStatus,
    "not-required",
  );
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.status, "not-required");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessStatus, "not-required");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyStatus, "not-required");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationScope.phase, "57");
  assert.equal(status.multiWriterTopologyImplementationScope.status, "not-required");
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScopeStatus, "not-required");
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "not-required");
  assert.equal(status.multiWriterRuntimeImplementationValidation.validationStatus, "not-required");
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "not-required");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "not-required");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "not-required");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "not-required");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
});

test("operations status report keeps multi-writer managed Postgres startup unsupported", () => {
  const status = getOperationsStatus({
    loadStore: () => ({ jobs: [] }) as never,
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: "distributed",
    },
  });

  assert.equal(status.managedPostgresCapability.phase, "50");
  assert.equal(status.managedPostgresCapability.adapterAvailable, true);
  assert.equal(status.managedPostgresStartupSupport.phase, "52");
  assert.equal(status.managedPostgresStartupSupport.status, "multi-writer-unsupported");
  assert.equal(status.managedPostgresStartupSupport.startupSupported, false);
  assert.equal(status.managedPostgresStartupSupport.multiWriterSupported, false);
  assert.equal(status.managedPostgresStartupSupport.multiWriterIntentDetected, true);
  assert.equal(status.managedPostgresTopologyGate.phase, "53");
  assert.equal(status.managedPostgresTopologyGate.status, "blocked");
  assert.equal(status.managedPostgresTopologyGate.topologyIntent, "distributed");
  assert.equal(status.managedPostgresTopologyGate.multiWriterIntentDetected, true);
  assert.equal(status.managedPostgresTopologyGate.multiWriterSupported, false);
  assert.equal(status.managedPostgresTopologyGate.requirementsOnly, true);
  assert.match(status.managedPostgresTopologyGate.summary, /not implementation support/i);
  assert.equal(status.multiWriterTopologyDesignPackageGate.phase, "54");
  assert.equal(status.multiWriterTopologyDesignPackageGate.status, "blocked");
  assert.equal(status.multiWriterTopologyDesignPackageGate.designPackageStatus, "incomplete");
  assert.equal(status.multiWriterTopologyDesignPackageGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyDesignPackageGate.topologyOwner.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.consistencyModel.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.failoverPitr.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.migrationBackfill.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.observability.status, "missing");
  assert.equal(status.multiWriterTopologyDesignPackageGate.rollback.status, "missing");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.phase, "55");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.reviewStatus, "missing");
  assert.equal(
    status.multiWriterTopologyImplementationAuthorizationGate.implementationAuthorizationStatus,
    "missing",
  );
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationAuthorizationGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.phase, "56");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.implementationReadinessStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.rolloutSafetyStatus, "missing");
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationReadinessGate.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.phase, "57");
  assert.equal(status.multiWriterTopologyImplementationScope.status, "blocked");
  assert.equal(status.multiWriterTopologyImplementationScope.phase56EvidenceComplete, false);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "blocked");
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase57ImplementationScopeComplete, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "blocked");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase58RuntimeValidationComplete, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "blocked");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase59ReleaseEnablementApprovalComplete, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
});

test("operations status report surfaces Phase 57 scope complete but unsupported", () => {
  const status = getOperationsStatus({
    loadStore: () => ({ jobs: [] }) as never,
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
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
  });

  assert.equal(status.multiWriterTopologyImplementationScope.phase, "57");
  assert.equal(status.multiWriterTopologyImplementationScope.status, "scope-complete");
  assert.equal(status.multiWriterTopologyImplementationScope.implementationScopeStatus, "complete");
  assert.equal(status.multiWriterTopologyImplementationScope.phase56EvidenceComplete, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterTopologyImplementationScope.runtimeSupported, false);
  assert.equal(status.multiWriterTopologyImplementationScope.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.phase, "58");
  assert.equal(status.multiWriterRuntimeImplementationValidation.status, "validation-complete");
  assert.equal(status.multiWriterRuntimeImplementationValidation.validationStatus, "complete");
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationValidationComplete, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeImplementationValidation.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeImplementationValidation.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "blocked");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "missing");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase58RuntimeValidationComplete, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "blocked");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "missing");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase59ReleaseEnablementApprovalComplete, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
});

test("operations status report surfaces Phase 59 release-enable approval complete but runtime release blocked", () => {
  const status = getOperationsStatus({
    loadStore: () => ({ jobs: [] }) as never,
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_MANAGED_DATABASE_ADAPTER: "postgres",
      DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
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
  });

  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase, "59");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.status, "approval-complete");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.approvalStatus, "complete");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.phase58RuntimeValidationComplete, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseEnablementApprovalComplete, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.enablementDecision.status, "provided");
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeReleaseEnablementApproval.releaseAllowed, false);
  assert.match(status.multiWriterRuntimeReleaseEnablementApproval.summary, /actual multi-writer runtime exists/i);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase, "60");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.status, "blocked");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.assertionStatus, "missing");
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.phase59ReleaseEnablementApprovalComplete, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeImplementationBlocked, true);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.runtimeSupported, false);
  assert.equal(status.multiWriterRuntimeSupportPresenceAssertion.releaseAllowed, false);
});
