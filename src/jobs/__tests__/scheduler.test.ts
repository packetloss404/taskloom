import { test } from "node:test";
import assert from "node:assert/strict";
import { listInvitationEmailDeliveriesIndexed, resetStoreForTests } from "../../taskloom-store.js";
import { createAgent, createWorkspaceInvitation, handleInvitationEmailJob, INVITATION_EMAIL_JOB_TYPE, login, resendWorkspaceInvitation, updateAgent } from "../../taskloom-services.js";
import { TASKLOOM_INVITATION_EMAIL_MODE_ENV, TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS_ENV, TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV } from "../../invitation-email.js";
import { resetInvitationEmailDeliveryForTests, setInvitationEmailFetchForTests } from "../../invitation-email-delivery.js";
import { enqueueJob, enqueueRecurringJob, findJob, listJobs, maintainScheduledAgentJobs, updateJob } from "../store.js";
import { JobScheduler } from "../scheduler.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
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

test("scheduler dead-letters invitation email retry jobs after webhook failures", async () => {
  const previousMode = process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV];
  const previousUrl = process.env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV];
  const previousMaxAttempts = process.env[TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS_ENV];
  try {
    process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV] = "webhook";
    process.env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV] = "https://email.example/invitations";
    process.env[TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS_ENV] = "2";
    resetStoreForTests();
    resetInvitationEmailDeliveryForTests();
    setInvitationEmailFetchForTests(async () => {
      throw new Error("provider unavailable");
    });
    const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
    const created = await createWorkspaceInvitation(auth.context, { email: "deadletter@test.example", role: "member" });
    const retryJobId = created.emailDelivery.retryJobId;
    assert.ok(retryJobId, "expected retry job id");

    const scheduler = new JobScheduler({ pollIntervalMs: 30 });
    scheduler.register({ type: INVITATION_EMAIL_JOB_TYPE, handle: handleInvitationEmailJob });
    scheduler.start();
    for (let i = 0; i < 80; i++) {
      const fresh = findJob(retryJobId);
      if (fresh?.status === "failed") break;
      if (fresh?.status === "queued") updateJob(fresh.id, { scheduledAt: new Date().toISOString() });
      await wait(40);
    }
    await scheduler.stop();

    const fresh = findJob(retryJobId);
    assert.equal(fresh?.status, "failed");
    assert.equal(fresh?.attempts, 2);
    assert.match(fresh?.error ?? "", /provider unavailable/);
    const deliveries = listInvitationEmailDeliveriesIndexed("alpha", created.invitation.id);
    assert.equal(deliveries.length, 3);
    assert.deepEqual(deliveries.map((delivery) => delivery.status), ["failed", "failed", "failed"]);
  } finally {
    resetInvitationEmailDeliveryForTests();
    restoreEnv(TASKLOOM_INVITATION_EMAIL_MODE_ENV, previousMode);
    restoreEnv(TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV, previousUrl);
    restoreEnv(TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS_ENV, previousMaxAttempts);
  }
});

test("invitation email retry jobs resolve the current invitation token", async () => {
  const previousMode = process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV];
  const previousUrl = process.env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV];
  try {
    process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV] = "webhook";
    process.env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV] = "https://email.example/invitations";
    resetStoreForTests();
    resetInvitationEmailDeliveryForTests();
    const webhookBodies: Array<{ token?: string; action?: string }> = [];
    setInvitationEmailFetchForTests(async (_url, init) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as { token?: string; action?: string } : {};
      webhookBodies.push(body);
      if (webhookBodies.length === 1) throw new Error("first send failed");
      return new Response(null, { status: 204 });
    });
    const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
    const created = await createWorkspaceInvitation(auth.context, { email: "current-token@test.example", role: "member" });
    const retryJobId = created.emailDelivery.retryJobId;
    assert.ok(retryJobId, "expected retry job id");
    const originalToken = created.invitation.token;

    const resent = await resendWorkspaceInvitation(auth.context, created.invitation.id);
    assert.notEqual(resent.invitation.token, originalToken);
    const retryJob = findJob(retryJobId);
    assert.ok(retryJob, "expected retry job");

    await handleInvitationEmailJob(retryJob);

    assert.equal(webhookBodies.length, 3);
    assert.equal(webhookBodies[2]?.action, "create");
    assert.equal(webhookBodies[2]?.token, resent.invitation.token);
    assert.notEqual(webhookBodies[2]?.token, originalToken);
  } finally {
    resetInvitationEmailDeliveryForTests();
    restoreEnv(TASKLOOM_INVITATION_EMAIL_MODE_ENV, previousMode);
    restoreEnv(TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV, previousUrl);
  }
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

