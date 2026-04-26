import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { backfillAppDatabase, migrateDatabase, readAppData, resetAppDatabase, resetDatabase, seedAppDatabase, seedDatabase } from "./cli";
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
    writeFileSync(jsonPath, JSON.stringify(data));

    const result = backfillAppDatabase({ dbPath, jsonPath });
    const stored = readAppData({ dbPath });

    assert.equal(result.source, "backfill");
    assert.equal(stored?.workspaces[0]?.name, "Backfilled Workspace");
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
