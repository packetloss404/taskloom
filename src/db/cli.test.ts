import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { backfillAppDatabase, backupDatabase, migrateDatabase, migrationStatus, readAppData, resetAppDatabase, resetDatabase, restoreDatabase, seedAppDatabase, seedDatabase } from "./cli";
import { createSeedStore } from "../taskloom-store";

const expectedMigrations = readdirSync(resolve(process.cwd(), "src", "db", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

test("migrateDatabase applies activation migrations idempotently", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");

    const first = migrateDatabase({ dbPath });
    const second = migrateDatabase({ dbPath });

    assert.deepEqual(first.applied, expectedMigrations);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped, expectedMigrations);

    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare("select name from schema_migrations").all() as Array<{ name: string }>;
      assert.deepEqual(rows.map((row) => row.name), expectedMigrations);
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("migrateDatabase creates runtime app tables", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");

    migrateDatabase({ dbPath });

    const expectedTables = [
      "users",
      "sessions",
      "workspaces",
      "workspace_memberships",
      "workspace_invitations",
      "workspace_briefs",
      "workspace_brief_versions",
      "requirements",
      "implementation_plan_items",
      "workflow_concerns",
      "validation_evidence",
      "release_confirmations",
      "onboarding_states",
      "activities",
      "agents",
      "providers",
      "agent_runs",
      "workspace_env_vars",
      "api_keys",
      "provider_calls",
      "jobs",
      "share_tokens",
      "rate_limit_buckets",
      "activation_facts",
      "activation_read_models",
    ];

    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare(`
        select name
        from sqlite_master
        where type = 'table' and name in (${expectedTables.map(() => "?").join(", ")})
        order by name
      `).all(...expectedTables) as Array<{ name: string }>;

      assert.deepEqual(rows.map((row) => row.name), [...expectedTables].sort());
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("rate limit bucket migration backfills legacy app_records buckets", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");
    const legacyBucket = {
      id: "auth:login:sha256:legacy",
      count: 7,
      resetAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };

    const db = new DatabaseSync(dbPath);
    try {
      db.exec("create table schema_migrations (name text primary key, applied_at text not null default (datetime('now'))) ");
      db.exec(`
        create table app_records (
          collection text not null,
          id text not null,
          workspace_id text null,
          payload text not null check (json_valid(payload)),
          updated_at text null,
          primary key (collection, id)
        )
      `);
      const insertMigration = db.prepare("insert into schema_migrations (name) values (?)");
      for (const name of expectedMigrations.filter((entry) => entry !== "0009_rate_limit_buckets.sql")) {
        insertMigration.run(name);
      }
      db.prepare("insert into app_records (collection, id, workspace_id, payload, updated_at) values ('rateLimits', ?, null, json(?), ?)")
        .run(legacyBucket.id, JSON.stringify(legacyBucket), legacyBucket.updatedAt);
    } finally {
      db.close();
    }

    const migrated = migrateDatabase({ dbPath });
    assert.deepEqual(migrated.applied, ["0009_rate_limit_buckets.sql"]);

    const migratedDb = new DatabaseSync(dbPath);
    try {
      const bucket = migratedDb.prepare("select id, count, reset_at as resetAt, updated_at as updatedAt from rate_limit_buckets where id = ?").get(legacyBucket.id) as typeof legacyBucket | undefined;
      const legacyRows = migratedDb.prepare("select count(*) as count from app_records where collection = 'rateLimits'").get() as { count: number };
      assert.deepEqual(bucket ? { ...bucket } : undefined, legacyBucket);
      assert.equal(legacyRows.count, 0);
    } finally {
      migratedDb.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("migrationStatus reports pending and applied migrations without creating a database", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "missing.sqlite");

    const missing = migrationStatus({ dbPath });
    assert.equal(missing.exists, false);
    assert.deepEqual(missing.pending, expectedMigrations);

    migrateDatabase({ dbPath });
    const migrated = migrationStatus({ dbPath });

    assert.equal(migrated.exists, true);
    assert.deepEqual(migrated.applied, expectedMigrations);
    assert.deepEqual(migrated.pending, []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("backupDatabase copies a migrated database and restoreDatabase validates before replacing", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");
    const backupPath = join(tempDir, "taskloom.backup.sqlite");
    seedAppDatabase({ dbPath });

    const backup = backupDatabase({ dbPath, backupPath });
    resetDatabase({ dbPath });
    const empty = readAppData({ dbPath });

    assert.equal(backup.backupPath, backupPath);
    assert.equal(empty, null);

    const restore = restoreDatabase({ dbPath, backupPath });
    const restored = readAppData({ dbPath });

    assert.equal(restore.backupPath, backupPath);
    assert.deepEqual(migrationStatus({ dbPath }).pending, []);
    assert.equal(restored?.workspaces.length, 3);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("seedAppDatabase writes the full seed store and activation rows", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");

    const result = seedAppDatabase({ dbPath });
    const data = readAppData({ dbPath });

    assert.equal(result.workspaces, 3);
    assert.equal(data?.workspaces.length, 3);
    assert.equal(data?.users.length, 3);
    assert.equal(data?.agents.some((agent) => agent.id === "agent_alpha_support"), true);
    assert.ok((data?.activationSignals.length ?? 0) > 0);

    const db = new DatabaseSync(dbPath);
    try {
      const trackCount = db.prepare("select count(*) as count from activation_tracks").get() as { count: number };
      assert.equal(trackCount.count, 3);
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("backfillAppDatabase reads a JSON store path into SQLite", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");
    const jsonPath = join(tempDir, "taskloom.json");
    const data = createSeedStore();
    data.workspaces[0] = { ...data.workspaces[0], name: "Backfilled Workspace" };
    data.rateLimits = [{
      id: "auth:login:sha256:backfill",
      count: 3,
      resetAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    }];
    writeFileSync(jsonPath, JSON.stringify(data));

    const result = backfillAppDatabase({ dbPath, jsonPath });
    const stored = readAppData({ dbPath });

    assert.equal(result.source, "backfill");
    assert.equal(stored?.workspaces[0]?.name, "Backfilled Workspace");
    assert.equal(stored?.rateLimits?.[0]?.id, "auth:login:sha256:backfill");

    const db = new DatabaseSync(dbPath);
    try {
      const bucketRows = db.prepare("select count(*) as count from rate_limit_buckets").get() as { count: number };
      const appRecordRows = db.prepare("select count(*) as count from app_records where collection = 'rateLimits'").get() as { count: number };
      assert.equal(bucketRows.count, 1);
      assert.equal(appRecordRows.count, 0);
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("resetAppDatabase recreates migrated DB state with seed app data", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");
    const jsonPath = join(tempDir, "taskloom.json");
    writeFileSync(jsonPath, JSON.stringify({ workspaces: [{ id: "json-only" }] }));
    seedAppDatabase({ dbPath });

    const result = resetAppDatabase({ dbPath, jsonPath });
    const stored = readAppData({ dbPath });
    const jsonContents = JSON.parse(readFileSync(jsonPath, "utf8")) as { workspaces: Array<{ id: string }> };

    assert.equal(result.command, "reset-app");
    assert.equal(stored?.workspaces.some((workspace) => workspace.id === "alpha"), true);
    assert.deepEqual(jsonContents.workspaces, [{ id: "json-only" }]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("seedDatabase writes activation rows derived from the local seed store", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");

    const result = seedDatabase({ dbPath });

    assert.equal(result.workspaces, 3);
    assert.equal(result.tracks, 3);
    assert.ok(result.milestones > 0);
    assert.equal(result.checklistItems, 15);

    const db = new DatabaseSync(dbPath);
    try {
      const track = db.prepare("select current_stage from activation_tracks where workspace_id = ?").get("gamma") as { current_stage: string };
      const checklistCount = db.prepare("select count(*) as count from activation_checklist_items").get() as { count: number };
      assert.equal(track.current_stage, "complete");
      assert.equal(checklistCount.count, 15);
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("resetDatabase recreates an empty migrated database", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");
    seedDatabase({ dbPath });

    const result = resetDatabase({ dbPath });

    assert.equal(result.path, dbPath);

    const db = new DatabaseSync(dbPath);
    try {
      const trackCount = db.prepare("select count(*) as count from activation_tracks").get() as { count: number };
      assert.equal(trackCount.count, 0);
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
