import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "./db/cli.js";
import {
  cancelJob,
  claimNextJob,
  enqueueJob,
  enqueueRecurringJob,
  maintainScheduledAgentJobs,
  sweepStaleRunningJobs,
  updateJob,
} from "./jobs/store.js";
import { clearStoreCacheForTests, resetStoreForTests, type AgentRecord, type JobRecord } from "./taskloom-store.js";

interface JobRow {
  id: string;
  workspace_id: string;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  cron: string | null;
  result: string | null;
  error: string | null;
  cancel_requested: number | null;
  created_at: string;
  updated_at: string;
}

function readDedicatedJobs(dbPath: string): JobRow[] {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(`
      select id, workspace_id, type, payload, status, attempts, max_attempts,
        scheduled_at, started_at, completed_at, cron, result, error,
        cancel_requested, created_at, updated_at
      from jobs
      order by created_at, id
    `).all() as unknown as JobRow[];
  } finally {
    db.close();
  }
}

function readAppRecordJobs(dbPath: string): JobRecord[] {
  const db = new DatabaseSync(dbPath);
  try {
    const rows = db.prepare("select payload from app_records where collection = 'jobs'").all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as JobRecord);
  } finally {
    db.close();
  }
}

function findAppRecordJob(dbPath: string, id: string): JobRecord | null {
  return readAppRecordJobs(dbPath).find((entry) => entry.id === id) ?? null;
}

function findDedicatedJob(dbPath: string, id: string): JobRow | null {
  return readDedicatedJobs(dbPath).find((entry) => entry.id === id) ?? null;
}

function withSqliteEnv(dbPath: string) {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  process.env.TASKLOOM_STORE = "sqlite";
  process.env.TASKLOOM_DB_PATH = dbPath;
  clearStoreCacheForTests();
  return () => {
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    if (previousDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = previousDbPath;
    clearStoreCacheForTests();
  };
}

function seedAgentDirectly(dbPath: string, agent: AgentRecord): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(`
      insert into app_records (collection, id, workspace_id, payload, updated_at)
      values ('agents', ?, ?, json(?), ?)
      on conflict(collection, id) do update set workspace_id = excluded.workspace_id, payload = excluded.payload, updated_at = excluded.updated_at
    `).run(agent.id, agent.workspaceId, JSON.stringify(agent), agent.updatedAt);
  } finally {
    db.close();
  }
}

function makeAgent(overrides: Partial<AgentRecord> & { id: string }): AgentRecord {
  return {
    id: overrides.id,
    workspaceId: overrides.workspaceId ?? "workspace_a",
    name: overrides.name ?? "Scheduled agent",
    description: overrides.description ?? "test",
    instructions: overrides.instructions ?? "Be helpful",
    tools: overrides.tools ?? [],
    schedule: overrides.schedule ?? "*/5 * * * *",
    triggerKind: overrides.triggerKind ?? "schedule",
    status: overrides.status ?? "active",
    createdByUserId: overrides.createdByUserId ?? "user_a",
    inputSchema: overrides.inputSchema ?? [],
    createdAt: overrides.createdAt ?? "2026-04-26T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-26T12:00:00.000Z",
  };
}

