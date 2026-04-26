import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils";
import { jobRoutes } from "./job-routes";
import { enqueueJob, findJob } from "./jobs/store";
import { login } from "./taskloom-services";
import { resetStoreForTests } from "./taskloom-store";

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
