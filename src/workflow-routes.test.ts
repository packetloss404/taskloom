import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { resetStoreForTests } from "./taskloom-store";
import { workflowRoutes } from "./workflow-routes";

function createTestApp() {
  const app = new Hono();
  app.route("/api/app/workflow", workflowRoutes);
  return app;
}

test("workflow routes require authentication", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/app/workflow/brief");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "authentication required" });
});