test("enqueueJob dual-writes JSON-side and dedicated jobs table in SQLite mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const job = enqueueJob({ workspaceId: "workspace_a", type: "agent.run", payload: { x: 1 } });

    assert.equal(job.workspaceId, "workspace_a");
    assert.equal(job.type, "agent.run");

    const appRecord = findAppRecordJob(dbPath, job.id);
    assert.ok(appRecord, "app_records row should exist");
    assert.equal(appRecord.id, job.id);
    assert.equal(appRecord.status, "queued");

    const dedicated = findDedicatedJob(dbPath, job.id);
    assert.ok(dedicated, "dedicated row should exist");
    assert.equal(dedicated.id, job.id);
    assert.equal(dedicated.status, "queued");
    assert.equal(dedicated.workspace_id, "workspace_a");
    assert.deepEqual(JSON.parse(dedicated.payload), { x: 1 });
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("updateJob dual-writes the updated record on both sides", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const job = enqueueJob({ workspaceId: "workspace_a", type: "agent.run" });
    const updated = updateJob(job.id, { status: "success", result: { ok: true } });

    assert.ok(updated);
    assert.equal(updated.status, "success");

    const appRecord = findAppRecordJob(dbPath, job.id);
    assert.ok(appRecord);
    assert.equal(appRecord.status, "success");

    const dedicated = findDedicatedJob(dbPath, job.id);
    assert.ok(dedicated);
    assert.equal(dedicated.status, "success");
    assert.deepEqual(JSON.parse(dedicated.result ?? "null"), { ok: true });
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("cancelJob dual-writes the canceled record on both sides", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const job = enqueueJob({ workspaceId: "workspace_a", type: "agent.run" });
    const canceled = cancelJob(job.id);

    assert.ok(canceled);
    assert.equal(canceled.status, "canceled");
    assert.equal(canceled.cancelRequested, true);

    const appRecord = findAppRecordJob(dbPath, job.id);
    assert.ok(appRecord);
    assert.equal(appRecord.status, "canceled");
    assert.equal(appRecord.cancelRequested, true);

    const dedicated = findDedicatedJob(dbPath, job.id);
    assert.ok(dedicated);
    assert.equal(dedicated.status, "canceled");
    assert.equal(dedicated.cancel_requested, 1);
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("claimNextJob dual-writes the queued -> running transition on both sides", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const queued = enqueueJob({
      workspaceId: "workspace_a",
      type: "agent.run",
      scheduledAt: "2026-04-25T12:00:00.000Z",
    });

    const claimed = await claimNextJob(new Date("2026-04-26T12:00:00.000Z"));
    assert.ok(claimed);
    assert.equal(claimed.id, queued.id);
    assert.equal(claimed.status, "running");
    assert.equal(claimed.attempts, 1);

    const appRecord = findAppRecordJob(dbPath, queued.id);
    assert.ok(appRecord);
    assert.equal(appRecord.status, "running");
    assert.equal(appRecord.attempts, 1);

    const dedicated = findDedicatedJob(dbPath, queued.id);
    assert.ok(dedicated);
    assert.equal(dedicated.status, "running");
    assert.equal(dedicated.attempts, 1);
    assert.ok(dedicated.started_at);
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sweepStaleRunningJobs dual-writes the running -> queued transition on both sides", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const queued = enqueueJob({
      workspaceId: "workspace_a",
      type: "agent.run",
      scheduledAt: "2026-04-25T12:00:00.000Z",
    });
    // Manually mark stale: claim it so it goes to running, then rewrite startedAt to be ancient.
    await claimNextJob(new Date("2026-04-26T12:00:00.000Z"));
    updateJob(queued.id, { startedAt: "2020-01-01T00:00:00.000Z" });

    const swept = sweepStaleRunningJobs();
    assert.equal(swept, 1);

    const appRecord = findAppRecordJob(dbPath, queued.id);
    assert.ok(appRecord);
    assert.equal(appRecord.status, "queued");
    assert.equal(appRecord.startedAt, undefined);

    const dedicated = findDedicatedJob(dbPath, queued.id);
    assert.ok(dedicated);
    assert.equal(dedicated.status, "queued");
    assert.equal(dedicated.started_at, null);
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("enqueueRecurringJob dual-writes a non-scheduled-agent job on both sides", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const seed = enqueueJob({
      workspaceId: "workspace_a",
      type: "scheduler.tick",
      payload: { foo: "bar" },
      cron: "*/5 * * * *",
    });

    const recurring = enqueueRecurringJob(seed, "2026-04-27T00:00:00.000Z");
    assert.ok(recurring);
    assert.equal(recurring.type, "scheduler.tick");
    assert.equal(recurring.scheduledAt, "2026-04-27T00:00:00.000Z");

    const appRecord = findAppRecordJob(dbPath, recurring.id);
    assert.ok(appRecord);
    assert.equal(appRecord.scheduledAt, "2026-04-27T00:00:00.000Z");

    const dedicated = findDedicatedJob(dbPath, recurring.id);
    assert.ok(dedicated);
    assert.equal(dedicated.scheduled_at, "2026-04-27T00:00:00.000Z");
    assert.equal(dedicated.cron, "*/5 * * * *");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("enqueueRecurringJob dual-writes a scheduled agent job and any cancelled stale entries", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    seedAgentDirectly(dbPath, makeAgent({ id: "agent_alpha" }));

    const seedJob: JobRecord = {
      id: "seed-id",
      workspaceId: "workspace_a",
      type: "agent.run",
      payload: { agentId: "agent_alpha", triggerKind: "schedule" },
      status: "running",
      attempts: 1,
      maxAttempts: 3,
      cron: "*/5 * * * *",
      scheduledAt: "2026-04-26T12:00:00.000Z",
      createdAt: "2026-04-26T12:00:00.000Z",
      updatedAt: "2026-04-26T12:00:00.000Z",
    };
    const result = enqueueRecurringJob(seedJob, "2026-04-26T12:05:00.000Z");
    assert.ok(result);
    assert.equal(result.workspaceId, "workspace_a");
    assert.equal(result.type, "agent.run");

    const dedicated = findDedicatedJob(dbPath, result.id);
    assert.ok(dedicated);
    assert.equal(dedicated.status, "queued");
    assert.equal(dedicated.cron, "*/5 * * * *");
    assert.equal(dedicated.scheduled_at, "2026-04-26T12:05:00.000Z");

    const appRecord = findAppRecordJob(dbPath, result.id);
    assert.ok(appRecord);
    assert.equal(appRecord.status, "queued");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("maintainScheduledAgentJobs dual-writes maintained records on both sides", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    seedAgentDirectly(dbPath, makeAgent({ id: "agent_alpha" }));

    const maintained = maintainScheduledAgentJobs("agent_alpha");
    assert.equal(maintained.length, 1);
    const record = maintained[0];
    assert.equal(record.type, "agent.run");
    assert.equal(record.payload.agentId, "agent_alpha");

    const dedicated = findDedicatedJob(dbPath, record.id);
    assert.ok(dedicated, "dedicated row should exist for the maintained job");
    assert.equal(dedicated.status, "queued");
    assert.equal(dedicated.cron, "*/5 * * * *");

    const appRecord = findAppRecordJob(dbPath, record.id);
    assert.ok(appRecord);
    assert.equal(appRecord.status, "queued");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("maintainScheduledAgentJobs dual-writes cancellations of stale scheduled jobs", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    seedAgentDirectly(dbPath, makeAgent({ id: "agent_alpha", schedule: "*/10 * * * *" }));

    // First pass produces one queued job with cron "*/10 * * * *".
    const first = maintainScheduledAgentJobs("agent_alpha");
    assert.equal(first.length, 1);
    const initialId = first[0].id;
    assert.equal(first[0].cron, "*/10 * * * *");

    // Now change the agent's schedule. The next maintain should cancel the stale job and create a new one.
    seedAgentDirectly(dbPath, makeAgent({ id: "agent_alpha", schedule: "*/15 * * * *" }));

    const second = maintainScheduledAgentJobs("agent_alpha");
    assert.equal(second.length, 1);
    const newId = second[0].id;
    assert.notEqual(newId, initialId);

    // The dedicated table should now reflect both: the cancelled stale job and the newly maintained one.
    const dedicatedStale = findDedicatedJob(dbPath, initialId);
    assert.ok(dedicatedStale);
    assert.equal(dedicatedStale.status, "canceled");
    assert.equal(dedicatedStale.cancel_requested, 1);

    const dedicatedNew = findDedicatedJob(dbPath, newId);
    assert.ok(dedicatedNew);
    assert.equal(dedicatedNew.status, "queued");
    assert.equal(dedicatedNew.cron, "*/15 * * * *");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("enqueueJob does not touch the dedicated jobs table in JSON-default mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-jobs-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  delete process.env.TASKLOOM_STORE;
  // Point the SQLite path at our temp DB so any accidental writes would land there
  // (and we can detect them); but since TASKLOOM_STORE is unset, the dual-write
  // code path is gated off and should not open this DB at all.
  process.env.TASKLOOM_DB_PATH = dbPath;
  clearStoreCacheForTests();
  resetStoreForTests();
  try {
    const before = readDedicatedJobs(dbPath);
    const job = enqueueJob({ workspaceId: "workspace_a", type: "agent.run" });
    const updated = updateJob(job.id, { status: "success" });
    assert.ok(updated);
    const canceled = enqueueJob({ workspaceId: "workspace_a", type: "agent.run.two" });
    cancelJob(canceled.id);

    const after = readDedicatedJobs(dbPath);
    assert.equal(after.length, before.length, "dedicated table must remain unchanged in JSON mode");
  } finally {
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    if (previousDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = previousDbPath;
    clearStoreCacheForTests();
    resetStoreForTests();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
