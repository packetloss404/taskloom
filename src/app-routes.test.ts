import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils";
import { appRoutes } from "./app-routes";
import { login } from "./taskloom-services";
import { mutateStore, resetStoreForTests } from "./taskloom-store";

function createTestApp() {
  const app = new Hono();
  app.route("/api", appRoutes);
  return app;
}

function authHeaders(cookieValue: string) {
  return { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
}

test("app activation route requires authentication", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/app/activation");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "authentication required" });
});

test("app activation detail is scoped to the authenticated workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const response = await app.request("/api/app/activation", {
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json() as { workspace: { id: string }; activities: { workspaceId: string }[] };

  assert.equal(response.status, 200);
  assert.equal(body.workspace.id, "alpha");
  assert.ok(body.activities.length > 0);
  assert.ok(body.activities.every((activity) => activity.workspaceId === "alpha"));
});

test("activity list and detail do not expose another workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  mutateStore((data) => {
    data.activities.unshift(
      {
        id: "activity_beta_private_route_test",
        workspaceId: "beta",
        scope: "activation",
        event: "route.private_beta",
        actor: { type: "system", id: "test" },
        data: { title: "Beta private activity" },
        occurredAt: "2026-01-03T00:00:00.000Z",
      },
      {
        id: "activity_alpha_newer_route_test",
        workspaceId: "alpha",
        scope: "activation",
        event: "route.alpha_newer",
        actor: { type: "system", id: "test" },
        data: { title: "Alpha newer activity" },
        occurredAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "activity_alpha_older_route_test",
        workspaceId: "alpha",
        scope: "activation",
        event: "route.alpha_older",
        actor: { type: "system", id: "test" },
        data: { title: "Alpha older activity" },
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    );
  });

  const listResponse = await app.request("/api/app/activity", {
    headers: authHeaders(alpha.cookieValue),
  });
  const listBody = await listResponse.json() as { activities: { id: string; workspaceId: string }[] };

  assert.equal(listResponse.status, 200);
  assert.ok(listBody.activities.some((activity) => activity.id === "activity_alpha_newer_route_test"));
  assert.ok(!listBody.activities.some((activity) => activity.id === "activity_beta_private_route_test"));
  assert.ok(listBody.activities.every((activity) => activity.workspaceId === "alpha"));

  const detailResponse = await app.request("/api/app/activity/activity_beta_private_route_test", {
    headers: authHeaders(alpha.cookieValue),
  });
  const detailBody = await detailResponse.json();

  assert.equal(detailResponse.status, 404);
  assert.deepEqual(detailBody, { error: "activity not found" });
});