test("scheduled agents maintain one future agent.run job", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const { agent } = createAgent(auth.context, {
    name: "Scheduled Agent",
    instructions: "Run on a schedule and summarize workspace state.",
    triggerKind: "schedule",
    schedule: "*/15 * * * *",
  });

  maintainScheduledAgentJobs(agent.id);
  maintainScheduledAgentJobs(agent.id);

  const queued = listJobs(auth.context.workspace.id, { status: "queued" })
    .filter((job) => job.type === "agent.run" && job.payload.agentId === agent.id);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].cron, "*/15 * * * *");
  assert.equal(queued[0].payload.triggerKind, "schedule");
});

test("non-schedule or inactive agents do not keep queued scheduled jobs", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const { agent } = createAgent(auth.context, {
    name: "Toggle Agent",
    instructions: "Run on a schedule and summarize workspace state.",
    triggerKind: "schedule",
    schedule: "*/10 * * * *",
  });

  updateAgent(auth.context, agent.id, { triggerKind: "manual", schedule: "*/10 * * * *" });
  let queued = listJobs(auth.context.workspace.id, { status: "queued" })
    .filter((job) => job.type === "agent.run" && job.payload.agentId === agent.id);
  assert.equal(queued.length, 0);

  updateAgent(auth.context, agent.id, { triggerKind: "schedule", status: "paused" });
  queued = listJobs(auth.context.workspace.id, { status: "queued" })
    .filter((job) => job.type === "agent.run" && job.payload.agentId === agent.id);
  assert.equal(queued.length, 0);
});

test("invalid agent cron schedules do not enqueue jobs", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const { agent } = createAgent(auth.context, {
    name: "Invalid Cron Agent",
    instructions: "Run on a schedule and summarize workspace state.",
    triggerKind: "schedule",
    schedule: "not a cron",
  });

  const queued = listJobs(auth.context.workspace.id, { status: "queued" })
    .filter((job) => job.type === "agent.run" && job.payload.agentId === agent.id);
  assert.equal(queued.length, 0);
});

test("scheduler runs a seeded scheduled agent.run job", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const { agent } = createAgent(auth.context, {
    name: "Runnable Scheduled Agent",
    instructions: "Run on a schedule and summarize workspace state.",
    triggerKind: "schedule",
    schedule: "*/20 * * * *",
  });
  const seeded = listJobs(auth.context.workspace.id, { status: "queued" })
    .find((job) => job.type === "agent.run" && job.payload.agentId === agent.id);
  assert.ok(seeded);
  updateJob(seeded.id, { scheduledAt: new Date().toISOString() });

  const ran: string[] = [];
  const scheduler = new JobScheduler({ pollIntervalMs: 30 });
  scheduler.register({
    type: "agent.run",
    async handle(job) {
      ran.push(String(job.payload.agentId));
      return { ok: true };
    },
  });
  scheduler.start();
  for (let i = 0; i < 50; i++) {
    const fresh = findJob(seeded.id);
    if (fresh?.status === "success") break;
    await wait(30);
  }
  await scheduler.stop();

  assert.deepEqual(ran, [agent.id]);
  assert.equal(findJob(seeded.id)?.status, "success");
});

test("recurring scheduled agent jobs preserve payload inputs", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const { agent } = createAgent(auth.context, {
    name: "Input Scheduled Agent",
    instructions: "Run on a schedule and summarize workspace state.",
    triggerKind: "schedule",
    schedule: "*/20 * * * *",
  });
  const seeded = listJobs(auth.context.workspace.id, { status: "queued" })
    .find((job) => job.type === "agent.run" && job.payload.agentId === agent.id);
  assert.ok(seeded);
  updateJob(seeded.id, {
    status: "success",
    payload: { ...seeded.payload, inputs: { mailbox: "support@example.com" } },
  });

  const next = enqueueRecurringJob(findJob(seeded.id)!, new Date(Date.now() + 60_000).toISOString());

  assert.deepEqual(next?.payload.inputs, { mailbox: "support@example.com" });
  assert.equal(next?.payload.agentId, agent.id);
  assert.equal(next?.payload.triggerKind, "schedule");
});
