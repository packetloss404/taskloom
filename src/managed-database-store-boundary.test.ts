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
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK",
  "TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG",
  "TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK",
  "TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK",
  "TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION",
] as const;

type StoreEnvKey = (typeof STORE_ENV_KEYS)[number];

const PHASE_58_MULTI_WRITER_EVIDENCE_ENV_KEYS = [
  "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK",
  "TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF",
] as const satisfies readonly StoreEnvKey[];

const PHASE_59_MULTI_WRITER_ENABLEMENT_EVIDENCE_ENV_KEYS = [
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET",
] as const satisfies readonly StoreEnvKey[];

const PHASE_60_MULTI_WRITER_RUNTIME_SUPPORT_EVIDENCE_ENV_KEYS = [
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE",
] as const satisfies readonly StoreEnvKey[];

const PHASE_61_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROL_ENV_KEYS = [
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION",
] as const satisfies readonly StoreEnvKey[];

const COMPLETE_MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE = {
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
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "docs/phase-57/implementation-scope-lock.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER=false",
  TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "docs/phase-57/validation-evidence.md",
  TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "docs/phase-57/migration-cutover-lock.md",
  TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "docs/phase-57/release-owner-signoff.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "docs/phase-58/runtime-implementation.md",
  TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE: "docs/phase-58/consistency-validation.md",
  TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE: "docs/phase-58/failover-validation.md",
  TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE: "docs/phase-58/data-integrity-validation.md",
  TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK: "docs/phase-58/operations-runbook.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF: "docs/phase-58/runtime-release-signoff.md",
} satisfies Partial<Record<StoreEnvKey, string>>;

const COMPLETE_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_GATE_EVIDENCE = {
  ...COMPLETE_MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE,
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-release-window",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER: "release-captain",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW: "2026-05-04T15:00:00Z/2026-05-04T17:00:00Z",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF: "docs/phase-59/monitoring-signoff.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN: "docs/phase-59/abort-plan.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET: "TASKLOOM-59",
} satisfies Partial<Record<StoreEnvKey, string>>;

const COMPLETE_MULTI_WRITER_RUNTIME_SUPPORT_ASSERTION_EVIDENCE = {
  ...COMPLETE_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_GATE_EVIDENCE,
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT: "docs/phase-60/runtime-support-implementation.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT: "docs/phase-60/explicit-support-statement.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX: "docs/phase-60/compatibility-matrix.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE: "docs/phase-60/cutover-evidence.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL: "docs/phase-60/release-automation-approval.md",
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE: "docs/phase-60/owner-acceptance.md",
} satisfies Partial<Record<StoreEnvKey, string>>;

const COMPLETE_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROLS = {
  ...COMPLETE_MULTI_WRITER_RUNTIME_SUPPORT_ASSERTION_EVIDENCE,
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "blocked-pending-runtime-support",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER: "platform-ops",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW: "2026-05-11T15:00:00Z/2026-05-11T17:00:00Z",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER_ACTIVATION=false",
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION:
    "docs/phase-61/release-automation-assertion.md",
} satisfies Partial<Record<StoreEnvKey, string>>;

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

