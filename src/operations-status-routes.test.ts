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
});
