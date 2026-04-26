import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils";
import { jobRoutes } from "./job-routes";
import { enqueueJob, findJob } from "./jobs/store";
import { login } from "./taskloom-services";
import { mutateStore, resetStoreForTests } from "./taskloom-store";

function createTestApp() {
  const app = new Hono();
  app.route("/api/app/jobs", jobRoutes);
  return app;
}

function authHeaders(cookieValue: string) {
  return { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
}

test("job detail does not expose jobs from another workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const betaJob = enqueueJob({ workspaceId: "beta", type: "test.cross-workspace" });

  const response = await app.request(`/api/app/jobs/${betaJob.id}`, {
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(body, { error: "not found" });
});

test("job cancel does not cancel jobs from another workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const betaJob = enqueueJob({ workspaceId: "beta", type: "test.cross-workspace" });

  const response = await app.request(`/api/app/jobs/${betaJob.id}/cancel`, {
    method: "POST",
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json();
  const fresh = findJob(betaJob.id);

  assert.equal(response.status, 404);
  assert.deepEqual(body, { error: "not found" });
  assert.equal(fresh?.status, "queued");
  assert.equal(fresh?.cancelRequested, undefined);
});

test("job creation rejects invalid scheduling fields", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const cases = [
    [{ type: "test.invalid", scheduledAt: "not-a-date" }, "scheduledAt must be a valid date"],
    [{ type: "test.invalid", cron: "not cron" }, "cron must be a valid 5-field expression"],
    [{ type: "test.invalid", maxAttempts: 0 }, "maxAttempts must be a positive integer"],
  ] as const;

  for (const [payload, message] of cases) {
    const response = await app.request("/api/app/jobs", {
      method: "POST",
      headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: message });
  }
});

test("job list filters to the authenticated workspace with status and limit", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  enqueueJob({ workspaceId: "alpha", type: "test.oldest" });
  enqueueJob({ workspaceId: "beta", type: "test.beta" });
  const newestAlpha = enqueueJob({ workspaceId: "alpha", type: "test.newest" });

  const response = await app.request("/api/app/jobs?status=queued&limit=1", {
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json() as { jobs: { id: string; workspaceId: string; status: string; type: string }[] };

  assert.equal(response.status, 200);
  assert.deepEqual(body.jobs.map((job) => job.id), [newestAlpha.id]);
  assert.equal(body.jobs[0]?.workspaceId, "alpha");
  assert.equal(body.jobs[0]?.status, "queued");
});

test("job management requires an admin role but job reads allow viewers", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const alphaJob = enqueueJob({ workspaceId: "alpha", type: "test.viewer" });
  mutateStore((data) => {
    const membership = data.memberships.find((entry) => entry.workspaceId === "alpha" && entry.userId === "user_alpha");
    assert.ok(membership);
    membership.role = "viewer";
  });

  const listResponse = await app.request("/api/app/jobs", {
    headers: authHeaders(alpha.cookieValue),
  });
  const detailResponse = await app.request(`/api/app/jobs/${alphaJob.id}`, {
    headers: authHeaders(alpha.cookieValue),
  });
  const createResponse = await app.request("/api/app/jobs", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ type: "test.denied" }),
  });
  const cancelResponse = await app.request(`/api/app/jobs/${alphaJob.id}/cancel`, {
    method: "POST",
    headers: authHeaders(alpha.cookieValue),
  });

  assert.equal(listResponse.status, 200);
  assert.equal(detailResponse.status, 200);
  assert.equal(createResponse.status, 403);
  assert.deepEqual(await createResponse.json(), { error: "workspace role admin is required" });
  assert.equal(cancelResponse.status, 403);
  assert.deepEqual(await cancelResponse.json(), { error: "workspace role admin is required" });
});

test("job creation stores optional scheduling fields in the authenticated workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const response = await app.request("/api/app/jobs", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({
      type: "test.scheduled",
      payload: { source: "route-test" },
      scheduledAt: "2026-01-01T00:00:00.000Z",
      cron: "0 9 * * 1",
      maxAttempts: 5,
    }),
  });
  const body = await response.json() as { job: { workspaceId: string; type: string; payload: unknown; scheduledAt: string; cron: string; maxAttempts: number } };

  assert.equal(response.status, 201);
  assert.equal(body.job.workspaceId, "alpha");
  assert.equal(body.job.type, "test.scheduled");
  assert.deepEqual(body.job.payload, { source: "route-test" });
  assert.equal(body.job.scheduledAt, "2026-01-01T00:00:00.000Z");
  assert.equal(body.job.cron, "0 9 * * 1");
  assert.equal(body.job.maxAttempts, 5);
});

test("job creation rejects agent runs outside the authenticated workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const response = await app.request("/api/app/jobs", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({
      type: "agent.run",
      payload: { agentId: "agent_beta_dependency_watch", triggerKind: "schedule" },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: "agent.run payload.agentId must reference an agent in this workspace" });
});