test("store env helper clears and restores Phase 58 runtime evidence keys", () => {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of PHASE_58_MULTI_WRITER_EVIDENCE_ENV_KEYS) {
    previous.set(key, process.env[key]);
    process.env[key] = `outer-${key}`;
  }

  try {
    withStoreEnv({
      TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE: "docs/phase-58/runtime-implementation.md",
    }, () => {
      assert.equal(
        process.env.TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE,
        "docs/phase-58/runtime-implementation.md",
      );
      for (const key of PHASE_58_MULTI_WRITER_EVIDENCE_ENV_KEYS) {
        if (key !== "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE") {
          assert.equal(process.env[key], undefined);
        }
      }
    });

    for (const key of PHASE_58_MULTI_WRITER_EVIDENCE_ENV_KEYS) {
      assert.equal(process.env[key], `outer-${key}`);
    }
  } finally {
    for (const key of PHASE_58_MULTI_WRITER_EVIDENCE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("store env helper clears and restores Phase 59 enablement evidence keys", () => {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of PHASE_59_MULTI_WRITER_ENABLEMENT_EVIDENCE_ENV_KEYS) {
    previous.set(key, process.env[key]);
    process.env[key] = `outer-${key}`;
  }

  try {
    withStoreEnv({
      TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION: "approved-for-release-window",
    }, () => {
      assert.equal(
        process.env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION,
        "approved-for-release-window",
      );
      for (const key of PHASE_59_MULTI_WRITER_ENABLEMENT_EVIDENCE_ENV_KEYS) {
        if (key !== "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION") {
          assert.equal(process.env[key], undefined);
        }
      }
    });

    for (const key of PHASE_59_MULTI_WRITER_ENABLEMENT_EVIDENCE_ENV_KEYS) {
      assert.equal(process.env[key], `outer-${key}`);
    }
  } finally {
    for (const key of PHASE_59_MULTI_WRITER_ENABLEMENT_EVIDENCE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("store env helper clears and restores Phase 60 runtime support evidence keys", () => {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of PHASE_60_MULTI_WRITER_RUNTIME_SUPPORT_EVIDENCE_ENV_KEYS) {
    previous.set(key, process.env[key]);
    process.env[key] = `outer-${key}`;
  }

  try {
    withStoreEnv({
      TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT:
        "docs/phase-60/runtime-support-implementation.md",
    }, () => {
      assert.equal(
        process.env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT,
        "docs/phase-60/runtime-support-implementation.md",
      );
      for (const key of PHASE_60_MULTI_WRITER_RUNTIME_SUPPORT_EVIDENCE_ENV_KEYS) {
        if (key !== "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT") {
          assert.equal(process.env[key], undefined);
        }
      }
    });

    for (const key of PHASE_60_MULTI_WRITER_RUNTIME_SUPPORT_EVIDENCE_ENV_KEYS) {
      assert.equal(process.env[key], `outer-${key}`);
    }
  } finally {
    for (const key of PHASE_60_MULTI_WRITER_RUNTIME_SUPPORT_EVIDENCE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("store env helper clears and restores Phase 61 runtime activation control keys", () => {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of PHASE_61_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROL_ENV_KEYS) {
    previous.set(key, process.env[key]);
    process.env[key] = `outer-${key}`;
  }

  try {
    withStoreEnv({
      TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION: "blocked-pending-runtime-support",
    }, () => {
      assert.equal(
        process.env.TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION,
        "blocked-pending-runtime-support",
      );
      for (const key of PHASE_61_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROL_ENV_KEYS) {
        if (key !== "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION") {
          assert.equal(process.env[key], undefined);
        }
      }
    });

    for (const key of PHASE_61_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROL_ENV_KEYS) {
      assert.equal(process.env[key], `outer-${key}`);
    }
  } finally {
    for (const key of PHASE_61_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROL_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
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

test("multi-writer Phase 55 review and authorization evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
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

test("multi-writer Phase 56 readiness and rollout-safety evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
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

test("multi-writer Phase 57 implementation-scope evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
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
      TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK: "docs/phase-57/implementation-scope-lock.md",
      TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG: "TASKLOOM_EXPERIMENTAL_MULTI_WRITER=false",
      TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE: "docs/phase-57/validation-evidence.md",
      TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK: "docs/phase-57/migration-cutover-lock.md",
      TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF: "docs/phase-57/release-owner-signoff.md",
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

test("multi-writer Phase 58 runtime implementation evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      ...COMPLETE_MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE,
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

test("multi-writer Phase 59 enablement evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      ...COMPLETE_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_GATE_EVIDENCE,
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

test("complete multi-writer Phase 60 runtime support evidence does not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "distributed", "active-active"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      ...COMPLETE_MULTI_WRITER_RUNTIME_SUPPORT_ASSERTION_EVIDENCE,
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

test("complete multi-writer Phase 61 activation controls do not enable synchronous managed database store access", () => {
  const url = "postgres://taskloom:secret@db.example.com/taskloom";
  const blockedTopologies = ["multi-writer", "multi-region", "active-active", "distributed"] as const;

  for (const topology of blockedTopologies) {
    withStoreEnv({
      TASKLOOM_STORE: "postgres",
      TASKLOOM_DATABASE_URL: url,
      TASKLOOM_DATABASE_TOPOLOGY: topology,
      ...COMPLETE_MULTI_WRITER_RUNTIME_ACTIVATION_CONTROLS,
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
