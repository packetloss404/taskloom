import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase, resetDatabase, seedDatabase } from "./cli";

test("migrateDatabase applies activation migrations idempotently", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-db-"));
  try {
    const dbPath = join(tempDir, "taskloom.sqlite");

    const first = migrateDatabase({ dbPath });
    const second = migrateDatabase({ dbPath });

    assert.deepEqual(first.applied, ["0001_activation.sql"]);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped, ["0001_activation.sql"]);

    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare("select name from schema_migrations").all() as Array<{ name: string }>;
      assert.deepEqual(rows.map((row) => row.name), ["0001_activation.sql"]);
    } finally {
      db.close();
    }
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
