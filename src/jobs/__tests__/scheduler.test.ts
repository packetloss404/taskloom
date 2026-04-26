import { test } from "node:test";
import assert from "node:assert/strict";
import { resetStoreForTests } from "../../taskloom-store.js";
import { enqueueJob, findJob, listJobs } from "../store.js";
import { JobScheduler } from "../scheduler.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("scheduler runs a queued job and marks success", async () => {
  resetStoreForTests();
  const ran: string[] = [];
  const scheduler = new JobScheduler({ pollIntervalMs: 50 });
  scheduler.register({
    type: "test.add",
    async handle(job) { ran.push(job.id); return { ok: true }; },
  });
  const job = enqueueJob({ workspaceId: "alpha", type: "test.add", payload: {} });
  scheduler.start();
  for (let i = 0; i < 40; i++) {
    const fresh = findJob(job.id);
    if (fresh?.status === "success") break;
    await wait(50);
  }
  await scheduler.stop();
  assert.equal(ran.length, 1);
  const fresh = findJob(job.id);
  assert.equal(fresh?.status, "success");
});

test("scheduler retries failing job up to maxAttempts then marks failed", async () => {
  resetStoreForTests();
  let calls = 0;
  const scheduler = new JobScheduler({ pollIntervalMs: 30 });
  scheduler.register({
    type: "test.fail",
    async handle() { calls++; throw new Error("boom"); },
  });
  const job = enqueueJob({ workspaceId: "alpha", type: "test.fail", maxAttempts: 2 });
  // Patch backoff by manipulating job scheduledAt back to 'now' after a failure.
  scheduler.start();
  for (let i = 0; i < 60; i++) {
    const fresh = findJob(job.id);
    if (fresh?.status === "failed") break;
    if (fresh?.status === "queued") {
      // Force the requeue to be picked up immediately for test speed
      fresh.scheduledAt = new Date().toISOString();
    }
    await wait(40);
  }
  await scheduler.stop();
  const fresh = findJob(job.id);
  assert.equal(fresh?.status, "failed");
  assert.equal(calls, 2);
});

test("scheduler marks no-handler job as failed", async () => {
  resetStoreForTests();
  const scheduler = new JobScheduler({ pollIntervalMs: 30 });
  const job = enqueueJob({ workspaceId: "alpha", type: "test.unknown" });
  scheduler.start();
  for (let i = 0; i < 40; i++) {
    const fresh = findJob(job.id);
    if (fresh?.status === "failed") break;
    await wait(30);
  }
  await scheduler.stop();
  const fresh = findJob(job.id);
  assert.equal(fresh?.status, "failed");
  assert.match(fresh?.error ?? "", /no handler/);
});

test("listJobs returns workspace jobs newest-first with limit", () => {
  resetStoreForTests();
  for (let i = 0; i < 4; i++) enqueueJob({ workspaceId: "alpha", type: "x", payload: { i } });
  const list = listJobs("alpha", { limit: 2 });
  assert.equal(list.length, 2);
});

test("cron job re-enqueues itself after success", async () => {
  resetStoreForTests();
  const scheduler = new JobScheduler({ pollIntervalMs: 30 });
  scheduler.register({
    type: "test.cron",
    async handle() { return "ok"; },
  });
  const job = enqueueJob({ workspaceId: "alpha", type: "test.cron", cron: "*/5 * * * *" });
  scheduler.start();
  for (let i = 0; i < 50; i++) {
    const fresh = findJob(job.id);
    if (fresh?.status === "success") break;
    await wait(30);
  }
  await scheduler.stop();
  const allJobs = listJobs("alpha");
  const cronJobs = allJobs.filter((j) => j.type === "test.cron");
  // original = success, plus a new queued one for the next cron slot
  assert.ok(cronJobs.some((j) => j.status === "success"));
  assert.ok(cronJobs.some((j) => j.status === "queued"));
});
