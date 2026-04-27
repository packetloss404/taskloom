import assert from "node:assert/strict";
import test from "node:test";
import type { JobRecord, TaskloomData } from "./taskloom-store.js";
import { getOperationsStatus } from "./operations-status.js";

function emptyStore(): TaskloomData {
  return { jobs: [] } as unknown as TaskloomData;
}

function storeWithJobs(jobs: JobRecord[]): TaskloomData {
  return { jobs } as unknown as TaskloomData;
}

function fakeJob(type: string, status: JobRecord["status"], id: string): JobRecord {
  return {
    id,
    workspaceId: "alpha",
    type,
    payload: {},
    status,
    attempts: 0,
    maxAttempts: 1,
    scheduledAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("default env yields json store, off leader mode, off access log, default knobs", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.store.mode, "json");
  assert.equal(status.scheduler.leaderMode, "off");
  assert.equal(status.scheduler.leaderTtlMs, 30000);
  assert.equal(status.scheduler.leaderHeldLocally, true);
  assert.equal(status.scheduler.lockSummary, "local");
  assert.equal(status.accessLog.mode, "off");
  assert.equal(status.accessLog.path, null);
  assert.equal(status.accessLog.maxBytes, 0);
  assert.equal(status.accessLog.maxFiles, 5);
  assert.deepEqual(status.jobs, []);
  assert.equal(status.runtime.nodeVersion, process.versions.node);
});

test("TASKLOOM_STORE=sqlite flips store mode", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_STORE: "sqlite" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.store.mode, "sqlite");
});

test("file leader mode reflects custom path and not-held when no probe registered", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_SCHEDULER_LEADER_MODE: "FILE",
      TASKLOOM_SCHEDULER_LEADER_FILE_PATH: "var/lib/taskloom/leader.json",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "file");
  assert.equal(status.scheduler.lockSummary, "var/lib/taskloom/leader.json");
  assert.equal(status.scheduler.leaderHeldLocally, false);
});

test("http leader mode strips query string from URL summary", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_SCHEDULER_LEADER_MODE: "http",
      TASKLOOM_SCHEDULER_LEADER_HTTP_URL: "https://coord.internal/leader?token=secret123&extra=yes",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "http");
  assert.equal(status.scheduler.lockSummary, "https://coord.internal/leader");
  assert.equal(status.scheduler.leaderHeldLocally, false);
});

test("invalid leader mode falls back to off without throwing", () => {
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: { TASKLOOM_SCHEDULER_LEADER_MODE: "bogus" },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(status.scheduler.leaderMode, "off");
  assert.equal(status.scheduler.lockSummary, "local");
  assert.equal(status.scheduler.leaderHeldLocally, true);
});

test("jobs grouping aggregates statuses across types and uses succeeded for success", () => {
  const status = getOperationsStatus({
    loadStore: () => storeWithJobs([
      fakeJob("agent.run", "queued", "j1"),
      fakeJob("agent.run", "queued", "j2"),
      fakeJob("agent.run", "running", "j3"),
      fakeJob("agent.run", "success", "j4"),
      fakeJob("agent.run", "failed", "j5"),
      fakeJob("agent.run", "canceled", "j6"),
      fakeJob("brief.send", "queued", "j7"),
      fakeJob("brief.send", "success", "j8"),
      fakeJob("brief.send", "success", "j9"),
    ]),
    env: {},
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.deepEqual(status.jobs, [
    { type: "agent.run", queued: 2, running: 1, succeeded: 1, failed: 1, canceled: 1 },
    { type: "brief.send", queued: 1, running: 0, succeeded: 2, failed: 0, canceled: 0 },
  ]);
});

test("access log reads max bytes, clamps max files to >= 1, and exposes file path", () => {
  const clamped = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "FILE",
      TASKLOOM_ACCESS_LOG_PATH: "logs/access.log",
      TASKLOOM_ACCESS_LOG_MAX_BYTES: "1048576",
      TASKLOOM_ACCESS_LOG_MAX_FILES: "0",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(clamped.accessLog.mode, "file");
  assert.equal(clamped.accessLog.path, "logs/access.log");
  assert.equal(clamped.accessLog.maxBytes, 1048576);
  assert.equal(clamped.accessLog.maxFiles, 1);

  const stdoutMode = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
      TASKLOOM_ACCESS_LOG_MAX_FILES: "10",
    },
    now: () => new Date("2026-04-26T12:00:00.000Z"),
  });

  assert.equal(stdoutMode.accessLog.mode, "stdout");
  assert.equal(stdoutMode.accessLog.path, null);
  assert.equal(stdoutMode.accessLog.maxFiles, 10);
});

test("generatedAt reflects the injected now", () => {
  const fixedDate = new Date("2026-04-26T13:37:00.000Z");
  const status = getOperationsStatus({
    loadStore: () => emptyStore(),
    env: {},
    now: () => fixedDate,
  });

  assert.equal(status.generatedAt, "2026-04-26T13:37:00.000Z");
});
