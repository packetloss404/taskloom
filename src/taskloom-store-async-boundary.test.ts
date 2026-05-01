import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  clearStoreCacheForTests,
  findUserByEmailIndexedAsync,
  findWorkspaceMembershipIndexedAsync,
  findWorkspaceBriefIndexedAsync,
  listAgentsForWorkspaceIndexedAsync,
  listRequirementsForWorkspaceIndexedAsync,
  loadStore,
  loadStoreAsync,
  ManagedDatabaseStoreBoundaryError,
  ManagedPostgresStoreConfigurationError,
  mutateStore,
  mutateStoreAsync,
  resetStoreForTests,
  upsertRequirement,
} from "./taskloom-store";

const STORE_ENV_KEYS = [
  "TASKLOOM_STORE",
  "TASKLOOM_DB_PATH",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
  "TASKLOOM_MANAGED_DATABASE_URL",
  "TASKLOOM_DATABASE_TOPOLOGY",
  "TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER",
  "TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL",
  "TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN",
  "TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN",
  "TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN",
  "TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER",
  "TASKLOOM_MULTI_WRITER_REVIEW_STATUS",
  "TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE",
  "TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN",
  "TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN",
  "TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN",
  "TASKLOOM_MULTI_WRITER_CUTOVER_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE",
] as const;

type StoreEnvKey = (typeof STORE_ENV_KEYS)[number];

