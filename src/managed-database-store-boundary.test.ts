import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  clearStoreCacheForTests,
  loadStore,
  ManagedDatabaseStoreBoundaryError,
  MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE,
  mutateStore,
  resolveTaskloomStoreMode,
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
] as const;

type StoreEnvKey = (typeof STORE_ENV_KEYS)[number];

function withStoreEnv(env: Partial<Record<StoreEnvKey, string>>, run: () => void): void {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of STORE_ENV_KEYS) previous.set(key, process.env[key]);

  try {
    for (const key of STORE_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(env) as Array<[StoreEnvKey, string | undefined]>) {
      if (value !== undefined) process.env[key] = value;
    }
    clearStoreCacheForTests();
    run();
  } finally {
    clearStoreCacheForTests();
    for (const key of STORE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("default JSON store remains supported when no managed database hints are present", () => {
  withStoreEnv({}, () => {
    const store = resetStoreForTests();

    assert.equal(resolveTaskloomStoreMode().mode, "json");
    assert.equal(store.workspaces.some((entry) => entry.id === "alpha"), true);
    assert.equal(loadStore().users.some((entry) => entry.email === "alpha@taskloom.local"), true);
  });
});

test("sqlite store remains supported and persists through cache reloads", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-managed-boundary-"));
  const dbPath = join(tempDir, "taskloom.sqlite");

  try {
    withStoreEnv({ TASKLOOM_STORE: "sqlite", TASKLOOM_DB_PATH: dbPath }, () => {
      assert.equal(resolveTaskloomStoreMode().mode, "sqlite");
      resetStoreForTests();
      mutateStore((data) => {
        upsertRequirement(data, {
          id: "req_managed_boundary_sqlite",
          workspaceId: "alpha",
          title: "SQLite boundary requirement",
          priority: "must",
          status: "approved",
          createdByUserId: "user_alpha",
        }, "2026-04-28T12:00:00.000Z");
      });

      clearStoreCacheForTests();
      assert.equal(loadStore().requirements.some((entry) => entry.id === "req_managed_boundary_sqlite"), true);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("managed database store modes fail at the synchronous store boundary", () => {
  for (const storeMode of ["managed", "postgres", "postgresql"]) {
    withStoreEnv({ TASKLOOM_STORE: storeMode }, () => {
      const resolution = resolveTaskloomStoreMode();
      assert.equal(resolution.mode, storeMode === "managed" ? "managed" : "postgres");

      assert.throws(
        () => loadStore(),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.equal(error.storeMode, storeMode);
          assert.deepEqual(error.managedDatabaseUrlKeys, []);
          assert.match(error.message, /TASKLOOM_STORE=/);
          assert.ok(error.message.startsWith(MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE));
          return true;
        },
      );

      let mutatorRan = false;
      assert.throws(
        () => mutateStore(() => {
          mutatorRan = true;
          return "should-not-run";
        }),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.equal(error.storeMode, storeMode);
          assert.deepEqual(error.managedDatabaseUrlKeys, []);
          assert.match(error.message, /TASKLOOM_STORE=/);
          return true;
        },
      );
      assert.equal(mutatorRan, false);
    });
  }
});

test("managed database URL hints guard synchronous load and mutate instead of falling back to JSON or SQLite", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const cases: Array<Partial<Record<StoreEnvKey, string>>> = [
    { DATABASE_URL: url },
    { TASKLOOM_DATABASE_URL: url },
    { TASKLOOM_MANAGED_DATABASE_URL: url },
    { TASKLOOM_STORE: "sqlite", TASKLOOM_DB_PATH: join(tmpdir(), "taskloom-boundary.sqlite"), DATABASE_URL: url },
  ];

  for (const env of cases) {
    withStoreEnv(env, () => {
      const expectedUrlKeys = STORE_ENV_KEYS.filter((key) => key.endsWith("DATABASE_URL") && env[key]);

      assert.throws(
        () => loadStore(),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.deepEqual(error.managedDatabaseUrlKeys, expectedUrlKeys);
          assert.ok(error.message.startsWith(MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE));
          return true;
        },
      );

      let mutatorRan = false;
      assert.throws(
        () => mutateStore(() => {
          mutatorRan = true;
          return "should-not-run";
        }),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.deepEqual(error.managedDatabaseUrlKeys, expectedUrlKeys);
          assert.ok(error.message.startsWith(MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE));
          return true;
        },
      );
      assert.equal(mutatorRan, false);
    });
  }
});

test("multi-writer design evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE: "docs/phase-54/multi-writer-requirements.md",
      TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE: "docs/phase-54/multi-writer-design-package.md",
    }, () => {
      assert.throws(
        () => loadStore(),
        (error) => {
          assert.ok(error instanceof ManagedDatabaseStoreBoundaryError);
          assert.equal(error.storeMode, "postgres");
          assert.deepEqual(error.managedDatabaseUrlKeys, ["TASKLOOM_DATABASE_URL"]);
          assert.ok(error.message.startsWith(MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE));
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