async function withStoreEnv(
  env: Partial<Record<StoreEnvKey, string>>,
  run: () => Promise<void> | void,
): Promise<void> {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of STORE_ENV_KEYS) previous.set(key, process.env[key]);

  try {
    for (const key of STORE_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(env) as Array<[StoreEnvKey, string | undefined]>) {
      if (value !== undefined) process.env[key] = value;
    }
    clearStoreCacheForTests();
    await run();
  } finally {
    clearStoreCacheForTests();
    for (const key of STORE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("JSON async load and mutate reuse the current store behavior", async () => {
  await withStoreEnv({ TASKLOOM_STORE: "json" }, async () => {
    const seeded = resetStoreForTests();
    const loaded = await loadStoreAsync();
    assert.equal(loaded, seeded);
    assert.equal(loaded.workspaces.some((entry) => entry.id === "alpha"), true);
    assert.equal((await findUserByEmailIndexedAsync("ALPHA@TASKLOOM.LOCAL"))?.id, "user_alpha");
    assert.equal((await findWorkspaceMembershipIndexedAsync("alpha", "user_alpha"))?.role, "owner");
    assert.equal((await findWorkspaceBriefIndexedAsync("alpha"))?.workspaceId, "alpha");
    assert.equal((await listAgentsForWorkspaceIndexedAsync("alpha")).length > 0, true);

    const requirementId = await mutateStoreAsync(async (data) => {
      await Promise.resolve();
      const requirement = upsertRequirement(data, {
        id: "req_async_json_boundary",
        workspaceId: "alpha",
        title: "Async JSON boundary requirement",
        priority: "must",
        status: "approved",
        createdByUserId: "user_alpha",
      }, "2026-04-29T12:00:00.000Z");
      return requirement.id;
    });

    assert.equal(requirementId, "req_async_json_boundary");
    clearStoreCacheForTests();
    assert.equal((await loadStoreAsync()).requirements.some((entry) => entry.id === requirementId), true);
    assert.equal((await listRequirementsForWorkspaceIndexedAsync("alpha")).some((entry) => entry.id === requirementId), true);
  });
});

test("managed and Postgres modes require a managed database URL for async wrappers", async () => {
  for (const storeMode of ["managed", "postgres", "postgresql"]) {
    await withStoreEnv({ TASKLOOM_STORE: storeMode }, async () => {
      await assert.rejects(
        loadStoreAsync(),
        (error) => {
          assert.ok(error instanceof ManagedPostgresStoreConfigurationError);
          assert.match(error.message, /requires DATABASE_URL/);
          return true;
        },
      );

      let mutatorRan = false;
      await assert.rejects(
        mutateStoreAsync(() => {
          mutatorRan = true;
          return "should-not-run";
        }),
        ManagedPostgresStoreConfigurationError,
      );
      assert.equal(mutatorRan, false);
    });
  }
});

test("synchronous JSON and SQLite APIs still return direct values", async () => {
  await withStoreEnv({ TASKLOOM_STORE: "json" }, () => {
    resetStoreForTests();
    const result = mutateStore((data) => {
      upsertRequirement(data, {
        id: "req_sync_json_boundary",
        workspaceId: "alpha",
        title: "Sync JSON boundary requirement",
        priority: "must",
        status: "approved",
        createdByUserId: "user_alpha",
      }, "2026-04-29T13:00:00.000Z");
      return "sync-json-result";
    });

    assert.equal(result, "sync-json-result");
    assert.equal(loadStore().requirements.some((entry) => entry.id === "req_sync_json_boundary"), true);
  });

  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-async-boundary-sync-"));
  try {
    await withStoreEnv({ TASKLOOM_STORE: "sqlite", TASKLOOM_DB_PATH: join(tempDir, "taskloom.sqlite") }, () => {
      resetStoreForTests();
      const result = mutateStore((data) => {
        upsertRequirement(data, {
          id: "req_sync_sqlite_boundary",
          workspaceId: "alpha",
          title: "Sync SQLite boundary requirement",
          priority: "must",
          status: "approved",
          createdByUserId: "user_alpha",
        }, "2026-04-29T14:00:00.000Z");
        return "sync-sqlite-result";
      });

      assert.equal(result, "sync-sqlite-result");
      clearStoreCacheForTests();
      assert.equal(loadStore().requirements.some((entry) => entry.id === "req_sync_sqlite_boundary"), true);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("synchronous APIs stay guarded when managed database hints are configured", async () => {
  await withStoreEnv({
    TASKLOOM_STORE: "json",
    DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  }, () => {
    assert.throws(
      () => loadStore(),
      (error) => {
        assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
        assert.equal(error.code, "TASKLOOM_MANAGED_DATABASE_SYNC_ADAPTER_GAP");
        assert.match(error.message, /DATABASE_URL/);
        return true;
      },
    );

    let mutatorRan = false;
    assert.throws(
      () => mutateStore(() => {
        mutatorRan = true;
        return "should-not-run";
      }),
      ManagedDatabaseStoreBoundaryError,
    );
    assert.equal(mutatorRan, false);
  });
});

test("synchronous APIs stay guarded when multi-writer Phase 55 review and authorization evidence is configured", async () => {
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    await withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-54/multi-writer-requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-54/multi-writer-design-package.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes with explicit conflict handling review",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "docs/phase-54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "docs/phase-54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "docs/phase-54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "docs/phase-54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "release-owner",
      TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
      TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "phase-55-design-package-review-only",
      TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety-signoff.md",
    }, () => {
      assert.throws(
        () => loadStore(),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.equal(error.code, "TASKLOOM_MANAGED_DATABASE_SYNC_ADAPTER_GAP");
          assert.equal(error.storeMode, "postgres");
          assert.deepEqual(error.managedDatabaseUrlKeys, ["TASKLOOM_MANAGED_DATABASE_URL"]);
          return true;
        },
      );

      let mutatorRan = false;
      assert.throws(
        () => mutateStore(() => {
          mutatorRan = true;
          return "should-not-run";
        }),
        ManagedDatabaseStoreBoundaryError,
      );
      assert.equal(mutatorRan, false);
    });
  }
});

test("synchronous APIs stay guarded when multi-writer Phase 56 readiness and rollout-safety evidence is configured", async () => {
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    await withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_MANAGED_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-54/multi-writer-requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-54/multi-writer-design-package.md",
      TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER: "platform-ops",
      TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL: "read-your-writes with explicit conflict handling review",
      TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN: "docs/phase-54/failover-pitr.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN: "docs/phase-54/migration-backfill.md",
      TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN: "docs/phase-54/observability.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN: "docs/phase-54/rollback.md",
      TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER: "principal-architect",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER: "release-owner",
      TASKLOOM_MULTI_WRITER_REVIEW_STATUS: "approved",
      TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE: "phase-55-design-package-review-only",
      TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF: "docs/phase-55/safety-signoff.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE: "docs/phase-56/runtime-readiness.md",
      TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE: "docs/phase-56/rollout-safety.md",
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN: "docs/phase-56/implementation-plan.md",
      TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN: "docs/phase-56/rollout-plan.md",
      TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN: "docs/phase-56/test-validation-plan.md",
      TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN: "docs/phase-56/data-safety-plan.md",
      TASKLOOM_MULTI_WRITER_CUTOVER_PLAN: "docs/phase-56/cutover-plan.md",
      TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE: "docs/phase-56/rollback-drill.md",
    }, () => {
      assert.throws(
        () => loadStore(),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.equal(error.code, "TASKLOOM_MANAGED_DATABASE_SYNC_ADAPTER_GAP");
          assert.equal(error.storeMode, "postgres");
          assert.deepEqual(error.managedDatabaseUrlKeys, ["TASKLOOM_MANAGED_DATABASE_URL"]);
          return true;
        },
      );

      let mutatorRan = false;
      assert.throws(
        () => mutateStore(() => {
          mutatorRan = true;
          return "should-not-run";
        }),
        ManagedDatabaseStoreBoundaryError,
      );
      assert.equal(mutatorRan, false);
    });
  }
});
